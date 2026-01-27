import { kv } from 'hub:kv';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const faviconPng = await kv.get<string>('nuxtpress:setting:favicon_png');
	if (faviconPng && faviconPng.startsWith('data:')) {
		const matches = faviconPng.match(/^data:([^;]+);base64,(.+)$/);
		if (matches) {
			const mimeType = matches[1]!;
			const base64Data = matches[2]!;
			const buffer = Buffer.from(base64Data, 'base64');

			setHeader(event, 'Content-Type', mimeType);
			setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
			return buffer;
		}
	}

	if (faviconPng && (faviconPng.startsWith('http://') || faviconPng.startsWith('https://'))) {
		return sendRedirect(event, faviconPng, 301);
	}

	if (faviconPng && faviconPng.startsWith('/') && faviconPng !== '/favicon.png') {
		return sendRedirect(event, faviconPng, 301);
	}

	return sendRedirect(event, config.public.faviconPng, 301);
});
