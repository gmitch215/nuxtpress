import { eq } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { requireOwnerOrAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { blogPostUpdateSchema } from '~/shared/schemas';
import { BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const { post } = await readBody<{ post: BlogPostData & { id: string } }>(event);

	if (!post) {
		throw createError({ statusCode: 400, statusMessage: 'No post object provided' });
	}

	if (!post.id || typeof post.id !== 'string' || post.id.trim() === '') {
		throw createError({ statusCode: 400, statusMessage: 'Invalid post ID provided' });
	}

	await requireOwnerOrAdmin(event, post.id);

	const validation = blogPostUpdateSchema.safeParse(post);
	if (!validation.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid post data',
			data: validation.error.issues
		});
	}

	const oldPosts = await db
		.select({ slug: blogPosts.slug, createdAt: blogPosts.createdAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, post.id))
		.limit(1);

	const oldPost = oldPosts[0];

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

	await kv.del('nuxtpress:blog_posts_list');
	await kv.del('nuxtpress:blog_posts_list:v1');
	await kv.del('nuxtpress:blog_posts_list:v2');
	await kv.del('nuxtpress:feed_xml:v2');
	await kv.del(`nuxtpress:slug_exists:${post.slug}`);

	if (oldPost) {
		const oldDate = new Date(oldPost.createdAt);
		const y = oldDate.getUTCFullYear();
		const m = oldDate.getUTCMonth() + 1;
		const d = oldDate.getUTCDate();
		for (const v of ['', 'v2:', 'v3:']) {
			await kv.del(`nuxtpress:blog_post:${v}${oldPost.slug}:${y}:${m}:${d}`);
			await kv.del(`nuxtpress:blog_post:${v}${post.slug}:${y}:${m}:${d}`);
		}

		if (oldPost.slug !== post.slug) {
			await kv.del(`nuxtpress:slug_exists:${oldPost.slug}`);
		}
	}
});
