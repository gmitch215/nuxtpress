import { expect, test } from '@playwright/test';

test.describe('login', () => {
	test('rejects invalid credentials', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /log in/i }).click();
		await page.getByPlaceholder('Username').fill('admin');
		await page.getByPlaceholder('Password').fill('wrong-password');
		await page.getByRole('button', { name: /^login$/i }).click();
		await expect(page.getByText(/invalid credentials/i)).toBeVisible();
	});

	test('admin can log in via UI and sees admin actions', async ({ page }) => {
		await page.goto('/');
		await page.getByRole('button', { name: /log in/i }).click();
		await page.getByPlaceholder('Username').fill('admin');
		await page.getByPlaceholder('Password').fill('adminpass');
		await page.getByRole('button', { name: /^login$/i }).click();
		await expect(page.getByRole('button', { name: /new post/i })).toBeVisible({ timeout: 10_000 });
	});

	test('logout clears admin state', async ({ page, request }) => {
		await request.post('/api/login', { data: { username: 'admin', password: 'adminpass' } });
		await page.goto('/');
		await page.getByRole('button', { name: /new post/i }).waitFor({ timeout: 10_000 });
		await page.getByTitle(/log out/i).click();
		await expect(page.getByRole('button', { name: /log in/i })).toBeVisible();
	});
});
