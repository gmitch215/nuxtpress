<template>
	<div class="rounded border border-default p-3">
		<h4 class="text-sm font-medium mb-2">{{ title }}</h4>
		<div
			v-if="loading"
			class="space-y-2"
		>
			<USkeleton class="h-4 w-full" />
			<USkeleton class="h-4 w-3/4" />
		</div>
		<div
			v-else-if="entries.length === 0"
			class="text-muted text-xs"
		>
			No data.
		</div>
		<ul
			v-else
			class="space-y-1 text-sm"
		>
			<li
				v-for="row in entries"
				:key="row.key"
				class="flex items-center justify-between gap-2"
			>
				<span class="capitalize truncate">{{ row.key }}</span>
				<span class="text-muted tabular-nums">{{ row.value }} ({{ row.pct }}%)</span>
			</li>
		</ul>
	</div>
</template>

<script setup lang="ts">
const props = defineProps<{
	title: string;
	counts: Record<string, number>;
	loading?: boolean;
}>();

const entries = computed(() => {
	const total = Object.values(props.counts).reduce((a, b) => a + b, 0) || 1;
	return Object.entries(props.counts)
		.map(([key, value]) => ({
			key,
			value,
			pct: Math.round((value / total) * 100)
		}))
		.sort((a, b) => b.value - a.value)
		.slice(0, 6);
});
</script>
