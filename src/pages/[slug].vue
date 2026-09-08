<template>
	<BlogArticle
		v-if="post"
		:post="post"
	/>
</template>

<script setup lang="ts">
const route = useRoute();

// secondary permalink; the dated route stays primary unless the site opts into slug-only URLs
const { post } = await useBlogPostPage(route.params.slug?.toString() || '');
</script>
