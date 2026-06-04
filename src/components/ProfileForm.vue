<template>
	<form
		class="space-y-6"
		@submit.prevent="onSubmit"
	>
		<section class="flex items-center gap-4">
			<Avatar
				:pathname="user?.avatarPathname"
				:display-name="user?.displayName"
				size="xl"
			/>
			<div class="flex flex-col gap-2">
				<UButton
					icon="mdi:upload"
					variant="outline"
					size="sm"
					@click="fileInput?.click()"
				>
					{{ uploading ? 'Uploading…' : 'Change avatar' }}
				</UButton>
				<UButton
					v-if="user?.avatarPathname"
					icon="mdi:delete"
					color="error"
					variant="ghost"
					size="sm"
					:disabled="removing"
					@click="removeAvatar"
				>
					Remove
				</UButton>
				<input
					ref="fileInput"
					type="file"
					accept="image/png,image/jpeg,image/webp,image/gif"
					class="hidden"
					@change="onFile"
				/>
			</div>
		</section>

		<UFormField
			label="Display name"
			name="displayName"
		>
			<UInput
				v-model="displayName"
				class="w-full"
			/>
		</UFormField>

		<UFormField
			label="Bio"
			name="bio"
			:hint="`${bio.length}/500`"
		>
			<UTextarea
				v-model="bio"
				class="w-full"
				:rows="4"
				:maxlength="500"
			/>
		</UFormField>

		<details class="rounded border border-default p-3">
			<summary class="cursor-pointer text-sm font-medium">Change password</summary>
			<div class="mt-3 space-y-3">
				<UFormField
					label="Current password"
					name="currentPassword"
				>
					<UInput
						v-model="currentPassword"
						type="password"
						autocomplete="current-password"
						class="w-full"
					/>
				</UFormField>
				<UFormField
					label="New password"
					name="newPassword"
					hint="At least 8 characters"
				>
					<UInput
						v-model="newPassword"
						type="password"
						autocomplete="new-password"
						class="w-full"
					/>
				</UFormField>
			</div>
		</details>

		<div
			v-if="error"
			class="text-sm text-red-500"
		>
			{{ error }}
		</div>

		<div class="flex gap-2">
			<UButton
				:loading="saving"
				icon="mdi:content-save"
				color="primary"
				@click="onSubmit"
			>
				Save changes
			</UButton>
		</div>
	</form>
</template>

<script setup lang="ts">
const { user } = useLogin();
const toast = useToast();

const displayName = ref(user.value?.displayName ?? '');
const bio = ref(user.value?.bio ?? '');
const currentPassword = ref('');
const newPassword = ref('');

watch(user, (u) => {
	if (u) {
		displayName.value = u.displayName;
		bio.value = u.bio ?? '';
	}
});

const saving = ref(false);
const uploading = ref(false);
const removing = ref(false);
const error = ref('');

const fileInput = ref<HTMLInputElement | null>(null);
const session = useUserSession();

async function onSubmit() {
	error.value = '';
	saving.value = true;
	try {
		const body: Record<string, unknown> = {
			displayName: displayName.value,
			bio: bio.value
		};
		if (newPassword.value) {
			body.currentPassword = currentPassword.value;
			body.newPassword = newPassword.value;
		}
		await $fetch('/api/users/me', { method: 'PATCH', body, credentials: 'include' });
		await session.fetch();
		toast.add({ title: 'Profile updated', color: 'success', icon: 'mdi:check' });
		currentPassword.value = '';
		newPassword.value = '';
	} catch (e: any) {
		error.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to update profile';
	} finally {
		saving.value = false;
	}
}

async function onFile(ev: Event) {
	const target = ev.target as HTMLInputElement;
	const file = target.files?.[0];
	if (!file) return;
	uploading.value = true;
	error.value = '';
	try {
		const form = new FormData();
		form.append('file', file);
		await $fetch('/api/users/me/avatar', {
			method: 'POST',
			body: form,
			credentials: 'include'
		});
		await session.fetch();
		toast.add({ title: 'Avatar updated', color: 'success', icon: 'mdi:check' });
	} catch (e: any) {
		error.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to upload avatar';
	} finally {
		uploading.value = false;
		if (target) target.value = '';
	}
}

async function removeAvatar() {
	removing.value = true;
	try {
		await $fetch('/api/users/me/avatar', { method: 'DELETE', credentials: 'include' });
		await session.fetch();
		toast.add({ title: 'Avatar removed', color: 'success', icon: 'mdi:check' });
	} catch (e: any) {
		error.value = e?.data?.statusMessage || 'Failed to remove avatar';
	} finally {
		removing.value = false;
	}
}
</script>
