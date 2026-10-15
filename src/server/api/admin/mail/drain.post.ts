import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { cloudflareEnv } from '~/server/utils/mail';
import { drainOutbox } from '~/server/utils/subscribers';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();
	return drainOutbox(cloudflareEnv(event));
});
