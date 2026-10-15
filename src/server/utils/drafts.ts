import { kv } from 'hub:kv';
import type { BlogPostData } from '~/shared/types';
import { firstAdminId, type SessionUser } from './auth';
import { parseCached } from './posts';

export const DRAFT_PREFIX = 'nuxtpress:blog_draft:';
export const DRAFT_TTL = 60 * 60 * 24 * 7;

export type StoredDraft = Partial<BlogPostData> & { authorId?: string };

export const draftKey = (slug: string) => `${DRAFT_PREFIX}${slug}`;

export async function readDraft(slug: string): Promise<StoredDraft | null> {
	return parseCached<StoredDraft>(await kv.get(draftKey(slug)));
}

/**
 * A draft belongs to the author who saved it. Drafts from before owners were recorded have no
 * author, and the primary administrator takes those over.
 */
export function draftAccess(user: SessionUser) {
	let primary: Promise<string | null> | undefined;
	return async (draft: StoredDraft): Promise<boolean> => {
		if (draft.authorId) return draft.authorId === user.id;
		primary ??= firstAdminId();
		return (await primary) === user.id;
	};
}

export function publicDraft({ authorId: _owner, ...draft }: StoredDraft): Partial<BlogPostData> {
	return draft;
}
