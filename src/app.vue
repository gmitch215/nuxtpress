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
	applicationName: config.name,
	title: config.name,
	description: config.description,
	ogTitle: config.name,
	author: config.author,
	creator: config.author,
	ogDescription: config.description,
	ogLocale: 'en_US',
	ogType: 'website',
	ogSiteName: config.name,
	twitterTitle: config.name,
	twitterDescription: config.description,
	twitterCard: 'summary_large_image',
	mobileWebAppCapable: 'yes',
	appleMobileWebAppCapable: 'yes',
	appleMobileWebAppStatusBarStyle: 'black'
});

// Global Variables

const { fetchUser } = useAuth();
onMounted(() => {
	fetchUser();
});
</script>
