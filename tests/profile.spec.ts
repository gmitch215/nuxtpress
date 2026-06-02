import { expect, test } from '@playwright/test';
import { loginContext } from './utils/auth';

test.describe('profile page', () => {
	test('unauthed users are redirected to home with login modal', async ({ page }) => {
		await page.goto('/profile');
		await expect(page).toHaveURL(/\/(?:\?login=1)?$/);
	});

	test('logged-in user can view their profile form', async ({ context, page }) => {
		await loginContext(context);
		await page.goto('/profile');
		await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
	});

	test('user can update display name', async ({ context, page }) => {
		await loginContext(context);
		await page.goto('/profile');
		const input = page
			.locator('input')
			.filter({ hasNot: page.locator('input[type=password]') })
			.first();
		await input.waitFor();
		await input.fill(`Team Updated ${Date.now()}`);
		await page.getByRole('button', { name: /save changes/i }).click();
		await expect(page.getByText(/profile updated/i)).toBeVisible({ timeout: 8000 });
	});
});
