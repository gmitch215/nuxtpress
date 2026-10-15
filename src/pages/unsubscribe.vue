<template>
	<div class="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-4 py-16 text-center">
		<h1 class="text-2xl font-bold">{{ heading }}</h1>
		<p class="text-muted">{{ message }}</p>
		<UButton
			v-if="state === 'idle' || state === 'loading'"
			color="error"
			:loading="state === 'loading'"
			@click="unsubscribe"
		>
			Unsubscribe
		</UButton>
		<UButton
			v-else
			to="/"
			color="neutral"
			variant="outline"
		>
			Back to Home
		</UButton>
	</div>
</template>

<script setup lang="ts">
const route = useRoute();
const { settings } = useSettings();
const config = useRuntimeConfig();
const siteName = settings.value.name || config.public.name;

useSeoMeta({ title: `Unsubscribe - ${siteName}`, robots: 'noindex, nofollow' });

const id = String(route.query.id ?? '');
const token = String(route.query.token ?? '');
const state = ref<'idle' | 'loading' | 'done' | 'error'>(id && token ? 'idle' : 'error');
const errorMessage = ref('This link is invalid or has expired.');

const heading = computed(() => {
	if (state.value === 'done') return 'You Are Unsubscribed';
	if (state.value === 'error') return 'Could Not Unsubscribe';
	return 'Unsubscribe';
});

const message = computed(() => {
	if (state.value === 'done') return `You will no longer get emails from ${siteName}.`;
	if (state.value === 'error') return errorMessage.value;
	return `Stop getting emails when ${siteName} publishes a new post.`;
});

async function unsubscribe() {
	state.value = 'loading';
	try {
		await $fetch('/api/subscribers/unsubscribe', { method: 'POST', body: { id, token } });
		state.value = 'done';
	} catch (err: any) {
		errorMessage.value = err?.data?.statusMessage || errorMessage.value;
		state.value = 'error';
	}
}
</script>
