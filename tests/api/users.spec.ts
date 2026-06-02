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
		const before = await (await request.get('/api/users/admin')).json();
		const original = before.author?.displayName as string | undefined;
		const next = `Team ${Date.now()}`;
		const res = await request.patch('/api/users/me', { data: { displayName: next } });
		expect(res.ok()).toBe(true);
		const after = await (await request.get('/api/users/admin')).json();
		expect(after.author?.displayName).toBe(next);
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
