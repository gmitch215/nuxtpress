<template>
	<NuxtLink
		v-if="to"
		:to="to"
		class="block overflow-hidden"
		:class="rounded ? 'rounded-md' : ''"
	>
		<img
			:src="currentSrc"
			:alt="alt"
			:loading="eager ? 'eager' : 'lazy'"
			:decoding="eager ? 'sync' : 'async'"
			:fetchpriority="eager ? 'high' : 'auto'"
			class="w-full h-full object-cover"
			@error="onError"
		/>
	</NuxtLink>
	<img
		v-else
		:src="currentSrc"
		:alt="alt"
		:loading="eager ? 'eager' : 'lazy'"
		:decoding="eager ? 'sync' : 'async'"
		:fetchpriority="eager ? 'high' : 'auto'"
		class="w-full h-full object-cover"
		:class="rounded ? 'rounded-md' : ''"
		@error="onError"
	/>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		src?: string | null;
		alt?: string;
		eager?: boolean;
		rounded?: boolean;
		to?: string;
		fallback?: string;
	}>(),
	{ alt: '', eager: false, rounded: true, fallback: '/favicon.png' }
);

const failed = ref(false);
watch(
	() => props.src,
	() => {
		failed.value = false;
	}
);

const currentSrc = computed(() => {
	if (failed.value || !props.src) return props.fallback;
	return props.src;
});

function onError() {
	failed.value = true;
}
</script>
