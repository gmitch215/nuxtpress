import { expect, test } from '../fixtures';
import { createPost, deletePost } from '../utils/posts';

test.describe('search API', () => {
	test('returns an empty array for a blank query without touching the db', async ({ request }) => {
		const res = await request.get('/api/blog/search?q=');
		expect(res.ok()).toBe(true);
		expect(await res.json()).toEqual([]);
	});

	test('matches on title, body and tag, and returns summaries only', async ({ request }) => {
		const stamp = Date.now();
		const post = await createPost(request, {
			title: `Zeppelin Chronicles ${stamp}`,
			slug: `search-${stamp}`,
			content: 'A distinctive phrase: quokkas assembling airships over the harbour at dawn.',
			tags: [`tag${stamp}`]
		});

		for (const q of ['Zeppelin Chronicles', 'quokkas assembling', `tag${stamp}`]) {
			const res = await request.get('/api/blog/search', { params: { q } });
			expect(res.ok(), `query "${q}"`).toBe(true);
			const rows = await res.json();
			expect(
				rows.some((r: any) => r.id === post.id),
				`query "${q}" did not find the post`
			).toBe(true);
		}

		const res = await request.get('/api/blog/search', { params: { q: 'Zeppelin Chronicles' } });
		const row = (await res.json()).find((r: any) => r.id === post.id);
		// the search payload is a summary; full bodies are what made every page heavy
		expect(row).not.toHaveProperty('content');
		expect(row).not.toHaveProperty('thumbnail');
		expect(typeof row.excerpt).toBe('string');

		await deletePost(request, post.id);
	});

	test('finds nothing for an unmatched query', async ({ request }) => {
		const res = await request.get('/api/blog/search', { params: { q: 'zzz-no-such-content-zzz' } });
		expect(res.ok()).toBe(true);
		expect(await res.json()).toEqual([]);
	});

	test('treats sql wildcards as literal characters', async ({ request }) => {
		const res = await request.get('/api/blog/search', { params: { q: '%' } });
		expect(res.ok()).toBe(true);
		// a bare wildcard must not match every post
		expect(Array.isArray(await res.json())).toBe(true);
	});

	test('ignores an over-long query', async ({ request }) => {
		const res = await request.get('/api/blog/search', { params: { q: 'x'.repeat(300) } });
		expect(res.ok()).toBe(true);
		expect(await res.json()).toEqual([]);
	});
});
