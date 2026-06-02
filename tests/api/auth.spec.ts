import { expect, test } from '@playwright/test';
import { ANON_STATE } from '../utils/auth';

test.use({ storageState: ANON_STATE });

test.describe('auth API', () => {
	test('GET /api/verify returns loggedIn:false anonymously', async ({ request }) => {
		const res = await request.get('/api/verify');
		expect(res.status()).toBe(200);
		const body = await res.json();
		expect(body.loggedIn).toBe(false);
		expect(body.user).toBeNull();
	});

	test('POST /api/login rejects empty password', async ({ request }) => {
		const res = await request.post('/api/login', { data: { username: 'admin', password: '' } });
		expect(res.status()).toBe(400);
	});

	test('POST /api/login rejects bad credentials', async ({ request }) => {
		const res = await request.post('/api/login', {
			data: { username: 'admin', password: 'not-the-real-password' }
		});
		expect(res.status()).toBe(401);
	});

	test('POST /api/login + GET /api/verify round-trip succeeds for admin', async ({ request }) => {
		const login = await request.post('/api/login', {
			data: { username: 'admin', password: 'adminpass' }
		});
		expect(login.ok()).toBe(true);

		const verify = await request.get('/api/verify');
		const body = await verify.json();
		expect(body.loggedIn).toBe(true);
		expect(body.user?.username).toBe('admin');
		expect(body.user?.role).toBe('administrator');
	});

	test('legacy password-only login body still works (defaults username to admin)', async ({
		request
	}) => {
		const res = await request.post('/api/login', { data: { password: 'adminpass' } });
		expect(res.ok()).toBe(true);
		const verify = await request.get('/api/verify');
		expect((await verify.json()).user?.username).toBe('admin');
	});

	test('POST /api/logout clears session', async ({ request }) => {
		await request.post('/api/login', { data: { username: 'admin', password: 'adminpass' } });
		const out = await request.post('/api/logout');
		expect(out.ok()).toBe(true);
		const verify = await request.get('/api/verify');
		expect((await verify.json()).loggedIn).toBe(false);
	});
});
