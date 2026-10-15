<template>
	<section
		class="space-y-3"
		role="region"
		aria-roledescription="carousel"
		:aria-label="title"
		tabindex="0"
		@keydown.left.prevent="go(-1)"
		@keydown.right.prevent="go(1)"
		@pointerdown="swipeStart = $event.clientX"
		@pointerup="onSwipeEnd"
	>
		<div class="relative overflow-hidden rounded-lg bg-black">
			<img
				:key="current.key"
				:src="mediaUrl(current.key)"
				:alt="current.caption || `${title}, slide ${index + 1}`"
				:width="current.width"
				:height="current.height"
				class="mx-auto max-h-[70vh] w-full object-contain"
				fetchpriority="high"
				decoding="async"
			/>
			<template v-if="media.length > 1">
				<UButton
					icon="mdi:chevron-left"
					color="neutral"
					variant="solid"
					class="absolute top-1/2 left-2 -translate-y-1/2 rounded-full"
					aria-label="Previous Slide"
					@click="go(-1)"
				/>
				<UButton
					icon="mdi:chevron-right"
					color="neutral"
					variant="solid"
					class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full"
					aria-label="Next Slide"
					@click="go(1)"
				/>
			</template>
		</div>

		<p
			v-if="current.caption"
			class="text-center text-lg"
			aria-live="polite"
		>
			{{ current.caption }}
		</p>

		<div
			v-if="media.length > 1"
			class="flex items-center justify-center gap-2"
		>
			<span
				class="text-sm text-muted"
				data-testid="slide-counter"
			>
				{{ index + 1 }} / {{ media.length }}
			</span>
			<button
				v-for="(item, i) in media"
				:key="item.key"
				type="button"
				class="size-2.5 rounded-full transition-colors"
				:class="i === index ? 'bg-primary' : 'bg-accented'"
				:aria-label="`Go to slide ${i + 1}`"
				:aria-current="i === index"
				@click="index = i"
			/>
		</div>
	</section>
</template>

<script setup lang="ts">
import { mediaUrl, type MediaItem } from '~/shared/media';

const props = defineProps<{ media: MediaItem[]; title: string }>();

const index = ref(0);
const swipeStart = ref<number | null>(null);
const current = computed(() => props.media[index.value] ?? props.media[0]!);

function go(by: number) {
	const total = props.media.length;
	index.value = (index.value + by + total) % total;
}

function onSwipeEnd(event: PointerEvent) {
	if (swipeStart.value === null) return;
	const delta = event.clientX - swipeStart.value;
	swipeStart.value = null;
	if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
}

watch(index, (value) => {
	if (!import.meta.client) return;
	const next = props.media[(value + 1) % props.media.length];
	if (next) new Image().src = mediaUrl(next.key);
});
</script>
