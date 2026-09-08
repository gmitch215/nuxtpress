<template>
	<BlogArticle
		v-if="post"
		:post="post"
	/>
</template>

<script setup lang="ts">
const route = useRoute();
const { year, month, day, slug } = route.params;

const { post } = await useBlogPostPage(slug?.toString() || '', {
	year: parseInt(year?.toString() || '0', 10),
	month: parseInt(month?.toString() || '0', 10),
	day: parseInt(day?.toString() || '0', 10)
});
</script>
