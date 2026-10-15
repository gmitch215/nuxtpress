export const POST_TYPES = ['article', 'slideshow', 'video', 'music'] as const;
export type PostType = (typeof POST_TYPES)[number];

export const MEDIA_MAX_BYTES = 100 * 1024 * 1024;
export const MAX_SLIDES = 30;
export const MAX_SLIDE_CAPTION = 300;
export const MAX_MEDIA_CAPTION = 2000;

export const SLIDE_MIMES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
export const VIDEO_MIMES = ['video/mp4', 'video/webm'] as const;
export const MUSIC_MIMES = [
	'audio/mpeg',
	'audio/mp4',
	'audio/ogg',
	'audio/wav',
	'audio/x-wav',
	'audio/webm',
	'audio/flac'
] as const;

export const MIMES_BY_TYPE: Record<Exclude<PostType, 'article'>, readonly string[]> = {
	slideshow: SLIDE_MIMES,
	video: VIDEO_MIMES,
	music: MUSIC_MIMES
};

export const ALL_MEDIA_MIMES: readonly string[] = [...SLIDE_MIMES, ...VIDEO_MIMES, ...MUSIC_MIMES];

export const POST_TYPE_LABELS: Record<PostType, string> = {
	article: 'Article',
	slideshow: 'Slideshow',
	video: 'Video',
	music: 'Music'
};

export const POST_TYPE_ICONS: Record<PostType, string> = {
	article: 'mdi:text-box-outline',
	slideshow: 'mdi:image-multiple-outline',
	video: 'mdi:video-outline',
	music: 'mdi:music-note-outline'
};

export type MediaItem = {
	key: string;
	mime: string;
	size: number;
	caption?: string;
	width?: number;
	height?: number;
};

export const MEDIA_KEY_RE = /^media\/[a-f0-9]{32}\/[a-f0-9]{32}\.[a-z0-9]{1,5}$/;

export function mediaUrl(key: string): string {
	return `/${key}`;
}

export function isMediaPath(value: string | null | undefined): boolean {
	return !!value && /^\/media\/[a-f0-9]{32}\/[a-f0-9]{32}\.[a-z0-9]{1,5}$/.test(value);
}

export function keyFromPath(path: string): string | null {
	return isMediaPath(path) ? path.slice(1) : null;
}

export function extensionFor(mime: string): string {
	const map: Record<string, string> = {
		'image/png': 'png',
		'image/jpeg': 'jpg',
		'image/webp': 'webp',
		'image/gif': 'gif',
		'video/mp4': 'mp4',
		'video/webm': 'webm',
		'audio/mpeg': 'mp3',
		'audio/mp4': 'm4a',
		'audio/ogg': 'ogg',
		'audio/wav': 'wav',
		'audio/x-wav': 'wav',
		'audio/webm': 'weba',
		'audio/flac': 'flac'
	};
	return map[mime] ?? 'bin';
}

/** Slideshow bodies are their captions, so search, excerpts, the feed and SEO keep reading `content`. */
export function contentFromMedia(media: MediaItem[]): string {
	return media
		.map((item) => item.caption?.trim())
		.filter(Boolean)
		.join('\n\n');
}
