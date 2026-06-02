<template>
	<div class="rounded border border-default p-3 min-h-[78px]">
		<div class="text-xs text-muted">{{ label }}</div>
		<div
			v-if="loading"
			class="mt-1"
		>
			<USkeleton class="h-6 w-16" />
		</div>
		<div
			v-else
			class="flex items-baseline gap-2 mt-1"
		>
			<span class="text-2xl font-semibold tabular-nums">{{ formatted }}</span>
			<span
				v-if="prev !== undefined"
				class="text-xs tabular-nums"
				:class="deltaClass"
			>
				{{ deltaLabel }}
			</span>
		</div>
	</div>
</template>

<script setup lang="ts">
const props = withDefaults(
	defineProps<{
		label: string;
		value: number;
		prev?: number;
		loading?: boolean;
		format?: 'number' | 'duration' | 'percent';
	}>(),
	{ format: 'number', loading: false }
);

const formatted = computed(() => {
	if (props.format === 'duration') {
		const ms = props.value;
		if (!ms) return '0s';
		if (ms < 1000) return `${ms}ms`;
		const s = Math.round(ms / 1000);
		if (s < 60) return `${s}s`;
		const m = Math.floor(s / 60);
		return `${m}m ${s % 60}s`;
	}
	if (props.format === 'percent') {
		return `${Math.round(props.value * 100)}%`;
	}
	return props.value.toLocaleString();
});

const deltaLabel = computed(() => {
	if (props.prev === undefined) return '';
	if (props.prev === 0 && props.value === 0) return '—';
	if (props.prev === 0) return '+∞';
	const change = ((props.value - props.prev) / props.prev) * 100;
	const sign = change >= 0 ? '+' : '';
	return `${sign}${change.toFixed(0)}%`;
});

const deltaClass = computed(() => {
	if (props.prev === undefined) return '';
	if (props.value === props.prev) return 'text-muted';
	return props.value > props.prev ? 'text-green-500' : 'text-red-500';
});
</script>
