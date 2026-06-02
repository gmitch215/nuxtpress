import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

const isCI = !!process.env.CI;
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8787';
export const ADMIN_STORAGE = fileURLToPath(
	new URL('./playwright-results/.admin-storage.json', import.meta.url)
);

export default defineConfig({
	testDir: './tests',
	testIgnore: ['**/utils/**', '**/fixtures/**'],
	fullyParallel: false,
	forbidOnly: isCI,
	retries: isCI ? 2 : 0,
	workers: 1,
	timeout: 60_000,
	expect: { timeout: 10_000 },
	reporter: isCI
		? [['list'], ['github'], ['html', { open: 'never', outputFolder: 'playwright-report' }]]
		: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
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
			name: 'auth-setup',
			testMatch: /auth\.setup\.ts$/,
			use: { ...devices['Desktop Chrome'] }
		},
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'], storageState: ADMIN_STORAGE },
			dependencies: ['auth-setup']
		}
	]
});
