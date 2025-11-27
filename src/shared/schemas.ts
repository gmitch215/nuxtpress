import * as z from 'zod';

export const blogPostSchema = z.object({
	title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(200, 'Slug must be 200 characters or less')
		.regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens'),
	content: z
		.string()
		.min(1, 'Content is required')
		.max(500000, 'Content must be 500,000 characters or less'),
	thumbnail_url: z.url('Must be a valid URL').optional().or(z.literal('')),
	tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).default([])
});

export const blogPostCreateSchema = blogPostSchema;

export const blogPostUpdateSchema = blogPostSchema.extend({
	id: z.string().min(1, 'ID is required')
});

export const settingsSchema = z.object({
	name: z.string().max(50, 'Name must be 50 characters or less').optional(),
	description: z.string().max(160, 'Description must be 160 characters or less').optional(),
	author: z.string().max(50, 'Author must be 50 characters or less').optional(),
	themeColor: z
		.string()
		.regex(/^#([0-9A-F]{3}){1,2}$/i, 'Theme color must be a valid hex color')
		.optional(),
	favicon: z.string().optional(),
	faviconPng: z.string().optional(),
	github: z.string().optional(),
	twitter: z.string().optional(),
	instagram: z.string().optional(),
	patreon: z.string().optional(),
	linkedin: z.string().optional(),
	discord: z
		.string()
		.regex(
			/^(https?:\/\/)?(discord\.gg\/[a-zA-Z0-9]+|discord\.com\/invite\/[a-zA-Z0-9]+|discord\.com\/users\/\d+)$/,
			'Discord must be a valid invite link (discord.gg/ or discord.com/invite/) or user profile (discord.com/users/)'
		)
		.optional()
		.or(z.literal('')),
	supportEmail: z.string().email('Must be a valid email').optional().or(z.literal(''))
});

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type BlogPostCreateInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
