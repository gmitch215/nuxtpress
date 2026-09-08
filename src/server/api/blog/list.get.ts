import { ensureDatabase } from '~/server/utils/db';
import { listPostSummaries } from '~/server/utils/posts';

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	setHeader(event, 'Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
	return listPostSummaries();
});
