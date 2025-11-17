export function useLogin() {
	const login = async (password: string) => {
		return $fetch('/api/login', {
			method: 'POST',
			body: { password }
		});
	};

	return { login };
}
