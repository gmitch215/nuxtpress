import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { cloudflareEnv, describeMail } from '~/server/utils/mail';
import { outboxCounts, subscriberCounts } from '~/server/utils/subscribers';
import type { MailSettings } from '~/shared/types';

export default defineEventHandler(async (event): Promise<MailSettings> => {
	await requireAdmin(event);
	await ensureDatabase();

	return {
		...(await describeMail(cloudflareEnv(event))),
		subscribers: await subscriberCounts(),
		outbox: await outboxCounts()
	};
});
