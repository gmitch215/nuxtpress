import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const blogPosts = sqliteTable(
	'blog_posts',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		slug: text('slug').notNull(),
		content: text('content').notNull(),
		thumbnail: text('thumbnail', { mode: 'text' }), // BLOB stored as text/base64
		thumbnailUrl: text('thumbnail_url'),
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
		index('idx_blog_posts_created_at').on(table.createdAt)
	]
);

export type BlogPost = typeof blogPosts.$inferSelect;
export type NewBlogPost = typeof blogPosts.$inferInsert;
