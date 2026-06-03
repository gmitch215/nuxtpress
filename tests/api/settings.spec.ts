import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';

test.describe('settings API', () => {
	test('GET /api/settings is public', async ({ request }) => {
		const res = await request.get('/api/settings');
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body).toHaveProperty('name');
		expect(body).toHaveProperty('description');
	});

	test('POST /api/settings requires admin', async ({ request }) => {
		const res = await request.post('/api/settings', {
			data: { name: 'Anon Tried' }
		});
		expect([401, 403]).toContain(res.status());
	});

	test('POST /api/settings accepts a valid update from admin', async ({ request }) => {
		await loginViaApi(request);
		const before = await (await request.get('/api/settings')).json();
		const res = await request.post('/api/settings', {
			data: { name: `Blog Test ${Date.now()}` }
		});
		expect(res.ok()).toBe(true);
		// restore so downstream UI tests see a stable site name
		if (before?.name) {
			await request.post('/api/settings', { data: { name: before.name } });
		}
	});

	test('POST /api/settings rejects too-long name', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.post('/api/settings', {
			data: { name: 'x'.repeat(60) }
		});
		expect(res.status()).toBe(400);
	});

	test('POST /api/settings rejects bad theme color', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.post('/api/settings', {
			data: { themeColor: 'not-a-hex' }
		});
		expect(res.status()).toBe(400);
	});
});
