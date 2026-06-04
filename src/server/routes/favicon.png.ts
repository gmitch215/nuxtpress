import { kv } from 'hub:kv';
import { proxyExternalAsset } from '~/server/utils/favicon-proxy';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const faviconPng = await kv.get<string>('nuxtpress:setting:favicon_png');
	if (faviconPng && faviconPng.startsWith('data:')) {
		const matches = faviconPng.match(/^data:([^;]+);base64,(.+)$/);
		if (matches) {
			const mimeType = matches[1]!;
			const base64Data = matches[2]!;
			const binary = atob(base64Data);
			const bytes = new Uint8Array(binary.length);
			for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

			setHeader(event, 'Content-Type', mimeType);
			setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
			return bytes;
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
