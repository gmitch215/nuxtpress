import { db } from 'hub:db';
import { users } from '~/server/db/schema';
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
	await db.insert(users).values({
		id,
		username,
		displayName: parsed.data.displayName,
		passwordHash: hash,
		role: 'administrator',
		bio: parsed.data.bio || null,
		isActive: true
	});

	await setUserSession(event, {
		user: {
			id,
			username,
			displayName: parsed.data.displayName,
			role: 'administrator',
			avatarPathname: null,
			bio: parsed.data.bio || null
		},
		loggedInAt: Date.now()
	});

	return { ok: true, id };
});
