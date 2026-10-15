import { Marked } from 'marked';
import hljs from './highlight';

const underlineExtension = {
	name: 'underline',
	level: 'inline' as const,
	start(src: string) {
		return src.match(/\+\+/)?.index;
	},
	tokenizer(src: string) {
		const match = /^\+\+([^+]+)\+\+/.exec(src);
		if (match) return { type: 'underline', raw: match[0], text: match[1] };
	},
	renderer(token: { text?: string }) {
		return `<u>${token.text}</u>`;
	}
};

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

// one instance for the isolate: marked.use() on the shared one chains every call's extension
const markdown = new Marked({
	gfm: true,
	breaks: true,
	extensions: [underlineExtension],
	renderer: {
		code({ text, lang }) {
			const language = lang && hljs.getLanguage(lang) ? lang : 'plaintext';
			try {
				const highlighted = hljs.highlight(text, { language }).value;
				return `<pre><code class="hljs language-${language}">${highlighted}</code></pre>`;
			} catch (e) {
				console.error('Syntax highlighting error:', e);
				return `<pre><code class="hljs">${escapeHtml(text)}</code></pre>`;
			}
		}
	}
});

export function markdownToHtml(content: string): string {
	const html = markdown.parse(content, { async: false });
	return typeof html === 'string' ? html : '';
}
