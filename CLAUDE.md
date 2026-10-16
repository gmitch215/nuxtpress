# NuxtPress

NuxtPress is a Nuxt 4 blog app for Cloudflare Workers. Keep changes small, readable, and aligned with the existing Nuxt UI v4 design language.

## Project Map

- `src/pages/` - file-based routes, including the dated blog archive views under `src/pages/[year]/` and the slug-only post route `src/pages/[slug].vue`
- `src/components/` - reusable UI, forms, modal content, and navigation
- `src/composables/` - shared client and data helpers such as blog, auth, markdown, and extensions utilities
- `src/server/api/` - HTTP endpoints for auth, settings, and blog CRUD
- `src/server/db/schema.ts` - Drizzle schema for the `blog_posts` table
- `src/server/utils/` - server-side helpers: auth/session, DB setup, post queries and caching (`posts.ts`), analytics rollups (`analytics.ts`), UA and geo classification (`ua.ts`), mail transports and settings (`mail.ts`), subscribers and the send queue (`subscribers.ts`), sealing and signed links (`secrets.ts`)
- `src/server/tasks/` - Nitro scheduled tasks; `mail/drain.ts` sends the email queue (cron in `wrangler.jsonc` and `scheduledTasks` in `nuxt.config.ts`)
- `src/shared/` - Zod schemas and shared TypeScript types
- `migrations/` - manual SQL migrations and one-off maintenance scripts
- `public/` - static assets served as-is
- `tests/` - Playwright specs, one file per page or API area, plus `tests/utils/` helpers
- `scripts/` - one-off maintenance scripts

## Common Commands

- `bun run dev` - start the app on port 8787
- `bun run dev:test` - start the app with the test env file against a wiped `.data-test`, so a run never sees an earlier run's posts or analytics and never touches `.data`
- `bun run dev:setup-test` - start a second server on 8788 against a wiped `.data-setup-test`, used by the setup-flow spec
- `bun run dev:cloudflare` - build and run with Wrangler locally
- `bun run build` - production build
- `bun run prettier` - format the repo
- `bun run prettier:check` - check formatting without writing
- `bun run test` - Playwright suite; `bun run test:coverage` adds V8 coverage
- `bun run test:coverage` then `bun run coverage:server` - client coverage in `coverage/lcov.info`, server coverage in `coverage/server/lcov.info`
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
- Mail is optional. `mailActive(env)` gates every public path; `/api/settings` exposes it as `subscriptions`. `env` is `event.context.cloudflare.env` (`cloudflareEnv(event)`), and scheduled tasks get it from the task context, because the `EMAIL` binding is not on `process.env`.
- `edgeport/smtp` imports `cloudflare:sockets`, so it is loaded with a dynamic `import()` only on the SMTP path. It cannot run under `nuxi dev`; the test lane sets `NUXTPRESS_MAIL_SINK=1`, which records what each transport would send instead of sending it.
- Mail credentials are sealed with a key derived from the session secret (`secrets.ts`). Never return them from an API, and keep a blank secret field meaning "keep the stored value".
- Uploaded images are `data:` URLs capped by `INLINE_IMAGE_MAX_CHARS` in `src/shared/images.ts`. Public payloads must point at `/thumbnails/{id}` or `/favicon.png` (`publicThumbnailUrl()`, `publicIconPath()`), never inline the data URL.
- Reserved slugs (`RESERVED_SLUGS` in `src/shared/schemas.ts`) are the top-level routes; add a name there when adding a page at `/{name}`.
- Email links take their origin from `siteOrigin()` (config, or the origin an admin request stored). Never derive it from a visitor's `Host` header; `rememberOrigin()` is for admin routes only.
- Post types live in `blog_posts.type` plus a `media` JSON column. `src/shared/media.ts` holds the caps and mime allowlists and `checkPostRules` in `src/shared/schemas.ts` the per-type rules. A slideshow's `content` is derived from its captions (`contentFromMedia`) so search, excerpts, the feed and SEO need no per-type branches. The type cannot change after creation.
- Media is served by `src/server/routes/media/[...key].get.ts`, not `blob.serve`, which buffers the whole object. Uploads stream: R2 only accepts a stream of known length, so `upload.put.ts` pipes the body through a `FixedLengthStream`; the dev filesystem driver does not need that and hides the failure, so check media changes under `wrangler dev --local` too. `mediaAvailable()` gates every media route, and `/api/settings.media` hides the editor modes when the `BLOB` binding is missing.
- `resolveMedia` reads mime and size back from storage and checks ownership; never trust the form. Add a type to the sweep's reference scan (`referencedMediaKeys`) when a new column can point at `media/` keys.
- `/media` is a reserved slug, and the Worker needs the `BLOB` r2 binding (avatars use it as well).
- A raw `db.run` result carries `rows` under libsql (dev) and `results` under D1 (production). Read both through `rowsOf()` in `src/shared/rows.ts`; reading only `rows` made `userCount()` 0 and `columnExists()` false under D1 (seen on `wrangler dev --local`), which re-ran every migration on each cold start and left the `/api/setup/init` count check unable to fire, with only username uniqueness behind it. The setup insert is also conditional (`WHERE NOT EXISTS`), so a concurrent second setup inserts nothing.
- Markdown renders through the single `Marked` instance in `src/shared/markdown.ts`, shared by the post page and the feed. Never call `marked.use()` per render: it chains the extension again each time, and render time grew from 5 ms to 58 ms per post after 3,000 renders in one isolate. Highlight languages live in `src/shared/highlight.ts` (the full highlight.js build is 1.1 MB). The emoji dataset is about 800 KB, so `prepareMarkdown()` loads it only for posts containing a `:shortcode:`; `useBlogPostPage` awaits it so server and client render the same HTML.
- On the home page the editor, settings form and analytics dashboard are `Lazy` components. Importing them eagerly makes every reader preload tiptap, the emoji data and the charts library; the dev server cannot show this, only the production build's `modulepreload` list can.
- `POST /api/settings` checks every field before the first write and rejects non-text values, so a 400 never leaves a half-saved form. Slugs that cannot exist (`SLUG_RE`) are a 404 before they reach a KV key.
- Post HTML goes through the one string sanitizer in `src/shared/sanitize.ts`, on the server and the client, and the Atom feed uses it too. It rebuilds allowlisted tags from a strict grammar and escapes whatever it cannot parse. The earlier server path was a regex chain that let `<img/src=x/onerror=...>` and an unclosed `<script src=...>` through into the server-rendered page. Do not add a regex pass or a DOM-only path beside it.
- Drafts stay in one KV namespace (`nuxtpress:blog_draft:{slug}`) but record `authorId` from the session. `draftAccess()` in `src/server/utils/drafts.ts` gates list, open and overwrite on it; a draft with no `authorId` belongs to `firstAdminId()`, the earliest-created administrator. Never read the owner from the request body.
- `GET /api/admin/subscribers/export` streams pages keyed on the primary key (`exportSubscriberPages`, page size `mail.exportPageSize`). The old version held about 1.1 KB of heap per subscriber, which breaks a 128 MB Worker near 100,000 rows. The test lane sets `NUXT_MAIL_EXPORT_PAGE_SIZE=2` so a few rows cross page boundaries.
- Import third-party CSS into `prose.scss` with `@include meta.load-css(...)`, never `@import 'x.css' layer(...)`: Sass leaves that as a runtime import, which 404s in production (code blocks had no colors there). `scripts/check-build-output.mjs` fails the build if a built stylesheet still imports anything.
- `nuxt.config.ts` has a `build:manifest` hook that stops readers prefetching the chunks only the lazy admin components reach. Add a component to its list when it should not be prefetched.
- `@nuxtjs/robots` 7, `@nuxtjs/sitemap` 9 and `nuxt-schema-org` 7 need Nuxt 4.6 and Node 22.22.3, 24.15 or 26, and pull in Site Config 5. None of their removed surfaces are used here (no `#robots`, `#sitemap` or `#schema-org` imports, no robots or sitemap hooks, and the sitemap source is a plain event handler). schema-org 7 strips `useSchemaOrg` and the `define*()` helpers from the production client, so the JSON-LD graph comes from the server render only and is not extended on client-side navigation; set `schemaOrg.reactive: true` if that ever matters.
- TypeScript stays pinned to 5.9.3 in `overrides`. `vue-tsc` 3.3.13 crashes on TypeScript 7.0.2 (`Package subpath './lib/tsc' is not defined by "exports"`); retest when `vue-tsc` supports 7.1.
- `formatDate` formats in UTC. The server renders post dates and the browser hydrates them, so a local-time format flipped the date and logged a hydration mismatch for every visitor west of UTC during the hours when UTC is already tomorrow. It matches the UTC dated permalinks.
- To run the suite while something else holds port 8787, start your own server (`NUXTPRESS_DATA_DIR=.data-test bunx nuxi dev --no-restart --public --port 8791 --dotenv .config/test.env`), wait until `/api/settings` returns 200, and set `PLAYWRIGHT_BASE_URL=http://127.0.0.1:8791`. Playwright reuses a server only when its URL answers below 400; otherwise it runs `dev:test`, which wipes `.data-test`. Specs take their origin from `baseURL`, never a literal port.
- Under `COVERAGE=1` each error the dev server handles costs seconds (Nitro's dev error handler builds a `SourceMapConsumer` of the whole bundle per error and never frees it), so a spec that provokes many errors belongs at the API level, not through page navigations.
