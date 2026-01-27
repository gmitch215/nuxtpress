import { and, eq, sql } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureLoggedIn } from '~/server/utils';
import { ensureDatabase } from '~/server/utils/db';
import { blogPostCreateSchema } from '~/shared/schemas';
import { type BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);
	await ensureDatabase();

	const { post } = await readBody<{ post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'> }>(
		event
	);

	if (!post) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No post object provided'
		});
	}

	const validation = blogPostCreateSchema.safeParse(post);
	if (!validation.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid post data',
			data: validation.error.issues
		});
	}

	// generate unique slug by checking for duplicates on the same date
	const now = new Date();
	const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
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
	// Convert Uint8Array to base64 string for storage
	const thumbnailString = post.thumbnail ? btoa(String.fromCharCode(...post.thumbnail)) : null;

	await db.insert(blogPosts).values({
		id,
		title: post.title,
		slug: finalSlug,
		content: post.content,
		thumbnail: thumbnailString,
		thumbnailUrl: post.thumbnail_url || null,
		tags: tagsString
	});

	// Invalidate caches
	await kv.del('nuxtpress:blog_posts_list');

	return {
		id,
		...post,
		slug: finalSlug,
		created_at: new Date(),
		updated_at: new Date()
	} as BlogPost;
});
