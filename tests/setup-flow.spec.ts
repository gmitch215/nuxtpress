import { expect, test } from './fixtures';
import { waitForHydration } from './utils/hydration';

const ADMIN = {
	username: 'founder',
	displayName: 'The Founder',
	password: 'first-admin-password',
	bio: 'Runs this fresh install.'
};

// runs against the isolated install on :8788, whose data dir is wiped before the server boots,
// so this is a genuine first run rather than a replay against an already-seeded database
test.describe.configure({ mode: 'serial' });

test.describe('first-run setup flow', () => {
	test('a fresh install reports that it needs setup', async ({ request }) => {
		const res = await request.get('/api/setup/status');
		expect(res.ok(), `status was ${res.status()}`).toBe(true);
		const body = await res.json();
		expect(body.needsSetup).toBe(true);
		expect(body.userCount).toBe(0);
		expect(body.hasLegacyPassword).toBe(false);
	});

	test('every route redirects to /setup until an admin exists', async ({ page }) => {
		for (const path of ['/', '/tags', '/about']) {
			await page.goto(path);
			await expect(page).toHaveURL(/\/setup$/, { timeout: 15_000 });
			await expect(page.getByRole('heading', { name: /welcome to nuxtpress/i })).toBeVisible();
		}
	});

	test('the form rejects a short password and a mismatched confirmation', async ({ page }) => {
		await page.goto('/setup');
		await waitForHydration(page);

		await page.getByPlaceholder('admin').fill(ADMIN.username);
		await page.getByPlaceholder('Your name or team name').fill(ADMIN.displayName);
		await page.locator('input[autocomplete="new-password"]').first().fill('short');
		await page.locator('input[autocomplete="new-password"]').last().fill('short');
		await page.getByRole('button', { name: /create administrator/i }).click();
		await expect(page.getByText(/password must be at least 8 characters/i)).toBeVisible();

		await page.locator('input[autocomplete="new-password"]').first().fill(ADMIN.password);
		await page.locator('input[autocomplete="new-password"]').last().fill('something-else');
		await page.getByRole('button', { name: /create administrator/i }).click();
		await expect(page.getByText(/passwords do not match/i)).toBeVisible();

		// nothing was created by the rejected attempts
		const res = await page.request.get('/api/setup/status');
		expect((await res.json()).needsSetup).toBe(true);
	});

	test('submitting the form creates the admin, signs in and lands on the blog', async ({
		page
	}) => {
		await page.goto('/setup');
		await waitForHydration(page);

		await page.getByPlaceholder('admin').fill(ADMIN.username);
		await page.getByPlaceholder('Your name or team name').fill(ADMIN.displayName);
		await page.locator('input[autocomplete="new-password"]').first().fill(ADMIN.password);
		await page.locator('input[autocomplete="new-password"]').last().fill(ADMIN.password);
		await page.locator('textarea').first().fill(ADMIN.bio);

		await page.getByRole('button', { name: /create administrator/i }).click();

		await expect(page).toHaveURL(/127\.0\.0\.1:8788\/$/, { timeout: 20_000 });
		await waitForHydration(page);

		// signed in as the new admin, so the authoring controls are present
		await expect(page.getByRole('button', { name: /new post/i })).toBeVisible({ timeout: 15_000 });
		await expect(page.getByTitle('Users')).toBeVisible();
	});

	test('the new admin is a real, active administrator', async ({ request }) => {
		const status = await request.get('/api/setup/status');
		const body = await status.json();
		expect(body.needsSetup).toBe(false);
		expect(body.userCount).toBe(1);

		const profile = await request.get(`/api/users/${ADMIN.username}`);
		expect(profile.ok()).toBe(true);
		const { author } = await profile.json();
		expect(author.username).toBe(ADMIN.username);
		expect(author.displayName).toBe(ADMIN.displayName);
		expect(author.role).toBe('administrator');
		expect(author.bio).toBe(ADMIN.bio);
	});

	test('the chosen password works for a normal login', async ({ request }) => {
		const res = await request.post('/api/login', {
			data: { username: ADMIN.username, password: ADMIN.password }
		});
		expect(res.ok(), `login failed: ${res.status()}`).toBe(true);

		const verify = await request.get('/api/verify');
		const body = await verify.json();
		expect(body.loggedIn).toBe(true);
		expect(body.user?.username).toBe(ADMIN.username);
	});

	test('/setup redirects away and re-initialisation is refused once set up', async ({
		page,
		request
	}) => {
		await page.goto('/setup');
		await expect(page).toHaveURL(/127\.0\.0\.1:8788\/$/, { timeout: 15_000 });

		const res = await request.post('/api/setup/init', {
			data: {
				username: 'second',
				displayName: 'Should Not Work',
				password: 'another-password',
				role: 'administrator'
			}
		});
		expect(res.status()).toBe(409);
	});
});
