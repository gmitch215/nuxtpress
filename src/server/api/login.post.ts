function timingSafeEqual(a: string, b: string): boolean {
	const encoder = new TextEncoder();
	const aBuffer = encoder.encode(a);
	const bBuffer = encoder.encode(b);

	// CF Workers
	if ('timingSafeEqual' in crypto.subtle) {
		if (aBuffer.length !== bBuffer.length) {
			const fakeBuffer = new Uint8Array(aBuffer.length);
			(crypto.subtle as any).timingSafeEqual(aBuffer, fakeBuffer);
			return false;
		}

		return (crypto.subtle as any).timingSafeEqual(aBuffer, bBuffer);
	}

	// Node.js
	if ('timingSafeEqual' in crypto) {
		if (aBuffer.length !== bBuffer.length) {
			const fakeBuffer = new Uint8Array(aBuffer.length);
			crypto.timingSafeEqual(aBuffer, fakeBuffer);
			return false;
		}
		return crypto.timingSafeEqual(aBuffer, bBuffer);
	}

	// Fallback for local development (not timing safe)
	return a === b;
}

export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const { password } = await readBody(event);
	const correct = useRuntimeConfig().password;

	if (!timingSafeEqual(password || '', correct || '')) {
		throw createError<{ ok: boolean }>({
			statusCode: 401,
			statusMessage: 'Unauthorized',
			data: {
				ok: false
			}
		});
	}

	// generate secure unpredictable token
	const token = crypto.getRandomValues(new Uint8Array(32)).join('');
	const ip = getRequestIP(event);
	const sessionId = ip || `session_${crypto.getRandomValues(new Uint8Array(16)).join('')}`;

	// store it server-side
	kv.set(`nuxtpress:admin_session:${sessionId}`, token, { ttl: 60 * 60 * 24 * 14 }); // 14 days
	setCookie(event, 'admin', token, {
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: 60 * 60 * 24 * 14,
		path: '/'
	});

	// store session ID in cookie for clients without IP
	if (!ip) {
		setCookie(event, 'admin_session_id', sessionId, {
			httpOnly: true,
			sameSite: 'strict',
			secure: true,
			maxAge: 60 * 60 * 24 * 14,
			path: '/'
		});
	}

	return { ok: true };
});
