import { kv } from 'hub:kv';
import { proxyExternalAsset } from '~/server/utils/favicon-proxy';
import { decodeDataImage, INLINE_IMAGE_TYPES } from '~/shared/images';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const faviconPng = await kv.get<string>('nuxtpress:setting:favicon_png');
	if (faviconPng?.startsWith('data:')) {
		const image = decodeDataImage(faviconPng, INLINE_IMAGE_TYPES);
		if (image) {
			setHeader(event, 'Content-Type', image.mime);
			setHeader(event, 'X-Content-Type-Options', 'nosniff');
			setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
			return image.bytes;
		}
	}

	// external host: proxy through the worker so we get edge caching + origin-outage resilience
	if (faviconPng && (faviconPng.startsWith('http://') || faviconPng.startsWith('https://'))) {
		return proxyExternalAsset(faviconPng, 'image/png');
	}

	// internal same-origin path: a redirect is the right move (one less worker invocation per favicon)
	if (faviconPng && faviconPng.startsWith('/') && faviconPng !== '/favicon.png') {
		return sendRedirect(event, faviconPng, 301);
	}

	return sendRedirect(event, config.public.faviconPng, 301);
});
