// dev-only: mark the document once the app has hydrated so e2e tests can wait for interactivity before clicking
export default defineNuxtPlugin((nuxtApp) => {
	if (!import.meta.dev) return;
	nuxtApp.hook('app:suspense:resolve', () => {
		document.documentElement.dataset.hydrated = 'true';
	});
});
