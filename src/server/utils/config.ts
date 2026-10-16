import type { H3Event } from 'h3';

/**
 * `useRuntimeConfig()` without an event returns a copy frozen when the isolate starts, before a
 * deployed Worker's variables and secrets are readable. With an event it re-reads the environment
 * on the spot, so a throwaway one gets the current values without threading the real event through
 * every helper.
 */
export function runtimeConfig() {
	return useRuntimeConfig({ context: { nitro: {} } } as unknown as H3Event);
}
