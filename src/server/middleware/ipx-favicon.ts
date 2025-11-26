export default defineEventHandler((event) => {
	const url = getRequestURL(event);

	// if IPX is trying to process favicon.png or favicon.ico, redirect to the original route
	if (
		url.pathname.includes('/_ipx/') &&
		(url.pathname.endsWith('/favicon.png') || url.pathname.endsWith('/favicon.ico'))
	) {
		const faviconPath = url.pathname.endsWith('/favicon.png') ? '/favicon.png' : '/favicon.ico';
		return sendRedirect(event, faviconPath, 301);
	}
});
