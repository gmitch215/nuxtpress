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
			<UButton
				v-if="loggedIn"
				icon="mdi:plus"
				color="primary"
				variant="outline"
				size="lg"
				@click="newPostOpen = true"
				>New Post</UButton
			>
			<UButton
				v-else
				icon="mdi:account-lock"
				color="primary"
				variant="outline"
				size="lg"
				@click="loginOpen = true"
				>Log In</UButton
			>
			<UButton
				v-if="loggedIn"
				icon="material-symbols:settings"
				color="error"
				variant="outline"
				size="lg"
				@click="settingsOpen = true"
			/>
		</ClientOnly>
	</div>
	<div
		class="w-full flex flex-col my-4"
		v-if="years.length > 0"
	>
		<h2 class="text-lg font-semibold text-center my-1">Browse by Year</h2>
		<div class="w-full flex space-x-2 justify-center items-center">
			<UButton
				v-for="year in years"
				:key="year"
				:to="`/${year}`"
				variant="subtle"
				color="neutral"
				icon="mdi:calendar-edit"
			>
				{{ year }}
			</UButton>
		</div>
	</div>
	<BlogPostGroup :posts="posts" />
	<UModal
		v-model:open="loginOpen"
		title="Admin Login"
	>
		<template #body>
			<LoginForm
				@success="
					loginOpen = false;
					loggedIn = true;
				"
			/>
		</template>
	</UModal>
	<UModal
		v-if="loggedIn"
		v-model:open="newPostOpen"
		title="Create New Blog Post"
		class="max-w-[90vw] w-full"
	>
		<template #body>
			<BlogForm
				mode="create"
				@cancel="newPostOpen = false"
				@submit="
					newPostOpen = false;
					refreshPosts();
				"
			/>
		</template>
	</UModal>
	<UModal
		v-if="loggedIn"
		v-model:open="settingsOpen"
		title="Settings"
		class="min-w-140"
	>
		<template #body>
			<SettingsForm
				@cancel="settingsOpen = false"
				@submit="settingsOpen = false"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
const { posts, fetchPosts } = useBlogPosts();
const { loggedIn } = useLogin();
const { fetchSettings } = useSettings();

const loginOpen = ref(false);
const newPostOpen = ref(false);
const settingsOpen = ref(false);

const refreshing = ref(false);
async function refreshPosts() {
	refreshing.value = true;
	await fetchPosts();
	refreshing.value = false;
}

onMounted(async () => {
	await fetchPosts();
	// Prefetch settings to avoid delay when opening settings modal
	if (loggedIn.value) {
		fetchSettings().catch(() => {});
	}
});

const years = computed(() => {
	const yearSet = new Set<number>();
	posts.value.forEach((post) => {
		const postDate = new Date(post.created_at);
		yearSet.add(postDate.getUTCFullYear());
	});
	return Array.from(yearSet).sort((a, b) => b - a);
});
</script>
