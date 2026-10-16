import type { H3Event } from 'h3';
import { kv } from 'hub:kv';
import type { MailSettingsInput } from '~/shared/schemas';
import type { MailSettings, MailStatus, MailTransport, SmtpTlsMode } from '~/shared/types';
import { openSecret, sealSecret, sessionSecret, type SealedSecret } from './secrets';

export const MAIL_SETTINGS_KV_KEY = 'nuxtpress:setting:mail';
export const MAIL_SECRETS_KV_KEY = 'nuxtpress:setting:mail_secrets';
export const MAIL_SINK_PREFIX = 'nuxtpress:mail_sink:';

export type MailBinding = { send(message: Record<string, unknown>): Promise<unknown> };
export type MailEnv = { EMAIL?: MailBinding } | undefined;

export type MailMessage = {
	to: string;
	subject: string;
	text: string;
	html: string;
	headers?: Record<string, string>;
};

type StoredMail = {
	enabled?: boolean;
	transport?: MailTransport;
	fromAddress?: string;
	fromName?: string;
	cloudflareAccountId?: string;
	smtpHost?: string;
	smtpPort?: number;
	smtpTls?: SmtpTlsMode;
	smtpUsername?: string;
};

type Secrets = { cloudflareApiToken?: string; smtpPassword?: string };

export type Transport =
	| { kind: 'binding'; binding: MailBinding }
	| { kind: 'cloudflare'; accountId: string; token: string }
	| {
			kind: 'smtp';
			host: string;
			port: number;
			tls: SmtpTlsMode;
			username?: string;
			password?: string;
	  };

export type ResolvedMail = {
	status: MailStatus;
	enabled: boolean;
	transport: Transport | null;
	from: { address: string; name: string } | null;
};

export class MailError extends Error {
	constructor(
		message: string,
		readonly code?: string
	) {
		super(message);
		this.name = 'MailError';
	}
}

export function cloudflareEnv(event: H3Event): MailEnv {
	return (event.context as { cloudflare?: { env?: MailEnv } }).cloudflare?.env;
}

async function readJson<T>(key: string): Promise<T | null> {
	const raw = await kv.get<string | T>(key);
	if (!raw) return null;
	if (typeof raw !== 'string') return raw;
	try {
		return JSON.parse(raw) as T;
	} catch {
		return null;
	}
}

export async function readStoredMail(): Promise<StoredMail> {
	return (await readJson<StoredMail>(MAIL_SETTINGS_KV_KEY)) ?? {};
}

/** `null` means sealed secrets exist but cannot be opened (the session secret changed). */
async function readSecrets(): Promise<Secrets | null> {
	const sealed = await readJson<SealedSecret>(MAIL_SECRETS_KV_KEY);
	if (!sealed) return {};
	const opened = await openSecret(sealed, sessionSecret());
	if (opened === null) return null;
	try {
		return JSON.parse(opened) as Secrets;
	} catch {
		return null;
	}
}

export async function saveMailSettings(input: MailSettingsInput): Promise<void> {
	const stored = await readStoredMail();
	const next: StoredMail = { ...stored };

	if (input.enabled !== undefined) next.enabled = input.enabled;
	if (input.transport !== undefined) next.transport = input.transport;
	if (input.fromAddress !== undefined) next.fromAddress = input.fromAddress.toLowerCase();
	if (input.fromName !== undefined) next.fromName = input.fromName.trim();
	if (input.cloudflareAccountId !== undefined) next.cloudflareAccountId = input.cloudflareAccountId;
	if (input.smtpHost !== undefined) next.smtpHost = input.smtpHost.trim();
	if (input.smtpPort !== undefined) next.smtpPort = input.smtpPort;
	if (input.smtpTls !== undefined) next.smtpTls = input.smtpTls;
	if (input.smtpUsername !== undefined) next.smtpUsername = input.smtpUsername.trim();
	await kv.set(MAIL_SETTINGS_KV_KEY, JSON.stringify(next));

	const newToken = input.cloudflareApiToken?.trim();
	const newPassword = input.smtpPassword;
	if (newToken || newPassword) {
		// a blank secret field means "keep the stored one"; an unreadable blob is replaced
		const secrets = (await readSecrets()) ?? {};
		if (newToken) secrets.cloudflareApiToken = newToken;
		if (newPassword) secrets.smtpPassword = newPassword;
		await kv.set(
			MAIL_SECRETS_KV_KEY,
			JSON.stringify(await sealSecret(JSON.stringify(secrets), sessionSecret()))
		);
	}
}

function unconfigured(reason: string, enabled = false): ResolvedMail {
	return {
		status: { configured: false, transport: null, source: null, reason },
		enabled,
		transport: null,
		from: null
	};
}

export async function resolveMail(env: MailEnv): Promise<ResolvedMail> {
	const config = runtimeConfig().mail;
	const stored = await readStoredMail();
	const envSmtp = !!config.smtpHost;
	const envCloudflare = !envSmtp && !!config.cfApiToken && !!config.cfAccountId;
	const source = envSmtp || envCloudflare ? 'env' : 'settings';
	const enabled = stored.enabled ?? source === 'env';

	const address = (config.from || stored.fromAddress || '').toLowerCase();
	const from = address ? { address, name: stored.fromName || '' } : null;
	if (!from) return unconfigured('Set a From address.', enabled);

	const done = (transport: Transport): ResolvedMail => ({
		status: { configured: true, transport: transport.kind, source },
		enabled,
		transport,
		from
	});

	if (envSmtp) {
		return done({
			kind: 'smtp',
			host: config.smtpHost,
			port: Number(config.smtpPort) || 587,
			tls: (config.smtpTls as SmtpTlsMode) || 'starttls',
			username: config.smtpUser || undefined,
			password: config.smtpPass || undefined
		});
	}
	if (envCloudflare) {
		return done({ kind: 'cloudflare', accountId: config.cfAccountId, token: config.cfApiToken });
	}

	const transport = stored.transport ?? 'binding';
	if (transport === 'binding') {
		if (!env?.EMAIL) {
			return unconfigured(
				'The EMAIL send_email binding is not available in this runtime.',
				enabled
			);
		}
		return done({ kind: 'binding', binding: env.EMAIL });
	}

	const secrets = await readSecrets();
	if (secrets === null) {
		return unconfigured('Stored credentials cannot be read. Enter them again.', enabled);
	}

	if (transport === 'cloudflare') {
		if (!stored.cloudflareAccountId || !secrets.cloudflareApiToken) {
			return unconfigured('Set the Cloudflare account ID and API token.', enabled);
		}
		return done({
			kind: 'cloudflare',
			accountId: stored.cloudflareAccountId,
			token: secrets.cloudflareApiToken
		});
	}

	if (!stored.smtpHost) return unconfigured('Set the SMTP host.', enabled);
	return done({
		kind: 'smtp',
		host: stored.smtpHost,
		port: stored.smtpPort ?? 587,
		tls: stored.smtpTls ?? 'starttls',
		username: stored.smtpUsername || undefined,
		password: secrets.smtpPassword || undefined
	});
}

/** The mail is deliverable and the owner has switched subscriptions on. */
export async function mailActive(env: MailEnv): Promise<boolean> {
	const mail = await resolveMail(env);
	return mail.enabled && mail.status.configured;
}

export async function describeMail(
	env: MailEnv
): Promise<Omit<MailSettings, 'subscribers' | 'outbox'>> {
	const config = runtimeConfig().mail;
	const stored = await readStoredMail();
	const secrets = await readSecrets();
	const resolved = await resolveMail(env);
	const sealed = await readJson<SealedSecret>(MAIL_SECRETS_KV_KEY);

	return {
		enabled: resolved.enabled,
		transport: stored.transport ?? 'binding',
		fromAddress: config.from || stored.fromAddress || '',
		fromName: stored.fromName ?? '',
		cloudflareAccountId: stored.cloudflareAccountId ?? '',
		smtpHost: stored.smtpHost ?? '',
		smtpPort: stored.smtpPort ?? 587,
		smtpTls: stored.smtpTls ?? 'starttls',
		smtpUsername: stored.smtpUsername ?? '',
		hasCloudflareApiToken: !!secrets?.cloudflareApiToken,
		hasSmtpPassword: !!secrets?.smtpPassword,
		secretsReadable: secrets !== null || !sealed,
		bindingAvailable: !!env?.EMAIL,
		envOverride: resolved.status.source === 'env',
		status: resolved.status
	};
}

function formatFrom(from: { address: string; name: string }): string {
	return from.name ? `${from.name.replace(/["\r\n<>]/g, '')} <${from.address}>` : from.address;
}

export function cloudflareRequest(
	transport: Extract<Transport, { kind: 'cloudflare' }>,
	from: { address: string; name: string },
	message: MailMessage
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
	return {
		url: `${runtimeConfig().mail.cfApiBase}/accounts/${transport.accountId}/email/sending/send`,
		headers: {
			Authorization: `Bearer ${transport.token}`,
			'Content-Type': 'application/json'
		},
		body: {
			from: from.name ? { address: from.address, name: from.name } : from.address,
			to: message.to,
			subject: message.subject,
			text: message.text,
			html: message.html,
			headers: message.headers
		}
	};
}

export function smtpOptions(
	transport: Extract<Transport, { kind: 'smtp' }>,
	from: { address: string; name: string },
	message: MailMessage
) {
	return {
		hostname: transport.host,
		port: transport.port,
		tls: transport.tls,
		auth: transport.username
			? {
					username: transport.username,
					password: transport.password ?? '',
					mechanism: 'PLAIN' as const
				}
			: undefined,
		from: formatFrom(from),
		to: message.to,
		subject: message.subject,
		text: message.text,
		html: message.html,
		headers: message.headers
	};
}

async function sendViaCloudflare(request: ReturnType<typeof cloudflareRequest>): Promise<void> {
	const response = await fetch(request.url, {
		method: 'POST',
		headers: request.headers,
		body: JSON.stringify(request.body)
	});
	const body = (await response.json().catch(() => null)) as {
		success?: boolean;
		errors?: { code?: number; message?: string }[];
	} | null;
	if (!response.ok || body?.success === false) {
		const detail = body?.errors?.[0];
		throw new MailError(
			`Cloudflare Email Sending failed (${response.status}): ${detail?.message ?? response.statusText}`,
			detail?.code ? String(detail.code) : undefined
		);
	}
}

export async function sendMail(env: MailEnv, message: MailMessage): Promise<void> {
	const mail = await resolveMail(env);
	if (!mail.transport || !mail.from) {
		throw new MailError(mail.status.reason ?? 'Mail is not configured.');
	}
	const { transport, from } = mail;

	if (runtimeConfig().mail.sink) {
		const to = message.to.toLowerCase();
		if (to.endsWith('@fail.invalid') || (to.endsWith('@fail-later.invalid') && message.headers)) {
			throw new MailError('Simulated delivery failure', 'E_DELIVERY_FAILED');
		}
		const wire =
			transport.kind === 'cloudflare'
				? cloudflareRequest(transport, from, message)
				: transport.kind === 'smtp'
					? { ...smtpOptions(transport, from, message), auth: transport.username }
					: {};
		const key = `${MAIL_SINK_PREFIX}${Date.now().toString().padStart(15, '0')}:${crypto.randomUUID()}`;
		await kv.set(
			key,
			JSON.stringify({ ...message, from: formatFrom(from), transport: transport.kind, wire }),
			{ ttl: 3600 }
		);
		return;
	}

	try {
		if (transport.kind === 'binding') {
			await transport.binding.send({
				from: from.name ? { email: from.address, name: from.name } : from.address,
				to: message.to,
				subject: message.subject,
				text: message.text,
				html: message.html,
				headers: message.headers
			});
		} else if (transport.kind === 'cloudflare') {
			await sendViaCloudflare(cloudflareRequest(transport, from, message));
		} else {
			// loaded lazily: edgeport imports cloudflare:sockets, which only exists inside workerd
			const { send } = await import('edgeport/smtp');
			await send(smtpOptions(transport, from, message));
		}
	} catch (error) {
		if (error instanceof MailError) throw error;
		const code = (error as { code?: string })?.code;
		throw new MailError(error instanceof Error ? error.message : String(error), code);
	}
}

export type SinkMail = MailMessage & { from: string; transport: Transport['kind']; wire: unknown };

export async function readSink(): Promise<SinkMail[]> {
	const keys = (await kv.keys(MAIL_SINK_PREFIX)).sort();
	const messages: SinkMail[] = [];
	for (const key of keys) {
		const value = await readJson<SinkMail>(key);
		if (value) messages.push(value);
	}
	return messages;
}

export async function clearSink(): Promise<void> {
	for (const key of await kv.keys(MAIL_SINK_PREFIX)) await kv.del(key);
}
