import { isNotNull, like, or } from 'drizzle-orm';
import type { H3Event } from 'h3';
import { blob } from 'hub:blob';
import { db } from 'hub:db';
import { kv } from 'hub:kv';
import { blogPosts } from '~/server/db/schema';
import {
	ALL_MEDIA_MIMES,
	MEDIA_KEY_RE,
	MIMES_BY_TYPE,
	keyFromPath,
	type MediaItem,
	type PostType
} from '~/shared/media';
import { parseMedia } from './posts';

type R2Like = {
	get(
		key: string,
		options?: { range?: Headers; onlyIf?: Headers }
	): Promise<
		(R2ObjectLike & { body?: ReadableStream; range?: { offset?: number; length?: number } }) | null
	>;
};
type R2ObjectLike = {
	size: number;
	httpEtag: string;
	writeHttpMetadata(headers: Headers): void;
};

export type MediaEnv = { BLOB?: R2Like } | undefined;

export function mediaEnv(event: H3Event): MediaEnv {
	return (event.context as { cloudflare?: { env?: MediaEnv } }).cloudflare?.env;
}

/** Workerd needs the BLOB binding; the local dev server falls back to the filesystem driver. */
export function mediaAvailable(event: { context: unknown }): boolean {
	const cloudflare = (event.context as { cloudflare?: { env?: MediaEnv } }).cloudflare;
	return !cloudflare || !!cloudflare.env?.BLOB;
}

export function allowedMimes(type: Exclude<PostType, 'article'>): readonly string[] {
	return MIMES_BY_TYPE[type];
}

export function isMediaMime(mime: string): boolean {
	return ALL_MEDIA_MIMES.includes(mime);
}

export async function deleteMedia(keys: Iterable<string>): Promise<void> {
	const valid = [...new Set(keys)].filter((key) => MEDIA_KEY_RE.test(key));
	if (valid.length === 0) return;
	try {
		await blob.del(valid);
	} catch (error) {
		console.warn('media delete failed', error);
	}
}

/** Keys a post points at, through its media list and an uploaded thumbnail or poster. */
export function keysOf(media: MediaItem[], thumbnailUrl?: string | null): string[] {
	const keys = media.map((item) => item.key);
	const thumbnail = thumbnailUrl ? keyFromPath(thumbnailUrl) : null;
	if (thumbnail) keys.push(thumbnail);
	return keys;
}

export type MediaOwner = { id: string; isAdmin: boolean; existing: Set<string> };

/**
 * Checks every referenced file exists, belongs to the author (or is already on the post), and is
 * the type the post expects. Size and mime are read back from storage, never trusted from the form.
 */
export async function resolveMedia(
	type: PostType,
	items: MediaItem[],
	thumbnailUrl: string | undefined,
	owner: MediaOwner
): Promise<MediaItem[]> {
	const mayUse = (key: string) =>
		owner.isAdmin || owner.existing.has(key) || key.startsWith(`media/${owner.id}/`);

	const thumbnailKey = thumbnailUrl ? keyFromPath(thumbnailUrl) : null;
	if (thumbnailKey) {
		if (!mayUse(thumbnailKey) || !(await blob.driver.hasItem(thumbnailKey))) {
			throw createError({ statusCode: 400, statusMessage: 'Thumbnail file was not found' });
		}
	}

	const resolved: MediaItem[] = [];
	for (const item of items) {
		const head = mayUse(item.key) ? await blob.driver.head(item.key) : null;
		if (!head) {
			throw createError({ statusCode: 400, statusMessage: 'A media file was not found' });
		}
		const mime = head.contentType ?? '';
		if (type === 'article' || !MIMES_BY_TYPE[type].includes(mime)) {
			throw createError({ statusCode: 400, statusMessage: 'That file type is not allowed here' });
		}
		resolved.push({ ...item, mime, size: head.size ?? 0 });
	}
	return resolved;
}

// #region serving

function parseRange(
	header: string | undefined,
	size: number
): { start: number; end: number } | null {
	const match = header?.match(/^bytes=(\d*)-(\d*)$/);
	if (!match) return null;
	const [, from, to] = match;
	if (from === '' && to === '') return null;
	let start = from === '' ? size - Number(to) : Number(from);
	let end = from === '' || to === '' ? size - 1 : Math.min(Number(to), size - 1);
	if (from === '') end = size - 1;
	start = Math.max(0, start);
	if (start > end || start >= size) return null;
	return { start, end };
}

const CACHE = 'public, max-age=31536000, immutable';

/** Streams an object with HTTP range support. `blob.serve` buffers the whole file, which a video cannot afford. */
export async function serveMedia(event: H3Event, key: string): Promise<Response | Uint8Array> {
	const bucket = mediaEnv(event)?.BLOB;
	const request = event.web?.request;

	if (bucket && request) {
		const object = await bucket.get(key, { range: request.headers, onlyIf: request.headers });
		if (!object) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

		const headers = new Headers();
		object.writeHttpMetadata(headers);
		headers.set('etag', object.httpEtag);
		headers.set('Accept-Ranges', 'bytes');
		headers.set('Cache-Control', CACHE);
		headers.set('X-Content-Type-Options', 'nosniff');

		if (!object.body) return new Response(null, { status: 304, headers });

		const range = object.range;
		if (range && request.headers.has('range')) {
			const offset = range.offset ?? 0;
			const length = range.length ?? object.size - offset;
			headers.set('Content-Range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
			headers.set('Content-Length', String(length));
			return new Response(object.body, { status: 206, headers });
		}
		headers.set('Content-Length', String(object.size));
		return new Response(object.body, { status: 200, headers });
	}

	const head = await blob.driver.head(key);
	const file = head ? await blob.driver.get(key) : null;
	if (!head || !file) throw createError({ statusCode: 404, statusMessage: 'Not Found' });

	setHeader(event, 'Content-Type', head.contentType);
	setHeader(event, 'Accept-Ranges', 'bytes');
	setHeader(event, 'Cache-Control', CACHE);
	setHeader(event, 'X-Content-Type-Options', 'nosniff');
	if (head.httpEtag) setHeader(event, 'ETag', head.httpEtag);

	const bytes = new Uint8Array(await file.arrayBuffer());
	const range = parseRange(getRequestHeader(event, 'range'), bytes.byteLength);
	if (getRequestHeader(event, 'range') && !range) {
		setResponseStatus(event, 416);
		setHeader(event, 'Content-Range', `bytes */${bytes.byteLength}`);
		return new Uint8Array();
	}
	if (range) {
		setResponseStatus(event, 206);
		setHeader(event, 'Content-Range', `bytes ${range.start}-${range.end}/${bytes.byteLength}`);
		return bytes.slice(range.start, range.end + 1);
	}
	return bytes;
}

// #endregion

// #region sweep

/** Keys still in use by a post or a saved draft. */
export async function referencedMediaKeys(): Promise<Set<string>> {
	const keys = new Set<string>();

	const rows = await db
		.select({ media: blogPosts.media, thumbnailUrl: blogPosts.thumbnailUrl })
		.from(blogPosts)
		.where(or(isNotNull(blogPosts.media), like(blogPosts.thumbnailUrl, '/media/%')));
	for (const row of rows) {
		for (const key of keysOf(parseMedia(row.media), row.thumbnailUrl)) keys.add(key);
	}

	for (const draftKey of await kv.keys('nuxtpress:blog_draft:')) {
		const draft = await kv.get<{ media?: MediaItem[]; thumbnail_url?: string } | string>(draftKey);
		const parsed = typeof draft === 'string' ? safeJson(draft) : draft;
		for (const key of keysOf(parsed?.media ?? [], parsed?.thumbnail_url)) keys.add(key);
	}
	return keys;
}

function safeJson(value: string): { media?: MediaItem[]; thumbnail_url?: string } | null {
	try {
		return JSON.parse(value);
	} catch {
		return null;
	}
}

/** Deletes uploads that no post or draft references once they are older than the grace period. */
export async function sweepMedia(graceMs: number): Promise<{ scanned: number; deleted: number }> {
	const referenced = await referencedMediaKeys();
	const cutoff = Date.now() - graceMs;
	let scanned = 0;
	const stale: string[] = [];

	let cursor: string | undefined;
	do {
		const page = await blob.list({ prefix: 'media/', cursor, limit: 1000 });
		for (const item of page.blobs) {
			scanned++;
			if (referenced.has(item.pathname)) continue;
			if (new Date(item.uploadedAt).getTime() <= cutoff) stale.push(item.pathname);
		}
		cursor = page.hasMore ? page.cursor : undefined;
	} while (cursor);

	await deleteMedia(stale);
	return { scanned, deleted: stale.length };
}

// #endregion
