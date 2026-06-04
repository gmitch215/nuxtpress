import { and, eq, ne } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { adminCount, requireAdmin } from '~/server/utils/auth';
import { describeDbError, ensureDatabase } from '~/server/utils/db';
import { firstZodIssueMessage, RESERVED_USERNAMES, userUpdateSchema } from '~/shared/schemas';

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
			statusMessage: firstZodIssueMessage(parsed.error.issues, 'Invalid user data'),
			data: { issues: parsed.error.issues }
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
	if (parsed.data.username !== undefined && parsed.data.username !== target.username) {
		const next = parsed.data.username;
		if (RESERVED_USERNAMES.has(next) && next !== 'admin') {
			throw createError({
				statusCode: 400,
				statusMessage: `"${next}" is reserved — pick a different username`
			});
		}
		const taken = await db
			.select({ id: users.id })
			.from(users)
			.where(and(eq(users.username, next), ne(users.id, id)))
			.limit(1);
		if (taken[0]) {
			throw createError({ statusCode: 409, statusMessage: 'Username already taken' });
		}
		updates.username = next;
	}
	if (parsed.data.displayName !== undefined) updates.displayName = parsed.data.displayName;
	if (parsed.data.role !== undefined) updates.role = parsed.data.role;
	if (parsed.data.bio !== undefined) updates.bio = parsed.data.bio || null;
	if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;
	if (parsed.data.password) {
		updates.passwordHash = await hashPassword(parsed.data.password);
	}

	try {
		await db.update(users).set(updates).where(eq(users.id, id));
	} catch (error: any) {
		const reason = describeDbError(error);
		console.error('user UPDATE failed:', reason, error);
		if (/UNIQUE.*username/i.test(reason)) {
			throw createError({ statusCode: 409, statusMessage: 'Username already taken' });
		}
		throw createError({ statusCode: 500, statusMessage: `User update failed: ${reason}` });
	}
	return { ok: true };
});
