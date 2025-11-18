export function useLogin() {
	const loggedIn = useState<boolean | undefined>('logged_in', () => undefined);

	const login = async (password: string) => {
		const result = await $fetch<{ ok: boolean }>('/api/login', {
			method: 'POST',
			body: { password },
			credentials: 'include'
		});

		if (result.ok) {
			loggedIn.value = true;
		}

		return result;
	};

	const isLoggedIn = async () => {
		if (loggedIn.value !== undefined) {
			return loggedIn.value;
		}

		try {
			const response = await $fetch<{ loggedIn: boolean }>('/api/verify', {
				credentials: 'include'
			});

			loggedIn.value = response.loggedIn;
			return loggedIn.value;
		} catch (error) {
			loggedIn.value = false;
			return false;
		}
	};

	const logout = async () => {
		await $fetch('/api/logout', {
			method: 'POST',
			credentials: 'include'
		});

		loggedIn.value = false;
	};

	return { login, loggedIn, isLoggedIn, logout };
}
