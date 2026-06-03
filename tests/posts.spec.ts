import { expect, test } from './fixtures';
import { loginContext } from './utils/auth';
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
});
