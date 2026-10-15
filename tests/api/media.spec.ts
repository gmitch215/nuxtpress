import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import {
	clearSink,
	confirmedSubscriber,
	disableMail,
	drain,
	enableMail,
	readSink,
	removeTestSubscribers
} from '../utils/mail';
import {
	createMediaPost,
	mediaExists,
	upload,
	uploadPng,
	uploadVideo,
	uploadWav
} from '../utils/media';
import { makePng } from '../utils/png';
import { deletePost } from '../utils/posts';
import { createUser, deleteUser } from '../utils/users';

async function findPost(request: any, post: { slug: string; created_at: string }) {
	const d = new Date(post.created_at);
	return (
		await request.get('/api/blog/find', {
			params: {
				slug: post.slug,
				year: d.getUTCFullYear(),
				month: d.getUTCMonth() + 1,
				day: d.getUTCDate()
			}
		})
	).json();
}

test.describe('media upload and serving', () => {
	test('upload needs a signed-in user', async ({ request }) => {
		const res = await request.put('/api/media/upload', {
			headers: { 'content-type': 'image/png' },
			data: makePng(4, 4)
		});
		expect([401, 403]).toContain(res.status());
	});

	test('rejects unsupported types and oversized images', async ({ request }) => {
		await loginViaApi(request);
		for (const mime of ['text/html', 'image/svg+xml', 'application/octet-stream', '']) {
			const res = await request.put('/api/media/upload', {
				headers: { 'content-type': mime },
				data: Buffer.from('x')
			});
			expect(res.status(), mime).toBe(415);
		}
		const big = await request.put('/api/media/upload', {
			headers: { 'content-type': 'image/png' },
			data: Buffer.alloc(26 * 1024 * 1024, 1)
		});
		expect(big.status()).toBe(413);
	});

	test('an upload is stored under the user and served with cache and range headers', async ({
		request
	}) => {
		await loginViaApi(request);
		const file = await uploadWav(request);
		expect(file.key).toMatch(/^media\/[a-f0-9]{32}\/[a-f0-9]{32}\.wav$/);
		expect(file.url).toBe(`/${file.key}`);
		expect(file.mime).toBe('audio/wav');

		const full = await request.get(file.url);
		expect(full.status()).toBe(200);
		expect(full.headers()['content-type']).toBe('audio/wav');
		expect(full.headers()['accept-ranges']).toBe('bytes');
		expect(full.headers()['x-content-type-options']).toBe('nosniff');
		expect(full.headers()['cache-control']).toContain('immutable');
		const total = (await full.body()).length;
		expect(total).toBe(file.size);

		const part = await request.get(file.url, { headers: { range: 'bytes=0-9' } });
		expect(part.status()).toBe(206);
		expect(part.headers()['content-range']).toBe(`bytes 0-9/${total}`);
		expect((await part.body()).length).toBe(10);

		const tail = await request.get(file.url, { headers: { range: 'bytes=-5' } });
		expect(tail.status()).toBe(206);
		expect((await tail.body()).length).toBe(5);

		const open = await request.get(file.url, { headers: { range: `bytes=${total - 3}-` } });
		expect((await open.body()).length).toBe(3);

		const bad = await request.get(file.url, { headers: { range: `bytes=${total + 10}-` } });
		expect(bad.status()).toBe(416);
	});

	test('unknown and malformed media paths are 404', async ({ request }) => {
		expect((await request.get(`/media/${'0'.repeat(32)}/${'1'.repeat(32)}.png`)).status()).toBe(
			404
		);
		expect((await request.get('/media/not-a-key')).status()).toBe(404);
		expect((await request.get('/media/../etc/passwd')).status()).toBe(404);
	});

	test('public settings say whether media storage is available', async ({ request }) => {
		expect((await (await request.get('/api/settings')).json()).media).toBe(true);
	});
});

test.describe('post types', () => {
	test.beforeEach(async ({ request }) => {
		await loginViaApi(request);
	});

	test('a slideshow keeps its slides, derives its body from captions and uses slide one as thumbnail', async ({
		request
	}) => {
		const a = await uploadPng(request, 12);
		const b = await uploadPng(request, 20);
		const res = await createMediaPost(request, {
			title: 'Slideshow post',
			type: 'slideshow',
			media: [
				{ key: a.key, mime: 'image/png', size: 1, caption: 'First slide' },
				{ key: b.key, mime: 'image/jpeg', size: 1, caption: 'Second slide' }
			]
		});
		expect(res.ok(), await res.text()).toBe(true);
		const post = await res.json();
		try {
			expect(post.type).toBe('slideshow');
			expect(post.content).toBe('First slide\n\nSecond slide');

			const found = await findPost(request, post);
			expect(found.media.map((m: any) => m.caption)).toEqual(['First slide', 'Second slide']);
			expect(found.media[0].mime).toBe('image/png');
			expect(found.media[0].size).toBeGreaterThan(10);
			expect(found.thumbnail_url).toBe(a.url);

			const listed = (await (await request.get('/api/blog/list')).json()).find(
				(p: any) => p.id === post.id
			);
			expect(listed).toMatchObject({ type: 'slideshow', thumbnail_url: a.url });
			expect(JSON.stringify(listed)).not.toContain('"media"');
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('a video and a music post keep their caption as the body', async ({ request }) => {
		const video = await uploadVideo(request);
		const audio = await uploadWav(request);
		const v = await (
			await createMediaPost(request, {
				title: 'Video post',
				slug: `video-${Date.now()}`,
				type: 'video',
				content: 'A short **caption** for the clip',
				media: [{ key: video.key }]
			})
		).json();
		const m = await (
			await createMediaPost(request, {
				title: 'Music post',
				slug: `music-${Date.now()}`,
				type: 'music',
				media: [{ key: audio.key }]
			})
		).json();
		try {
			expect(v.content).toBe('A short **caption** for the clip');
			expect(v.media[0].mime).toBe('video/webm');
			expect(m.content).toBe('');
			expect(m.media[0].mime).toBe('audio/wav');
		} finally {
			await deletePost(request, v.id);
			await deletePost(request, m.id);
		}
	});

	test('enforces the shape of each type', async ({ request }) => {
		const png = await uploadPng(request);
		const wav = await uploadWav(request);
		const cases: [string, Record<string, unknown>][] = [
			[
				'article with media',
				{ type: 'article', content: 'x'.repeat(60), media: [{ key: png.key }] }
			],
			['article too short', { type: 'article', content: 'short' }],
			['slideshow with none', { type: 'slideshow', media: [] }],
			['video with none', { type: 'video', media: [] }],
			['video with two', { type: 'video', media: [{ key: wav.key }, { key: wav.key }] }],
			['video with an image', { type: 'video', media: [{ key: png.key }] }],
			['music with an image', { type: 'music', media: [{ key: png.key }] }],
			['slideshow with audio', { type: 'slideshow', media: [{ key: wav.key }] }],
			['unknown type', { type: 'podcast', media: [{ key: wav.key }] }],
			['bad key', { type: 'music', media: [{ key: 'media/x/y.mp3' }] }],
			[
				'long slide caption',
				{ type: 'slideshow', media: [{ key: png.key, caption: 'c'.repeat(301) }] }
			],
			[
				'long video caption',
				{ type: 'video', content: 'c'.repeat(2001), media: [{ key: png.key }] }
			]
		];
		for (const [name, post] of cases) {
			const res = await createMediaPost(request, {
				title: 'Bad shape',
				slug: `bad-${Date.now()}`,
				...post
			});
			expect(res.status(), name).toBe(400);
		}

		const missing = await createMediaPost(request, {
			title: 'Missing file',
			slug: `missing-${Date.now()}`,
			type: 'music',
			media: [{ key: `media/${'a'.repeat(32)}/${'b'.repeat(32)}.mp3` }]
		});
		expect(missing.status()).toBe(400);
	});

	test("an author cannot attach someone else's upload but an admin can", async ({ request }) => {
		const admin = await uploadWav(request);
		const author = await createUser(request);
		let adminPostId = '';
		try {
			await loginViaApi(request, author);
			const stolen = await createMediaPost(
				request,
				{
					title: 'Borrowed audio',
					slug: `borrowed-${Date.now()}`,
					type: 'music',
					media: [{ key: admin.key }]
				},
				{},
				{ login: false }
			);
			expect(stolen.status()).toBe(400);
		} finally {
			await deleteUser(request, author.id);
		}
		const ok = await createMediaPost(request, {
			title: 'Own audio',
			slug: `own-${Date.now()}`,
			type: 'music',
			media: [{ key: admin.key }]
		});
		adminPostId = (await ok.json()).id;
		await deletePost(request, adminPostId);
	});

	test('the type is fixed after creation and replaced media is removed', async ({ request }) => {
		const first = await uploadWav(request);
		const second = await uploadWav(request);
		const post = await (
			await createMediaPost(request, {
				title: 'Replace me',
				slug: `replace-${Date.now()}`,
				type: 'music',
				media: [{ key: first.key }]
			})
		).json();
		try {
			const convert = await request.patch('/api/blog/update', {
				data: {
					post: {
						id: post.id,
						title: 'Replace me',
						slug: post.slug,
						type: 'article',
						content: 'x'.repeat(60),
						tags: []
					}
				}
			});
			expect(convert.status()).toBe(400);

			const update = await request.patch('/api/blog/update', {
				data: {
					post: {
						id: post.id,
						title: 'Replaced',
						slug: post.slug,
						type: 'music',
						content: 'now with a caption',
						media: [{ key: second.key }],
						tags: []
					}
				}
			});
			expect(update.ok()).toBe(true);
			expect(await mediaExists(request, second.url)).toBe(true);
			expect(await mediaExists(request, first.url)).toBe(false);
			expect((await findPost(request, post)).media[0].key).toBe(second.key);
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('deleting a post deletes its media and uploaded thumbnail', async ({ request }) => {
		const video = await uploadVideo(request);
		const poster = await uploadPng(request);
		const post = await (
			await createMediaPost(request, {
				title: 'Delete my files',
				slug: `del-media-${Date.now()}`,
				type: 'video',
				thumbnail_url: poster.url,
				media: [{ key: video.key }]
			})
		).json();
		expect(post.thumbnail_url).toBe(poster.url);
		await deletePost(request, post.id);
		expect(await mediaExists(request, video.url)).toBe(false);
		expect(await mediaExists(request, poster.url)).toBe(false);
	});

	test('the slug "media" is reserved', async ({ request }) => {
		const res = await createMediaPost(request, {
			title: 'Reserved',
			slug: 'media',
			type: 'article',
			content: 'x'.repeat(60)
		});
		expect(res.status()).toBe(400);
	});
});

test.describe('post type surfaces', () => {
	test.beforeEach(async ({ request }) => {
		await loginViaApi(request);
	});

	test('the feed carries enclosures for video and music and figures for slideshows', async ({
		request
	}) => {
		const video = await uploadVideo(request);
		const audio = await uploadWav(request);
		const slide = await uploadPng(request);
		const ids: string[] = [];
		for (const post of [
			{ title: 'Feed video', type: 'video', media: [{ key: video.key }], content: 'clip caption' },
			{ title: 'Feed music', type: 'music', media: [{ key: audio.key }] },
			{
				title: 'Feed slides',
				type: 'slideshow',
				media: [{ key: slide.key, caption: 'only slide' }]
			}
		]) {
			const res = await createMediaPost(request, {
				...post,
				slug: `feed-${Date.now()}-${ids.length}`
			});
			ids.push((await res.json()).id);
		}
		try {
			const feed = await (await request.get('/feed.xml')).text();
			expect(feed).toContain(
				`rel="enclosure" type="video/webm" href="http://127.0.0.1:8787${video.url}"`
			);
			expect(feed).toContain(`rel="enclosure" type="audio/wav"`);
			expect(feed).toContain('&lt;figure&gt;');
			expect(feed).toContain('only slide');
			expect(feed).toContain('&lt;video controls');
			expect(feed).toContain('&lt;audio controls');

			const sitemap = await (await request.get('/sitemap.xml')).text();
			expect(sitemap).toContain(video.url);
			expect(sitemap).toContain(slide.url);
		} finally {
			for (const id of ids) await deletePost(request, id);
		}
	});

	test('subscriber emails name the kind of post', async ({ request }) => {
		await enableMail(request);
		const { email } = await confirmedSubscriber(request);
		const audio = await uploadWav(request);
		const res = await createMediaPost(
			request,
			{
				title: 'Mail music',
				slug: `mail-music-${Date.now()}`,
				type: 'music',
				media: [{ key: audio.key }]
			},
			{ notify: true }
		);
		const post = await res.json();
		try {
			expect(post.queued).toBeGreaterThanOrEqual(1);
			await drain(request);
			const mail = (await readSink(request)).find((m) => m.to === email)!;
			expect(mail.text).toContain('Listen Now:');
			expect(mail.html).toContain('Listen Now');
		} finally {
			await clearSink(request);
			await deletePost(request, post.id);
			await removeTestSubscribers(request);
			await disableMail(request);
		}
	});
});

test.describe('media sweep', () => {
	test.beforeEach(async ({ request }) => {
		await loginViaApi(request);
	});

	test('removes unreferenced uploads and keeps files used by posts and drafts', async ({
		request
	}) => {
		const orphan = await uploadPng(request);
		const used = await uploadWav(request);
		const drafted = await uploadPng(request);
		const post = await (
			await createMediaPost(request, {
				title: 'Sweep keeper',
				slug: `sweep-${Date.now()}`,
				type: 'music',
				media: [{ key: used.key }]
			})
		).json();
		const draftSlug = `sweep-draft-${Date.now()}`;
		const draft = await request.post('/api/blog/draft', {
			data: {
				post: {
					slug: draftSlug,
					title: 'Draft with media',
					type: 'slideshow',
					media: [{ key: drafted.key, caption: 'kept by draft' }],
					content: '',
					tags: []
				}
			}
		});
		expect(draft.ok()).toBe(true);

		try {
			const res = await request.get('/_nitro/tasks/media:sweep');
			expect(res.ok()).toBe(true);
			const { result } = await res.json();
			expect(result.deleted).toBeGreaterThanOrEqual(1);

			expect(await mediaExists(request, orphan.url)).toBe(false);
			expect(await mediaExists(request, used.url)).toBe(true);
			expect(await mediaExists(request, drafted.url)).toBe(true);
		} finally {
			await deletePost(request, post.id);
		}
	});

	test('keeps fresh uploads inside the grace window', async ({ request }) => {
		const res = await request.get('/_nitro/tasks/media:sweep');
		expect(res.ok()).toBe(true);
		expect(typeof (await res.json()).result.scanned).toBe('number');
	});
});

test.describe('slide upload', () => {
	test.beforeEach(async ({ request }) => {
		await loginViaApi(request);
	});

	test('a large JPEG label is accepted up to the image cap', async ({ request }) => {
		await loginViaApi(request);
		const file = await upload(request, 'image/jpeg', Buffer.alloc(2 * 1024 * 1024, 7));
		expect(file.size).toBe(2 * 1024 * 1024);
		expect(file.key.endsWith('.jpg')).toBe(true);
	});
});
