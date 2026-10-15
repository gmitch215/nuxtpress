import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { listSubscribers } from '~/server/utils/subscribers';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const query = getQuery(event);
	const status = query.status === 'active' || query.status === 'pending' ? query.status : undefined;
	const limit = Math.min(Math.max(Number(query.limit) || 50, 1), 200);
	const offset = Math.max(Number(query.offset) || 0, 0);
	const search = typeof query.search === 'string' ? query.search.trim().slice(0, 100) : '';

	return listSubscribers({ search: search || undefined, status, limit, offset });
});
