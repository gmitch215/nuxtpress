<template>
	<div class="w-full px-8 py-8">
		<div class="max-w-6xl mx-auto">
			<h1 class="text-4xl font-bold mb-8">Posts from {{ monthName }} {{ year }}</h1>
			<div
				v-if="days.length > 0"
				class="flex flex-col space-y-2 mb-8"
			>
				<h2 class="text-lg font-semibold">Browse by Day</h2>
				<div class="flex flex-wrap gap-2">
					<UButton
						v-for="day in days"
						:key="day"
						:to="`/${year}/${month}/${day}`"
						variant="subtle"
						color="secondary"
						icon="mdi:calendar-today"
					>
						{{ monthName.substring(0, 3) }} {{ day }}, {{ year }}
					</UButton>
				</div>
			</div>

			<ClientOnly>
				<div v-if="filteredPosts.length > 0 && !loading">
					<BlogPostGroup :posts="filteredPosts" />
				</div>
				<div
					v-else-if="!loading"
					class="text-center py-20"
				>
					<p class="text-gray-500 dark:text-gray-400 text-lg">
						No posts found for {{ monthName }} {{ year }}
					</p>
					<UButton
						:to="`/${year}`"
						class="mt-4"
						icon="mdi:calendar"
						variant="outline"
					>
						View All Posts from {{ year }}
					</UButton>
				</div>
			</ClientOnly>
		</div>
	</div>
</template>

<script setup lang="ts">
const { posts, fetchPosts } = useBlogPosts();
const route = useRoute();

const year = parseInt(route.params.year?.toString() || '0', 10);
const month = parseInt(route.params.month?.toString() || '0', 10);

const monthName = computed(() => {
	const monthNames = [
		'January',
		'February',
		'March',
		'April',
		'May',
		'June',
		'July',
		'August',
		'September',
		'October',
		'November',
		'December'
	];
	return monthNames[month - 1] || 'Unknown';
});

const filteredPosts = computed(() => {
	return posts.value.filter((post) => {
		const postDate = new Date(post.created_at);
		return postDate.getFullYear() === year && postDate.getMonth() + 1 === month;
	});
});

const loading = ref(false);
onMounted(async () => {
	if (posts.value.length === 0) {
		loading.value = true;
		await fetchPosts();
		loading.value = false;
	}
});

const days = computed(() => {
	const daySet = new Set<number>();
	posts.value.forEach((post) => {
		const postDate = new Date(post.created_at);
		if (postDate.getFullYear() === year && postDate.getMonth() + 1 === month) {
			daySet.add(postDate.getDate());
		}
	});
	return Array.from(daySet).sort((a, b) => a - b);
});
</script>
