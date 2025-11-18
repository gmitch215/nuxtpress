<template>
	<ClientOnly>
		<UBanner
			v-if="insecure"
			title="Your site does not have a secure password. Please change 'NUXT_PASSWORD' in your configuration to secure your blog."
			icon="mdi:alert-circle-outline"
			color="warning"
			class="justify-center"
		/>
	</ClientOnly>
	<NavBar />
	<main class="min-h-[90vh] w-full">
		<slot />
	</main>
	<Footer />
</template>

<script setup lang="ts">
const insecure = ref(false);
if (import.meta.server) {
	const config = useRuntimeConfig();
	if (!config.password || config.password === 'password') {
		insecure.value = true;
	}
}
</script>
