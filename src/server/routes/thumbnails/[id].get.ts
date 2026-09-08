import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';

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
		.select({ thumbnail: blogPosts.thumbnail, updatedAt: blogPosts.updatedAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);

	const stored = rows[0]?.thumbnail;
	if (!stored) {
		throw createError({ statusCode: 404, statusMessage: 'No thumbnail for this post' });
	}

	let bytes: Uint8Array;
	try {
		bytes = Uint8Array.from(atob(stored), (c) => c.charCodeAt(0));
	} catch {
		throw createError({ statusCode: 404, statusMessage: 'Thumbnail is not decodable' });
	}

	setHeader(event, 'Content-Type', sniffImageType(bytes));
	setHeader(event, 'Content-Length', bytes.byteLength);
	setHeader(event, 'Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
	setHeader(event, 'ETag', `"${id}-${new Date(rows[0]!.updatedAt).getTime()}"`);
	return bytes;
});
