import { serveMedia } from '~/server/utils/media';
import { MEDIA_KEY_RE } from '~/shared/media';

export default defineEventHandler(async (event) => {
	const key = `media/${getRouterParam(event, 'key') ?? ''}`;
	if (!MEDIA_KEY_RE.test(key)) {
		throw createError({ statusCode: 404, statusMessage: 'Not Found' });
	}
	return serveMedia(event, key);
});
