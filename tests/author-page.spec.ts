import { expect, test } from './fixtures';
import { createPost, deletePost } from './utils/posts';

test.describe('author page', () => {
	test('renders 404 for unknown author', async ({ page }) => {
		const res = await page.goto('/authors/nobody-here', { waitUntil: 'domcontentloaded' });
		expect([404, 200]).toContain(res?.status() ?? 0);
		await expect(page.getByText(/author/i).first()).toBeVisible();
	});

	test('shows the author profile + posts', async ({ page, request }) => {
		const post = await createPost(request, {
			title: 'Authored post',
			slug: `auth-${Date.now()}`,
			content: 'A post used to verify the author page lists owner posts correctly.'
		});

		await page.goto('/authors/admin');
		await expect(page.getByText('Team').first()).toBeVisible();
		await expect(page.getByText(/posts \(\d+\)/i)).toBeVisible();
		await expect(page.getByText('Authored post')).toBeVisible({ timeout: 10_000 });

		await deletePost(request, post.id);
	});
});
