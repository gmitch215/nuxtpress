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

	// Generate unique slug by checking for duplicates and appending -1, -2, etc.
	let finalSlug = post.slug;
	let counter = 1;
	let slugExists = true;

	while (slugExists) {
		// Check cache first
		const cached = await kv.get(`nuxtpress:slug_exists:${finalSlug}`);
		if (cached === null) {
			// Not in cache, check database
			const existing = await db
				.prepare(`SELECT id FROM blog_posts WHERE slug = ?1`)
				.bind(finalSlug)
				.first();

			if (!existing) {
				slugExists = false;
			} else {
				// Cache that this slug exists
				await kv.set(`nuxtpress:slug_exists:${finalSlug}`, '1', { ttl: 60 * 60 }); // 1 hour
				finalSlug = `${post.slug}-${counter}`;
				counter++;
			}
		} else {
			// Slug exists in cache
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

	// Cache the new slug
	await kv.set(`nuxtpress:slug_exists:${finalSlug}`, '1', { ttl: 60 * 60 });

	// add optional fields
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
