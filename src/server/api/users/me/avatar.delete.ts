import { eq } from 'drizzle-orm';
import { blob } from 'hub:blob';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { requireAuthed, storedAvatarPathname } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { invalidateAuthor } from '~/server/utils/posts';

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);
	await ensureDatabase();

	const current = await storedAvatarPathname(me.id);
	if (!current) return { ok: true };
	try {
		await blob.del(current);
	} catch (e) {
		console.warn('blob delete failed', e);
	}
	await db
		.update(users)
		.set({ avatarPathname: null, updatedAt: new Date() })
		.where(eq(users.id, me.id));
	await invalidateAuthor(me.id);

	return { ok: true };
});
