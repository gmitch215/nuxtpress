import { eq } from 'drizzle-orm';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { requireOwnerOrAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const { id } = getQuery(event);
	if (!id || typeof id !== 'string') {
		throw createError({ statusCode: 400, statusMessage: 'No ID provided' });
	}

	await requireOwnerOrAdmin(event, id);

	const posts = await db
		.select({ slug: blogPosts.slug, createdAt: blogPosts.createdAt })
		.from(blogPosts)
		.where(eq(blogPosts.id, id))
		.limit(1);

	const post = posts[0];

	await db.delete(blogPosts).where(eq(blogPosts.id, id));

	await kv.del('nuxtpress:blog_posts_list');
	await kv.del('nuxtpress:blog_posts_list:v1');
	await kv.del('nuxtpress:blog_posts_list:v2');

	if (post?.slug) {
		await kv.del(`nuxtpress:slug_exists:${post.slug}`);
		const postDate = new Date(post.createdAt);
		const y = postDate.getUTCFullYear();
		const m = postDate.getUTCMonth() + 1;
		const d = postDate.getUTCDate();
		for (const v of ['', 'v2:', 'v3:']) {
			await kv.del(`nuxtpress:blog_post:${v}${post.slug}:${y}:${m}:${d}`);
		}
	}
});
