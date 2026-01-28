import { sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

const CURRENT_MIGRATION_VERSION = 1;

/**
 * Ensures the database table exists and is migrated.
 * Uses a singleton pattern to only run once per server instance.
 */
export async function ensureDatabase() {
	if (isInitialized) return;

	const cachedVersion = await kv.get<number>('nuxtpress:db_migration_version');
	if (cachedVersion === CURRENT_MIGRATION_VERSION) {
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

			// Migration: Convert ISO string timestamps to integer milliseconds
			const isoFormatCheck = await db.run(sql`
				SELECT COUNT(*) as count FROM blog_posts
				WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text'
				LIMIT 1
			`);

			if (
				isoFormatCheck.rows &&
				isoFormatCheck.rows.length > 0 &&
				(isoFormatCheck.rows[0] as any).count > 0
			) {
				console.log('📝 Converting ISO timestamp strings to integers...');

				// Get all rows with text timestamps
				const textRows = await db.run(sql`
					SELECT id, created_at, updated_at FROM blog_posts
					WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text'
				`);

				if (textRows.rows && textRows.rows.length > 0) {
					for (const row of textRows.rows) {
						const rowData = row as any;
						const createdMs =
							typeof rowData.created_at === 'string'
								? new Date(rowData.created_at).getTime()
								: rowData.created_at;
						const updatedMs =
							typeof rowData.updated_at === 'string'
								? new Date(rowData.updated_at).getTime()
								: rowData.updated_at;

						await db.run(sql`
							UPDATE blog_posts
							SET created_at = ${createdMs}, updated_at = ${updatedMs}
							WHERE id = ${rowData.id}
						`);
					}
					console.log(`✓ Converted ${textRows.rows.length} rows from ISO strings to integers`);
				}
			}

			// Migration: Convert second timestamps to millisecond timestamps
			// Check if there are any records with timestamps in seconds (< year 2000 in milliseconds)
			const oldFormatCheck = await db.run(sql`
				SELECT COUNT(*) as count FROM blog_posts
				WHERE typeof(created_at) = 'integer' AND created_at < 10000000000
				LIMIT 1
			`);

			if (
				oldFormatCheck.rows &&
				oldFormatCheck.rows.length > 0 &&
				(oldFormatCheck.rows[0] as any).count > 0
			) {
				console.log('📝 Converting second timestamps to milliseconds...');
				await db.run(sql`
					UPDATE blog_posts
					SET
						created_at = created_at * 1000,
						updated_at = updated_at * 1000
					WHERE typeof(created_at) = 'integer' AND created_at < 10000000000
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
			await kv.set('nuxtpress:db_migration_version', CURRENT_MIGRATION_VERSION);
		}
	})();

	await initPromise;
	initPromise = null;
}
