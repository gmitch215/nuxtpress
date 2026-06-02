import { blob } from 'hub:blob';

export default defineEventHandler(async (event) => {
	const pathname = getRouterParam(event, 'pathname');
	if (!pathname) {
		throw createError({ statusCode: 400, statusMessage: 'Missing pathname' });
	}
	setHeader(event, 'Cache-Control', 'public, max-age=86400');
	return blob.serve(event, decodeURIComponent(pathname));
});
