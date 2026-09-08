import { kv } from 'hub:kv';
import { z } from 'zod';
import { recordSlug, todayUTC, writeEvent } from '~/server/utils/analytics';
import {
	classifyBrowser,
	classifyCountry,
	classifyDevice,
	classifyOs,
	isBotUA,
	referrerHost,
	visitorId
} from '~/server/utils/ua';

const trackSchema = z.object({
	slug: z
		.string()
		.min(1)
		.max(220)
		.regex(/^[a-z0-9._\-/:]+$/i),
	kind: z.enum(['post', 'page']).default('post'),
	vsid: z
		.string()
		.min(1)
		.max(64)
		.regex(/^[a-z0-9_-]+$/i)
		.optional()
		.default(() => crypto.randomUUID().replace(/-/g, '').slice(0, 16)),
	active: z
		.number()
		.min(0)
		.max(60 * 60 * 1000),
	depth: z.union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)]),
	referrer: z.enum(['external', 'internal', 'direct']),
	referrerUrl: z.string().max(2048).optional(),
	isExit: z.boolean()
});

export default defineEventHandler(async (event) => {
	const body = await readBody(event).catch(() => null);
	const parsed = trackSchema.safeParse(body);
	if (!parsed.success) {
		setResponseStatus(event, 204);
		return null;
	}

	const ua = getRequestHeader(event, 'user-agent') || '';
	const purpose =
		getRequestHeader(event, 'sec-purpose') || getRequestHeader(event, 'purpose') || '';
	const dnt = getRequestHeader(event, 'dnt') || '';
	const gpc = getRequestHeader(event, 'sec-gpc') || '';

	// honour the opt-out signals server-side too, not just in the beacon
	if (dnt === '1' || gpc === '1' || isBotUA(ua) || /prefetch/i.test(purpose)) {
		setResponseStatus(event, 204);
		return null;
	}

	const day = todayUTC();
	const ip =
		getRequestHeader(event, 'cf-connecting-ip') ||
		getRequestHeader(event, 'x-real-ip') ||
		getRequestHeader(event, 'x-forwarded-for') ||
		'';
	const salt = useRuntimeConfig().analyticsSalt || 'dev-salt';
	// daily-rotating salted hash; the raw ip and ua are never stored
	const vid = await visitorId(String(ip).split(',')[0]?.trim() || '', ua, salt, day);

	// per-visitor rate limit: 80 events per 60s
	try {
		const rlKey = `analytics:rl:${vid}`;
		const cur = (await kv.get<number>(rlKey)) ?? 0;
		if (cur > 80) {
			setResponseStatus(event, 204);
			return null;
		}
		await kv.set(rlKey, cur + 1, { ttl: 60 });
	} catch {}

	const session = await getUserSession(event).catch(() => null);
	const host = getRequestHost(event, { xForwardedHost: true }) || '';

	await writeEvent(day, {
		slug: parsed.data.slug,
		kind: parsed.data.kind,
		vsid: parsed.data.vsid,
		ts: Date.now(),
		vid,
		active: Math.floor(parsed.data.active),
		depth: parsed.data.depth,
		referrer: parsed.data.referrer,
		refHost: referrerHost(parsed.data.referrerUrl, host),
		device: classifyDevice(ua),
		browser: classifyBrowser(ua),
		os: classifyOs(ua),
		country: classifyCountry(getRequestHeader(event, 'cf-ipcountry')),
		loggedIn: Boolean(session?.user),
		isExit: parsed.data.isExit
	});

	await recordSlug(parsed.data.slug);

	setResponseStatus(event, 204);
	return null;
});
