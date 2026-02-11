import { kv } from 'hub:kv';
import { blogPostCreateSchema } from '~/shared/schemas';
import { BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const { post } = await readBody<{
		post: Partial<BlogPostData> & { slug: string };
	}>(event);

	if (!post) {
		throw createError({
			statusCode: 400,
			statusMessage: 'No post object provided'
		});
	}

	if (!post.slug || typeof post.slug !== 'string' || post.slug.trim() === '') {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid slug provided'
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

	await kv.set(`nuxtpress:blog_draft:${post.slug}`, JSON.stringify(post), {
		ttl: 60 * 60 * 24 * 7
	}); // 7 days TTL

	return { success: true };
});
