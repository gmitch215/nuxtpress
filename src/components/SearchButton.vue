<template>
	<UModal v-model:open="open">
		<UButton
			icon="mdi:calendar-search"
			variant="subtle"
			color="neutral"
			title="Search Posts"
		/>

		<template #content>
			<LazyUCommandPalette
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
import { formatDate, type BlogPostSummary } from '~/shared/types';

const open = ref(false);
const search = ref('');
const debounced = ref('');
const { urlFor } = usePostUrl();

// client-only and query-scoped; SSR-fetching the whole list here put every post's full body into
// the payload of every page that renders the navbar
const {
	data: posts,
	status,
	refresh
} = useFetch<BlogPostSummary[]>('/api/blog/search', {
	key: 'blog-posts-search',
	query: { q: debounced },
	server: false,
	lazy: true,
	immediate: false,
	default: () => []
});

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
watch(search, (value) => {
	if (debounceTimer) clearTimeout(debounceTimer);
	debounceTimer = setTimeout(() => {
		debounced.value = value.trim();
		if (debounced.value) refresh();
	}, 200);
});
onBeforeUnmount(() => {
	if (debounceTimer) clearTimeout(debounceTimer);
});

const groups = computed(() => [
	{
		id: 'posts',
		label: debounced.value ? `Blog Posts matching "${debounced.value}"` : 'Blog Posts',
		items: (posts.value ?? []).map((post) => ({
			id: post.id,
			label: post.title,
			description: post.author?.displayName ? `by ${post.author.displayName}` : post.excerpt,
			suffix: formatDate(post.created_at),
			avatar: {
				src: post.thumbnail_url || '/favicon.png',
				alt: post.title
			},
			onSelect: (_: Event) => {
				navigateTo(urlFor(post));
				open.value = false;
			}
		}))
	}
]);
</script>
