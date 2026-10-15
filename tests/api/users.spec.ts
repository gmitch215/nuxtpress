import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { makePng } from '../utils/png';
import { deletePost } from '../utils/posts';
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

test.describe('avatar API', () => {
	const avatar = (name: string, mimeType: string, buffer: Buffer) => ({
		multipart: { file: { name, mimeType, buffer } }
	});

	test('upload and delete require a signed-in user', async ({ request }) => {
		const up = await request.post(
			'/api/users/me/avatar',
			avatar('a.png', 'image/png', makePng(8, 8))
		);
		expect([401, 403]).toContain(up.status());
		const del = await request.delete('/api/users/me/avatar');
		expect([401, 403]).toContain(del.status());
	});

	test('an uploaded avatar is served, replaced and removed', async ({ request }) => {
		const user = await createUser(request);
		try {
			await loginViaApi(request, user);
			const first = await request.post(
				'/api/users/me/avatar',
				avatar('one.png', 'image/png', makePng(16, 16))
			);
			expect(first.ok()).toBe(true);
			const { pathname: firstPath } = await first.json();
			expect(firstPath).toContain(`avatars/${user.id}`);

			const served = await request.get(`/avatars/${encodeURIComponent(firstPath)}`);
			expect(served.ok()).toBe(true);
			expect(served.headers()['cache-control']).toContain('max-age=86400');

			const profile = await (await request.get(`/api/users/${user.username}`)).json();
			expect(profile.author.avatarPathname).toBe(firstPath);

			const second = await request.post(
				'/api/users/me/avatar',
				avatar('two.png', 'image/png', makePng(24, 24))
			);
			const { pathname: secondPath } = await second.json();
			expect(secondPath).not.toBe(firstPath);
			expect((await request.get(`/avatars/${encodeURIComponent(firstPath)}`)).ok()).toBe(false);

			expect((await request.delete('/api/users/me/avatar')).ok()).toBe(true);
			expect((await request.delete('/api/users/me/avatar')).ok()).toBe(true);
			const after = await (await request.get(`/api/users/${user.username}`)).json();
			expect(after.author.avatarPathname).toBeNull();
		} finally {
			await deleteUser(request, user.id);
		}
	});

	test('rejects a missing file, a non-image and an oversized image', async ({ request }) => {
		const user = await createUser(request);
		try {
			await loginViaApi(request, user);
			const none = await request.post('/api/users/me/avatar', {
				multipart: { note: 'no file here' }
			});
			expect(none.status()).toBe(400);

			const text = await request.post(
				'/api/users/me/avatar',
				avatar('x.txt', 'text/plain', Buffer.from('not an image'))
			);
			expect(text.ok()).toBe(false);

			const big = await request.post(
				'/api/users/me/avatar',
				avatar('big.png', 'image/png', Buffer.alloc(3 * 1024 * 1024, 1))
			);
			expect(big.ok()).toBe(false);
		} finally {
			await deleteUser(request, user.id);
		}
	});

	test('serving an avatar that does not exist is a 404', async ({ request }) => {
		const res = await request.get('/avatars/avatars%2Fnobody%2Fmissing.png');
		expect(res.status()).toBe(404);
	});
});

test.describe('author changes reach cached posts', () => {
	async function findPost(request: any, post: { slug: string; created_at: string }) {
		const d = new Date(post.created_at);
		return (
			await request.get('/api/blog/find', {
				params: {
					slug: post.slug,
					year: d.getUTCFullYear(),
					month: d.getUTCMonth() + 1,
					day: d.getUTCDate()
				}
			})
		).json();
	}

	async function authoredPost(request: any, user: { username: string; password: string }) {
		await loginViaApi(request, user);
		const res = await request.post('/api/blog/create', {
			data: {
				post: {
					title: 'Author cache post',
					slug: `author-cache-${Date.now()}`,
					content: 'A post used to check that author profile edits are not hidden by caches.',
					tags: []
				}
			}
		});
		expect(res.ok()).toBe(true);
		return res.json();
	}

	test('a display name and avatar change show on the post and the list straight away', async ({
		request
	}) => {
		const user = await createUser(request);
		let postId = '';
		try {
			const post = await authoredPost(request, user);
			postId = post.id;
			expect((await findPost(request, post)).author.displayName).toBe('Temp User');
			await request.get('/api/blog/list');

			await request.patch('/api/users/me', { data: { displayName: 'Renamed Author' } });
			expect((await findPost(request, post)).author.displayName).toBe('Renamed Author');
			const listed = (await (await request.get('/api/blog/list')).json()).find(
				(p: any) => p.id === post.id
			);
			expect(listed.author.displayName).toBe('Renamed Author');

			const up = await request.post('/api/users/me/avatar', {
				multipart: { file: { name: 'a.png', mimeType: 'image/png', buffer: makePng(8, 8) } }
			});
			const { pathname } = await up.json();
			expect((await findPost(request, post)).author.avatarPathname).toBe(pathname);
			await request.delete('/api/users/me/avatar');
			expect((await findPost(request, post)).author.avatarPathname).toBeNull();
		} finally {
			await loginViaApi(request);
			if (postId) await deletePost(request, postId);
			await deleteUser(request, user.id);
		}
	});

	test('an admin edit and a user deletion are reflected on cached posts', async ({ request }) => {
		const user = await createUser(request);
		const post = await authoredPost(request, user);
		try {
			await findPost(request, post);
			await loginViaApi(request);
			await request.patch(`/api/admin/users/${user.id}`, {
				data: { displayName: 'Admin Renamed' }
			});
			expect((await findPost(request, post)).author.displayName).toBe('Admin Renamed');

			await deleteUser(request, user.id);
			const after = await findPost(request, post);
			expect(after.author.username).toBe('admin');
		} finally {
			await loginViaApi(request);
			await deletePost(request, post.id);
			await deleteUser(request, user.id);
		}
	});
});
