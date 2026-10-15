import { expect, test } from './fixtures';
import { loginContext } from './utils/auth';
import { waitForHydration } from './utils/hydration';
import {
	clearSink,
	confirmedSubscriber,
	disableMail,
	enableMail,
	linkIn,
	readSink,
	removeTestSubscribers,
	uniqueEmail,
	uniqueIp
} from './utils/mail';
import { deletePost } from './utils/posts';

test.afterEach(async ({ request }) => {
	await removeTestSubscribers(request);
	await disableMail(request);
});

test.describe('subscribe form', () => {
	test('is hidden until mail is configured and enabled', async ({ page, request }) => {
		await disableMail(request);
		await page.goto('/about');
		await waitForHydration(page);
		await expect(page.getByLabel('Get New Posts by Email')).toHaveCount(0);

		await enableMail(request);
		await page.goto('/about');
		await waitForHydration(page);
		await expect(page.getByLabel('Get New Posts by Email')).toBeVisible();
	});

	test('a visitor subscribes, confirms from the email and unsubscribes', async ({
		page,
		request
	}) => {
		await enableMail(request);
		const email = uniqueEmail('visitor');
		await page.setExtraHTTPHeaders({ 'x-forwarded-for': uniqueIp() });

		await page.goto('/about');
		await waitForHydration(page);
		await page.getByPlaceholder('you@example.com').fill(email);
		await page.getByRole('button', { name: 'Subscribe' }).click();
		await expect(page.getByText('Check your email to confirm your subscription.')).toBeVisible();

		const confirmMail = (await readSink(request)).find((m) => m.to === email)!;
		const confirmLink = linkIn(confirmMail, '/subscribe/confirm');
		await page.goto(`${confirmLink.pathname}${confirmLink.search}`);
		await waitForHydration(page);
		await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
		await page.getByRole('button', { name: 'Confirm Subscription' }).click();
		await expect(page.getByRole('heading', { name: 'You Are Subscribed' })).toBeVisible();

		const id = confirmLink.searchParams.get('id')!;
		const active = await request.get('/api/admin/subscribers', { params: { search: email } });
		expect((await active.json()).rows[0].status).toBe('active');

		const unsubscribeToken = await unsubscribeTokenFor(request, id, email);
		await page.goto(`/unsubscribe?id=${id}&token=${unsubscribeToken}`);
		await waitForHydration(page);
		await page.getByRole('button', { name: 'Unsubscribe' }).click();
		await expect(page.getByRole('heading', { name: 'You Are Unsubscribed' })).toBeVisible();

		const after = await request.get('/api/admin/subscribers', { params: { search: email } });
		expect((await after.json()).rows).toHaveLength(0);
	});

	test('the confirm and unsubscribe pages explain a bad link', async ({ page }) => {
		await page.goto('/subscribe/confirm?id=abc&token=bad');
		await waitForHydration(page);
		await page.getByRole('button', { name: 'Confirm Subscription' }).click();
		await expect(page.getByRole('heading', { name: 'Could Not Confirm' })).toBeVisible();

		await page.goto('/unsubscribe');
		await expect(page.getByRole('heading', { name: 'Could Not Unsubscribe' })).toBeVisible();
	});

	test('an invalid address shows the server message', async ({ page, request }) => {
		await enableMail(request);
		await page.setExtraHTTPHeaders({ 'x-forwarded-for': uniqueIp() });
		await page.goto('/about');
		await waitForHydration(page);
		await page.getByPlaceholder('you@example.com').fill('a@b');
		await page.getByRole('button', { name: 'Subscribe' }).click();
		await expect(page.getByText(/Email|valid/i).last()).toBeVisible();
	});
});

test.describe('admin subscribers page', () => {
	test('lists, searches and removes subscribers', async ({ context, page, request }) => {
		await enableMail(request);
		const keep = await confirmedSubscriber(request, uniqueEmail('keep'));
		const drop = await confirmedSubscriber(request, uniqueEmail('drop'));

		await loginContext(context);
		await page.goto('/admin/subscribers');
		await waitForHydration(page);
		await expect(page.getByRole('heading', { name: 'Subscribers' })).toBeVisible();
		await expect(page.getByText('Ready', { exact: true })).toBeVisible();
		await expect(page.getByRole('cell', { name: keep.email })).toBeVisible();

		await page.getByPlaceholder('Search by email').fill('drop-');
		await expect(page.getByRole('cell', { name: keep.email })).toHaveCount(0);
		await expect(page.getByRole('cell', { name: drop.email })).toBeVisible();

		page.once('dialog', (dialog) => dialog.accept());
		await page.getByTitle(`Remove ${drop.email}`).click();
		await expect(page.getByRole('cell', { name: drop.email })).toHaveCount(0);
	});

	test('non-admins are kept out', async ({ page }) => {
		await page.goto('/admin/subscribers');
		await expect(page).toHaveURL(/login=1/);
	});

	test('saves mail settings and sends a test email', async ({ context, page, request }) => {
		await enableMail(request);
		await loginContext(context);
		await page.goto('/admin/subscribers');
		await waitForHydration(page);

		await page.getByPlaceholder('My Blog').fill('Renamed From UI');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByText('Mail Settings Saved', { exact: true })).toBeVisible();

		await clearSink(request);
		await page.getByPlaceholder('test@example.com').fill('ui-probe@test.invalid');
		await page.getByRole('button', { name: 'Send Test' }).click();
		await expect(page.getByText('Test Email Sent', { exact: true })).toBeVisible();
		const [mail] = await readSink(request);
		expect(mail).toMatchObject({
			to: 'ui-probe@test.invalid',
			from: 'Renamed From UI <blog@test.invalid>'
		});
	});
});

test.describe('publishing with subscribers', () => {
	test('the new post form offers Email Subscribers and queues the post', async ({
		context,
		page,
		request
	}) => {
		await enableMail(request);
		await confirmedSubscriber(request);

		await loginContext(context);
		await page.goto('/');
		await waitForHydration(page);
		await page.getByRole('button', { name: /new post/i }).click();

		await expect(page.getByLabel('Email Subscribers')).toBeChecked();
		const title = `Subscriber post ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('ControlOrMeta+A');
		await page.keyboard.type(
			'A post written through the editor that is long enough to pass the content minimum.'
		);
		await page.getByRole('button', { name: 'Create Post' }).click();
		await expect(page.getByText('Queued for 1 subscriber.', { exact: true })).toBeVisible({
			timeout: 15_000
		});

		const list = await (await request.get('/api/blog/list')).json();
		const created = list.find((p: any) => p.title === title);
		expect(created).toBeTruthy();
		await deletePost(request, created.id);
	});

	test('the checkbox is absent while mail is off', async ({ context, page, request }) => {
		await disableMail(request);
		await loginContext(context);
		await page.goto('/');
		await waitForHydration(page);
		await page.getByRole('button', { name: /new post/i }).click();
		await expect(page.getByPlaceholder('Enter post title')).toBeVisible();
		await expect(page.getByLabel('Email Subscribers')).toHaveCount(0);
	});
});

async function unsubscribeTokenFor(
	request: import('@playwright/test').APIRequestContext,
	id: string,
	email: string
): Promise<string> {
	const post = await request.post('/api/blog/create', {
		data: {
			notify: true,
			post: {
				title: `Token carrier ${Date.now()}`,
				slug: `token-carrier-${Date.now()}`,
				content:
					'A post used to read the unsubscribe link from the email delivered to a subscriber.',
				tags: []
			}
		}
	});
	const created = await post.json();
	await request.post('/api/admin/mail/drain');
	const mail = (await readSink(request)).find(
		(m) => m.to === email && m.headers?.['List-Unsubscribe']
	)!;
	const url = new URL(mail.headers!['List-Unsubscribe']!.replace(/[<>]/g, ''));
	expect(url.searchParams.get('id')).toBe(id);
	await deletePost(request, created.id);
	return url.searchParams.get('token')!;
}
