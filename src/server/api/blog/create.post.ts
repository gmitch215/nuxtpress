import { checkTable, ensureLoggedIn } from '~/server/utils';
import { blogPostCreateSchema } from '~/shared/schemas';
import { type BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

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

	const db = hubDatabase();
	const kv = hubKV();
	checkTable(db);

	// generate unique slug by checking for duplicates on the same date
	const now = new Date();
	const dateStr = now.toISOString().split('T')[0]; // YYYY-MM-DD
	let finalSlug = post.slug;
	let counter = 1;
	let slugExists = true;

	while (slugExists) {
		const existing = await db
			.prepare(`SELECT id FROM blog_posts WHERE slug = ?1 AND DATE(created_at) = ?2`)
			.bind(finalSlug, dateStr)
			.first();

		if (!existing) {
			slugExists = false;
		} else {
			finalSlug = `${post.slug}-${counter}`;
			counter++;
		}
	}

	const id = crypto.randomUUID().replace(/-/g, '');

	await db
		.prepare(
			`INSERT INTO blog_posts (id, title, slug, content)
			VALUES (?1, ?2, ?3, ?4)`
		)
		.bind(id, post.title, finalSlug, post.content)
		.run();

	// invalidate caches
	await kv.del('nuxtpress:blog_posts_list');
	if (post.thumbnail) {
		await db
			.prepare(
				`UPDATE blog_posts
			SET thumbnail = ?1, thumbnail_url = ?2
			WHERE id = ?3`
			)
			.bind(post.thumbnail, post.thumbnail_url || null, id)
			.run();
	}

	if (post.thumbnail_url && !post.thumbnail) {
		await db
			.prepare(
				`UPDATE blog_posts
			SET thumbnail_url = ?1
			WHERE id = ?2`
			)
			.bind(post.thumbnail_url, id)
			.run();
	}

	if (post.tags && post.tags.length > 0) {
		const tagsString = post.tags.join(',');
		await db
			.prepare(
				`UPDATE blog_posts
			SET tags = ?1
			WHERE id = ?2`
			)
			.bind(tagsString, id)
			.run();
	}

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
