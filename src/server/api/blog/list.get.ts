import { checkTable } from '~/server/utils';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (_) => {
	const db = hubDatabase();
	checkTable(db);

	const rows = await db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
	return rows.results.map(
		(row: any) =>
			({
				...row,
				created_at: new Date(row.created_at as string),
				updated_at: new Date(row.updated_at as string),
				tags: row.tags ? (row.tags as string).split(',').map((t) => t.trim()) : []
			}) satisfies BlogPost
	) as BlogPost[];
});
