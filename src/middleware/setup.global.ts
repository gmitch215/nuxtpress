export default defineNuxtRouteMiddleware(async (to) => {
	const { ensure } = useSetupStatus();
	const status = await ensure();
	if (!status) return;

	if (status.needsSetup && to.path !== '/setup') {
		return navigateTo('/setup');
	}
	if (!status.needsSetup && to.path === '/setup') {
		return navigateTo('/');
	}
});
