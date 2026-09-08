# NuxtPress

NuxtPress is a Nuxt 4 blog app for Cloudflare Workers. Keep changes small, readable, and aligned with the existing Nuxt UI v4 design language.

## Project Map

- `src/pages/` - file-based routes, including the dated blog archive views under `src/pages/[year]/` and the slug-only post route `src/pages/[slug].vue`
- `src/components/` - reusable UI, forms, modal content, and navigation
- `src/composables/` - shared client and data helpers such as blog, auth, markdown, and extensions utilities
- `src/server/api/` - HTTP endpoints for auth, settings, and blog CRUD
- `src/server/db/schema.ts` - Drizzle schema for the `blog_posts` table
- `src/server/utils/` - server-side helpers: auth/session, DB setup, post queries and caching (`posts.ts`), analytics rollups (`analytics.ts`), UA and geo classification (`ua.ts`)
- `src/shared/` - Zod schemas and shared TypeScript types
- `migrations/` - manual SQL migrations and one-off maintenance scripts
- `public/` - static assets served as-is
- `tests/` - Playwright specs, one file per page or API area, plus `tests/utils/` helpers
- `scripts/` - one-off maintenance scripts

## Common Commands

- `bun run dev` - start the app on port 8787
- `bun run dev:test` - start the app with the test env file
- `bun run dev:setup-test` - start a second server on 8788 against a wiped `.data-setup-test`, used by the setup-flow spec
- `bun run dev:cloudflare` - build and run with Wrangler locally
- `bun run build` - production build
- `bun run prettier` - format the repo
- `bun run prettier:check` - check formatting without writing
- `bun run test` - Playwright suite; `bun run test:coverage` adds V8 coverage
- `bunx vue-tsc -b --force` - typecheck app, server and shared projects (plain `-p tsconfig.json` checks nothing, the root config is references-only)
- `bunx wrangler d1 execute DB --file "migrations/migrate_timestamps.sql"` - run the legacy timestamp fix against D1

## Standards

- Use tabs and keep line width within the existing Prettier settings.
- Prefer Bun and the existing package scripts over ad hoc commands.
- Keep edits local to the owning layer: page logic in pages, shared validation in `src/shared/`, persistence in `src/server/`, and presentational code in `src/components/`.
- Update Drizzle schema and migrations together when changing database structure.
- Preserve the current Nuxt UI component patterns and avoid unnecessary refactors.

## Cloudflare And Runtime Notes

- This app targets Cloudflare Workers in production, so avoid Node-only assumptions when editing server code.
- Do not initialize DB or KV work in Nitro plugin global scope; keep async setup inside request handling.
- For the RSS feed route, generate escaped XML strings instead of relying on `xmlbuilder2` DOM APIs.
- Use `TextEncoder` byte lengths for runtime-safe `Content-Length` values.
- If you touch auth or sessions, check the cookie flow in `src/server/utils.ts` and the related login/logout/verify routes.

## Working Workflow

1. Inspect the nearest owning file and the surrounding implementation before changing behavior.
2. Make the smallest focused edit that satisfies the request.
3. Validate with `bun run prettier:check`; run `bun run build` for server, routing, or deployment-sensitive changes.
4. If a change affects deployment or data shape, confirm the matching Cloudflare and D1 configuration paths.
5. Composables that call `useState`, `useRuntimeConfig`, `useHead` or friends must run before the first `await` in a plain async composable, or inside `nuxtApp.runWithContext()`. Only an `await` written directly in a component's `setup` gets its Nuxt context restored.

## Project Conventions

- `src/pages/index.vue` is the blog home and `src/layouts/default.vue` owns the site shell.
- Settings and metadata flow through runtime config and the settings API, so keep public config keys and UI labels in sync.
- Playwright is the test suite (`tests/`). The `setup-flow` project runs against its own server and data dir because completing setup is a one-way transition; every other spec runs against the shared `dev:test` server.
- Posts answer on both `/{year}/{month}/{day}/{slug}` and `/{slug}`. Neither 404s; the `urlStyle` KV setting only decides which one is rendered and canonical. Keep link generation going through `usePostUrl()` / `postPath()` so the feed, sitemap and UI agree.
- `/api/blog/list` returns summaries without post bodies. Anything needing full content uses `/api/blog/find` or `listFullPosts()`; putting the list in an SSR-rendered component's payload is what made every page heavy before v1.4.
- Analytics folds beacons per visit (`vsid`), so a heartbeat must never be counted as another view. Long ranges read monthly rollups to stay inside the Worker subrequest budget.
