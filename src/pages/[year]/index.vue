<template>
	<div class="w-full px-8 py-8">
		<div class="max-w-6xl mx-auto">
			<h1 class="text-4xl font-bold mb-2">Posts from {{ year }}</h1>
			<div
				v-if="months.length > 0"
				class="flex flex-col space-y-2 mb-8"
			>
				<h2 class="text-lg font-semibold">Browse by Month</h2>
				<div class="flex flex-wrap gap-2">
					<UButton
						to="/"
						variant="subtle"
						color="error"
						icon="mdi:arrow-left"
						>Back to Home</UButton
					>
					<UButton
						v-for="month in months"
						:key="month.number"
						:to="`/${year}/${month.number}`"
						variant="subtle"
						color="secondary"
						icon="mdi:calendar-month"
					>
						{{ month.name }} {{ year }}
					</UButton>
				</div>
			</div>

			<div v-if="filteredPosts.length > 0 && !loading">
				<BlogPostGroup :posts="filteredPosts" />
			</div>
			<div
				v-else-if="!loading"
				class="text-center py-20"
			>
				<p class="text-gray-500 dark:text-gray-400 text-lg">No posts found for {{ year }}</p>
				<UButton
					to="/"
					class="mt-4"
					icon="mdi:home"
					variant="outline"
				>
					Back to Home
				</UButton>
			</div>
		</div>
	</div>
</template>

<script setup lang="ts">
const { posts, fetchPosts } = useBlogPosts();
const route = useRoute();
const { settings } = useSettings();
const config = useRuntimeConfig();

const year = parseInt(route.params.year?.toString() || '0', 10);
if (isNaN(year)) {
	throw createError({
		statusCode: 404,
		statusMessage: `Page not found: /${route.params.year}`,
		message: 'Page not found. The requested page does not exist.'
	});
}

if (year < 2000 || year > new Date().getUTCFullYear()) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Invalid year',
		message: 'The requested year is not valid or out of range.'
	});
}

const name = settings.value.name || config.public.name;
useSeoMeta({
	title: `Posts from ${year} - ${name}`,
	description: `Read blog posts published in ${year} at ${name}.`
});

const filteredPosts = computed(() => {
	return posts.value.filter((post) => {
		const postDate = new Date(post.created_at);
		return postDate.getUTCFullYear() === year;
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

const months = computed(() => {
	const monthSet = new Set<number>();
	posts.value.forEach((post) => {
		const postDate = new Date(post.created_at);
		if (postDate.getUTCFullYear() === year) {
			monthSet.add(postDate.getUTCMonth() + 1);
		}
	});
	return Array.from(monthSet)
		.sort((a, b) => a - b)
		.map((month) => ({
			number: month,
			name: monthNames[month - 1]
		}));
});
</script>
