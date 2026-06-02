import { and, eq, sql } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { requireAuthed } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { blogPostCreateSchema } from '~/shared/schemas';
import { BlogPostData, type BlogPost } from '~/shared/types';

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

	const now = new Date();
	const dateStr = now.toISOString().split('T')[0];
	let finalSlug = post.slug;
	let counter = 1;
	let slugExists = true;

	while (slugExists) {
		const existing = await db
			.select({ id: blogPosts.id })
			.from(blogPosts)
			.where(
				and(
					eq(blogPosts.slug, finalSlug),
					sql`DATE(${blogPosts.createdAt} / 1000, 'unixepoch') = ${dateStr}`
				)
			)
			.limit(1);

		if (existing.length === 0) {
			slugExists = false;
		} else {
			finalSlug = `${post.slug}-${counter}`;
			counter++;
		}
	}

	const id = crypto.randomUUID().replace(/-/g, '');
	const tagsString = post.tags && post.tags.length > 0 ? post.tags.join(',') : null;
	const thumbnailString = post.thumbnail ? btoa(String.fromCharCode(...post.thumbnail)) : null;

	await db.insert(blogPosts).values({
		id,
		title: post.title,
		slug: finalSlug,
		content: post.content,
		thumbnail: thumbnailString,
		thumbnailUrl: post.thumbnail_url || null,
		tags: tagsString,
		authorId: user.id
	});

	await kv.del('nuxtpress:blog_posts_list');
	await kv.del('nuxtpress:blog_posts_list:v1');
	await kv.del('nuxtpress:blog_posts_list:v2');
	await kv.del('nuxtpress:feed_xml:v2');

	return {
		id,
		...post,
		slug: finalSlug,
		created_at: new Date(),
		updated_at: new Date(),
		author_id: user.id
	} as BlogPost;
});
