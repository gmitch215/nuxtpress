import { defineNuxtConfig } from 'nuxt/config';

import tailwindcss from '@tailwindcss/vite';

export default defineNuxtConfig({
	site: {
		url: process.env.NUXT_PUBLIC_SITE_URL || 'https://nuxtpress.pages.dev',
		name: process.env.NUXT_PUBLIC_NAME || 'NuxtPress'
	},
	robots: {
		groups: [
			{
				userAgent: ['*'],
				// the public read APIs stay crawlable on purpose: blocking them would stop a
				// JS-rendering crawler from resolving anything it fetches during hydration
				disallow: [
					'/setup',
					'/profile',
					'/unsubscribe',
					'/subscribe/',
					'/admin/',
					'/api/admin/',
					'/api/subscribers/',
					'/api/analytics/',
					'/api/setup/',
					'/api/login',
					'/api/logout',
					'/api/verify'
				]
			}
		],
		sitemap: ['/sitemap.xml']
	},
	sitemap: {
		sources: ['/api/__sitemap__/urls'],
		exclude: ['/setup', '/profile', '/unsubscribe', '/subscribe/**', '/admin/**'],
		defaults: { changefreq: 'weekly', priority: 0.7 }
	},
	runtimeConfig: {
		password: process.env.NUXT_PASSWORD || 'password',
		session: {
			password:
				process.env.NUXT_SESSION_PASSWORD ||
				(process.env.NODE_ENV === 'production'
					? ''
					: 'dev_only_session_secret_at_least_32_chars_long_xx'),
			cookie: {
				sameSite: 'lax',
				httpOnly: true,
				path: '/',
				secure: process.env.NODE_ENV === 'production'
			}
		},
		analyticsSalt: process.env.NUXT_ANALYTICS_SALT || 'dev_analytics_salt_change_me_please',
		media: { sweepGraceMs: 24 * 60 * 60 * 1000 },
		mail: {
			sink: process.env.NUXTPRESS_MAIL_SINK === '1',
			from: '',
			smtpHost: '',
			smtpPort: 587,
			smtpTls: 'starttls',
			smtpUser: '',
			smtpPass: '',
			cfAccountId: '',
			cfApiToken: '',
			cfApiBase: 'https://api.cloudflare.com/client/v4',
			exportPageSize: 1000
		},
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
	// the setup-flow test lane runs a second dev server in this same project, which needs its own
	// build dir; two dev servers sharing .nuxt clobber each other's generated files
	buildDir: process.env.NUXTPRESS_BUILD_DIR || '.nuxt',
	css: ['~/assets/css/main.css', '~/assets/css/prose.scss'],
	vite: {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		plugins: [tailwindcss() as any],
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
				'prosemirror-transform',
				'@tiptap/extension-audio',
				'@tiptap/extension-emoji',
				'@tiptap/extension-text-align',
				'@tiptap/extension-youtube',
				'@tiptap/core',
				'highlight.js/lib/common',
				'highlight.js/lib/languages/clojure',
				'highlight.js/lib/languages/dart',
				'highlight.js/lib/languages/dockerfile',
				'highlight.js/lib/languages/elixir',
				'highlight.js/lib/languages/gradle',
				'highlight.js/lib/languages/groovy',
				'highlight.js/lib/languages/haskell',
				'highlight.js/lib/languages/julia',
				'highlight.js/lib/languages/latex',
				'highlight.js/lib/languages/nginx',
				'highlight.js/lib/languages/nix',
				'highlight.js/lib/languages/ocaml',
				'highlight.js/lib/languages/powershell',
				'highlight.js/lib/languages/protobuf',
				'highlight.js/lib/languages/scala',
				'highlight.js/lib/languages/vim',
				'marked',
				'zod',
				'@vue/devtools-core',
				'@vue/devtools-kit',
				'@unhead/schema-org/vue',
				'@unovis/vue'
			]
		}
	},
	hub: {
		dir: process.env.NUXTPRESS_DATA_DIR || '.data',
		cache: true,
		// `base` only means anything to the local fs-lite driver, but nuxthub defu-merges this
		// object into whichever driver it picks. Passing it unconditionally reached the
		// cloudflare-kv-binding config in production and prefixed every key with `.data/kv:`,
		// which hid all existing settings and analytics. Only override it for a scoped test dir.
		kv: process.env.NUXTPRESS_DATA_DIR ? { base: `${process.env.NUXTPRESS_DATA_DIR}/kv` } : true,
		blob: true,
		db: 'sqlite'
	},
	hooks: {
		// pins the archive routes to real years so the root-level /:slug post route can coexist
		// with /:year instead of one permanently shadowing the other
		'pages:extend'(pages) {
			for (const page of pages) {
				page.path = page.path.replace(/^\/:year\(\)/, '/:year(20\\d{2})');
			}
		},
		// the editor, settings and analytics chunks (tiptap, the emoji data, the charts) are only
		// reachable through lazy components, so readers should not prefetch them while idle
		'build:manifest'(manifest) {
			const reach = (roots: string[], seen = new Set<string>()) => {
				for (const key of roots) {
					if (seen.has(key) || !manifest[key]) continue;
					seen.add(key);
					reach(manifest[key].imports ?? [], seen);
				}
				return seen;
			};
			const needed = reach(
				Object.keys(manifest).filter((key) => manifest[key]?.isEntry || key.startsWith('pages/'))
			);
			const adminOnly = reach([
				'components/BlogForm.vue',
				'components/SettingsForm.vue',
				'components/AnalyticsDashboard.vue'
			]);
			for (const key of adminOnly) {
				if (needed.has(key)) continue;
				manifest[key]!.prefetch = false;
				manifest[key]!.preload = false;
			}
		}
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
		experimental: { tasks: true },
		scheduledTasks: { '*/5 * * * *': ['mail:drain'], '0 4 * * *': ['media:sweep'] },
		typescript: {
			tsConfig: {
				include: ['../src/types/**/*.d.ts']
			}
		},
		prerender: {
			// the sitemap is built from the posts table, so prerendering it would freeze the URL
			// list at build time and never list a post published after the deploy
			ignore: ['/api/**']
		},
		routeRules: {
			'/api/**': { prerender: false, cors: true },
			'/favicon.png': { headers: { 'Cache-Control': 'public, max-age=31536000' } },
			'/favicon.ico': { headers: { 'Cache-Control': 'public, max-age=31536000' } },
			'/thumbnails/**': { headers: { 'Cache-Control': 'public, max-age=86400' } },
			'/feed.xml': { headers: { 'Cache-Control': 'public, max-age=3600' } },
			'/sitemap.xml': { headers: { 'Cache-Control': 'public, max-age=3600' } }
		}
	},
	modules: [
		'@nuxthub/core',
		'nuxt-auth-utils',
		'@nuxt/ui',
		'nuxt-viewport',
		'@nuxtjs/robots',
		'@nuxtjs/sitemap',
		'nuxt-schema-org',
		'@nuxt/image',
		'@nuxt/hints',
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
		],
		[
			'@codecov/nuxt-plugin',
			{
				enableBundleAnalysis: process.env.CODECOV_TOKEN !== undefined,
				bundleName: 'nuxtpress',
				uploadToken: process.env.CODECOV_TOKEN
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
	},
	experimental: {
		renderJsonPayloads: true,
		viewTransition: true
	}
});
