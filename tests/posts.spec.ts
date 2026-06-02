import { expect, test } from '@playwright/test';
import { ANON_STATE } from './utils/auth';
import { adminApi, createPost, deletePost } from './utils/posts';

test.describe('post creation, viewing, deletion (admin context)', () => {
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

	test('admin sees edit + delete buttons on a post', async ({ page, request }) => {
		const slug = `t-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Editable post',
			slug,
			content: 'Editable post content with enough characters for the schema floor.'
		});

		const d = new Date(post.created_at);
		const url = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;

		await page.goto(url);
		await expect(page.getByRole('heading', { name: 'Editable post' })).toBeVisible();
		await expect(page.locator('button[icon="mdi:pencil"]').first()).toBeVisible();
		await expect(page.locator('button[icon="mdi:delete"]').first()).toBeVisible();

		await deletePost(request, post.id);
	});
});

test.describe('post viewed anonymously', () => {
	test.use({ storageState: ANON_STATE });

	test('unauthed user does not see admin controls on a post', async ({ page }) => {
		const admin = await adminApi();
		const slug = `t-${Date.now()}-anon`;
		const post = await createPost(admin, {
			title: 'Anonymous view',
			slug,
			content: 'A post viewed by anonymous users to verify admin gating.'
		});

		const d = new Date(post.created_at);
		const url = `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${slug}`;
		await page.goto(url);
		await expect(page.getByRole('heading', { name: 'Anonymous view' })).toBeVisible();
		await expect(page.locator('button[icon="mdi:pencil"]').first()).toBeHidden();

		await deletePost(admin, post.id);
		await admin.dispose();
	});
});
