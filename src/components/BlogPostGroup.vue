<template>
	<div class="w-full justify-center px-32 mt-8">
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
		const year = date.getFullYear();
		const month = date.getMonth() + 1; // getMonth() returns 0-11, we need 1-12
		const day = date.getDate(); // getDate() returns day of month

		const display = {
			title: post.title,
			description:
				post.content?.slice(0, 100) + (post.content && post.content.length > 100 ? '...' : ''),
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
