<template>
	<video
		v-if="kind === 'video'"
		:src="src"
		:poster="poster || undefined"
		controls
		playsinline
		preload="metadata"
		class="max-h-[70vh] w-full rounded-lg bg-black"
	>
		<source
			:src="src"
			:type="mime"
		/>
	</video>
	<div
		v-else
		class="flex flex-col items-center gap-4 rounded-lg border border-default p-4 sm:flex-row"
	>
		<img
			v-if="poster"
			:src="poster"
			:alt="title"
			class="size-40 rounded-lg object-cover"
		/>
		<audio
			:src="src"
			controls
			preload="metadata"
			class="w-full"
		>
			<source
				:src="src"
				:type="mime"
			/>
		</audio>
	</div>
</template>

<script setup lang="ts">
defineProps<{
	kind: 'video' | 'music';
	src: string;
	mime: string;
	poster?: string;
	title?: string;
}>();
</script>
