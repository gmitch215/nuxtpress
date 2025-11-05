import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	runtimeConfig: {
		public: {
			name: 'NuxtPress',
			description: 'My NuxtPress blog',
			author: 'Gregory Mitchell',
			themeColor: '#1e40af'
		}
	},
	ssr: true,
	compatibilityDate: '2025-06-20',
	devtools: { enabled: true },
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
