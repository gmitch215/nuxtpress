import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { createUser, deleteUser } from '../utils/users';

const KV_DIR = join(process.env.NUXTPRESS_DATA_DIR || '.data-test', 'kv');

const BODY =
	'Filler content long enough for the validation min length so the draft route saves the body to KV.';

const draftOf = (slug: string, extra: Record<string, unknown> = {}) => ({
	post: { slug, title: `Draft ${slug}`, content: BODY, tags: [], ...extra }
});

async function listed(request: Parameters<typeof loginViaApi>[0]): Promise<string[]> {
	const { drafts } = await (await request.get('/api/blog/draft')).json();
	return drafts.map((d: { slug: string }) => d.slug);
}

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

	test('fetching a draft that does not exist is a 404', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.get(`/api/blog/draft?slug=missing-${Date.now()}`);
		expect(res.status()).toBe(404);
	});

	test('a slug that cannot exist is a 404 and never reaches the store', async ({ request }) => {
		await loginViaApi(request);
		for (const slug of ['%00', 'a%2Fb', '..%2Fx', 'UPPER', 'a%3Ab']) {
			const res = await request.get(`/api/blog/draft?slug=${slug}`);
			expect(res.status(), slug).toBe(404);
		}
	});

	test('the draft list returns every saved draft', async ({ request }) => {
		await loginViaApi(request);
		const stamp = Date.now();
		const slugs = [`list-a-${stamp}`, `list-b-${stamp}`, `list-c-${stamp}`];
		for (const slug of slugs) {
			const save = await request.post('/api/blog/draft', {
				data: {
					post: {
						slug,
						title: `Draft ${slug}`,
						content:
							'Filler content long enough for the validation min length so the draft route saves the body to KV.',
						tags: []
					}
				}
			});
			expect(save.ok()).toBe(true);
		}

		const { drafts } = await (await request.get('/api/blog/draft')).json();
		const listed = drafts.map((d: { slug: string }) => d.slug);
		for (const slug of slugs) expect(listed).toContain(slug);
	});

	test('a blank slug is rejected instead of listing everything', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.get('/api/blog/draft?slug=%20');
		expect(res.status()).toBe(400);
	});

	test('a draft belongs to the author who saved it', async ({ request }) => {
		const stamp = Date.now();
		const adminSlug = `own-admin-${stamp}`;
		const authorSlug = `own-author-${stamp}`;

		await loginViaApi(request);
		expect((await request.post('/api/blog/draft', { data: draftOf(adminSlug) })).ok()).toBe(true);

		const author = await createUser(request);
		try {
			await loginViaApi(request, author);
			expect(await listed(request)).not.toContain(adminSlug);
			expect((await request.get(`/api/blog/draft?slug=${adminSlug}`)).status()).toBe(404);
			expect((await request.post('/api/blog/draft', { data: draftOf(adminSlug) })).status()).toBe(
				403
			);

			expect((await request.post('/api/blog/draft', { data: draftOf(authorSlug) })).ok()).toBe(
				true
			);
			expect(await listed(request)).toContain(authorSlug);
			const mine = await (await request.get(`/api/blog/draft?slug=${authorSlug}`)).json();
			expect(mine.draft).not.toHaveProperty('authorId');

			await loginViaApi(request);
			expect(await listed(request)).toContain(adminSlug);
			expect(await listed(request)).not.toContain(authorSlug);
			expect((await request.get(`/api/blog/draft?slug=${authorSlug}`)).status()).toBe(404);
			expect((await request.post('/api/blog/draft', { data: draftOf(authorSlug) })).status()).toBe(
				403
			);
		} finally {
			await deleteUser(request, author.id);
		}
	});

	test('the owner named in the request body is ignored', async ({ request }) => {
		const slug = `own-body-${Date.now()}`;
		await loginViaApi(request);
		expect(
			(
				await request.post('/api/blog/draft', {
					data: draftOf(slug, { authorId: 'someone-else' })
				})
			).ok()
		).toBe(true);

		const author = await createUser(request);
		try {
			await loginViaApi(request, author);
			expect((await request.get(`/api/blog/draft?slug=${slug}`)).status()).toBe(404);
			await loginViaApi(request);
			expect((await request.get(`/api/blog/draft?slug=${slug}`)).ok()).toBe(true);
		} finally {
			await deleteUser(request, author.id);
		}
	});

	test('drafts saved before owners were recorded go to the primary administrator', async ({
		request
	}) => {
		// the shape older installs wrote: no authorId at all
		const slug = `own-legacy-${Date.now()}`;
		const dir = join(KV_DIR, 'nuxtpress', 'blog_draft');
		await mkdir(dir, { recursive: true });
		await writeFile(join(dir, slug), JSON.stringify(draftOf(slug).post));

		const author = await createUser(request);
		try {
			await loginViaApi(request, author);
			expect(await listed(request)).not.toContain(slug);
			expect((await request.get(`/api/blog/draft?slug=${slug}`)).status()).toBe(404);
			expect((await request.post('/api/blog/draft', { data: draftOf(slug) })).status()).toBe(403);

			await loginViaApi(request);
			expect(await listed(request)).toContain(slug);
			expect((await request.get(`/api/blog/draft?slug=${slug}`)).ok()).toBe(true);

			// saving it claims it, and the author still cannot reach it
			expect((await request.post('/api/blog/draft', { data: draftOf(slug) })).ok()).toBe(true);
			await loginViaApi(request, author);
			expect(await listed(request)).not.toContain(slug);
			expect((await request.post('/api/blog/draft', { data: draftOf(slug) })).status()).toBe(403);
		} finally {
			await deleteUser(request, author.id);
		}
	});
});
