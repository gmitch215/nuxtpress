import { expect, test } from '@playwright/test';
import { ANON_STATE } from './utils/auth';

test.use({ storageState: ANON_STATE });

test.describe('home page (anon)', () => {
	test('renders site name and primary actions', async ({ page }) => {
		await page.goto('/');
		await expect(page).toHaveTitle(/blog/i);
		await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
		await expect(page.locator('button[icon="mdi:rss"]').first()).toBeVisible();
	});

	test('login modal opens and closes', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /log in/i }).click();
		await expect(page.getByPlaceholder('Username')).toBeVisible();
		await expect(page.getByPlaceholder('Password')).toBeVisible();
		await page.keyboard.press('Escape');
		await expect(page.getByPlaceholder('Password')).toBeHidden({ timeout: 5000 });
	});
});
