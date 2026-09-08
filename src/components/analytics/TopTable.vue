<template>
	<section class="rounded border border-default p-3">
		<h3 class="text-sm font-medium mb-2">{{ title }}</h3>
		<div
			v-if="loading"
			class="h-32"
		>
			<USkeleton class="h-full w-full" />
		</div>
		<div
			v-else-if="rows.length === 0"
			class="text-muted text-center py-6 text-sm"
		>
			{{ empty }}
		</div>
		<div
			v-else
			class="overflow-x-auto"
		>
			<table class="min-w-full text-sm">
				<thead class="text-left text-muted">
					<tr>
						<th class="p-2">{{ columnLabel }}</th>
						<th class="p-2">Views</th>
						<th class="p-2">Unique</th>
						<th class="p-2">Avg Read</th>
						<th class="p-2">Completion</th>
					</tr>
				</thead>
				<tbody>
					<tr
						v-for="row in rows"
						:key="row.slug"
						class="border-t border-default"
					>
						<td class="p-2 max-w-xs truncate">{{ row.title }}</td>
						<td class="p-2 tabular-nums">{{ row.views }}</td>
						<td class="p-2 tabular-nums">{{ row.unique }}</td>
						<td class="p-2 tabular-nums">{{ formatMs(row.avgActiveMs) }}</td>
						<td class="p-2 tabular-nums">{{ formatPercent(row.completionRate) }}</td>
					</tr>
				</tbody>
			</table>
		</div>
	</section>
</template>

<script setup lang="ts">
withDefaults(
	defineProps<{
		title: string;
		empty: string;
		rows: {
			slug: string;
			title: string;
			views: number;
			unique: number;
			avgActiveMs: number;
			completionRate: number;
		}[];
		loading?: boolean;
		columnLabel?: string;
	}>(),
	{ loading: false, columnLabel: 'Post' }
);

function formatMs(ms: number) {
	if (!ms) return '0s';
	if (ms < 1000) return `${ms}ms`;
	const s = Math.round(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	return `${m}m ${s % 60}s`;
}

function formatPercent(v: number) {
	return `${Math.round(v * 100)}%`;
}
</script>
