import hljs from 'highlight.js';
import { kv } from 'hub:kv';
import { marked } from 'marked';
import type { BlogPost } from '~/shared/types';

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

function normalizeDate(value: Date | string | undefined): Date {
	const date = value ? new Date(value) : new Date(NaN);
	return Number.isNaN(date.getTime()) ? new Date(0) : date;
}

function byteLength(value: string): string {
	return String(new TextEncoder().encode(value).byteLength);
}

const FEED_CACHE_KEY = 'nuxtpress:feed_xml:v2';

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

	let posts: BlogPost[] = [];
	try {
		const res = await $fetch<BlogPost[]>('/api/blog/list');
		if (Array.isArray(res)) posts = res;
	} catch (e) {
		console.warn('feed could not load posts', e);
	}

	const allTags = new Set<string>();
	let mostRecentUpdate = new Date(0);

	posts.forEach((post) => {
		(post.tags || []).forEach((tag) => allTags.add(tag));

		const updatedAt = normalizeDate(post.updated_at || post.created_at);
		if (updatedAt.getTime() > mostRecentUpdate.getTime()) {
			mostRecentUpdate = updatedAt;
		}
	});

	const url = (config.public.site_url || 'http://localhost:8787').replace(/\/+$/, '');
	const authorName = config.public.author || config.public.name || 'NuxtPress';

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
				const fullSlug = `${createdAt.getUTCFullYear()}/${createdAt.getUTCMonth() + 1}/${createdAt.getUTCDate()}/${post.slug}`;
				const entryUrl = `${url}/${fullSlug}`;

				const categoriesXml = (post.tags || [])
					.map((tag) => `    <category term="${escapeXml(tag)}" />`)
					.join('\n');

				const plainText = post.content
					? `${post.content.replace(/[#_*>\-\n]/g, '').slice(0, 200)}...`
					: '';

				let renderedContent = '';
				try {
					const html = marked(post.content || '', {
						renderer: renderer,
						breaks: true,
						gfm: true
					});
					if (typeof html === 'string') renderedContent = html;
				} catch (e) {
					console.warn('feed markdown render failed for', post.slug, e);
				}

				return [
					'  <entry>',
					`    <title>${escapeXml(post.title || 'Untitled')}</title>`,
					`    <link href="${escapeXml(entryUrl)}" />`,
					`    <id>${escapeXml(entryUrl)}</id>`,
					`    <updated>${updatedAt.toISOString()}</updated>`,
					`    <published>${createdAt.toISOString()}</published>`,
					categoriesXml,
					`    <summary type="html">${escapeXml(plainText)}</summary>`,
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

	const xml = [
		'<?xml version="1.0" encoding="utf-8"?>',
		'<feed xmlns="http://www.w3.org/2005/Atom">',
		`  <title>${escapeXml(config.public.name || 'NuxtPress Site')}</title>`,
		`  <subtitle>${escapeXml(config.public.description || 'A NuxtPress powered site')}</subtitle>`,
		`  <link href="${escapeXml(`${url}/feed.xml`)}" rel="self" />`,
		`  <link href="${escapeXml(url)}" rel="alternate" />`,
		`  <updated>${mostRecentUpdate.toISOString()}</updated>`,
		`  <id>${escapeXml(url)}</id>`,
		'  <generator>NuxtPress</generator>',
		feedCategoriesXml,
		'  <author>',
		`    <name>${escapeXml(authorName)}</name>`,
		config.public.supportEmail ? `    <email>${escapeXml(config.public.supportEmail)}</email>` : '',
		'  </author>',
		entriesXml,
		'</feed>'
	]
		.filter(Boolean)
		.join('\n');

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
