/**
 * Strips markdown to readable plain text for excerpts, meta descriptions and feed summaries.
 * Order matters: fenced code and images go before inline syntax so their delimiters don't leak.
 */
export function markdownToText(markdown: string): string {
	return markdown
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/~~~[\s\S]*?~~~/g, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}([-*_]\s*){3,}$/gm, ' ')
		.replace(/^\s{0,3}[-*+]\s+/gm, '')
		.replace(/^\s{0,3}\d+\.\s+/gm, '')
		.replace(/`([^`]*)`/g, '$1')
		.replace(/(\*\*|__)(.*?)\1/g, '$2')
		.replace(/(\*|_)(.*?)\1/g, '$2')
		.replace(/\+\+(.*?)\+\+/g, '$1')
		.replace(/~~(.*?)~~/g, '$1')
		.replace(/&nbsp;/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function excerptOf(markdown: string, max = 200): string {
	const text = markdownToText(markdown || '');
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

/**
 * Minutes to read a post's text. Images count only through their caption (the alt text), because
 * an inline data URL runs to hundreds of thousands of characters. `null` when nothing is readable.
 */
export function readingMinutes(markdown: string): number | null {
	const text = (markdown || '')
		.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/<img\b[^>]*>/gi, '')
		.trim();
	return text ? Math.max(1, Math.floor(text.length / 1190)) : null;
}
