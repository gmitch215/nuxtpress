<template>
	<div class="w-full justify-center px-4 sm:px-6 md:px-8 mt-8">
		<UBlogPosts
			:orientation="$viewport.isLessOrEquals('mobileMedium') ? 'vertical' : 'horizontal'"
			class="mb-4"
		>
			<LazyUBlogPost
				v-for="(post, index) in displayed"
				:key="post.to + index"
				:title="post.title"
				:description="post.description"
				:date="post.date"
				:badge="post.badge"
				:to="post.to"
				hydrate-on-visible
			>
				<template #header>
					<Thumbnail
						:src="post.imageSrc"
						:alt="post.title"
						:eager="index < 2"
						:to="post.to"
					/>
				</template>
			</LazyUBlogPost>
		</UBlogPosts>
		<LazyClientOnly>
			<span class="text-gray-500 light:text-gray-400">{{ displayed.length }} total post(s)</span>
		</LazyClientOnly>
	</div>
</template>

<script setup lang="ts">
import type { BlogPost } from '~/shared/types';

const props = defineProps<{ posts: BlogPost[] }>();
const { renderMarkdown } = useMarkdown();

const stripHtml = (html: string): string => {
	if (import.meta.client) {
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
		let imageSrc: string;
		if (post.thumbnail_url) {
			imageSrc = post.thumbnail_url;
		} else if (post.thumbnail && import.meta.client) {
			const array = new Uint8Array(post.thumbnail);
			const blobUrl = URL.createObjectURL(new Blob([array]));
			imageBlobs.push(blobUrl);
			imageSrc = blobUrl;
		} else {
			imageSrc = '/favicon.png';
		}

		const date = new Date(post.created_at);
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		const day = date.getUTCDate();

		let description = '';
		if (post.content) {
			const rendered = renderMarkdown(post.content);
			const plainText = stripHtml(rendered);
			description = plainText.slice(0, 150) + (plainText.length > 150 ? '...' : '');
		}

		return {
			title: post.title,
			description,
			date: post.created_at,
			badge: post.tags?.[0] || 'General',
			imageSrc,
			to: `/${year}/${month}/${day}/${post.slug}`
		};
	})
);

onBeforeUnmount(() => {
	while (imageBlobs.length) {
		const blob = imageBlobs.pop();
		if (blob) URL.revokeObjectURL(blob);
	}
});
</script>
