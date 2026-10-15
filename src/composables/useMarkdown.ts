import { markdownToHtml } from '~/shared/markdown';

const SHORTCODE_RE = /:([a-zA-Z0-9_+-]+):/g;

// the emoji dataset is about 800 KB, so it loads only when a post actually has a :shortcode:
let shortcodes: Map<string, string> | null = null;
let loading: Promise<void> | null = null;
const emojisReady = shallowRef(false);

function loadEmojis(): Promise<void> {
	loading ??= import('@tiptap/extension-emoji').then(({ gitHubEmojis }) => {
		const map = new Map<string, string>();
		for (const item of gitHubEmojis) {
			if (!item.emoji) continue;
			for (const code of item.shortcodes) if (!map.has(code)) map.set(code, item.emoji);
		}
		shortcodes = map;
		emojisReady.value = true;
	});
	return loading;
}

function convertEmojis(content: string): string {
	if (!shortcodes) return content;
	const map = shortcodes;
	return content.replace(SHORTCODE_RE, (match, code: string) => map.get(code) ?? match);
}

/**
 * Shifts body headings down one level so the post title keeps the page's only h1. Matches the
 * bare tags marked emits; an escaped tag inside a code block reads as `&lt;h1&gt;` and is left alone.
 */
function demoteHeadings(html: string): string {
	return html.replace(/<(\/?)h([1-5])>/g, (_, slash: string, level: string) => {
		return `<${slash}h${Number(level) + 1}>`;
	});
}

export function useMarkdown() {
	// await this before rendering so server and client render the same html for a given post
	const prepareMarkdown = async (content: string) => {
		if (!shortcodes && new RegExp(SHORTCODE_RE.source).test(content)) await loadEmojis();
	};

	const renderMarkdown = (content: string): string => {
		// read for its dependency: a render that ran before the dataset arrived runs again
		void emojisReady.value;
		return demoteHeadings(markdownToHtml(convertEmojis(content)));
	};

	return { renderMarkdown, prepareMarkdown };
}
