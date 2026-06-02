import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost, PublicUser } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	const { slug, year, month, day } = getQuery(event);
	if (!slug || typeof slug !== 'string' || Array.isArray(slug)) {
		throw createError({ statusCode: 400, statusMessage: 'No valid slug provided' });
	}

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

	const year0 = Number(year);
	const month0 = Number(month);
	const day0 = Number(day);

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

	const cacheKey = `nuxtpress:blog_post:v3:${slug}:${year0}:${month0}:${day0}`;

	const cached = await kv.get(cacheKey);
	if (cached && typeof cached === 'string') {
		try {
			return JSON.parse(cached);
		} catch {
			await kv.del(cacheKey);
		}
	}

	const startOfDayUtcMs = Date.UTC(year0, month0 - 1, day0, 0, 0, 0, 0);
	const endOfDayUtcMs = startOfDayUtcMs + 24 * 60 * 60 * 1000;

	const rows = await db
		.select({
			id: blogPosts.id,
			title: blogPosts.title,
			slug: blogPosts.slug,
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
		.where(
			and(
				eq(blogPosts.slug, slug),
				gte(blogPosts.createdAt, new Date(startOfDayUtcMs)),
				lt(blogPosts.createdAt, new Date(endOfDayUtcMs))
			)
		)
		.orderBy(desc(blogPosts.createdAt))
		.limit(1);

	const row = rows[0];

	if (!row) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}

	const author: PublicUser | null = row.authorId
		? {
				id: row.authorId,
				username: row.authorUsername ?? 'unknown',
				displayName: row.authorDisplayName ?? 'Unknown',
				role: (row.authorRole as PublicUser['role']) ?? 'author',
				avatarPathname: row.authorAvatar ?? null,
				bio: row.authorBio ?? null
			}
		: null;

	const res = {
		id: row.id,
		title: row.title,
		slug: row.slug,
		content: row.content,
		created_at: new Date(row.createdAt),
		updated_at: new Date(row.updatedAt),
		thumbnail: row.thumbnail
			? Uint8Array.from(atob(row.thumbnail), (c) => c.charCodeAt(0))
			: undefined,
		thumbnail_url: row.thumbnailUrl || undefined,
		tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : [],
		author_id: row.authorId ?? null,
		author
	} as BlogPost;

	await kv.set(cacheKey, JSON.stringify(res), { ttl: 60 * 60 * 4 });

	return res;
});
