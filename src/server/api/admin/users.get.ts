import { desc, sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts, users } from '~/server/db/schema';
import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import type { AdminUser } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const rows = await db
		.select({
			id: users.id,
			username: users.username,
			displayName: users.displayName,
			role: users.role,
			bio: users.bio,
			avatarPathname: users.avatarPathname,
			isActive: users.isActive,
			createdAt: users.createdAt,
			updatedAt: users.updatedAt,
			postCount: sql<number>`(SELECT COUNT(*) FROM ${blogPosts} WHERE ${blogPosts.authorId} = ${users.id})`
		})
		.from(users)
		.orderBy(desc(users.createdAt));

	return rows.map(
		(r) =>
			({
				id: r.id,
				username: r.username,
				displayName: r.displayName,
				role: r.role,
				bio: r.bio,
				avatarPathname: r.avatarPathname,
				isActive: r.isActive,
				createdAt: new Date(r.createdAt).toISOString(),
				updatedAt: new Date(r.updatedAt).toISOString(),
				postCount: Number(r.postCount ?? 0)
			}) satisfies AdminUser
	);
});
