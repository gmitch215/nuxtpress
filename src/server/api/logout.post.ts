export default defineEventHandler(async (event) => {
	const kv = hubKV();
	const ip = getRequestIP(event);

	await kv.del(`nuxtpress:admin_session:${ip}`);

	deleteCookie(event, 'admin');

	return { ok: true };
});
