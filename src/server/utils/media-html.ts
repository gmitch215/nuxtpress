import { POST_TYPE_LABELS, mediaUrl } from '~/shared/media';
import type { BlogPost } from '~/shared/types';
import { escapeHtml } from './mail-templates';

/** The post body for places that cannot run the site's players: the feed and any HTML export. */
export function mediaBodyHtml(post: BlogPost, origin: string, captionHtml: string): string {
	const url = (key: string) => escapeHtml(`${origin}${mediaUrl(key)}`);

	if (post.type === 'slideshow') {
		return post.media
			.map(
				(item) =>
					`<figure><img src="${url(item.key)}" alt="${escapeHtml(item.caption ?? post.title)}">${
						item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ''
					}</figure>`
			)
			.join('\n');
	}

	const item = post.media[0];
	if (!item) return captionHtml;
	const player =
		post.type === 'video'
			? `<video controls preload="metadata" src="${url(item.key)}"></video>`
			: `<audio controls preload="metadata" src="${url(item.key)}"></audio>`;
	return `${player}\n${captionHtml}`;
}

export function postTypeLabel(type: BlogPost['type']): string {
	return POST_TYPE_LABELS[type];
}
