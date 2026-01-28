import { sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

/**
 * Ensures the database table exists and is migrated.
 * Uses a singleton pattern to only run once per server instance.
 */
export async function ensureDatabase() {
	if (isInitialized) return;

	const cached = await kv.get<boolean>('nuxtpress:db_initialized');
	if (cached) {
		isInitialized = true;
		return;
	}

	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			console.log('📦 Running database migrations...');

			await db.run(sql`
				CREATE TABLE IF NOT EXISTS blog_posts (
					id TEXT PRIMARY KEY,
					title TEXT NOT NULL,
					slug TEXT NOT NULL,
					content TEXT NOT NULL,
					thumbnail TEXT,
					thumbnail_url TEXT,
					created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
					updated_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
					tags TEXT
				)
			`);

			await db.run(sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug)`);
			await db.run(
				sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at)`
			);

			const oldFormatCheck = await db.run(sql`
				SELECT COUNT(*) as count FROM blog_posts WHERE created_at < 10000000000 LIMIT 1
			`);

			if (
				oldFormatCheck.rows &&
				oldFormatCheck.rows.length > 0 &&
				(oldFormatCheck.rows[0] as any).count > 0
			) {
				console.log('📝 Converting old timestamp format...');
				await db.run(sql`
					UPDATE blog_posts
					SET
						created_at = created_at * 1000,
						updated_at = updated_at * 1000
					WHERE created_at < 10000000000
				`);
				console.log('✓ Timestamp conversion completed');
			}

			console.log('✓ Database migrations completed');
		} catch (error: any) {
			console.error('Database migration error:', error);
			// Don't throw - let the app continue, it might be a permission issue
			// The migrations might have already run
		} finally {
			isInitialized = true;
			await kv.set('nuxtpress:db_initialized', true);
		}
	})();

	await initPromise;
	initPromise = null;
}
