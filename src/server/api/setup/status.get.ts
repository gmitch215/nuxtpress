import { kv } from 'hub:kv';
import {
	describeDbError,
	ensureDatabase,
	SETUP_COMPLETED_KV_KEY,
	userCount
} from '~/server/utils/db';

export default defineEventHandler(async () => {
	const cfg = useRuntimeConfig();
	const hasLegacyPassword = Boolean(cfg.password) && cfg.password !== 'password';
	try {
		await ensureDatabase();
		// NUXT_PASSWORD seeds an admin user, so it implicitly completes setup
		if (hasLegacyPassword) {
			return { needsSetup: false, hasLegacyPassword, userCount: -1 };
		}
		// KV flag short-circuits D1's eventual consistency window after the first user is created
		let flagged = false;
		try {
			flagged = Boolean(await kv.get<string>(SETUP_COMPLETED_KV_KEY));
		} catch (kvError) {
			console.warn('setup flag read failed:', describeDbError(kvError));
		}
		if (flagged) {
			return { needsSetup: false, hasLegacyPassword, userCount: -1 };
		}
		const count = await userCount();
		return {
			needsSetup: count === 0,
			hasLegacyPassword,
			userCount: count
		};
	} catch (error) {
		console.error('setup status failed:', describeDbError(error));
		throw createError({
			statusCode: 503,
			statusMessage: `Setup status unavailable: ${describeDbError(error)}`
		});
	}
});
