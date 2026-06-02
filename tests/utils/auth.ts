import type { APIRequestContext, BrowserContext, Page } from '@playwright/test';

export const TEST_ADMIN = { username: 'admin', password: 'adminpass' };

export async function loginViaApi(
	request: APIRequestContext,
	creds: { username: string; password: string } = TEST_ADMIN
) {
	const res = await request.post('/api/login', { data: creds });
	if (!res.ok()) throw new Error(`login failed: ${res.status()}`);
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
