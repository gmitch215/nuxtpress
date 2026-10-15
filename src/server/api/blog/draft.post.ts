import { kv } from 'hub:kv';
import { requireAuthed } from '~/server/utils/auth';
import { DRAFT_TTL, draftAccess, draftKey, readDraft } from '~/server/utils/drafts';
import { blogPostCreateSchema } from '~/shared/schemas';
import type { BlogPostData } from '~/shared/types';

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);
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

	// the key stays one namespace, so overwriting is gated on who saved the draft last
	const existing = await readDraft(post.slug);
	if (existing && !(await draftAccess(me)(existing))) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Another author already has a draft with this slug'
		});
	}

	// the owner always comes from the session, never from the body
	await kv.set(draftKey(post.slug), JSON.stringify({ ...post, authorId: me.id }), {
		ttl: DRAFT_TTL
	});

	return { success: true };
});
