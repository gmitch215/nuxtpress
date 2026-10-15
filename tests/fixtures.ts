import { test as baseTest, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const COVERAGE = process.env.COVERAGE === '1';

const APP_MODULE_RE = /\/_nuxt\/((?!@(?:id|fs)\/).+?\.(?:vue|ts))(?:\?|$)/;
const INLINE_MAP_RE =
	/sourceMappingURL=data:application\/json;(?:charset=utf-8;)?base64,([A-Za-z0-9+/=]+)/;

/**
 * Vite's per-file sourcemaps name a module by basename (`Footer.vue`), which loses the folder.
 * The entry URL still has it, so the source is renamed to its path under src/.
 */
function withRepoPaths<T extends { url: string; source?: string }>(entry: T): T {
	const module = entry.url.match(APP_MODULE_RE)?.[1];
	const inline = entry.source?.match(INLINE_MAP_RE)?.[1];
	if (!module || !inline) return entry;

	const map = JSON.parse(Buffer.from(inline, 'base64').toString('utf8'));
	if (map.sources?.length !== 1) return entry;
	map.sources = [`src/${module}`];
	return { ...entry, sourceMap: map };
}

// auto-fixture that starts/stops chromium V8 coverage when COVERAGE=1
export const test = baseTest.extend<{ autoCoverage: void }>({
	autoCoverage: [
		async ({ page, browserName }, use, testInfo) => {
			const shouldCollect = COVERAGE && browserName === 'chromium';
			if (shouldCollect) {
				await page.coverage.startJSCoverage({ resetOnNavigation: false });
			}
			await use();
			if (shouldCollect) {
				const coverage = await page.coverage.stopJSCoverage();
				if (coverage.length > 0) await addCoverageReport(coverage.map(withRepoPaths), testInfo);
			}
		},
		{ auto: true }
	]
});

export { expect };
