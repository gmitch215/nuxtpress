import { expect, test } from './fixtures';
import { loginContext, loginViaApi } from './utils/auth';

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

	test('admin can create a user via API and see them in the list', async ({
		context,
		page,
		request
	}) => {
		await loginContext(context);
		await loginViaApi(request);

		const username = `tester${Math.floor(Math.random() * 100000)}`;
		const res = await request.post('/api/admin/users', {
			data: {
				username,
				displayName: 'Test Author',
				password: 'a-strong-password',
				role: 'author'
			}
		});
		expect(res.ok(), `create user failed: ${res.status()} ${await res.text()}`).toBe(true);
		const { id } = await res.json();

		await page.goto('/admin/users');
		await expect(page.getByText(`@${username}`)).toBeVisible({ timeout: 10_000 });

		await request.delete(`/api/admin/users/${id}`);
	});
});
