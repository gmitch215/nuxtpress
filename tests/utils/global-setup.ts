import type { FullConfig } from '@playwright/test';

const TEST_ADMIN = { username: 'admin', password: 'adminpass' };

async function ping(url: string) {
	try {
		const res = await fetch(url, { method: 'GET' });
		return res.ok;
	} catch {
		return false;
	}
}

async function waitFor(url: string, budgetMs: number) {
	const deadline = Date.now() + budgetMs;
	while (Date.now() < deadline) {
		if (await ping(url)) return true;
		await new Promise((r) => setTimeout(r, 1000));
	}
	return false;
}

/**
 * Compiles the routes the specs open. A dev server builds each route on first request, and on a
 * cold build dir that can outlast a single test's timeout.
 */
async function warm(base: string, paths: string[]) {
	for (const path of paths) {
		try {
			await fetch(`${base}${path}`, { method: 'GET' });
		} catch {
			// a warm-up miss is not fatal; the spec will just pay the compile itself
		}
	}
}

export default async function globalSetup(_config: FullConfig) {
	const base = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8787';
	const setupBase = process.env.PLAYWRIGHT_SETUP_URL || 'http://127.0.0.1:8788';

	if (!(await waitFor(`${base}/api/settings`, 240_000))) {
		throw new Error(`Test server never became ready at ${base}`);
	}

	// trigger db init via settings GET; admin user is auto-seeded from NUXT_PASSWORD on first hit
	await fetch(`${base}/api/settings`, { method: 'GET' });

	const login = await fetch(`${base}/api/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(TEST_ADMIN)
	});
	if (!login.ok) {
		throw new Error(`Test admin login failed: ${login.status} ${await login.text()}`);
	}

	await warm(base, ['/', '/about', '/tags', '/profile']);

	if (await waitFor(`${setupBase}/api/setup/status`, 240_000)) {
		await warm(setupBase, ['/setup', '/', '/tags', '/about']);
	}
}
