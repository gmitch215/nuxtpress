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

	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	const storedToken = await kv.get(`nuxtpress:admin_session:${ip}`);
	if (storedToken !== token) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Invalid Session'
		});
	}
}

export function checkTable(db: ReturnType<typeof hubDatabase>) {
	db.prepare(
		`CREATE TABLE IF NOT EXISTS blog_posts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		content TEXT NOT NULL,
		thumbnail BLOB,
		thumbnail_url TEXT,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		tags TEXT
	);`
	).run();
}
