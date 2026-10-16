import { expect, test } from '../fixtures';
import { loginViaApi } from '../utils/auth';
import {
	clearSink,
	confirmedSubscriber,
	disableMail,
	drain,
	enableMail,
	linkIn,
	readSink,
	removeTestSubscribers,
	subscribe,
	uniqueEmail,
	uniqueIp
} from '../utils/mail';
import { createPost, deletePost } from '../utils/posts';

test.afterEach(async ({ request }) => {
	await removeTestSubscribers(request);
	await disableMail(request);
});

test.describe('mail settings API', () => {
	test('every admin mail route rejects anonymous callers', async ({ request }) => {
		const calls = [
			request.get('/api/admin/mail'),
			request.post('/api/admin/mail', { data: { enabled: true } }),
			request.post('/api/admin/mail/test', { data: { to: 'a@test.invalid' } }),
			request.post('/api/admin/mail/drain'),
			request.get('/api/admin/mail/sink'),
			request.delete('/api/admin/mail/sink'),
			request.get('/api/admin/subscribers'),
			request.get('/api/admin/subscribers/export'),
			request.delete('/api/admin/subscribers/abc')
		];
		for (const res of await Promise.all(calls)) {
			expect([401, 403]).toContain(res.status());
		}
	});

	test('saved secrets are sealed and never returned', async ({ request }) => {
		await enableMail(request, { smtpPassword: 'super-secret-pw' });
		const res = await request.get('/api/admin/mail');
		const text = await res.text();
		expect(text).not.toContain('super-secret-pw');
		const body = JSON.parse(text);
		expect(body.hasSmtpPassword).toBe(true);
		expect(body.secretsReadable).toBe(true);
		expect(body.status).toMatchObject({ configured: true, transport: 'smtp', source: 'settings' });
	});

	test('a blank secret field keeps the stored secret', async ({ request }) => {
		await enableMail(request, { smtpPassword: 'keep-me' });
		await request.post('/api/admin/mail', { data: { fromName: 'Renamed Blog' } });
		const body = await (await request.get('/api/admin/mail')).json();
		expect(body.hasSmtpPassword).toBe(true);
		expect(body.fromName).toBe('Renamed Blog');
	});

	test('rejects invalid settings', async ({ request }) => {
		await loginViaApi(request);
		const bad = [
			{ fromAddress: 'not-an-email' },
			{ transport: 'carrier-pigeon' },
			{ cloudflareAccountId: 'abc' },
			{ smtpPort: 70000 },
			{ smtpTls: 'sometimes' },
			{ fromName: 'x'.repeat(51) }
		];
		for (const data of bad) {
			const res = await request.post('/api/admin/mail', { data });
			expect(res.status(), JSON.stringify(data)).toBe(400);
		}
	});

	test('binding transport reports the missing binding', async ({ request }) => {
		await enableMail(request, { transport: 'binding' });
		const body = await (await request.get('/api/admin/mail')).json();
		expect(body.bindingAvailable).toBe(false);
		expect(body.status.configured).toBe(false);
		expect(body.status.reason).toContain('binding');

		const test = await request.post('/api/admin/mail/test', { data: { to: 'a@test.invalid' } });
		expect(test.status()).toBe(502);
	});

	test('cloudflare transport needs an account id and a token', async ({ request }) => {
		await enableMail(request, { transport: 'cloudflare', cloudflareAccountId: '' });
		let body = await (await request.get('/api/admin/mail')).json();
		expect(body.status.configured).toBe(false);

		await request.post('/api/admin/mail', {
			data: { cloudflareAccountId: 'a'.repeat(32), cloudflareApiToken: 'cf-token' }
		});
		body = await (await request.get('/api/admin/mail')).json();
		expect(body.hasCloudflareApiToken).toBe(true);
		expect(body.status).toMatchObject({ configured: true, transport: 'cloudflare' });
	});

	test('the smtp transport is handed the configured connection and credentials', async ({
		request
	}) => {
		await enableMail(request);
		await request.post('/api/admin/mail/test', { data: { to: 'probe@test.invalid' } });
		const [mail] = await readSink(request);
		expect(mail!.transport).toBe('smtp');
		expect(mail!.wire).toMatchObject({
			hostname: 'smtp.test.invalid',
			port: 587,
			tls: 'starttls',
			auth: 'mailer',
			from: 'Test Blog <blog@test.invalid>',
			to: 'probe@test.invalid'
		});
	});

	test('the cloudflare transport builds an Email Sending API request', async ({ request }) => {
		await enableMail(request, {
			transport: 'cloudflare',
			cloudflareAccountId: 'b'.repeat(32),
			cloudflareApiToken: 'cf-secret-token'
		});
		await request.post('/api/admin/mail/test', { data: { to: 'probe@test.invalid' } });
		const [mail] = await readSink(request);
		expect(mail!.transport).toBe('cloudflare');
		expect(mail!.wire.url).toBe(
			`https://api.cloudflare.com/client/v4/accounts/${'b'.repeat(32)}/email/sending/send`
		);
		expect(mail!.wire.headers.Authorization).toBe('Bearer cf-secret-token');
		expect(mail!.wire.body).toMatchObject({
			from: { address: 'blog@test.invalid', name: 'Test Blog' },
			to: 'probe@test.invalid'
		});
		expect(mail!.wire.body.subject).toContain('Test email');
	});

	test('smtp transport needs a host', async ({ request }) => {
		await enableMail(request, { smtpHost: '' });
		const body = await (await request.get('/api/admin/mail')).json();
		expect(body.status.configured).toBe(false);
		expect(body.status.reason).toContain('host');
	});

	test('a from address is required', async ({ request }) => {
		await enableMail(request, { fromAddress: '' });
		const body = await (await request.get('/api/admin/mail')).json();
		expect(body.status.configured).toBe(false);
		expect(body.status.reason).toContain('From');
	});

	test('public settings expose subscriptions only while mail is active', async ({ request }) => {
		await enableMail(request);
		expect((await (await request.get('/api/settings')).json()).subscriptions).toBe(true);

		await request.post('/api/admin/mail', { data: { enabled: false } });
		expect((await (await request.get('/api/settings')).json()).subscriptions).toBe(false);
	});

	test('the test email goes through the configured transport', async ({ request }) => {
		await enableMail(request);
		const res = await request.post('/api/admin/mail/test', { data: { to: 'probe@test.invalid' } });
		expect(res.ok()).toBe(true);
		const [mail] = await readSink(request);
		expect(mail).toMatchObject({ to: 'probe@test.invalid', from: 'Test Blog <blog@test.invalid>' });
		expect(mail!.subject).toContain('Test email');

		const bad = await request.post('/api/admin/mail/test', { data: { to: 'nope' } });
		expect(bad.status()).toBe(400);
	});
});

test.describe('subscribe flow', () => {
	test('is unavailable while mail is off', async ({ request }) => {
		const res = await subscribe(request, uniqueEmail());
		expect(res.status()).toBe(404);
	});

	test('rejects an invalid address', async ({ request }) => {
		await enableMail(request);
		const res = await subscribe(request, 'not-an-email');
		expect(res.status()).toBe(400);
		expect((await res.json()).statusMessage).toContain('Email');
	});

	test('a filled honeypot is accepted silently and sends nothing', async ({ request }) => {
		await enableMail(request);
		const res = await request.post('/api/subscribers/subscribe', {
			data: { email: uniqueEmail(), website: 'https://spam.example' },
			headers: { 'x-forwarded-for': uniqueIp() }
		});
		expect(res.ok()).toBe(true);
		expect(await readSink(request)).toHaveLength(0);
	});

	test('double opt-in: pending until the emailed link is confirmed', async ({ request }) => {
		await enableMail(request);
		const email = uniqueEmail();
		expect((await subscribe(request, email)).ok()).toBe(true);

		const mails = await readSink(request);
		expect(mails).toHaveLength(1);
		expect(mails[0]!.to).toBe(email);
		expect(mails[0]!.subject).toContain('Confirm your subscription');
		expect(mails[0]!.html).toContain('Confirm Subscription');

		const pending = await (
			await request.get('/api/admin/subscribers', { params: { status: 'pending' } })
		).json();
		expect(pending.rows.find((r: any) => r.email === email)).toBeTruthy();

		const link = linkIn(mails[0]!, '/subscribe/confirm');
		const confirm = await request.post('/api/subscribers/confirm', {
			data: { id: link.searchParams.get('id'), token: link.searchParams.get('token') }
		});
		expect(confirm.ok()).toBe(true);

		const active = await (
			await request.get('/api/admin/subscribers', { params: { status: 'active' } })
		).json();
		const row = active.rows.find((r: any) => r.email === email);
		expect(row?.confirmedAt).toBeTruthy();

		const again = await request.post('/api/subscribers/confirm', {
			data: { id: link.searchParams.get('id'), token: link.searchParams.get('token') }
		});
		expect(again.ok()).toBe(true);
	});

	test('confirm rejects a tampered token, a foreign token and a missing id', async ({
		request
	}) => {
		await enableMail(request);
		const email = uniqueEmail();
		await subscribe(request, email);
		const link = linkIn((await readSink(request))[0]!, '/subscribe/confirm');
		const id = link.searchParams.get('id')!;
		const token = link.searchParams.get('token')!;

		for (const data of [
			{ id, token: `${token}x` },
			{ id, token: `${token.slice(0, -1)}${token.endsWith('A') ? 'B' : 'A'}` },
			{ id: 'f'.repeat(32), token },
			{ id },
			{}
		]) {
			const res = await request.post('/api/subscribers/confirm', { data });
			expect(res.status(), JSON.stringify(data)).toBe(400);
		}

		const pending = await (
			await request.get('/api/admin/subscribers', { params: { status: 'pending' } })
		).json();
		expect(pending.rows.find((r: any) => r.email === email)).toBeTruthy();
	});

	test('an unsubscribe token cannot confirm and a confirm token cannot unsubscribe', async ({
		request
	}) => {
		await enableMail(request);
		const email = uniqueEmail();
		await subscribe(request, email);
		const link = linkIn((await readSink(request))[0]!, '/subscribe/confirm');
		const res = await request.post('/api/subscribers/unsubscribe', {
			data: { id: link.searchParams.get('id'), token: link.searchParams.get('token') }
		});
		expect(res.status()).toBe(400);
	});

	test('an active subscriber gets no second confirmation', async ({ request }) => {
		await enableMail(request);
		const { email } = await confirmedSubscriber(request);
		const res = await subscribe(request, email);
		expect(res.ok()).toBe(true);
		expect(await readSink(request)).toHaveLength(0);
	});

	test('email links ignore a forged host header', async ({ request }) => {
		await enableMail(request);
		const email = uniqueEmail();
		const res = await request.post('/api/subscribers/subscribe', {
			data: { email },
			headers: {
				'x-forwarded-for': uniqueIp(),
				host: 'evil.example',
				'x-forwarded-host': 'evil.example'
			}
		});
		expect(res.ok()).toBe(true);
		const mail = (await readSink(request)).find((m) => m.to === email)!;
		expect(mail.text).not.toContain('evil.example');
		expect(mail.html).not.toContain('evil.example');
		expect(linkIn(mail, '/subscribe/confirm').host).not.toContain('evil.example');
	});

	test('a pending address is not mailed again inside the cooldown', async ({ request }) => {
		await enableMail(request);
		const email = uniqueEmail();
		await subscribe(request, email);
		await subscribe(request, email);
		expect(await readSink(request)).toHaveLength(1);
	});

	test('one client address is limited to one attempt a minute', async ({ request }) => {
		await enableMail(request);
		const ip = uniqueIp();
		expect((await subscribe(request, uniqueEmail(), ip)).ok()).toBe(true);
		const second = await subscribe(request, uniqueEmail(), ip);
		expect(second.status()).toBe(429);
	});

	test('a confirmation that cannot be sent returns a 502', async ({ request }) => {
		await enableMail(request);
		const email = `broken-${Date.now()}@fail.invalid`;
		const res = await subscribe(request, email);
		expect(res.status()).toBe(502);

		// the address is not left behind as a pending subscriber that never received anything
		const listed = await request.get('/api/admin/subscribers', { params: { search: email } });
		expect((await listed.json()).rows).toHaveLength(0);
	});

	test('unsubscribe works as an RFC 8058 one-click POST and is idempotent', async ({ request }) => {
		await enableMail(request);
		const { email, id } = await confirmedSubscriber(request);
		const notified = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Notify for unsubscribe',
					slug: `notify-unsub-${Date.now()}`,
					content: 'Post used to read the unsubscribe link out of a delivered email body.',
					tags: []
				}
			}
		});
		const createdNotified = await notified.json();
		expect(createdNotified.queued).toBeGreaterThanOrEqual(1);
		await drain(request);
		const mail = (await readSink(request)).find((m) => m.to === email)!;
		const oneClick = new URL(mail.headers!['List-Unsubscribe']!.replace(/[<>]/g, ''));
		expect(oneClick.pathname).toBe('/api/subscribers/unsubscribe');
		expect(mail.headers!['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
		expect(oneClick.searchParams.get('id')).toBe(id);

		const res = await request.post(`${oneClick.pathname}${oneClick.search}`, {
			form: { 'List-Unsubscribe': 'One-Click' }
		});
		expect(res.ok()).toBe(true);
		const replay = await request.post(`${oneClick.pathname}${oneClick.search}`, {
			form: { 'List-Unsubscribe': 'One-Click' }
		});
		expect(replay.ok()).toBe(true);

		const list = await (
			await request.get('/api/admin/subscribers', { params: { search: email } })
		).json();
		expect(list.rows).toHaveLength(0);
		await deletePost(request, createdNotified.id);
	});

	test('the unsubscribe page link works with a JSON body and rejects bad tokens', async ({
		request
	}) => {
		await enableMail(request);
		const { id } = await confirmedSubscriber(request);
		const bad = await request.post('/api/subscribers/unsubscribe', { data: { id, token: 'nope' } });
		expect(bad.status()).toBe(400);
		const none = await request.post('/api/subscribers/unsubscribe', { data: {} });
		expect(none.status()).toBe(400);
	});
});

test.describe('admin subscriber list', () => {
	test('lists, filters, searches and pages subscribers', async ({ request }) => {
		await enableMail(request);
		const active = await confirmedSubscriber(request, uniqueEmail('alpha'));
		await subscribe(request, uniqueEmail('beta'));

		const all = await (await request.get('/api/admin/subscribers')).json();
		expect(all.total).toBeGreaterThanOrEqual(2);

		const found = await (
			await request.get('/api/admin/subscribers', { params: { search: 'alpha-' } })
		).json();
		expect(found.rows.map((r: any) => r.email)).toContain(active.email);
		expect(found.rows.every((r: any) => r.email.includes('alpha-'))).toBe(true);

		const onlyActive = await (
			await request.get('/api/admin/subscribers', { params: { status: 'active' } })
		).json();
		expect(onlyActive.rows.every((r: any) => r.status === 'active')).toBe(true);

		const page = await (
			await request.get('/api/admin/subscribers', { params: { limit: 1, offset: 0 } })
		).json();
		expect(page.rows).toHaveLength(1);
		expect(page.total).toBe(all.total);
	});

	test('wildcards in the search are matched literally', async ({ request }) => {
		await enableMail(request);
		await confirmedSubscriber(request);
		const res = await (
			await request.get('/api/admin/subscribers', { params: { search: '%' } })
		).json();
		expect(res.rows).toHaveLength(0);
	});

	test('delete removes a subscriber and 404s on a repeat', async ({ request }) => {
		await enableMail(request);
		const { id } = await confirmedSubscriber(request);
		expect((await request.delete(`/api/admin/subscribers/${id}`)).ok()).toBe(true);
		expect((await request.delete(`/api/admin/subscribers/${id}`)).status()).toBe(404);
	});

	test('the export streams every subscriber, however many pages that takes', async ({
		request
	}) => {
		await enableMail(request);
		const emails = Array.from({ length: 5 }, () => uniqueEmail('page'));
		for (const email of emails) expect((await subscribe(request, email)).ok()).toBe(true);

		const { total } = await (await request.get('/api/admin/subscribers?limit=1')).json();
		const csv = await (await request.get('/api/admin/subscribers/export')).text();
		const lines = csv.trimEnd().split('\n');

		// the test lane pages by two, so this crosses several page boundaries
		expect(lines.length - 1).toBe(total);
		for (const email of emails) {
			expect(lines.filter((line) => line.startsWith(`"${email}"`))).toHaveLength(1);
		}
		expect(new Set(lines).size, 'a row was repeated across pages').toBe(lines.length);
	});

	test('export is a CSV that neutralises spreadsheet formulas', async ({ request }) => {
		await enableMail(request);
		const email = `+cmd-${Date.now()}@test.invalid`;
		await confirmedSubscriber(request, email);
		const res = await request.get('/api/admin/subscribers/export');
		expect(res.headers()['content-type']).toContain('text/csv');
		expect(res.headers()['content-disposition']).toContain('subscribers.csv');
		const csv = await res.text();
		expect(csv.split('\n')[0]).toBe('email,status,subscribed_at,confirmed_at');
		expect(csv).toContain(`"'${email}",active`);
	});
});

test.describe('post notifications', () => {
	test('a notified post is queued and delivered once with unsubscribe headers', async ({
		request
	}) => {
		await enableMail(request);
		const { email } = await confirmedSubscriber(request);
		const slug = `notify-${Date.now()}`;
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'A New Post For Subscribers',
					slug,
					content: 'The body of the post that subscribers should see summarized in the email.',
					tags: []
				}
			}
		});
		const created = await res.json();
		expect(created.queued).toBeGreaterThanOrEqual(1);

		const sent = await drain(request);
		expect(sent.sent).toBeGreaterThanOrEqual(1);
		const mail = (await readSink(request)).find((m) => m.to === email)!;
		expect(mail.subject).toBe('New post: A New Post For Subscribers');
		expect(mail.text).toContain('The body of the post');
		expect(mail.text).toContain(`/${new Date().getUTCFullYear()}/`);
		expect(mail.text).toContain(slug);
		expect(mail.html).toContain('Unsubscribe');
		expect(mail.headers!['List-Unsubscribe']).toMatch(
			/^<https?:\/\/.+\/api\/subscribers\/unsubscribe\?/
		);

		await clearSink(request);
		const again = await drain(request);
		expect(again.sent).toBe(0);
		expect(await readSink(request)).toHaveLength(0);
		await deletePost(request, created.id);
	});

	test('unsubscribe headers reach the cloudflare request body', async ({ request }) => {
		await enableMail(request, {
			transport: 'cloudflare',
			cloudflareAccountId: 'c'.repeat(32),
			cloudflareApiToken: 'cf-token'
		});
		const { email } = await confirmedSubscriber(request);
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Cloudflare headers',
					slug: `cf-headers-${Date.now()}`,
					content: 'A post sent through the Cloudflare transport to inspect request headers.',
					tags: []
				}
			}
		});
		const created = await res.json();
		await drain(request);
		const mail = (await readSink(request)).find((m) => m.to === email)!;
		expect(mail.wire.body.headers['List-Unsubscribe']).toMatch(/^<https?:\/\//);
		expect(mail.wire.body.headers['List-Unsubscribe-Post']).toBe('List-Unsubscribe=One-Click');
		await deletePost(request, created.id);
	});

	test('a post without notify queues nothing', async ({ request }) => {
		await enableMail(request);
		await confirmedSubscriber(request);
		const post = await createPost(request, {
			title: 'Quiet post',
			slug: `quiet-${Date.now()}`,
			content: 'A post published without asking for subscriber emails to go out.'
		});
		expect(post.queued).toBeUndefined();
		const result = await drain(request);
		expect(result.sent).toBe(0);
		await deletePost(request, post.id);
	});

	test('pending and removed subscribers are not mailed', async ({ request }) => {
		await enableMail(request);
		const pending = uniqueEmail('pending');
		await subscribe(request, pending);
		const gone = await confirmedSubscriber(request, uniqueEmail('gone'));
		await clearSink(request);

		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Audience check',
					slug: `audience-${Date.now()}`,
					content: 'A post used to check that only confirmed subscribers receive the email.',
					tags: []
				}
			}
		});
		const created = await res.json();
		await request.delete(`/api/admin/subscribers/${gone.id}`);
		await drain(request);

		const recipients = (await readSink(request)).map((m) => m.to);
		expect(recipients).not.toContain(pending);
		expect(recipients).not.toContain(gone.email);
		await deletePost(request, created.id);
	});

	test('notify does nothing while mail is off', async ({ request }) => {
		await loginViaApi(request);
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Mail is off',
					slug: `mail-off-${Date.now()}`,
					content: 'A post published with notify while the mail settings are switched off.',
					tags: []
				}
			}
		});
		const created = await res.json();
		expect(created.queued).toBeUndefined();
		await deletePost(request, created.id);
	});

	test('a failing recipient is retried and then marked failed', async ({ request }) => {
		await enableMail(request);
		await confirmedSubscriber(request, `broken-${Date.now()}@fail-later.invalid`);
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Delivery failure',
					slug: `fails-${Date.now()}`,
					content: 'A post whose only recipient always fails, to exercise retries and failure.',
					tags: []
				}
			}
		});
		const created = await res.json();

		const first = await drain(request);
		expect(first.retried).toBe(1);
		const second = await drain(request);
		expect(second.retried).toBe(1);
		const third = await drain(request);
		expect(third.failed).toBe(1);

		const status = await (await request.get('/api/admin/mail')).json();
		expect(status.outbox.failed).toBeGreaterThanOrEqual(1);
		await deletePost(request, created.id);
	});

	test('queued mail waits while mail is disabled', async ({ request }) => {
		await enableMail(request);
		await confirmedSubscriber(request);
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Held back',
					slug: `held-${Date.now()}`,
					content: 'A post queued while mail was on and drained after mail was switched off.',
					tags: []
				}
			}
		});
		const created = await res.json();
		await request.post('/api/admin/mail', { data: { enabled: false } });

		const result = await drain(request);
		expect(result.sent).toBe(0);
		expect(result.remaining).toBeGreaterThanOrEqual(1);
		await enableMail(request);
		await deletePost(request, created.id);
	});

	test('the scheduled drain task sends the queue', async ({ request }) => {
		await enableMail(request);
		const { email } = await confirmedSubscriber(request);
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Scheduled send',
					slug: `scheduled-${Date.now()}`,
					content: 'A post drained by the nitro scheduled task instead of the admin button.',
					tags: []
				}
			}
		});
		const created = await res.json();
		const task = await request.get('/_nitro/tasks/mail:drain');
		expect(task.ok()).toBe(true);
		expect((await task.json()).result.sent).toBeGreaterThanOrEqual(1);
		expect((await readSink(request)).some((m) => m.to === email)).toBe(true);
		await deletePost(request, created.id);
	});

	test('a data URL thumbnail is replaced by its public route in the email', async ({ request }) => {
		await enableMail(request);
		const { email } = await confirmedSubscriber(request);
		const png =
			'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
		const res = await request.post('/api/blog/create', {
			data: {
				notify: true,
				post: {
					title: 'Thumbnail in mail',
					slug: `thumb-mail-${Date.now()}`,
					content: 'A post with an uploaded thumbnail, which mail clients would not render inline.',
					thumbnail_url: png,
					tags: []
				}
			}
		});
		const created = await res.json();
		await drain(request);
		const mail = (await readSink(request)).find((m) => m.to === email)!;
		expect(mail.html).not.toContain('data:image');
		expect(mail.html).toContain(`/thumbnails/${created.id}`);
		await deletePost(request, created.id);
	});
});
