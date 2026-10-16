import { kv } from 'hub:kv';
import * as z from 'zod';
import { requireAdmin } from '~/server/utils/auth';
import { cloudflareEnv, MailError, sendMail } from '~/server/utils/mail';
import { renderTestEmail } from '~/server/utils/mail-templates';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const parsed = z.object({ to: z.email().max(255) }).safeParse(await readBody(event));
	if (!parsed.success) {
		throw createError({ statusCode: 400, statusMessage: 'Enter a valid email address' });
	}

	const siteName = (await kv.get<string>('nuxtpress:setting:name')) || runtimeConfig().public.name;
	try {
		await sendMail(cloudflareEnv(event), {
			to: parsed.data.to,
			...renderTestEmail(siteName)
		});
	} catch (error) {
		if (error instanceof MailError) {
			throw createError({ statusCode: 502, statusMessage: error.message });
		}
		throw error;
	}
	return { ok: true };
});
