// edge-cached proxy for externally-hosted favicons. avoids:
//  - extra round trip on the client (redirect → fetch)
//  - origin outages making the favicon disappear once the redirect target is gone
//  - re-fetching the same external asset on every cold request
const PROXY_CACHE_TTL = 60 * 60 * 24 * 7;
const PROXY_FETCH_TIMEOUT_MS = 5000;

export async function proxyExternalAsset(url: string, fallbackType: string): Promise<Response> {
	const cacheKey = new Request(url, { method: 'GET' });
	const edgeCache = (globalThis as any).caches?.default as Cache | undefined;

	if (edgeCache) {
		const hit = await edgeCache.match(cacheKey).catch(() => undefined);
		if (hit) return hit;
	}

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), PROXY_FETCH_TIMEOUT_MS);
	let upstream: Response;
	try {
		upstream = await fetch(url, { signal: controller.signal, redirect: 'follow' });
	} finally {
		clearTimeout(timer);
	}

	if (!upstream.ok) {
		// don't cache failures; let the next request retry
		return new Response(null, { status: upstream.status });
	}

	const headers = new Headers();
	headers.set('Content-Type', upstream.headers.get('Content-Type') ?? fallbackType);
	headers.set('Cache-Control', `public, max-age=${PROXY_CACHE_TTL}, immutable`);
	const body = await upstream.arrayBuffer();
	const response = new Response(body, { status: 200, headers });

	if (edgeCache) {
		try {
			await edgeCache.put(cacheKey, response.clone());
		} catch (error) {
			console.warn('favicon cache put failed:', error);
		}
	}

	return response;
}
