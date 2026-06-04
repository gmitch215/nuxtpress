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
		const count = await userCount();
		let flagged = false;
		try {
			flagged = Boolean(await kv.get<string>(SETUP_COMPLETED_KV_KEY));
		} catch (kvError) {
			console.warn('setup flag read failed:', describeDbError(kvError));
		}
		// trust either D1 (authoritative) or the KV flag (covers D1 replica lag right after INSERT)
		const needsSetup = count === 0 && !flagged;
		return { needsSetup, hasLegacyPassword, userCount: count };
	} catch (error) {
		console.error('setup status failed:', describeDbError(error));
		throw createError({
			statusCode: 503,
			statusMessage: `Setup status unavailable: ${describeDbError(error)}`
		});
	}
});
