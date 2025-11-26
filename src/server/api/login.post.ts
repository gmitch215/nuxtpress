function timingSafeEqual(a: string, b: string): boolean {
	const aBuffer = Buffer.from(a, 'utf-8');
	const bBuffer = Buffer.from(b, 'utf-8');

	const timingSafeEqual = (crypto.subtle as any).timingSafeEqual || (crypto as any).timingSafeEqual;

	if (aBuffer.length !== bBuffer.length) {
		const fakeBuffer = Buffer.alloc(aBuffer.length);
		timingSafeEqual(aBuffer, fakeBuffer);
		return false;
	}

	return timingSafeEqual(aBuffer, bBuffer);
}

export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const { password } = await readBody(event);
	const correct = useRuntimeConfig().password;

	if (!timingSafeEqual(password || '', correct || '')) {
		throw createError<{ ok: boolean }>({
			statusCode: 401,
			data: {
				ok: false
			}
		});
	}

	// generate secure unpredictable token
	const token = crypto.getRandomValues(new Uint8Array(32)).join('');
	const ip = getRequestIP(event);

	// store it server-side
	kv.set(`nuxtpress:admin_session:${ip}`, token, { ttl: 60 * 60 * 24 * 14 }); // 14 days
	setCookie(event, 'admin', token, {
		httpOnly: true,
		sameSite: 'strict',
		secure: true,
		maxAge: 60 * 60 * 24 * 14,
		path: '/'
	});

	return { ok: true };
});
