import { and, desc, eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts, users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import type { BlogPost, PublicUser } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const usernameParam = getRouterParam(event, 'username');
	if (!usernameParam) {
		throw createError({ statusCode: 400, statusMessage: 'Username required' });
	}
	const username = usernameParam.toLowerCase();

	const rows = await db
		.select()
		.from(users)
		.where(and(eq(users.username, username), eq(users.isActive, true)))
		.limit(1);

	const user = rows[0];
	if (!user) {
		throw createError({ statusCode: 404, statusMessage: 'Author not found' });
	}

	const posts = await db
		.select()
		.from(blogPosts)
		.where(eq(blogPosts.authorId, user.id))
		.orderBy(desc(blogPosts.createdAt));

	const authorPublic: PublicUser = {
		id: user.id,
		username: user.username,
		displayName: user.displayName,
		role: user.role,
		avatarPathname: user.avatarPathname ?? null,
		bio: user.bio ?? null
	};

	const mapped = posts.map(
		(row) =>
			({
				...row,
				created_at: new Date(row.createdAt),
				updated_at: new Date(row.updatedAt),
				thumbnail: row.thumbnail
					? Uint8Array.from(atob(row.thumbnail), (c) => c.charCodeAt(0))
					: undefined,
				thumbnail_url: row.thumbnailUrl || undefined,
				tags: row.tags ? row.tags.split(',').map((t) => t.trim()) : [],
				author_id: row.authorId,
				author: authorPublic
			}) satisfies BlogPost
	) as BlogPost[];

	return {
		author: authorPublic,
		posts: mapped
	};
});
