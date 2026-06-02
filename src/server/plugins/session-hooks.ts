import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';

export default defineNitroPlugin(() => {
	sessionHooks.hook('fetch', async (session, event) => {
		if (!session?.user?.id) return;

		let fresh;
		try {
			await ensureDatabase();
			const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
			fresh = rows[0];
		} catch (e) {
			console.warn('session-hooks fetch lookup failed, leaving session intact', e);
			return;
		}

		if (!fresh) {
			await clearUserSession(event);
			return;
		}

		// only invalidate when isActive is explicitly false/0; tolerate drizzle adapter quirks
		const deactivated = fresh.isActive === false || fresh.isActive === 0 || fresh.isActive === null;
		if (deactivated) {
			await clearUserSession(event);
			return;
		}

		session.user = {
			id: fresh.id,
			username: fresh.username,
			displayName: fresh.displayName,
			role: fresh.role,
			avatarPathname: fresh.avatarPathname,
			bio: fresh.bio
		};

		const cfg = useRuntimeConfig();
		const legacy = cfg.password && cfg.password !== 'password';
		session.legacyPasswordActive = Boolean(legacy && fresh.username === 'admin');
	});
});
