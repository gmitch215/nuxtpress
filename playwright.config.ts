import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const isCI = !!process.env.CI;
const COVERAGE = process.env.COVERAGE === '1';
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8787';

const baseReporters: any[] = [['list']];
if (isCI) baseReporters.push(['github']);

const reporters: any[] = COVERAGE
	? [
			...baseReporters,
			[
				'monocart-reporter',
				{
					name: 'NuxtPress E2E',
					outputFile: './coverage/report.html',
					coverage: {
						name: 'NuxtPress Coverage',
						outputDir: './coverage',
						reports: [['lcovonly', { file: 'lcov.info' }], 'console-summary'],
						entryFilter: (entry: { url: string }) => {
							const url = entry.url || '';
							if (!url) return false;
							if (url.includes('node_modules')) return false;
							if (url.includes('/_nuxt/builds/')) return false;
							if (url.startsWith('chrome-extension:')) return false;
							return url.includes('/_nuxt/') || url.startsWith(BASE_URL);
						},
						sourceFilter: (path: string) => path.includes('src/')
					}
				}
			]
		]
	: [...baseReporters, ['html', { open: 'never', outputFolder: 'playwright-report' }]];

export default defineConfig({
	testDir: './tests',
	testIgnore: ['**/utils/**', '**/fixtures/**', '**/fixtures.ts'],
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: reporters,
	outputDir: 'playwright-results',
	globalSetup: fileURLToPath(new URL('./tests/utils/global-setup.ts', import.meta.url)),
	webServer: {
		command: 'bun run dev:test',
		url: BASE_URL,
		reuseExistingServer: !isCI,
		timeout: 240_000,
		stdout: 'pipe',
		stderr: 'pipe'
	},
	use: {
		baseURL: BASE_URL,
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
		actionTimeout: 10_000,
		navigationTimeout: 30_000
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] }
		}
	]
});
