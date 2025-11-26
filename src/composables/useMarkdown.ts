import hljs from 'highlight.js';
import { marked } from 'marked';

export function useMarkdown() {
	const renderMarkdown = (content: string): string => {
		// Configure marked with custom renderer for code blocks
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

		const html = marked(content, {
			renderer: renderer,
			breaks: true,
			gfm: true
		});

		return typeof html === 'string' ? html : '';
	};

	return { renderMarkdown };
}
