const ALLOWED_TAG_NAMES = new Set([
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

const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
	'*': new Set(['class', 'title']),
	a: new Set(['href', 'target', 'rel']),
	img: new Set(['src', 'alt', 'loading', 'decoding']),
	code: new Set(['class']),
	span: new Set(['class'])
};

function isRelativeUrl(value: string): boolean {
	return (
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../') ||
		value.startsWith('#')
	);
}

function isSafeUrl(value: string, type: 'link' | 'media'): boolean {
	if (!value) return false;
	if (isRelativeUrl(value)) return true;

	try {
		const protocol = new URL(value).protocol.toLowerCase();
		if (type === 'link') {
			return (
				protocol === 'http:' ||
				protocol === 'https:' ||
				protocol === 'mailto:' ||
				protocol === 'tel:'
			);
		}
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

function sanitizeServerFallback(html: string): string {
	return html
		.replace(
			/<\s*(script|style|iframe|object|embed|form|button|textarea|select|option)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
			''
		)
		.replace(/<\s*(input|meta|link|base)\b[^>]*\/?>/gi, '')
		.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
		.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
		.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
		.replace(/\s(href|src)\s*=\s*(['"])\s*data:[\s\S]*?\2/gi, '')
		.replace(/\s(href|src)\s*=\s*javascript:[^\s>]*/gi, '')
		.replace(/\s(href|src)\s*=\s*data:[^\s>]*/gi, '');
}

export function sanitizeHtml(html: string): string {
	if (!html) return '';

	if (
		import.meta.client &&
		typeof window !== 'undefined' &&
		typeof window.DOMParser !== 'undefined'
	) {
		const doc = new window.DOMParser().parseFromString(html, 'text/html');

		doc
			.querySelectorAll(
				'script,style,iframe,object,embed,form,input,button,textarea,select,option,meta,link,base'
			)
			.forEach((node) => node.remove());

		for (const node of Array.from(doc.body.querySelectorAll('*'))) {
			const tagName = node.tagName.toLowerCase();

			if (!ALLOWED_TAG_NAMES.has(tagName)) {
				node.replaceWith(...Array.from(node.childNodes));
				continue;
			}

			for (const attr of Array.from(node.attributes)) {
				const attrName = attr.name.toLowerCase();
				const attrValue = attr.value.trim();
				const allowedForTag = ALLOWED_ATTRS[tagName];
				const isAllowed = ALLOWED_ATTRS['*']?.has(attrName) || allowedForTag?.has(attrName);

				if (!isAllowed || attrName.startsWith('on')) {
					node.removeAttribute(attr.name);
					continue;
				}

				if (attrName === 'href' && !isSafeUrl(attrValue, 'link')) {
					node.removeAttribute(attr.name);
					continue;
				}

				if (attrName === 'src' && !isSafeUrl(attrValue, 'media')) {
					node.removeAttribute(attr.name);
				}
			}

			if (tagName === 'a') {
				const href = node.getAttribute('href') || '';
				if (href.startsWith('http://') || href.startsWith('https://')) {
					node.setAttribute('target', '_blank');
					node.setAttribute('rel', 'noopener noreferrer nofollow');
				} else {
					node.removeAttribute('target');
					node.removeAttribute('rel');
				}
			}

			if (tagName === 'img') {
				if (!node.getAttribute('loading')) node.setAttribute('loading', 'lazy');
				node.setAttribute('decoding', 'async');
			}
		}

		return doc.body.innerHTML;
	}

	// keeps ssr rendering safe without depending on browser globals
	return sanitizeServerFallback(html);
}

export function useSanitizeHtml() {
	return { sanitizeHtml };
}
