import { checkTable, ensureLoggedIn } from '~/server/utils';
import { blogPostUpdateSchema } from '~/shared/schemas';
import { type BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const { post } = await readBody<{ post: Omit<BlogPost, 'created_at' | 'updated_at'> }>(event);

	if (!post) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No post object provided'
		});
	}

	const validation = blogPostUpdateSchema.safeParse(post);
	if (!validation.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid post data',
			data: validation.error.issues
		});
	}

	const db = hubDatabase();
	const kv = hubKV();
	checkTable(db);

	// get the old post data for cache invalidation
	const oldPost = await db
		.prepare('SELECT slug, created_at FROM blog_posts WHERE id = ?1')
		.bind(post.id)
		.first<{ slug: string; created_at: string }>();

	await db
		.prepare(
			`UPDATE blog_posts SET
				title = ?1,
				slug = ?2,
				content = ?3,
				thumbnail = ?4,
				thumbnail_url = ?5,
				updated_at = CURRENT_TIMESTAMP,
				tags = ?6
				WHERE id = ?7`
		)
		.bind(
			post.title,
			post.slug,
			post.content,
			post.thumbnail || null,
			post.thumbnail_url || null,
			post.tags.join(','),
			post.id
		)
		.run();

	// invalidate caches
	await kv.del('nuxtpress:blog_posts_list');
	await kv.del(`nuxtpress:slug_exists:${post.slug}`);

	if (oldPost) {
		const oldDate = new Date(oldPost.created_at);
		const oldCacheKey = `nuxtpress:blog_post:${oldPost.slug}:${oldDate.getUTCFullYear()}:${oldDate.getUTCMonth() + 1}:${oldDate.getUTCDate()}`;
		await kv.del(oldCacheKey);

		if (oldPost.slug !== post.slug) {
			await kv.del(`nuxtpress:slug_exists:${oldPost.slug}`);
		}

		const newCacheKey = `nuxtpress:blog_post:${post.slug}:${oldDate.getUTCFullYear()}:${oldDate.getUTCMonth() + 1}:${oldDate.getUTCDate()}`;
		await kv.del(newCacheKey);
	}
});
