import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

export const TEST_ADMIN = { username: 'admin', password: 'adminpass' };

export async function loginViaApi(
	request: APIRequestContext,
	creds: { username: string; password: string } = TEST_ADMIN
) {
	const res = await request.post('/api/login', { data: creds });
	if (!res.ok()) throw new Error(`login failed: ${res.status()} ${await res.text()}`);
	return res;
}

export async function loginUi(page: Page, creds = TEST_ADMIN) {
	await page.goto('/');
	await page.getByRole('button', { name: /log in/i }).click();
	await page.getByPlaceholder('Username').fill(creds.username);
	await page.getByPlaceholder('Password').fill(creds.password);
	await page.getByRole('button', { name: /^login$/i }).click();
}

export async function loginContext(context: BrowserContext, creds = TEST_ADMIN): Promise<void> {
	const res = await context.request.post('/api/login', { data: creds });
	if (!res.ok()) throw new Error(`context login failed: ${res.status()}`);
}

/**
 * Puts the seeded admin password back. `currentPassword` is whatever a test just changed it to;
 * there is no env-var fallback login any more, so recovery has to authenticate with the value
 * that actually works right now or every later spec inherits a locked-out admin.
 */
export async function resetAdminPassword(
	request: APIRequestContext,
	currentPassword?: string
): Promise<void> {
	const candidates = [TEST_ADMIN.password, currentPassword].filter(
		(pw): pw is string => typeof pw === 'string' && pw.length > 0
	);

	for (const password of candidates) {
		const login = await request.post('/api/login', {
			data: { username: TEST_ADMIN.username, password }
		});
		if (!login.ok()) continue;

		if (password === TEST_ADMIN.password) return;

		const list = await (await request.get('/api/admin/users')).json();
		const admin = list.find?.((u: { username: string }) => u.username === 'admin');
		if (admin) {
			await request.patch(`/api/admin/users/${admin.id}`, {
				data: { password: TEST_ADMIN.password }
			});
		}
		await loginViaApi(request);
		return;
	}

	throw new Error('could not restore the seeded admin password with any known credential');
}
