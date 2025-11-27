import { ensureLoggedIn } from '../utils';

export default defineEventHandler(async (event) => {
	await ensureLoggedIn(event);

	const kv = hubKV();
	const config = useRuntimeConfig();

	const {
		name,
		description,
		author,
		themeColor,
		favicon,
		faviconPng,
		github,
		twitter,
		instagram,
		patreon,
		linkedin,
		discord,
		supportEmail
	} = await readBody(event);

	if (name) {
		if (name.length > 50) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Name cannot be longer than 50 characters'
			});
		}

		await kv.set('nuxtpress:setting:name', name);
	}

	if (description) {
		if (description.length > 160) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Description cannot be longer than 160 characters'
			});
		}

		await kv.set('nuxtpress:setting:description', description);
	}

	if (author) {
		if (author.length > 50) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Author cannot be longer than 50 characters'
			});
		}

		await kv.set('nuxtpress:setting:author', author);
	}

	if (themeColor) {
		const hex = /^#([0-9A-F]{3}){1,2}$/i;
		if (!hex.test(themeColor)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Theme color must be a valid hex color'
			});
		}

		await kv.set('nuxtpress:setting:theme_color', themeColor);
	}

	if (favicon) {
		// Support external URLs, relative paths (starting with /), and base64 data URIs
		if (
			favicon.startsWith('data:') ||
			favicon.startsWith('/') ||
			favicon.startsWith('http://') ||
			favicon.startsWith('https://')
		) {
			await kv.set('nuxtpress:setting:favicon', favicon);
		} else {
			throw createError({
				statusCode: 400,
				statusMessage: 'Favicon must be a valid URL, relative path (starting with /), or data URI'
			});
		}
	}

	if (faviconPng) {
		// Support external URLs, relative paths (starting with /), and base64 data URIs
		if (
			faviconPng.startsWith('data:') ||
			faviconPng.startsWith('/') ||
			faviconPng.startsWith('http://') ||
			faviconPng.startsWith('https://')
		) {
			await kv.set('nuxtpress:setting:favicon_png', faviconPng);
		} else {
			throw createError({
				statusCode: 400,
				statusMessage:
					'Favicon PNG must be a valid URL, relative path (starting with /), or data URI'
			});
		}
	}

	if (github) {
		let github0 = github;
		if (github.includes('https://') || github.includes('http://')) {
			github0 = github.replace(/^(https?:\/\/)?(www\.)?github\.com\//, '');
		}

		await kv.set('nuxtpress:setting:github', github0);
	}

	if (twitter) {
		let twitter0 = twitter;
		if (twitter.includes('https://') || twitter.includes('http://')) {
			twitter0 = twitter
				.replace(/^(https?:\/\/)?(www\.)?x\.com\//, '')
				.replace(/^(https?:\/\/)?(www\.)?twitter\.com\//, '');
		}

		await kv.set('nuxtpress:setting:twitter', twitter0);
	}

	if (instagram) {
		let instagram0 = instagram;
		if (instagram.includes('https://') || instagram.includes('http://')) {
			instagram0 = instagram.replace(/^(https?:\/\/)?(www\.)?instagram\.com\//, '');
		}

		await kv.set('nuxtpress:setting:instagram', instagram0);
	}

	if (patreon) {
		let patreon0 = patreon;
		if (patreon.includes('https://') || patreon.includes('http://')) {
			patreon0 = patreon.replace(/^(https?:\/\/)?(www\.)?patreon\.com\//, '');
		}

		await kv.set('nuxtpress:setting:patreon', patreon0);
	}

	if (linkedin) {
		let linkedin0 = linkedin;
		if (linkedin.includes('https://') || linkedin.includes('http://')) {
			linkedin0 = linkedin.replace(/^(https?:\/\/)?(www\.)?linkedin\.com\/in\//, '');
		}

		await kv.set('nuxtpress:setting:linkedin', linkedin0);
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
		await kv.set('nuxtpress:setting:discord', discord0);
	}

	if (supportEmail) {
		// Basic email validation
		const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailPattern.test(supportEmail)) {
			throw createError({
				statusCode: 400,
				statusMessage: 'Support email must be a valid email address'
			});
		}

		await kv.set('nuxtpress:setting:support_email', supportEmail);
	}

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
		supportEmail: supportEmail || config.public.supportEmail
	};
});
