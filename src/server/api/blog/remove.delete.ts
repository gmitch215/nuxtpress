import { eq } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureLoggedIn } from '~/server/utils';
import { ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);
	await ensureDatabase();

	const { id } = getQuery(event);
	if (!id) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No ID provided'
		});
	}

	// Get the post data before deleting for cache invalidation
	const posts = await db
		.select({ slug: blogPosts.slug, createdAt: blogPosts.createdAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, id as string))
		.limit(1);

	const post = posts[0];

	await db.delete(blogPosts).where(eq(blogPosts.id, id as string));

	// Invalidate caches
	await kv.del('nuxtpress:blog_posts_list');

	if (post?.slug) {
		await kv.del(`nuxtpress:slug_exists:${post.slug}`);

		const postDate = new Date(post.createdAt);
		const cacheKey = `nuxtpress:blog_post:${post.slug}:${postDate.getUTCFullYear()}:${postDate.getUTCMonth() + 1}:${postDate.getUTCDate()}`;
		await kv.del(cacheKey);
	}
});
