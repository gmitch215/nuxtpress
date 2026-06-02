import { expect, test } from '@playwright/test';
import { loginViaApi } from '../utils/auth';

test.describe('users API', () => {
	test('GET /api/users/admin returns the seeded admin profile', async ({ request }) => {
		const res = await request.get('/api/users/admin');
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body.author?.username).toBe('admin');
		expect(Array.isArray(body.posts)).toBe(true);
	});

	test('GET /api/users/unknown returns 404', async ({ request }) => {
		const res = await request.get('/api/users/definitely-not-real');
		expect(res.status()).toBe(404);
	});

	test('PATCH /api/users/me requires auth', async ({ request }) => {
		const res = await request.patch('/api/users/me', { data: { displayName: 'Anon' } });
		expect([401, 403]).toContain(res.status());
	});

	test('PATCH /api/users/me updates displayName as admin', async ({ request }) => {
		await loginViaApi(request);
		const original = (await (await request.get('/api/verify')).json()).user?.displayName;
		const next = `Team ${Date.now()}`;
		const res = await request.patch('/api/users/me', { data: { displayName: next } });
		expect(res.ok()).toBe(true);
		const verify = await request.get('/api/verify');
		expect((await verify.json()).user?.displayName).toBe(next);
		// restore so downstream tests see a stable name
		if (original) {
			await request.patch('/api/users/me', { data: { displayName: original } });
		}
	});

	test('PATCH /api/users/me refuses password change for admin while NUXT_PASSWORD set', async ({
		request
	}) => {
		await loginViaApi(request);
		const res = await request.patch('/api/users/me', {
			data: {
				currentPassword: 'adminpass',
				newPassword: 'something-new-and-strong'
			}
		});
		expect(res.status()).toBe(400);
		const msg = (await res.json()).statusMessage as string;
		expect(msg).toMatch(/NUXT_PASSWORD/i);
	});
});
