import { ensureDatabase } from '~/server/utils/db';
import { type MailEnv } from '~/server/utils/mail';
import { drainOutbox } from '~/server/utils/subscribers';

export default defineTask({
	meta: { name: 'mail:drain', description: 'Send queued subscriber emails' },
	async run({ context }) {
		await ensureDatabase();
		const env = (context as { cloudflare?: { env?: MailEnv } }).cloudflare?.env;
		return { result: await drainOutbox(env) };
	}
});
