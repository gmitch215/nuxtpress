<template>
	<div class="w-full max-w-xl mx-auto px-4 sm:px-8 py-12">
		<div class="mb-8 text-center">
			<UIcon
				name="mdi:rocket-launch"
				class="size-12 text-primary mx-auto"
			/>
			<h1 class="text-3xl font-bold mt-3">Welcome to NuxtPress</h1>
			<p class="text-muted mt-2">
				Let's create the first administrator. You'll use this account to write posts and invite more
				authors later.
			</p>
		</div>

		<UAlert
			v-if="status?.hasLegacyPassword"
			color="info"
			variant="subtle"
			icon="mdi:information"
			title="NUXT_PASSWORD detected"
			description="Your environment has NUXT_PASSWORD set, which would normally auto-seed an admin user — but no users exist yet, so you can choose your own credentials below. The env-var fallback will still work to log in as `admin` for one release."
			class="mb-6"
		/>

		<form
			class="space-y-4"
			@submit.prevent="onSubmit"
		>
			<UFormField
				label="Username"
				hint="3-32 chars, lowercase letters, numbers, hyphens, underscores"
			>
				<UInput
					v-model="username"
					autocomplete="username"
					placeholder="admin"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Display name">
				<UInput
					v-model="displayName"
					placeholder="Your name or team name"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Password"
				hint="At least 8 characters"
			>
				<UInput
					v-model="password"
					type="password"
					autocomplete="new-password"
					class="w-full"
				/>
			</UFormField>
			<UFormField label="Confirm password">
				<UInput
					v-model="confirm"
					type="password"
					autocomplete="new-password"
					class="w-full"
				/>
			</UFormField>
			<UFormField
				label="Bio (optional)"
				:hint="`${bio.length}/500`"
			>
				<UTextarea
					v-model="bio"
					:rows="3"
					:maxlength="500"
					class="w-full"
				/>
			</UFormField>

			<div
				v-if="error"
				class="text-sm text-red-500"
			>
				{{ error }}
			</div>

			<UButton
				type="submit"
				:loading="submitting"
				color="primary"
				icon="mdi:account-plus"
				class="w-full justify-center"
				size="lg"
			>
				Create administrator
			</UButton>
		</form>
	</div>
</template>

<script setup lang="ts">
definePageMeta({ middleware: [] });
const { status, refresh } = useSetupStatus();
await refresh();

const username = ref('admin');
const displayName = ref('Team');
const password = ref('');
const confirm = ref('');
const bio = ref('');

const submitting = ref(false);
const error = ref('');

const session = useUserSession();

async function onSubmit() {
	error.value = '';
	if (password.value.length < 8) {
		error.value = 'Password must be at least 8 characters';
		return;
	}
	if (password.value !== confirm.value) {
		error.value = 'Passwords do not match';
		return;
	}

	submitting.value = true;
	try {
		await $fetch('/api/setup/init', {
			method: 'POST',
			body: {
				username: username.value.toLowerCase().trim(),
				displayName: displayName.value.trim(),
				password: password.value,
				bio: bio.value
			},
			credentials: 'include'
		});
		await refresh();
		await session.fetch();
		await navigateTo('/');
	} catch (e: any) {
		error.value = e?.data?.statusMessage || e?.statusMessage || 'Setup failed';
	} finally {
		submitting.value = false;
	}
}

useSeoMeta({ title: 'Setup · NuxtPress' });
</script>
