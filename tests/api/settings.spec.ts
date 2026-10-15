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

	test('rejects over-long description, bio and author', async ({ request }) => {
		await loginViaApi(request);
		for (const data of [
			{ description: 'x'.repeat(161) },
			{ bio: 'x'.repeat(501) },
			{ author: 'x'.repeat(51) }
		]) {
			const res = await request.post('/api/settings', { data });
			expect(res.status(), JSON.stringify(data).slice(0, 40)).toBe(400);
		}
	});

	test('rejects a website without a scheme, a bad Discord link and a bad support email', async ({
		request
	}) => {
		await loginViaApi(request);
		for (const data of [
			{ website: 'example.com' },
			{ discord: 'https://example.com/not-discord' },
			{ supportEmail: 'not-an-email' },
			{ supportEmail: `${'a'.repeat(250)}@example.com` }
		]) {
			const res = await request.post('/api/settings', { data });
			expect(res.status(), JSON.stringify(data).slice(0, 40)).toBe(400);
		}
	});

	test('social profile URLs are reduced to the handle', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.post('/api/settings', {
			data: {
				github: 'https://www.github.com/gmitch215',
				twitter: 'https://x.com/gmitch215',
				instagram: 'https://instagram.com/gmitch215',
				patreon: 'https://www.patreon.com/gmitch215'
			}
		});
		expect(res.ok()).toBe(true);
		const settings = await (await request.get('/api/settings')).json();
		expect(settings).toMatchObject({
			github: 'gmitch215',
			twitter: 'gmitch215',
			instagram: 'gmitch215',
			patreon: 'gmitch215'
		});
	});

	test('the URL style must be dated or slug and is returned once saved', async ({ request }) => {
		await loginViaApi(request);
		expect((await request.post('/api/settings', { data: { urlStyle: 'weird' } })).status()).toBe(
			400
		);

		await request.post('/api/settings', { data: { urlStyle: 'slug' } });
		expect((await (await request.get('/api/settings')).json()).urlStyle).toBe('slug');
		await request.post('/api/settings', { data: { urlStyle: 'dated' } });
		expect((await (await request.get('/api/settings')).json()).urlStyle).toBe('dated');
	});

	test('validates the site banner message', async ({ request }) => {
		await loginViaApi(request);
		const ok = { text: 'Maintenance tonight', ttl: 0, type: 'info' };
		for (const message of [
			{ ...ok, text: 'x'.repeat(301) },
			{ ...ok, link: `https://example.com/${'a'.repeat(200)}` },
			{ ...ok, icon: 'x'.repeat(101) },
			{ ...ok, type: 'loud' },
			{ ...ok, ttl: -1 },
			{ ...ok, ttl: 60 * 60 * 24 * 15 }
		]) {
			const res = await request.post('/api/settings', { data: { message } });
			expect(res.status(), JSON.stringify(message).slice(0, 50)).toBe(400);
		}
	});

	test('rejects values that are not text instead of storing them', async ({ request }) => {
		await loginViaApi(request);
		for (const data of [
			{ name: 5 },
			{ name: { length: 1 } },
			{ github: ['gmitch215'] },
			{ supportEmail: 12 },
			{ message: 'hello' },
			{ message: ['hello'] },
			{ message: { text: 'Hi', type: 'info', ttl: '5' } },
			{ message: { text: 42, type: 'info', ttl: 0 } }
		]) {
			const res = await request.post('/api/settings', { data });
			expect(res.status(), JSON.stringify(data)).toBe(400);
		}
		const shown = await (await request.get('/api/settings')).json();
		expect(typeof shown.name).toBe('string');
	});

	test('a rejected update saves none of its fields', async ({ request }) => {
		await loginViaApi(request);
		const before = await (await request.get('/api/settings')).json();
		const res = await request.post('/api/settings', {
			data: { name: `Never Saved ${Date.now()}`, bio: 'never saved', themeColor: 'not-a-hex' }
		});
		expect(res.status()).toBe(400);
		const after = await (await request.get('/api/settings')).json();
		expect(after.name).toBe(before.name);
		expect(after.bio).toBe(before.bio);
	});

	test('a numeric site name reads back as text', async ({ request }) => {
		await loginViaApi(request);
		const before = await (await request.get('/api/settings')).json();
		try {
			expect((await request.post('/api/settings', { data: { name: '2026' } })).ok()).toBe(true);
			const shown = await (await request.get('/api/settings')).json();
			expect(shown.name).toBe('2026');
		} finally {
			await request.post('/api/settings', { data: { name: before.name } });
		}
	});

	test('the banner link must be an http or https URL', async ({ request }) => {
		await loginViaApi(request);
		const ok = { text: 'Maintenance tonight', ttl: 0, type: 'info' };
		for (const link of [
			'javascript:alert(1)',
			'ftp://example.com/x',
			'//example.com',
			'/relative'
		]) {
			const res = await request.post('/api/settings', { data: { message: { ...ok, link } } });
			expect(res.status(), link).toBe(400);
		}
		const good = await request.post('/api/settings', {
			data: { message: { ...ok, link: 'https://example.com/status' } }
		});
		expect(good.ok()).toBe(true);
		await request.post('/api/settings', { data: { message: { ...ok, text: ' ' } } });
	});

	test('a banner message with a TTL is returned until it expires', async ({ request }) => {
		await loginViaApi(request);
		const before = await (await request.get('/api/settings')).json();
		const res = await request.post('/api/settings', {
			data: { message: { text: 'Short lived banner', ttl: 2, type: 'warning', icon: 'mdi:alert' } }
		});
		expect(res.ok()).toBe(true);
		const shown = await (await request.get('/api/settings')).json();
		expect(shown.message).toMatchObject({ text: 'Short lived banner', type: 'warning' });
		expect(before).toHaveProperty('message');
	});

	test('an external favicon is proxied with long-lived cache headers', async ({ request }) => {
		await loginViaApi(request);
		const origin = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8787';
		try {
			await request.post('/api/settings', {
				data: { faviconPng: `${origin}/_favicon.png`, favicon: `${origin}/_favicon.png` }
			});
			const png = await request.get('/favicon.png', { maxRedirects: 0 });
			expect(png.status()).toBe(200);
			expect(png.headers()['content-type']).toMatch(/^image\//);
			expect(png.headers()['cache-control']).toContain('max-age=604800');

			const ico = await request.get('/favicon.ico', { maxRedirects: 0 });
			expect(ico.status()).toBe(200);

			await request.post('/api/settings', {
				data: { faviconPng: `${origin}/definitely-missing-icon.png` }
			});
			const missing = await request.get('/favicon.png', { maxRedirects: 0 });
			expect(missing.status()).toBe(404);
		} finally {
			await request.post('/api/settings', {
				data: { favicon: '/_favicon.ico', faviconPng: '/_favicon.png' }
			});
		}
	});

	test('a same-origin favicon path redirects instead of proxying', async ({ request }) => {
		await loginViaApi(request);
		try {
			await request.post('/api/settings', { data: { faviconPng: '/_favicon.png' } });
			const res = await request.get('/favicon.png', { maxRedirects: 0 });
			expect(res.status()).toBe(301);
			expect(res.headers().location).toBe('/_favicon.png');
		} finally {
			await request.post('/api/settings', { data: { favicon: '/_favicon.ico' } });
		}
	});

	test('blank banner text clears the banner and missing text is rejected', async ({ request }) => {
		await loginViaApi(request);
		await request.post('/api/settings', {
			data: { message: { text: 'Banner to clear', ttl: 0, type: 'info' } }
		});
		expect((await (await request.get('/api/settings')).json()).message?.text).toBe(
			'Banner to clear'
		);

		const clear = await request.post('/api/settings', {
			data: { message: { text: '  ', ttl: 0, type: 'info' } }
		});
		expect(clear.ok()).toBe(true);
		expect((await (await request.get('/api/settings')).json()).message).toBeNull();

		const missing = await request.post('/api/settings', {
			data: { message: { ttl: 0, type: 'info' } }
		});
		expect(missing.status()).toBe(400);
	});
});
