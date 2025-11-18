<template>
	<article
		v-if="post"
		class="w-full px-18 max-w-4xl mx-auto py-8"
	>
		<div class="space-y-6">
			<header class="space-y-4">
				<div class="flex items-center">
					<h1 class="text-4xl font-bold">{{ post.title }}</h1>
					<ClientOnly>
						<UButton
							v-if="loggedIn"
							icon="mdi:pencil"
							class="ml-4"
							color="primary"
							:ui="{
								base: 'size-7 lg:size-8 justify-center items-center',
								leadingIcon: 'size-4 lg:size-5'
							}"
							@click="editorOpen = true"
						/>
					</ClientOnly>
				</div>

				<div class="flex items-center gap-4 text-gray-600 dark:text-gray-400">
					<time :datetime="post.created_at.toISOString()">
						{{ formatDate(post.created_at) }}
					</time>
					<span
						v-if="post.tags && post.tags.length > 0"
						class="flex gap-2"
					>
						<UBadge
							v-for="tag in post.tags"
							:key="tag"
							variant="subtle"
						>
							{{ tag }}
						</UBadge>
					</span>
				</div>
			</header>

			<div
				v-if="thumbnailUrl"
				class="w-full"
			>
				<NuxtImg
					:src="thumbnailUrl"
					:alt="post.title"
					class="w-full h-auto rounded-lg shadow-lg object-cover max-h-96"
				/>
			</div>

			<div class="prose prose-lg dark:prose-invert max-w-none">
				<div class="whitespace-pre-wrap">{{ post.content }}</div>
			</div>
			<footer class="pt-8 border-t border-gray-200 dark:border-gray-800">
				<div class="text-sm text-gray-500 dark:text-gray-400">
					Last updated: {{ formatDate(post.updated_at) }}
				</div>
			</footer>
		</div>
	</article>
	<UModal
		v-model:open="editorOpen"
		title="Edit Blog Post"
		class="min-w-140"
	>
		<template #body>
			<BlogForm
				:initial-data="post || undefined"
				mode="edit"
				@submit="
					editorOpen = false;
					$router.go(0); // refresh the page to show updated post
				"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import type { BlogPost } from '~/shared/types';

const { loggedIn } = useLogin();
const editorOpen = ref(false);

const route = useRoute();
const { year, month, day, slug } = route.params;

const year0 = parseInt(year?.toString() || '0', 10);
const month0 = parseInt(month?.toString() || '0', 10);
const day0 = parseInt(day?.toString() || '0', 10);

const { data: post, error } = await useAsyncData(
	`blog-post-${slug}-${year0}-${month0}-${day0}`,
	async () => {
		try {
			const res = await $fetch<BlogPost>(
				`/api/blog/find?slug=${slug}&year=${year0}&month=${month0}&day=${day0}`,
				{
					method: 'GET'
				}
			);

			// ensure dates are Date objects (in case they come from cache as strings)
			return {
				...res,
				created_at: new Date(res.created_at),
				updated_at: new Date(res.updated_at)
			};
		} catch (error) {
			return null;
		}
	}
);

if (error.value || !post.value) {
	throw createError({
		statusCode: 404,
		statusMessage: `Blog Post not found: ${slug}`
	});
}

const thumbnailUrl = computed(() => {
	if (!post.value) return null;

	if (post.value.thumbnail_url) {
		return post.value.thumbnail_url;
	} else if (post.value.thumbnail) {
		const array = new Uint8Array(post.value.thumbnail);
		return URL.createObjectURL(new Blob([array]));
	}
	return null;
});

const formatDate = (date: Date) => {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
};

onBeforeUnmount(() => {
	if (thumbnailUrl.value && post.value?.thumbnail) {
		URL.revokeObjectURL(thumbnailUrl.value);
	}
});
</script>
