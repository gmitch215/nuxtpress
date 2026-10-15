import { kv } from 'hub:kv';
import { requireAdmin } from '~/server/utils/auth';
import { invalidatePostCaches, URL_STYLE_KV_KEY } from '~/server/utils/posts';
import {
	INLINE_IMAGE_MAX_CHARS as FAVICON_MAX_CHARS,
	FAVICON_TYPES,
	INLINE_IMAGE_TYPES,
	isDataImage
} from '~/shared/images';

// the form echoes /favicon.ico back when a stored upload is unchanged; that path is not a new value
function checkFavicon(value: string, label: string, types: readonly string[]): string {
	if (value.startsWith('data:')) {
		if (!isDataImage(value, types, FAVICON_MAX_CHARS)) {
			throw createError({
				statusCode: 400,
				statusMessage: `${label} upload must be an allowed image type under about 250 KB`
			});
		}
		return value;
	}
	if (value.startsWith('/') || value.startsWith('http://') || value.startsWith('https://')) {
		return value;
	}
	throw createError({
		statusCode: 400,
		statusMessage: `${label} must be a valid URL, relative path (starting with /), or data URI`
	});
}

const TEXT_FIELDS = [
	'name',
	'description',
	'bio',
	'author',
	'themeColor',
	'favicon',
	'faviconPng',
	'website',
	'github',
	'twitter',
	'instagram',
	'patreon',
	'linkedin',
	'discord',
	'supportEmail',
	'urlStyle'
] as const;

export default defineEventHandler(async (event) => {
	await requireAdmin(event);

	const config = useRuntimeConfig();

	const body = (await readBody(event)) ?? {};
	for (const key of TEXT_FIELDS) {
		if (body[key] !== undefined && body[key] !== null && typeof body[key] !== 'string') {
			throw createError({ statusCode: 400, statusMessage: `${key} must be text` });
		}
	}
	if (body.message !== undefined && body.message !== null) {
		const m = body.message;
		if (typeof m !== 'object' || Array.isArray(m)) {
			throw createError({ statusCode: 400, statusMessage: 'Message must be an object' });
		}
		for (const key of ['text', 'link', 'icon', 'type']) {
			if (m[key] !== undefined && m[key] !== null && typeof m[key] !== 'string') {
				throw createError({ statusCode: 400, statusMessage: `Message ${key} must be text` });
			}
		}
		if (m.ttl !== undefined && m.ttl !== null && !Number.isFinite(m.ttl)) {
			throw createError({ statusCode: 400, statusMessage: 'Message TTL must be a number' });
		}
	}

	// every field is checked before the first write, so a 400 never leaves a half-saved form
	const writes: Array<() => Promise<unknown>> = [];
	const put = (key: string, value: string) => writes.push(() => kv.set(key, value));
	let rebuild = false;

	const {
		name,
		description,
		bio,
		author,
		themeColor,
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
		message
	} = body;

	if (name) {
		if (name.length > 50) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Name cannot be longer than 50 characters'
			});
		}

		put('nuxtpress:setting:name', name);
	}

	if (description) {
		if (description.length > 160) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Description cannot be longer than 160 characters'
			});
		}

		put('nuxtpress:setting:description', description);
	}

	if (bio) {
		if (bio.length > 500) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Bio cannot be longer than 500 characters'
			});
		}

		put('nuxtpress:setting:bio', bio);
	}

	if (author) {
		if (author.length > 50) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Author cannot be longer than 50 characters'
			});
		}

		put('nuxtpress:setting:author', author);
	}

	if (themeColor) {
		const hex = /^#([0-9A-F]{3}){1,2}$/i;
		if (!hex.test(themeColor)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Theme color must be a valid hex color'
			});
		}

		put('nuxtpress:setting:theme_color', themeColor);
	}

	if (favicon && favicon !== '/favicon.ico') {
		put('nuxtpress:setting:favicon', checkFavicon(favicon, 'Favicon', FAVICON_TYPES));
	}

	if (faviconPng && faviconPng !== '/favicon.png') {
		put(
			'nuxtpress:setting:favicon_png',
			checkFavicon(faviconPng, 'Favicon PNG', INLINE_IMAGE_TYPES)
		);
	}

	if (website) {
		// Validate website URL - must start with http:// or https://
		const urlPattern = /^(https?:\/\/)/;
		if (!urlPattern.test(website)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Website must start with http:// or https://'
			});
		}

		put('nuxtpress:setting:website', website);
	}

	if (github) {
		let github0 = github;
		if (github.includes('https://') || github.includes('http://')) {
			github0 = github.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');
		}

		put('nuxtpress:setting:github', github0);
	}

	if (twitter) {
		let twitter0 = twitter;
		if (twitter.includes('https://') || twitter.includes('http://')) {
			twitter0 = twitter
				.replace(/^(https?:\/\/)?(www\.)?x\.com\//, '')
				.replace(/^(https?:\/\/)?(www\.)?twitter\.com\//, '');
		}

		put('nuxtpress:setting:twitter', twitter0);
	}

	if (instagram) {
		let instagram0 = instagram;
		if (instagram.includes('https://') || instagram.includes('http://')) {
			instagram0 = instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');
		}

		put('nuxtpress:setting:instagram', instagram0);
	}

	if (patreon) {
		let patreon0 = patreon;
		if (patreon.includes('https://') || patreon.includes('http://')) {
			patreon0 = patreon.replace(/^(https?:\/\/)?(www\.)?patreon\.com\//, '');
		}

		put('nuxtpress:setting:patreon', patreon0);
	}

	if (linkedin) {
		let linkedin0 = linkedin;
		if (linkedin.includes('https://') || linkedin.includes('http://')) {
			linkedin0 = linkedin.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//, '');
		}

		put('nuxtpress:setting:linkedin', linkedin0);
	}

	if (discord) {
		// Validate Discord URL - only allow discord.gg/, discord.com/invite/, or discord.com/users/
		const discordInvitePattern =
			/^(https?:\/\/)?(discord\.gg\/[a-zA-Z0-9]+|discord\.com\/invite\/[a-zA-Z0-9]+|discord\.com\/users\/\d+)$/;

		if (!discordInvitePattern.test(discord)) {
			throw createError({
				statusCode: 400,
				statusMessage:
					'Discord must be a valid invite link (discord.gg/ or discord.com/invite/) or user profile (discord.com/users/)'
			});
		}

		// Store full URL with https:// if not present
		const discord0 = discord.startsWith('http') ? discord : `https://${discord}`;
		put('nuxtpress:setting:discord', discord0);
	}

	if (supportEmail) {
		if (supportEmail.length > 255) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Support email cannot be longer than 255 characters'
			});
		}

		// Basic email validation
		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(supportEmail)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Support email must be a valid email address'
			});
		}

		put('nuxtpress:setting:support_email', supportEmail);
	}

	if (urlStyle !== undefined) {
		if (urlStyle !== 'dated' && urlStyle !== 'slug') {
			throw createError({
				statusCode: 400,
				statusMessage: 'URL style must be either "dated" or "slug"'
			});
		}

		put(URL_STYLE_KV_KEY, urlStyle);
		// the feed and sitemap embed post URLs, so both have to be rebuilt
		rebuild = true;
	}

	if (message && typeof message.text === 'string' && message.text.trim() === '') {
		writes.push(() => kv.del('nuxtpress:setting:message'));
	} else if (message) {
		if (typeof message.text !== 'string') {
			throw createError({ statusCode: 400, statusMessage: 'Message text is required' });
		}

		if (message.text.length > 300) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message text cannot be longer than 300 characters'
			});
		}

		if (message.link && !/^https?:\/\/\S+$/i.test(message.link)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message link must be an http:// or https:// URL'
			});
		}

		if (message.link && message.link.length > 200) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message link cannot be longer than 200 characters'
			});
		}

		if (message.icon && message.icon.length > 100) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message icon cannot be longer than 100 characters'
			});
		}

		if (!['success', 'warning', 'error', 'info'].includes(message.type)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message type must be one of success, warning, error, or info'
			});
		}

		const ttl = message.ttl || 0;
		if (ttl < 0 || ttl > 60 * 60 * 24 * 14) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Message TTL must be a positive number and less than 14 days'
			});
		}

		writes.push(() =>
			kv.set('nuxtpress:setting:message', JSON.stringify(message), ttl > 0 ? { ttl } : undefined)
		);
	}

	await Promise.all(writes.map((write) => write()));
	if (rebuild) await invalidatePostCaches();

	return {
		name: name || config.public.name,
		description: description || config.public.description,
		themeColor: themeColor || config.public.themeColor,
		author: author || config.public.author,
		favicon: favicon || config.public.favicon,
		faviconPng: faviconPng || config.public.faviconPng,
		github: github || config.public.github,
		twitter: twitter || config.public.twitter,
		instagram: instagram || config.public.instagram,
		patreon: patreon || config.public.patreon,
		linkedin: linkedin || config.public.linkedin,
		discord: discord || config.public.discord,
		supportEmail: supportEmail || config.public.supportEmail,
		urlStyle: urlStyle || 'dated',
		message: message || null
	};
});
