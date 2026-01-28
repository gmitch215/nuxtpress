import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	site: {
		url: process.env.NUXT_PUBLIC_SITE_URL || 'https://nuxtpress.pages.dev'
	},
	runtimeConfig: {
		password: process.env.NUXT_PASSWORD || 'password',
		public: {
			site_url: process.env.NUXT_PUBLIC_SITE_URL,
			name: process.env.NUXT_PUBLIC_NAME || 'NuxtPress',
			description: process.env.NUXT_PUBLIC_DESCRIPTION || 'My NuxtPress blog',
			author: process.env.NUXT_PUBLIC_AUTHOR || 'Gregory Mitchell',
			themeColor: process.env.NUXT_PUBLIC_THEME_COLOR || '#1e40af',
			favicon: process.env.NUXT_PUBLIC_FAVICON || '/_favicon.ico',
			faviconPng: process.env.NUXT_PUBLIC_FAVICON_PNG || '/_favicon.png',
			website: process.env.NUXT_PUBLIC_WEBSITE || '',
			github: process.env.NUXT_PUBLIC_GITHUB || '',
			instagram: process.env.NUXT_PUBLIC_INSTAGRAM || '',
			twitter: process.env.NUXT_PUBLIC_TWITTER || '',
			patreon: process.env.NUXT_PUBLIC_PATREON || '',
			linkedin: process.env.NUXT_PUBLIC_LINKEDIN || '',
			discord: process.env.NUXT_PUBLIC_DISCORD || '',
			supportEmail: process.env.NUXT_PUBLIC_SUPPORT_EMAIL || ''
		}
	},
	ssr: true,
	compatibilityDate: '2025-12-13',
	devtools: { enabled: process.env.NODE_ENV === 'development' },
	srcDir: 'src',
	serverDir: 'src/server',
	css: ['~/assets/css/main.css', '~/assets/css/prose.scss'],
	vite: {
		plugins: [tailwindcss()],
		css: {
			devSourcemap: true,
			transformer: 'lightningcss'
		},
		build: {
			cssMinify: 'lightningcss'
		},
		optimizeDeps: {
			include: [
				'prosemirror-state',
				'prosemirror-view',
				'prosemirror-model',
				'prosemirror-transform'
			]
		}
	},
	hub: {
		cache: true,
		kv: true,
		db: 'sqlite'
	},
	$production: {
		nitro: {
			preset: 'cloudflare_module',
			cloudflare: {
				deployConfig: true,
				nodeCompat: true
			}
		}
	},
	nitro: {
		prerender: {
			routes: ['/sitemap.xml'],
			ignore: ['/api/**']
		},
		routeRules: {
			'/api/**': { prerender: false, cors: true },
			'/favicon.png': { headers: { 'Cache-Control': 'public, max-age=31536000' } },
			'/favicon.ico': { headers: { 'Cache-Control': 'public, max-age=31536000' } }
		}
	},
	modules: [
		'@nuxthub/core',
		'@nuxt/ui',
		'nuxt-viewport',
		'@nuxtjs/robots',
		'@nuxtjs/sitemap',
		'nuxt-schema-org',
		'@nuxt/image',
		[
			'@nuxtjs/google-fonts',
			{
				families: {
					'Noto+Sans': true
				},
				display: 'swap',
				preload: true,
				prefetch: true,
				preconnect: true
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
	],
	image: {
		quality: 85,
		format: ['webp', 'avif'],
		screens: {
			xs: 320,
			sm: 640,
			md: 768,
			lg: 1024,
			xl: 1280,
			xxl: 1536
		},
		presets: {
			thumbnail: {
				modifiers: {
					format: 'webp',
					quality: 85,
					fit: 'cover'
				}
			}
		}
	},
	routeRules: {
		'/_ipx/**': {
			headers: {
				'Cache-Control': 'public, max-age=31536000, immutable'
			}
		}
	}
});
