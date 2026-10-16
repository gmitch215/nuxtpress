import { and, asc, desc, eq, gt, inArray, like, lt, sql } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, mailOutbox, subscribers } from '~/server/db/schema';
import { postPath, type SubscriberRow } from '~/shared/types';
import { mailActive, sendMail, type MailEnv } from './mail';
import { renderConfirmEmail, renderPostEmail } from './mail-templates';
import { excerptOf, getUrlStyle, publicThumbnailUrl } from './posts';
import { sessionSecret, signToken, verifyToken } from './secrets';

const POST_EMAIL_LABELS = {
	article: 'Read the Post',
	slideshow: 'View the Slideshow',
	video: 'Watch the Video',
	music: 'Listen Now'
} as const;

const ORIGIN_KV_KEY = 'nuxtpress:setting:site_origin';
const MAX_ATTEMPTS = 3;
const STALE_CLAIM_MS = 10 * 60 * 1000;
const SENT_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
const CONFIRM_COOLDOWN_MS = 10 * 60 * 1000;

/** Worker subrequests are capped per invocation, so one drain sends a bounded batch. */
export const DRAIN_BATCH = 25;

export type DrainResult = { sent: number; retried: number; failed: number; remaining: number };

export async function siteOrigin(): Promise<string> {
	const configured = runtimeConfig().public.site_url;
	if (configured) return configured.replace(/\/+$/, '');
	return ((await kv.get<string>(ORIGIN_KV_KEY)) || '').replace(/\/+$/, '');
}

/**
 * Scheduled sends have no request, so an administrator's origin is kept for them. Only call this
 * from an admin route: a client-controlled Host header would otherwise rewrite every email link.
 */
export async function rememberOrigin(event: H3Event): Promise<void> {
	const origin = getRequestURL(event).origin;
	if (!runtimeConfig().public.site_url && (await kv.get<string>(ORIGIN_KV_KEY)) !== origin) {
		await kv.set(ORIGIN_KV_KEY, origin);
	}
}

async function siteName(): Promise<string> {
	return (
		(await kv.get<string>('nuxtpress:setting:name')) || runtimeConfig().public.name || 'NuxtPress'
	);
}

export async function confirmUrl(origin: string, id: string): Promise<string> {
	const token = await signToken('confirm', id, sessionSecret());
	return `${origin}/subscribe/confirm?id=${id}&token=${token}`;
}

export async function unsubscribeUrls(
	origin: string,
	id: string
): Promise<{ page: string; oneClick: string }> {
	const token = await signToken('unsubscribe', id, sessionSecret());
	return {
		page: `${origin}/unsubscribe?id=${id}&token=${token}`,
		oneClick: `${origin}/api/subscribers/unsubscribe?id=${id}&token=${token}`
	};
}

export async function checkLink(
	purpose: 'confirm' | 'unsubscribe',
	id: string,
	token: string
): Promise<boolean> {
	return verifyToken(purpose, id, token, sessionSecret());
}

// #region subscribers

export type SubscribeOutcome = 'confirmation-sent' | 'already-active' | 'cooldown';

export async function subscribe(
	env: MailEnv,
	email: string,
	origin: string
): Promise<SubscribeOutcome> {
	const address = email.trim().toLowerCase();
	const now = new Date();
	const existing = (
		await db.select().from(subscribers).where(eq(subscribers.email, address)).limit(1)
	)[0];

	if (existing?.status === 'active') return 'already-active';
	if (
		existing?.confirmationSentAt &&
		now.getTime() - existing.confirmationSentAt.getTime() < CONFIRM_COOLDOWN_MS
	) {
		return 'cooldown';
	}

	const id = existing?.id ?? crypto.randomUUID().replace(/-/g, '');
	// build the message before touching the table, so a missing secret leaves nothing behind
	const message = renderConfirmEmail({
		siteName: await siteName(),
		confirmUrl: await confirmUrl(origin, id)
	});

	if (!existing) {
		await db.insert(subscribers).values({ id, email: address, createdAt: now });
	}
	try {
		await sendMail(env, { to: address, ...message });
	} catch (error) {
		// a new address that never got its email is not a pending subscriber
		if (!existing) await db.delete(subscribers).where(eq(subscribers.id, id));
		throw error;
	}
	await db.update(subscribers).set({ confirmationSentAt: now }).where(eq(subscribers.id, id));
	return 'confirmation-sent';
}

export async function confirmSubscriber(id: string): Promise<boolean> {
	const rows = await db
		.update(subscribers)
		.set({ status: 'active', confirmedAt: new Date() })
		.where(and(eq(subscribers.id, id), eq(subscribers.status, 'pending')))
		.returning({ id: subscribers.id });
	if (rows.length > 0) return true;
	const active = await db
		.select({ id: subscribers.id })
		.from(subscribers)
		.where(and(eq(subscribers.id, id), eq(subscribers.status, 'active')))
		.limit(1);
	return active.length > 0;
}

export async function removeSubscriber(id: string): Promise<boolean> {
	await db.delete(mailOutbox).where(eq(mailOutbox.subscriberId, id));
	const rows = await db
		.delete(subscribers)
		.where(eq(subscribers.id, id))
		.returning({ id: subscribers.id });
	return rows.length > 0;
}

function toRow(row: typeof subscribers.$inferSelect): SubscriberRow {
	return {
		id: row.id,
		email: row.email,
		status: row.status,
		createdAt: row.createdAt.toISOString(),
		confirmedAt: row.confirmedAt?.toISOString() ?? null
	};
}

export async function listSubscribers(options: {
	search?: string;
	status?: 'pending' | 'active';
	limit?: number;
	offset?: number;
}): Promise<{ rows: SubscriberRow[]; total: number }> {
	const filters = [];
	if (options.status) filters.push(eq(subscribers.status, options.status));
	if (options.search) {
		const term = `%${options.search.toLowerCase().replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
		filters.push(like(subscribers.email, term));
	}
	const where = filters.length > 0 ? and(...filters) : undefined;

	const rows = await db
		.select()
		.from(subscribers)
		.where(where)
		.orderBy(desc(subscribers.createdAt))
		.limit(options.limit ?? 50)
		.offset(options.offset ?? 0);
	const total = await db
		.select({ n: sql<number>`count(*)` })
		.from(subscribers)
		.where(where);

	return { rows: rows.map(toRow), total: Number(total[0]?.n ?? 0) };
}

/** Walks the table by primary key, so memory and the rows each query reads stay bounded at any size. */
export async function* exportSubscriberPages(): AsyncGenerator<SubscriberRow[]> {
	const size = Math.max(1, Number(runtimeConfig().mail.exportPageSize) || 1000);
	let after = '';
	for (;;) {
		const rows = await db
			.select()
			.from(subscribers)
			.where(gt(subscribers.id, after))
			.orderBy(asc(subscribers.id))
			.limit(size);
		if (rows.length > 0) yield rows.map(toRow);
		if (rows.length < size) return;
		after = rows[rows.length - 1]!.id;
	}
}

export async function subscriberCounts(): Promise<{ active: number; pending: number }> {
	const rows = await db
		.select({ status: subscribers.status, n: sql<number>`count(*)` })
		.from(subscribers)
		.groupBy(subscribers.status);
	const count = (status: string) => Number(rows.find((r) => r.status === status)?.n ?? 0);
	return { active: count('active'), pending: count('pending') };
}

/** Counts only the open statuses, so the scan is bounded by the queue and not by sent history. */
export async function outboxCounts(): Promise<{ pending: number; failed: number }> {
	const rows = await db
		.select({ status: mailOutbox.status, n: sql<number>`count(*)` })
		.from(mailOutbox)
		.where(inArray(mailOutbox.status, ['pending', 'sending', 'failed']))
		.groupBy(mailOutbox.status);
	const count = (...statuses: string[]) =>
		rows.filter((r) => statuses.includes(r.status)).reduce((sum, r) => sum + Number(r.n), 0);
	return { pending: count('pending', 'sending'), failed: count('failed') };
}

// #endregion

// #region outbox

/** Queues one row per active subscriber; the unique index makes a repeat call a no-op. */
export async function enqueuePost(postId: string): Promise<void> {
	const now = Date.now();
	await db.run(sql`
		INSERT INTO mail_outbox (id, subscriber_id, post_id, status, attempts, created_at, updated_at)
		SELECT lower(hex(randomblob(16))), id, ${postId}, 'pending', 0, ${now}, ${now}
		FROM subscribers WHERE status = 'active'
		ON CONFLICT (subscriber_id, post_id) DO NOTHING
	`);
}

async function loadPost(postId: string) {
	const rows = await db
		.select({
			id: blogPosts.id,
			title: blogPosts.title,
			slug: blogPosts.slug,
			type: blogPosts.type,
			firstMediaKey: sql<string | null>`json_extract(${blogPosts.media}, '$[0].key')`,
			content: blogPosts.content,
			thumbnailUrl: blogPosts.thumbnailUrl,
			hasThumbnail: sql<number>`CASE WHEN ${blogPosts.thumbnail} IS NULL THEN 0 ELSE 1 END`,
			createdAt: blogPosts.createdAt
		})
		.from(blogPosts)
		.where(eq(blogPosts.id, postId))
		.limit(1);
	return rows[0];
}

type LoadedPost = NonNullable<Awaited<ReturnType<typeof loadPost>>>;

/** Data URLs are blocked by mail clients, so only addressable images reach the email. */
export function emailThumbnail(post: LoadedPost, origin: string): string | undefined {
	const url = publicThumbnailUrl({ ...post, hasThumbnail: post.hasThumbnail === 1 });
	if (url?.startsWith('http://') || url?.startsWith('https://')) return url;
	if (url?.startsWith('/')) return `${origin}${url}`;
	return undefined;
}

export async function drainOutbox(env: MailEnv, limit = DRAIN_BATCH): Promise<DrainResult> {
	const result: DrainResult = { sent: 0, retried: 0, failed: 0, remaining: 0 };

	// the cron fires every five minutes, so the empty case has to cost one indexed row at most
	const open = await db
		.select({ id: mailOutbox.id })
		.from(mailOutbox)
		.where(inArray(mailOutbox.status, ['pending', 'sending']))
		.limit(1);
	if (open.length === 0) return result;

	if (!(await mailActive(env))) {
		result.remaining = (await outboxCounts()).pending;
		return result;
	}

	const now = Date.now();
	await db
		.update(mailOutbox)
		.set({ status: 'pending' })
		.where(
			and(
				eq(mailOutbox.status, 'sending'),
				lt(mailOutbox.updatedAt, new Date(now - STALE_CLAIM_MS))
			)
		);
	await db
		.delete(mailOutbox)
		.where(
			and(
				eq(mailOutbox.status, 'sent'),
				lt(mailOutbox.updatedAt, new Date(now - SENT_RETENTION_MS))
			)
		);

	const next = db
		.select({ id: mailOutbox.id })
		.from(mailOutbox)
		.where(eq(mailOutbox.status, 'pending'))
		.orderBy(asc(mailOutbox.updatedAt))
		.limit(limit);
	const claimed = await db
		.update(mailOutbox)
		.set({ status: 'sending', updatedAt: new Date(now) })
		.where(and(eq(mailOutbox.status, 'pending'), inArray(mailOutbox.id, next)))
		.returning();

	const origin = await siteOrigin();
	if (!origin) {
		result.remaining = (await outboxCounts()).pending;
		return result;
	}
	const name = await siteName();
	const style = await getUrlStyle();
	const posts = new Map<string, LoadedPost | undefined>();

	for (const row of claimed) {
		const subscriber = (
			await db.select().from(subscribers).where(eq(subscribers.id, row.subscriberId)).limit(1)
		)[0];
		if (!posts.has(row.postId)) posts.set(row.postId, await loadPost(row.postId));
		const post = posts.get(row.postId);

		if (!subscriber || subscriber.status !== 'active' || !post) {
			await db.delete(mailOutbox).where(eq(mailOutbox.id, row.id));
			continue;
		}

		try {
			const links = await unsubscribeUrls(origin, subscriber.id);
			const message = renderPostEmail({
				siteName: name,
				title: post.title,
				excerpt: excerptOf(post.content, 280),
				postUrl: `${origin}${postPath({ slug: post.slug, created_at: post.createdAt }, style)}`,
				thumbnailUrl: emailThumbnail(post, origin),
				unsubscribeUrl: links.page,
				label: POST_EMAIL_LABELS[post.type]
			});
			await sendMail(env, {
				to: subscriber.email,
				...message,
				headers: {
					'List-Unsubscribe': `<${links.oneClick}>`,
					'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
				}
			});
			await db
				.update(mailOutbox)
				.set({ status: 'sent', attempts: row.attempts + 1, error: null, updatedAt: new Date() })
				.where(eq(mailOutbox.id, row.id));
			result.sent++;
		} catch (error) {
			const attempts = row.attempts + 1;
			const exhausted = attempts >= MAX_ATTEMPTS;
			await db
				.update(mailOutbox)
				.set({
					status: exhausted ? 'failed' : 'pending',
					attempts,
					error: (error instanceof Error ? error.message : String(error)).slice(0, 300),
					updatedAt: new Date()
				})
				.where(eq(mailOutbox.id, row.id));
			if (exhausted) result.failed++;
			else result.retried++;
		}
	}

	result.remaining = (await outboxCounts()).pending;
	return result;
}

// #endregion
