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

	// Format date for SQL comparison (YYYY-MM-DD)
	const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

	const res = await db
		.prepare('SELECT * FROM blog_posts WHERE slug = ?1 AND DATE(created_at) = ?2')
		.bind(slug, dateStr)
		.first<BlogPost>()
		.then((row) => {
			if (!row) return null;

			// Parse the post data properly
			return {
				...row,
				created_at: new Date(row.created_at as any),
				updated_at: new Date(row.updated_at as any),
				tags: (row.tags as any)
					? (row.tags as any as string).split(',').map((t: string) => t.trim())
					: []
			} as BlogPost;
		});

	if (!res) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Post not found'
		});
	}

	// Cache the result
	await kv.set(cacheKey, JSON.stringify(res), { ttl: 60 * 60 * 4 }); // 4 hours

	return res;
});
