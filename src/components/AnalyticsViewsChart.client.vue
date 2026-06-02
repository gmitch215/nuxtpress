<template>
	<div :style="{ height: `${height}px` }">
		<VisXYContainer
			:data="chartData"
			:height="height"
			:padding="{ top: 8, right: 8, bottom: 24, left: 32 }"
		>
			<VisLine
				:x="xAccessor"
				:y="yAccessor"
				color="var(--ui-primary, #1e40af)"
				:line-width="2"
			/>
			<VisArea
				:x="xAccessor"
				:y="yAccessor"
				color="var(--ui-primary, #1e40af)"
				:opacity="0.15"
			/>
			<VisAxis
				type="x"
				:tick-format="formatTick"
				:num-ticks="5"
			/>
			<VisAxis
				type="y"
				:tick-format="(v: number) => String(Math.round(v))"
				:num-ticks="4"
			/>
			<VisTooltip />
			<VisCrosshair :template="crosshairTemplate" />
		</VisXYContainer>
	</div>
</template>

<script setup lang="ts">
import { VisArea, VisAxis, VisCrosshair, VisLine, VisTooltip, VisXYContainer } from '@unovis/vue';

const props = withDefaults(
	defineProps<{
		perDay: { day: string; views: number; unique: number }[];
		height?: number;
	}>(),
	{ height: 180 }
);

const chartData = computed(() =>
	props.perDay.map((p, i) => ({ idx: i, day: p.day, views: p.views, unique: p.unique }))
);

const xAccessor = (d: { idx: number }) => d.idx;
const yAccessor = (d: { views: number }) => d.views;

function formatTick(i: number) {
	const point = chartData.value[Math.round(i)];
	if (!point) return '';
	const parts = point.day.split('-');
	return `${parts[1]}/${parts[2]}`;
}

function crosshairTemplate(d: { day: string; views: number; unique: number }) {
	return `<div style="padding:6px 8px;font-size:12px"><div><b>${d.day}</b></div><div>Views: ${d.views}</div><div>Unique: ${d.unique}</div></div>`;
}
</script>
