import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { loginContext, loginViaApi } from './utils/auth';
import { waitForHydration } from './utils/hydration';
import { makePng } from './utils/png';
import { deletePost } from './utils/posts';

const LIMIT = 350_000;

async function openEditor(page: Page, context: import('@playwright/test').BrowserContext) {
	await loginContext(context);
	await page.goto('/');
	await waitForHydration(page);
	await page.getByRole('button', { name: /new post/i }).click();
	await expect(page.locator('.ProseMirror')).toBeVisible();
}

/** Builds a large noisy PNG inside the page, so the real canvas pipeline has to shrink it. */
async function pasteLargeImage(page: Page, type = 'image/png') {
	await page.evaluate(async (mime) => {
		const canvas = document.createElement('canvas');
		canvas.width = 2400;
		canvas.height = 1600;
		const ctx = canvas.getContext('2d')!;
		const gradient = ctx.createLinearGradient(0, 0, 2400, 1600);
		gradient.addColorStop(0, '#ff3355');
		gradient.addColorStop(1, '#3355ff');
		ctx.fillStyle = gradient;
		ctx.fillRect(0, 0, 2400, 1600);
		for (let i = 0; i < 20000; i++) {
			ctx.fillStyle = `rgb(${Math.random() * 255},${Math.random() * 255},${Math.random() * 255})`;
			ctx.fillRect(Math.random() * 2400, Math.random() * 1600, 6, 6);
		}
		const blob: Blob = await new Promise((resolve) =>
			canvas.toBlob((b) => resolve(b!), 'image/png')
		);
		const file = new File([blob], 'photo.png', { type: mime });
		const data = new DataTransfer();
		data.items.add(file);
		document
			.querySelector('.ProseMirror')!
			.dispatchEvent(
				new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true })
			);
	}, type);
}

test.describe('editor image upload', () => {
	test('a pasted photo is downscaled into a data URL that renders in the editor', async ({
		context,
		page
	}) => {
		await openEditor(page, context);
		await page.locator('.ProseMirror').click();
		await pasteLargeImage(page);

		const image = page.locator('.ProseMirror img').first();
		await expect(image).toBeVisible({ timeout: 20_000 });
		const src = (await image.getAttribute('src'))!;
		expect(src).toMatch(/^data:image\/(webp|png);base64,/);
		expect(src.length).toBeLessThanOrEqual(LIMIT);
		const width = await image.evaluate((el: HTMLImageElement) => el.naturalWidth);
		expect(width).toBeGreaterThan(0);
		expect(width).toBeLessThanOrEqual(1600);
	});

	test('the toolbar button opens a file picker and inserts the chosen image', async ({
		context,
		page
	}) => {
		await openEditor(page, context);
		await page.locator('.ProseMirror').click();

		const chooser = page.waitForEvent('filechooser');
		await page.locator('button:has([class*="image-up"])').click();
		await (
			await chooser
		).setFiles({ name: 'chart.png', mimeType: 'image/png', buffer: makePng(900, 600) });

		const image = page.locator('.ProseMirror img').first();
		await expect(image).toBeVisible({ timeout: 20_000 });
		expect(await image.getAttribute('src')).toMatch(/^data:image\//);
		expect(await image.getAttribute('alt')).toBe('chart');
	});

	test('a dropped image file is inserted', async ({ context, page }) => {
		await openEditor(page, context);
		await page.locator('.ProseMirror').click();
		await page.evaluate(async () => {
			const canvas = document.createElement('canvas');
			canvas.width = 64;
			canvas.height = 64;
			canvas.getContext('2d')!.fillRect(0, 0, 64, 64);
			const blob: Blob = await new Promise((resolve) =>
				canvas.toBlob((b) => resolve(b!), 'image/png')
			);
			const data = new DataTransfer();
			data.items.add(new File([blob], 'dropped.png', { type: 'image/png' }));
			const paragraph = document.querySelector('.ProseMirror p')!;
			const box = paragraph.getBoundingClientRect();
			paragraph.dispatchEvent(
				new DragEvent('drop', {
					dataTransfer: data,
					clientX: box.left + 10,
					clientY: box.top + box.height / 2,
					bubbles: true,
					cancelable: true
				})
			);
		});
		await expect(page.locator('.ProseMirror img').first()).toBeVisible({ timeout: 20_000 });
	});

	test('an unsupported image type is refused with a message', async ({ context, page }) => {
		await openEditor(page, context);
		await page.locator('.ProseMirror').click();
		await pasteLargeImage(page, 'image/bmp');
		await expect(
			page.getByText('Use a PNG, JPEG, WebP or GIF image', { exact: true })
		).toBeVisible();
		await expect(page.locator('.ProseMirror img')).toHaveCount(0);
	});

	test('a post saved with an uploaded image renders it for readers', async ({
		context,
		page,
		request
	}) => {
		await openEditor(page, context);
		const title = `Image post ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('ControlOrMeta+A');
		await page.keyboard.type(
			'A post with a photo in the middle, long enough for the content minimum.'
		);
		await page.keyboard.press('Enter');
		await pasteLargeImage(page);
		await expect(page.locator('.ProseMirror img').first()).toBeVisible({ timeout: 20_000 });

		await page.getByRole('button', { name: 'Create Post' }).click();
		await expect(page.getByText('Post Created', { exact: true })).toBeVisible({ timeout: 15_000 });

		const list = await (await request.get('/api/blog/list')).json();
		const created = list.find((p: any) => p.title === title);
		expect(created).toBeTruthy();

		await page.goto(`/${created.slug}`);
		await waitForHydration(page);
		const rendered = page.locator('article img[src^="data:image/"]').first();
		await expect(rendered).toBeVisible();
		expect(await rendered.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);

		await deletePost(request, created.id);
	});

	test('an uploaded thumbnail is shrunk and served from its route', async ({
		context,
		page,
		request
	}) => {
		await openEditor(page, context);
		const title = `Thumb post ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('ControlOrMeta+A');
		await page.keyboard.type('A post with an uploaded thumbnail that is longer than the minimum.');

		await page
			.locator('input[type="file"][accept="image/*"]')
			.setInputFiles({ name: 'cover.png', mimeType: 'image/png', buffer: makePng(2000, 1300) });
		await expect(page.getByAltText('Thumbnail preview')).toBeVisible({ timeout: 20_000 });
		expect(
			(await page.getByAltText('Thumbnail preview').getAttribute('src'))!.length
		).toBeLessThanOrEqual(LIMIT);

		await page.getByRole('button', { name: 'Create Post' }).click();
		await expect(page.getByText('Post Created', { exact: true })).toBeVisible({ timeout: 15_000 });

		const list = await (await request.get('/api/blog/list')).json();
		const created = list.find((p: any) => p.title === title);
		expect(created.thumbnail_url).toBe(`/thumbnails/${created.id}`);
		const res = await request.get(created.thumbnail_url);
		expect(res.headers()['content-type']).toMatch(/^image\//);
		await deletePost(request, created.id);
	});
});

test.describe('favicon upload', () => {
	test.afterEach(async ({ request }) => {
		await loginViaApi(request);
		await request.post('/api/settings', {
			data: { favicon: '/_favicon.ico', faviconPng: '/_favicon.png' }
		});
	});

	test('a PNG favicon chosen in settings is served at /favicon.png', async ({
		context,
		page,
		request
	}) => {
		await loginContext(context);
		await page.goto('/');
		await waitForHydration(page);
		await page.locator('button[title="Settings"], button:has([class*="settings"])').first().click();
		await expect(page.getByText('Favicon PNG')).toBeVisible();

		await page
			.locator('input[type="file"][accept="image/png"]')
			.setInputFiles({ name: 'icon.png', mimeType: 'image/png', buffer: makePng(700, 700) });
		await expect(page.getByAltText('Favicon PNG preview')).toBeVisible({ timeout: 20_000 });

		await page.getByRole('button', { name: 'Save Settings' }).click();
		await expect(page.getByText('Settings Updated', { exact: true })).toBeVisible({
			timeout: 15_000
		});

		const icon = await request.get('/favicon.png', { maxRedirects: 0 });
		expect(icon.status()).toBe(200);
		expect(icon.headers()['content-type']).toMatch(/^image\/(png|webp)$/);
		const settings = await (await request.get('/api/settings')).json();
		expect(settings.faviconPng).toBe('/favicon.png');
	});
});
