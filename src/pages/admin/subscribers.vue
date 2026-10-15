<template>
	<div class="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
		<div class="mb-6 flex items-center justify-between">
			<h1 class="text-2xl font-bold">Subscribers</h1>
			<UButton
				to="/api/admin/subscribers/export"
				external
				download
				icon="mdi:download"
				color="neutral"
				variant="outline"
			>
				Export CSV
			</UButton>
		</div>

		<MailSettings
			class="mb-6"
			@saved="refresh"
		/>

		<div class="mb-3 flex flex-wrap items-center gap-2">
			<UInput
				v-model="search"
				placeholder="Search by email"
				icon="mdi:magnify"
				class="w-64"
			/>
			<USelect
				v-model="status"
				:items="statusOptions"
				class="w-40"
			/>
			<span class="text-sm text-muted">{{ total }} total</span>
		</div>

		<div class="overflow-x-auto rounded border border-default">
			<table class="min-w-full text-sm">
				<thead class="bg-elevated/40 text-left">
					<tr>
						<th class="p-3">Email</th>
						<th class="p-3">Status</th>
						<th class="p-3">Subscribed</th>
						<th class="p-3 text-right">Actions</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.id"
						class="border-t border-default"
					>
						<td class="p-3">{{ row.email }}</td>
						<td class="p-3">
							<UBadge
								:color="row.status === 'active' ? 'success' : 'neutral'"
								variant="subtle"
								class="capitalize"
							>
								{{ row.status }}
							</UBadge>
						</td>
						<td class="p-3 text-muted">{{ formatShort(row.createdAt) }}</td>
						<td class="p-3 text-right">
							<UButton
								icon="mdi:delete"
								size="xs"
								color="error"
								variant="ghost"
								:title="`Remove ${row.email}`"
								@click="remove(row)"
							/>
						</td>
					</tr>
					<tr v-if="!pending && rows.length === 0">
						<td
							colspan="4"
							class="p-6 text-center text-muted"
						>
							No subscribers yet.
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>

<script setup lang="ts">
import type { SubscriberRow } from '~/shared/types';

definePageMeta({ middleware: 'admin' });

const toast = useToast();
const search = ref('');
const status = ref<'all' | 'active' | 'pending'>('all');
const debouncedSearch = ref('');
let searchTimer: ReturnType<typeof setTimeout> | undefined;
watch(search, (value) => {
	clearTimeout(searchTimer);
	searchTimer = setTimeout(() => (debouncedSearch.value = value), 250);
});

const statusOptions = [
	{ label: 'All', value: 'all' },
	{ label: 'Active', value: 'active' },
	{ label: 'Pending', value: 'pending' }
];

const { data, pending, refresh } = await useFetch<{ rows: SubscriberRow[]; total: number }>(
	'/api/admin/subscribers',
	{
		credentials: 'include',
		query: computed(() => ({
			search: debouncedSearch.value || undefined,
			status: status.value === 'all' ? undefined : status.value
		})),
		default: () => ({ rows: [], total: 0 })
	}
);

const rows = computed(() => data.value?.rows ?? []);
const total = computed(() => data.value?.total ?? 0);

function formatShort(value: string) {
	return new Date(value).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric'
	});
}

async function remove(row: SubscriberRow) {
	if (!confirm(`Remove ${row.email}?`)) return;
	try {
		await $fetch(`/api/admin/subscribers/${row.id}`, { method: 'DELETE', credentials: 'include' });
		toast.add({ title: 'Subscriber Removed', color: 'success', icon: 'mdi:check' });
		await refresh();
	} catch (err: any) {
		toast.add({
			title: 'Remove Failed',
			description: err?.data?.statusMessage || 'Could not remove the subscriber',
			color: 'error',
			icon: 'mdi:alert-circle'
		});
	}
}
</script>
