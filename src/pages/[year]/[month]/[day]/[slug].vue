<template>
	<article
		v-if="post"
		class="w-full px-18 max-w-4xl mx-auto py-8"
	>
		<div class="space-y-6">
			<header class="space-y-4">
				<div class="flex items-center">
					<h1
						class="text-4xl font-bold border-l-6 -ml-5 pl-3"
						:style="`border-color: ${settings.themeColor || $config.public.themeColor}`"
					>
						{{ post.title }}
					</h1>
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
						<UButton
							v-if="loggedIn"
							icon="mdi:delete"
							class="ml-2"
							color="error"
							:ui="{
								base: 'size-7 lg:size-8 justify-center items-center',
								leadingIcon: 'size-4 lg:size-5'
							}"
							@click="deletePost"
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

			<ClientOnly>
				<span :style="`color: ${settings.themeColor || $config.public.themeColor}`"
					>{{ Math.max(1, Math.floor(post.content.length / 200)) }} min. read</span
				>
				<span
					v-if="!renderedContent"
					class="text-gray-500 dark:text-gray-400"
					>Loading content...</span
				>
				<div
					class="prose prose-lg dark:prose-invert max-w-none"
					v-html="renderedContent"
				/>
			</ClientOnly>
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
		class="max-w-[90vw] w-full"
	>
		<template #body>
			<BlogForm
				:initial-data="post || undefined"
				mode="edit"
				@cancel="editorOpen = false"
				@submit="
					editorOpen = false;
					$router.go(0); // refresh the page to show updated post
				"
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import DOMPurify from 'dompurify';
import type { BlogPost } from '~/shared/types';

const { settings } = useSettings();
const { loggedIn } = useLogin();
const editorOpen = ref(false);

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { year, month, day, slug } = route.params;

const year0 = parseInt(year?.toString() || '0', 10);
const month0 = parseInt(month?.toString() || '0', 10);
const day0 = parseInt(day?.toString() || '0', 10);

// Basic validation without throwing errors
const isValidDate =
	!isNaN(year0) &&
	!isNaN(month0) &&
	!isNaN(day0) &&
	year0 >= 2000 &&
	year0 <= new Date().getFullYear() + 1 &&
	month0 >= 1 &&
	month0 <= 12 &&
	day0 >= 1 &&
	day0 <= 31;

const { data: post, error } = await useAsyncData(
	`blog-post-${slug}-${year0}-${month0}-${day0}`,
	async () => {
		if (!isValidDate) return null;

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
		statusMessage: 'Blog Post Not Found',
		message: `The blog post you're looking for doesn't exist or may have been removed.`,
		fatal: false
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

const renderedContent = computed(() => {
	if (!post.value?.content) return '';
	if (import.meta.server) return ''; // Don't render on server - only client-side with DOMPurify

	try {
		const { renderMarkdown } = useMarkdown();
		const html = renderMarkdown(post.value.content);
		return DOMPurify.sanitize(html);
	} catch (e) {
		console.error('Markdown rendering error:', e);
		return '<p class="text-red-500">Error rendering content</p>';
	}
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

async function deletePost() {
	if (!loggedIn.value || !post.value) return;

	const yes = confirm(
		'Are you sure you want to delete this blog post? This action cannot be undone.'
	);
	if (!yes) return;

	await $fetch(`/api/blog/remove?id=${post.value.id}`, {
		method: 'DELETE'
	});

	toast.add({
		title: 'Post Deleted',
		description: `The blog post '${post.value.title}' has been deleted successfully.`,
		icon: 'mdi:delete',
		duration: 5000,
		color: 'error'
	});

	router.push('/');
}
</script>
