import { sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { ensureDatabase, userCount } from '~/server/utils/db';
import { RESERVED_USERNAMES, userCreateSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const count = await userCount();
	if (count > 0) {
		throw createError({ statusCode: 409, statusMessage: 'Setup has already been completed' });
	}

	const body = await readBody(event);
	const parsed = userCreateSchema.safeParse({ ...body, role: 'administrator' });
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid setup data',
			data: parsed.error.issues
		});
	}

	const username = parsed.data.username;
	if (RESERVED_USERNAMES.has(username) && username !== 'admin') {
		throw createError({ statusCode: 400, statusMessage: 'Reserved username' });
	}

	const id = crypto.randomUUID().replace(/-/g, '');
	const hash = await hashPassword(parsed.data.password);
	const bio = parsed.data.bio || null;
	const now = Date.now();
	await db.run(sql`
		INSERT INTO users (id, username, display_name, password_hash, role, bio, avatar_pathname, is_active, created_at, updated_at)
		VALUES (${id}, ${username}, ${parsed.data.displayName}, ${hash}, ${'administrator'}, ${bio}, ${null}, ${1}, ${now}, ${now})
	`);

	try {
		await setUserSession(event, {
			user: {
				id,
				username,
				displayName: parsed.data.displayName,
				role: 'administrator',
				avatarPathname: null,
				bio
			},
			loggedInAt: now
		});
	} catch (error) {
		console.warn('setup auto-login skipped:', error);
	}

	return { ok: true, id };
});
