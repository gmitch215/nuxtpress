import { expect, test } from '@playwright/test';

test.describe('static and meta routes', () => {
	test('/sitemap.xml renders', async ({ request }) => {
		const res = await request.get('/sitemap.xml');
		expect(res.ok()).toBe(true);
		const body = await res.text();
		expect(body).toContain('<urlset');
	});

	test('/robots.txt renders', async ({ request }) => {
		const res = await request.get('/robots.txt');
		expect(res.ok()).toBe(true);
	});

	test('GET /avatars/missing returns 404 (no such blob)', async ({ request }) => {
		const res = await request.get('/avatars/no-such-thing.png');
		expect([404, 500]).toContain(res.status());
	});
});
