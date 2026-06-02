import { eq } from 'drizzle-orm';
import { blob, ensureBlob } from 'hub:blob';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { requireAuthed } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);
	await ensureDatabase();

	const form = await readFormData(event);
	const file = form.get('file');
	if (!(file instanceof Blob)) {
		throw createError({ statusCode: 400, statusMessage: 'No file provided' });
	}

	ensureBlob(file, {
		maxSize: '2MB',
		types: ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
	});

	const uploaded = await blob.put((file as any).name ?? 'avatar', file, {
		prefix: `avatars/${me.id}`,
		addRandomSuffix: true
	});

	const previous = me.avatarPathname;
	await db
		.update(users)
		.set({ avatarPathname: uploaded.pathname, updatedAt: new Date() })
		.where(eq(users.id, me.id));

	if (previous && previous !== uploaded.pathname) {
		try {
			await blob.del(previous);
		} catch (e) {
			console.warn('failed to delete previous avatar', e);
		}
	}

	return { pathname: uploaded.pathname };
});
