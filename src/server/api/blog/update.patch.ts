import { eq } from 'drizzle-orm';
import { blogPosts } from '~/server/db/schema';
import { requireOwnerOrAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { invalidatePost, invalidatePostCaches, slugTaken } from '~/server/utils/posts';
import { blogPostUpdateSchema } from '~/shared/schemas';
import type { BlogPostData } from '~/shared/types';

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

	if (post.slug !== oldPost?.slug && (await slugTaken(post.slug, post.id))) {
		throw createError({
			statusCode: 409,
			statusMessage: `The slug "${post.slug}" is already in use — pick a different one`
		});
	}

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

	await invalidatePostCaches();

	if (oldPost) {
		await invalidatePost(oldPost.slug, oldPost.createdAt);
		await invalidatePost(post.slug, oldPost.createdAt);
	}
});
