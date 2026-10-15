import { ensureDatabase } from '~/server/utils/db';
import { checkLink, confirmSubscriber } from '~/server/utils/subscribers';
import { subscriberLinkSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const parsed = subscriberLinkSchema.safeParse(await readBody(event));
	if (!parsed.success || !(await checkLink('confirm', parsed.data.id, parsed.data.token))) {
		throw createError({ statusCode: 400, statusMessage: 'This link is invalid or has expired' });
	}

	if (!(await confirmSubscriber(parsed.data.id))) {
		throw createError({ statusCode: 404, statusMessage: 'This subscription no longer exists' });
	}

	return { ok: true };
});
