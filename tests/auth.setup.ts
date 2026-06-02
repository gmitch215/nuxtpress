import { expect, test as setup } from '@playwright/test';
import { fileURLToPath } from 'node:url';
import { TEST_ADMIN } from './utils/auth';

const ADMIN_STORAGE = fileURLToPath(
	new URL('../playwright-results/.admin-storage.json', import.meta.url)
);

setup('authenticate as admin', async ({ page, context, request }) => {
	// trigger db init + seed
	await request.get('/api/settings');

	const res = await request.post('/api/login', { data: TEST_ADMIN });
	expect(res.ok(), `login failed: ${res.status()} ${await res.text()}`).toBe(true);

	const verify = await request.get('/api/verify');
	const v = await verify.json();
	expect(v.loggedIn, `verify returned loggedIn=false after login`).toBe(true);

	// sync cookies from APIRequestContext into the browser context so future page/api calls have them
	const cookies = await request.storageState();
	await context.addCookies(cookies.cookies);

	await page.goto('/');
	await context.storageState({ path: ADMIN_STORAGE });
});
