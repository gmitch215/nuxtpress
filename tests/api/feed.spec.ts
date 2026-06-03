import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { createPost, deletePost } from '../utils/posts';

test.describe('feed.xml', () => {
	test('returns 200 with Atom XML on an empty install', async ({ request }) => {
		const res = await request.get('/feed.xml');
		expect(res.ok(), `feed.xml status was ${res.status()}`).toBe(true);
		expect(res.headers()['content-type']).toMatch(/atom\+xml|xml/);
		const body = await res.text();
		expect(body).toContain('<?xml');
		expect(body).toContain('<feed');
		expect(body).toContain('</feed>');
	});

	test('includes a real post and its title escaped safely', async ({ request }) => {
		await loginViaApi(request);
		const slug = `feed-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Feed entry & test < safe >',
			slug,
			content:
				'Body content for the feed entry, long enough to clear validation and produce a stable feed render.',
			tags: ['feed', 'xml']
		});

		const res = await request.get('/feed.xml');
		expect(res.ok()).toBe(true);
		const body = await res.text();
		expect(body).toContain(slug);
		expect(body).toContain('Feed entry &amp; test');
		expect(body).not.toContain('<title>Feed entry & test');

		await deletePost(request, post.id);
	});

	test('Content-Length header is numeric-string when present', async ({ request }) => {
		const res = await request.get('/feed.xml');
		expect(res.ok()).toBe(true);
		const len = res.headers()['content-length'];
		if (len !== undefined) {
			expect(/^\d+$/.test(len)).toBe(true);
		}
	});
});
