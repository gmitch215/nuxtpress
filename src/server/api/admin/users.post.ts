import { eq, sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { users } from '~/server/db/schema';
import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';
import { RESERVED_USERNAMES, userCreateSchema } from '~/shared/schemas';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const body = await readBody(event);
	const parsed = userCreateSchema.safeParse(body);
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Invalid user data',
			data: parsed.error.issues
		});
	}

	const username = parsed.data.username;
	if (RESERVED_USERNAMES.has(username) && username !== 'admin') {
		throw createError({ statusCode: 400, statusMessage: 'Reserved username' });
	}

	const existing = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.username, username))
		.limit(1);
	if (existing[0]) {
		throw createError({ statusCode: 409, statusMessage: 'Username already taken' });
	}

	const id = crypto.randomUUID().replace(/-/g, '');
	const hash = await hashPassword(parsed.data.password);
	const bio = parsed.data.bio || null;
	const now = Date.now();
	await db.run(sql`
		INSERT INTO users (id, username, display_name, password_hash, role, bio, avatar_pathname, is_active, created_at, updated_at)
		VALUES (${id}, ${username}, ${parsed.data.displayName}, ${hash}, ${parsed.data.role}, ${bio}, ${null}, ${1}, ${now}, ${now})
	`);

	return { id };
});
