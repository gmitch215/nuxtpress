export default defineNuxtRouteMiddleware(() => {
	const { loggedIn, user } = useUserSession();
	if (!loggedIn.value) {
		return navigateTo('/?login=1');
	}
	if (user.value?.role !== 'administrator') {
		return abortNavigation(createError({ statusCode: 403, statusMessage: 'Forbidden' }));
	}
});
