import { gitHubEmojis } from '@tiptap/extension-emoji';
import hljs from 'highlight.js';
import { marked } from 'marked';

// Extension to support ++underline++ syntax
const underlineExtension = {
	name: 'underline',
	level: 'inline',
	start(src: string) {
		return src.match(/\+\+/)?.index;
	},
	tokenizer(src: string) {
		const rule = /^\+\+([^\+]+)\+\+/;
		const match = rule.exec(src);
		if (match) {
			return {
				type: 'underline',
				raw: match[0],
				text: match[1]
			};
		}
	},
	renderer(token: any) {
		return `<u>${token.text}</u>`;
	}
};

function convertEmojis(content: string): string {
	return content.replace(/:([a-zA-Z0-9_+-]+):/g, (match, shortcode) => {
		const emojiItem = gitHubEmojis.find((item) => item.shortcodes.includes(shortcode));
		return emojiItem?.emoji || match;
	});
}

export function useMarkdown() {
	const renderMarkdown = (content: string): string => {
		content = convertEmojis(content);
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

		marked.use({ extensions: [underlineExtension] });

		const html = marked(content, {
			renderer: renderer,
			breaks: true,
			gfm: true
		});

		return typeof html === 'string' ? html : '';
	};

	return { renderMarkdown };
}
