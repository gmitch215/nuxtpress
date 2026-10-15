import { kv } from 'hub:kv';
import { cloudflareEnv, mailActive } from '~/server/utils/mail';
import { mediaAvailable } from '~/server/utils/media';
import { getUrlStyle } from '~/server/utils/posts';

// an uploaded icon is served from its route; inlining it would put the file in every page payload
function publicIconPath(stored: string, fallback: string, route: string): string {
	if (stored.startsWith('data:')) return route;
	return stored || fallback;
}

// unstorage JSON-parses on read, so a value like "2026" comes back as a number
function text(value: unknown): string {
	return value === null || value === undefined || typeof value === 'object' ? '' : String(value);
}

const TEXT_KEYS = [
	'name',
	'description',
	'bio',
	'author',
	'theme_color',
	'favicon',
	'favicon_png',
	'website',
	'github',
	'twitter',
	'instagram',
	'patreon',
	'linkedin',
	'discord',
	'support_email'
] as const;

export default defineEventHandler(async (event) => {
	const config = useRuntimeConfig();

	const [stored, urlStyle, subscriptions, rawMessage] = await Promise.all([
		Promise.all(TEXT_KEYS.map(async (key) => text(await kv.get(`nuxtpress:setting:${key}`)))),
		getUrlStyle(),
		mailActive(cloudflareEnv(event)).catch(() => false),
		kv.get<string | Record<string, unknown>>('nuxtpress:setting:message')
	]);
	const value = Object.fromEntries(TEXT_KEYS.map((key, i) => [key, stored[i]])) as Record<
		(typeof TEXT_KEYS)[number],
		string
	>;

	const name = value.name || config.public.name;
	const description = value.description || config.public.description;
	const bio = value.bio;
	const author = value.author || config.public.author;
	const themeColor = value.theme_color || config.public.themeColor;
	const favicon = publicIconPath(value.favicon, config.public.favicon, '/favicon.ico');
	const faviconPng = publicIconPath(value.favicon_png, config.public.faviconPng, '/favicon.png');
	const website = value.website || config.public.website;
	const github = value.github || config.public.github;
	const twitter = value.twitter || config.public.twitter;
	const instagram = value.instagram || config.public.instagram;
	const patreon = value.patreon || config.public.patreon;
	const linkedin = value.linkedin || config.public.linkedin;
	const discord = value.discord || config.public.discord;
	const supportEmail = value.support_email || config.public.supportEmail;
	let message: {
		text: string;
		icon?: string | null;
		ttl: number;
		type: 'success' | 'warning' | 'error' | 'info';
		link?: string | null;
	} | null = null;
	try {
		const parsed =
			typeof rawMessage === 'string' ? (rawMessage ? JSON.parse(rawMessage) : null) : rawMessage;

		if (
			parsed &&
			typeof parsed === 'object' &&
			typeof parsed.text === 'string' &&
			typeof parsed.ttl === 'number' &&
			['success', 'warning', 'error', 'info'].includes(String(parsed.type))
		) {
			message = {
				text: parsed.text,
				icon: typeof parsed.icon === 'string' ? parsed.icon : null,
				ttl: parsed.ttl,
				type: parsed.type as 'success' | 'warning' | 'error' | 'info',
				link: typeof parsed.link === 'string' ? parsed.link : null
			};
		} else {
			message = null;
		}
	} catch (e) {
		// If message is not valid JSON, ignore it and return null
		console.error('Failed to parse message from KV:', e);
		message = null;
	}

	return {
		name,
		description,
		bio,
		themeColor,
		author,
		favicon,
		faviconPng,
		website,
		github,
		twitter,
		instagram,
		patreon,
		linkedin,
		discord,
		supportEmail,
		urlStyle,
		subscriptions,
		media: mediaAvailable(event),
		message
	};
});
