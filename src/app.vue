<template>
	<UApp :toaster="{ expand: false }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup>
const config = useRuntimeConfig();
const { isLoggedIn } = useLogin();
const { settings, fetchSettings } = useSettings();

// Fetch settings during SSR to prevent flash of config values
await fetchSettings();

onMounted(async () => {
	await isLoggedIn();
});

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
		}
	]
});

useSchemaOrg([
	defineWebSite({
		name: settings.value.name || config.public.name,
		url: config.public.site_url,
		image: {
			'@type': 'ImageObject',
			url: config.public.site_url + '/favicon.png'
		},
		publisher: {
			'@type': 'Organization',
			name: settings.value.name || config.public.name,
			logo: {
				'@type': 'ImageObject',
				url: config.public.site_url + '/favicon.png'
			}
		}
	})
]);
</script>
