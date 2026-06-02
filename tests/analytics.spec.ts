import { expect, test } from '@playwright/test';
import { loginContext } from './utils/auth';
import { createPost, deletePost } from './utils/posts';

test.describe('analytics dashboard', () => {
	test('track endpoint accepts a valid beacon and returns 204', async ({ request }) => {
		const res = await request.post('/api/analytics/track', {
			data: {
				slug: 'some-post',
				active: 1234,
				depth: 50,
				referrer: 'direct',
				isExit: false
			}
		});
		expect([204, 200]).toContain(res.status());
	});

	test('summary endpoint is admin-only', async ({ request }) => {
		const res = await request.get('/api/analytics/summary?range=7d');
		expect(res.status()).toBe(403);
	});

	test('admin can open the analytics modal and see KPIs', async ({ context, page, request }) => {
		const post = await createPost(request, {
			title: 'Analytics test post',
			slug: `an-${Date.now()}`,
			content: 'Track me — analytics smoke test post content to validate the dashboard render.'
		});

		await loginContext(context);
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByTitle(/analytics/i).click();
		await expect(page.getByText(/views over time/i)).toBeVisible({ timeout: 15_000 });
		await expect(page.getByText(/unique visitors/i).first()).toBeVisible();

		await deletePost(request, post.id);
	});
});
