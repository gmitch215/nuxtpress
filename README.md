# NuxtPress

> Modern, fast, and beautiful blog software powered by Nuxt UI v4 and Cloudflare Workers

[![Deploy to NuxtHub](https://hub.nuxt.com/button.svg)](https://hub.nuxt.com/new?repo=gmitch215/nuxtpress)

---

## Table of Contents

- [For Everyone: Getting Started](#for-everyone-getting-started)
  - [What is NuxtPress?](#what-is-nuxtpress)
  - [Deploy Your Own Blog](#deploy-your-own-blog)
  - [Configuration](#configuration)
  - [Installing Updates](#installing-updates-from-the-template)
  - [Using Your Blog](#using-your-blog)
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

- **Fast**: Built on Cloudflare's edge network for lightning-fast performance worldwide
- **Simple**: Easy to deploy and use with a clean, intuitive interface
- **Secure**: Password-protected admin panel with session management
- **Beautiful**: Powered by Nuxt UI v4 for a stunning, responsive design
- **Free**: Deploy on Cloudflare's free tier

### Deploy Your Own Blog

#### Option 1: One-Click Deploy to NuxtHub (Recommended)

1. Click the "Deploy to NuxtHub" button above
2. Connect your GitHub account
3. NuxtHub will automatically:
   - Fork this repository to your account
   - Set up Cloudflare Workers integration
   - Deploy your blog
   - Provision the database and KV storage
4. Configure your blog settings (see below)
5. Start writing!

#### Option 2: Manual Deployment

If you prefer to deploy manually:

1. Fork this repository
2. Create a [NuxtHub](https://hub.nuxt.com) account
3. Link your repository to NuxtHub
4. Deploy from the NuxtHub dashboard
5. Configure environment variables (see below)

### Configuration

After deployment, you'll need to configure your blog through environment variables:

#### Required Settings

| Variable        | Description                   | Default    |
| --------------- | ----------------------------- | ---------- |
| `NUXT_PASSWORD` | Admin password for logging in | `password` |

⚠️ **Important**: Change the default password immediately after deployment!

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

**How to set environment variables in NuxtHub:**

1. Go to your project on hub.nuxt.com
2. Navigate to Settings → Environment Variables
3. Add your variables
4. Redeploy your application

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
git merge template/v1.0.2 --allow-unrelated-histories -m "chore: merge template v1.0.2"
```

If you prefer to create a local branch that mirrors the tagged state, you can do:

```bash
git fetch --tags template
git checkout -b update-v1.0.2 template/v1.0.2
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

1. Navigate to your blog URL
2. Click the login button in the navigation
3. Enter your password (the one you set in `NUXT_PASSWORD`)

#### Creating a Blog Post

1. Log in to your blog
2. Click "New Post" or navigate to `/create`
3. Fill in:
   - **Title**: Your post title
   - **Slug**: URL-friendly version (auto-generated from title)
   - **Content**: Your post content (supports Markdown)
   - **Tags**: Comma-separated tags
   - **Thumbnail** (optional): Upload an image
4. Click "Publish"

#### Managing Posts

- **Edit**: Click on any post while logged in to edit it
- **Delete**: Use the delete button on a post's edit page
- **View**: All posts are automatically listed on your homepage

#### Customizing Settings

1. Log in to your blog
2. Navigate to `/settings`
3. Update your blog information, social links, and appearance
4. Changes are saved in your Cloudflare KV storage and take effect immediately

---

## For Developers: Technical Documentation

### Overview

NuxtPress is a full-stack blogging platform built with:

- **Frontend**: Nuxt 4 with Vue 3, Nuxt UI v4, and Tailwind CSS
- **Backend**: Nuxt server routes with Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite on the edge)
- **Storage**: Cloudflare KV for caching and settings
- **Validation**: Zod schemas for type-safe data validation
- **Deployment**: NuxtHub for seamless Cloudflare integration

### Tech Stack

- **[Nuxt 4](https://nuxt.com/)**: Vue.js framework with SSR/SSG
- **[Nuxt UI v4](https://ui.nuxt.com/)**: Beautiful UI component library
- **[@nuxthub/core](https://hub.nuxt.com/)**: Cloudflare Workers integration
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)**: Edge SQL database
- **[Cloudflare KV](https://developers.cloudflare.com/kv/)**: Edge key-value storage
- **[Zod](https://zod.dev/)**: TypeScript-first schema validation
- **[Luxon](https://moment.github.io/luxon/)**: Modern date/time handling
- **[Tailwind CSS v4](https://tailwindcss.com/)**: Utility-first CSS framework

### Local Development

#### Prerequisites

- [Bun](https://bun.sh/) or Node.js 18+
- A Cloudflare account (for deployment)

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

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and set your `NUXT_PASSWORD` and other configuration.

4. Run the development server:

   ```bash
   bun run dev
   ```

5. Open [http://localhost:8787](http://localhost:8787)

#### Available Scripts

- `bun run dev` - Start development server on port 8787
- `bun run dev:test` - Start dev server with test environment
- `bun run build` - Build for production
- `bun run preview` - Preview production build locally with NuxtHub
- `bun run prettier` - Format code with Prettier
- `bun run prettier:check` - Check code formatting

### Project Structure

```
nuxtpress/
├── src/
│   ├── app.vue                 # Root application component
│   ├── error.vue              # Error page component
│   ├── assets/                # Static assets
│   │   └── css/main.css       # Global styles
│   ├── components/            # Vue components
│   │   ├── BlogForm.vue       # Blog post creation/edit form
│   │   ├── BlogPostGroup.vue  # Blog post listing component
│   │   ├── Footer.vue         # Site footer
│   │   ├── LoginForm.vue      # Authentication form
│   │   ├── NavBar.vue         # Navigation bar
│   │   └── SettingsForm.vue   # Settings management form
│   ├── composables/           # Vue composables
│   │   ├── useDatabase.ts     # Database utilities
│   │   └── useLogin.ts        # Authentication utilities
│   ├── layouts/               # Nuxt layouts
│   │   └── default.vue        # Default layout
│   ├── pages/                 # File-based routing
│   │   ├── index.vue          # Homepage (blog list)
│   │   └── [year]/            # Date-based blog routes
│   │       ├── index.vue      # Posts by year
│   │       └── [month]/
│   │           ├── index.vue  # Posts by month
│   │           └── [day]/
│   │               ├── index.vue    # Posts by day
│   │               └── [slug].vue   # Individual post
│   ├── server/                # Server-side code
│   │   ├── utils.ts           # Server utilities
│   │   └── api/               # API routes
│   │       ├── login.post.ts  # User login
│   │       ├── logout.post.ts # User logout
│   │       ├── verify.get.ts  # Session verification
│   │       ├── settings.get.ts    # Get settings
│   │       ├── settings.post.ts   # Update settings
│   │       └── blog/          # Blog API endpoints
│   │           ├── create.post.ts  # Create post
│   │           ├── find.get.ts     # Find post by ID/slug
│   │           ├── list.get.ts     # List all posts
│   │           ├── update.patch.ts # Update post
│   │           └── remove.delete.ts # Delete post
│   └── shared/                # Shared utilities
│       ├── schemas.ts         # Zod validation schemas
│       └── types.ts           # TypeScript types
├── public/                    # Public static files
├── nuxt.config.ts             # Nuxt configuration
├── package.json               # Dependencies
└── tsconfig.json              # TypeScript configuration
```

### API Documentation

All API routes are located in `src/server/api/` and are automatically available at `/api/*`.

#### Authentication

##### POST `/api/login`

Authenticate with the admin password.

**Request Body:**

```json
{
	"password": "your-password"
}
```

**Response:**

```json
{
	"ok": true
}
```

Sets a secure session cookie valid for 30 days.

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

Get all blog posts (public endpoint).

**Response:**

```json
[
	{
		"id": "unique-id",
		"title": "Post Title",
		"slug": "post-slug",
		"content": "Post content...",
		"thumbnail_url": "data:image/png;base64,...",
		"created_at": "2025-11-17T00:00:00.000Z",
		"updated_at": "2025-11-17T00:00:00.000Z",
		"tags": ["tag1", "tag2"]
	}
]
```

##### GET `/api/blog/find`

Find a specific blog post by ID or slug.

**Query Parameters:**

- `id` (optional): Post ID
- `slug` (optional): Post slug

**Response:** Single blog post object (same structure as list)

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

**Note:** Slugs are automatically made unique by appending `-1`, `-2`, etc. if duplicates exist.

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

### Database Schema

NuxtPress uses Cloudflare D1 with the following schema:

#### `blog_posts` Table

```sql
CREATE TABLE IF NOT EXISTS blog_posts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  thumbnail BLOB,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  tags TEXT NOT NULL
);
```

**Fields:**

- `id`: Unique identifier (UUID)
- `title`: Post title
- `slug`: URL-friendly slug (must be unique)
- `content`: Post content (Markdown supported)
- `thumbnail`: Optional image thumbnail (stored as BLOB)
- `created_at`: Unix timestamp of creation
- `updated_at`: Unix timestamp of last update
- `tags`: JSON-encoded array of tags

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
- **Server Utils**: Helper functions are in `src/server/utils.ts`
- **Database**: Always use parameterized queries to prevent SQL injection

### License

This project is open source and available under the [MIT License](LICENSE).
