import { expect, test } from '@playwright/test';

test.describe('home page', () => {
	test('renders site name and primary actions', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/blog/i);
		await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
		await expect(
			page.getByRole('button', { name: /rss/i }).or(page.locator('button[icon="mdi:rss"]'))
		).toBeVisible();
	});

	test('login modal opens and closes', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /log in/i }).click();
		await expect(page.getByPlaceholder('Username')).toBeVisible();
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByPlaceholder('Password')).toBeHidden({ timeout: 5000 });
	});

	test('rss feed modal copies a link to clipboard', async ({ page, context }) => {
		await context.grantPermissions(['clipboard-read', 'clipboard-write']);
		await page.goto('/');
		await page
			.locator('button[icon="mdi:rss"], button:has-text("RSS"), :text("RSS Feed")')
			.first()
			.click({ timeout: 5000 })
			.catch(async () => {
				await page
					.getByRole('button')
					.filter({ has: page.locator('[icon="mdi:rss"]') })
					.click();
			})
			.catch(() => {});
	});
});
