export function useLogin() {
	const session = useUserSession();
	const loggedIn = computed(() => session.loggedIn.value);
	const user = computed(() => session.user.value);
	const isAdmin = computed(() => user.value?.role === 'administrator');

	const login = async (passwordOrCreds: string | { username: string; password: string }) => {
		const body =
			typeof passwordOrCreds === 'string'
				? { username: 'admin', password: passwordOrCreds }
				: passwordOrCreds;
		const result = await $fetch<{ ok: boolean }>('/api/login', {
			method: 'POST',
			body,
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
