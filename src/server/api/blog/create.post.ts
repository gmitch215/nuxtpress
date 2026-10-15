import { blogPosts } from '~/server/db/schema';
import { requireAuthed } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { cloudflareEnv, mailActive } from '~/server/utils/mail';
import { resolveMedia } from '~/server/utils/media';
import { invalidatePost, invalidatePostCaches, slugTaken } from '~/server/utils/posts';
import { enqueuePost, subscriberCounts } from '~/server/utils/subscribers';
import { contentFromMedia } from '~/shared/media';
import { blogPostCreateSchema } from '~/shared/schemas';
import type { BlogPost, BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	const user = await requireAuthed(event);
	await ensureDatabase();

	const { post, notify } = await readBody<{ post: BlogPostData; notify?: boolean }>(event);

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

	const data = validation.data;
	const media = await resolveMedia(data.type, data.media, data.thumbnail_url, {
		id: user.id,
		isAdmin: user.role === 'administrator',
		existing: new Set()
	});
	const content = data.type === 'slideshow' ? contentFromMedia(media) : data.content;

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
		type: data.type,
		media: data.type === 'article' ? null : JSON.stringify(media),
		content,
		thumbnail: thumbnailString,
		thumbnailUrl: post.thumbnail_url || null,
		tags: tagsString,
		authorId: user.id,
		createdAt: now,
		updatedAt: now
	});

	await invalidatePostCaches();
	await invalidatePost(post.slug, now);

	let queued: number | undefined;
	if (notify === true && (await mailActive(cloudflareEnv(event)))) {
		await enqueuePost(id);
		queued = (await subscriberCounts()).active;
	}

	return {
		id,
		...post,
		type: data.type,
		media,
		content,
		...(queued !== undefined ? { queued } : {}),
		created_at: now,
		updated_at: now,
		author_id: user.id
	} as BlogPost;
});
