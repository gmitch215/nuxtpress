import { expect, test } from './fixtures';
import { loginViaApi } from './utils/auth';
import { createPost, deletePost } from './utils/posts';

const BODY = 'Body content long enough to clear the schema floor for the slug URL test cases.';

async function setUrlStyle(request: any, urlStyle: 'dated' | 'slug') {
	await loginViaApi(request);
	const res = await request.post('/api/settings', { data: { urlStyle } });
	expect(res.ok(), `setting urlStyle=${urlStyle} failed: ${res.status()}`).toBe(true);
}

test.describe.configure({ mode: 'serial' });

test.describe('slug-only post URLs', () => {
	test.afterAll(async ({ request }) => {
		await setUrlStyle(request, 'dated');
	});

	test('both permalinks resolve, neither 404s', async ({ page, request }) => {
		const slug = `dual-${Date.now()}`;
		const post = await createPost(request, { title: 'Dual URL Post', slug, content: BODY });
		const d = new Date(post.created_at);
		const dated = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		for (const path of [dated, `/${slug}`]) {
			const res = await page.goto(path);
			expect(res?.status(), `${path} status`).toBe(200);
			await expect(page.getByRole('heading', { name: 'Dual URL Post', level: 1 })).toBeVisible();
		}

		await deletePost(request, post.id);
	});

	test('dated is canonical by default, on both permalinks', async ({ page, request }) => {
		await setUrlStyle(request, 'dated');
		const slug = `canon-dated-${Date.now()}`;
		const post = await createPost(request, { title: 'Dated Canonical', slug, content: BODY });
		const d = new Date(post.created_at);
		const dated = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		for (const path of [dated, `/${slug}`]) {
			await page.goto(path);
			const href = await page.locator('link[rel="canonical"]').getAttribute('href');
			expect(href, `canonical from ${path}`).toContain(dated);
		}

		await deletePost(request, post.id);
	});

	test('switching the setting moves the canonical and the rendered links', async ({
		page,
		request
	}) => {
		const slug = `canon-slug-${Date.now()}`;
		const post = await createPost(request, { title: 'Slug Canonical', slug, content: BODY });
		const d = new Date(post.created_at);
		const dated = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		await setUrlStyle(request, 'slug');

		// canonical follows the setting from either entry point
		for (const path of [dated, `/${slug}`]) {
			await page.goto(path);
			const href = await page.locator('link[rel="canonical"]').getAttribute('href');
			expect(href, `canonical from ${path}`).toMatch(new RegExp(`/${slug}$`));
			expect(href).not.toContain(dated);
		}

		// the home listing links with the slug-only form
		await page.goto('/');
		const href = await page.locator(`a[href="/${slug}"]`).first().getAttribute('href');
		expect(href).toBe(`/${slug}`);

		// and the dated URL still serves a 200 rather than redirecting or 404ing
		const res = await page.goto(dated);
		expect(res?.status()).toBe(200);

		await deletePost(request, post.id);
	});

	test('the year archive still wins over the slug route', async ({ page, request }) => {
		const slug = `year-guard-${Date.now()}`;
		const post = await createPost(request, { title: 'Year Guard', slug, content: BODY });
		const year = new Date(post.created_at).getUTCFullYear();

		const res = await page.goto(`/${year}`);
		expect(res?.status()).toBe(200);
		await expect(page.getByRole('heading', { name: `Posts from ${year}` })).toBeVisible();

		await deletePost(request, post.id);
	});

	test('an unknown slug still 404s', async ({ page }) => {
		const res = await page.goto('/definitely-not-a-real-post-slug');
		expect(res?.status()).toBe(404);
	});

	test('slug-only lookup works on the find API without a date', async ({ request }) => {
		const slug = `find-nodate-${Date.now()}`;
		const post = await createPost(request, { title: 'No Date Lookup', slug, content: BODY });

		const res = await request.get('/api/blog/find', { params: { slug } });
		expect(res.ok()).toBe(true);
		const found = await res.json();
		expect(found.title).toBe('No Date Lookup');
		expect(found.slug).toBe(slug);

		await deletePost(request, post.id);
	});

	test('a duplicate slug is refused on create and on update', async ({ request }) => {
		const slug = `unique-${Date.now()}`;
		const post = await createPost(request, { title: 'Original', slug, content: BODY });
		const other = await createPost(request, {
			title: 'Other',
			slug: `${slug}-other`,
			content: BODY
		});

		await loginViaApi(request);
		const create = await request.post('/api/blog/create', {
			data: { post: { title: 'Clash', slug, content: BODY, tags: [] } }
		});
		expect(create.status()).toBe(409);

		const update = await request.patch('/api/blog/update', {
			data: { post: { id: other.id, title: 'Other', slug, content: BODY, tags: [] } }
		});
		expect(update.status()).toBe(409);

		await deletePost(request, post.id);
		await deletePost(request, other.id);
	});
});
