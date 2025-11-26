export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const ip = getRequestIP(event);
	const sessionId = ip || getCookie(event, 'admin_session_id');

	if (sessionId) {
		await kv.del(`nuxtpress:admin_session:${sessionId}`);
	}

	deleteCookie(event, 'admin');
	if (!ip) {
		deleteCookie(event, 'admin_session_id');
	}

	return { ok: true };
});
