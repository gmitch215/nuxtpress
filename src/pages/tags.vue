<template>
	<div class="w-full flex space-x-2 justify-center items-center mt-2">
		<ClientOnly>
			<UButton
				icon="mdi:refresh"
				color="neutral"
				variant="outline"
				:loading="refreshing"
				:disabled="refreshing"
				@click="refreshPosts"
				size="lg"
			/>
		</ClientOnly>
	</div>

	<div class="w-full flex flex-col items-center justify-center my-3">
		<h2 class="text-lg font-semibold">Browse by Tag</h2>

		<div class="flex flex-wrap justify-center mt-2 max-w-100 gap-y-2">
			<UBadge
				v-for="tag in tags"
				:key="tag"
				class="mx-1"
				color="info"
				variant="soft"
			>
				<UCheckbox
					size="sm"
					class="cursor-pointer select-none"
					@update:model-value="
						(selected) => {
							if (selected) {
								selectedTags.push(tag);
							} else {
								selectedTags.splice(selectedTags.indexOf(tag), 1);
							}
						}
					"
				/>
				{{ tag }}
			</UBadge>
		</div>
	</div>

	<BlogPostGroup :posts="filteredPosts" />
</template>

<script setup lang="ts">
const { posts, fetchPosts } = useBlogPosts();

const tags = computed(() => {
	const tagSet = new Set<string>();
	posts.value.forEach((post) => {
		post.tags.forEach((tag) => tagSet.add(tag));
	});
	return Array.from(tagSet).sort();
});

const selectedTags = ref<string[]>([]);
const filteredPosts = computed(() => {
	if (selectedTags.value.length === 0) {
		return posts.value;
	}
	return posts.value.filter((post) => selectedTags.value.every((tag) => post.tags.includes(tag)));
});

const refreshing = ref(false);
async function refreshPosts() {
	refreshing.value = true;
	await fetchPosts();
	refreshing.value = false;
}
</script>
