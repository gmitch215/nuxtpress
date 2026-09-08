<template>
	<div class="w-full justify-center px-4 sm:px-6 md:px-8 mt-8">
		<UBlogPosts
			:orientation="$viewport.isLessOrEquals('mobileMedium') ? 'vertical' : 'horizontal'"
			class="mb-4"
		>
			<LazyUBlogPost
				v-for="(post, index) in displayed"
				:key="post.id"
				:title="post.title"
				:description="post.description"
				:date="post.date"
				:badge="post.badge"
				:to="post.to"
				hydrate-on-visible
			>
				<template #header>
					<Thumbnail
						:src="post.imageSrc"
						:alt="post.title"
						:eager="index < 2"
						:to="post.to"
					/>
				</template>
			</LazyUBlogPost>
		</UBlogPosts>
		<span class="text-gray-500 light:text-gray-400">{{ displayed.length }} total post(s)</span>
	</div>
</template>

<script setup lang="ts">
import type { BlogPostSummary } from '~/shared/types';

const props = defineProps<{ posts: BlogPostSummary[] }>();
const { urlFor } = usePostUrl();

const displayed = computed(() =>
	props.posts.map((post) => ({
		id: post.id,
		title: post.title,
		description: post.excerpt,
		date: post.created_at,
		badge: post.tags?.[0] || 'General',
		imageSrc: post.thumbnail_url || '/favicon.png',
		to: urlFor(post)
	}))
);
</script>
