declare module '#auth-utils' {
	interface User {
		id: string;
		username: string;
		displayName: string;
		role: 'administrator' | 'author';
		avatarPathname?: string | null;
		bio?: string | null;
	}

	interface UserSession {
		loggedInAt: number;
		legacyPasswordActive?: boolean;
	}

	interface SecureSessionData {}
}

export {};
