import { eq } from 'drizzle-orm';
import { blogPosts } from '~/server/db/schema';
import { requireOwnerOrAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { invalidatePost, invalidatePostCaches } from '~/server/utils/posts';

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

	await invalidatePostCaches();

	if (post?.slug) {
		await invalidatePost(post.slug, post.createdAt);
	}
});
