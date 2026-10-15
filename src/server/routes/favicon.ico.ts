import { kv } from 'hub:kv';
import { proxyExternalAsset } from '~/server/utils/favicon-proxy';
import { decodeDataImage, FAVICON_TYPES } from '~/shared/images';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const favicon = await kv.get<string>('nuxtpress:setting:favicon');
	if (favicon?.startsWith('data:')) {
		const image = decodeDataImage(favicon, FAVICON_TYPES);
		if (image) {
			setHeader(event, 'Content-Type', image.mime);
			setHeader(event, 'X-Content-Type-Options', 'nosniff');
			setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
			return image.bytes;
		}
	}

	if (favicon && (favicon.startsWith('http://') || favicon.startsWith('https://'))) {
		return proxyExternalAsset(favicon, 'image/x-icon');
	}

	if (favicon && favicon.startsWith('/') && favicon !== '/favicon.ico') {
		return sendRedirect(event, favicon, 301);
	}

	return sendRedirect(event, config.public.favicon, 301);
});
