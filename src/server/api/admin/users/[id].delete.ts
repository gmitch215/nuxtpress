import { eq } from 'drizzle-orm';
import { blob } from 'hub:blob';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import { adminCount, firstAdminId, requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	const me = await requireAdmin(event);
	await ensureDatabase();

	const id = getRouterParam(event, 'id');
	if (!id) throw createError({ statusCode: 400, statusMessage: 'Missing id' });

	if (id === me.id) {
		throw createError({ statusCode: 400, statusMessage: 'Cannot delete yourself' });
	}

	const rows = await db.select().from(users).where(eq(users.id, id)).limit(1);
	const target = rows[0];
	if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' });

	const legacyPassword = useRuntimeConfig().password;
	const legacyActive = Boolean(legacyPassword) && legacyPassword !== 'password';
	if (legacyActive && target.username === 'admin') {
		throw createError({
			statusCode: 400,
			statusMessage:
				'Cannot delete the legacy admin while NUXT_PASSWORD is set — remove the env var and redeploy first'
		});
	}

	if (target.role === 'administrator' && (await adminCount()) <= 1) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Cannot delete the only administrator'
		});
	}

	const reassignTo = await firstAdminId();
	if (reassignTo) {
		await db
			.update(blogPosts)
			.set({ authorId: reassignTo, updatedAt: new Date() })
			.where(eq(blogPosts.authorId, id));
	} else {
		await db
			.update(blogPosts)
			.set({ authorId: null, updatedAt: new Date() })
			.where(eq(blogPosts.authorId, id));
	}

	if (target.avatarPathname) {
		try {
			await blob.del(target.avatarPathname);
		} catch (e) {
			console.warn('avatar delete failed', e);
		}
	}

	await db.delete(users).where(eq(users.id, id));

	for (const k of [
		'nuxtpress:blog_posts_list',
		'nuxtpress:blog_posts_list:v1',
		'nuxtpress:blog_posts_list:v2'
	]) {
		try {
			await kv.del(k);
		} catch {}
	}

	return { ok: true };
});
