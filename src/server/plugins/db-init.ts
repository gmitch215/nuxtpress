import { ensureDatabase } from '~/server/utils/db';

export default defineNitroPlugin(async (nitroApp) => {
	if (nitroApp.hooks) {
		nitroApp.hooks.hook('request', async () => {
			await ensureDatabase();
		});
	}
});
