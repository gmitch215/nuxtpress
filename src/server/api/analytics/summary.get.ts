import { inArray } from 'drizzle-orm';
import { db } from 'hub:db';
import { blogPosts } from '~/server/db/schema';
import {
	dayRange,
	daysAgoUTC,
	getOrBuildRollup,
	rangeFromQuery,
	todayUTC
} from '~/server/utils/analytics';
import { requireAdmin } from '~/server/utils/auth';
import { ensureDatabase } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
	await requireAdmin(event);
	await ensureDatabase();

	const range = String(getQuery(event).range || '7d');
	const days = rangeFromQuery(range);
	const to = todayUTC();
	const from = daysAgoUTC(days - 1);
	const prevFrom = daysAgoUTC(days * 2 - 1);
	const prevTo = daysAgoUTC(days);

	async function aggregate(fromDay: string, toDay: string) {
		let views = 0;
		const uniqueSet = new Set<string>();
		let activeSum = 0;
		let activeSamples = 0;
		let depth100 = 0;
		const refs: Record<string, number> = {};
		const devices: Record<string, number> = {};
		const browsers: Record<string, number> = {};
		const bySlug: Record<
			string,
			{ views: number; unique: Set<string>; activeSum: number; depth100: number }
		> = {};
		const perDay: { day: string; views: number; unique: number }[] = [];

		for (const day of dayRange(fromDay, toDay)) {
			const r = await getOrBuildRollup(day);
			views += r.views;
			r.vids.forEach((v) => uniqueSet.add(v));
			activeSum += r.activeSum;
			activeSamples += r.activeSamples;
			depth100 += r.depth[100];
			for (const k of Object.keys(r.refs)) refs[k] = (refs[k] || 0) + r.refs[k];
			for (const k of Object.keys(r.devices)) devices[k] = (devices[k] || 0) + r.devices[k];
			for (const k of Object.keys(r.browsers)) browsers[k] = (browsers[k] || 0) + r.browsers[k];
			for (const slug of Object.keys(r.bySlug)) {
				const bucket = bySlug[slug] || {
					views: 0,
					unique: new Set<string>(),
					activeSum: 0,
					depth100: 0
				};
				const part = r.bySlug[slug];
				bucket.views += part.views;
				part.vids.forEach((v) => bucket.unique.add(v));
				bucket.activeSum += part.activeSum;
				bucket.depth100 += part.depth100;
				bySlug[slug] = bucket;
			}
			perDay.push({ day, views: r.views, unique: r.vids.length });
		}

		return {
			views,
			unique: uniqueSet.size,
			activeSum,
			activeSamples,
			depth100,
			refs,
			devices,
			browsers,
			bySlug,
			perDay
		};
	}

	const current = await aggregate(from, to);
	const previous = await aggregate(prevFrom, prevTo);

	const slugs = Object.keys(current.bySlug);
	const titleMap: Record<string, string> = {};
	if (slugs.length > 0) {
		const rows = await db
			.select({ slug: blogPosts.slug, title: blogPosts.title })
			.from(blogPosts)
			.where(inArray(blogPosts.slug, slugs));
		for (const row of rows) titleMap[row.slug] = row.title;
	}

	const topPosts = Object.entries(current.bySlug)
		.map(([slug, b]) => ({
			slug,
			title: titleMap[slug] || slug,
			views: b.views,
			unique: b.unique.size,
			avgActiveMs: b.views > 0 ? Math.round(b.activeSum / b.views) : 0,
			completionRate: b.views > 0 ? b.depth100 / b.views : 0
		}))
		.sort((a, b) => b.views - a.views)
		.slice(0, 25);

	const avgActiveMs = current.views > 0 ? Math.round(current.activeSum / current.views) : 0;
	const prevAvgActiveMs = previous.views > 0 ? Math.round(previous.activeSum / previous.views) : 0;
	const completionRate = current.views > 0 ? current.depth100 / current.views : 0;
	const prevCompletionRate = previous.views > 0 ? previous.depth100 / previous.views : 0;

	return {
		range,
		from,
		to,
		kpis: {
			views: { value: current.views, prev: previous.views },
			unique: { value: current.unique, prev: previous.unique },
			avgActiveMs: { value: avgActiveMs, prev: prevAvgActiveMs },
			completionRate: { value: completionRate, prev: prevCompletionRate }
		},
		perDay: current.perDay,
		topPosts,
		refs: current.refs,
		devices: current.devices,
		browsers: current.browsers
	};
});
