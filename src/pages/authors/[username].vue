<template>
	<div class="w-full max-w-4xl mx-auto px-4 sm:px-8 py-8">
		<header class="flex flex-col sm:flex-row items-center sm:items-start gap-6 mb-8">
			<Avatar
				:pathname="author?.avatarPathname"
				:display-name="author?.displayName"
				size="xl"
			/>
			<div class="text-center sm:text-left flex-1">
				<h1 class="text-3xl font-bold">{{ author?.displayName }}</h1>
				<p class="text-muted text-sm">@{{ author?.username }} · {{ author?.role }}</p>
				<p
					v-if="author?.bio"
					class="mt-2 whitespace-pre-line"
				>
					{{ author.bio }}
				</p>
			</div>
		</header>

		<section class="flex flex-col w-full">
			<h2 class="text-xl font-semibold mb-4">Posts ({{ posts.length }})</h2>
			<div
				v-if="posts.length === 0"
				class="text-center text-muted py-12"
			>
				No posts yet.
			</div>

			<BlogPostGroup
				v-else
				:posts="posts"
			/>
		</section>
	</div>
</template>

<script setup lang="ts">
import type { BlogPostSummary, PublicUser } from '~/shared/types';

const route = useRoute();
const username = computed(() => String(route.params.username || '').toLowerCase());

const { data, error } = await useAsyncData(
	() => `author:${username.value}`,
	() => $fetch<{ author: PublicUser; posts: BlogPostSummary[] }>(`/api/users/${username.value}`)
);

if (error.value) {
	throw createError({
		statusCode: 404,
		statusMessage: 'Author Not Found',
		message: 'No author by that username.',
		fatal: false
	});
}

const author = computed(() => data.value?.author ?? null);
const posts = computed(() => data.value?.posts ?? []);

const { settings } = useSettings();
const config = useRuntimeConfig();
const siteName = computed(() => settings.value.name || config.public.name);

useSeoMeta({
	title: computed(() => `${author.value?.displayName ?? username.value} | ${siteName.value}`),
	description: computed(
		() => author.value?.bio || `Posts by ${author.value?.displayName ?? username.value}`
	),
	ogTitle: computed(() => `${author.value?.displayName ?? username.value} | ${siteName.value}`),
	ogDescription: computed(
		() => author.value?.bio || `Posts by ${author.value?.displayName ?? username.value}`
	)
});

useSchemaOrg([
	definePerson({
		name: author.value?.displayName ?? username.value,
		description: author.value?.bio || `Posts by ${author.value?.displayName ?? username.value}`,
		image: author.value?.avatarPathname
			? `${config.public.baseURL}/api/avatars/${author.value.avatarPathname}`
			: undefined,
		url: `${config.public.baseURL}/authors/${author.value?.username ?? username.value}`
	})
]);
</script>
