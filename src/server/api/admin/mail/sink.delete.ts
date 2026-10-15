import { requireAdmin } from '~/server/utils/auth';
import { clearSink } from '~/server/utils/mail';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	if (!useRuntimeConfig().mail.sink) {
		throw createError({ statusCode: 404, statusMessage: 'Not Found' });
	}
	await clearSink();
	return { ok: true };
});
