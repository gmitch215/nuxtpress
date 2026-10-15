import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { decodeDataImage, INLINE_IMAGE_TYPES } from '~/shared/images';

const ID_RE = /^[a-f0-9]{32}$/i;

function sniffImageType(bytes: Uint8Array): string {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg';
	if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png';
	if (bytes[0] === 0x47 && bytes[1] === 0x49) return 'image/gif';
	if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[8] === 0x57) return 'image/webp';
	return 'application/octet-stream';
}

export default defineEventHandler(async (event) => {
	const id = getRouterParam(event, 'id') || '';
	if (!ID_RE.test(id)) {
		throw createError({ statusCode: 400, statusMessage: 'Invalid thumbnail id' });
	}

	await ensureDatabase();

	const rows = await db
		.select({
			thumbnail: blogPosts.thumbnail,
			thumbnailUrl: blogPosts.thumbnailUrl,
			updatedAt: blogPosts.updatedAt
		})
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);

	const row = rows[0];
	const fromUrl = row?.thumbnailUrl?.startsWith('data:')
		? decodeDataImage(row.thumbnailUrl, INLINE_IMAGE_TYPES)
		: null;
	const stored = row?.thumbnail;
	if (!fromUrl && !stored) {
		throw createError({ statusCode: 404, statusMessage: 'No thumbnail for this post' });
	}

	let bytes: Uint8Array;
	let type: string;
	if (fromUrl) {
		bytes = fromUrl.bytes;
		type = fromUrl.mime;
	} else {
		try {
			bytes = Uint8Array.from(atob(stored!), (c) => c.charCodeAt(0));
		} catch {
			throw createError({ statusCode: 404, statusMessage: 'Thumbnail is not decodable' });
		}
		type = sniffImageType(bytes);
	}

	setHeader(event, 'Content-Type', type);
	setHeader(event, 'X-Content-Type-Options', 'nosniff');
	setHeader(event, 'Content-Length', bytes.byteLength);
	setHeader(event, 'Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
	setHeader(event, 'ETag', `"${id}-${new Date(rows[0]!.updatedAt).getTime()}"`);
	return bytes;
});
