import hljs from 'highlight.js';
import { kv } from 'hub:kv';
import { marked } from 'marked';
import { create } from 'xmlbuilder2';
import { BlogPost } from '~/shared/types';

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const feed = await kv.get<string>('nuxtpress:feed_xml');
	if (feed) {
		setHeader(event, 'Content-Type', 'application/atom+xml; charset=utf-8');
		setHeader(event, 'Cache-Control', 'public, max-age=3600');
		setHeader(event, 'Content-Length', Buffer.byteLength(feed));
		return feed;
	}

	// construct feed dynamically as fallback
	const posts = await $fetch<BlogPost[]>('/api/blog/list');
	const allTags = new Set<string>();
	posts.forEach((post) => {
		(post.tags || []).forEach((tag) => allTags.add(tag));
	}); // find all tags for categories
	const mostRecentUpate = posts.reduce((latest, post) => {
		const updatedAt = new Date(post.updated_at) || new Date(post.created_at);
		return updatedAt.getTime() > latest.getTime() ? updatedAt : latest;
	}, new Date(0)); // find latest updated_at
	const url = config.public.site_url || 'http://localhost:8787';

	const doc = create({ version: '1.0', encoding: 'utf-8' });
	const root = doc.ele('feed', { xmlns: 'http://www.w3.org/2005/Atom' });

	root.ele('title').txt(config.public.name || 'NuxtPress Site');
	root.ele('subtitle').txt(config.public.description || 'A NuxtPress powered site');
	root.ele('link', { href: url, rel: 'self' });
	root.ele('updated').txt(mostRecentUpate.toISOString());
	root.ele('id').txt(url);
	root.ele('generator').txt('NuxtPress');

	for (const tag of allTags) {
		const category = root.ele('category');
		category.att('term', tag);
	}

	const author = root.ele('author');
	author.ele('name').txt(config.public.author || config.public.name || 'NuxtPress');
	if (config.public.supportEmail) {
		author.ele('email').txt(config.public.supportEmail);
	}

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

	for (const post of posts) {
		const entry = root.ele('entry');
		const createdAt = new Date(post.created_at);
		const updatedAt = new Date(post.updated_at) || new Date(post.created_at);
		const fullSlug = `${createdAt.getUTCFullYear()}/${createdAt.getUTCMonth() + 1}/${createdAt.getUTCDate()}/${post.slug}`;

		entry.ele('title').txt(post.title);
		entry.ele('link', {
			href: `${url}/${fullSlug}`
		});
		entry.ele('id').txt(`${url}/${fullSlug}`);
		entry.ele('updated').txt(updatedAt.toISOString());
		entry.ele('published').txt(createdAt.toISOString());

		for (const tag of post.tags || []) {
			const category = entry.ele('category');
			category.att('term', tag);
		}

		// strip markdown for plain text summary
		const summary = entry.ele('summary', { type: 'html' });
		const plainText = post.content
			? post.content.replace(/[#_*>\-\n]/g, '').slice(0, 200) + '...'
			: '';
		summary.txt(plainText);

		// render markdown to HTML using the same configuration as useMarkdown
		const html = marked(post.content || '', {
			renderer: renderer,
			breaks: true,
			gfm: true
		});
		const renderedContent = typeof html === 'string' ? html : '';

		const content = entry.ele('content', { type: 'html' });
		content.txt(renderedContent);
	}

	// serve generated posts
	const xml = root.end({ prettyPrint: true });
	setHeader(event, 'Content-Type', 'application/atom+xml; charset=utf-8');
	setHeader(event, 'Cache-Control', 'public, max-age=3600');
	setHeader(event, 'Content-Length', Buffer.byteLength(xml));

	// cache for future requests
	await kv.set('nuxtpress:feed_xml', xml, { ttl: 3600 });
	return xml;
});
