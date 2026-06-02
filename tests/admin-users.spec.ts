import { expect, test } from '@playwright/test';
import { loginContext } from './utils/auth';

test.describe('admin users page', () => {
	test('non-admin cannot reach the users page', async ({ page }) => {
		await page.goto('/admin/users');
		await expect(page).toHaveURL(/\/(?:\?login=1)?$/);
	});

	test('admin sees the users table', async ({ context, page }) => {
		await loginContext(context);
		await page.goto('/admin/users');
		await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
		await expect(page.getByText('@admin')).toBeVisible();
	});

	test('admin can create a new user and see them in the list', async ({ context, page }) => {
		await loginContext(context);
		await page.goto('/admin/users');

		const username = `tester${Math.floor(Math.random() * 100000)}`;
		await page.getByRole('button', { name: /new user/i }).click();
		await page.getByPlaceholder('jdoe').fill(username);
		await page.locator('input').nth(1).fill('Test Author');
		await page.locator('input[type=password]').fill('a-strong-password');
		await page.getByRole('button', { name: /^create$/i }).click();
		await expect(page.getByText(`@${username}`)).toBeVisible({ timeout: 8000 });
	});
});
