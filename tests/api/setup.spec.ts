import { expect, test } from '../fixtures';

test.describe('setup API', () => {
	test('GET /api/setup/status reports admin already exists', async ({ request }) => {
		const res = await request.get('/api/setup/status');
		expect(res.ok()).toBe(true);
		const body = await res.json();
		expect(body).toHaveProperty('needsSetup');
		expect(body).toHaveProperty('userCount');
		expect(body).toHaveProperty('hasLegacyPassword');
		expect(body.needsSetup).toBe(false);
		expect(body.userCount).toBeGreaterThan(0);
	});

	test('POST /api/setup/init rejects when users already exist', async ({ request }) => {
		const res = await request.post('/api/setup/init', {
			data: {
				username: 'noway',
				displayName: 'Should Not Work',
				password: 'a-fine-password',
				role: 'administrator'
			}
		});
		expect(res.status()).toBe(409);
	});
});
