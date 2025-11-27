<template>
	<div class="w-full justify-center px-4 sm:px-8 md:px-12 lg:px-24 xl:px-32 mt-8">
		<UBlogPosts
			:posts="displayed"
			:orientation="$viewport.isLessOrEquals('mobileMedium') ? 'vertical' : 'horizontal'"
		/>
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
	props.posts.map((post: BlogPost) => {
		let image: string;

		if (post.thumbnail_url) {
			image = post.thumbnail_url;
		} else if (post.thumbnail) {
			const array = new Uint8Array(post.thumbnail);
			image = URL.createObjectURL(new Blob([array]));
			imageBlobs.push(image);
		} else {
			image = '/favicon.png';
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
