import { inArray } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts } from '~/server/db/schema';
import {
	aggregateRange,
	daysAgoUTC,
	rangeFromQuery,
	todayUTC,
	type PathStats,
	type RangeAggregate
} from '~/server/utils/analytics';
import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';

function topRows(stats: Record<string, PathStats>, titles: Record<string, string> = {}) {
	return Object.entries(stats)
		.map(([path, s]) => ({
			slug: path,
			title: titles[path] || path,
			views: s.views,
			unique: s.vids.length,
			avgActiveMs: s.activeSamples > 0 ? Math.round(s.activeSum / s.activeSamples) : 0,
			completionRate: s.views > 0 ? s.depth100 / s.views : 0
		}))
		.sort((a, b) => b.views - a.views)
		.slice(0, 25);
}

const avgActive = (a: RangeAggregate) =>
	a.activeSamples > 0 ? Math.round(a.activeSum / a.activeSamples) : 0;
const completion = (a: RangeAggregate) => (a.views > 0 ? a.depth[100] / a.views : 0);

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const range = String(getQuery(event).range || '7d');
	const days = rangeFromQuery(range);
	const to = todayUTC();
	const from = daysAgoUTC(days - 1);
	const prevFrom = daysAgoUTC(days * 2 - 1);
	const prevTo = daysAgoUTC(days);

	const [current, previous] = await Promise.all([
		aggregateRange(from, to),
		aggregateRange(prevFrom, prevTo)
	]);

	const slugs = Object.keys(current.bySlug);
	const titleMap: Record<string, string> = {};
	if (slugs.length > 0) {
		const rows = await db
			.select({ slug: blogPosts.slug, title: blogPosts.title })
			.from(blogPosts)
			.where(inArray(blogPosts.slug, slugs));
		for (const row of rows) titleMap[row.slug] = row.title;
	}

	const audience = current.dims.audience;
	const identified = audience.loggedIn + audience.anonymous;

	return {
		range,
		from,
		to,
		kpis: {
			views: { value: current.views, prev: previous.views },
			unique: { value: current.unique, prev: previous.unique },
			avgActiveMs: { value: avgActive(current), prev: avgActive(previous) },
			completionRate: { value: completion(current), prev: completion(previous) }
		},
		perDay: current.perDay,
		topPosts: topRows(current.bySlug, titleMap),
		topPages: topRows(current.byPage),
		refs: current.dims.refs,
		refHosts: current.dims.refHosts,
		devices: current.dims.devices,
		browsers: current.dims.browsers,
		os: current.dims.os,
		countries: current.dims.countries,
		audience: {
			loggedIn: audience.loggedIn,
			anonymous: audience.anonymous,
			loggedInRate: identified > 0 ? audience.loggedIn / identified : 0
		}
	};
});
