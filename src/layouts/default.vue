<template>
	<UBanner
		v-if="insecure"
		title="Your site does not have a password. Please change 'NUXT_PASSWORD' in your configuration to create posts."
		icon="mdi:alert-circle-outline"
		color="warning"
		class="justify-center"
	/>
	<NavBar />
	<main class="min-h-[90vh] w-full">
		<slot />
	</main>
	<Footer />
</template>

<script setup lang="ts">
const config = useRuntimeConfig();
const insecure = ref(false);
if (!config.password || config.password === 'password') {
	insecure.value = true;
}
</script>
