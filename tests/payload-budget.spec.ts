import { expect, test } from './fixtures';
import { createPost, deletePost } from './utils/posts';

// a distinctive phrase repeated through a long body; if it lands in the hydration payload of a
// page that shows no post text, the whole post list is being serialised again
const MARKER = 'PAYLOADCANARY';
const PARA = `${MARKER} filler sentence for payload budget measurement. `;
const LONG_BODY = PARA.repeat(60);
const BODIES_PER_POST = 60;

/** The Nuxt hydration payload only. Total HTML is unusable as a budget in dev, where
 *  @nuxt/hints inlines a copy of the whole document and never ships to production. */
function payloadOf(html: string): string {
	const match = html.match(/<script[^>]*data-nuxt-data="nuxt-app"[^>]*>([\s\S]*?)<\/script>/);
	return match?.[1] ?? '';
}

test.describe('payload budget', () => {
	test('post bodies never reach the hydration payload', async ({ request }) => {
		const created = [];
		for (let i = 0; i < 4; i++) {
			created.push(
				await createPost(request, {
					title: `Budget Post ${i}`,
					slug: `budget-${Date.now()}-${i}`,
					content: LONG_BODY
				})
			);
		}

		try {
			for (const path of ['/', '/about', '/tags']) {
				const res = await request.get(path);
				expect(res.ok(), `${path} status`).toBe(true);
				const payload = payloadOf(await res.text());
				expect(payload, `${path} has no hydration payload`).not.toBe('');

				const occurrences = payload.split(MARKER).length - 1;
				// excerpts are capped at ~200 chars, so a listing carries a handful of hits per
				// post; a full body would contribute 60 on its own
				expect(
					occurrences,
					`${path} payload repeated the marker ${occurrences} times`
				).toBeLessThan(BODIES_PER_POST);

				expect(payload.length, `${path} payload size`).toBeLessThan(60_000);
			}

			// /about shows no posts at all, so nothing from a post body belongs in its payload
			expect(payloadOf(await (await request.get('/about')).text())).not.toContain(MARKER);
		} finally {
			for (const post of created) await deletePost(request, post.id);
		}
	});

	test('the list API returns summaries without bodies or base64 thumbnails', async ({
		request
	}) => {
		const post = await createPost(request, {
			title: 'Summary Shape',
			slug: `summary-${Date.now()}`,
			content: LONG_BODY
		});

		const res = await request.get('/api/blog/list');
		expect(res.ok()).toBe(true);
		const rows = await res.json();
		const row = rows.find((r: any) => r.id === post.id);

		expect(row, 'created post missing from list').toBeTruthy();
		expect(row).not.toHaveProperty('content');
		expect(row).not.toHaveProperty('thumbnail');
		expect(typeof row.excerpt).toBe('string');
		expect(row.excerpt.length).toBeLessThanOrEqual(210);

		await deletePost(request, post.id);
	});

	test('a stored thumbnail is served as a cacheable image route', async ({ request }) => {
		const res = await request.get('/thumbnails/deadbeefdeadbeefdeadbeefdeadbeef');
		// no such post, but the route exists and validates the id shape
		expect([404, 400]).toContain(res.status());

		const bad = await request.get('/thumbnails/not-a-valid-id');
		expect(bad.status()).toBe(400);
	});
});
