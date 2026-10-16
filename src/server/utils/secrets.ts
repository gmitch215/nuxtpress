import { MIN_SECRET_LENGTH } from '~/shared/secret';
import { sessionPassword } from './session-password';

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export type SealedSecret = { iv: string; data: string };

function toBase64(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary);
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
	const binary = atob(value);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return bytes;
}

function toBase64Url(bytes: Uint8Array): string {
	return toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function deriveKey(
	secret: string,
	info: string,
	usage: 'encrypt' | 'sign'
): Promise<CryptoKey> {
	const material = await crypto.subtle.importKey('raw', encoder.encode(secret), 'HKDF', false, [
		'deriveKey'
	]);
	const algorithm =
		usage === 'encrypt' ? { name: 'AES-GCM', length: 256 } : { name: 'HMAC', hash: 'SHA-256' };
	return crypto.subtle.deriveKey(
		{
			name: 'HKDF',
			hash: 'SHA-256',
			salt: encoder.encode('nuxtpress'),
			info: encoder.encode(info)
		},
		material,
		algorithm,
		false,
		usage === 'encrypt' ? ['encrypt', 'decrypt'] : ['sign', 'verify']
	);
}

/** The key for seals and signed links: the same password the sessions use. */
export async function sessionSecret(): Promise<string> {
	const secret = await sessionPassword();
	if (!secret) {
		console.error(
			`no session password: NUXT_SESSION_PASSWORD is unset or shorter than ${MIN_SECRET_LENGTH} characters and the one kept in KV could not be read`
		);
		throw createError({ statusCode: 500, statusMessage: 'Session secret is not configured' });
	}
	return secret;
}

export async function sealSecret(value: string, secret: string): Promise<SealedSecret> {
	const key = await deriveKey(secret, 'nuxtpress:seal:v1', 'encrypt');
	const iv = crypto.getRandomValues(new Uint8Array(12));
	const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(value));
	return { iv: toBase64(iv), data: toBase64(new Uint8Array(data)) };
}

/** Returns null when the secret that sealed the value is gone or the value was tampered with. */
export async function openSecret(sealed: SealedSecret, secret: string): Promise<string | null> {
	try {
		const key = await deriveKey(secret, 'nuxtpress:seal:v1', 'encrypt');
		const plain = await crypto.subtle.decrypt(
			{ name: 'AES-GCM', iv: fromBase64(sealed.iv) },
			key,
			fromBase64(sealed.data)
		);
		return decoder.decode(plain);
	} catch {
		return null;
	}
}

export async function signToken(purpose: string, id: string, secret: string): Promise<string> {
	const key = await deriveKey(secret, 'nuxtpress:token:v1', 'sign');
	const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${purpose}:${id}`));
	return toBase64Url(new Uint8Array(mac));
}

export async function verifyToken(
	purpose: string,
	id: string,
	token: string,
	secret: string
): Promise<boolean> {
	const expected = await signToken(purpose, id, secret);
	if (expected.length !== token.length) return false;
	let diff = 0;
	for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
	return diff === 0;
}
