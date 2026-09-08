import { desc, eq, like, or, sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts, users } from '~/server/db/schema';
import type { BlogPost, BlogPostSummary, PublicUser, UrlStyle } from '~/shared/types';

export const URL_STYLE_KV_KEY = 'nuxtpress:setting:url_style';

const LIST_CACHE_KEY = 'nuxtpress:blog_summaries:v1';
const LIST_CACHE_TTL = 60 * 3;

/** Every cache key a post mutation has to drop, across historical key versions. */
export const POST_LIST_CACHE_KEYS = [
	'nuxtpress:blog_posts_list',
	'nuxtpress:blog_posts_list:v1',
	'nuxtpress:blog_posts_list:v2',
	'nuxtpress:blog_posts_list:v3',
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

/**
 * Strips markdown to readable plain text for excerpts, meta descriptions and feed summaries.
 * Order matters: fenced code and images go before inline syntax so their delimiters don't leak.
 */
export function markdownToText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/~~~[\s\S]*?~~~/g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}([-*_]\s*){3,}$/gm, ' ')
		.replace(/^\s{0,3}[-*+]\s+/gm, '')
		.replace(/^\s{0,3}\d+\.\s+/gm, '')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(\*|_)(.*?)\1/g, '$2')
		.replace(/\+\+(.*?)\+\+/g, '$1')
		.replace(/~~(.*?)~~/g, '$1')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function excerptOf(markdown: string, max = 200): string {
	const text = markdownToText(markdown || '');
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

const summarySelect = {
	id: blogPosts.id,
	title: blogPosts.title,
	slug: blogPosts.slug,
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
		excerpt: excerptOf(row.content),
		// thumbnails live in a text column as base64; serve them by URL so JSON stays small
		thumbnail_url: row.thumbnailUrl || (row.hasThumbnail ? `/thumbnails/${row.id}` : undefined),
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
		const cached = await kv.get<string>(LIST_CACHE_KEY);
		if (cached && typeof cached === 'string') {
			const parsed = JSON.parse(cached) as BlogPostSummary[];
			if (Array.isArray(parsed)) return parsed;
		}
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
		.select({ ...summarySelect, authorBio: users.bio })
		.from(blogPosts)
		.leftJoin(users, eq(blogPosts.authorId, users.id))
		.orderBy(desc(blogPosts.createdAt))
		.limit(limit)) as (SummaryRow & { authorBio: string | null })[];

	return rows.map((row) => ({
		id: row.id,
		title: row.title,
		slug: row.slug,
		content: row.content,
		thumbnail_url: row.thumbnailUrl || (row.hasThumbnail ? `/thumbnails/${row.id}` : undefined),
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
	const keys = [`nuxtpress:slug_exists:${slug}`, `nuxtpress:blog_post:v3:${slug}:latest`];
	for (const v of ['', 'v2:', 'v3:']) {
		keys.push(`nuxtpress:blog_post:${v}${slug}:${y}:${m}:${day}`);
	}
	for (const key of keys) {
		try {
			await kv.del(key);
		} catch {}
	}
}
