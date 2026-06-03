import { describeDbError, ensureDatabase, userCount } from '~/server/utils/db';

export default defineEventHandler(async () => {
	const cfg = useRuntimeConfig();
	const hasLegacyPassword = Boolean(cfg.password) && cfg.password !== 'password';
	try {
		await ensureDatabase();
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
