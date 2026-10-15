import { eq } from 'drizzle-orm';
import { blogPosts } from '~/server/db/schema';
import { requireOwnerOrAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { deleteMedia, keysOf, resolveMedia } from '~/server/utils/media';
import { invalidatePost, invalidatePostCaches, parseMedia, slugTaken } from '~/server/utils/posts';
import { contentFromMedia } from '~/shared/media';
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

	const { user } = await requireOwnerOrAdmin(event, post.id);

	const validation = blogPostUpdateSchema.safeParse(post);
	if (!validation.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid post data',
			data: validation.error.issues
		});
	}

	const oldPosts = await db
		.select({
			slug: blogPosts.slug,
			createdAt: blogPosts.createdAt,
			type: blogPosts.type,
			media: blogPosts.media,
			thumbnailUrl: blogPosts.thumbnailUrl
		})
		.from(blogPosts)
		.where(eq(blogPosts.id, post.id))
		.limit(1);

	const oldPost = oldPosts[0];
	const data = validation.data;

	if (oldPost && data.type !== oldPost.type) {
		throw createError({ statusCode: 400, statusMessage: 'A post type cannot be changed' });
	}

	const oldKeys = oldPost ? keysOf(parseMedia(oldPost.media), oldPost.thumbnailUrl) : [];
	const media = await resolveMedia(data.type, data.media, data.thumbnail_url, {
		id: user.id,
		isAdmin: user.role === 'administrator',
		existing: new Set(oldKeys)
	});
	const content = data.type === 'slideshow' ? contentFromMedia(media) : data.content;

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
			media: data.type === 'article' ? null : JSON.stringify(media),
			content,
			thumbnail: thumbnailString,
			...(post.thumbnail_url === `/thumbnails/${post.id}`
				? {}
				: { thumbnailUrl: post.thumbnail_url || null }),
			tags: post.tags.join(','),
			updatedAt: new Date()
		})
		.where(eq(blogPosts.id, post.id));

	await invalidatePostCaches();

	const kept = new Set(
		keysOf(
			media,
			post.thumbnail_url === `/thumbnails/${post.id}` ? oldPost?.thumbnailUrl : post.thumbnail_url
		)
	);
	await deleteMedia(oldKeys.filter((key) => !kept.has(key)));

	if (oldPost) {
		await invalidatePost(oldPost.slug, oldPost.createdAt);
		await invalidatePost(post.slug, oldPost.createdAt);
	}
});
