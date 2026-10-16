import { requireAdmin } from '~/server/utils/auth';
import { readSink } from '~/server/utils/mail';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	if (!runtimeConfig().mail.sink) {
		throw createError({ statusCode: 404, statusMessage: 'Not Found' });
	}
	return readSink();
});
