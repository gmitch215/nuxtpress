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
		.min(50, 'Content must be at least 50 characters')
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
	website: z.url('Must be a valid URL').optional().or(z.literal('')),
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
	supportEmail: z
		.email('Must be a valid email')
		.max(255, 'Email must be 255 characters or less')
		.optional()
		.or(z.literal('')),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional(),
	message: z
		.object({
			text: z
				.string()
				.min(1, 'Message text is required')
				.max(300, 'Message text must be 300 characters or less'),
			icon: z
				.string()
				.max(100, 'Message icon must be 100 characters or less')
				.optional()
				.or(z.literal('')),
			ttl: z
				.number()
				.min(0, 'TTL cannot be negative')
				.max(14 * 24 * 60 * 60, 'TTL cannot be longer than 14 days'),
			type: z.enum(['success', 'warning', 'error', 'info']),
			link: z
				.url('Link must be a valid URL')
				.max(200, 'Link must be 200 characters or less')
				.optional()
				.or(z.literal(''))
		})
		.optional()
});

export const USERNAME_RE = /^[a-z0-9_-]{3,32}$/;
export const RESERVED_USERNAMES = new Set(['me', 'admin', 'root', 'system', 'null', 'undefined']);

export const userCreateSchema = z.object({
	username: z
		.string()
		.regex(USERNAME_RE, 'Username must be 3-32 lowercase letters, numbers, hyphens, or underscores')
		.transform((v) => v.toLowerCase()),
	displayName: z
		.string()
		.min(1, 'Display name is required')
		.max(50, 'Display name must be 50 characters or less'),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(128, 'Password must be 128 characters or less'),
	role: z.enum(['administrator', 'author']),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional()
});

export const userUpdateSchema = z.object({
	username: z
		.string()
		.regex(USERNAME_RE, 'Username must be 3-32 lowercase letters, numbers, hyphens, or underscores')
		.transform((v) => v.toLowerCase())
		.optional(),
	displayName: z
		.string()
		.min(1, 'Display name is required')
		.max(50, 'Display name must be 50 characters or less')
		.optional(),
	role: z.enum(['administrator', 'author']).optional(),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional().or(z.literal('')),
	password: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(128, 'Password must be 128 characters or less')
		.optional(),
	isActive: z.boolean().optional()
});

export const profileUpdateSchema = z.object({
	displayName: z
		.string()
		.min(1, 'Display name is required')
		.max(50, 'Display name must be 50 characters or less')
		.optional(),
	bio: z.string().max(500, 'Bio must be 500 characters or less').optional().or(z.literal('')),
	currentPassword: z.string().min(1, 'Current password is required').optional(),
	newPassword: z
		.string()
		.min(8, 'Password must be at least 8 characters')
		.max(128, 'Password must be 128 characters or less')
		.optional()
});

const FIELD_LABELS: Record<string, string> = {
	username: 'Username',
	displayName: 'Display name',
	password: 'Password',
	newPassword: 'New password',
	currentPassword: 'Current password',
	bio: 'Bio',
	role: 'Role',
	title: 'Title',
	slug: 'Slug',
	content: 'Content',
	thumbnail_url: 'Thumbnail URL',
	tags: 'Tags'
};

export function firstZodIssueMessage(
	issues: { path: PropertyKey[]; message?: string }[] | undefined,
	fallback: string
): string {
	if (!issues || issues.length === 0) return fallback;
	const issue = issues[0]!;
	const pathKey = issue.path?.[0]?.toString();
	const label = pathKey ? (FIELD_LABELS[pathKey] ?? pathKey) : '';
	const message = issue.message && issue.message !== 'Invalid input' ? issue.message : fallback;
	return label ? `${label}: ${message}` : message;
}

export type BlogPostInput = z.infer<typeof blogPostSchema>;
export type BlogPostCreateInput = z.infer<typeof blogPostCreateSchema>;
export type BlogPostUpdateInput = z.infer<typeof blogPostUpdateSchema>;
export type SettingsInput = z.infer<typeof settingsSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
