import { expect, test } from './fixtures';
import { createPost, deletePost } from './utils/posts';

test.describe('thumbnail fallback', () => {
	test('broken thumbnail URL falls back to favicon without breaking layout', async ({
		page,
		request
	}) => {
		const post = await createPost(request, {
			title: 'Broken thumbnail',
			slug: `broken-${Date.now()}`,
			content: 'Post used to verify broken-image fallback to favicon for SSR resilience.',
			thumbnail_url: 'https://nonexistent.invalid/never-resolves.png'
		});

		await page.goto('/');
		await expect(page.getByText('Broken thumbnail')).toBeVisible({ timeout: 10_000 });

		const img = page
			.locator('img')
			.filter({ hasNot: page.locator('img[src*="favicon"]') })
			.first();
		await img.waitFor({ state: 'visible' });

		const finalSrc = await page
			.locator('img')
			.evaluateAll((imgs: HTMLImageElement[]) => imgs.map((i) => i.currentSrc || i.src));
		expect(finalSrc.some((s) => s.includes('favicon'))).toBe(true);

		await deletePost(request, post.id);
	});
});
