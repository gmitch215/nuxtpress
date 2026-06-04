type SetupStatus = {
	needsSetup: boolean;
	hasLegacyPassword: boolean;
	userCount: number;
};

export function useSetupStatus() {
	const status = useState<SetupStatus | null>('nuxtpress:setup-status', () => null);

	const refresh = async () => {
		try {
			status.value = await $fetch<SetupStatus>('/api/setup/status', {
				credentials: 'include'
			});
		} catch {
			// keep any previously-known status — null-ing it would cause the setup middleware
			// to re-fetch in a tight loop or worse, treat "unknown" as "needs setup"
		}
		return status.value;
	};

	const ensure = async () => {
		if (status.value) return status.value;
		return refresh();
	};

	return { status, refresh, ensure };
}
