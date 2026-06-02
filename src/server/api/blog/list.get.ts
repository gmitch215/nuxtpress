import { desc, eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { BlogPost, PublicUser } from '~/shared/types';

export default defineEventHandler(async (_) => {
	await ensureDatabase();
	const cacheKey = 'nuxtpress:blog_posts_list:v2';

	const cached = await kv.get(cacheKey);
	if (cached && typeof cached === 'string') {
		try {
			return JSON.parse(cached) as BlogPost[];
		} catch {
			await kv.del(cacheKey);
		}
	}

	const rows = await db
		.select({
			id: blogPosts.id,
			title: blogPosts.title,
			slug: blogPosts.slug,
			content: blogPosts.content,
			thumbnail: blogPosts.thumbnail,
			thumbnailUrl: blogPosts.thumbnailUrl,
			authorId: blogPosts.authorId,
			createdAt: blogPosts.createdAt,
			updatedAt: blogPosts.updatedAt,
			tags: blogPosts.tags,
			authorUsername: users.username,
			authorDisplayName: users.displayName,
			authorRole: users.role,
			authorAvatar: users.avatarPathname
		})
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(desc(blogPosts.createdAt));

	const posts = rows.map((row) => {
		const author: PublicUser | null = row.authorId
			? {
					id: row.authorId,
					username: row.authorUsername ?? 'unknown',
					displayName: row.authorDisplayName ?? 'Unknown',
					role: (row.authorRole as PublicUser['role']) ?? 'author',
					avatarPathname: row.authorAvatar ?? null
				}
			: null;

		return {
			id: row.id,
			title: row.title,
			slug: row.slug,
			content: row.content,
			thumbnail: row.thumbnail
				? Uint8Array.from(atob(row.thumbnail), (c) => c.charCodeAt(0))
				: undefined,
			thumbnail_url: row.thumbnailUrl || undefined,
			created_at: new Date(row.createdAt),
			updated_at: new Date(row.updatedAt),
			tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
			author_id: row.authorId ?? null,
			author
		} satisfies BlogPost;
	}) as BlogPost[];

	await kv.set(cacheKey, JSON.stringify(posts), { ttl: 60 * 3 });

	return posts;
});
