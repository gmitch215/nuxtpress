import { ensureLoggedIn } from '~/server/utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const { id } = getQuery(event);
	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No ID provided'
		});
	}

	const db = hubDatabase();
	const kv = hubKV();

	// Get the post data before deleting for cache invalidation
	const post = await db
		.prepare('SELECT slug, created_at FROM blog_posts WHERE id = ?1')
		.bind(id)
		.first<{ slug: string; created_at: string }>();

	await db.prepare('DELETE FROM blog_posts WHERE id = ?1').bind(id).run();

	// Invalidate caches
	await kv.del('nuxtpress:blog_posts_list');

	if (post?.slug) {
		await kv.del(`nuxtpress:slug_exists:${post.slug}`);

		const postDate = new Date(post.created_at);
		const cacheKey = `nuxtpress:blog_post:${post.slug}:${postDate.getFullYear()}:${postDate.getMonth() + 1}:${postDate.getDate()}`;
		await kv.del(cacheKey);
	}
});
