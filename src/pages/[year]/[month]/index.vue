<template>
	<div class="w-full px-8 py-8">
		<div class="max-w-6xl mx-auto">
			<h1 class="text-4xl font-bold mb-2">Posts from {{ monthName }} {{ year }}</h1>
			<div
				v-if="days.length > 0"
				class="flex flex-col space-y-2 mb-8"
			>
				<h2 class="text-lg font-semibold">Browse by Day</h2>
				<div class="flex flex-wrap gap-2">
					<UButton
						:to="`/${year}`"
						variant="subtle"
						color="error"
						icon="mdi:arrow-left"
						>Back to {{ year }}</UButton
					>
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
const { settings } = useSettings();
const config = useRuntimeConfig();

const year = parseInt(route.params.year?.toString() || '0', 10);
const month = parseInt(route.params.month?.toString() || '0', 10);

if (isNaN(year) || isNaN(month)) {
	throw createError({
		statusCode: 404,
		statusMessage: `Page not found: /${route.params.year}/${route.params.month}`,
		message: 'Page not found. The requested date does not exist.'
	});
}

if (year < 2000 || year > new Date().getUTCFullYear()) {
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

const name = settings.value.name || config.public.name;
useSeoMeta({
	title: `Posts from ${monthName.value} ${year} - ${name}`,
	description: `Read blog posts published in ${monthName.value} ${year} at ${name}.`,
	ogTitle: `Posts from ${monthName.value} ${year} - ${name}`,
	ogDescription: `Read blog posts published in ${monthName.value} ${year} at ${name}.`
});

const filteredPosts = computed(() => {
	return posts.value.filter((post) => {
		const postDate = new Date(post.created_at);
		return postDate.getUTCFullYear() === year && postDate.getUTCMonth() + 1 === month;
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
		if (postDate.getUTCFullYear() === year && postDate.getUTCMonth() + 1 === month) {
			daySet.add(postDate.getUTCDate());
		}
	});
	return Array.from(daySet).sort((a, b) => a - b);
});
</script>
