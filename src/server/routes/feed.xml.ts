import hljs from 'highlight.js';
import { kv } from 'hub:kv';
import { marked } from 'marked';
import { ensureDatabase } from '~/server/utils/db';
import { excerptOf, getUrlStyle, listFullPosts } from '~/server/utils/posts';
import { datedPostPath, slugPostPath } from '~/shared/types';

const FEED_CACHE_KEY = 'nuxtpress:feed_xml:v3';
const MAX_ENTRIES = 50;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

/** XML 1.0 forbids most control characters outright, and an unescaped one makes the feed unparseable. */
function stripControlChars(value: string): string {
	return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function normalizeDate(value: Date | string | undefined): Date {
	const date = value ? new Date(value) : new Date(NaN);
	return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function byteLength(value: string): number {
	return new TextEncoder().encode(value).byteLength;
}

function absolute(origin: string, path: string): string {
	if (!path) return origin;
	return path.startsWith('http') ? path : `${origin}${path}`;
}

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	try {
		const cachedFeed = await kv.get<string>(FEED_CACHE_KEY);
		if (cachedFeed && typeof cachedFeed === 'string') {
			setHeader(event, 'Content-Type', 'application/atom+xml; charset=utf-8');
			setHeader(event, 'Cache-Control', 'public, max-age=3600');
			setHeader(event, 'Content-Length', byteLength(cachedFeed));
			return cachedFeed;
		}
	} catch (e) {
		console.warn('feed cache read failed', e);
	}

	await ensureDatabase();

	let posts: Awaited<ReturnType<typeof listFullPosts>> = [];
	let urlStyle: 'dated' | 'slug' = 'dated';
	try {
		[posts, urlStyle] = await Promise.all([listFullPosts(MAX_ENTRIES), getUrlStyle()]);
	} catch (e) {
		console.warn('feed could not load posts', e);
	}

	const requestOrigin = getRequestURL(event).origin;
	const origin = (config.public.site_url || requestOrigin).replace(/\/+$/, '');
	const siteName = (await kv.get<string>('nuxtpress:setting:name')) || config.public.name;
	const siteDescription =
		(await kv.get<string>('nuxtpress:setting:description')) || config.public.description;
	const siteAuthor =
		(await kv.get<string>('nuxtpress:setting:author')) ||
		config.public.author ||
		config.public.name ||
		'NuxtPress';

	const allTags = new Set<string>();
	let mostRecentUpdate = new Date(0);
	posts.forEach((post) => {
		post.tags.forEach((tag) => allTags.add(tag));
		const updatedAt = normalizeDate(post.updated_at || post.created_at);
		if (updatedAt.getTime() > mostRecentUpdate.getTime()) mostRecentUpdate = updatedAt;
	});

	const renderer = new marked.Renderer();
	renderer.code = ({ text, lang }) => {
		const validLanguage = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
		try {
			const highlighted = hljs.highlight(text, { language: validLanguage }).value;
			return `<pre><code class="hljs language-${validLanguage}">${highlighted}</code></pre>`;
		} catch (e) {
			console.error('Syntax highlighting error:', e);
			return `<pre><code class="hljs">${text}</code></pre>`;
		}
	};

	const feedCategoriesXml = Array.from(allTags)
		.map((tag) => `  <category term="${escapeXml(tag)}" />`)
		.join('\n');

	const entriesXml = posts
		.map((post) => {
			try {
				const createdAt = normalizeDate(post.created_at);
				const updatedAt = normalizeDate(post.updated_at || post.created_at);
				const path = urlStyle === 'slug' ? slugPostPath(post) : datedPostPath(post);
				const entryUrl = `${origin}${path}`;

				const categoriesXml = post.tags
					.map((tag) => `    <category term="${escapeXml(tag)}" />`)
					.join('\n');

				let renderedContent = '';
				try {
					const html = marked(post.content || '', {
						renderer,
						breaks: true,
						gfm: true
					});
					if (typeof html === 'string') renderedContent = html;
				} catch (e) {
					console.warn('feed markdown render failed for', post.slug, e);
				}

				const authorName = post.author?.displayName || siteAuthor;
				const authorUri = post.author?.username
					? `    <uri>${escapeXml(`${origin}/authors/${post.author.username}`)}</uri>`
					: '';

				return [
					'  <entry>',
					`    <title>${escapeXml(post.title || 'Untitled')}</title>`,
					`    <link rel="alternate" type="text/html" href="${escapeXml(entryUrl)}" />`,
					`    <id>${escapeXml(entryUrl)}</id>`,
					`    <updated>${updatedAt.toISOString()}</updated>`,
					`    <published>${createdAt.toISOString()}</published>`,
					'    <author>',
					`      <name>${escapeXml(authorName)}</name>`,
					authorUri,
					'    </author>',
					categoriesXml,
					`    <summary type="text">${escapeXml(excerptOf(post.content, 300))}</summary>`,
					`    <content type="html">${escapeXml(renderedContent)}</content>`,
					'  </entry>'
				]
					.filter(Boolean)
					.join('\n');
			} catch (e) {
				console.warn('feed entry build failed', e);
				return '';
			}
		})
		.filter(Boolean)
		.join('\n');

	const xml = stripControlChars(
		[
			'<?xml version="1.0" encoding="utf-8"?>',
			'<feed xmlns="http://www.w3.org/2005/Atom" xml:lang="en">',
			`  <title>${escapeXml(siteName || 'NuxtPress Site')}</title>`,
			`  <subtitle>${escapeXml(siteDescription || 'A NuxtPress powered site')}</subtitle>`,
			`  <link rel="self" type="application/atom+xml" href="${escapeXml(`${origin}/feed.xml`)}" />`,
			`  <link rel="alternate" type="text/html" href="${escapeXml(origin)}" />`,
			`  <updated>${mostRecentUpdate.toISOString()}</updated>`,
			`  <id>${escapeXml(`${origin}/`)}</id>`,
			`  <icon>${escapeXml(absolute(origin, '/favicon.png'))}</icon>`,
			`  <logo>${escapeXml(absolute(origin, '/favicon.png'))}</logo>`,
			'  <generator uri="https://github.com/gmitch215/nuxtpress">NuxtPress</generator>',
			feedCategoriesXml,
			'  <author>',
			`    <name>${escapeXml(siteAuthor)}</name>`,
			config.public.supportEmail
				? `    <email>${escapeXml(config.public.supportEmail)}</email>`
				: '',
			'  </author>',
			entriesXml,
			'</feed>'
		]
			.filter(Boolean)
			.join('\n')
	);

	setHeader(event, 'Content-Type', 'application/atom+xml; charset=utf-8');
	setHeader(event, 'Cache-Control', 'public, max-age=3600');
	setHeader(event, 'Content-Length', byteLength(xml));

	try {
		await kv.set(FEED_CACHE_KEY, xml, { ttl: 3600 });
	} catch (e) {
		console.warn('feed cache write failed', e);
	}
	return xml;
});
