export function useLogin() {
	const session = useUserSession();
	const loggedIn = computed(() => session.loggedIn.value);
	const user = computed(() => session.user.value);
	const isAdmin = computed(() => user.value?.role === 'administrator');

	const login = async (credentials: { username: string; password: string }) => {
		const result = await $fetch<{ ok: boolean }>('/api/login', {
			method: 'POST',
			body: credentials,
			credentials: 'include'
		});
		if (result.ok) {
			await session.fetch();
		}
		return result;
	};

	const isLoggedIn = async () => {
		if (!session.ready.value) {
			await session.fetch();
		}
		return loggedIn.value;
	};

	const logout = async () => {
		await session.clear();
	};

	return { login, logout, loggedIn, user, isAdmin, isLoggedIn };
}
