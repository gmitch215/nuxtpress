import { ensureDatabase } from '~/server/utils/db';
import { getUrlStyle, listPostSummaries } from '~/server/utils/posts';
import { datedPostPath, slugPostPath } from '~/shared/types';

export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const [posts, style] = await Promise.all([listPostSummaries(), getUrlStyle()]);

	const years = new Set<string>();
	const months = new Set<string>();
	const days = new Set<string>();
	const tags = new Set<string>();

	const entries = posts.map((post) => {
		const d = new Date(post.created_at);
		const y = d.getUTCFullYear();
		const m = d.getUTCMonth() + 1;
		const day = d.getUTCDate();
		years.add(`/${y}`);
		months.add(`/${y}/${m}`);
		days.add(`/${y}/${m}/${day}`);
		post.tags.forEach((tag) => tags.add(tag));

		return {
			loc: style === 'slug' ? slugPostPath(post) : datedPostPath(post),
			lastmod: new Date(post.updated_at).toISOString(),
			changefreq: 'monthly',
			priority: 0.8,
			images: post.thumbnail_url ? [{ loc: post.thumbnail_url }] : undefined
		};
	});

	const archives = [
		...[...years].map((loc) => ({ loc, changefreq: 'weekly', priority: 0.5 })),
		...[...months].map((loc) => ({ loc, changefreq: 'monthly', priority: 0.4 })),
		...[...days].map((loc) => ({ loc, changefreq: 'monthly', priority: 0.3 }))
	];

	const authors = [...new Set(posts.map((post) => post.author?.username).filter(Boolean))].map(
		(username) => ({ loc: `/authors/${username}`, changefreq: 'weekly', priority: 0.5 })
	);

	setHeader(event, 'Cache-Control', 'public, max-age=300');
	return [...entries, ...archives, ...authors];
});
