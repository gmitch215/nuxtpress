import { expect, test } from './fixtures';
import { loginContext } from './utils/auth';
import { waitForHydration } from './utils/hydration';
import { createPost, deletePost } from './utils/posts';

test.describe('post creation, viewing, deletion', () => {
	test('create post via API and view it on home', async ({ page, request }) => {
		const slug = `test-post-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Test post via API',
			slug,
			content: 'This is the test post body content with enough characters to pass validation.'
		});

		await page.goto('/');
		await expect(page.getByText('Test post via API')).toBeVisible({ timeout: 10_000 });

		await deletePost(request, post.id);
	});

	test('admin sees edit + delete buttons on a post', async ({ context, page, request }) => {
		const slug = `t-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Editable post',
			slug,
			content: 'Editable post content with enough characters for the schema floor.'
		});

		const d = new Date(post.created_at);
		const url = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		await loginContext(context);
		await page.goto(url);
		await expect(page.getByRole('heading', { name: 'Editable post' })).toBeVisible();
		// admin-only edit/delete buttons live next to the post title heading
		const adminButtons = page.locator('header button');
		await expect(adminButtons).toHaveCount(2, { timeout: 5000 });

		await deletePost(request, post.id);
	});

	test('unauthed user does not see admin controls on a post', async ({ page, request }) => {
		const slug = `t-${Date.now()}-anon`;
		const post = await createPost(request, {
			title: 'Anonymous view',
			slug,
			content: 'A post viewed by anonymous users to verify admin gating.'
		});
		const d = new Date(post.created_at);
		const url = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;
		await page.goto(url);
		await expect(page.getByRole('heading', { name: 'Anonymous view' })).toBeVisible();
		await expect(page.locator('header button')).toHaveCount(0);

		await deletePost(request, post.id);
	});

	test('deleting a post from its page leaves no script errors behind', async ({
		context,
		page,
		request
	}) => {
		const post = await createPost(request, {
			title: 'Delete without errors',
			slug: `del-clean-${Date.now()}`,
			content: 'A post deleted from its own page to prove the page tears down without errors.'
		});
		await loginContext(context);

		const errors: string[] = [];
		page.on('pageerror', (error) => errors.push(error.message));
		page.on('console', (message) => {
			if (message.type() === 'error') errors.push(message.text());
		});

		await page.goto(`/${post.slug}`);
		await expect(page.getByRole('heading', { name: 'Delete without errors' })).toBeVisible();
		await waitForHydration(page);
		page.once('dialog', (dialog) => dialog.accept());
		await page.locator('header button').nth(1).click();
		await expect(page).toHaveURL(/\/$/);
		await page.waitForTimeout(1000);

		expect(errors.filter((message) => /created_at|undefined/.test(message))).toEqual([]);
		await deletePost(request, post.id);
	});

	test('emoji shortcodes render on the server and after hydration', async ({ page, request }) => {
		const post = await createPost(request, {
			title: 'Emoji Shortcodes',
			slug: `emoji-${Date.now()}`,
			content: 'Shipped :tada: today, and :not_a_real_code: stays as typed in this body.'
		});

		try {
			const html = await (await request.get(`/${post.slug}`)).text();
			expect(html).toContain('Shipped \u{1F389} today');
			expect(html).toContain(':not_a_real_code:');

			const article = page.locator('article', { hasText: 'Emoji Shortcodes' });
			// a cold dev server can reload once while Vite finishes optimising the emoji data
			await expect(async () => {
				await page.goto(`/${post.slug}`);
				await waitForHydration(page);
				await expect(article).toContainText('Shipped \u{1F389} today', { timeout: 3_000 });
			}).toPass({ timeout: 45_000 });
			await expect(article).toContainText(':not_a_real_code:');
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('hostile html in a post is neutralised in the server-rendered page', async ({ request }) => {
		const payloads = [
			'<img/src=x/onerror=alert(1)>',
			'<svg/onload=alert(1)>',
			'<script src=//evil.example/x.js>',
			'<iframe src="javascript:alert(1)">',
			'<a href="&#106;avascript:alert(1)">entity</a>',
			'<a href="java&#x0A;script:alert(1)">newline</a>',
			'<a href=" JaVaScRiPt:alert(1)">case</a>',
			'<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">',
			'<p onclick="alert(1)" style="x:expression(alert(1))">attrs</p>',
			'<object data="x"></object><embed src="x"><form action="x"><button>go</button></form>'
		];
		const post = await createPost(request, {
			title: 'Hostile Html',
			slug: `hostile-${Date.now()}`,
			content: `**kept bold** and <u>kept underline</u> in an intro long enough for validation.\n\n${payloads.join('\n\n')}`
		});

		try {
			const html = await (await request.get(`/${post.slug}`)).text();
			const article = html.match(/<div class="prose prose-lg[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '';
			expect(article, 'post body missing').toContain('kept bold');
			expect(article).toContain('<strong>kept bold</strong>');
			expect(article).toContain('<u>kept underline</u>');

			// escaped text such as `&lt;img onerror=...&gt;` is inert, so only real tags are inspected
			const tags = (article.match(/<[a-zA-Z][^>]*>/g) ?? []).join('\n');
			expect(tags).not.toMatch(/\son\w+\s*=/i);
			expect(tags).not.toMatch(/javascript|java[\s&#x0-9a-f;]*script/i);
			expect(tags).not.toMatch(/\bstyle\s*=/i);
			expect(tags).not.toMatch(/data:text/i);
			expect(article).not.toMatch(/<\s*(script|iframe|svg|object|embed|form|button)\b/i);
		} finally {
			await deletePost(request, post.id);
		}
	});
});
