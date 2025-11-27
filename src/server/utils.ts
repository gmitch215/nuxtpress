import { H3Event } from 'h3';

export async function ensureLoggedIn(event: H3Event) {
	const config = useRuntimeConfig();
	if (!config.password || config.password === 'password') {
		throw createError({
			statusCode: 500,
			statusMessage: 'App does not have a configured password, serving read-only state'
		});
	}

	const kv = hubKV();
	const token = getCookie(event, 'admin');
	const ip = getRequestIP(event);
	const sessionId = ip || getCookie(event, 'admin_session_id');

	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Unable to identify client'
		});
	}

	const storedToken = await kv.get(`nuxtpress:admin_session:${sessionId}`);
	if (storedToken !== token) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Invalid Session'
		});
	}
}

export function checkTable(db: ReturnType<typeof hubDatabase>) {
	// Create table without UNIQUE constraint on slug
	// Slugs should be unique per date, not globally
	db.prepare(
		`CREATE TABLE IF NOT EXISTS blog_posts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		slug TEXT NOT NULL,
		content TEXT NOT NULL,
		thumbnail BLOB,
		thumbnail_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		tags TEXT
	);`
	).run();

	// migration: Remove UNIQUE constraint from existing tables
	// SQLite doesn't support DROP CONSTRAINT, so we need to check and recreate if needed
	const indexList = db.prepare(`PRAGMA index_list(blog_posts);`).all();

	const indexes = Array.isArray(indexList) ? indexList : [];
	const hasUniqueSlug = indexes.some(
		(idx: any) => idx.name && idx.unique === 1 && idx.name.includes('slug')
	);

	if (hasUniqueSlug) {
		db.prepare(`ALTER TABLE blog_posts RENAME TO blog_posts_old;`).run();

		db.prepare(
			`CREATE TABLE blog_posts (
			id TEXT PRIMARY KEY,
			title TEXT NOT NULL,
			slug TEXT NOT NULL,
			content TEXT NOT NULL,
			thumbnail BLOB,
			thumbnail_url TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			tags TEXT
		);`
		).run();

		db.prepare(
			`INSERT INTO blog_posts (id, title, slug, content, thumbnail, thumbnail_url, created_at, updated_at, tags)
			SELECT id, title, slug, content, thumbnail, thumbnail_url, created_at, updated_at, tags
			FROM blog_posts_old;`
		).run();

		db.prepare(`DROP TABLE blog_posts_old;`).run();
	}

	// Create index for faster slug lookups
	db.prepare(`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);`).run();
	db.prepare(
		`CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at);`
	).run();
}
