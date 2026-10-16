import { kv } from 'hub:kv';
import { firstSecret, MIN_SECRET_LENGTH } from '~/shared/secret';

const SESSION_PASSWORD_KV_KEY = 'nuxtpress:session_password';

let cachedPassword: string | undefined;
let pendingLoad: Promise<string | undefined> | null = null;

function generatePassword(): string {
	const bytes = new Uint8Array(48);
	crypto.getRandomValues(bytes);
	let s = '';
	for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]!);
	return btoa(s).replace(/=+$/, '');
}

async function loadOrCreate(): Promise<string | undefined> {
	try {
		const existing = await kv.get<string>(SESSION_PASSWORD_KV_KEY);
		if (existing && existing.length >= MIN_SECRET_LENGTH) return existing;
		const next = generatePassword();
		try {
			await kv.set(SESSION_PASSWORD_KV_KEY, next);
		} catch (error) {
			console.warn('failed to persist generated session password to KV:', error);
		}
		return next;
	} catch (error) {
		console.warn('session password KV read failed:', error);
		return undefined;
	}
}

/**
 * The password the sessions are sealed with: `NUXT_SESSION_PASSWORD` when it is set, otherwise one
 * generated on first use and kept in KV. The session middleware and the signing and sealing helpers
 * both go through here, so they can never disagree about which one is in force.
 */
export async function sessionPassword(): Promise<string | undefined> {
	const configured = firstSecret(
		process.env.NUXT_SESSION_PASSWORD,
		(runtimeConfig().session as { password?: string } | undefined)?.password
	);
	if (configured) {
		cachedPassword = configured;
		return configured;
	}
	if (cachedPassword) return cachedPassword;
	if (!pendingLoad) pendingLoad = loadOrCreate();
	const resolved = await pendingLoad;
	pendingLoad = null;
	if (resolved) cachedPassword = resolved;
	return resolved;
}
