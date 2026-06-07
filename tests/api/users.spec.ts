import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { createUser, deleteUser } from '../utils/users';

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

	test('PATCH /api/users/me lets a user change their own password', async ({ request }) => {
		const user = await createUser(request);
		try {
			await loginViaApi(request, { username: user.username, password: user.password });
			const newPw = 'something-new-and-strong-pw';
			const res = await request.patch('/api/users/me', {
				data: { currentPassword: user.password, newPassword: newPw }
			});
			expect(res.ok()).toBe(true);

			// the new password works and the old one no longer does (no env fallback for non-admins)
			await loginViaApi(request, { username: user.username, password: newPw });
			const stale = await request.post('/api/login', {
				data: { username: user.username, password: user.password }
			});
			expect(stale.status()).toBe(401);

			// wrong current password is rejected
			const wrong = await request.patch('/api/users/me', {
				data: { currentPassword: 'not-the-password', newPassword: 'whatever-else-123' }
			});
			expect(wrong.status()).toBe(401);
		} finally {
			await deleteUser(request, user.id);
		}
	});
});
