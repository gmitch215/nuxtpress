import { and, desc, eq, gte, lt } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	const { slug, year, month, day } = getQuery(event);
	if (!slug || typeof slug !== 'string' || Array.isArray(slug)) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No valid slug provided'
		});
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
		throw createError({
			statusCode: 400,
			statusMessage: 'No valid date provided'
		});
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
		throw createError({
			statusCode: 400,
			statusMessage: 'Date is out of range'
		});
	}

	const cacheKey = `nuxtpress:blog_post:v2:${slug}:${year0}:${month0}:${day0}`;

	// Check cache first
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
		.select()
		.from(blogPosts)
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
		throw createError({
			statusCode: 404,
			statusMessage: 'Post not found'
		});
	}

	const res = {
		...row,
		created_at: new Date(row.createdAt),
		updated_at: new Date(row.updatedAt),
		thumbnail: row.thumbnail
			? Uint8Array.from(atob(row.thumbnail), (c) => c.charCodeAt(0))
			: undefined,
		thumbnail_url: row.thumbnailUrl || undefined,
		tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : []
	} as BlogPost;

	// Cache the result
	await kv.set(cacheKey, JSON.stringify(res), { ttl: 60 * 60 * 4 }); // 4 hours

	return res;
});
