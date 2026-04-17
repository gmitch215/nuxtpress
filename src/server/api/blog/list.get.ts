import { desc } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (_) => {
	await ensureDatabase();
	const cacheKey = 'nuxtpress:blog_posts_list:v1';

	const cached = await kv.get(cacheKey);
	if (cached && typeof cached === 'string') {
		try {
			return JSON.parse(cached) as BlogPost[];
		} catch {
			await kv.del(cacheKey);
		}
	}

	const rows = await db.select().from(blogPosts).orderBy(desc(blogPosts.createdAt));
	const posts = rows.map(
		(row) =>
			({
				...row,
				created_at: new Date(row.createdAt),
				updated_at: new Date(row.updatedAt),
				thumbnail: row.thumbnail
					? Uint8Array.from(atob(row.thumbnail), (c) => c.charCodeAt(0))
					: undefined,
				thumbnail_url: row.thumbnailUrl || undefined,
				tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : []
			}) satisfies BlogPost
	) as BlogPost[];

	await kv.set(cacheKey, JSON.stringify(posts), { ttl: 60 * 3 }); // 3 minutes

	return posts;
});
