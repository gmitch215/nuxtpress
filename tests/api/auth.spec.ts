import { expect, test } from '../fixtures';
import { createUser, deleteUser } from '../utils/users';

const ADMIN_ROUTES: [method: 'get' | 'post' | 'patch' | 'delete', path: string][] = [
	['get', '/api/admin/users'],
	['post', '/api/admin/users'],
	['patch', '/api/admin/users/nobody'],
	['delete', '/api/admin/users/nobody'],
	['get', '/api/admin/subscribers'],
	['get', '/api/admin/subscribers/export'],
	['delete', '/api/admin/subscribers/nobody'],
	['get', '/api/admin/mail'],
	['post', '/api/admin/mail'],
	['post', '/api/admin/mail/test'],
	['post', '/api/admin/mail/drain'],
	['get', '/api/admin/mail/sink'],
	['delete', '/api/admin/mail/sink'],
	['get', '/api/analytics/summary'],
	['post', '/api/settings']
];

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

	test('a password-only login body is refused now that the legacy fallback is gone', async ({
		request
	}) => {
		const res = await request.post('/api/login', { data: { password: 'adminpass' } });
		expect(res.status()).toBe(400);
		const verify = await request.get('/api/verify');
		expect((await verify.json()).loggedIn).toBe(false);
	});

	test('the raw NUXT_PASSWORD value no longer authenticates on its own', async ({ request }) => {
		// the seeded admin still has this as a real hashed password, so it has to be the
		// stored hash that authorises the login rather than an env-var comparison
		const good = await request.post('/api/login', {
			data: { username: 'admin', password: 'adminpass' }
		});
		expect(good.ok()).toBe(true);

		const wrongUser = await request.post('/api/login', {
			data: { username: 'nobody-at-all', password: 'adminpass' }
		});
		expect(wrongUser.status()).toBe(401);
	});

	test('POST /api/logout clears session', async ({ request }) => {
		await request.post('/api/login', { data: { username: 'admin', password: 'adminpass' } });
		const out = await request.post('/api/logout');
		expect(out.ok()).toBe(true);
		const verify = await request.get('/api/verify');
		expect((await verify.json()).loggedIn).toBe(false);
	});

	test('every admin route refuses anonymous visitors and authors', async ({ request }) => {
		for (const [method, path] of ADMIN_ROUTES) {
			const res = await request[method](path);
			expect(res.status(), `anonymous ${method} ${path}`).toBe(403);
		}

		const author = await createUser(request);
		try {
			const login = await request.post('/api/login', {
				data: { username: author.username, password: author.password }
			});
			expect(login.ok()).toBe(true);
			for (const [method, path] of ADMIN_ROUTES) {
				const res = await request[method](path);
				expect(res.status(), `author ${method} ${path}`).toBe(403);
			}
		} finally {
			await deleteUser(request, author.id);
		}
	});
});
