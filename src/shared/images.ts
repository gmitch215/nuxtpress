export const INLINE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const FAVICON_TYPES = [
	...INLINE_IMAGE_TYPES,
	'image/x-icon',
	'image/vnd.microsoft.icon'
] as const;

export const INLINE_IMAGE_MAX_CHARS = 350_000;

const DATA_IMAGE_RE = /^data:(image\/[a-z0-9.+-]+);base64,[A-Za-z0-9+/]+=*$/i;
const MARKDOWN_DATA_IMAGE_RE = /!\[[^\]]*\]\((data:[^)\s]*)\)/g;

export function dataImageMime(value: string): string | null {
	return DATA_IMAGE_RE.exec(value)?.[1]?.toLowerCase() ?? null;
}

/** True for a base64 image data URL of an allowed type and, when given, at most `maxChars` long. */
export function isDataImage(
	value: string,
	types: readonly string[] = INLINE_IMAGE_TYPES,
	maxChars = Infinity
): boolean {
	if (value.length > maxChars) return false;
	const mime = dataImageMime(value);
	return mime !== null && types.includes(mime);
}

/** Every data URL embedded as a markdown image in a post body. */
export function embeddedDataImages(markdown: string): string[] {
	return Array.from(markdown.matchAll(MARKDOWN_DATA_IMAGE_RE), (match) => match[1]!);
}

export function stripDataImages(html: string): string {
	return html.replace(/<img\b[^>]*\ssrc=(["'])data:[\s\S]*?\1[^>]*>/gi, '');
}

export function decodeDataImage(
	value: string,
	types: readonly string[]
): { mime: string; bytes: Uint8Array } | null {
	const mime = dataImageMime(value);
	if (!mime || !types.includes(mime)) return null;
	try {
		const binary = atob(value.slice(value.indexOf(',') + 1));
		const bytes = new Uint8Array(binary.length);
		for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
		return { mime, bytes };
	} catch {
		return null;
	}
}
