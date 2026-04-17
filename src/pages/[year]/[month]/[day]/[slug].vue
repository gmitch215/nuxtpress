<template>
	<article
		v-if="post"
		class="w-full px-18 max-w-4xl mx-auto py-8"
	>
		<div class="space-y-6">
			<header class="space-y-4">
				<div class="flex items-center">
					<h1
						class="text-4xl font-bold border-l-6 -ml-5 pl-3"
						:style="`border-color: ${settings.themeColor || $config.public.themeColor}`"
					>
						{{ post.title }}
					</h1>
					<UButton
						v-if="loggedIn"
						icon="mdi:pencil"
						class="ml-4"
						color="primary"
						:ui="{
							base: 'size-7 lg:size-8 justify-center items-center',
							leadingIcon: 'size-4 lg:size-5'
						}"
						@click="editorOpen = true"
					/>
					<UButton
						v-if="loggedIn"
						icon="mdi:delete"
						class="ml-2"
						color="error"
						:ui="{
							base: 'size-7 lg:size-8 justify-center items-center',
							leadingIcon: 'size-4 lg:size-5'
						}"
						@click="deletePost"
					/>
				</div>

				<div class="flex items-center gap-4 text-gray-600 dark:text-gray-400">
					<time :datetime="post.created_at.toISOString()">
						{{ formatDate(post.created_at) }}
					</time>
					<span
						v-if="post.tags && post.tags.length > 0"
						class="flex gap-2"
					>
						<UBadge
							v-for="tag in post.tags"
							:key="tag"
							variant="subtle"
						>
							{{ tag }}
						</UBadge>
					</span>
				</div>
			</header>

			<div
				v-if="thumbnailUrl"
				class="w-full"
			>
				<LazyNuxtImg
					:src="thumbnailUrl"
					:alt="post.title"
					fit="cover"
					:preload="{ fetchPriority: 'high' }"
					format="webp"
					quality="85"
					sizes="sm:100vw md:896px lg:896px"
					class="w-full h-auto rounded-lg shadow-lg min-h-50 max-h-96 object-cover"
					hydrate-on-visible
				/>
			</div>

			<span :style="`color: ${settings.themeColor || $config.public.themeColor}`"
				>{{ Math.max(1, Math.floor(post.content.length / 1190)) }} min. read</span
			>
			<div
				class="prose prose-lg dark:prose-invert max-w-none"
				v-html="renderedContent"
				style="contain-intrinsic-size: auto 500px"
			/>
			<footer class="pt-8 border-t border-gray-200 dark:border-gray-800">
				<div class="text-sm text-gray-500 dark:text-gray-400">
					Post by {{ settings.author || $config.public.author }} | Last updated:
					{{ formatDate(post.updated_at) }}
				</div>
			</footer>
		</div>
	</article>
	<UModal
		v-model:open="editorOpen"
		title="Edit Blog Post"
		class="max-w-[90vw] w-full"
	>
		<template #body>
			<LazyBlogForm
				:initial-data="post || undefined"
				mode="edit"
				@cancel="editorOpen = false"
				@submit="
					editorOpen = false;
					$router.go(0); // refresh the page to show updated post
				"
				hydrate-on-visible
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import { formatDate, type BlogPost } from '~/shared/types';

const { settings } = useSettings();
const config = useRuntimeConfig();
const { loggedIn, isLoggedIn } = useLogin();
const editorOpen = ref(false);

// Check login state during SSR for better performance
await isLoggedIn();

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { year, month, day, slug } = route.params;

const ALLOWED_TAG_NAMES = new Set([
	'p',
	'br',
	'hr',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'ul',
	'ol',
	'li',
	'blockquote',
	'pre',
	'code',
	'em',
	'strong',
	'del',
	'u',
	'a',
	'img',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'span'
]);

const ALLOWED_ATTRS: Record<string, ReadonlySet<string>> = {
	'*': new Set(['class', 'title']),
	a: new Set(['href', 'target', 'rel']),
	img: new Set(['src', 'alt', 'loading', 'decoding']),
	code: new Set(['class']),
	span: new Set(['class'])
};

function isRelativeUrl(value: string): boolean {
	return (
		value.startsWith('/') ||
		value.startsWith('./') ||
		value.startsWith('../') ||
		value.startsWith('#')
	);
}

function isSafeUrl(value: string, type: 'link' | 'media'): boolean {
	if (!value) return false;

	if (isRelativeUrl(value)) {
		return true;
	}

	try {
		const url = new URL(value);
		const protocol = url.protocol.toLowerCase();
		if (type === 'link') {
			return (
				protocol === 'http:' ||
				protocol === 'https:' ||
				protocol === 'mailto:' ||
				protocol === 'tel:'
			);
		}
		return protocol === 'http:' || protocol === 'https:';
	} catch {
		return false;
	}
}

function sanitizeServerFallback(html: string): string {
	return html
		.replace(
			/<\s*(script|style|iframe|object|embed|form|button|textarea|select|option)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
			''
		)
		.replace(/<\s*(input|meta|link|base)\b[^>]*\/?>/gi, '')
		.replace(/\son\w+\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
		.replace(/\sstyle\s*=\s*(".*?"|'.*?'|[^\s>]+)/gi, '')
		.replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, '')
		.replace(/\s(href|src)\s*=\s*(['"])\s*data:[\s\S]*?\2/gi, '')
		.replace(/\s(href|src)\s*=\s*javascript:[^\s>]*/gi, '')
		.replace(/\s(href|src)\s*=\s*data:[^\s>]*/gi, '');
}

function sanitizeHtmlLocally(html: string): string {
	if (!html) return '';

	if (
		import.meta.client &&
		typeof window !== 'undefined' &&
		typeof window.DOMParser !== 'undefined'
	) {
		const parser = new window.DOMParser();
		const doc = parser.parseFromString(html, 'text/html');

		doc
			.querySelectorAll(
				'script,style,iframe,object,embed,form,input,button,textarea,select,option,meta,link,base'
			)
			.forEach((node) => node.remove());

		for (const node of Array.from(doc.body.querySelectorAll('*'))) {
			const tagName = node.tagName.toLowerCase();

			if (!ALLOWED_TAG_NAMES.has(tagName)) {
				node.replaceWith(...Array.from(node.childNodes));
				continue;
			}

			for (const attr of Array.from(node.attributes)) {
				const attrName = attr.name.toLowerCase();
				const attrValue = attr.value.trim();
				const allowedForTag = ALLOWED_ATTRS[tagName];
				const isAllowed = ALLOWED_ATTRS['*']?.has(attrName) || allowedForTag?.has(attrName);

				if (!isAllowed || attrName.startsWith('on')) {
					node.removeAttribute(attr.name);
					continue;
				}

				if (attrName === 'href' && !isSafeUrl(attrValue, 'link')) {
					node.removeAttribute(attr.name);
					continue;
				}

				if (attrName === 'src' && !isSafeUrl(attrValue, 'media')) {
					node.removeAttribute(attr.name);
				}
			}

			if (tagName === 'a') {
				const href = node.getAttribute('href') || '';
				if (href.startsWith('http://') || href.startsWith('https://')) {
					node.setAttribute('target', '_blank');
					node.setAttribute('rel', 'noopener noreferrer nofollow');
				} else {
					node.removeAttribute('target');
					node.removeAttribute('rel');
				}
			}

			if (tagName === 'img') {
				if (!node.getAttribute('loading')) {
					node.setAttribute('loading', 'lazy');
				}
				node.setAttribute('decoding', 'async');
			}
		}

		return doc.body.innerHTML;
	}

	// Keep SSR rendering safe without depending on browser globals.
	return sanitizeServerFallback(html);
}

const year0 = parseInt(year?.toString() || '0', 10);
const month0 = parseInt(month?.toString() || '0', 10);
const day0 = parseInt(day?.toString() || '0', 10);
const slug0 = computed(() => {
	let slug0 = slug?.toString() || '';

	// Remove .html and .htm extension if present
	if (slug0.endsWith('.html')) {
		slug0 = slug0.slice(0, -5);
	} else if (slug0.endsWith('.htm')) {
		slug0 = slug0.slice(0, -4);
	}

	// Decode URL-encoded characters
	try {
		slug0 = decodeURIComponent(slug0);
	} catch (e) {
		// If decoding fails, keep the original slug
	}

	return slug0;
});

// Basic validation without throwing errors
const isValidDate =
	!isNaN(year0) &&
	!isNaN(month0) &&
	!isNaN(day0) &&
	year0 >= 2000 &&
	year0 <= new Date().getUTCFullYear() + 1 &&
	month0 >= 1 &&
	month0 <= 12 &&
	day0 >= 1 &&
	day0 <= 31;

const { data: post, error } = await useAsyncData(
	`blog-post-${slug0.value}-${year0}-${month0}-${day0}`,
	async () => {
		if (!isValidDate) return null;

		const res = await $fetch<BlogPost>('/api/blog/find', {
			method: 'GET',
			query: {
				slug: slug0.value,
				year: year0,
				month: month0,
				day: day0
			}
		});

		// ensure dates are Date objects (in case they come from cache as strings)
		return {
			...res,
			created_at: new Date(res.created_at),
			updated_at: new Date(res.updated_at)
		};
	}
);

if (error.value) {
	const err = error.value as {
		statusCode?: number;
		status?: number;
		statusMessage?: string;
		message?: string;
	};
	const statusCode0 = err.statusCode ?? err.status ?? 500;
	const statusCode = Number.isFinite(Number(statusCode0)) ? Number(statusCode0) : 500;

	if (statusCode === 404) {
		throw createError({
			statusCode: 404,
			statusMessage: 'Blog Post Not Found',
			message: `The blog post you're looking for doesn't exist or may have been removed.`,
			fatal: false
		});
	}

	throw createError({
		statusCode,
		statusMessage: err.statusMessage || err.message || 'Unable to load blog post',
		fatal: false
	});
}

if (!post.value) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Blog Post Not Found',
		message: `The blog post you're looking for doesn't exist or may have been removed.`,
		fatal: false
	});
}

const localThumbnailUrl = ref<string | null>(null);

function revokeLocalThumbnailUrl() {
	if (
		import.meta.client &&
		localThumbnailUrl.value &&
		typeof URL !== 'undefined' &&
		typeof URL.revokeObjectURL === 'function'
	) {
		URL.revokeObjectURL(localThumbnailUrl.value);
	}

	localThumbnailUrl.value = null;
}

function toThumbnailBytes(value: unknown): Uint8Array | null {
	if (!value) return null;

	if (value instanceof Uint8Array) {
		return value;
	}

	if (Array.isArray(value)) {
		return Uint8Array.from(value.filter((v): v is number => typeof v === 'number'));
	}

	if (typeof value === 'object') {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([key, v]) => /^\d+$/.test(key) && typeof v === 'number')
			.sort((a, b) => Number(a[0]) - Number(b[0]));

		if (entries.length > 0) {
			return Uint8Array.from(entries.map(([, v]) => Number(v)));
		}
	}

	return null;
}

watch(
	() => post.value?.thumbnail,
	() => {
		revokeLocalThumbnailUrl();

		if (!import.meta.client || !post.value || post.value.thumbnail_url) {
			return;
		}

		if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
			return;
		}

		const bytes = toThumbnailBytes(post.value.thumbnail as unknown);
		if (!bytes || bytes.length === 0) {
			return;
		}

		const safeBytes = new Uint8Array(bytes.byteLength);
		safeBytes.set(bytes);
		localThumbnailUrl.value = URL.createObjectURL(new Blob([safeBytes]));
	},
	{ immediate: true }
);

const thumbnailUrl = computed(() => {
	if (!post.value) return null;

	if (post.value.thumbnail_url) {
		return post.value.thumbnail_url;
	}

	return localThumbnailUrl.value;
});

const renderedContent = computed(() => {
	if (!post.value?.content) return '';

	try {
		const { renderMarkdown } = useMarkdown();
		const html = renderMarkdown(post.value.content);
		return sanitizeHtmlLocally(html);
	} catch (e) {
		console.error('Markdown rendering error:', e);
		return '<p class="text-red-500">Error rendering content</p>';
	}
});

const name = settings.value.name || config.public.name;
useSeoMeta({
	title: `${post?.value.title || 'Blog Post'} | ${name}`,
	description:
		post?.value.content.slice(0, 260).replace(/\n/g, ' ') ||
		settings.value.description ||
		config.public.description,
	ogTitle: `${post?.value.title || 'Blog Post'} | ${name}`,
	ogDescription:
		post?.value.content.slice(0, 260).replace(/\n/g, ' ') ||
		settings.value.description ||
		config.public.description
});

useHead({
	meta: [
		{
			property: 'citation_title',
			content: post?.value.title || ''
		},
		{
			property: 'citation_author',
			content: settings.value.author || config.public.author || ''
		},
		{
			property: 'citation_publication_date',
			content: post
				? `${post.value.created_at.getUTCFullYear()}/${(post.value.created_at.getUTCMonth() + 1)
						.toString()
						.padStart(2, '0')}/${post.value.created_at.getUTCDate().toString().padStart(2, '0')}`
				: ''
		},
		{
			property: 'citation_keywords',
			content: post?.value.tags.join(', ') || ''
		}
	],
	link: thumbnailUrl.value
		? [
				{
					rel: 'preload',
					as: 'image',
					href: thumbnailUrl.value,
					fetchpriority: 'high'
				}
			]
		: undefined
});

useSchemaOrg([
	defineWebPage({
		name: `${name} | ${post?.value.title || 'Blog Post'}`,
		description:
			post?.value.content.slice(0, 360).replace(/\n/g, ' ') ||
			settings.value.description ||
			config.public.description,
		image: thumbnailUrl.value
			? {
					'@type': 'ImageObject',
					url: thumbnailUrl.value
				}
			: undefined
	})
]);

onBeforeUnmount(() => {
	revokeLocalThumbnailUrl();
});

async function deletePost() {
	if (!loggedIn.value || !post.value) return;

	const yes = confirm(
		'Are you sure you want to delete this blog post? This action cannot be undone.'
	);
	if (!yes) return;

	await $fetch(`/api/blog/remove?id=${post.value.id}`, {
		method: 'DELETE'
	});

	toast.add({
		title: 'Post Deleted',
		description: `The blog post '${post.value.title}' has been deleted successfully.`,
		icon: 'mdi:delete',
		duration: 5000,
		color: 'error'
	});

	router.push('/');
}
</script>
