import { expect, test } from '@playwright/test';
import { loginViaApi } from '../utils/auth';

test.describe('admin users API', () => {
	test('GET /api/admin/users requires admin', async ({ request }) => {
		const res = await request.get('/api/admin/users');
		expect([401, 403]).toContain(res.status());
	});

	test('admin can list users and sees the seeded admin', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.get('/api/admin/users');
		expect(res.ok()).toBe(true);
		const list = await res.json();
		expect(Array.isArray(list)).toBe(true);
		expect(list.find((u: any) => u.username === 'admin')).toBeTruthy();
	});

	test('admin can create then delete an author', async ({ request }) => {
		await loginViaApi(request);
		const username = `apitest${Date.now()}`;
		const create = await request.post('/api/admin/users', {
			data: {
				username,
				displayName: 'API Tester',
				password: 'a-decent-test-password',
				role: 'author'
			}
		});
		expect(create.ok()).toBe(true);
		const { id } = await create.json();
		expect(id).toBeTruthy();

		const del = await request.delete(`/api/admin/users/${id}`);
		expect(del.ok()).toBe(true);
	});

	test('cannot create a duplicate username', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.post('/api/admin/users', {
			data: {
				username: 'admin',
				displayName: 'Dup',
				password: 'pw-12345678',
				role: 'author'
			}
		});
		expect(res.status()).toBe(409);
	});

	test('cannot delete yourself', async ({ request }) => {
		await loginViaApi(request);
		const list = await (await request.get('/api/admin/users')).json();
		const me = list.find((u: any) => u.username === 'admin');
		const res = await request.delete(`/api/admin/users/${me.id}`);
		expect(res.status()).toBe(400);
	});

	test('cannot demote the last administrator', async ({ request }) => {
		await loginViaApi(request);
		const list = await (await request.get('/api/admin/users')).json();
		const admins = list.filter((u: any) => u.role === 'administrator' && u.isActive);
		if (admins.length !== 1) {
			test.skip(true, 'requires exactly one active admin to assert last-admin guard');
		}
		const me = admins[0];
		const res = await request.patch(`/api/admin/users/${me.id}`, {
			data: { role: 'author' }
		});
		expect(res.status()).toBe(400);
	});

	test('PATCH against admin password is blocked while NUXT_PASSWORD set', async ({ request }) => {
		await loginViaApi(request);
		const list = await (await request.get('/api/admin/users')).json();
		const adminUser = list.find((u: any) => u.username === 'admin');
		const res = await request.patch(`/api/admin/users/${adminUser.id}`, {
			data: { password: 'replaced-via-admin-api' }
		});
		expect(res.status()).toBe(400);
		expect((await res.json()).statusMessage).toMatch(/NUXT_PASSWORD/i);
	});
});
