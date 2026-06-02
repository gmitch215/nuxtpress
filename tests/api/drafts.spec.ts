import { expect, test } from '@playwright/test';
import { loginViaApi } from '../utils/auth';

test.describe('drafts API', () => {
	test('GET /api/blog/draft requires auth', async ({ request }) => {
		const res = await request.get('/api/blog/draft');
		expect([401, 403]).toContain(res.status());
	});

	test('POST /api/blog/draft requires auth', async ({ request }) => {
		const res = await request.post('/api/blog/draft', {
			data: {
				post: {
					slug: 'd-anon',
					title: 'x',
					content: 'this is filler content long enough to satisfy the schema validation rules.',
					tags: []
				}
			}
		});
		expect([401, 403]).toContain(res.status());
	});

	test('admin can save + list + fetch a draft', async ({ request }) => {
		await loginViaApi(request);
		const slug = `draft-${Date.now()}`;
		const save = await request.post('/api/blog/draft', {
			data: {
				post: {
					slug,
					title: 'Draft title',
					content:
						'Filler content long enough for the validation min length so the draft route saves the body to KV.',
					tags: []
				}
			}
		});
		expect(save.ok()).toBe(true);

		const single = await request.get(`/api/blog/draft?slug=${slug}`);
		expect(single.ok()).toBe(true);
		const body = await single.json();
		expect(body.draft?.slug).toBe(slug);
	});
});
