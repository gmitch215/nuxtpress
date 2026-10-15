import type { Page } from '@playwright/test';
import { expect, test } from './fixtures';
import { loginContext, loginViaApi } from './utils/auth';
import { waitForHydration } from './utils/hydration';
import { upload } from './utils/media';
import { makePng, makeWav } from './utils/png';
import { deletePost } from './utils/posts';

async function openNewPost(page: Page, context: import('@playwright/test').BrowserContext) {
	await loginContext(context);
	await page.goto('/');
	await waitForHydration(page);
	await page.getByRole('button', { name: /new post/i }).click();
	await expect(page.getByPlaceholder('Enter post title')).toBeVisible();
}

const mode = (page: Page, name: string) =>
	page.getByRole('group', { name: 'Post Type' }).getByRole('button', { name, exact: true });

async function findByTitle(page: Page, title: string) {
	const list = await (await page.request.get('/api/blog/list')).json();
	return list.find((p: any) => p.title === title);
}

async function recordWebm(page: Page): Promise<Buffer> {
	const base64 = await page.evaluate(async () => {
		const canvas = document.createElement('canvas');
		canvas.width = 160;
		canvas.height = 90;
		const ctx = canvas.getContext('2d')!;
		const recorder = new MediaRecorder(canvas.captureStream(10), {
			mimeType: 'video/webm;codecs=vp8'
		});
		const chunks: Blob[] = [];
		recorder.ondataavailable = (e) => chunks.push(e.data);
		const stopped = new Promise((resolve) => (recorder.onstop = resolve));
		recorder.start();
		for (let i = 0; i < 12; i++) {
			ctx.fillStyle = `hsl(${i * 30}, 80%, 50%)`;
			ctx.fillRect(0, 0, 160, 90);
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		recorder.stop();
		await stopped;
		const bytes = new Uint8Array(await new Blob(chunks).arrayBuffer());
		let binary = '';
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return btoa(binary);
	});
	return Buffer.from(base64, 'base64');
}

test.describe('post type editor', () => {
	test('offers the four types, with Article selected by default', async ({ context, page }) => {
		await openNewPost(page, context);
		for (const name of ['Article', 'Slideshow', 'Video', 'Music']) {
			await expect(mode(page, name)).toBeVisible();
		}
		await expect(mode(page, 'Article')).toHaveAttribute('aria-pressed', 'true');
		await expect(page.locator('.ProseMirror')).toBeVisible();
	});

	test('each mode keeps what you entered while you switch', async ({ context, page }) => {
		await openNewPost(page, context);
		await page.locator('.ProseMirror').click();
		await page.keyboard.press('ControlOrMeta+A');
		await page.keyboard.type(
			'Article text that stays put while the editor flips between post types.'
		);

		await mode(page, 'Slideshow').click();
		await expect(page.locator('.ProseMirror')).toHaveCount(0);
		await page
			.getByTestId('slide-input')
			.setInputFiles({ name: 'one.png', mimeType: 'image/png', buffer: makePng(40, 30) });
		await expect(page.getByLabel('Caption for slide 1')).toBeVisible({ timeout: 20_000 });
		await page.getByLabel('Caption for slide 1').fill('Kept caption');

		await mode(page, 'Video').click();
		await expect(page.getByTestId('video-input')).toHaveCount(1);
		await expect(page.getByLabel('Caption for slide 1')).toHaveCount(0);

		await mode(page, 'Slideshow').click();
		await expect(page.getByLabel('Caption for slide 1')).toHaveValue('Kept caption');

		await mode(page, 'Article').click();
		await expect(page.locator('.ProseMirror')).toContainText('Article text that stays put');
	});

	test('a slideshow is built from uploads, reordered, published and browsed', async ({
		context,
		page,
		request
	}) => {
		await openNewPost(page, context);
		const title = `Slideshow ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await mode(page, 'Slideshow').click();

		const create = page.getByRole('button', { name: 'Create Post' });
		await expect(create).toBeDisabled();

		await page.getByTestId('slide-input').setInputFiles([
			{ name: 'a.png', mimeType: 'image/png', buffer: makePng(60, 40) },
			{ name: 'b.png', mimeType: 'image/png', buffer: makePng(30, 50) },
			{ name: 'notes.txt', mimeType: 'text/plain', buffer: Buffer.from('ignored') }
		]);
		await expect(page.getByLabel('Caption for slide 2')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByLabel('Caption for slide 3')).toHaveCount(0);
		await page.getByLabel('Caption for slide 1').fill('Alpha');
		await page.getByLabel('Caption for slide 2').fill('Beta');
		await page.getByRole('button', { name: 'Move slide 1 down' }).click();
		await expect(page.getByLabel('Caption for slide 1')).toHaveValue('Beta');

		await expect(create).toBeEnabled({ timeout: 20_000 });
		await create.click();
		await expect(page.getByText('Post Created', { exact: true })).toBeVisible({ timeout: 15_000 });

		const post = await findByTitle(page, title);
		try {
			expect(post.type).toBe('slideshow');
			expect(post.thumbnail_url).toMatch(/^\/media\//);

			await page.goto(`/${post.slug}`);
			await waitForHydration(page);
			const counter = page.getByTestId('slide-counter');
			await expect(counter).toHaveText('1 / 2');
			await expect(page.getByText('Beta', { exact: true })).toBeVisible();
			await page.getByLabel('Next Slide').click();
			await expect(counter).toHaveText('2 / 2');
			await expect(page.getByText('Alpha', { exact: true })).toBeVisible();
			await page.getByRole('region', { name: title }).focus();
			await page.keyboard.press('ArrowRight');
			await expect(counter).toHaveText('1 / 2');
			await page.keyboard.press('ArrowLeft');
			await expect(counter).toHaveText('2 / 2');

			await page.goto('/');
			await expect(page.getByText('Slideshow', { exact: true }).first()).toBeVisible();
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('a video upload captures a poster and plays on the post page', async ({
		context,
		page,
		request
	}) => {
		await openNewPost(page, context);
		const title = `Video ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await mode(page, 'Video').click();
		await page.getByLabel('Caption').fill('A short clip for the test');

		const webm = await recordWebm(page);
		await page
			.getByTestId('video-input')
			.setInputFiles({ name: 'clip.webm', mimeType: 'video/webm', buffer: webm });

		await expect(page.locator('video')).toBeVisible({ timeout: 20_000 });
		await expect(page.getByPlaceholder(/example.com\/image/)).toHaveValue(/^\/media\//, {
			timeout: 20_000
		});

		await page.getByRole('button', { name: 'Create Post' }).click();
		await expect(page.getByText('Post Created', { exact: true })).toBeVisible({ timeout: 15_000 });

		const post = await findByTitle(page, title);
		try {
			expect(post.type).toBe('video');
			await page.goto(`/${post.slug}`);
			await waitForHydration(page);
			const video = page.locator('article video');
			await expect(video).toBeVisible();
			await expect(video).toHaveAttribute('src', /^\/media\//);
			await expect(video).toHaveAttribute('poster', /^\/media\//);
			await expect(page.getByText('A short clip for the test')).toBeVisible();
			const range = await request.get(await video.getAttribute('src')!, {
				headers: { range: 'bytes=0-99' }
			});
			expect(range.status()).toBe(206);
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('a music upload plays through an audio element', async ({ context, page, request }) => {
		await openNewPost(page, context);
		const title = `Music ${Date.now()}`;
		await page.getByPlaceholder('Enter post title').fill(title);
		await mode(page, 'Music').click();
		await page
			.getByTestId('music-input')
			.setInputFiles({ name: 'tone.wav', mimeType: 'audio/wav', buffer: makeWav(1) });
		await expect(page.locator('audio')).toBeVisible({ timeout: 20_000 });

		await page.getByRole('button', { name: 'Create Post' }).click();
		await expect(page.getByText('Post Created', { exact: true })).toBeVisible({ timeout: 15_000 });

		const post = await findByTitle(page, title);
		try {
			expect(post.type).toBe('music');
			await page.goto(`/${post.slug}`);
			await waitForHydration(page);
			await expect(page.locator('article audio')).toHaveAttribute('src', /^\/media\//);
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('a file of the wrong type is refused with a message', async ({ context, page }) => {
		await openNewPost(page, context);
		await mode(page, 'Video').click();
		await page
			.getByTestId('video-input')
			.setInputFiles({ name: 'song.mp3', mimeType: 'audio/mpeg', buffer: Buffer.from('x') });
		await expect(page.getByText('That file type is not supported for video')).toBeVisible();
		await expect(page.locator('video')).toHaveCount(0);
	});

	test('editing a saved media post locks its type and can replace the file', async ({
		context,
		page,
		request
	}) => {
		await loginContext(context);
		await loginViaApi(request);
		const first = await upload(request, 'audio/wav', makeWav(1));
		const created = await request.post('/api/blog/create', {
			data: {
				post: {
					title: `Edit music ${Date.now()}`,
					slug: `edit-music-${Date.now()}`,
					type: 'music',
					content: '',
					media: [{ key: first.key }],
					tags: []
				}
			}
		});
		const post = await created.json();
		try {
			await page.goto(`/${post.slug}`);
			await waitForHydration(page);
			await page.locator('header button').first().click();
			await expect(page.getByRole('group', { name: 'Post Type' })).toHaveCount(0);
			await expect(page.getByText('Music', { exact: true }).first()).toBeVisible();

			await page.getByRole('button', { name: 'Remove' }).click();
			await page
				.getByTestId('music-input')
				.setInputFiles({ name: 'second.wav', mimeType: 'audio/wav', buffer: makeWav(2) });
			await expect(page.locator('audio').first()).toBeVisible({ timeout: 20_000 });
			await page.getByRole('button', { name: 'Update Post' }).click();
			await expect(page.getByText('Post Updated', { exact: true })).toBeVisible({
				timeout: 15_000
			});

			const after = await (await request.get('/api/blog/list')).json();
			expect(after.find((p: any) => p.id === post.id).type).toBe('music');
			expect((await request.get(first.url)).status()).toBe(404);
		} finally {
			await deletePost(request, post.id);
		}
	});
});
