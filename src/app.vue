<template>
	<UApp :toaster="{ expand: false }">
		<NuxtLayout>
			<NuxtPage />
		</NuxtLayout>
	</UApp>
</template>

<script setup>
const config = useRuntimeConfig();

useSeoMeta({
	charset: 'utf-8',
	viewport: {
		width: 'device-width',
		initialScale: 1,
		minimumScale: 1,
		maximumScale: 1,
		userScalable: 'no'
	},
	applicationName: config.public.name,
	title: config.public.name,
	description: config.public.description,
	ogTitle: config.public.name,
	author: config.public.author,
	creator: config.public.author,
	ogDescription: config.description,
	ogLocale: 'en_US',
	ogType: 'website',
	ogSiteName: config.public.name,
	twitterTitle: config.public.name,
	twitterDescription: config.public.description,
	twitterCard: 'summary_large_image',
	mobileWebAppCapable: 'yes',
	appleMobileWebAppCapable: 'yes',
	appleMobileWebAppStatusBarStyle: 'black'
});
</script>
