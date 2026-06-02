import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { adminCount, requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { userUpdateSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const id = getRouterParam(event, 'id');
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });

	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	const target = rows[0];
	if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' });

	const body = await readBody(event);
	const parsed = userUpdateSchema.safeParse(body);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid user data',
			data: parsed.error.issues
		});
	}

	const wouldDemoteOrDeactivateLastAdmin =
		target.role === 'administrator' &&
		((parsed.data.role && parsed.data.role !== 'administrator') || parsed.data.isActive === false);
	if (wouldDemoteOrDeactivateLastAdmin) {
		const count = await adminCount();
		if (count <= 1) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Cannot demote or deactivate the only administrator'
			});
		}
	}

	const updates: Record<string, unknown> = { updatedAt: new Date() };
	if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
	if (parsed.data.role !== undefined) updates.role = parsed.data.role;
	if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null;
	if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
	if (parsed.data.password) {
		const cfg = useRuntimeConfig();
		const legacy = cfg.password && cfg.password !== 'password';
		if (legacy && target.username === 'admin') {
			throw createError({
				statusCode: 400,
				statusMessage:
					'NUXT_PASSWORD is currently set — remove it from your environment before changing the admin account password'
			});
		}
		updates.passwordHash = await hashPassword(parsed.data.password);
	}

	await db.update(users).set(updates).where(eq(users.id, id));
	return { ok: true };
});
