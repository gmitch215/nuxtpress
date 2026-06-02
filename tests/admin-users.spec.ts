import { expect, test } from '@playwright/test';
import { ANON_STATE } from './utils/auth';

test.describe('admin users page (anon)', () => {
	test.use({ storageState: ANON_STATE });

	test('non-admin cannot reach the users page', async ({ page }) => {
		await page.goto('/admin/users');
		await expect(page).toHaveURL(/\/(?:\?login=1)?$/);
	});
});

test.describe('admin users page (admin)', () => {
	test('admin sees the users table', async ({ page }) => {
		await page.goto('/admin/users');
		await expect(page.getByRole('heading', { name: /users/i })).toBeVisible();
		await expect(page.getByText('@admin')).toBeVisible();
	});

	test('admin can create a new user and see them in the list', async ({ page, request }) => {
		const username = `tester${Math.floor(Math.random() * 100000)}`;

		// create via API directly to avoid modal lazy-render flake
		const res = await request.post('/api/admin/users', {
			data: {
				username,
				displayName: 'Test Author',
				password: 'a-strong-password',
				role: 'author'
			}
		});
		expect(res.ok(), `create user failed: ${res.status()} ${await res.text()}`).toBe(true);

		await page.goto('/admin/users');
		await expect(page.getByText(`@${username}`)).toBeVisible({ timeout: 10_000 });

		// cleanup
		const created = await res.json();
		await request.delete(`/api/admin/users/${created.id}`);
	});

	test('the new-user modal can be opened from the page (smoke)', async ({ page }) => {
		await page.goto('/admin/users');
		await page.getByRole('button', { name: /new user/i }).click();
		// modal body lazily renders inside Radix portal — wait for it explicitly
		await expect(page.getByRole('dialog')).toBeVisible({ timeout: 5000 });
		await expect(page.getByPlaceholder('jdoe')).toBeVisible({ timeout: 5000 });
	});
});
