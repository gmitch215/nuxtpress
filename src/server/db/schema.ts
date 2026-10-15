import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { POST_TYPES } from '~/shared/media';

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
		type: text('type', { enum: POST_TYPES }).notNull().default('article'),
		media: text('media'),
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

export const subscribers = sqliteTable(
	'subscribers',
	{
		id: text('id').primaryKey(),
		email: text('email').notNull(),
		status: text('status', { enum: ['pending', 'active'] })
			.notNull()
			.default('pending'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		confirmedAt: integer('confirmed_at', { mode: 'timestamp_ms' }),
		confirmationSentAt: integer('confirmation_sent_at', { mode: 'timestamp_ms' })
	},
	(table) => [uniqueIndex('idx_subscribers_email').on(table.email)]
);

export const mailOutbox = sqliteTable(
	'mail_outbox',
	{
		id: text('id').primaryKey(),
		subscriberId: text('subscriber_id').notNull(),
		postId: text('post_id').notNull(),
		status: text('status', { enum: ['pending', 'sending', 'sent', 'failed'] })
			.notNull()
			.default('pending'),
		attempts: integer('attempts').notNull().default(0),
		error: text('error'),
		createdAt: integer('created_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`),
		updatedAt: integer('updated_at', { mode: 'timestamp_ms' })
			.notNull()
			.default(sql`(unixepoch() * 1000)`)
	},
	(table) => [
		uniqueIndex('idx_mail_outbox_subscriber_post').on(table.subscriberId, table.postId),
		index('idx_mail_outbox_status_updated').on(table.status, table.updatedAt)
	]
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type MailOutboxRow = typeof mailOutbox.$inferSelect;
