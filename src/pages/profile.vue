<template>
	<div class="w-full max-w-2xl mx-auto px-4 sm:px-8 py-8">
		<h1 class="text-2xl font-bold mb-6">Your Profile</h1>
		<ProfileForm v-if="loggedIn" />
		<div v-else>
			<p class="text-muted">You must be logged in.</p>
		</div>
	</div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: 'auth' });
const { loggedIn } = useLogin();
useSeoMeta({ title: 'Profile' });
</script>
