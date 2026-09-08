import { expect, test } from './fixtures';
import { createPost, deletePost } from './utils/posts';

const BODY =
	'# Indexable heading\n\nThis body text must reach a crawler without any JavaScript running, ' +
	'which is the whole point of server rendering the archive and the post itself.';

test.describe('seo and crawler indexability', () => {
	test('home page HTML contains post titles and links before any JS runs', async ({
		browser,
		request
	}) => {
		const slug = `seo-home-${Date.now()}`;
		const post = await createPost(request, { title: 'Server Rendered Post', slug, content: BODY });

		// a JS-disabled context is the closest match to an LLM fetcher or a plain HTTP crawler
		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		await page.goto('/');

		await expect(page.getByRole('heading', { name: 'Server Rendered Post' })).toBeVisible();
		await expect(page.getByRole('link', { name: /Server Rendered Post/ }).first()).toBeVisible();

		const hrefs = await page
			.locator(`a[href*="${slug}"]`)
			.evaluateAll((els) => els.map((el) => el.getAttribute('href')));
		expect(hrefs.length).toBeGreaterThan(0);

		await context.close();
		await deletePost(request, post.id);
	});

	test('post page HTML contains the full body before any JS runs', async ({ browser, request }) => {
		const slug = `seo-post-${Date.now()}`;
		const post = await createPost(request, { title: 'Crawlable Body', slug, content: BODY });

		const context = await browser.newContext({ javaScriptEnabled: false });
		const page = await context.newPage();
		const d = new Date(post.created_at);
		await page.goto(`/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`);

		await expect(page.getByRole('heading', { name: 'Crawlable Body', level: 1 })).toBeVisible();
		await expect(page.getByText(/without any JavaScript running/)).toBeVisible();

		await context.close();
		await deletePost(request, post.id);
	});

	test('every public page carries a canonical link and og:url', async ({ page, request }) => {
		const slug = `seo-canon-${Date.now()}`;
		const post = await createPost(request, { title: 'Canonical Post', slug, content: BODY });
		const d = new Date(post.created_at);
		const postPath = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		for (const path of ['/', '/about', '/tags', postPath]) {
			await page.goto(path);
			const canonical = page.locator('link[rel="canonical"]');
			await expect(canonical, `canonical missing on ${path}`).toHaveCount(1);
			const href = await canonical.getAttribute('href');
			expect(href, `canonical href on ${path}`).toMatch(/^https?:\/\//);
			expect(href).toContain(path === '/' ? '/' : path);
			await expect(page.locator('meta[property="og:url"]')).toHaveCount(1);
		}

		await deletePost(request, post.id);
	});

	test('post pages expose article metadata and a structured-data blob', async ({
		page,
		request
	}) => {
		const slug = `seo-meta-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Metadata Post',
			slug,
			content: BODY,
			tags: ['meta', 'seo']
		});
		const d = new Date(post.created_at);
		await page.goto(`/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`);

		await expect(page.locator('meta[property="og:type"][content="article"]')).toHaveCount(1);
		await expect(page.locator('meta[property="article:published_time"]')).toHaveCount(1);
		await expect(page.locator('meta[property="article:modified_time"]')).toHaveCount(1);
		await expect(page.locator('meta[property="og:image"]')).toHaveCount(1);

		const description = await page.locator('meta[name="description"]').getAttribute('content');
		// the description is plain text, not raw markdown
		expect(description).not.toContain('#');
		expect(description).toContain('Indexable heading');

		const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
		expect(jsonLd).toBeTruthy();
		const graph = JSON.parse(jsonLd!);
		const nodes = graph['@graph'] ?? [graph];
		const article = nodes.find((n: any) => String(n['@type']).includes('Posting'));
		expect(article, 'BlogPosting node').toBeTruthy();
		expect(article.datePublished).toBeTruthy();
		expect(article.headline).toBe('Metadata Post');

		await deletePost(request, post.id);
	});

	test('sitemap lists posts and archives but never admin routes', async ({ request }) => {
		const slug = `seo-sitemap-${Date.now()}`;
		const post = await createPost(request, { title: 'Sitemap Post', slug, content: BODY });

		const res = await request.get('/sitemap.xml');
		expect(res.ok()).toBe(true);
		const xml = await res.text();

		expect(xml, 'post is missing from the sitemap').toContain(slug);
		const d = new Date(post.created_at);
		expect(xml).toContain(`/${d.getUTCFullYear()}<`.replace('<', ''));
		expect(xml).not.toContain('/admin/users');
		expect(xml).not.toContain('<loc>http://127.0.0.1:8787/setup</loc>');
		expect(xml).not.toContain('/profile</loc>');

		await deletePost(request, post.id);
	});

	test('robots.txt blocks all indexing in development', async ({ request }) => {
		const res = await request.get('/robots.txt');
		expect(res.ok()).toBe(true);
		// nuxt-robots suppresses the real groups outside production on purpose
		expect(await res.text()).toMatch(/Disallow:\s*\/\s*$/m);
	});

	test('robots.txt disallows private routes and points at the sitemap', async ({ request }) => {
		// the production groups are only emitted outside dev, so ask the module for them directly
		const res = await request.get('/robots.txt?mockProductionEnv');
		expect(res.ok()).toBe(true);
		const body = await res.text();

		expect(body).toMatch(/Disallow:\s*\/admin\//);
		expect(body).toMatch(/Disallow:\s*\/setup/);
		expect(body).toMatch(/Disallow:\s*\/profile/);
		expect(body).toMatch(/Disallow:\s*\/api\/admin\//);
		expect(body).toMatch(/Disallow:\s*\/api\/analytics\//);
		// the public read APIs stay crawlable so a JS-rendering crawler is not starved
		expect(body).not.toMatch(/Disallow:\s*\/api\/blog\/list/);
		expect(body).toMatch(/Sitemap:\s*https?:\/\/\S+sitemap\.xml/);
	});

	test('the feed is discoverable from the page head', async ({ page }) => {
		await page.goto('/');
		const feedLink = page.locator('link[rel="alternate"][type="application/atom+xml"]');
		await expect(feedLink).toHaveCount(1);
		expect(await feedLink.getAttribute('href')).toContain('/feed.xml');
	});

	test('the html element declares a language', async ({ page }) => {
		await page.goto('/');
		expect(await page.locator('html').getAttribute('lang')).toBe('en');
	});
});
