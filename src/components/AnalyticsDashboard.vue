<template>
	<div class="space-y-6">
		<div class="flex flex-wrap items-center justify-between gap-2">
			<UTabs
				v-model="range"
				:items="rangeOptions"
				size="sm"
				:content="false"
			/>
			<UButton
				icon="mdi:refresh"
				variant="ghost"
				size="sm"
				:loading="pending"
				@click="() => refresh()"
			/>
		</div>

		<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
			<KpiCard
				label="Views"
				:value="data?.kpis.views.value ?? 0"
				:prev="data?.kpis.views.prev ?? 0"
				:loading="pending"
			/>
			<KpiCard
				label="Unique Visitors"
				:value="data?.kpis.unique.value ?? 0"
				:prev="data?.kpis.unique.prev ?? 0"
				:loading="pending"
			/>
			<KpiCard
				label="Avg Active Read"
				:value="data?.kpis.avgActiveMs.value ?? 0"
				:prev="data?.kpis.avgActiveMs.prev ?? 0"
				:loading="pending"
				format="duration"
			/>
			<KpiCard
				label="Completion"
				:value="data?.kpis.completionRate.value ?? 0"
				:prev="data?.kpis.completionRate.prev ?? 0"
				:loading="pending"
				format="percent"
			/>
		</div>

		<section class="rounded border border-default p-3">
			<h3 class="text-sm font-medium mb-2">Views Over Time</h3>
			<div
				v-if="pending"
				class="h-40"
			>
				<USkeleton class="h-full w-full" />
			</div>
			<div
				v-else-if="!data || data.perDay.length === 0"
				class="text-muted text-center py-8 text-sm"
			>
				No data for this range.
			</div>
			<LazyAnalyticsViewsChart
				v-else
				:per-day="data.perDay"
				:height="180"
			/>
		</section>

		<section class="rounded border border-default p-3">
			<h3 class="text-sm font-medium mb-2">Audience</h3>
			<div
				v-if="pending"
				class="h-10"
			>
				<USkeleton class="h-full w-full" />
			</div>
			<div
				v-else-if="!data || audienceTotal === 0"
				class="text-muted text-xs"
			>
				No data.
			</div>
			<div
				v-else
				class="flex flex-wrap gap-6 text-sm"
			>
				<div>
					<span class="text-muted">Anonymous</span>
					<span class="ml-2 tabular-nums font-medium">
						{{ data.audience.anonymous }} ({{ anonymousPct }}%)
					</span>
				</div>
				<div>
					<span class="text-muted">Signed In</span>
					<span class="ml-2 tabular-nums font-medium">
						{{ data.audience.loggedIn }} ({{ loggedInPct }}%)
					</span>
				</div>
			</div>
		</section>

		<AnalyticsTopTable
			title="Top Posts"
			empty="No posts tracked yet."
			:rows="data?.topPosts ?? []"
			:loading="pending"
		/>

		<AnalyticsTopTable
			title="Top Pages"
			empty="No other pages tracked yet."
			column-label="Page"
			:rows="data?.topPages ?? []"
			:loading="pending"
		/>

		<div class="grid grid-cols-1 md:grid-cols-3 gap-3">
			<BreakdownCard
				title="Referrers"
				:counts="data?.refHosts ?? {}"
				:loading="pending"
			/>
			<BreakdownCard
				title="Countries"
				:counts="data?.countries ?? {}"
				:loading="pending"
			/>
			<BreakdownCard
				title="Operating Systems"
				:counts="data?.os ?? {}"
				:loading="pending"
			/>
			<BreakdownCard
				title="Devices"
				:counts="data?.devices ?? {}"
				:loading="pending"
			/>
			<BreakdownCard
				title="Browsers"
				:counts="data?.browsers ?? {}"
				:loading="pending"
			/>
			<BreakdownCard
				title="Referrer Type"
				:counts="data?.refs ?? {}"
				:loading="pending"
			/>
		</div>

		<p class="text-muted text-xs">
			Visitors are counted with a daily-rotating salted hash of IP and user agent. No IP addresses,
			user agents, user accounts or locations finer than country are stored, and Do Not Track and
			Global Privacy Control are honored.
		</p>
	</div>
</template>

<script setup lang="ts">
type TopRow = {
	slug: string;
	title: string;
	views: number;
	unique: number;
	avgActiveMs: number;
	completionRate: number;
};

type Summary = {
	range: string;
	from: string;
	to: string;
	kpis: {
		views: { value: number; prev: number };
		unique: { value: number; prev: number };
		avgActiveMs: { value: number; prev: number };
		completionRate: { value: number; prev: number };
	};
	perDay: { day: string; views: number; unique: number }[];
	topPosts: TopRow[];
	topPages: TopRow[];
	refs: Record<string, number>;
	refHosts: Record<string, number>;
	devices: Record<string, number>;
	browsers: Record<string, number>;
	os: Record<string, number>;
	countries: Record<string, number>;
	audience: { loggedIn: number; anonymous: number; loggedInRate: number };
};

const range = ref<'7d' | '30d' | '90d' | 'all'>('7d');
const rangeOptions = [
	{ label: '7d', value: '7d' },
	{ label: '30d', value: '30d' },
	{ label: '90d', value: '90d' },
	{ label: 'All', value: 'all' }
];

const { data, pending, refresh } = useFetch<Summary>(
	() => `/api/analytics/summary?range=${range.value}`,
	{
		credentials: 'include',
		lazy: true,
		server: false
	}
);

const audienceTotal = computed(
	() => (data.value?.audience.anonymous ?? 0) + (data.value?.audience.loggedIn ?? 0)
);
const loggedInPct = computed(() => Math.round((data.value?.audience.loggedInRate ?? 0) * 100));
const anonymousPct = computed(() => 100 - loggedInPct.value);
</script>
