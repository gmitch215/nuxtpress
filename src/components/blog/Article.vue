<template>
	<article class="w-full px-18 max-w-4xl mx-auto py-8">
		<div class="space-y-6">
			<header class="space-y-4">
				<div class="flex items-center">
					<h1
						class="text-4xl font-bold border-l-6 -ml-5 pl-3"
						:style="`border-color: ${settings.themeColor || $config.public.themeColor}`"
					>
						{{ post.title }}
					</h1>
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
				v-if="post.type === 'article' && post.thumbnail_url"
				class="w-full"
			>
				<img
					:src="displayThumbnail"
					:alt="post.title"
					fetchpriority="high"
					decoding="async"
					class="w-full h-auto rounded-lg shadow-lg min-h-50 max-h-96 object-cover"
					@error="thumbnailFailed = true"
				/>
			</div>

			<span
				v-if="post.type === 'article' && readMinutes"
				:style="`color: ${settings.themeColor || $config.public.themeColor}`"
				>{{ readMinutes }} min. read</span
			>
			<MediaSlideshow
				v-if="post.type === 'slideshow' && post.media.length"
				:media="post.media"
				:title="post.title"
			/>
			<MediaPlayer
				v-else-if="(post.type === 'video' || post.type === 'music') && post.media[0]"
				:kind="post.type"
				:src="mediaUrl(post.media[0].key)"
				:mime="post.media[0].mime"
				:poster="post.thumbnail_url"
				:title="post.title"
			/>
			<div
				v-if="post.type !== 'slideshow' && renderedContent"
				class="prose prose-lg dark:prose-invert max-w-none"
				v-html="renderedContent"
				style="contain-intrinsic-size: auto 500px"
			/>
			<footer class="pt-8 border-t border-gray-200 dark:border-gray-800">
				<div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
					<NuxtLink
						v-if="post.author?.username"
						:to="`/authors/${post.author.username}`"
						class="flex items-center gap-2 hover:underline"
					>
						<Avatar
							:pathname="post.author.avatarPathname"
							:display-name="post.author.displayName"
							size="sm"
						/>
						<span>{{ post.author.displayName }}</span>
					</NuxtLink>
					<span v-else>Post by {{ settings.author || $config.public.author }}</span>
					<span>| Last updated: {{ formatDate(post.updated_at) }}</span>
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
			<LazyBlogForm
				:initial-data="post"
				mode="edit"
				@cancel="editorOpen = false"
				@submit="onEdited"
				hydrate-on-visible
			/>
		</template>
	</UModal>
</template>

<script setup lang="ts">
import { mediaUrl } from '~/shared/media';
import { readingMinutes } from '~/shared/text';
import { formatDate, type BlogPost } from '~/shared/types';

const props = defineProps<{ post: BlogPost }>();

const { settings } = useSettings();
const { loggedIn } = useLogin();
const { renderMarkdown, prepareMarkdown } = useMarkdown();
const { sanitizeHtml } = useSanitizeHtml();
const router = useRouter();
const toast = useToast();
const editorOpen = ref(false);

// Escape leaves the post for the home page unless something else already took it: typing in a
// field, or an open dialog, menu or list (which close on Escape themselves). Never prevent default
// here, or the dialog library treats the key as handled and stays open.
function leaveOnEscape(event: KeyboardEvent) {
	if (event.key !== 'Escape' || event.defaultPrevented || event.isComposing) return;
	if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
	const target = event.target as HTMLElement | null;
	if (
		target?.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
	) {
		return;
	}
	const open = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
	if (document.querySelector(open)) return;
	router.push('/');
}
onMounted(() => document.addEventListener('keydown', leaveOnEscape));
onBeforeUnmount(() => document.removeEventListener('keydown', leaveOnEscape));

const readMinutes = computed(() => readingMinutes(props.post.content));

const thumbnailFailed = ref(false);
watch(
	() => props.post.thumbnail_url,
	() => {
		thumbnailFailed.value = false;
	}
);
const displayThumbnail = computed(() =>
	thumbnailFailed.value ? '/favicon.png' : props.post.thumbnail_url
);

const renderedContent = computed(() => {
	if (!props.post.content) return '';
	try {
		return sanitizeHtml(renderMarkdown(props.post.content));
	} catch (e) {
		console.error('Markdown rendering error:', e);
		return '<p class="text-red-500">Error rendering content</p>';
	}
});

// an edit can introduce a shortcode; the render reruns once the dataset has loaded
watch(
	() => props.post.content,
	(content) => prepareMarkdown(content)
);

const analytics = useAnalytics(() => props.post.slug);
onMounted(() => analytics.start());
onBeforeUnmount(() => analytics.stop());

function onEdited() {
	editorOpen.value = false;
	refreshNuxtData();
}

async function deletePost() {
	if (!loggedIn.value) return;

	const yes = confirm(
		'Are you sure you want to delete this blog post? This action cannot be undone.'
	);
	if (!yes) return;

	await $fetch(`/api/blog/remove?id=${props.post.id}`, { method: 'DELETE' });

	toast.add({
		title: 'Post Deleted',
		description: `The blog post '${props.post.title}' has been deleted successfully.`,
		icon: 'mdi:delete',
		duration: 5000,
		color: 'error'
	});

	router.push('/');
}
</script>
