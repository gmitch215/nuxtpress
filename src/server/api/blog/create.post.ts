import { blogPosts } from '~/server/db/schema';
import { requireAuthed } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { invalidatePost, invalidatePostCaches, slugTaken } from '~/server/utils/posts';
import { blogPostCreateSchema } from '~/shared/schemas';
import type { BlogPost, BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	const user = await requireAuthed(event);
	await ensureDatabase();

	const { post } = await readBody<{ post: BlogPostData }>(event);

	if (!post) {
		throw createError({ statusCode: 400, statusMessage: 'No post object provided' });
	}

	const validation = blogPostCreateSchema.safeParse(post);
	if (!validation.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid post data',
			data: validation.error.issues
		});
	}

	// slugs address a post on their own now, so they have to be unique across all dates
	if (await slugTaken(post.slug)) {
		throw createError({
			statusCode: 409,
			statusMessage: `The slug "${post.slug}" is already in use — pick a different one`
		});
	}

	const id = crypto.randomUUID().replace(/-/g, '');
	const tagsString = post.tags && post.tags.length > 0 ? post.tags.join(',') : null;
	const thumbnailString = post.thumbnail ? btoa(String.fromCharCode(...post.thumbnail)) : null;
	const now = new Date();

	await db.insert(blogPosts).values({
		id,
		title: post.title,
		slug: post.slug,
		content: post.content,
		thumbnail: thumbnailString,
		thumbnailUrl: post.thumbnail_url || null,
		tags: tagsString,
		authorId: user.id,
		createdAt: now,
		updatedAt: now
	});

	await invalidatePostCaches();
	await invalidatePost(post.slug, now);

	return {
		id,
		...post,
		created_at: now,
		updated_at: now,
		author_id: user.id
	} as BlogPost;
});
