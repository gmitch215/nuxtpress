import { expect, test } from '../fixtures';
import { loginViaApi, resetAdminPassword, TEST_ADMIN } from '../utils/auth';

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

	test('an administrator can change the seeded admin password', async ({ request }) => {
		const replacement = 'replaced-via-admin-api-pw';
		try {
			await loginViaApi(request);
			const list = await (await request.get('/api/admin/users')).json();
			const adminUser = list.find((u: any) => u.username === 'admin');
			const res = await request.patch(`/api/admin/users/${adminUser.id}`, {
				data: { password: replacement }
			});
			expect(res.ok()).toBe(true);

			// the stored hash is what authenticates; NUXT_PASSWORD is not a login fallback any more
			await loginViaApi(request, { username: 'admin', password: replacement });
			const stale = await request.post('/api/login', {
				data: { username: 'admin', password: TEST_ADMIN.password }
			});
			expect(stale.status()).toBe(401);
		} finally {
			await resetAdminPassword(request, replacement);
		}
	});

	test('cannot delete the legacy admin while NUXT_PASSWORD is set', async ({ request }) => {
		// create a second admin so we can attempt to delete the seeded one without tripping the
		// "cannot delete yourself" guard
		await loginViaApi(request);
		const secondUsername = `legacy${Date.now()}`;
		const secondPassword = 'legacy-admin-pw-12345';
		const create = await request.post('/api/admin/users', {
			data: {
				username: secondUsername,
				displayName: 'Second admin',
				password: secondPassword,
				role: 'administrator'
			}
		});
		if (!create.ok()) test.skip(true, `could not create second admin: ${await create.text()}`);
		const { id: secondId } = await create.json();

		// re-login as the second admin, then attempt to delete the legacy admin
		const secondCtx = await request.post('/api/login', {
			data: { username: secondUsername, password: secondPassword }
		});
		expect(secondCtx.ok()).toBe(true);
		const list = await (await request.get('/api/admin/users')).json();
		const adminUser = list.find((u: any) => u.username === 'admin');
		const res = await request.delete(`/api/admin/users/${adminUser.id}`);
		expect(res.status()).toBe(400);
		expect((await res.json()).statusMessage).toMatch(/NUXT_PASSWORD|legacy/i);

		// cleanup
		await request.post('/api/login', { data: { username: 'admin', password: 'adminpass' } });
		await request.delete(`/api/admin/users/${secondId}`);
	});
});
