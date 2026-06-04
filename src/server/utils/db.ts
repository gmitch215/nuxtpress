import { sql } from 'drizzle-orm';
import { db } from 'hub:db';
import { kv } from 'hub:kv';

let isInitialized = false;
let initPromise: Promise<void> | null = null;

const CURRENT_MIGRATION_VERSION = 4;
const MIGRATION_VERSION_KEY = 'nuxtpress:db_migration_version';
export const SETUP_COMPLETED_KV_KEY = 'nuxtpress:setup_completed';

export async function markSetupCompleted() {
	try {
		await kv.set(SETUP_COMPLETED_KV_KEY, '1');
	} catch (error) {
		console.warn('failed to set setup completion flag:', error);
	}
}

export function describeDbError(error: unknown): string {
	const e = error as any;
	const cause = e?.cause;
	const causeMsg = cause?.message || cause?.toString?.();
	const causeCode = cause?.code || cause?.libsqlError?.code;
	if (causeMsg && causeMsg !== e?.message) {
		return causeCode ? `${causeMsg} [${causeCode}]` : causeMsg;
	}
	return e?.message ?? String(error);
}

async function hasBlogPostsTable() {
	try {
		await db.run(sql`SELECT 1 FROM blog_posts LIMIT 1`);
		return true;
	} catch {
		return false;
	}
}

async function hasUsersTable() {
	try {
		await db.run(sql`SELECT 1 FROM users LIMIT 1`);
		return true;
	} catch {
		return false;
	}
}

async function columnExists(table: string, column: string) {
	try {
		const result = await db.run(sql.raw(`PRAGMA table_info(${table})`));
		const rows = result.rows as Array<{ name: string }>;
		return rows.some((row) => row.name === column);
	} catch {
		return false;
	}
}

async function ensureColumn(table: string, column: string, definition: string) {
	if (await columnExists(table, column)) return;
	try {
		await db.run(sql.raw(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`));
	} catch (error) {
		console.warn(`failed to add ${table}.${column}:`, describeDbError(error));
	}
}

async function legacyAdminSeed() {
	const config = useRuntimeConfig();
	const password = config.password;
	if (!password || password === 'password') return;

	const avatarPath = '/favicon.png';

	try {
		const existing = await db.run(
			sql`SELECT id, avatar_pathname FROM users WHERE username = ${'admin'} LIMIT 1`
		);
		const existingRow = existing.rows?.[0] as any;
		const existingId = existingRow?.id as string | undefined;
		if (existingId) {
			if (!existingRow.avatar_pathname) {
				await db.run(
					sql`UPDATE users SET avatar_pathname = ${avatarPath} WHERE id = ${existingId}`
				);
			}
			await db.run(
				sql`UPDATE blog_posts SET author_id = ${existingId} WHERE author_id IS NULL OR author_id = ''`
			);
			await markSetupCompleted();
			return;
		}

		const id = crypto.randomUUID().replace(/-/g, '');
		const hash = await hashPassword(password);
		const now = Date.now();
		await db.run(sql`
			INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, avatar_pathname, is_active, created_at, updated_at)
			VALUES (${id}, ${'admin'}, ${'Team'}, ${hash}, ${'administrator'}, ${avatarPath}, ${1}, ${now}, ${now})
		`);

		const seeded = await db.run(sql`SELECT id FROM users WHERE username = ${'admin'} LIMIT 1`);
		const seededId = (seeded.rows?.[0] as any)?.id as string | undefined;
		if (!seededId) return;

		const reassigned = await db.run(
			sql`UPDATE blog_posts SET author_id = ${seededId} WHERE author_id IS NULL OR author_id = ''`
		);
		const reassignedCount =
			(reassigned as any)?.meta?.changes ?? (reassigned as any)?.changes ?? '?';
		await markSetupCompleted();
		console.log(
			`✓ Seeded admin user from NUXT_PASSWORD and backfilled ${reassignedCount} existing post(s) to Team`
		);
	} catch (error) {
		console.warn('legacy admin seed skipped:', error);
	}
}

async function runSchemaMigrations() {
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
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_created_at ON blog_posts(created_at)`);
	await db.run(
		sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_slug_created_at ON blog_posts(slug, created_at)`
	);

	const isoFormatCheck = await db.run(sql`
		SELECT COUNT(*) as count FROM blog_posts
		WHERE typeof(created_at) = 'text' OR typeof(updated_at) = 'text'
		LIMIT 1
	`);
	if (
		isoFormatCheck.rows &&
		isoFormatCheck.rows.length > 0 &&
		Number((isoFormatCheck.rows[0] as any).count) > 0
	) {
		console.log('📝 Converting ISO timestamp strings to integers...');
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
		}
	}

	const oldFormatCheck = await db.run(sql`
		SELECT COUNT(*) as count FROM blog_posts
		WHERE typeof(created_at) = 'integer' AND created_at < 10000000000
		LIMIT 1
	`);
	if (
		oldFormatCheck.rows &&
		oldFormatCheck.rows.length > 0 &&
		Number((oldFormatCheck.rows[0] as any).count) > 0
	) {
		await db.run(sql`
			UPDATE blog_posts
			SET created_at = created_at * 1000, updated_at = updated_at * 1000
			WHERE typeof(created_at) = 'integer' AND created_at < 10000000000
		`);
	}

	await db.run(sql`
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
		)
	`);
	// repair drift on pre-existing users tables (CREATE TABLE IF NOT EXISTS is a no-op when the table already exists)
	await ensureColumn('users', 'display_name', 'TEXT');
	await ensureColumn('users', 'password_hash', 'TEXT');
	await ensureColumn('users', 'role', 'TEXT');
	await ensureColumn('users', 'bio', 'TEXT');
	await ensureColumn('users', 'avatar_pathname', 'TEXT');
	await ensureColumn('users', 'is_active', 'INTEGER NOT NULL DEFAULT 1');
	await ensureColumn('users', 'created_at', 'INTEGER');
	await ensureColumn('users', 'updated_at', 'INTEGER');
	await db.run(sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)`);

	await ensureColumn('blog_posts', 'author_id', 'TEXT');
	await db.run(sql`CREATE INDEX IF NOT EXISTS idx_blog_posts_author ON blog_posts(author_id)`);
}

export async function ensureDatabase() {
	if (isInitialized) return;
	if (initPromise) return initPromise;

	initPromise = (async () => {
		try {
			let cachedVersion: number | null = null;
			try {
				cachedVersion = await kv.get<number>(MIGRATION_VERSION_KEY);
			} catch (error) {
				console.warn('Unable to read migration version cache:', error);
			}

			const blogReady = await hasBlogPostsTable();
			const usersReady = await hasUsersTable();
			const hasAvatarColumn = usersReady && (await columnExists('users', 'avatar_pathname'));
			const hasAuthorColumn = blogReady && (await columnExists('blog_posts', 'author_id'));
			const needsSchema =
				cachedVersion !== CURRENT_MIGRATION_VERSION ||
				!blogReady ||
				!usersReady ||
				!hasAvatarColumn ||
				!hasAuthorColumn;

			if (needsSchema) {
				console.log('📦 Running database migrations...');
				await runSchemaMigrations();
				try {
					await kv.set(MIGRATION_VERSION_KEY, CURRENT_MIGRATION_VERSION);
				} catch (error) {
					console.warn('Unable to cache migration version in KV:', error);
				}
				console.log('✓ Database migrations completed');
			}

			// seed runs on every cold init while users is empty so a late-set NUXT_PASSWORD still seeds
			await legacyAdminSeed();

			const finalBlog = await hasBlogPostsTable();
			const finalUsers = await hasUsersTable();
			if (!finalBlog || !finalUsers) {
				throw new Error('Database initialization verification failed');
			}

			isInitialized = true;
		} catch (error: any) {
			console.error('Database migration error:', describeDbError(error));
			throw error;
		}
	})();

	try {
		await initPromise;
	} finally {
		initPromise = null;
	}
}

export async function userCount(): Promise<number> {
	await ensureDatabase();
	const res = await db.run(sql`SELECT COUNT(*) as count FROM users`);
	return Number((res.rows?.[0] as any)?.count ?? 0);
}
