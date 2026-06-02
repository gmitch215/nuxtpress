import { eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';

export default defineNitroPlugin(() => {
	sessionHooks.hook('fetch', async (session, event) => {
		if (!session?.user?.id) return;
		try {
			await ensureDatabase();
		} catch {
			return;
		}
		const rows = await db.select().from(users).where(eq(users.id, session.user.id)).limit(1);
		const fresh = rows[0];
		if (!fresh || !fresh.isActive) {
			await clearUserSession(event);
			return;
		}
		// keep session in lockstep with profile edits
		session.user = {
			id: fresh.id,
			username: fresh.username,
			displayName: fresh.displayName,
			role: fresh.role,
			avatarPathname: fresh.avatarPathname,
			bio: fresh.bio
		};

		// surface legacy NUXT_PASSWORD lockout for the seeded admin
		const cfg = useRuntimeConfig();
		const legacy = cfg.password && cfg.password !== 'password';
		session.legacyPasswordActive = Boolean(legacy && fresh.username === 'admin');
	});
});
