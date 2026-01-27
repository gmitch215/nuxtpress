import { kv } from 'hub:kv';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const favicon = await kv.get<string>('nuxtpress:setting:favicon');
	if (favicon && favicon.startsWith('data:')) {
		const matches = favicon.match(/^data:([^;]+);base64,(.+)$/);
		if (matches) {
			const mimeType = matches[1]!;
			const base64Data = matches[2]!;
			const buffer = Buffer.from(base64Data, 'base64');

			setHeader(event, 'Content-Type', mimeType);
			setHeader(event, 'Cache-Control', 'public, max-age=31536000, immutable');
			return buffer;
		}
	}

	if (favicon && (favicon.startsWith('http://') || favicon.startsWith('https://'))) {
		return sendRedirect(event, favicon, 301);
	}

	if (favicon && favicon.startsWith('/') && favicon !== '/favicon.ico') {
		return sendRedirect(event, favicon, 301);
	}

	return sendRedirect(event, config.public.favicon, 301);
});
