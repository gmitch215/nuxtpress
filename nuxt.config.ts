import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	runtimeConfig: {
		password: process.env.NUXT_PASSWORD || 'password',
		public: {
			name: process.env.NUXT_PUBLIC_NAME || 'NuxtPress',
			description: process.env.NUXT_PUBLIC_DESCRIPTION || 'My NuxtPress blog',
			author: process.env.NUXT_PUBLIC_AUTHOR || 'Gregory Mitchell',
			themeColor: process.env.NUXT_PUBLIC_THEME_COLOR || '#1e40af',
			favicon: process.env.NUXT_PUBLIC_FAVICON || '/favicon.ico',
			faviconPng: process.env.NUXT_PUBLIC_FAVICON_PNG || '/favicon.png',
			github: process.env.NUXT_PUBLIC_GITHUB || '',
			instagram: process.env.NUXT_PUBLIC_INSTAGRAM || '',
			twitter: process.env.NUXT_PUBLIC_TWITTER || '',
			patreon: process.env.NUXT_PUBLIC_PATREON || ''
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	devtools: { enabled: process.env.NODE_ENV === 'development' },
	srcDir: 'src',
	serverDir: 'src/server',
	css: ['~/assets/css/main.css'],
	vite: {
		plugins: [tailwindcss()]
	},
	hub: {
		cache: true,
		kv: true,
		database: true
	},
	nitro: {
		preset: 'cloudflare_module',
		cloudflare: {
			deployConfig: true,
			nodeCompat: true
		},
		prerender: {
			routes: ['/sitemap.xml']
		}
	},
	modules: [
		'@nuxthub/core',
		'@nuxt/ui',
		'nuxt-viewport',
		'@nuxtjs/robots',
		'@nuxtjs/sitemap',
		'@nuxt/image',
		[
			'@nuxtjs/google-fonts',
			{
				families: {
					'Noto+Sans': true
				}
			}
		],
		[
			'@nuxt/icon',
			{
				icon: {
					mode: 'css',
					cssLayer: 'base',
					size: '48px'
				}
			}
		]
	]
});
