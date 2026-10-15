import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import {
	parseCached,
	parseMedia,
	parseTags,
	publicThumbnailUrl,
	rowToAuthor
} from '~/server/utils/posts';
import { SLUG_RE } from '~/shared/schemas';
import type { BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	const { slug, year, month, day } = getQuery(event);
	if (!slug || typeof slug !== 'string' || Array.isArray(slug)) {
		throw createError({ statusCode: 400, statusMessage: 'No valid slug provided' });
	}

	// slugs only ever match this shape; anything else is a miss (and never becomes a kv key)
	if (!SLUG_RE.test(slug)) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	// date is optional: omitting it resolves the newest post with that slug
	const hasDate = year !== undefined || month !== undefined || day !== undefined;
	let year0 = 0;
	let month0 = 0;
	let day0 = 0;

	if (hasDate) {
		if (
			!year ||
			Array.isArray(year) ||
			Number.isNaN(Number(year)) ||
			!month ||
			Array.isArray(month) ||
			Number.isNaN(Number(month)) ||
			!day ||
			Array.isArray(day) ||
			Number.isNaN(Number(day))
		) {
			throw createError({ statusCode: 400, statusMessage: 'No valid date provided' });
		}

		year0 = Number(year);
		month0 = Number(month);
		day0 = Number(day);

		if (
			!Number.isInteger(year0) ||
			!Number.isInteger(month0) ||
			!Number.isInteger(day0) ||
			year0 < 2000 ||
			year0 > new Date().getUTCFullYear() + 1 ||
			month0 < 1 ||
			month0 > 12 ||
			day0 < 1 ||
			day0 > 31
		) {
			throw createError({ statusCode: 400, statusMessage: 'Date is out of range' });
		}
	}

	const cacheKey = hasDate
		? `nuxtpress:blog_post:v4:${slug}:${year0}:${month0}:${day0}`
		: `nuxtpress:blog_post:v4:${slug}:latest`;

	const cached = parseCached<BlogPost>(await kv.get(cacheKey));
	if (cached) return cached;

	const dateFilter = hasDate
		? [
				gte(blogPosts.createdAt, new Date(Date.UTC(year0, month0 - 1, day0, 0, 0, 0, 0))),
				lt(blogPosts.createdAt, new Date(Date.UTC(year0, month0 - 1, day0 + 1, 0, 0, 0, 0)))
			]
		: [];

	const rows = await db
		.select({
			id: blogPosts.id,
			title: blogPosts.title,
			slug: blogPosts.slug,
			type: blogPosts.type,
			media: blogPosts.media,
			content: blogPosts.content,
			thumbnail: blogPosts.thumbnail,
			thumbnailUrl: blogPosts.thumbnailUrl,
			authorId: blogPosts.authorId,
			createdAt: blogPosts.createdAt,
			updatedAt: blogPosts.updatedAt,
			tags: blogPosts.tags,
			authorUsername: users.username,
			authorDisplayName: users.displayName,
			authorRole: users.role,
			authorAvatar: users.avatarPathname,
			authorBio: users.bio
		})
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.where(and(eq(blogPosts.slug, slug), ...dateFilter))
		.orderBy(desc(blogPosts.createdAt))
		.limit(1);

	const row = rows[0];

	if (!row) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	const author = rowToAuthor(row);
	const res = {
		id: row.id,
		title: row.title,
		slug: row.slug,
		type: row.type,
		media: parseMedia(row.media),
		content: row.content,
		created_at: new Date(row.createdAt),
		updated_at: new Date(row.updatedAt),
		thumbnail_url: publicThumbnailUrl({
			...row,
			hasThumbnail: !!row.thumbnail,
			firstMediaKey: parseMedia(row.media)[0]?.key
		}),
		tags: parseTags(row.tags),
		author_id: row.authorId ?? null,
		author: author ? { ...author, bio: row.authorBio ?? null } : null
	} as BlogPost;

	await kv.set(cacheKey, JSON.stringify(res), { ttl: 60 * 60 * 4 });

	return res;
});
