export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const { password } = await readBody(event);
	const correct = useRuntimeConfig().password;

	if (password !== correct) {
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
