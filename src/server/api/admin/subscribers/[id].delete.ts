import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { removeSubscriber } from '~/server/utils/subscribers';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const id = getRouterParam(event, 'id') ?? '';
	if (!(await removeSubscriber(id))) {
		throw createError({ statusCode: 404, statusMessage: 'Subscriber not found' });
	}
	return { ok: true };
});
