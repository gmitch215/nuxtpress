import { kv } from 'hub:kv';
import { requireAuthed } from '~/server/utils/auth';
import { DRAFT_PREFIX, draftAccess, publicDraft, readDraft } from '~/server/utils/drafts';
import { parseCached } from '~/server/utils/posts';
import { SLUG_RE } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);
	await ensureDatabase();

	const { slug } = getQuery(event);
	const canUse = draftAccess(me);

	if (!slug) {
		// list the drafts this user may open
		const keys = await kv.keys(DRAFT_PREFIX);
		const found = await Promise.all(
			keys.map(async (key) => parseCached<Parameters<typeof publicDraft>[0]>(await kv.get(key)))
		);
		const mine = [];
		for (const draft of found) {
			if (draft && (await canUse(draft))) mine.push(publicDraft(draft));
		}

		return { drafts: mine };
	} else {
		// return specific draft by slug
		if (typeof slug !== 'string' || slug.trim() === '') {
			throw createError({
				statusCode: 400,
				statusMessage: 'Invalid slug provided'
			});
		}

		const draft = SLUG_RE.test(slug) ? await readDraft(slug) : null;
		if (!draft || !(await canUse(draft))) {
			throw createError({
				statusCode: 404,
				statusMessage: 'Draft not found'
			});
		}

		return { draft: publicDraft(draft) };
	}
});
