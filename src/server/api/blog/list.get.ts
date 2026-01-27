import { desc } from 'drizzle-orm';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (_) => {
	await ensureDatabase();
	const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));

	return rows.map(
		(row) =>
			({
				...row,
				created_at: row.createdAt,
				updated_at: row.updatedAt,
				thumbnail_url: row.thumbnailUrl,
				tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : []
			}) satisfies BlogPost
	) as BlogPost[];
});
