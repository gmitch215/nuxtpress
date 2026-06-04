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

			<UAlert
				v-if="error"
				color="error"
				variant="subtle"
				icon="mdi:alert-circle"
				:title="error"
				:description="errorDetails || undefined"
			/>

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
import { firstZodIssueMessage } from '~/shared/schemas';

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
const errorDetails = ref('');

const session = useUserSession();
const toast = useToast();

async function onSubmit() {
	error.value = '';
	errorDetails.value = '';

	if (username.value.trim().length < 3) {
		error.value = 'Username must be at least 3 characters';
		return;
	}
	if (!displayName.value.trim()) {
		error.value = 'Display name is required';
		return;
	}
	if (password.value.length < 8) {
		error.value = 'Password must be at least 8 characters';
		return;
	}
	if (password.value.length > 128) {
		error.value = 'Password must be 128 characters or less';
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
		toast.add({
			title: 'Welcome aboard',
			description: 'Administrator account created. Time to write your first post.',
			icon: 'mdi:rocket-launch',
			color: 'success'
		});
		// optimistic — D1 replica reads can lag the just-inserted row by a few seconds,
		// so we set status locally instead of waiting for /api/setup/status to catch up
		status.value = {
			needsSetup: false,
			hasLegacyPassword: status.value?.hasLegacyPassword ?? false,
			userCount: Math.max(1, status.value?.userCount ?? 0) + 1
		};
		try {
			await session.fetch();
		} catch (e) {
			console.warn('post-setup session fetch failed:', e);
		}
		await navigateTo('/');
	} catch (e: any) {
		const issues = e?.data?.issues as { path: PropertyKey[]; message?: string }[] | undefined;
		const primary = issues
			? firstZodIssueMessage(issues, e?.data?.statusMessage || 'Setup failed')
			: e?.data?.statusMessage || e?.statusMessage || e?.message || 'Setup failed';
		error.value = primary;
		if (issues && issues.length > 1) {
			errorDetails.value = issues
				.slice(1)
				.map((i) => firstZodIssueMessage([i], i.message ?? ''))
				.filter(Boolean)
				.join(' · ');
		}
	} finally {
		submitting.value = false;
	}
}

useSeoMeta({ title: 'Setup · NuxtPress' });
</script>
