import { and, eq } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { ensureDatabase } from '~/server/utils/db';
import { listPostSummaries } from '~/server/utils/posts';
import type { PublicUser } from '~/shared/types';

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

	const authorPublic: PublicUser = {
		id: user.id,
		username: user.username,
		displayName: user.displayName,
		role: user.role,
		avatarPathname: user.avatarPathname ?? null,
		bio: user.bio ?? null
	};

	const mapped = (await listPostSummaries())
		.filter((post) => post.author_id === user.id)
		.map((post) => ({ ...post, author: authorPublic }));

	setHeader(event, 'Cache-Control', 'public, max-age=60');

	return {
		author: authorPublic,
		posts: mapped
	};
});
