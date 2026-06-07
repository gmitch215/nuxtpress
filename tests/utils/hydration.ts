import type { Page } from '@playwright/test';

// wait until the app has hydrated (see src/plugins/hydration-marker.client.ts) before interacting,
// so clicks aren't lost by landing before Vue attaches event handlers — the main CI flake source.
export async function waitForHydration(page: Page): Promise<void> {
	await page.waitForFunction(() => document.documentElement.dataset.hydrated === 'true', null, {
		timeout: 15_000
	});
}
