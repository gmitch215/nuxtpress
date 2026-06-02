import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
	'users',
	{
		id: text('id').primaryKey(),
		username: text('username').notNull(),
		displayName: text('display_name').notNull(),
		passwordHash: text('password_hash').notNull(),
		role: text('role', { enum: ['administrator', 'author'] }).notNull(),
		bio: text('bio'),
		avatarPathname: text('avatar_pathname'),
		isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [uniqueIndex('idx_users_username').on(table.username)]
);

export const blogPosts = sqliteTable(
	'blog_posts',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		slug: text('slug').notNull(),
		content: text('content').notNull(),
		thumbnail: text('thumbnail', { mode: 'text' }),
		thumbnailUrl: text('thumbnail_url'),
		authorId: text('author_id').references(() => users.id, { onDelete: 'set null' }),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		tags: text('tags')
	},
	(table) => [
		index('idx_blog_posts_slug').on(table.slug),
		index('idx_blog_posts_created_at').on(table.createdAt),
		index('idx_blog_posts_slug_created_at').on(table.slug, table.createdAt),
		index('idx_blog_posts_author').on(table.authorId)
	]
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
