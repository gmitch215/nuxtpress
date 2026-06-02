<template>
	<LazyUBanner
		v-if="legacyWarn"
		title="NUXT_PASSWORD is set but a custom admin already exists. Remove the env var to fully cut over to the user-managed account."
		icon="mdi:lock-alert"
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
const { status } = useSetupStatus();
const session = useUserSession();

const legacyWarn = computed(
	() =>
		Boolean(status.value?.hasLegacyPassword) &&
		!status.value?.needsSetup &&
		session.user.value?.username !== 'admin'
);
</script>
