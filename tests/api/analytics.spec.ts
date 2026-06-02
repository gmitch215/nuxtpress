import { expect, test } from '@playwright/test';
import { loginViaApi } from '../utils/auth';

test.describe('analytics API', () => {
	test('POST /api/analytics/track returns 204 for valid payload', async ({ request }) => {
		const res = await request.post('/api/analytics/track', {
			data: {
				slug: 'test-track',
				active: 5000,
				depth: 75,
				referrer: 'direct',
				isExit: false
			}
		});
		expect([200, 204]).toContain(res.status());
	});

	test('POST /api/analytics/track silently drops invalid body (204)', async ({ request }) => {
		const res = await request.post('/api/analytics/track', { data: { nope: true } });
		expect([200, 204]).toContain(res.status());
	});

	test('GET /api/analytics/summary is admin-only', async ({ request }) => {
		const res = await request.get('/api/analytics/summary?range=7d');
		expect([401, 403]).toContain(res.status());
	});

	test('admin can read /api/analytics/summary for each range', async ({ request }) => {
		await loginViaApi(request);
		for (const range of ['7d', '30d', '90d', 'all']) {
			const res = await request.get(`/api/analytics/summary?range=${range}`);
			expect(res.ok(), `range ${range}`).toBe(true);
			const body = await res.json();
			expect(body).toHaveProperty('kpis');
			expect(body).toHaveProperty('perDay');
			expect(body).toHaveProperty('topPosts');
			expect(body.range).toBe(range);
		}
	});
});
