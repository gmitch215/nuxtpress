export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const token = getCookie(event, 'admin');
	const ip = getRequestIP(event);

	if (!token) {
		return { loggedIn: false };
	}

	const storedToken = await kv.get(`nuxtpress:admin_session:${ip}`);
	if (storedToken === token) {
		return { loggedIn: true };
	}

	return { loggedIn: false };
});
