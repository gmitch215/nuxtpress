import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import { createPost, deletePost } from '../utils/posts';

// the test lane runs the fs-lite kv driver, where a key maps to a file path with ':' as '/'
const KV_DIR = join(process.env.NUXTPRESS_DATA_DIR || '.data', 'kv');
const LEGACY_INDEX = join(KV_DIR, 'analytics', 'slugs');

/** Writes an event in the pre-v1.4 shape: no vsid, and the slug listed in one JSON array. */
async function seedLegacyEvent(slug: string, day: string) {
	const dir = join(KV_DIR, 'analytics', 'evt', day, slug);
	await mkdir(dir, { recursive: true });
	await writeFile(
		join(dir, 'legacyevent0000000000000000000000'),
		JSON.stringify({
			slug,
			ts: Date.now(),
			vid: 'legacyvisitor',
			active: 4321,
			depth: 50,
			referrer: 'direct',
			device: 'desktop',
			browser: 'firefox',
			isExit: true
		})
	);

	let slugs: string[] = [];
	try {
		slugs = JSON.parse(await readFile(LEGACY_INDEX, 'utf8'));
	} catch {
		slugs = [];
	}
	if (!slugs.includes(slug)) slugs.push(slug);
	await writeFile(LEGACY_INDEX, JSON.stringify(slugs));
}

async function unseedLegacyEvent(slug: string, day: string) {
	await rm(join(KV_DIR, 'analytics', 'evt', day, slug), { recursive: true, force: true });
	try {
		const slugs: string[] = JSON.parse(await readFile(LEGACY_INDEX, 'utf8'));
		await writeFile(LEGACY_INDEX, JSON.stringify(slugs.filter((s) => s !== slug)));
	} catch {
		// nothing to prune
	}
}

const BEACON = {
	kind: 'post' as const,
	active: 5000,
	depth: 75 as const,
	referrer: 'direct' as const,
	isExit: false
};

test.describe('analytics API', () => {
	test('POST /api/analytics/track returns 204 for valid payload', async ({ request }) => {
		const res = await request.post('/api/analytics/track', {
			data: { ...BEACON, slug: 'test-track', vsid: 'aaaaaaaaaaaaaaaa' }
		});
		expect([200, 204]).toContain(res.status());
	});

	test('POST /api/analytics/track silently drops invalid body (204)', async ({ request }) => {
		const res = await request.post('/api/analytics/track', { data: { nope: true } });
		expect([200, 204]).toContain(res.status());
	});

	test('GET /api/analytics/summary is admin-only', async ({ request }) => {
		const res = await request.get('/api/analytics/summary?range=7d');
		expect([401, 403]).toContain(res.status());
	});

	test('admin can read /api/analytics/summary for each range', async ({ request }) => {
		await loginViaApi(request);
		for (const range of ['7d', '30d', '90d', 'all']) {
			const res = await request.get(`/api/analytics/summary?range=${range}`);
			expect(res.ok(), `range ${range}`).toBe(true);
			const body = await res.json();
			for (const key of [
				'kpis',
				'perDay',
				'topPosts',
				'topPages',
				'refs',
				'refHosts',
				'devices',
				'browsers',
				'os',
				'countries',
				'audience'
			]) {
				expect(body, `range ${range} missing ${key}`).toHaveProperty(key);
			}
			expect(body.range).toBe(range);
		}
	});

	test('a tracked beacon actually shows up in the summary', async ({ request }) => {
		const slug = `an-real-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Analytics Data Post',
			slug,
			content: 'A post used to verify tracked beacons land in the analytics summary.'
		});

		const track = await request.post('/api/analytics/track', {
			data: { ...BEACON, slug, vsid: `v${Date.now()}`, depth: 100, active: 9000 }
		});
		expect([200, 204]).toContain(track.status());

		await loginViaApi(request);
		const res = await request.get('/api/analytics/summary?range=7d');
		expect(res.ok()).toBe(true);
		const body = await res.json();

		const row = body.topPosts.find((p: any) => p.slug === slug);
		expect(row, `slug ${slug} not in topPosts`).toBeTruthy();
		expect(row.views).toBeGreaterThan(0);
		expect(row.avgActiveMs).toBeGreaterThan(0);
		expect(body.kpis.views.value).toBeGreaterThan(0);
		expect(body.kpis.unique.value).toBeGreaterThan(0);

		await deletePost(request, post.id);
	});

	test('repeated beacons for one visit count as a single view', async ({ request }) => {
		const slug = `an-visit-${Date.now()}`;
		const post = await createPost(request, {
			title: 'Single Visit Post',
			slug,
			content: 'A post used to verify heartbeat beacons do not each count as a separate view.'
		});
		const vsid = `visit${Date.now()}`;

		// arrival, two heartbeats and an exit, exactly as the client sends them
		for (const [active, depth, isExit] of [
			[0, 0, false],
			[30_000, 50, false],
			[60_000, 100, false],
			[61_000, 100, true]
		] as const) {
			const res = await request.post('/api/analytics/track', {
				data: { slug, kind: 'post', vsid, active, depth, referrer: 'direct', isExit }
			});
			expect([200, 204]).toContain(res.status());
		}

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		const row = body.topPosts.find((p: any) => p.slug === slug);

		expect(row, `slug ${slug} not tracked`).toBeTruthy();
		expect(row.views, 'four beacons for one visit must fold into one view').toBe(1);
		// cumulative active time folds with max(), not sum()
		expect(row.avgActiveMs).toBe(61_000);
		expect(row.completionRate).toBe(1);

		await deletePost(request, post.id);
	});

	test('page views are tracked separately from posts', async ({ request }) => {
		const path = `/tags`;
		const res = await request.post('/api/analytics/track', {
			data: {
				slug: path,
				kind: 'page',
				vsid: `page${Date.now()}`,
				active: 1200,
				depth: 25,
				referrer: 'direct',
				isExit: true
			}
		});
		expect([200, 204]).toContain(res.status());

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		expect(body.topPages.some((p: any) => p.slug === path)).toBe(true);
		expect(body.topPosts.some((p: any) => p.slug === path)).toBe(false);
	});

	test('a Do Not Track request is not recorded', async ({ request }) => {
		const slug = `an-dnt-${Date.now()}`;
		const res = await request.post('/api/analytics/track', {
			headers: { DNT: '1' },
			data: { ...BEACON, slug, vsid: `dnt${Date.now()}` }
		});
		expect([200, 204]).toContain(res.status());

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		expect(body.topPosts.some((p: any) => p.slug === slug)).toBe(false);
	});

	test('a Global Privacy Control request is not recorded', async ({ request }) => {
		const slug = `an-gpc-${Date.now()}`;
		await request.post('/api/analytics/track', {
			headers: { 'Sec-GPC': '1' },
			data: { ...BEACON, slug, vsid: `gpc${Date.now()}` }
		});

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		expect(body.topPosts.some((p: any) => p.slug === slug)).toBe(false);
	});

	test('an obvious crawler is not recorded', async ({ request }) => {
		const slug = `an-bot-${Date.now()}`;
		await request.post('/api/analytics/track', {
			headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GPTBot/1.0; +https://openai.com/gptbot)' },
			data: { ...BEACON, slug, vsid: `bot${Date.now()}` }
		});

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		expect(body.topPosts.some((p: any) => p.slug === slug)).toBe(false);
	});

	test('events written by a pre-v1.4 install are still folded in', async ({ request }) => {
		// pre-v1.4 kept every slug in one JSON array and wrote events without a vsid. The reader
		// has to pick both up or an upgraded site's existing analytics stay orphaned until TTL.
		const slug = `an-legacy-${Date.now()}`;
		const day = new Date().toISOString().slice(0, 10);
		await seedLegacyEvent(slug, day);

		try {
			await loginViaApi(request);
			const body = await (await request.get('/api/analytics/summary?range=7d')).json();
			const row = body.topPosts.find((p: any) => p.slug === slug);

			expect(row, `legacy slug ${slug} was not folded in`).toBeTruthy();
			expect(row.views).toBe(1);
			expect(row.avgActiveMs).toBe(4321);
		} finally {
			await unseedLegacyEvent(slug, day);
		}
	});

	test('the summary reports os, country and audience dimensions', async ({ request }) => {
		const slug = `an-dims-${Date.now()}`;
		await request.post('/api/analytics/track', {
			headers: {
				'User-Agent':
					'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36',
				'CF-IPCountry': 'DE'
			},
			data: { ...BEACON, slug, vsid: `dims${Date.now()}` }
		});

		await loginViaApi(request);
		const body = await (await request.get('/api/analytics/summary?range=7d')).json();

		expect(Object.keys(body.os).length).toBeGreaterThan(0);
		expect(body.os).toHaveProperty('macos');
		expect(body.browsers).toHaveProperty('chrome');
		expect(body.countries).toHaveProperty('DE');
		expect(body.audience.anonymous).toBeGreaterThan(0);
		expect(typeof body.audience.loggedInRate).toBe('number');
	});

	test('a signed-in view is counted as signed in, without storing who', async ({ request }) => {
		await loginViaApi(request);
		const slug = `an-auth-${Date.now()}`;
		await request.post('/api/analytics/track', {
			data: { ...BEACON, slug, vsid: `auth${Date.now()}` }
		});

		const body = await (await request.get('/api/analytics/summary?range=7d')).json();
		expect(body.audience.loggedIn).toBeGreaterThan(0);
		// the summary exposes counts only, never an identity
		expect(JSON.stringify(body)).not.toContain('admin');
	});
});
