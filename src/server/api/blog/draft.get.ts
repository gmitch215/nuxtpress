import { kv } from 'hub:kv';
import { BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const { slug } = getQuery(event);

	if (!slug) {
		// return list of all drafts
		const keys = await kv.keys('nuxtpress:blog_draft:');
		const drafts = [];
		for (const key of keys) {
			const draft = await kv.get<Partial<BlogPostData>>(key);
			if (draft) {
				drafts.push(draft);
			}
		}

		return { drafts };
	} else {
		// return specific draft by slug
		if (typeof slug !== 'string' || slug.trim() === '') {
			throw createError({
				statusCode: 400,
				statusMessage: 'Invalid slug provided'
			});
		}

		const draft = await kv.get<Partial<BlogPostData>>(`nuxtpress:blog_draft:${slug}`);
		if (!draft) {
			throw createError({
				statusCode: 404,
				statusMessage: 'Draft not found'
			});
		}

		return { draft };
	}
});
