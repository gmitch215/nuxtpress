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

	const res = await db
		.prepare('SELECT * FROM blog_posts WHERE slug = ?1')
		.bind(slug)
		.all<BlogPost>()
		.then((row) => {
			if (!row.success) {
				throw createError({
					statusCode: 500,
					statusMessage: 'Database query failed'
				});
			}

			// filter by date - fix: getMonth() returns 0-11, but we store 1-12
			const filtered = row.results.filter((post) => {
				const postDate = new Date(post.created_at);
				return (
					postDate.getFullYear() === Number(year) &&
					postDate.getMonth() + 1 === Number(month) &&
					postDate.getDate() === Number(day)
				);
			})[0];

			if (!filtered) return null;

			// Parse the post data properly
			return {
				...filtered,
				created_at: new Date(filtered.created_at as any),
				updated_at: new Date(filtered.updated_at as any),
				tags: (filtered.tags as any)
					? (filtered.tags as any as string).split(',').map((t: string) => t.trim())
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
