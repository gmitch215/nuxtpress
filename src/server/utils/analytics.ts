import { kv } from 'hub:kv';

export type EventKind = 'post' | 'page';

export type RawEvent = {
	slug: string;
	kind: EventKind;
	/** per-visit id; a visit's beacons all share it so folding can dedupe them */
	vsid: string;
	ts: number;
	vid: string;
	active: number;
	depth: 0 | 25 | 50 | 75 | 100;
	referrer: 'external' | 'internal' | 'direct';
	refHost: string;
	device: 'mobile' | 'tablet' | 'desktop';
	browser: string;
	os: string;
	country: string;
	loggedIn: boolean;
	isExit: boolean;
};

export type Dims = {
	refs: Record<string, number>;
	refHosts: Record<string, number>;
	devices: Record<string, number>;
	browsers: Record<string, number>;
	os: Record<string, number>;
	countries: Record<string, number>;
	audience: { loggedIn: number; anonymous: number };
};

export type PathStats = {
	views: number;
	vids: string[];
	activeSum: number;
	activeSamples: number;
	depth100: number;
};

export type DailyRollup = {
	day: string;
	views: number;
	vids: string[];
	activeSum: number;
	activeSamples: number;
	depth: { 25: number; 50: number; 75: number; 100: number };
	dims: Dims;
	bySlug: Record<string, PathStats>;
	byPage: Record<string, PathStats>;
};

export type MonthlyRollup = Omit<DailyRollup, 'day'> & {
	month: string;
	perDay: { day: string; views: number; unique: number }[];
};

// caps bound worst-case rollup size; unique counts saturate rather than grow without limit
const MAX_VIDS_PER_DAY = 5000;
const MAX_VIDS_PER_PATH = 2000;
const MAX_DIM_KEYS = 200;
const KV_READ_CHUNK = 16;

const EVENT_TTL = 60 * 60 * 24 * 90;

// slug is percent-encoded because page paths contain slashes and unstorage treats both ':' and
// '/' as key separators; the real slug is carried in the event body, not read back from the key
const eventPrefix = (slug: string, day: string) =>
	`analytics:evt:${day}:${encodeURIComponent(slug)}`;
const rollupKey = (day: string) => `analytics:rollup:${day}`;
const monthlyKey = (month: string) => `analytics:mrollup:${month}`;
const SLUG_INDEX_PREFIX = 'analytics:slug:';
const LEGACY_SLUG_INDEX_KEY = 'analytics:slugs';
const LEGACY_SLUG_INDEX_SUFFIX = 'slugs';

function ymd(d: Date): string {
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
		d.getUTCDate()
	).padStart(2, '0')}`;
}

export function todayUTC(): string {
	return ymd(new Date());
}

export function daysAgoUTC(n: number): string {
	return ymd(new Date(Date.now() - n * 24 * 60 * 60 * 1000));
}

export function* dayRange(fromDay: string, toDay: string): Generator<string> {
	let cur = new Date(`${fromDay}T00:00:00.000Z`);
	const end = new Date(`${toDay}T00:00:00.000Z`);
	while (cur <= end) {
		yield ymd(cur);
		cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
	}
}

const monthOf = (day: string) => day.slice(0, 7);

function lastDayOfMonth(month: string): string {
	const [y, m] = month.split('-').map(Number);
	return ymd(new Date(Date.UTC(y!, m!, 0)));
}

function firstDayOfMonth(month: string): string {
	return `${month}-01`;
}

async function chunked<T, R>(items: T[], fn: (item: T) => Promise<R>): Promise<R[]> {
	const out: R[] = [];
	for (let i = 0; i < items.length; i += KV_READ_CHUNK) {
		out.push(...(await Promise.all(items.slice(i, i + KV_READ_CHUNK).map(fn))));
	}
	return out;
}

/**
 * Slug index as one key per slug. A single JSON array here would be a read-modify-write on a
 * hot key, which loses writes under concurrency.
 */
export async function recordSlug(slug: string) {
	try {
		await kv.set(`${SLUG_INDEX_PREFIX}${encodeURIComponent(slug)}`, '1');
	} catch {}
}

export async function getSlugs(): Promise<string[]> {
	const slugs = new Set<string>();

	try {
		for (const key of await kv.keys(SLUG_INDEX_PREFIX)) {
			// the legacy index key sits alongside these markers; it is read separately below
			if (key === LEGACY_SLUG_INDEX_KEY || key.endsWith(`:${LEGACY_SLUG_INDEX_SUFFIX}`)) continue;
			const raw = key.slice(key.lastIndexOf(':') + 1);
			try {
				slugs.add(decodeURIComponent(raw));
			} catch {
				slugs.add(raw);
			}
		}
	} catch {}

	// pre-v1.4 installs kept every slug in one JSON array; without this their existing events
	// would never be enumerated again and would sit in KV until their TTL expired
	try {
		const raw = await kv.get<string>(LEGACY_SLUG_INDEX_KEY);
		const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
		if (Array.isArray(parsed)) {
			for (const slug of parsed) {
				if (typeof slug === 'string' && slug) slugs.add(slug);
			}
		}
	} catch {}

	return [...slugs];
}

export async function writeEvent(day: string, evt: RawEvent) {
	const id = crypto.randomUUID().replace(/-/g, '');
	await kv.set(`${eventPrefix(evt.slug, day)}:${id}`, JSON.stringify(evt), { ttl: EVENT_TTL });
}

async function listRawEventsForDay(day: string): Promise<RawEvent[]> {
	const slugs = await getSlugs();

	const keyLists = await chunked(slugs, async (slug) => {
		try {
			return await kv.keys(`${eventPrefix(slug, day)}:`);
		} catch {
			return [] as string[];
		}
	});

	const keys = keyLists.flat();
	const raws = await chunked(keys, async (key) => {
		try {
			return await kv.get<string>(key);
		} catch {
			return null;
		}
	});

	const events: RawEvent[] = [];
	for (const raw of raws) {
		if (!raw) continue;
		try {
			events.push(typeof raw === 'string' ? (JSON.parse(raw) as RawEvent) : (raw as RawEvent));
		} catch {}
	}
	return events;
}

function emptyDims(): Dims {
	return {
		refs: {},
		refHosts: {},
		devices: {},
		browsers: {},
		os: {},
		countries: {},
		audience: { loggedIn: 0, anonymous: 0 }
	};
}

function emptyPathStats(): PathStats {
	return { views: 0, vids: [], activeSum: 0, activeSamples: 0, depth100: 0 };
}

export function emptyRollup(day: string): DailyRollup {
	return {
		day,
		views: 0,
		vids: [],
		activeSum: 0,
		activeSamples: 0,
		depth: { 25: 0, 50: 0, 75: 0, 100: 0 },
		dims: emptyDims(),
		bySlug: {},
		byPage: {}
	};
}

function bump(target: Record<string, number>, key: string, by = 1) {
	if (target[key] === undefined && Object.keys(target).length >= MAX_DIM_KEYS) return;
	target[key] = (target[key] || 0) + by;
}

function mergeCounts(into: Record<string, number>, from: Record<string, number> | undefined) {
	for (const [key, value] of Object.entries(from || {})) bump(into, key, value);
}

function mergePathStats(
	into: Record<string, PathStats>,
	from: Record<string, PathStats> | undefined
) {
	for (const [path, part] of Object.entries(from || {})) {
		const bucket = into[path] || emptyPathStats();
		bucket.views += part.views || 0;
		bucket.activeSum += part.activeSum || 0;
		bucket.activeSamples += part.activeSamples || 0;
		bucket.depth100 += part.depth100 || 0;
		for (const vid of part.vids || []) {
			if (bucket.vids.length >= MAX_VIDS_PER_PATH) break;
			if (!bucket.vids.includes(vid)) bucket.vids.push(vid);
		}
		into[path] = bucket;
	}
}

/** Lifts pre-v1.4 rollups (flat refs/devices/browsers, no byPage) into the current shape. */
export function normalizeRollup(raw: any, day: string): DailyRollup {
	const base = emptyRollup(day);
	if (!raw || typeof raw !== 'object') return base;

	const dims: Dims = emptyDims();
	const source = raw.dims && typeof raw.dims === 'object' ? raw.dims : raw;
	mergeCounts(dims.refs, source.refs);
	mergeCounts(dims.refHosts, source.refHosts);
	mergeCounts(dims.devices, source.devices);
	mergeCounts(dims.browsers, source.browsers);
	mergeCounts(dims.os, source.os);
	mergeCounts(dims.countries, source.countries);
	dims.audience = {
		loggedIn: Number(source.audience?.loggedIn || 0),
		anonymous: Number(source.audience?.anonymous || 0)
	};

	const bySlug: Record<string, PathStats> = {};
	mergePathStats(bySlug, raw.bySlug);
	const byPage: Record<string, PathStats> = {};
	mergePathStats(byPage, raw.byPage);

	return {
		day: raw.day || day,
		views: Number(raw.views || 0),
		vids: Array.isArray(raw.vids) ? raw.vids.slice(0, MAX_VIDS_PER_DAY) : [],
		activeSum: Number(raw.activeSum || 0),
		activeSamples: Number(raw.activeSamples || 0),
		depth: {
			25: Number(raw.depth?.[25] || 0),
			50: Number(raw.depth?.[50] || 0),
			75: Number(raw.depth?.[75] || 0),
			100: Number(raw.depth?.[100] || 0)
		},
		dims,
		bySlug,
		byPage
	};
}

/**
 * Folds a day's beacons into per-visit facts first, then counts. A visit sends a beacon on
 * arrival, every 30s of active time and on exit, all carrying cumulative active time and max
 * scroll depth — counting the raw beacons instead would inflate views and every dimension by
 * however long the reader stayed.
 */
export function foldEvents(day: string, events: RawEvent[]): DailyRollup {
	const r = emptyRollup(day);

	type Visit = {
		slug: string;
		kind: EventKind;
		vid: string;
		active: number;
		depth: 0 | 25 | 50 | 75 | 100;
		referrer: RawEvent['referrer'];
		refHost: string;
		device: string;
		browser: string;
		os: string;
		country: string;
		loggedIn: boolean;
	};

	const visits = new Map<string, Visit>();
	for (const e of events) {
		// pre-v1.4 events have no vsid; fall back to the event itself so they still count once
		const key = e.vsid ? `${e.vsid}:${e.slug}` : `${e.vid}:${e.slug}:${e.ts}`;
		const existing = visits.get(key);
		if (!existing) {
			visits.set(key, {
				slug: e.slug,
				kind: e.kind === 'page' ? 'page' : 'post',
				vid: e.vid,
				active: Math.max(0, e.active || 0),
				depth: e.depth || 0,
				referrer: e.referrer || 'direct',
				refHost: e.refHost || 'direct',
				device: e.device || 'desktop',
				browser: e.browser || 'other',
				os: e.os || 'other',
				country: e.country || 'unknown',
				loggedIn: Boolean(e.loggedIn)
			});
			continue;
		}
		existing.active = Math.max(existing.active, Math.max(0, e.active || 0));
		if ((e.depth || 0) > existing.depth) existing.depth = e.depth;
		existing.loggedIn = existing.loggedIn || Boolean(e.loggedIn);
	}

	const seen = new Set<string>();

	for (const v of visits.values()) {
		r.views++;

		if (!seen.has(v.vid) && seen.size < MAX_VIDS_PER_DAY) {
			seen.add(v.vid);
			r.vids.push(v.vid);
		}

		if (v.active > 0) {
			r.activeSum += v.active;
			r.activeSamples++;
		}

		if (v.depth >= 25) r.depth[25]++;
		if (v.depth >= 50) r.depth[50]++;
		if (v.depth >= 75) r.depth[75]++;
		if (v.depth >= 100) r.depth[100]++;

		bump(r.dims.refs, v.referrer);
		bump(r.dims.refHosts, v.refHost);
		bump(r.dims.devices, v.device);
		bump(r.dims.browsers, v.browser);
		bump(r.dims.os, v.os);
		bump(r.dims.countries, v.country);
		if (v.loggedIn) r.dims.audience.loggedIn++;
		else r.dims.audience.anonymous++;

		const target = v.kind === 'page' ? r.byPage : r.bySlug;
		const bucket = target[v.slug] || emptyPathStats();
		bucket.views++;
		if (bucket.vids.length < MAX_VIDS_PER_PATH && !bucket.vids.includes(v.vid)) {
			bucket.vids.push(v.vid);
		}
		bucket.activeSum += v.active;
		if (v.active > 0) bucket.activeSamples++;
		if (v.depth === 100) bucket.depth100++;
		target[v.slug] = bucket;
	}

	return r;
}

async function deleteRawEventsForDay(day: string) {
	const slugs = await getSlugs();
	const keyLists = await chunked(slugs, async (slug) => {
		try {
			return await kv.keys(`${eventPrefix(slug, day)}:`);
		} catch {
			return [] as string[];
		}
	});
	await chunked(keyLists.flat(), async (key) => {
		try {
			await kv.del(key);
		} catch {}
		return null;
	});
}

export async function getOrBuildRollup(day: string): Promise<DailyRollup> {
	const isToday = day === todayUTC();

	if (!isToday) {
		try {
			const cached = await kv.get<string>(rollupKey(day));
			if (cached) {
				const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
				return normalizeRollup(parsed, day);
			}
		} catch {}
	}

	const events = await listRawEventsForDay(day);
	const r = foldEvents(day, events);

	if (!isToday) {
		try {
			await kv.set(rollupKey(day), JSON.stringify(r));
			await deleteRawEventsForDay(day);
		} catch (e) {
			console.warn('rollup compaction failed', e);
		}
	}

	return r;
}

function addInto(target: DailyRollup, part: DailyRollup | MonthlyRollup) {
	target.views += part.views;
	target.activeSum += part.activeSum;
	target.activeSamples += part.activeSamples;
	target.depth[25] += part.depth[25];
	target.depth[50] += part.depth[50];
	target.depth[75] += part.depth[75];
	target.depth[100] += part.depth[100];

	mergeCounts(target.dims.refs, part.dims.refs);
	mergeCounts(target.dims.refHosts, part.dims.refHosts);
	mergeCounts(target.dims.devices, part.dims.devices);
	mergeCounts(target.dims.browsers, part.dims.browsers);
	mergeCounts(target.dims.os, part.dims.os);
	mergeCounts(target.dims.countries, part.dims.countries);
	target.dims.audience.loggedIn += part.dims.audience.loggedIn;
	target.dims.audience.anonymous += part.dims.audience.anonymous;

	mergePathStats(target.bySlug, part.bySlug);
	mergePathStats(target.byPage, part.byPage);
}

/**
 * Monthly rollup for a month that has fully elapsed, folded from its immutable daily rollups.
 * This is what keeps a long range inside the Worker subrequest budget. KV reads count against
 * the internal-services allowance, 1,000 per invocation on the free plan; a 365-day range plus
 * its comparison window is over 700 daily keys before any raw-event reads, where whole months
 * cost ~13.
 */
async function getOrBuildMonthly(month: string): Promise<MonthlyRollup | null> {
	try {
		const cached = await kv.get<string>(monthlyKey(month));
		if (cached) {
			const parsed = typeof cached === 'string' ? JSON.parse(cached) : cached;
			const normalized = normalizeRollup(parsed, firstDayOfMonth(month));
			return {
				...normalized,
				month,
				perDay: Array.isArray(parsed.perDay) ? parsed.perDay : []
			};
		}
	} catch {}

	const from = firstDayOfMonth(month);
	const to = lastDayOfMonth(month);
	if (to >= todayUTC()) return null;

	const days = [...dayRange(from, to)];
	const dailies = await chunked(days, (day) => getOrBuildRollup(day));

	const acc = emptyRollup(from);
	const vids = new Set<string>();
	const perDay: { day: string; views: number; unique: number }[] = [];

	for (const daily of dailies) {
		addInto(acc, daily);
		for (const vid of daily.vids) {
			if (vids.size >= MAX_VIDS_PER_DAY) break;
			vids.add(vid);
		}
		perDay.push({ day: daily.day, views: daily.views, unique: daily.vids.length });
	}

	const monthly: MonthlyRollup = { ...acc, vids: [...vids], month, perDay };

	try {
		await kv.set(monthlyKey(month), JSON.stringify(monthly));
	} catch (e) {
		console.warn('monthly rollup write failed', e);
	}

	return monthly;
}

export type RangeAggregate = DailyRollup & {
	unique: number;
	perDay: { day: string; views: number; unique: number }[];
};

/**
 * Folds a day range, using a monthly rollup wherever a whole elapsed month falls inside it.
 * Unique visitor counts saturate at the vid caps above, so very large ranges under-report
 * uniques rather than growing memory without bound.
 */
export async function aggregateRange(fromDay: string, toDay: string): Promise<RangeAggregate> {
	const acc = emptyRollup(fromDay);
	const vids = new Set<string>();
	const perDay: { day: string; views: number; unique: number }[] = [];

	const wholeMonths: string[] = [];
	const looseDays: string[] = [];

	for (const day of dayRange(fromDay, toDay)) {
		const month = monthOf(day);
		if (firstDayOfMonth(month) >= fromDay && lastDayOfMonth(month) <= toDay) {
			if (!wholeMonths.includes(month)) wholeMonths.push(month);
		} else {
			looseDays.push(day);
		}
	}

	const monthlies = await chunked(wholeMonths, async (month) => ({
		month,
		rollup: await getOrBuildMonthly(month)
	}));

	for (const { month, rollup } of monthlies) {
		if (rollup) continue;
		// month has not fully elapsed yet, so read its days individually
		for (const day of dayRange(firstDayOfMonth(month), lastDayOfMonth(month))) {
			if (day >= fromDay && day <= toDay && day <= todayUTC()) looseDays.push(day);
		}
	}

	for (const { rollup } of monthlies) {
		if (!rollup) continue;
		addInto(acc, rollup);
		for (const vid of rollup.vids) vids.add(vid);
		perDay.push(...rollup.perDay);
	}

	const dailies = await chunked([...new Set(looseDays)].sort(), (day) => getOrBuildRollup(day));
	for (const daily of dailies) {
		addInto(acc, daily);
		for (const vid of daily.vids) vids.add(vid);
		perDay.push({ day: daily.day, views: daily.views, unique: daily.vids.length });
	}

	perDay.sort((a, b) => a.day.localeCompare(b.day));

	return { ...acc, unique: vids.size, perDay };
}

export function rangeFromQuery(range: string | undefined): number {
	switch (range) {
		case '30d':
			return 30;
		case '90d':
			return 90;
		case 'all':
			return 365;
		default:
			return 7;
	}
}
