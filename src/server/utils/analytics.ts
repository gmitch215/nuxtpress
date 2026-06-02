import { kv } from 'hub:kv';

export type RawEvent = {
	slug: string;
	ts: number;
	vid: string;
	active: number;
	depth: 0 | 25 | 50 | 75 | 100;
	referrer: 'external' | 'internal' | 'direct';
	prevSlug?: string;
	device: 'mobile' | 'tablet' | 'desktop';
	browser: string;
	isExit: boolean;
};

export type DailyRollup = {
	day: string;
	views: number;
	vids: string[];
	activeSum: number;
	activeSamples: number;
	depth: { 25: number; 50: number; 75: number; 100: number };
	refs: Record<string, number>;
	devices: Record<string, number>;
	browsers: Record<string, number>;
	bySlug: Record<string, { views: number; vids: string[]; activeSum: number; depth100: number }>;
};

const MAX_VIDS_PER_DAY = 8000;

const dayKey = (slug: string, day: string) => `analytics:evt:${day}:${slug}`;
const rollupKey = (day: string) => `analytics:rollup:${day}`;
const INDEX_KEY = 'analytics:slugs';

export function todayUTC(): string {
	const d = new Date();
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function daysAgoUTC(n: number): string {
	const d = new Date(Date.now() - n * 24 * 60 * 60 * 1000);
	return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

export function* dayRange(fromDay: string, toDay: string): Generator<string> {
	let cur = new Date(`${fromDay}T00:00:00.000Z`);
	const end = new Date(`${toDay}T00:00:00.000Z`);
	while (cur <= end) {
		yield `${cur.getUTCFullYear()}-${String(cur.getUTCMonth() + 1).padStart(2, '0')}-${String(cur.getUTCDate()).padStart(2, '0')}`;
		cur = new Date(cur.getTime() + 24 * 60 * 60 * 1000);
	}
}

async function loadSlugs(): Promise<string[]> {
	const raw = await kv.get<string>(INDEX_KEY);
	if (!raw) return [];
	try {
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function recordSlug(slug: string) {
	const existing = await loadSlugs();
	if (existing.includes(slug)) return;
	existing.push(slug);
	await kv.set(INDEX_KEY, JSON.stringify(existing));
}

export async function getSlugs(): Promise<string[]> {
	return loadSlugs();
}

export async function writeEvent(day: string, evt: RawEvent) {
	const id = crypto.randomUUID().replace(/-/g, '');
	const key = `${dayKey(evt.slug, day)}:${id}`;
	await kv.set(key, JSON.stringify(evt), { ttl: 60 * 60 * 24 * 90 });
}

async function listRawEventsForDay(day: string): Promise<RawEvent[]> {
	const slugs = await loadSlugs();
	const events: RawEvent[] = [];
	for (const slug of slugs) {
		const prefix = `${dayKey(slug, day)}:`;
		let keys: string[] = [];
		try {
			keys = await kv.keys(prefix);
		} catch {
			keys = [];
		}
		for (const k of keys) {
			const raw = await kv.get<string>(k);
			if (!raw) continue;
			try {
				const evt = typeof raw === 'string' ? (JSON.parse(raw) as RawEvent) : (raw as RawEvent);
				events.push(evt);
			} catch {}
		}
	}
	return events;
}

function emptyRollup(day: string): DailyRollup {
	return {
		day,
		views: 0,
		vids: [],
		activeSum: 0,
		activeSamples: 0,
		depth: { 25: 0, 50: 0, 75: 0, 100: 0 },
		refs: {},
		devices: {},
		browsers: {},
		bySlug: {}
	};
}

export function foldEvents(day: string, events: RawEvent[]): DailyRollup {
	const r = emptyRollup(day);
	const seen = new Set<string>();
	for (const e of events) {
		r.views++;
		if (!seen.has(e.vid) && seen.size < MAX_VIDS_PER_DAY) {
			seen.add(e.vid);
			r.vids.push(e.vid);
		}
		if (e.active > 0) {
			r.activeSum += e.active;
			r.activeSamples++;
		}
		if (e.depth >= 25) r.depth[25]++;
		if (e.depth >= 50) r.depth[50]++;
		if (e.depth >= 75) r.depth[75]++;
		if (e.depth >= 100) r.depth[100]++;
		r.refs[e.referrer] = (r.refs[e.referrer] || 0) + 1;
		r.devices[e.device] = (r.devices[e.device] || 0) + 1;
		r.browsers[e.browser] = (r.browsers[e.browser] || 0) + 1;
		const slugBucket = r.bySlug[e.slug] || { views: 0, vids: [], activeSum: 0, depth100: 0 };
		slugBucket.views++;
		if (!slugBucket.vids.includes(e.vid) && slugBucket.vids.length < MAX_VIDS_PER_DAY) {
			slugBucket.vids.push(e.vid);
		}
		slugBucket.activeSum += Math.max(0, e.active || 0);
		if (e.depth === 100) slugBucket.depth100++;
		r.bySlug[e.slug] = slugBucket;
	}
	return r;
}

async function deleteRawEventsForDay(day: string) {
	const slugs = await loadSlugs();
	for (const slug of slugs) {
		const prefix = `${dayKey(slug, day)}:`;
		let keys: string[] = [];
		try {
			keys = await kv.keys(prefix);
		} catch {
			keys = [];
		}
		for (const k of keys) {
			try {
				await kv.del(k);
			} catch {}
		}
	}
}

export async function getOrBuildRollup(day: string): Promise<DailyRollup> {
	const isToday = day === todayUTC();
	if (!isToday) {
		const cached = await kv.get<string>(rollupKey(day));
		if (cached) {
			try {
				return JSON.parse(cached) as DailyRollup;
			} catch {}
		}
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
