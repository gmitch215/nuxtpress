import { kv } from 'hub:kv';

export default defineEventHandler(async (event) => {
	const token = getCookie(event, 'admin');
	const ip = getRequestIP(event);
	const sessionId = ip || getCookie(event, 'admin_session_id');

	if (!token || !sessionId) {
		return { loggedIn: false };
	}

	const storedToken = await kv.get(`nuxtpress:admin_session:${sessionId}`);
	if (storedToken === token) {
		return { loggedIn: true };
	}

	return { loggedIn: false };
});
