<template>
	<UModal v-model:open="open">
		<UButton
			icon="mdi:calendar-search"
			variant="subtle"
			color="neutral"
			title="Search Posts"
		/>

		<template #content>
			<UCommandPalette
				v-model:search-term="search"
				:loading="status === 'pending'"
				:groups="groups"
				placeholder="Search Posts..."
				close
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import { formatDate, type BlogPost } from '~/shared/types';

const { settings } = useSettings();
const config = useRuntimeConfig();
const open = ref(false);
const search = ref('');

const { data: posts, status } = await useFetch<BlogPost[]>(`/api/blog/list`, {
	key: 'blog-posts-search',
	lazy: true
});

const groups = computed(() => [
	{
		id: 'posts',
		label: search.value ? `Blog Posts matching "${search.value}"` : 'Blog Posts',
		items:
			posts.value
				?.filter(
					(post) =>
						post.title.toLowerCase().includes(search.value.toLowerCase()) ||
						// strip markdown, match content
						post.content
							.replace(/[#_*~`>-\[\]\(\)!]/g, '')
							.toLowerCase()
							.includes(search.value.toLowerCase())
				)
				.map((post) => ({
					id: post.id,
					label: post.title,
					description: `by ${settings.value.author || config.public.author}`,
					suffix: formatDate(post.created_at),
					avatar: {
						src: '/favicon.png',
						alt: post.title
					},
					onSelect: (_: Event) => {
						const date = new Date(post.created_at);
						const year = date.getUTCFullYear();
						const month = date.getUTCMonth() + 1;
						const day = date.getUTCDate();

						navigateTo(`/${year}/${month}/${day}/${post.slug}`);
						open.value = false;
					}
				})) || []
	}
]);
</script>
