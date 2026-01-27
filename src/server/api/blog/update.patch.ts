import { eq } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureLoggedIn } from '~/server/utils';
import { ensureDatabase } from '~/server/utils/db';
import { blogPostUpdateSchema } from '~/shared/schemas';
import { type BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);
	await ensureDatabase();

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

	// get the old post data for cache invalidation
	const oldPosts = await db
		.select({ slug: blogPosts.slug, createdAt: blogPosts.createdAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, post.id))
		.limit(1);

	const oldPost = oldPosts[0];

	// Convert Uint8Array to base64 string for storage
	const thumbnailString = post.thumbnail ? btoa(String.fromCharCode(...post.thumbnail)) : null;

	await db
		.update(blogPosts)
		.set({
			title: post.title,
			slug: post.slug,
			content: post.content,
			thumbnail: thumbnailString,
			thumbnailUrl: post.thumbnail_url || null,
			tags: post.tags.join(','),
			updatedAt: new Date()
		})
		.where(eq(blogPosts.id, post.id));

	// invalidate caches
	await kv.del('nuxtpress:blog_posts_list');
	await kv.del(`nuxtpress:slug_exists:${post.slug}`);

	if (oldPost) {
		const oldDate = new Date(oldPost.createdAt);
		const oldCacheKey = `nuxtpress:blog_post:${oldPost.slug}:${oldDate.getUTCFullYear()}:${oldDate.getUTCMonth() + 1}:${oldDate.getUTCDate()}`;
		await kv.del(oldCacheKey);

		if (oldPost.slug !== post.slug) {
			await kv.del(`nuxtpress:slug_exists:${oldPost.slug}`);
		}

		const newCacheKey = `nuxtpress:blog_post:${post.slug}:${oldDate.getUTCFullYear()}:${oldDate.getUTCMonth() + 1}:${oldDate.getUTCDate()}`;
		await kv.del(newCacheKey);
	}
});
