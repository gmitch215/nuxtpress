import { kv } from 'hub:kv';

export default defineEventHandler(async (event) => {
	const sessionId = getCookie(event, 'admin_session_id');

	if (sessionId) {
		await kv.del(`nuxtpress:admin_session:${sessionId}`);
	}

	deleteCookie(event, 'admin');
	deleteCookie(event, 'admin_session_id');

	return { ok: true };
});
