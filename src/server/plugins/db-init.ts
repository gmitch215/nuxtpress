export default defineNitroPlugin(() => {
	// Keep DB initialization in request handlers to avoid global-scope I/O in Cloudflare workers.
});
