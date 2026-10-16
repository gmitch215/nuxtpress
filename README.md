# NuxtPress

> Modern, fast, and beautiful blog software powered by Nuxt UI v4 and Cloudflare Workers

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/gmitch215/nuxtpress)

---

## Table of Contents

- [For Everyone: Getting Started](#for-everyone-getting-started)
  - [What is NuxtPress?](#what-is-nuxtpress)
  - [Deploy Your Own Blog](#deploy-your-own-blog)
  - [Configuration](#configuration)
  - [Installing Updates](#installing-updates-from-the-template)
  - [Using Your Blog](#using-your-blog)
  - [Post URLs](#post-urls)
  - [Post Types](#post-types)
  - [Images](#images)
  - [Email Subscribers](#email-subscribers)
  - [Analytics](#analytics)
- [For Developers: Technical Documentation](#for-developers-technical-documentation)
  - [Overview](#overview)
  - [Tech Stack](#tech-stack)
  - [Local Development](#local-development)
  - [Project Structure](#project-structure)
  - [API Documentation](#api-documentation)
  - [Database Schema](#database-schema)
  - [Contributing](#contributing)
  - [License](#license)

---

## For Everyone: Getting Started

### What is NuxtPress?

NuxtPress is a modern blogging platform that's:

- **Fast**: Server-rendered on Cloudflare's edge network
- **Simple**: One Worker, a D1 database, KV namespaces and an R2 bucket
- **Secure**: User accounts with administrator and author roles, sealed session cookies
- **Findable**: Canonical URLs, an Atom feed, and a sitemap that lists every post
- **Free**: Runs on Cloudflare's free tier

### Deploy Your Own Blog

#### Option 1: Deploy to Cloudflare

1. Click the "Deploy to Cloudflare" button above
2. Connect your GitHub account and let Cloudflare fork the repository
3. Cloudflare provisions the Worker, the D1 database, the KV namespaces and the R2 bucket from `wrangler.jsonc`
4. Set `NUXT_SESSION_PASSWORD` and `NUXT_ANALYTICS_SALT` (see below), then redeploy
5. Open your blog and create the first administrator at `/setup`

#### Option 2: Deploy With Wrangler

```bash
git clone https://github.com/gmitch215/nuxtpress.git
cd nuxtpress
bun install
bun run build
bunx wrangler --cwd .output deploy
```

The build targets Cloudflare Workers, so the whole app deploys as one Worker. Do not deploy
`.output/public` on its own; that directory holds only the static assets and none of the server.

#### Option 3: Workers Builds

Connect the repository in [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
and Cloudflare rebuilds and redeploys on every push to `master`.

### Configuration

After deployment, you'll need to configure your blog through environment variables:

#### Required Settings

| Variable                | Description                                       | Required           |
| ----------------------- | ------------------------------------------------- | ------------------ |
| `NUXT_SESSION_PASSWORD` | 32+ char secret used to seal session cookies      | **yes** (prod)     |
| `NUXT_ANALYTICS_SALT`   | Random secret used to derive daily visitor hashes | yes for analytics  |
| `NUXT_PASSWORD`         | Bootstrap password for a seeded `admin` account   | **no** since 1.3.0 |

Generate `NUXT_SESSION_PASSWORD` with: `openssl rand -base64 48`.

#### First-run setup

When you deploy for the first time, NuxtPress detects that no users exist in the database and redirects every visitor to **`/setup`**, an onboarding screen where you create the first administrator account (username, display name, password, optional bio). After that, log in normally with those credentials.

##### Optional: `NUXT_PASSWORD`

`NUXT_PASSWORD` is not required. If you do set it:

- On a brand-new install, the migration seeds a user named `admin` (display name **Team**) with that password, so you can log in immediately without visiting `/setup`.
- The admin account's password is **locked** while `NUXT_PASSWORD` is set. You cannot change it from the profile or admin user UI. Remove the env var and redeploy to manage the password from the app.

As of v1.4.0 the password only works because it is stored as a normal password hash on that seeded account. The env variable is no longer accepted as a login credential on its own, and `/api/login` requires both a username and a password. Treat `NUXT_PASSWORD` as a one-time bootstrap helper; the long-term flow is `/setup` plus the user-management UI.

#### Optional Settings

These can be configured via environment variables or through the admin panel after logging in:

| Variable                    | Description            | Default                       |
| --------------------------- | ---------------------- | ----------------------------- |
| `NUXT_PUBLIC_SITE_URL`      | Your blog's public URL | `https://nuxtpress.pages.dev` |
| `NUXT_PUBLIC_NAME`          | Your blog name         | `NuxtPress`                   |
| `NUXT_PUBLIC_DESCRIPTION`   | Blog description       | `My NuxtPress blog`           |
| `NUXT_PUBLIC_AUTHOR`        | Author name            | `Gregory Mitchell`            |
| `NUXT_PUBLIC_THEME_COLOR`   | Theme color (hex)      | `#1e40af`                     |
| `NUXT_PUBLIC_FAVICON`       | Favicon URL            | `/_favicon.ico`               |
| `NUXT_PUBLIC_FAVICON_PNG`   | PNG favicon URL        | `/_favicon.png`               |
| `NUXT_PUBLIC_GITHUB`        | GitHub profile URL     | _(empty)_                     |
| `NUXT_PUBLIC_INSTAGRAM`     | Instagram profile URL  | _(empty)_                     |
| `NUXT_PUBLIC_TWITTER`       | Twitter/X profile URL  | _(empty)_                     |
| `NUXT_PUBLIC_PATREON`       | Patreon profile URL    | _(empty)_                     |
| `NUXT_PUBLIC_LINKEDIN`      | LinkedIn profile URL   | _(empty)_                     |
| `NUXT_PUBLIC_DISCORD`       | Discord server URL     | _(empty)_                     |
| `NUXT_PUBLIC_SUPPORT_EMAIL` | Support email address  | _(empty)_                     |

**How to set environment variables:**

Plain values go in the Cloudflare dashboard under Workers & Pages → your Worker → Settings →
Variables. Secrets are better set from the CLI, which keeps them out of the dashboard's plaintext
list:

```bash
bunx wrangler secret put NUXT_SESSION_PASSWORD
bunx wrangler secret put NUXT_ANALYTICS_SALT
```

### Installing updates from the template

If you used this repository as a template and want to pull updates from the original template repository, you can add the template as a remote and merge updates into your repository. The following snippet shows the minimal commands you may use.

```bash
# one time
git remote add template https://github.com/gmitch215/nuxtpress

# to install an update
git switch master
git fetch --all
git merge template --allow-unrelated-histories -m "chore: merge upstream"
```

Notes:

- The first `git remote add` only needs to be run once per cloned repository.
- Switch to the branch you want to update (here `master`) before merging.
- `--allow-unrelated-histories` is included to allow merging between repositories that do not share history; resolve conflicts if they appear.
- Always create a local backup branch before merging so you can recover easily if something goes wrong:

```bash
git switch -c before-template-merge
```

Examples for targeting a specific branch, tag, or commit

- Merge a specific branch from the template (e.g. `experimental`):

```bash
git fetch template
git switch master
git merge template/experimental --allow-unrelated-histories -m "chore: merge template/experimental"
```

- Merge a specific tag from the template (e.g. `v1.0.2`):

```bash
git fetch --tags template
git switch master
git merge v1.0.2 --allow-unrelated-histories -m "chore: merge template v1.0.2"
```

If you prefer to create a local branch that mirrors the tagged state, you can do:

```bash
git fetch --tags template
git checkout -b update-v1.0.2 v1.0.2
# Inspect changes, then merge into master if desired
git switch master
git merge update-v1.0.2
```

- Apply a single commit from the template (e.g. `ab12ef3`):

```bash
git fetch template
git switch master
git cherry-pick ab12ef3
```

Alternatives and safety tips:

- Instead of merging directly into `master`, consider creating a temporary update branch (`git switch -c update-from-template`) and test there before merging to your main branch.
- If the template remote is updated frequently, run `git fetch template` to refresh refs before merging.
- If you encounter conflicts, resolve them and then `git commit` to complete the merge.

### Using Your Blog

#### Logging In

1. Open your blog and click "Log In"
2. Enter the username and password of the account you created at `/setup`

Administrators can add more accounts at `/admin/users`, as either administrators or authors. An
author can write and edit their own posts; an administrator can also manage users and settings.

#### Creating a Blog Post

1. Log in, then click "New Post" on the home page
2. Fill in:
   - **Title**: Your post title
   - **Slug**: URL segment, generated from the title and editable. It must be unique across the blog
   - **Content**: Markdown, with a rich-text editor and a live preview
   - **Tags**: Comma-separated tags
   - **Thumbnail** (optional): Upload an image or point at an external URL
   - **Email Subscribers**: Appears when email delivery is configured; see [Email Subscribers](#email-subscribers)
3. Click "Publish"

Drafts save as you type and reappear in the form the next time you open it.

Fenced code blocks are highlighted for the 36 languages in highlight.js's common set plus Clojure, Dart, Dockerfile, Elixir, Gradle, Groovy, Haskell, Julia, LaTeX, Nginx, Nix, OCaml, PowerShell, Protocol Buffers, Scala and Vim. Any other language renders as plain text. Emoji shortcodes such as `:tada:` render as emoji.

#### Managing Posts

- **Edit**: Open a post while logged in and click the pencil next to the title
- **Delete**: Open a post and click the bin next to the title
- **View**: Every post is listed on the home page, with archives by year, month and day

#### Customizing Settings

1. Log in, then click the settings icon on the home page
2. Update the blog name, description, author, theme color, favicons, social links, post URL style,
   and the optional site-wide banner message
3. Settings save to KV and take effect immediately

#### Post URLs

Every post answers on two URLs:

- `/2026/9/8/my-post` — the dated permalink
- `/my-post` — the slug on its own

Both always return the post. The **Post URL Style** setting picks which one the blog links to and which one search engines treat as canonical; the other keeps working instead of returning a 404, so existing links never break. The default is the dated form.

Slugs have to be unique across the whole blog, because a slug addresses a post on its own. Creating or renaming a post to a slug that is already taken returns a 409.

#### Post Types

A post is an article by default. When the R2 bucket is bound, the New Post window shows a switcher on the left of the button row with three more types:

| Type      | What you add                                                      |
| --------- | ----------------------------------------------------------------- |
| Slideshow | Up to 30 images, each with an optional caption, reorderable       |
| Video     | One MP4 or WebM file and an optional caption                      |
| Music     | One MP3, M4A, OGG, WAV, WebM or FLAC file and an optional caption |

- Each type keeps what you entered while the window is open, so switching never discards work. The title, slug, tags and thumbnail are shared.
- Files upload as soon as you choose them and are attached when you press Create Post. A saved post keeps its type; you can replace its files but not convert it.
- Images are shrunk to at most 2000 pixels and re-encoded as WebP in the browser. GIFs are not re-encoded. An image can be up to 25 MB and a video or music file up to 100 MB.
- The thumbnail defaults to the first slide, or to a frame the browser captures from the video. Choosing a thumbnail yourself overrides it. Music uses the thumbnail as cover art.
- Readers get a slideshow with arrows, dots, keyboard and swipe, or a video or audio player. The home page, archives and tag pages mark the type on each card.
- Slideshow captions become the post's text, so search, excerpts, the feed and subscriber emails use them. The Atom feed adds an enclosure for video and music, and the sitemap lists slides and videos.
- Uploads that no post or draft references are deleted by a daily task once they are a day old. Deleting a post deletes its files.

#### Images

The editor's image button takes a URL. The upload button next to it, pasting an image, and dropping
an image onto the editor all embed the file in the post as a `data:` URL, so no storage bucket is
involved.

- PNG, JPEG, WebP and GIF are accepted. SVG is not.
- Photos are scaled to at most 1600 pixels and re-encoded as WebP in the browser. Each image has to fit in about 250 KB once encoded; GIFs are not re-encoded, so an animated GIF over that size is rejected.
- The post body is limited to 500,000 characters, which includes its images.
- Thumbnails and favicons use the same upload path. An uploaded thumbnail is served from `/thumbnails/{id}` and an uploaded favicon from `/favicon.png` or `/favicon.ico`, so neither is copied into page payloads.
- The Atom feed leaves inline images out of entries, and subscriber emails link the thumbnail instead of embedding it.

#### Scheduled Tasks

| Task          | Schedule           | What it does                                     |
| ------------- | ------------------ | ------------------------------------------------ |
| `mail:drain`  | every 5 minutes    | Sends queued subscriber emails                   |
| `media:sweep` | daily at 04:00 UTC | Deletes uploads that no post or draft references |

Each run is one Worker request. With nothing queued, a `mail:drain` run reads at most one indexed row, so the five-minute schedule stays far inside the free plan's request and D1 limits. Both entries live in `wrangler.jsonc` and `nuxt.config.ts`.

#### Email Subscribers

Readers can subscribe to get an email when you publish a post. The feature is off until email delivery is configured, and the subscribe form only appears once it is.

Open `/admin/subscribers` as an administrator to configure delivery, send a test email, see the queue, and manage the list. Pick one transport:

| Transport                | What it needs                                                                      |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Cloudflare Email Binding | A `send_email` binding named `EMAIL` (in `wrangler.jsonc`) and an onboarded domain |
| Cloudflare Email API     | A Cloudflare account ID and an API token with permission to send email             |
| Custom SMTP              | Host, port, security (STARTTLS, implicit TLS or none), and optional login          |

The From address has to belong to a domain your transport is allowed to send for. API tokens and SMTP passwords are encrypted with a key derived from `NUXT_SESSION_PASSWORD` before they reach KV and are never returned by the API. Changing `NUXT_SESSION_PASSWORD` makes saved credentials unreadable, so enter them again, and invalidates confirmation and unsubscribe links already sent.

Delivery can also be set with environment variables, which take precedence over the form. Setting `NUXT_MAIL_SMTP_HOST` selects SMTP; otherwise `NUXT_MAIL_CF_ACCOUNT_ID` with `NUXT_MAIL_CF_API_TOKEN` selects the Cloudflare API.

| Variable                                            | Description                         |
| --------------------------------------------------- | ----------------------------------- |
| `NUXT_MAIL_FROM`                                    | From address                        |
| `NUXT_MAIL_SMTP_HOST`, `NUXT_MAIL_SMTP_PORT`        | SMTP server, port defaults to `587` |
| `NUXT_MAIL_SMTP_TLS`                                | `starttls`, `implicit` or `off`     |
| `NUXT_MAIL_SMTP_USER`, `NUXT_MAIL_SMTP_PASS`        | SMTP login                          |
| `NUXT_MAIL_CF_ACCOUNT_ID`, `NUXT_MAIL_CF_API_TOKEN` | Cloudflare Email API credentials    |

How it works:

- A visitor enters an address and gets a confirmation email. The address only becomes a subscriber after they open the link and press the confirm button.
- Every email has an unsubscribe link and `List-Unsubscribe` headers, so mail clients can show their own unsubscribe button. Unsubscribing deletes the address.
- Each client address can request one confirmation a minute, and an unconfirmed address is not mailed again for ten minutes.
- When you create a post with **Email Subscribers** checked, one email per confirmed subscriber is queued. The checkbox is not shown when editing, so an edit never sends again.
- A scheduled task sends the queue every five minutes, 25 emails per run. A failed email is retried twice before it is marked failed. **Send Queue Now** on the admin page runs the same step.
- The email carries the title, thumbnail, a short excerpt and a link to the post.
- Links in emails use `NUXT_PUBLIC_SITE_URL`, or the origin of the administrator's last save on `/admin/subscribers` when that variable is unset. Request headers from visitors are never used, and the subscribe form returns a 503 until one of the two exists.

#### Analytics

The dashboard behind the chart icon reports views, unique visitors, active reading time, scroll completion, top posts, top pages, referrers, countries, operating systems, devices, browsers, and the signed-in share of traffic.

Visitors are counted with a salted SHA-256 hash of IP address and user agent that rotates every day, so the same person is one visitor within a day and unlinkable across days. What is never stored: IP addresses, user agents, account identities, and anything more precise than a two-letter country code. Requests carrying `DNT: 1` or `Sec-GPC: 1` are dropped before anything is written, as are known crawlers. Set `NUXT_ANALYTICS_SALT` to a random value so the hashes cannot be reproduced from a leaked database.

---

## For Developers: Technical Documentation

### Overview

NuxtPress is a full-stack blogging platform built with:

- **Frontend**: Nuxt 4 with Vue 3, Nuxt UI v4, and Tailwind CSS
- **Backend**: Nitro server routes running on Cloudflare Workers
- **Database**: Cloudflare D1 through Drizzle ORM
- **Storage**: Cloudflare KV for settings, caches and analytics; R2 for avatars and post media
- **Auth**: `nuxt-auth-utils` sealed session cookies, validated against the users table per request
- **Validation**: Zod schemas shared between client and server
- **Deployment**: One Cloudflare Worker, deployed with Wrangler or Workers Builds

### Tech Stack

- **[Nuxt 4](https://nuxt.com/)**: Vue framework, server-rendered
- **[Nuxt UI v4](https://ui.nuxt.com/)**: Component library
- **[@nuxthub/core](https://hub.nuxt.com/)**: D1, KV and blob bindings, with local equivalents for `nuxt dev`
- **[Drizzle ORM](https://orm.drizzle.team/)**: Typed SQL against D1
- **[nuxt-auth-utils](https://github.com/atinux/nuxt-auth-utils)**: Sealed session cookies and password hashing
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)**: SQLite on the edge
- **[Cloudflare KV](https://developers.cloudflare.com/kv/)**: Key-value storage
- **[Zod](https://zod.dev/)**: Schema validation
- **[marked](https://marked.js.org/)** + **[highlight.js](https://highlightjs.org/)**: Markdown rendering and syntax highlighting
- **[TipTap](https://tiptap.dev/)**: Rich-text editing in the post form
- **[unovis](https://unovis.dev/)**: Analytics charts
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Utility-first CSS
- **[Playwright](https://playwright.dev/)**: End-to-end tests

### Local Development

#### Prerequisites

- [Bun](https://bun.sh/), or Node.js 22.22.3+ (Nuxt 4.6 and its SEO modules require 22.22.3, 24.15, or 26 and up)
- A Cloudflare account, for deployment only. Local development needs no Cloudflare resources

#### Setup

1. Clone the repository:

   ```bash
   git clone https://github.com/gmitch215/nuxtpress.git
   cd nuxtpress
   ```

2. Install dependencies:

   ```bash
   bun install
   ```

3. Create a `.env` with a session secret. Everything else has a working default:

   ```bash
   printf 'NUXT_SESSION_PASSWORD=%s\nNUXT_ANALYTICS_SALT=%s\n' \
     "$(openssl rand -base64 48)" "$(openssl rand -hex 16)" > .env
   ```

   See [Configuration](#configuration) for the full list.

   Edit `.env` and set your `NUXT_PASSWORD` and other configuration.

4. Run the development server:

   ```bash
   bun run dev
   ```

5. Open [http://localhost:8787](http://localhost:8787)

#### Available Scripts

- `bun run dev` - Start the development server on port 8787
- `bun run dev:test` - Start the dev server with the test environment file and an empty `.data-test` directory
- `bun run dev:cloudflare` - Build, then serve the Worker locally through Wrangler
- `bun run dev:setup-test` - Start a second dev server on port 8788 against an empty data directory, used by the first-run setup spec
- `bun run build` - Build for production
- `bun run test` - Run the Playwright suite
- `bun run test:headed` - Run the suite with a visible browser
- `bun run test:coverage` - Run the suite with client and server V8 coverage
- `bun run coverage:server` - After `test:coverage`, write server coverage to `coverage/server/lcov.info`
- `bun run test:report` - Open the last HTML test report
- `bun run prettier` - Format code with Prettier
- `bun run prettier:check` - Check code formatting

#### Migrating an Older Deployment

NuxtHub's own hosting platform was sunset on 31 December 2025. NuxtPress still uses
`@nuxthub/core` for its D1, KV and blob bindings, but deployment and hosting are now entirely
your own Cloudflare account. If you deployed an earlier NuxtPress through the NuxtHub dashboard,
the changes are:

- **Database**: Drizzle ORM, replacing `hubDatabase()`
- **Bindings**: declared in `wrangler.jsonc` rather than generated for you
- **Deployment**: Wrangler or Workers Builds

##### Link Your Existing Cloudflare Resources

Create a `wrangler.jsonc` file in your project root to link your existing D1 database and KV namespaces:

```jsonc
{
	"$schema": "node_modules/wrangler/config-schema.json",
	"d1_databases": [
		{
			"binding": "DB",
			"database_name": "your-database-name",
			"database_id": "your-database-id"
		}
	],
	"kv_namespaces": [
		{
			"binding": "KV",
			"id": "your-kv-namespace-id"
		},
		{
			"binding": "CACHE",
			"id": "your-cache-namespace-id"
		}
	]
}
```

Find your resource IDs in the [Cloudflare Dashboard](https://dash.cloudflare.com/):

- **D1 Database ID**: Workers & Pages → D1 → Your Database
- **KV Namespace IDs**: Workers & Pages → KV → Your Namespaces

##### Database Migration

The database migration happens automatically on the first request after deployment:

1. Creates the `blog_posts` table if it doesn't exist
2. Detects old timestamp format (seconds vs milliseconds)
3. Converts timestamps automatically if needed
4. Creates indexes

If you notice that your timestamps are incorrect after migration, you can manually run the provided SQL script `migrations/migrate_timestamps.sql` against your D1 database using the Cloudflare Dashboard's D1 query interface.

```bash
# test locally first - then use '--remote' for Cloudflare
bunx wrangler d1 execute DB --file "migrations/migrate_timestamps.sql"
```

##### Deploy

Use Cloudflare's deployment tools:

**Via Workers Builds**:

- Connect your Git repository in [Workers & Pages](https://dash.cloudflare.com/?to=/:account/workers-and-pages)
- Automatic deployments on every push

**Or via Wrangler CLI**:

```bash
bun run build
bunx wrangler --cwd .output deploy
```

Set environment variables in the Cloudflare dashboard under Workers & Pages → your Worker →
Settings → Variables, and set secrets with `bunx wrangler secret put <NAME>`.

### Project Structure

```
nuxtpress/
├── src/
│   ├── app.vue                     # Root component: site-wide meta, canonical, schema.org
│   ├── error.vue                   # Error page
│   ├── assets/css/                 # Global styles and prose styles
│   ├── components/
│   │   ├── analytics/TopTable.vue  # Top posts / top pages table
│   │   ├── blog/Article.vue        # Post view, shared by both permalinks
│   │   ├── mail/Settings.vue       # Email delivery settings and queue
│   │   ├── media/                  # Slideshow and file editors, slideshow and player views
│   │   ├── subscribe/Form.vue      # Public subscribe form
│   │   ├── AnalyticsDashboard.vue  # Admin analytics modal
│   │   ├── BlogForm.vue            # Post create/edit form
│   │   ├── BlogPostGroup.vue       # Post listing
│   │   ├── SearchButton.vue        # Command-palette post search
│   │   └── SettingsForm.vue        # Site settings form
│   ├── composables/
│   │   ├── useAnalytics.ts         # Client beacon: active time, scroll depth
│   │   ├── useBlogPostPage.ts      # Loads and describes one post
│   │   ├── useBlogPostSeo.ts       # Article meta and structured data
│   │   ├── useCanonical.ts         # Site origin and rel=canonical
│   │   ├── useDatabase.ts          # Post list and settings state
│   │   ├── useInlineImage.ts       # Downscales uploaded images into data URLs
│   │   ├── usePostUrl.ts           # Permalink resolution
│   │   └── useSanitizeHtml.ts      # Markdown output sanitizer
│   ├── middleware/                 # Route guards: auth, admin, first-run setup
│   ├── pages/
│   │   ├── index.vue               # Home
│   │   ├── [slug].vue              # Slug-only permalink
│   │   ├── [year]/…/[slug].vue     # Dated permalink and date archives
│   │   ├── admin/users.vue         # User management
│   │   ├── admin/subscribers.vue   # Mail settings and subscriber list
│   │   ├── subscribe/confirm.vue   # Confirm a subscription
│   │   ├── unsubscribe.vue         # Unsubscribe
│   │   ├── authors/[username].vue  # Author profile
│   │   └── setup.vue               # First-run onboarding
│   ├── plugins/                    # Client plugins, including page-view tracking
│   ├── server/
│   │   ├── api/                    # Blog, auth, users, settings, analytics, sitemap
│   │   ├── db/schema.ts            # Drizzle schema
│   │   ├── middleware/             # Session bootstrap
│   │   ├── plugins/                # Session hooks
│   │   ├── routes/                 # feed.xml, favicons, avatars, thumbnails, media
│   │   ├── tasks/                  # mail/drain.ts (email queue), media/sweep.ts (unused uploads)
│   │   └── utils/                  # auth, db, posts, analytics, ua, mail, subscribers, secrets
│   ├── shared/                     # Schemas, types, markdown and highlighting shared by client and server
│   └── types/                      # Session type augmentation
├── tests/                          # Playwright specs and helpers
├── scripts/                        # Maintenance scripts
├── migrations/                     # Manual SQL for older installs
├── public/                         # Static files
├── nuxt.config.ts
├── playwright.config.ts
├── wrangler.jsonc                  # D1, KV, R2 and email bindings, cron triggers
└── tsconfig.json
```

### API Documentation

All API routes are located in `src/server/api/` and are automatically available at `/api/*`.

#### Authentication

##### POST `/api/login`

Authenticate with a username and password. Both fields are required as of v1.4.0.

**Request Body:**

```json
{
	"username": "admin",
	"password": "your-password"
}
```

**Response:**

```json
{
	"ok": true
}
```

Sets a sealed, `HttpOnly`, `SameSite=Lax` session cookie, marked `Secure` in production. No
`Max-Age` is configured, so the cookie lasts until the browser session ends. The session payload
is re-validated against the users table on every request, so deactivating an account or changing
a role takes effect immediately rather than at the next login.

##### POST `/api/logout`

Invalidate the current session.

**Response:**

```json
{
	"ok": true
}
```

##### GET `/api/verify`

Check if the current session is valid.

**Response:**

```json
{
	"loggedIn": true
}
```

#### Settings

##### GET `/api/settings`

Get current blog settings (public endpoint).

**Response:**

```json
{
	"name": "My Blog",
	"description": "Blog description",
	"author": "Author Name",
	"themeColor": "#1e40af",
	"favicon": "/favicon.ico",
	"faviconPng": "/favicon.png",
	"github": "https://github.com/username",
	"twitter": "https://twitter.com/username",
	"instagram": "https://instagram.com/username",
	"patreon": "https://patreon.com/username",
	"linkedin": "https://linkedin.com/in/username",
	"discord": "https://discord.gg/server-invite",
	"supportEmail": "support@example.com"
}
```

##### POST `/api/settings`

Update blog settings (requires authentication).

**Request Body:** Same as GET response (partial updates supported)

**Response:** Updated settings object

#### Blog Posts

##### GET `/api/blog/list`

Get every blog post as a summary (public endpoint). Summaries carry a pre-rendered `excerpt`
instead of the full `content`, and thumbnails come back as a URL rather than inline base64, so
the response stays small as the blog grows. Use `/api/blog/find` for a single post's body.

**Response:**

```json
[
	{
		"id": "unique-id",
		"title": "Post Title",
		"slug": "post-slug",
		"excerpt": "First 200 characters of the post as plain text...",
		"thumbnail_url": "/thumbnails/unique-id",
		"created_at": "2025-11-17T00:00:00.000Z",
		"updated_at": "2025-11-17T00:00:00.000Z",
		"tags": ["tag1", "tag2"],
		"author_id": "author-id",
		"author": { "username": "admin", "displayName": "Team", "role": "administrator" }
	}
]
```

##### GET `/api/blog/search`

Search posts by title, body, tag or slug (public endpoint).

**Query Parameters:**

- `q` (required): search text, 1-200 characters. Anything else returns `[]`.

**Response:** Array of post summaries, same shape as list, capped at 25 results.

##### GET `/api/blog/find`

Find a single blog post, including its full `content`.

**Query Parameters:**

- `slug` (required): Post slug
- `year`, `month`, `day` (optional): pass all three to match a post published on that date. Omit
  them to get the newest post with that slug.

**Response:** Single blog post object with `content`

##### GET `/thumbnails/{id}`

Serve a post's stored thumbnail as an image, cached for a day. Posts with a `thumbnail_url` of
their own do not use this route.

##### POST `/api/blog/create`

Create a new blog post (requires authentication).

**Request Body:**

```json
{
	"post": {
		"title": "Post Title",
		"slug": "post-slug",
		"content": "Post content...",
		"thumbnail": "base64-encoded-image-data",
		"tags": ["tag1", "tag2"]
	}
}
```

**Response:** Created blog post object

**Note:** Slugs must be unique across the blog, since a slug addresses a post on its own. A
duplicate returns a 409 rather than being silently renamed.

##### PATCH `/api/blog/update`

Update an existing blog post (requires authentication).

**Request Body:**

```json
{
	"id": "post-id",
	"post": {
		"title": "Updated Title",
		"content": "Updated content...",
		"tags": ["updated-tags"]
	}
}
```

**Response:** Updated blog post object

##### DELETE `/api/blog/remove`

Delete a blog post (requires authentication).

**Query Parameters:**

- `id`: Post ID to delete

**Response:**

```json
{
	"ok": true
}
```

#### Users and Setup

| Endpoint                | Method         | Access              | Purpose                                        |
| ----------------------- | -------------- | ------------------- | ---------------------------------------------- |
| `/api/setup/status`     | GET            | public              | Whether any user exists yet                    |
| `/api/setup/init`       | POST           | public until set up | Create the first administrator; 409 afterwards |
| `/api/users/{username}` | GET            | public              | Author profile and their posts                 |
| `/api/users/me`         | PATCH          | authenticated       | Update own display name, bio or password       |
| `/api/users/me/avatar`  | POST / DELETE  | authenticated       | Upload or clear own avatar                     |
| `/api/admin/users`      | GET / POST     | administrator       | List or create users                           |
| `/api/admin/users/{id}` | PATCH / DELETE | administrator       | Update or delete a user                        |

Guards worth knowing: you cannot delete your own account, and you cannot demote or delete the last
remaining administrator.

#### Drafts

| Endpoint          | Method | Access        | Purpose                     |
| ----------------- | ------ | ------------- | --------------------------- |
| `/api/blog/draft` | GET    | authenticated | List your saved drafts      |
| `/api/blog/draft` | POST   | authenticated | Save a draft, keyed by slug |

A draft belongs to the author who saved it. Only that author can list, open or overwrite it, and saving over another author's slug returns 403. Drafts saved before owners were recorded belong to the primary administrator, the earliest-created one, until someone saves them.

#### Media

| Endpoint            | Method | Access        | Purpose                                                                   |
| ------------------- | ------ | ------------- | ------------------------------------------------------------------------- |
| `/api/media/upload` | PUT    | authenticated | Raw file body with its `Content-Type`; returns `{ key, url, mime, size }` |
| `/media/{key}`      | GET    | public        | Streams a stored file with HTTP range support and a one-year cache header |

`POST /api/blog/create` and `PATCH /api/blog/update` accept `type` (`article`, `slideshow`, `video` or `music`) and `media`, a list of `{ key, caption?, width?, height? }`. The server reads each file's type and size back from storage, rejects keys the author did not upload, and ignores `content` for slideshows, which is built from the captions. `GET /api/settings` returns `media: true` when storage is available.

#### Subscribers

| Endpoint                        | Method | Access        | Purpose                                                                |
| ------------------------------- | ------ | ------------- | ---------------------------------------------------------------------- |
| `/api/subscribers/subscribe`    | POST   | public        | Send a confirmation email. 404 while subscriptions are off             |
| `/api/subscribers/confirm`      | POST   | signed link   | Body `{ id, token }`. Activates the subscriber                         |
| `/api/subscribers/unsubscribe`  | POST   | signed link   | `id` and `token` in the body or the query. Accepts RFC 8058 one-click  |
| `/api/admin/subscribers`        | GET    | administrator | List with `search`, `status`, `limit` and `offset`                     |
| `/api/admin/subscribers/export` | GET    | administrator | CSV of every subscriber, streamed a page at a time                     |
| `/api/admin/subscribers/{id}`   | DELETE | administrator | Remove a subscriber and their queued emails                            |
| `/api/admin/mail`               | GET    | administrator | Delivery settings, status and queue counts. Secrets are never returned |
| `/api/admin/mail`               | POST   | administrator | Save delivery settings. A blank secret keeps the stored one            |
| `/api/admin/mail/test`          | POST   | administrator | Send a test email to `{ to }`                                          |
| `/api/admin/mail/drain`         | POST   | administrator | Send the next batch of the queue now                                   |

`POST /api/blog/create` also accepts `notify: true` next to `post`. When delivery is active the post is queued for every confirmed subscriber and the response carries `queued`.

#### Analytics

| Endpoint                 | Method | Access        | Purpose                                                          |
| ------------------------ | ------ | ------------- | ---------------------------------------------------------------- |
| `/api/analytics/track`   | POST   | public        | Beacon endpoint. Always 204, never reports why a hit was dropped |
| `/api/analytics/summary` | GET    | administrator | Aggregated report; `range` is `7d`, `30d`, `90d` or `all`        |

#### Generated Routes

| Route                          | Purpose                                          |
| ------------------------------ | ------------------------------------------------ |
| `/feed.xml`                    | Atom feed of the 50 most recent posts            |
| `/sitemap.xml`                 | Every post, date archive and author page         |
| `/robots.txt`                  | Crawl rules. Indexing is disabled in development |
| `/thumbnails/{id}`             | A post's stored thumbnail image                  |
| `/avatars/{pathname}`          | A user's avatar image                            |
| `/media/{key}`                 | A slideshow image, video or music file           |
| `/favicon.ico`, `/favicon.png` | Site icons, proxied when set to an external URL  |

### Database Schema

NuxtPress uses Cloudflare D1. The tables are created and migrated on the first request after a
deploy, so there is no manual migration step.

#### `blog_posts` Table

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content TEXT NOT NULL,
  thumbnail TEXT,
  thumbnail_url TEXT,
  type TEXT NOT NULL DEFAULT 'article',
  media TEXT,
  author_id TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  tags TEXT
);

CREATE INDEX idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX idx_blog_posts_created_at ON blog_posts(created_at);
CREATE INDEX idx_blog_posts_slug_created_at ON blog_posts(slug, created_at);
CREATE INDEX idx_blog_posts_author ON blog_posts(author_id);
```

- `id`: 32-character hex identifier
- `slug`: URL segment. Unique across the table, enforced by the create and update endpoints
- `content`: Markdown
- `thumbnail`: base64 image, served by `/thumbnails/{id}`
- `thumbnail_url`: external image URL, used in preference to `thumbnail`
- `type`: `article`, `slideshow`, `video` or `music`
- `media`: JSON list of `{ key, mime, size, caption?, width?, height? }`, null for articles
- `author_id`: references `users.id`, set to null when that user is deleted
- `created_at` / `updated_at`: milliseconds since the epoch
- `tags`: comma-separated list, null when the post has no tags

#### `users` Table

```sql
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL,
  bio TEXT,
  avatar_pathname TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX idx_users_username ON users(username);
```

- `username`: 3-32 characters, lowercase letters, numbers, hyphens and underscores
- `password_hash`: scrypt hash from `nuxt-auth-utils`. Plaintext passwords are never stored
- `role`: `administrator` or `author`
- `avatar_pathname`: key into blob storage, served by `/avatars/{pathname}`
- `is_active`: `0` suspends the account and invalidates its sessions on the next request

#### `subscribers` Table

```sql
CREATE TABLE IF NOT EXISTS subscribers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  confirmed_at INTEGER,
  confirmation_sent_at INTEGER
);

CREATE UNIQUE INDEX idx_subscribers_email ON subscribers(email);
```

- `email`: lowercased address
- `status`: `pending` until the confirmation link is used, then `active`

#### `mail_outbox` Table

```sql
CREATE TABLE IF NOT EXISTS mail_outbox (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL,
  post_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);

CREATE UNIQUE INDEX idx_mail_outbox_subscriber_post ON mail_outbox(subscriber_id, post_id);
CREATE INDEX idx_mail_outbox_status_created ON mail_outbox(status, created_at);
```

- `status`: `pending`, `sending`, `sent` or `failed`. A `sending` row older than ten minutes goes back to `pending`
- Sent rows are deleted after 30 days

### Contributing

Contributions are welcome! Here's how to get started:

1. **Fork the repository**

   ```bash
   git clone https://github.com/YOUR-USERNAME/nuxtpress.git
   ```

2. **Create a feature branch**

   ```bash
   git checkout -b feature/amazing-feature
   ```

3. **Make your changes**
   - Follow the existing code style
   - Run `bun run prettier` before committing
   - Ensure types are correct with TypeScript

4. **Commit your changes**

   ```bash
   git commit -m "feat: add amazing feature"
   ```

   Follow [Conventional Commits](https://www.conventionalcommits.org/) format.

5. **Push and create a Pull Request**
   ```bash
   git push origin feature/amazing-feature
   ```

#### Development Guidelines

- **Code Style**: Prettier is configured and runs automatically on commit via Husky
- **TypeScript**: Strict mode is enabled; ensure all types are correct
- **Components**: Use Nuxt UI components when possible for consistency
- **API Routes**: Use Zod schemas for validation
- **Tests**: Playwright covers every page and API route. Run `bun run test` before opening a pull request. The test environment sets `NUXTPRESS_MAIL_SINK=1`, which records outgoing mail in KV instead of sending it; specs read it from `/api/admin/mail/sink`. A recipient at `@fail.invalid` always fails, and one at `@fail-later.invalid` fails only post emails
- **Server Utils**: Helper functions live in `src/server/utils/`: auth, database, post queries, analytics, mail, subscribers
- **Database**: Always use parameterized queries to prevent SQL injection

### License

This project is open source and available under the [MIT License](LICENSE).
