import { expect, test } from '@playwright/test';
import { loginViaApi } from '../utils/auth';

test.describe('blog API', () => {
	test('GET /api/blog/list is public and returns array', async ({ request }) => {
		const res = await request.get('/api/blog/list');
		expect(res.ok()).toBe(true);
		expect(Array.isArray(await res.json())).toBe(true);
	});

	test('POST /api/blog/create requires auth', async ({ request }) => {
		const res = await request.post('/api/blog/create', {
			data: {
				post: {
					title: 'Should Reject',
					slug: 'should-reject-anon',
					content: 'Content used to verify anonymous create attempts get a 401 from the API.',
					tags: []
				}
			}
		});
		expect([401, 403]).toContain(res.status());
	});

	test('full create -> find -> list -> delete lifecycle (admin)', async ({ request }) => {
		await loginViaApi(request);

		const slug = `api-life-${Date.now()}`;
		const create = await request.post('/api/blog/create', {
			data: {
				post: {
					title: 'API lifecycle post',
					slug,
					content:
						'A post used to verify the create/find/list/delete cycle returns the expected shapes and the authorId is set automatically.',
					tags: ['api', 'test']
				}
			}
		});
		expect(create.ok()).toBe(true);
		const created = await create.json();
		expect(created.id).toBeTruthy();
		expect(created.slug).toBe(slug);

		const d = new Date(created.created_at);
		const find = await request.get('/api/blog/find', {
			params: {
				slug,
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: d.getUTCDate()
			}
		});
		expect(find.ok()).toBe(true);
		const found = await find.json();
		expect(found.title).toBe('API lifecycle post');
		expect(found.author_id).toBeTruthy();
		expect(found.author?.username).toBe('admin');

		const list = await request.get('/api/blog/list');
		const all = await list.json();
		expect(all.find((p: any) => p.slug === slug)).toBeTruthy();

		const del = await request.delete(`/api/blog/remove?id=${created.id}`);
		expect(del.ok()).toBe(true);
	});

	test('GET /api/blog/find returns 404 for unknown slug', async ({ request }) => {
		const d = new Date();
		const res = await request.get('/api/blog/find', {
			params: {
				slug: 'definitely-not-here',
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: d.getUTCDate()
			}
		});
		expect(res.status()).toBe(404);
	});

	test('GET /api/blog/find rejects invalid date', async ({ request }) => {
		const res = await request.get('/api/blog/find', {
			params: { slug: 'whatever', year: 'notanumber', month: 99, day: 99 }
		});
		expect(res.status()).toBe(400);
	});

	test('PATCH /api/blog/update requires auth', async ({ request }) => {
		const res = await request.patch('/api/blog/update', {
			data: { post: { id: 'x', title: 'a', slug: 'a', content: 'a', tags: [] } }
		});
		expect([401, 403]).toContain(res.status());
	});

	test('DELETE /api/blog/remove requires id', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.delete('/api/blog/remove');
		expect(res.status()).toBe(400);
	});
});
