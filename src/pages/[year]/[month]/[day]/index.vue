<template>
	<div class="w-full px-8 py-8">
		<div class="max-w-6xl mx-auto">
			<h1 class="text-4xl font-bold mb-8">Posts from {{ monthName }} {{ day }}, {{ year }}</h1>

			<ClientOnly>
				<div v-if="filteredPosts.length > 0 && !loading">
					<BlogPostGroup :posts="filteredPosts" />
				</div>
				<div
					v-else-if="!loading"
					class="text-center py-20"
				>
					<p class="text-gray-500 dark:text-gray-400 text-lg">
						No posts found for {{ monthName }} {{ day }}, {{ year }}
					</p>
					<UButton
						:to="`/${year}/${month}`"
						class="mt-4"
						icon="mdi:calendar-blank-multiple"
						variant="outline"
					>
						View All Posts from {{ monthName }} {{ year }}
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
const day = parseInt(route.params.day?.toString() || '0', 10);

if (isNaN(year) || isNaN(month) || isNaN(day)) {
	throw createError({
		statusCode: 404,
		statusMessage: `Page not found: /${route.params.year}/${route.params.month}/${route.params.day}`,
		message: 'Page not found. The requested date does not exist.'
	});
}

if (year < 2000 || year > new Date().getFullYear()) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Invalid year',
		message: 'The requested year is not valid or out of range.'
	});
}

if (month < 1 || month > 12) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Invalid month',
		message: 'The requested month is not valid or out of range.'
	});
}

if (day < 1 || day > 31) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Invalid day',
		message: 'The requested day is not valid or out of range.'
	});
}

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
		return (
			postDate.getFullYear() === year &&
			postDate.getMonth() + 1 === month &&
			postDate.getDate() === day
		);
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
</script>
