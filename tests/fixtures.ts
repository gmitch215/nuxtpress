import { test as baseTest, expect } from '@playwright/test';
import { addCoverageReport } from 'monocart-reporter';

const COVERAGE = process.env.COVERAGE === '1';

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
				if (coverage.length > 0) await addCoverageReport(coverage, testInfo);
			}
		},
		{ auto: true }
	]
});

export { expect };
