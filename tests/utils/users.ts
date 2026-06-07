import type { APIRequestContext } from '@playwright/test';
import { loginViaApi } from './auth';

export type TempUser = {
	id: string;
	username: string;
	password: string;
	displayName: string;
	role: 'author' | 'administrator';
};

let seq = 0;

// create a throwaway user via the admin API so credential tests never mutate the shared seeded
// admin. requires (and re-establishes) an admin session; clean up with deleteUser.
export async function createUser(
	request: APIRequestContext,
	overrides: Partial<Omit<TempUser, 'id'>> = {}
): Promise<TempUser> {
	await loginViaApi(request);
	const user = {
		username: overrides.username ?? `tmp${Date.now()}x${seq++}`,
		password: overrides.password ?? 'temp-user-pw-12345',
		displayName: overrides.displayName ?? 'Temp User',
		role: overrides.role ?? ('author' as const)
	};
	const res = await request.post('/api/admin/users', { data: user });
	if (!res.ok()) throw new Error(`create user failed: ${res.status()} ${await res.text()}`);
	const { id } = await res.json();
	return { id, ...user };
}

// delete a throwaway user via the admin API. re-establishes the admin session first so cleanup
// works even when the caller logged in as the throwaway user during the test.
export async function deleteUser(request: APIRequestContext, id: string): Promise<void> {
	await loginViaApi(request);
	await request.delete(`/api/admin/users/${id}`);
}
