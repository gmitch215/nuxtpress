import { checkTable } from '~/server/utils';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
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

	const kv = hubKV();
	const cacheKey = `nuxtpress:blog_post:${slug}:${year}:${month}:${day}`;

	// Check cache first
	const cached = await kv.get(cacheKey);
	if (cached && typeof cached === 'string') {
		return JSON.parse(cached);
	}

	const db = hubDatabase();
	checkTable(db);

	// Get all posts with the same slug
	const posts = await db
		.prepare('SELECT * FROM blog_posts WHERE slug = ?1')
		.bind(slug)
		.all<BlogPost>()
		.then((result) => {
			if (!result.success) {
				throw createError({
					statusCode: 500,
					statusMessage: 'Database query failed'
				});
			}

			return result.results.map((row) => ({
				...row,
				created_at: new Date(row.created_at as any),
				updated_at: new Date(row.updated_at as any),
				tags: (row.tags as any)
					? (row.tags as any as string).split(',').map((t: string) => t.trim())
					: []
			})) as BlogPost[];
		});

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
