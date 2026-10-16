import { expect, test } from '@playwright/test';
import {
	dataImageMime,
	decodeDataImage,
	embeddedDataImages,
	isDataImage,
	stripDataImages
} from '../src/shared/images';
import { markdownToHtml } from '../src/shared/markdown';
import {
	contentFromMedia,
	extensionFor,
	isMediaPath,
	keyFromPath,
	MEDIA_KEY_RE,
	mediaUrl
} from '../src/shared/media';
import { rowsOf } from '../src/shared/rows';
import { sanitizeHtml } from '../src/shared/sanitize';
import { excerptOf, markdownToText, readingMinutes } from '../src/shared/text';
import { datedPostPath, formatDate, postPath, slugPostPath } from '../src/shared/types';

const KEY = `media/${'a'.repeat(32)}/${'b'.repeat(32)}.png`;
const PIXEL =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

test.describe('rowsOf', () => {
	test('reads libsql rows and D1 results', () => {
		expect(rowsOf({ rows: [{ count: 2 }] })).toEqual([{ count: 2 }]);
		expect(rowsOf({ results: [{ count: 3 }], meta: {} })).toEqual([{ count: 3 }]);
	});

	test('prefers rows and falls back to an empty list', () => {
		expect(rowsOf({ rows: [1], results: [2] })).toEqual([1]);
		expect(rowsOf({})).toEqual([]);
		expect(rowsOf(null)).toEqual([]);
		expect(rowsOf(undefined)).toEqual([]);
	});
});

test.describe('text', () => {
	test('markdown reduces to plain text', () => {
		const md =
			'# Title\n\n```ts\nconst hidden = 1;\n```\n\nSome **bold** and [a link](https://x.y).';
		expect(markdownToText(md)).toBe('Title Some bold and a link.');
	});

	test('an excerpt cuts on a word boundary and marks the cut', () => {
		const long = `${'word '.repeat(80)}end`;
		const excerpt = excerptOf(long, 50);
		expect(excerpt.endsWith('...')).toBe(true);
		expect(excerpt.length).toBeLessThanOrEqual(53);
		expect(excerpt.slice(0, -3).endsWith('word')).toBe(true);
		expect(excerptOf('short text', 50)).toBe('short text');
		expect(excerptOf('', 50)).toBe('');
	});
});

test.describe('readingMinutes', () => {
	const dataImage = `data:image/png;base64,${'A'.repeat(336_000)}`;

	test('text counts at about 1,190 characters a minute', () => {
		expect(readingMinutes('short note')).toBe(1);
		expect(readingMinutes('x'.repeat(1190 * 4 + 10))).toBe(4);
	});

	test('an inline image adds nothing, whatever its size', () => {
		expect(readingMinutes(`A short caption.\n\n![](${dataImage})`)).toBe(1);
		expect(readingMinutes(`![A photo of the harbor](${dataImage})`)).toBe(1);
		expect(readingMinutes(`before <img alt="x" src="${dataImage}"> after`)).toBe(1);
	});

	test('only the caption of an image is read', () => {
		const caption = 'c'.repeat(1190 * 2);
		expect(readingMinutes(`![${caption}](${dataImage})`)).toBe(2);
	});

	test('nothing readable means no estimate', () => {
		expect(readingMinutes('')).toBeNull();
		expect(readingMinutes('   \n ')).toBeNull();
		expect(readingMinutes(`![](${dataImage})`)).toBeNull();
		expect(readingMinutes(`<img src="${dataImage}">`)).toBeNull();
	});
});

test.describe('inline images', () => {
	const url = `data:image/png;base64,${PIXEL}`;

	test('the mime comes from the data URL and must be allowed', () => {
		expect(dataImageMime(url)).toBe('image/png');
		expect(dataImageMime('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe('image/svg+xml');
		expect(isDataImage(url)).toBe(true);
		expect(isDataImage('data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=')).toBe(false);
		expect(isDataImage('data:text/html;base64,PGI+')).toBe(false);
		expect(isDataImage('https://example.com/a.png')).toBe(false);
	});

	test('the size cap counts characters of the whole URL', () => {
		expect(isDataImage(url, undefined, url.length)).toBe(true);
		expect(isDataImage(url, undefined, url.length - 1)).toBe(false);
	});

	test('a data URL decodes to its bytes and a bad one to null', () => {
		const decoded = decodeDataImage(url, ['image/png']);
		expect(decoded?.mime).toBe('image/png');
		expect(Array.from(decoded!.bytes.slice(0, 4))).toEqual([0x89, 0x50, 0x4e, 0x47]);
		expect(decodeDataImage(url, ['image/jpeg'])).toBeNull();
		expect(decodeDataImage('data:image/png;base64,@@@', ['image/png'])).toBeNull();
	});

	test('embedded markdown images are found and stripped from html', () => {
		const md = `before ![alt](${url}) middle ![x](https://example.com/a.png) ![y](${url})`;
		expect(embeddedDataImages(md)).toEqual([url, url]);
		expect(stripDataImages(`<p>a</p><img alt="x" src="${url}"><img src="/ok.png">`)).toBe(
			'<p>a</p><img src="/ok.png">'
		);
	});
});

test.describe('media paths', () => {
	test('a media key round-trips through its public path', () => {
		expect(MEDIA_KEY_RE.test(KEY)).toBe(true);
		expect(mediaUrl(KEY)).toBe(`/${KEY}`);
		expect(isMediaPath(`/${KEY}`)).toBe(true);
		expect(keyFromPath(`/${KEY}`)).toBe(KEY);
	});

	test('anything outside the key shape is refused', () => {
		for (const bad of [
			'',
			'/media/x',
			`/${KEY}/extra`,
			`/${KEY.replace('media', 'other')}`,
			`/${KEY}.exe`,
			`/media/${'A'.repeat(32)}/${'b'.repeat(32)}.png`
		]) {
			expect(isMediaPath(bad), bad).toBe(false);
			expect(keyFromPath(bad), bad).toBeNull();
		}
		expect(isMediaPath(null)).toBe(false);
		expect(isMediaPath(undefined)).toBe(false);
	});

	test('extensions follow the mime type and unknown types are .bin', () => {
		expect(extensionFor('image/jpeg')).toBe('jpg');
		expect(extensionFor('audio/x-wav')).toBe('wav');
		expect(extensionFor('video/webm')).toBe('webm');
		expect(extensionFor('application/x-msdownload')).toBe('bin');
	});

	test('slideshow content is the trimmed captions joined by blank lines', () => {
		const item = (caption?: string) => ({ key: KEY, mime: 'image/png', size: 1, caption });
		expect(contentFromMedia([item(' one '), item(), item('  '), item('two')])).toBe('one\n\ntwo');
		expect(contentFromMedia([])).toBe('');
	});
});

test.describe('formatDate', () => {
	test('a date reads the same in every time zone', () => {
		const zone = process.env.TZ;
		try {
			// 03:30 UTC is still the previous evening in the Americas, where a local format would differ
			for (const tz of ['UTC', 'America/Los_Angeles', 'Pacific/Auckland']) {
				process.env.TZ = tz;
				expect(formatDate(new Date('2026-10-16T03:30:00Z')), tz).toBe('October 16, 2026');
				expect(formatDate(new Date('2026-12-31T23:59:59Z')), tz).toBe('December 31, 2026');
			}
		} finally {
			if (zone === undefined) delete process.env.TZ;
			else process.env.TZ = zone;
		}
	});
});

test.describe('post paths', () => {
	const post = { slug: 'hello-world', created_at: '2026-03-04T23:59:59.000Z' };

	test('the dated path uses the UTC date and the slug path is bare', () => {
		expect(datedPostPath(post)).toBe('/2026/3/4/hello-world');
		expect(datedPostPath({ ...post, created_at: new Date('2026-12-31T00:00:00Z') })).toBe(
			'/2026/12/31/hello-world'
		);
		expect(slugPostPath(post)).toBe('/hello-world');
	});

	test('the url style picks between them and defaults to dated', () => {
		expect(postPath(post, 'slug')).toBe('/hello-world');
		expect(postPath(post, 'dated')).toBe('/2026/3/4/hello-world');
		expect(postPath(post)).toBe('/2026/3/4/hello-world');
	});
});

test.describe('markdown', () => {
	test('underline syntax, code highlighting and the language fallback', () => {
		expect(markdownToHtml('a ++under++ b')).toContain('<u>under</u>');
		expect(markdownToHtml('```ts\nconst a = 1;\n```')).toContain('language-ts');
		expect(markdownToHtml('```dockerfile\nFROM node\n```')).toContain('language-dockerfile');
		expect(markdownToHtml('```toml\nname = "x"\n```')).toContain('language-toml');
		expect(markdownToHtml('```no-such-language\n<b>x</b>\n```')).toContain('language-plaintext');
		expect(markdownToHtml('```no-such-language\n<b>x</b>\n```')).not.toContain('<b>');
	});

	test('rendering stays flat as an isolate renders more posts', () => {
		const doc = 'Paragraph with **bold**, ++under++ and `code` words. '.repeat(40);
		const time = (n: number) => {
			const start = performance.now();
			for (let i = 0; i < n; i++) markdownToHtml(doc);
			return performance.now() - start;
		};
		time(50);
		const early = time(150);
		time(1500);
		const late = time(150);
		// a render that registers its extension again each time grows past 10x by this point
		expect(late).toBeLessThan(early * 4 + 50);
	});
});

test.describe('sanitizeHtml', () => {
	const cases: [name: string, input: string, output: string][] = [
		['plain markup passes through', '<p>hi <strong>x</strong></p>', '<p>hi <strong>x</strong></p>'],
		[
			'slash-separated attributes cannot smuggle a handler',
			'<img/src=x/onerror=alert(1)>',
			'<img loading="lazy" decoding="async">'
		],
		[
			'handlers and unknown attributes are dropped',
			'<img src="/a.png" onerror="alert(1)" alt="a">',
			'<img src="/a.png" alt="a" loading="lazy" decoding="async">'
		],
		['a closed script loses its body', '<script>alert(1)</script>after', 'after'],
		['an unclosed script swallows the rest like a browser would', 'a<script src=//x>b', 'a'],
		['svg is removed with its children', '<svg><circle onload=x></svg>ok', 'ok'],
		['javascript links lose the href', '<a href="javascript:alert(1)">x</a>', '<a>x</a>'],
		['entity-encoded schemes are caught', '<a href="&#106;avascript:alert(1)">x</a>', '<a>x</a>'],
		[
			'a newline inside the scheme is caught',
			'<a href="java&#x0A;script:alert(1)">x</a>',
			'<a>x</a>'
		],
		[
			'external links open safely',
			'<a href="https://example.com/?a=1&b=2">x</a>',
			'<a href="https://example.com/?a=1&amp;b=2" target="_blank" rel="noopener noreferrer nofollow">x</a>'
		],
		[
			'local links lose target and rel',
			'<a href="/post" target="_blank">x</a>',
			'<a href="/post">x</a>'
		],
		['mailto links stay', '<a href="mailto:a@b.co">m</a>', '<a href="mailto:a@b.co">m</a>'],
		[
			'style and handlers go, class stays',
			'<p onclick="x" style="color:red" class="k">t</p>',
			'<p class="k">t</p>'
		],
		['unknown tags are unwrapped', '<div><marquee>hi</marquee></div>', 'hi'],
		['open tags are closed', '<p><u>open', '<p><u>open</u></p>'],
		['a stray close tag is dropped', '</em>x', 'x'],
		['a misnested close tag closes what is inside it', '<p><u>a</p>b', '<p><u>a</u></p>b'],
		['a bare angle bracket becomes text', '1 < 2 and <3', '1 &lt; 2 and &lt;3'],
		['comments are removed', 'a<!-- x -->b', 'ab'],
		[
			'png data images stay',
			'<img src="data:image/png;base64,AAAA">',
			'<img src="data:image/png;base64,AAAA" loading="lazy" decoding="async">'
		],
		[
			'svg and html data urls do not',
			'<img src="data:image/svg+xml;base64,AAAA"><img src="data:text/html;base64,AAAA">',
			'<img loading="lazy" decoding="async"><img loading="lazy" decoding="async">'
		],
		[
			'highlighted code keeps its spans',
			'<pre><code class="hljs language-ts"><span class="hljs-keyword">const</span> a</code></pre>',
			'<pre><code class="hljs language-ts"><span class="hljs-keyword">const</span> a</code></pre>'
		],
		[
			'a quoted angle bracket is escaped',
			'<a title="a>b" href="/x">t</a>',
			'<a title="a&gt;b" href="/x">t</a>'
		],
		['tag and attribute names are case-insensitive', '<A HREF="JAVASCRIPT:x">t</A>', '<a>t</a>'],
		[
			'tables survive',
			'<table><tr><td class="c">1</td></tr></table>',
			'<table><tr><td class="c">1</td></tr></table>'
		]
	];

	for (const [name, input, output] of cases) {
		test(name, () => {
			expect(sanitizeHtml(input)).toBe(output);
			expect(sanitizeHtml(output), 'running it twice changes nothing').toBe(output);
		});
	}

	test('empty input and adversarial input finish quickly', () => {
		expect(sanitizeHtml('')).toBe('');
		const start = performance.now();
		sanitizeHtml('<a '.repeat(60_000));
		sanitizeHtml('<a b="'.repeat(30_000));
		sanitizeHtml(`<a${' b'.repeat(100_000)}`);
		sanitizeHtml('<'.repeat(100_000));
		expect(performance.now() - start).toBeLessThan(1500);
	});
});
