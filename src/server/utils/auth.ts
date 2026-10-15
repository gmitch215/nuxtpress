import { asc, eq } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { db } from 'hub:db';
import { blogPosts, users } from '~/server/db/schema';

export type SessionUser = {
	id: string;
	username: string;
	displayName: string;
	role: 'administrator' | 'author';
	avatarPathname?: string | null;
	bio?: string | null;
};

export async function getCurrentUser(event: H3Event): Promise<SessionUser | null> {
	const session = await getUserSession(event);
	return (session.user as SessionUser | undefined) ?? null;
}

export async function requireAdmin(event: H3Event): Promise<SessionUser> {
	const user = await getCurrentUser(event);
	if (!user || user.role !== 'administrator') {
		throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
	}
	return user;
}

export async function requireAuthed(event: H3Event): Promise<SessionUser> {
	const user = await getCurrentUser(event);
	if (!user) {
		throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
	}
	return user;
}

export async function requireOwnerOrAdmin(
	event: H3Event,
	postId: string
): Promise<{ user: SessionUser; authorId: string | null }> {
	const user = await requireAuthed(event);
	const rows = await db
		.select({ authorId: blogPosts.authorId })
		.from(blogPosts)
		.where(eq(blogPosts.id, postId))
		.limit(1);
	const post = rows[0];
	if (!post) {
		throw createError({ statusCode: 404, statusMessage: 'Post not found' });
	}
	const isOwner = post.authorId && post.authorId === user.id;
	if (!isOwner && user.role !== 'administrator') {
		throw createError({ statusCode: 403, statusMessage: 'Forbidden' });
	}
	return { user, authorId: post.authorId };
}

export async function adminCount(): Promise<number> {
	const rows = await db.select({ id: users.id }).from(users).where(eq(users.role, 'administrator'));
	return rows.filter((u) => u.id).length;
}

/** The primary administrator: the earliest-created one, so the answer never depends on row order. */
export async function firstAdminId(): Promise<string | null> {
	const rows = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.role, 'administrator'))
		.orderBy(asc(users.createdAt), asc(users.id))
		.limit(1);
	return rows[0]?.id ?? null;
}

/** The session snapshot only refreshes on a client fetch, so anything destructive reads the row. */
export async function storedAvatarPathname(userId: string): Promise<string | null> {
	const rows = await db
		.select({ avatarPathname: users.avatarPathname })
		.from(users)
		.where(eq(users.id, userId))
		.limit(1);
	return rows[0]?.avatarPathname ?? null;
}
