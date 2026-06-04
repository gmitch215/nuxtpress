import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { requireAuthed } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { profileUpdateSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);
	await ensureDatabase();

	const body = await readBody(event);
	const parsed = profileUpdateSchema.safeParse(body);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid profile data',
			data: parsed.error.issues
		});
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
	if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null;

	if (parsed.data.newPassword) {
		if (!parsed.data.currentPassword) {
			throw createError({ statusCode: 400, statusMessage: 'Current password is required' });
		}
		const rows = await db.select().from(users).where(eq(users.id, me.id)).limit(1);
		const current = rows[0];
		if (!current) throw createError({ statusCode: 404, statusMessage: 'User not found' });
		const ok = await verifyPassword(current.passwordHash, parsed.data.currentPassword);
		if (!ok) {
			throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' });
		}
		updates.passwordHash = await hashPassword(parsed.data.newPassword);
	}

	await db.update(users).set(updates).where(eq(users.id, me.id));
	return { ok: true };
});
