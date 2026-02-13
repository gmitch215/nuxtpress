<template>
	<div class="w-full justify-center px-4 sm:px-8 md:px-12 lg:px-24 xl:px-32 mt-8">
		<UBlogPosts
			:posts="displayed"
			:orientation="$viewport.isLessOrEquals('mobileMedium') ? 'vertical' : 'horizontal'"
			class="mb-4"
			:ui="{
				image: 'aspect-2/1 object-cover w-full h-full',
				imageWrapper: 'overflow-hidden'
			}"
		/>
		<ClientOnly>
			<span class="text-gray-500 light:text-gray-400">{{ displayed.length }} total post(s)</span>
		</ClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { BlogPost } from '~/shared/types';

const props = defineProps<{
	posts: BlogPost[];
}>();

const { renderMarkdown } = useMarkdown();

const stripHtml = (html: string): string => {
	if (import.meta.client) {
		// use browser's DOMParser to properly decode HTML entities
		const doc = new DOMParser().parseFromString(html, 'text/html');
		return doc.body.textContent || '';
	}

	return html
		.replace(/<[^>]*>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&#x27;/g, "'")
		.trim();
};

const imageBlobs: string[] = [];
const displayed = computed(() =>
	props.posts.map((post: BlogPost, index: number) => {
		let image: string | (Partial<HTMLImageElement> & { [key: string]: any });

		if (post.thumbnail_url) {
			image = post.thumbnail_url;
		} else if (post.thumbnail) {
			const array = new Uint8Array(post.thumbnail);
			const blobUrl = URL.createObjectURL(new Blob([array]));
			imageBlobs.push(blobUrl);
			image = blobUrl;
		} else {
			image = '/favicon.png';
		}

		if (index < 2 && typeof image === 'string') {
			image = {
				src: image,
				decoding: 'async',
				loading: 'eager',
				fetchPriority: 'high',
				format: 'webp',
				quality: '85',
				sizes: 'sm:100vw md:50vw lg:33vw'
			};
		} else if (typeof image === 'string') {
			image = {
				src: image,
				loading: 'lazy',
				format: 'webp',
				quality: '80',
				sizes: 'sm:100vw md:50vw lg:33vw'
			};
		}

		const date = new Date(post.created_at);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		const day = date.getUTCDate();

		// Render markdown first, then strip HTML for description preview
		let description = '';
		if (post.content) {
			const rendered = renderMarkdown(post.content);
			const plainText = stripHtml(rendered);
			description = plainText.slice(0, 150) + (plainText.length > 150 ? '...' : '');
		}

		const display = {
			title: post.title,
			description,
			date: post.created_at,
			badge: post.tags?.[0] || 'General',
			image,
			to: `/${year}/${month}/${day}/${post.slug}`
		};

		return display;
	})
);

onBeforeUnmount(() => {
	while (imageBlobs.length) {
		const blob = imageBlobs.pop();
		if (blob) {
			URL.revokeObjectURL(blob);
		} else {
			break;
		}
	}
});
</script>
