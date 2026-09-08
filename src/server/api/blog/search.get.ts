import { ensureDatabase } from '~/server/utils/db';
import { searchPostSummaries } from '~/server/utils/posts';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const q = String(getQuery(event).q || '').trim();
	if (q.length === 0 || q.length > 200) return [];

	setHeader(event, 'Cache-Control', 'public, max-age=30');
	return searchPostSummaries(q);
});
