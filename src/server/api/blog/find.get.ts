import { eq } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	const { slug, year, month, day } = getQuery(event);
	if (!slug || Array.isArray(slug)) {
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

	const cacheKey = `nuxtpress:blog_post:${slug}:${year}:${month}:${day}`;

	// Check cache first
	const cached = await kv.get(cacheKey);
	if (cached && typeof cached === 'string') {
		return JSON.parse(cached);
	}

	// Get all posts with the same slug
	const rows = await db.select().from(blogPosts).where(eq(blogPosts.slug, slug));

	const posts = rows.map((row) => ({
		...row,
		created_at: row.createdAt,
		updated_at: row.updatedAt,
		thumbnail_url: row.thumbnailUrl,
		tags: row.tags ? row.tags.split(',').map((t: string) => t.trim()) : []
	})) as BlogPost[];

	if (!posts || posts.length === 0) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Post not found'
		});
	}

	// Construct the target date from the URL params
	const targetDate = new Date(Number(year), Number(month) - 1, Number(day));

	// Find the post with the closest date to the target
	const res = posts.reduce((closest, current) => {
		const closestDiff = Math.abs(closest.created_at.getTime() - targetDate.getTime());
		const currentDiff = Math.abs(current.created_at.getTime() - targetDate.getTime());
		return currentDiff < closestDiff ? current : closest;
	});

	// Cache the result
	await kv.set(cacheKey, JSON.stringify(res), { ttl: 60 * 60 * 4 }); // 4 hours

	return res;
});
