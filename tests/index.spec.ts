import { expect, test } from '@playwright/test';

test.describe('home page', () => {
	test('renders site name and primary actions', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await expect(page).toHaveTitle(/blog/i);
		await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
	});

	test('login modal opens and closes', async ({ page }) => {
		await page.goto('/');
		await page.waitForLoadState('networkidle');
		await page.getByRole('button', { name: /log in/i }).click();
		await expect(page.getByPlaceholder('Username')).toBeVisible({ timeout: 5000 });
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByPlaceholder('Password')).toBeHidden({ timeout: 5000 });
	});
});
