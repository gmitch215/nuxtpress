import { blob } from 'hub:blob';
import { requireAuthed } from '~/server/utils/auth';
import { deleteMedia, isMediaMime, mediaAvailable } from '~/server/utils/media';
import { extensionFor, MEDIA_MAX_BYTES, SLIDE_MIMES } from '~/shared/media';

type FixedLengthLike = { readable: ReadableStream; writable: WritableStream };

const IMAGE_MAX_BYTES = 25 * 1024 * 1024;

export default defineEventHandler(async (event) => {
	const me = await requireAuthed(event);

	if (!mediaAvailable(event)) {
		throw createError({ statusCode: 503, statusMessage: 'Media storage is not configured' });
	}

	const mime = (getRequestHeader(event, 'content-type') ?? '').split(';')[0]!.trim().toLowerCase();
	if (!isMediaMime(mime)) {
		throw createError({ statusCode: 415, statusMessage: 'That file type is not supported' });
	}

	const length = Number(getRequestHeader(event, 'content-length'));
	if (!Number.isInteger(length) || length <= 0) {
		throw createError({ statusCode: 411, statusMessage: 'Content-Length is required' });
	}
	const cap = (SLIDE_MIMES as readonly string[]).includes(mime) ? IMAGE_MAX_BYTES : MEDIA_MAX_BYTES;
	if (length > cap) {
		throw createError({
			statusCode: 413,
			statusMessage: `Files can be at most ${cap / 1024 / 1024} MB`
		});
	}

	let body: ReadableStream | undefined = getRequestWebStream(event) ?? undefined;
	if (!body) throw createError({ statusCode: 400, statusMessage: 'No file provided' });

	// R2 only accepts a stream of known length, and the body Nitro hands over is wrapped; the
	// fixed-length pipe also makes a lying Content-Length fail instead of overrunning the cap
	const FixedLength = (
		globalThis as { FixedLengthStream?: new (length: number) => FixedLengthLike }
	).FixedLengthStream;
	if (FixedLength) {
		const fixed = new FixedLength(length);
		body.pipeTo(fixed.writable).catch(() => {});
		body = fixed.readable;
	}

	const id = crypto.randomUUID().replace(/-/g, '');
	const key = `media/${me.id}/${id}.${extensionFor(mime)}`;
	let stored;
	try {
		stored = await blob.put(key, body, { contentType: mime, contentLength: String(length) });
	} catch (error) {
		await deleteMedia([key]);
		console.warn('media upload failed', error);
		throw createError({ statusCode: 400, statusMessage: 'The upload did not complete' });
	}

	const size = stored.size ?? length;
	if (size > cap) {
		await deleteMedia([key]);
		throw createError({ statusCode: 413, statusMessage: 'The file is larger than it declared' });
	}

	return { key, url: `/${key}`, mime, size };
});
