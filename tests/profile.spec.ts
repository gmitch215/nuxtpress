import { expect, test } from '@playwright/test';
import { ANON_STATE } from './utils/auth';

test.describe('profile page (anon)', () => {
	test.use({ storageState: ANON_STATE });

	test('unauthed users are redirected to home with login modal', async ({ page }) => {
		await page.goto('/profile');
		await expect(page).toHaveURL(/\/(?:\?login=1)?$/);
	});
});

test.describe('profile page (admin)', () => {
	test('logged-in user can view their profile form', async ({ page }) => {
		await page.goto('/profile');
		await expect(page.getByRole('heading', { name: /your profile/i })).toBeVisible();
		await expect(page.getByRole('button', { name: /save changes/i })).toBeVisible();
	});

	test('user can update display name', async ({ page }) => {
		await page.goto('/profile');
		const input = page
			.locator('input')
			.filter({ hasNot: page.locator('input[type=password]') })
			.first();
		await input.waitFor();
		await input.fill('Team Updated');
		await page.getByRole('button', { name: /save changes/i }).click();
		await expect(
			page.locator('.toast, [role=status]').or(page.getByText(/profile updated/i))
		).toBeVisible({ timeout: 5000 });
	});
});
