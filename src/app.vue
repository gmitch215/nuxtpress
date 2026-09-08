<template>
	<UApp :toaster="{ expand: false }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup>
const config = useRuntimeConfig();
const { settings, fetchSettings } = useSettings();

// fetched during ssr to prevent a flash of config values; the payload carries it into
// hydration, so skipping when already populated avoids a duplicate request per page load
if (Object.keys(settings.value).length === 0) {
	await fetchSettings();
}

const siteOrigin = useSiteOrigin();
useCanonical();

useSeoMeta({
	charset: 'utf-8',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		minimumScale: 1,
		maximumScale: 1,
		userScalable: 'no'
	},
	applicationName: settings.value.name || config.public.name,
	title: settings.value.name || config.public.name,
	description: settings.value.description || config.public.description,
	ogTitle: settings.value.name || config.public.name,
	author: settings.value.author || config.public.author,
	creator: settings.value.author || config.public.author,
	ogDescription: settings.value.description || config.public.description,
	ogLocale: 'en_US',
	ogType: 'website',
	themeColor: settings.value.themeColor || config.public.themeColor || '#ffffff',
	ogSiteName: settings.value.name || config.public.name,
	twitterTitle: settings.value.name || config.public.name,
	twitterDescription: settings.value.description || config.public.description,
	twitterCard: 'summary_large_image',
	mobileWebAppCapable: 'yes',
	appleMobileWebAppCapable: 'yes',
	appleMobileWebAppStatusBarStyle: 'black'
});

useHead({
	htmlAttrs: { lang: 'en' },
	link: [
		{
			rel: 'icon',
			type: 'image/x-icon',
			href: '/favicon.ico'
		},
		{
			rel: 'icon',
			type: 'image/png',
			href: '/favicon.png'
		},
		{
			rel: 'apple-touch-icon',
			href: '/favicon.png'
		},
		{
			rel: 'alternate',
			type: 'application/atom+xml',
			title: `${settings.value.name || config.public.name} feed`,
			href: '/feed.xml'
		}
	]
});

useSchemaOrg([
	defineWebSite({
		name: settings.value.name || config.public.name,
		description: settings.value.description || config.public.description,
		url: siteOrigin,
		inLanguage: 'en',
		image: {
			'@type': 'ImageObject',
			url: `${siteOrigin}/favicon.png`
		},
		publisher: {
			'@type': 'Organization',
			name: settings.value.name || config.public.name,
			logo: {
				'@type': 'ImageObject',
				url: `${siteOrigin}/favicon.png`
			}
		},
		potentialAction: {
			'@type': 'SearchAction',
			target: `${siteOrigin}/tags?tag={search_term_string}`,
			'query-input': 'required name=search_term_string'
		}
	})
]);
</script>
