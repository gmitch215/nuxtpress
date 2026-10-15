import { isDataImage } from './images';

const ALLOWED_TAGS = new Set([
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'del',
	'u',
	'a',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'span'
]);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

// these lose their contents as well as the tag; any other unknown tag is unwrapped
const DROP_WITH_CONTENT = new Set([
	'script',
	'style',
	'iframe',
	'object',
	'embed',
	'form',
	'input',
	'button',
	'textarea',
	'select',
	'option',
	'meta',
	'link',
	'base',
	'svg',
	'math',
	'template',
	'noscript'
]);
const EMPTY_TAGS = new Set(['input', 'meta', 'link', 'base']);

const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
	'*': new Set(['class', 'title']),
	a: new Set(['href', 'target', 'rel']),
	img: new Set(['src', 'alt', 'loading', 'decoding'])
};

// a tag is only recognised when it fits this grammar; anything else is escaped as text
const TAG_RE =
	/<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:[\s/]+[^\s"'<>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*)[\s/]*>/y;
const ATTR_RE = /([^\s"'<>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;

const NAMED: Record<string, string> = {
	amp: '&',
	lt: '<',
	gt: '>',
	quot: '"',
	apos: "'",
	colon: ':',
	tab: '\t',
	newline: '\n'
};

function decodeEntities(value: string): string {
	return value.replace(/&(?:#(\d+)|#x([0-9a-f]+)|([a-z]+));?/gi, (match, dec, hex, name) => {
		if (name) return NAMED[name.toLowerCase()] ?? match;
		const code = dec ? Number(dec) : parseInt(hex, 16);
		return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
	});
}

function escapeAttr(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/"/g, '&quot;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;');
}

function isSafeUrl(value: string, type: 'link' | 'media'): boolean {
	// browsers drop tabs, newlines and other control characters inside a scheme
	const probe = value.replace(/[\u0000- \u007f-\u009f]/g, '');
	if (!probe) return false;
	if (/^(\/|\.\/|\.\.\/|#)/.test(probe)) return true;
	if (type === 'media' && isDataImage(value.trim())) return true;

	try {
		const protocol = new URL(probe).protocol;
		if (type === 'link') return ['http:', 'https:', 'mailto:', 'tel:'].includes(protocol);
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

function openTag(name: string, rawAttrs: string): string {
	const allowed = ALLOWED_ATTRS[name];
	const kept = new Map<string, string>();

	for (const match of rawAttrs.matchAll(ATTR_RE)) {
		const attr = match[1]!.toLowerCase();
		if (!ALLOWED_ATTRS['*']!.has(attr) && !allowed?.has(attr)) continue;
		const value = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '').trim();
		if (attr === 'href' && !isSafeUrl(value, 'link')) continue;
		if (attr === 'src' && !isSafeUrl(value, 'media')) continue;
		kept.set(attr, value);
	}

	if (name === 'a') {
		const href = kept.get('href') ?? '';
		kept.delete('target');
		kept.delete('rel');
		if (/^https?:\/\//i.test(href)) {
			kept.set('target', '_blank');
			kept.set('rel', 'noopener noreferrer nofollow');
		}
	}
	if (name === 'img') {
		if (!kept.get('loading')) kept.set('loading', 'lazy');
		kept.set('decoding', 'async');
	}

	const attrs = [...kept].map(([key, value]) => ` ${key}="${escapeAttr(value)}"`).join('');
	return `<${name}${attrs}>`;
}

/**
 * Allowlist sanitizer for the HTML marked produces from author markdown. It rebuilds each
 * permitted tag from a strict grammar and treats everything it cannot parse as text, so there is
 * no markup left for a browser to read differently. The server and client run the same code, which
 * keeps the rendered post identical on both sides of hydration.
 */
export function sanitizeHtml(html: string): string {
	if (!html) return '';

	let out = '';
	const open: string[] = [];
	let skipping: { name: string; depth: number } | null = null;
	let i = 0;

	while (i < html.length) {
		const lt = html.indexOf('<', i);
		if (lt === -1) {
			if (!skipping) out += html.slice(i);
			break;
		}
		if (!skipping) out += html.slice(i, lt);

		if (html.startsWith('<!--', lt)) {
			const end = html.indexOf('-->', lt + 4);
			i = end === -1 ? html.length : end + 3;
			continue;
		}

		TAG_RE.lastIndex = lt;
		const match = TAG_RE.exec(html);
		if (!match) {
			if (!skipping) out += '&lt;';
			i = lt + 1;
			continue;
		}
		i = lt + match[0].length;

		const closing = match[1] === '/';
		const name = match[2]!.toLowerCase();

		if (skipping) {
			if (name === skipping.name && !EMPTY_TAGS.has(name)) {
				skipping.depth += closing ? -1 : 1;
				if (skipping.depth === 0) skipping = null;
			}
			continue;
		}

		if (DROP_WITH_CONTENT.has(name)) {
			if (!closing && !EMPTY_TAGS.has(name)) skipping = { name, depth: 1 };
			continue;
		}
		if (!ALLOWED_TAGS.has(name)) continue;

		if (closing) {
			const at = open.lastIndexOf(name);
			if (at === -1) continue;
			while (open.length > at) out += `</${open.pop()}>`;
			continue;
		}

		out += openTag(name, match[3] ?? '');
		if (!VOID_TAGS.has(name)) open.push(name);
	}

	while (open.length > 0) out += `</${open.pop()}>`;
	return out;
}
