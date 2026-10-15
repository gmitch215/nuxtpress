import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { pngDataUrl } from '../utils/png';
import { createPost, deletePost } from '../utils/posts';

const BODY = 'A post body that is long enough to pass the schema minimum for content length.';
const png = pngDataUrl();

async function createRaw(request: any, post: Record<string, unknown>) {
	await loginViaApi(request);
	return request.post('/api/blog/create', {
		data: { post: { title: 'Image post', content: BODY, tags: [], ...post } }
	});
}

test.describe('inline images in posts', () => {
	test('a small image data URL is accepted and stored in the body', async ({ request }) => {
		const post = await createPost(request, {
			title: 'Inline image',
			slug: `inline-${Date.now()}`,
			content: `${BODY}\n\n![pixel](${png})`
		});
		const d = new Date(post.created_at);
		const found = await (
			await request.get('/api/blog/find', {
				params: {
					slug: post.slug,
					year: d.getUTCFullYear(),
					month: d.getUTCMonth() + 1,
					day: d.getUTCDate()
				}
			})
		).json();
		expect(found.content).toContain(png);
		await deletePost(request, post.id);
	});

	test('rejects an oversized image, an SVG and a non-image data URL', async ({ request }) => {
		const oversized = `data:image/png;base64,${'A'.repeat(400_000)}`;
		const svg = 'data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Pjwvc2NyaXB0Pjwvc3ZnPg==';
		const html = 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==';

		for (const src of [oversized, svg, html]) {
			const res = await createRaw(request, {
				slug: `bad-img-${Date.now()}`,
				content: `${BODY}\n\n![bad](${src})`
			});
			expect(res.status(), src.slice(0, 30)).toBe(400);
		}
	});

	test('the post page keeps an image data URL and drops other data URLs', async ({ request }) => {
		const slug = `render-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Render image',
			slug,
			content: `${BODY}\n\n![pixel](${png})\n\n<img src="data:text/html;base64,PHNjcmlwdD4=" alt="evil">\n\n<a href="data:text/html;base64,PHNjcmlwdD4=">link</a>`
		});

		// the hydration payload carries the raw markdown, so only the rendered markup is checked
		const html = (await (await request.get(`/${slug}`)).text()).replace(
			/<script[\s\S]*?<\/script>/g,
			''
		);
		expect(html).toContain('src="data:image/png;base64,');
		expect(html).not.toContain('data:text/html');
		await deletePost(request, post.id);
	});

	test('the feed leaves inline image data out of entries', async ({ request }) => {
		const slug = `feed-img-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Feed image',
			slug,
			content: `${BODY}\n\n![pixel](${png})`
		});
		await request.get('/api/blog/list');
		const feed = await (await request.get('/feed.xml')).text();
		expect(feed).toContain('Feed image');
		expect(feed).not.toContain('data:image/png');
		await deletePost(request, post.id);
	});

	test('reserved slugs are refused', async ({ request }) => {
		for (const slug of ['about', 'admin', 'tags', 'unsubscribe', 'subscribe']) {
			const res = await createRaw(request, { slug });
			expect(res.status(), slug).toBe(400);
		}
	});
});

test.describe('uploaded thumbnails', () => {
	test('a data URL thumbnail is served from its route and never inlined in the list', async ({
		request
	}) => {
		const post = await createPost(request, {
			title: 'Uploaded thumbnail',
			slug: `thumb-${Date.now()}`,
			thumbnail_url: png,
			content: BODY
		});

		const list = await (await request.get('/api/blog/list')).text();
		expect(list).not.toContain('data:image');
		const summary = JSON.parse(list).find((p: any) => p.id === post.id);
		expect(summary.thumbnail_url).toBe(`/thumbnails/${post.id}`);

		const res = await request.get(`/thumbnails/${post.id}`);
		expect(res.ok()).toBe(true);
		expect(res.headers()['content-type']).toBe('image/png');
		expect(res.headers()['x-content-type-options']).toBe('nosniff');
		expect((await res.body()).subarray(0, 4).toString('hex')).toBe('89504e47');

		const d = new Date(post.created_at);
		const found = await (
			await request.get('/api/blog/find', {
				params: {
					slug: post.slug,
					year: d.getUTCFullYear(),
					month: d.getUTCMonth() + 1,
					day: d.getUTCDate()
				}
			})
		).json();
		expect(found.thumbnail_url).toBe(`/thumbnails/${post.id}`);
		await deletePost(request, post.id);
	});

	test('editing a post keeps its uploaded thumbnail when the form echoes the route back', async ({
		request
	}) => {
		const post = await createPost(request, {
			title: 'Keep thumbnail',
			slug: `keep-thumb-${Date.now()}`,
			thumbnail_url: png,
			content: BODY
		});

		const update = await request.patch('/api/blog/update', {
			data: {
				post: {
					id: post.id,
					title: 'Keep thumbnail renamed',
					slug: post.slug,
					content: BODY,
					thumbnail_url: `/thumbnails/${post.id}`,
					tags: []
				}
			}
		});
		expect(update.ok()).toBe(true);
		expect((await request.get(`/thumbnails/${post.id}`)).ok()).toBe(true);

		const cleared = await request.patch('/api/blog/update', {
			data: {
				post: {
					id: post.id,
					title: 'Cleared',
					slug: post.slug,
					content: BODY,
					thumbnail_url: '',
					tags: []
				}
			}
		});
		expect(cleared.ok()).toBe(true);
		expect((await request.get(`/thumbnails/${post.id}`)).status()).toBe(404);
		await deletePost(request, post.id);
	});

	test('rejects an oversized or non-image thumbnail and accepts an https URL', async ({
		request
	}) => {
		for (const thumbnail_url of [
			`data:image/png;base64,${'A'.repeat(400_000)}`,
			'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
			'not a url'
		]) {
			const res = await createRaw(request, { slug: `bad-thumb-${Date.now()}`, thumbnail_url });
			expect(res.status(), thumbnail_url.slice(0, 30)).toBe(400);
		}
		const ok = await createPost(request, {
			title: 'Remote thumbnail',
			slug: `remote-thumb-${Date.now()}`,
			thumbnail_url: 'https://example.com/image.png',
			content: BODY
		});
		await deletePost(request, ok.id);
	});
});

test.describe('thumbnail route', () => {
	test('rejects a malformed id and a post without a thumbnail', async ({ request }) => {
		expect((await request.get('/thumbnails/not-an-id')).status()).toBe(400);
		expect((await request.get(`/thumbnails/${'0'.repeat(32)}`)).status()).toBe(404);

		const post = await createPost(request, {
			title: 'No thumbnail',
			slug: `no-thumb-${Date.now()}`,
			content: BODY
		});
		expect((await request.get(`/thumbnails/${post.id}`)).status()).toBe(404);
		await deletePost(request, post.id);
	});

	test('a stored binary thumbnail is sniffed and served with its type', async ({ request }) => {
		await loginViaApi(request);
		const cases: [number[], string][] = [
			[[0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0], 'image/png'],
			[[0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0], 'image/jpeg'],
			[[0x47, 0x49, 0x46, 0x38, 0, 0, 0, 0, 0, 0, 0, 0], 'image/gif'],
			[[0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50], 'image/webp'],
			[[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'application/octet-stream']
		];
		for (const [bytes, type] of cases) {
			const res = await createRaw(request, {
				slug: `blob-thumb-${Date.now()}-${bytes[0]}`,
				thumbnail: bytes
			});
			expect(res.ok()).toBe(true);
			const created = await res.json();
			const served = await request.get(`/thumbnails/${created.id}`);
			expect(served.headers()['content-type'], type).toBe(type);
			expect(served.headers().etag).toContain(created.id);
			await deletePost(request, created.id);
		}
	});
});

test.describe('uploaded favicons', () => {
	test.afterEach(async ({ request }) => {
		await loginViaApi(request);
		await request.post('/api/settings', {
			data: { favicon: '/_favicon.ico', faviconPng: '/_favicon.png' }
		});
	});

	test('a PNG upload is served from /favicon.png and kept out of the settings payload', async ({
		request
	}) => {
		await loginViaApi(request);
		const res = await request.post('/api/settings', { data: { faviconPng: png } });
		expect(res.ok()).toBe(true);

		const settings = await (await request.get('/api/settings')).json();
		expect(settings.faviconPng).toBe('/favicon.png');
		expect(JSON.stringify(settings)).not.toContain('data:image');

		const icon = await request.get('/favicon.png', { maxRedirects: 0 });
		expect(icon.status()).toBe(200);
		expect(icon.headers()['content-type']).toBe('image/png');
		expect(icon.headers()['x-content-type-options']).toBe('nosniff');

		const echo = await request.post('/api/settings', { data: { faviconPng: '/favicon.png' } });
		expect(echo.ok()).toBe(true);
		const still = await request.get('/favicon.png', { maxRedirects: 0 });
		expect(still.status()).toBe(200);
	});

	test('an ICO upload is accepted for the ico favicon only', async ({ request }) => {
		await loginViaApi(request);
		const ico = `data:image/x-icon;base64,${Buffer.alloc(64).toString('base64')}`;
		expect((await request.post('/api/settings', { data: { favicon: ico } })).ok()).toBe(true);
		const icon = await request.get('/favicon.ico', { maxRedirects: 0 });
		expect(icon.status()).toBe(200);
		expect(icon.headers()['content-type']).toBe('image/x-icon');

		const asPng = await request.post('/api/settings', { data: { faviconPng: ico } });
		expect(asPng.status()).toBe(400);
	});

	test('rejects SVG, HTML, oversized and malformed favicon uploads', async ({ request }) => {
		await loginViaApi(request);
		for (const data of [
			{ favicon: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' },
			{ faviconPng: 'data:text/html;base64,PGgxPmhpPC9oMT4=' },
			{ faviconPng: `data:image/png;base64,${'A'.repeat(400_000)}` },
			{ favicon: 'data:image/png;base64,not base64!!' },
			{ favicon: 'javascript:alert(1)' }
		]) {
			const res = await request.post('/api/settings', { data });
			expect(res.status(), JSON.stringify(data).slice(0, 60)).toBe(400);
		}
	});

	test('a stored upload that cannot be decoded falls back instead of failing', async ({
		request
	}) => {
		await loginViaApi(request);
		const res = await request.post('/api/settings', {
			data: { faviconPng: 'data:image/png;base64,AAAA' }
		});
		expect(res.ok()).toBe(true);
		const icon = await request.get('/favicon.png', { maxRedirects: 0 });
		expect(icon.status()).toBe(200);
	});
});
