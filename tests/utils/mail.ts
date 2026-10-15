import { expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from './auth';

export type SinkMail = {
	to: string;
	from: string;
	subject: string;
	text: string;
	html: string;
	headers?: Record<string, string>;
	transport: 'binding' | 'cloudflare' | 'smtp';
	wire: any;
};

export const MAIL_CONFIG = {
	enabled: true,
	transport: 'smtp',
	fromAddress: 'blog@test.invalid',
	fromName: 'Test Blog',
	smtpHost: 'smtp.test.invalid',
	smtpPort: 587,
	smtpTls: 'starttls',
	smtpUsername: 'mailer',
	smtpPassword: 'hunter2'
};

let counter = 0;

export function uniqueEmail(prefix = 'sub'): string {
	counter++;
	return `${prefix}-${Date.now()}-${counter}@test.invalid`;
}

/** The subscribe endpoint allows one request per client IP per minute, so each call gets its own. */
export function uniqueIp(): string {
	counter++;
	return `10.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}.${(counter % 250) + 1}`;
}

export async function enableMail(request: APIRequestContext, overrides = {}) {
	await loginViaApi(request);
	const res = await request.post('/api/admin/mail', { data: { ...MAIL_CONFIG, ...overrides } });
	expect(res.ok()).toBe(true);
	await clearSink(request);
}

export async function disableMail(request: APIRequestContext) {
	await loginViaApi(request);
	await request.post('/api/admin/mail', { data: { enabled: false, transport: 'smtp' } });
}

export async function readSink(request: APIRequestContext): Promise<SinkMail[]> {
	const res = await request.get('/api/admin/mail/sink');
	expect(res.ok()).toBe(true);
	return res.json();
}

export async function clearSink(request: APIRequestContext) {
	await request.delete('/api/admin/mail/sink');
}

export function linkIn(mail: SinkMail, path: string): URL {
	const match = mail.text.match(new RegExp(`https?://[^\\s]*${path}[^\\s]*`));
	if (!match) throw new Error(`no ${path} link in mail to ${mail.to}`);
	return new URL(match[0]);
}

export async function subscribe(request: APIRequestContext, email: string, ip = uniqueIp()) {
	return request.post('/api/subscribers/subscribe', {
		data: { email },
		headers: { 'x-forwarded-for': ip }
	});
}

export async function confirmedSubscriber(request: APIRequestContext, email = uniqueEmail()) {
	await clearSink(request);
	const res = await subscribe(request, email);
	expect(res.ok()).toBe(true);
	const mail = (await readSink(request)).find((m) => m.to === email)!;
	const link = linkIn(mail, '/subscribe/confirm');
	const id = link.searchParams.get('id')!;
	const token = link.searchParams.get('token')!;
	const confirm = await request.post('/api/subscribers/confirm', { data: { id, token } });
	expect(confirm.ok()).toBe(true);
	await clearSink(request);
	return { email, id, token };
}

export async function removeTestSubscribers(request: APIRequestContext) {
	await loginViaApi(request);
	const res = await request.get('/api/admin/subscribers', { params: { limit: 200 } });
	const { rows } = await res.json();
	for (const row of rows as { id: string; email: string }[]) {
		if (/@(test|fail|fail-later)\.invalid$/.test(row.email)) {
			await request.delete(`/api/admin/subscribers/${row.id}`);
		}
	}
}

export async function drain(request: APIRequestContext) {
	const res = await request.post('/api/admin/mail/drain');
	expect(res.ok()).toBe(true);
	return (await res.json()) as { sent: number; retried: number; failed: number; remaining: number };
}
