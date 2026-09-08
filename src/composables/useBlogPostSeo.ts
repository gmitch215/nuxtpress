import type { BlogPost } from '~/shared/types';

/** Plain-text excerpt for meta descriptions; mirrors the server-side excerpt rules. */
function toDescription(markdown: string, max: number): string {
	const text = (markdown || '')
		.replace(/```[\s\S]*?```/g, ' ')
		.replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
		.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
		.replace(/^\s{0,3}#{1,6}\s+/gm, '')
		.replace(/^\s{0,3}>\s?/gm, '')
		.replace(/[*_`~]/g, '')
		.replace(/\s+/g, ' ')
		.trim();
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	const lastSpace = cut.lastIndexOf(' ');
	return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}...`;
}

export type BlogPostSeoContext = ReturnType<typeof useBlogPostSeoContext>;

/**
 * Grabs everything that needs the Nuxt instance. Call this before any await in setup, then
 * hand the result to `applyBlogPostSeo` once the post has loaded.
 */
export function useBlogPostSeoContext() {
	const config = useRuntimeConfig();
	const { settings } = useSettings();
	const origin = useSiteOrigin();

	return { config, settings, origin };
}

export function applyBlogPostSeo(
	ctx: BlogPostSeoContext,
	post: Readonly<Ref<BlogPost | null>>,
	primaryPath: Readonly<Ref<string>>
) {
	const { config, settings, origin } = ctx;

	const canonical = computed(() => {
		const path = primaryPath.value;
		return `${origin}${path === '/' ? '/' : path.replace(/\/+$/, '')}`;
	});

	const siteName = computed(() => settings.value.name || config.public.name);
	const title = computed(() => `${post.value?.title || 'Blog Post'} | ${siteName.value}`);
	const description = computed(
		() =>
			toDescription(post.value?.content || '', 200) ||
			settings.value.description ||
			config.public.description
	);
	const authorName = computed(
		() => post.value?.author?.displayName || settings.value.author || config.public.author || ''
	);
	const imageUrl = computed(() => {
		const src = post.value?.thumbnail_url || '/favicon.png';
		return src.startsWith('http') ? src : `${origin}${src}`;
	});
	const published = computed(() => post.value?.created_at.toISOString() || '');
	const modified = computed(() => post.value?.updated_at.toISOString() || '');

	useSeoMeta({
		title,
		description,
		ogTitle: title,
		ogDescription: description,
		ogType: 'article',
		ogUrl: canonical,
		ogImage: imageUrl,
		ogImageAlt: () => post.value?.title || '',
		twitterCard: 'summary_large_image',
		twitterTitle: title,
		twitterDescription: description,
		twitterImage: imageUrl,
		articlePublishedTime: published,
		articleModifiedTime: modified,
		articleAuthor: () => [authorName.value],
		articleTag: () => post.value?.tags || [],
		author: authorName
	});

	useHead({
		link: [
			{ rel: 'canonical', href: canonical },
			{
				rel: 'preload',
				as: 'image',
				href: () => post.value?.thumbnail_url || '',
				fetchpriority: 'high'
			}
		],
		meta: [
			{ property: 'citation_title', content: () => post.value?.title || '' },
			{ property: 'citation_author', content: authorName },
			{
				property: 'citation_publication_date',
				content: () => {
					const d = post.value?.created_at;
					if (!d) return '';
					return `${d.getUTCFullYear()}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(
						d.getUTCDate()
					).padStart(2, '0')}`;
				}
			},
			{ property: 'citation_keywords', content: () => post.value?.tags.join(', ') || '' }
		]
	});

	// plain resolved values, matching the defineWebSite call in app.vue: this version's definer
	// input does not accept getters or refs
	const article = post.value;
	if (article) {
		useSchemaOrg([
			defineArticle({
				'@type': 'BlogPosting',
				headline: article.title,
				description: description.value,
				url: canonical.value,
				datePublished: article.created_at.toISOString(),
				dateModified: article.updated_at.toISOString(),
				inLanguage: 'en',
				keywords: article.tags,
				author: {
					'@type': 'Person',
					name: authorName.value,
					...(article.author?.username
						? { url: `${origin}/authors/${article.author.username}` }
						: {})
				},
				image: {
					'@type': 'ImageObject',
					url: imageUrl.value
				}
			})
		]);
	}

	return { canonical, description, imageUrl };
}
