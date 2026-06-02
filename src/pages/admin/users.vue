<template>
	<div class="w-full max-w-5xl mx-auto px-4 sm:px-8 py-8">
		<div class="flex items-center justify-between mb-6">
			<h1 class="text-2xl font-bold">Users</h1>
			<UButton
				icon="mdi:account-plus"
				color="primary"
				@click="openCreate"
			>
				New user
			</UButton>
		</div>

		<div class="overflow-x-auto border border-default rounded">
			<table class="min-w-full text-sm">
				<thead class="bg-elevated/40 text-left">
					<tr>
						<th class="p-3">User</th>
						<th class="p-3">Role</th>
						<th class="p-3">Posts</th>
						<th class="p-3">Status</th>
						<th class="p-3">Created</th>
						<th class="p-3 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="u in users"
						:key="u.id"
						class="border-t border-default"
					>
						<td class="p-3">
							<div class="flex items-center gap-3">
								<Avatar
									:pathname="u.avatarPathname"
									:display-name="u.displayName"
									size="sm"
								/>
								<div>
									<div class="font-medium">{{ u.displayName }}</div>
									<div class="text-muted text-xs">@{{ u.username }}</div>
								</div>
							</div>
						</td>
						<td class="p-3 capitalize">{{ u.role }}</td>
						<td class="p-3">{{ u.postCount }}</td>
						<td class="p-3">
							<UBadge
								:color="u.isActive ? 'success' : 'neutral'"
								variant="subtle"
							>
								{{ u.isActive ? 'Active' : 'Disabled' }}
							</UBadge>
						</td>
						<td class="p-3 text-muted">{{ formatShort(u.createdAt) }}</td>
						<td class="p-3 text-right space-x-1">
							<UButton
								icon="mdi:pencil"
								size="xs"
								variant="ghost"
								@click="openEdit(u)"
							/>
							<UButton
								icon="mdi:delete"
								size="xs"
								color="error"
								variant="ghost"
								:disabled="u.id === me?.id"
								@click="confirmDelete(u)"
							/>
						</td>
					</tr>
					<tr v-if="!pending && users.length === 0">
						<td
							colspan="6"
							class="p-6 text-center text-muted"
						>
							No users yet.
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<UModal
			v-model:open="formOpen"
			:title="editing ? 'Edit user' : 'New user'"
		>
			<template #body>
				<form
					class="space-y-4"
					@submit.prevent="submit"
				>
					<UFormField
						v-if="!editing"
						label="Username"
					>
						<UInput
							v-model="form.username"
							placeholder="jdoe"
							autocomplete="off"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Display name">
						<UInput
							v-model="form.displayName"
							class="w-full"
						/>
					</UFormField>
					<UFormField label="Role">
						<USelect
							v-model="form.role"
							:items="roleOptions"
							class="w-full"
						/>
					</UFormField>
					<UAlert
						v-if="passwordLocked"
						color="warning"
						variant="subtle"
						icon="mdi:lock-alert"
						title="Password locked by NUXT_PASSWORD"
						description="Remove the NUXT_PASSWORD environment variable and redeploy to manage this account's password from here."
					/>
					<UFormField :label="editing ? 'New password (optional)' : 'Password'">
						<UInput
							v-model="form.password"
							type="password"
							autocomplete="new-password"
							class="w-full"
							:disabled="passwordLocked"
						/>
					</UFormField>
					<UFormField
						v-if="editing"
						label="Active"
					>
						<USwitch v-model="form.isActive" />
					</UFormField>
					<UFormField label="Bio">
						<UTextarea
							v-model="form.bio"
							class="w-full"
							:rows="3"
							:maxlength="500"
						/>
					</UFormField>
					<div
						v-if="formError"
						class="text-sm text-red-500"
					>
						{{ formError }}
					</div>
					<div class="flex gap-2 justify-end">
						<UButton
							color="neutral"
							variant="ghost"
							@click="formOpen = false"
						>
							Cancel
						</UButton>
						<UButton
							type="submit"
							color="primary"
							:loading="saving"
						>
							{{ editing ? 'Save' : 'Create' }}
						</UButton>
					</div>
				</form>
			</template>
		</UModal>

		<UModal
			v-model:open="deleteOpen"
			:title="`Delete ${target?.displayName}?`"
		>
			<template #body>
				<p class="mb-4">
					Their posts will be reassigned to the first administrator. This cannot be undone.
				</p>
				<div
					v-if="deleteError"
					class="text-sm text-red-500 mb-2"
				>
					{{ deleteError }}
				</div>
				<div class="flex gap-2 justify-end">
					<UButton
						color="neutral"
						variant="ghost"
						@click="deleteOpen = false"
					>
						Cancel
					</UButton>
					<UButton
						color="error"
						:loading="deleting"
						@click="doDelete"
					>
						Delete
					</UButton>
				</div>
			</template>
		</UModal>
	</div>
</template>

<script setup lang="ts">
import type { AdminUser } from '~/shared/types';

definePageMeta({ middleware: 'admin' });

const { user: me } = useLogin();
const toast = useToast();
const { status: setupStatus, refresh: refreshSetup } = useSetupStatus();
await refreshSetup();

const { data, pending, refresh } = await useFetch<AdminUser[]>('/api/admin/users', {
	credentials: 'include',
	default: () => []
});

const users = computed(() => data.value ?? []);

const roleOptions = [
	{ label: 'Author', value: 'author' },
	{ label: 'Administrator', value: 'administrator' }
];

const formOpen = ref(false);
const editing = ref<AdminUser | null>(null);
const passwordLocked = computed(
	() =>
		Boolean(setupStatus.value?.hasLegacyPassword) &&
		!!editing.value &&
		editing.value.username === 'admin'
);
const form = reactive({
	username: '',
	displayName: '',
	role: 'author' as 'author' | 'administrator',
	password: '',
	bio: '',
	isActive: true
});
const saving = ref(false);
const formError = ref('');

function openCreate() {
	editing.value = null;
	Object.assign(form, {
		username: '',
		displayName: '',
		role: 'author',
		password: '',
		bio: '',
		isActive: true
	});
	formError.value = '';
	formOpen.value = true;
}

function openEdit(u: AdminUser) {
	editing.value = u;
	Object.assign(form, {
		username: u.username,
		displayName: u.displayName,
		role: u.role,
		password: '',
		bio: u.bio ?? '',
		isActive: u.isActive
	});
	formError.value = '';
	formOpen.value = true;
}

async function submit() {
	saving.value = true;
	formError.value = '';
	try {
		if (editing.value) {
			const body: Record<string, unknown> = {
				displayName: form.displayName,
				role: form.role,
				bio: form.bio,
				isActive: form.isActive
			};
			if (form.password) body.password = form.password;
			await $fetch(`/api/admin/users/${editing.value.id}`, {
				method: 'PATCH',
				body,
				credentials: 'include'
			});
		} else {
			await $fetch('/api/admin/users', {
				method: 'POST',
				body: {
					username: form.username.toLowerCase().trim(),
					displayName: form.displayName,
					role: form.role,
					password: form.password,
					bio: form.bio
				},
				credentials: 'include'
			});
		}
		toast.add({
			title: editing.value ? 'User updated' : 'User created',
			color: 'success',
			icon: 'mdi:check'
		});
		formOpen.value = false;
		await refresh();
	} catch (e: any) {
		formError.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to save';
	} finally {
		saving.value = false;
	}
}

const deleteOpen = ref(false);
const target = ref<AdminUser | null>(null);
const deleting = ref(false);
const deleteError = ref('');

function confirmDelete(u: AdminUser) {
	target.value = u;
	deleteError.value = '';
	deleteOpen.value = true;
}

async function doDelete() {
	if (!target.value) return;
	deleting.value = true;
	deleteError.value = '';
	try {
		await $fetch(`/api/admin/users/${target.value.id}`, {
			method: 'DELETE',
			credentials: 'include'
		});
		toast.add({ title: 'User deleted', color: 'success', icon: 'mdi:check' });
		deleteOpen.value = false;
		target.value = null;
		await refresh();
	} catch (e: any) {
		deleteError.value = e?.data?.statusMessage || e?.statusMessage || 'Failed to delete';
	} finally {
		deleting.value = false;
	}
}

function formatShort(iso: string) {
	try {
		return new Date(iso).toLocaleDateString();
	} catch {
		return iso;
	}
}

useSeoMeta({ title: 'Admin · Users' });
</script>
