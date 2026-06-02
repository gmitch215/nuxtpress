# NuxtPress

NuxtPress is a Nuxt 4 blog app for Cloudflare Workers. Keep changes small, readable, and aligned with the existing Nuxt UI v4 design language.

## Project Map

- `src/pages/` - file-based routes, including the dated blog archive views under `src/pages/[year]/`
- `src/components/` - reusable UI, forms, modal content, and navigation
- `src/composables/` - shared client and data helpers such as blog, auth, markdown, and extensions utilities
- `src/server/api/` - HTTP endpoints for auth, settings, and blog CRUD
- `src/server/db/schema.ts` - Drizzle schema for the `blog_posts` table
- `src/server/utils.ts` - server-side auth/session helpers and legacy DB setup notes
- `src/shared/` - Zod schemas and shared TypeScript types
- `migrations/` - manual SQL migrations and one-off maintenance scripts
- `public/` - static assets served as-is

## Common Commands

- `bun run dev` - start the app on port 8787
- `bun run dev:test` - start the app with the test env file
- `bun run dev:cloudflare` - build and run with Wrangler locally
- `bun run build` - production build
- `bun run prettier` - format the repo
- `bun run prettier:check` - check formatting without writing
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

## Project Conventions

- `src/pages/index.vue` is the blog home and `src/layouts/default.vue` owns the site shell.
- Settings and metadata flow through runtime config and the settings API, so keep public config keys and UI labels in sync.
- The repository has no dedicated test suite, so formatting and production build checks are the primary validation steps.
