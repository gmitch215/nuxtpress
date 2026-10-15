import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { cloudflareEnv, describeMail, saveMailSettings } from '~/server/utils/mail';
import { rememberOrigin } from '~/server/utils/subscribers';
import { firstZodIssueMessage, mailSettingsSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const parsed = mailSettingsSchema.safeParse(await readBody(event));
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: firstZodIssueMessage(parsed.error.issues, 'Invalid mail settings'),
			data: parsed.error.issues
		});
	}

	await saveMailSettings(parsed.data);
	await rememberOrigin(event);
	return describeMail(cloudflareEnv(event));
});
