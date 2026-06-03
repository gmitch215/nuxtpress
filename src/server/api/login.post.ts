import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { describeDbError, ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const body = await readBody<{ username?: string; password?: string }>(event);
	const password = body?.password ?? '';
	const username = (body?.username ?? 'admin').trim().toLowerCase();

	if (!password) {
		throw createError({ statusCode: 400, statusMessage: 'Password is required' });
	}
	if (!username) {
		throw createError({ statusCode: 400, statusMessage: 'Username is required' });
	}

	const rows = await db.select().from(users).where(eq(users.username, username)).limit(1);
	const user = rows[0];

	let authed = false;

	if (user && user.isActive) {
		authed = await verifyPassword(user.passwordHash, password);
	}

	// legacy fallback: NUXT_PASSWORD env can still log in as `admin` for one release
	if (!authed && username === 'admin' && user) {
		const legacy = useRuntimeConfig().password;
		if (legacy && legacy !== 'password' && password === legacy) {
			authed = true;
		}
	}

	if (!authed) {
		throw createError({ statusCode: 401, statusMessage: 'Invalid credentials' });
	}

	try {
		await setUserSession(event, {
			user: {
				id: user!.id,
				username: user!.username,
				displayName: user!.displayName,
				role: user!.role,
				avatarPathname: user!.avatarPathname,
				bio: user!.bio
			},
			loggedInAt: Date.now()
		});
	} catch (error) {
		// usually means NUXT_SESSION_PASSWORD is missing/short — surface it instead of returning a fake ok
		console.error('login session set failed:', describeDbError(error));
		throw createError({
			statusCode: 500,
			statusMessage: 'Login session could not be created. Check the server session configuration.'
		});
	}

	return { ok: true };
});
