import type { RouteLocationNormalizedLoaded } from 'vue-router';

const IGNORED = ['/setup', '/profile'];

function isTracked(route: RouteLocationNormalizedLoaded): boolean {
	// the two post permalinks are the only routes carrying a slug param, and BlogArticle already
	// tracks those with the real post slug
	if (route.params.slug !== undefined) return false;
	return !IGNORED.includes(route.path) && !route.path.startsWith('/admin');
}

export default defineNuxtPlugin((nuxtApp) => {
	const router = useRouter();
	const path = ref(router.currentRoute.value.path);
	const tracker = useAnalytics(() => path.value, 'page');

	let running = false;

	function sync(route: RouteLocationNormalizedLoaded) {
		if (running) {
			tracker.stop();
			running = false;
		}

		if (isTracked(route)) {
			path.value = route.path;
			tracker.start();
			running = true;
		}
	}

	nuxtApp.hook('app:mounted', () => sync(router.currentRoute.value));
	router.afterEach((to) => sync(to as RouteLocationNormalizedLoaded));
});
