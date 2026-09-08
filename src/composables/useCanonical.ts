/**
 * Absolute site origin, preferring the configured public site URL and falling back to the
 * request origin so canonical URLs are still correct on a preview deployment.
 */
export function useSiteOrigin(): string {
	const configured = String(useRuntimeConfig().public.site_url || '').trim();
	if (configured) return configured.replace(/\/+$/, '');
	return useRequestURL().origin;
}

/**
 * Registers rel=canonical plus og:url for the given path (defaults to the current route).
 * Pass the primary path for a page reachable at more than one URL.
 */
export function useCanonical(path?: MaybeRefOrGetter<string>) {
	const route = useRoute();
	const origin = useSiteOrigin();

	const href = computed(() => {
		const resolved = path !== undefined ? toValue(path) : route.path;
		const clean = resolved === '/' ? '/' : resolved.replace(/\/+$/, '');
		return `${origin}${clean}`;
	});

	useHead({
		link: [{ rel: 'canonical', href }]
	});
	useSeoMeta({ ogUrl: href });

	return href;
}
