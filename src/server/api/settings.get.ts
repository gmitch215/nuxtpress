import { kv } from 'hub:kv';

export default defineEventHandler(async (_) => {
	const config = useRuntimeConfig();

	const name = (await kv.get<string>('nuxtpress:setting:name')) || config.public.name;
	const description =
		(await kv.get<string>('nuxtpress:setting:description')) || config.public.description;
	const bio = (await kv.get<string>('nuxtpress:setting:bio')) || '';
	const author = (await kv.get<string>('nuxtpress:setting:author')) || config.public.author;
	const themeColor =
		(await kv.get<string>('nuxtpress:setting:theme_color')) || config.public.themeColor;
	const favicon = (await kv.get<string>('nuxtpress:setting:favicon')) || config.public.favicon;
	const faviconPng =
		(await kv.get<string>('nuxtpress:setting:favicon_png')) || config.public.faviconPng;
	const website = (await kv.get<string>('nuxtpress:setting:website')) || config.public.website;
	const github = (await kv.get<string>('nuxtpress:setting:github')) || config.public.github;
	const twitter = (await kv.get<string>('nuxtpress:setting:twitter')) || config.public.twitter;
	const instagram =
		(await kv.get<string>('nuxtpress:setting:instagram')) || config.public.instagram;
	const patreon = (await kv.get<string>('nuxtpress:setting:patreon')) || config.public.patreon;
	const linkedin = (await kv.get<string>('nuxtpress:setting:linkedin')) || config.public.linkedin;
	const discord = (await kv.get<string>('nuxtpress:setting:discord')) || config.public.discord;
	const supportEmail =
		(await kv.get<string>('nuxtpress:setting:support_email')) || config.public.supportEmail;

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
		supportEmail
	};
});
