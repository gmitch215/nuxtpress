import { ensureDatabase, userCount } from '~/server/utils/db';

export default defineEventHandler(async () => {
	await ensureDatabase();
	const cfg = useRuntimeConfig();
	const hasLegacyPassword = Boolean(cfg.password) && cfg.password !== 'password';
	const count = await userCount();
	return {
		needsSetup: count === 0,
		hasLegacyPassword,
		userCount: count
	};
});
