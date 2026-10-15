import { desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import type { MediaItem, PostType } from '~/shared/media';
import { excerptOf } from '~/shared/text';
import type { BlogPost, BlogPostSummary, PublicUser, UrlStyle } from '~/shared/types';

export { excerptOf, markdownToText } from '~/shared/text';

export const URL_STYLE_KV_KEY = 'nuxtpress:setting:url_style';

const LIST_CACHE_KEY = 'nuxtpress:blog_summaries:v2';
const POST_CACHE_VERSIONS = ['', 'v2:', 'v3:', 'v4:'];
const LIST_CACHE_TTL = 60 * 3;

/** unstorage parses JSON on read, so a value written with JSON.stringify comes back as an object. */
export function parseCached<T>(value: unknown): T | null {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value !== 'string') return value as T;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

/** Every cache key a post mutation has to drop, across historical key versions. */
export const POST_LIST_CACHE_KEYS = [
	'nuxtpress:blog_posts_list',
	'nuxtpress:blog_posts_list:v1',
	'nuxtpress:blog_posts_list:v2',
	'nuxtpress:blog_posts_list:v3',
	'nuxtpress:blog_summaries:v1',
	LIST_CACHE_KEY,
	'nuxtpress:feed_xml:v2',
	'nuxtpress:feed_xml:v3',
	'nuxtpress:sitemap_urls:v1'
];

export async function invalidatePostCaches() {
	for (const key of POST_LIST_CACHE_KEYS) {
		try {
			await kv.del(key);
		} catch {}
	}
}

export async function getUrlStyle(): Promise<UrlStyle> {
	try {
		const raw = await kv.get<string>(URL_STYLE_KV_KEY);
		return raw === 'slug' ? 'slug' : 'dated';
	} catch {
		return 'dated';
	}
}

/** Data URLs stay in the row; every public payload points at the cacheable route instead. */
export function publicThumbnailUrl(row: {
	id: string;
	thumbnailUrl: string | null;
	hasThumbnail: boolean | number;
	type?: PostType;
	firstMediaKey?: string | null;
}): string | undefined {
	if (row.thumbnailUrl?.startsWith('data:')) return `/thumbnails/${row.id}`;
	const explicit = row.thumbnailUrl || (row.hasThumbnail ? `/thumbnails/${row.id}` : undefined);
	if (explicit) return explicit;
	return row.type === 'slideshow' && row.firstMediaKey ? `/${row.firstMediaKey}` : undefined;
}

export function parseMedia(raw: string | null | undefined): MediaItem[] {
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? (parsed as MediaItem[]) : [];
	} catch {
		return [];
	}
}

const summarySelect = {
	id: blogPosts.id,
	title: blogPosts.title,
	slug: blogPosts.slug,
	type: blogPosts.type,
	firstMediaKey: sql<string | null>`json_extract(${blogPosts.media}, '$[0].key')`,
	content: blogPosts.content,
	thumbnailUrl: blogPosts.thumbnailUrl,
	hasThumbnail: sql<number>`CASE WHEN ${blogPosts.thumbnail} IS NULL THEN 0 ELSE 1 END`,
	authorId: blogPosts.authorId,
	createdAt: blogPosts.createdAt,
	updatedAt: blogPosts.updatedAt,
	tags: blogPosts.tags,
	authorUsername: users.username,
	authorDisplayName: users.displayName,
	authorRole: users.role,
	authorAvatar: users.avatarPathname
};

type SummaryRow = {
	id: string;
	title: string;
	slug: string;
	type: PostType;
	firstMediaKey: string | null;
	content: string;
	thumbnailUrl: string | null;
	hasThumbnail: number;
	authorId: string | null;
	createdAt: Date;
	updatedAt: Date;
	tags: string | null;
	authorUsername: string | null;
	authorDisplayName: string | null;
	authorRole: string | null;
	authorAvatar: string | null;
};

export function rowToAuthor(row: {
	authorId: string | null;
	authorUsername: string | null;
	authorDisplayName: string | null;
	authorRole: string | null;
	authorAvatar: string | null;
}): PublicUser | null {
	if (!row.authorId) return null;
	return {
		id: row.authorId,
		username: row.authorUsername ?? 'unknown',
		displayName: row.authorDisplayName ?? 'Unknown',
		role: (row.authorRole as PublicUser['role']) ?? 'author',
		avatarPathname: row.authorAvatar ?? null
	};
}

function rowToSummary(row: SummaryRow): BlogPostSummary {
	return {
		id: row.id,
		title: row.title,
		slug: row.slug,
		type: row.type,
		excerpt: excerptOf(row.content),
		// thumbnails live in a text column as base64; serve them by URL so JSON stays small
		thumbnail_url: publicThumbnailUrl(row),
		created_at: new Date(row.createdAt),
		updated_at: new Date(row.updatedAt),
		tags: parseTags(row.tags),
		author_id: row.authorId ?? null,
		author: rowToAuthor(row)
	};
}

export function parseTags(tags: string | null): string[] {
	if (!tags) return [];
	return tags
		.split(',')
		.map((t) => t.trim())
		.filter(Boolean);
}

export async function listPostSummaries(): Promise<BlogPostSummary[]> {
	try {
		const parsed = parseCached<BlogPostSummary[]>(await kv.get(LIST_CACHE_KEY));
		if (Array.isArray(parsed)) return parsed;
	} catch {
		try {
			await kv.del(LIST_CACHE_KEY);
		} catch {}
	}

	const rows = (await db
		.select(summarySelect)
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(desc(blogPosts.createdAt))) as SummaryRow[];

	const summaries = rows.map(rowToSummary);

	try {
		await kv.set(LIST_CACHE_KEY, JSON.stringify(summaries), { ttl: LIST_CACHE_TTL });
	} catch {}

	return summaries;
}

export async function searchPostSummaries(query: string, limit = 25): Promise<BlogPostSummary[]> {
	const term = `%${query.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
	const rows = (await db
		.select(summarySelect)
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.where(
			or(
				like(blogPosts.title, term),
				like(blogPosts.content, term),
				like(blogPosts.tags, term),
				like(blogPosts.slug, term)
			)
		)
		.orderBy(desc(blogPosts.createdAt))
		.limit(limit)) as SummaryRow[];

	return rows.map(rowToSummary);
}

/** Full posts including content, for the feed. Ordered newest first. */
export async function listFullPosts(limit = 50): Promise<BlogPost[]> {
	const rows = (await db
		.select({ ...summarySelect, mediaJson: blogPosts.media, authorBio: users.bio })
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(desc(blogPosts.createdAt))
		.limit(limit)) as (SummaryRow & { authorBio: string | null; mediaJson: string | null })[];

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		slug: row.slug,
		type: row.type,
		media: parseMedia(row.mediaJson),
		content: row.content,
		thumbnail_url: publicThumbnailUrl(row),
		created_at: new Date(row.createdAt),
		updated_at: new Date(row.updatedAt),
		tags: parseTags(row.tags),
		author_id: row.authorId ?? null,
		author: rowToAuthor(row)
	}));
}

export async function slugTaken(slug: string, excludeId?: string): Promise<boolean> {
	const rows = await db
		.select({ id: blogPosts.id })
		.from(blogPosts)
		.where(eq(blogPosts.slug, slug))
		.limit(2);
	return rows.some((row) => row.id !== excludeId);
}

/** Drops the per-post caches for a slug: the dated key, the slug-only key and the exists marker. */
export async function invalidatePost(slug: string, createdAt: Date | string | number) {
	const d = new Date(createdAt);
	const y = d.getUTCFullYear();
	const m = d.getUTCMonth() + 1;
	const day = d.getUTCDate();
	const keys = [
		`nuxtpress:slug_exists:${slug}`,
		`nuxtpress:blog_post:v3:${slug}:latest`,
		`nuxtpress:blog_post:v4:${slug}:latest`
	];
	for (const v of POST_CACHE_VERSIONS) {
		keys.push(`nuxtpress:blog_post:${v}${slug}:${y}:${m}:${day}`);
	}
	for (const key of keys) {
		try {
			await kv.del(key);
		} catch {}
	}
}

/** Per-post caches embed the author, so a profile change has to drop them; older posts age out. */
const AUTHOR_INVALIDATION_LIMIT = 50;

export async function authorPosts(userId: string) {
	return db
		.select({ slug: blogPosts.slug, createdAt: blogPosts.createdAt })
		.from(blogPosts)
		.where(eq(blogPosts.authorId, userId))
		.orderBy(desc(blogPosts.createdAt))
		.limit(AUTHOR_INVALIDATION_LIMIT);
}

export async function invalidateAuthor(
	userId: string,
	posts?: Awaited<ReturnType<typeof authorPosts>>
) {
	await invalidatePostCaches();
	for (const post of posts ?? (await authorPosts(userId))) {
		await invalidatePost(post.slug, post.createdAt);
	}
}
