import { datedPostPath, postPath, type UrlStyle } from '~/shared/types';

/**
 * Resolves post links against the site's configured URL style. Both forms always resolve;
 * this only decides which one gets rendered and which one is canonical.
 */
export function usePostUrl() {
	const { settings } = useSettings();
	const style = computed<UrlStyle>(() => (settings.value.urlStyle === 'slug' ? 'slug' : 'dated'));

	const urlFor = (post: { slug: string; created_at: Date | string }) => postPath(post, style.value);

	return { style, urlFor, datedUrlFor: datedPostPath };
}
