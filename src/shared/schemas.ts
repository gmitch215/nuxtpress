import * as z from 'zod';
import { embeddedDataImages, INLINE_IMAGE_MAX_CHARS, isDataImage } from './images';
import {
	isMediaPath,
	MAX_MEDIA_CAPTION,
	MAX_SLIDE_CAPTION,
	MAX_SLIDES,
	MEDIA_KEY_RE,
	MEDIA_MAX_BYTES,
	MIMES_BY_TYPE,
	POST_TYPES
} from './media';

export const RESERVED_SLUGS = new Set([
	'about',
	'admin',
	'api',
	'authors',
	'avatars',
	'favicon',
	'feed',
	'login',
	'media',
	'profile',
	'robots',
	'setup',
	'sitemap',
	'subscribe',
	'tags',
	'thumbnails',
	'unsubscribe'
]);

const THUMBNAIL_PATH_RE = /^\/thumbnails\/[a-f0-9]{32}$/i;

export const mediaItemSchema = z.object({
	key: z.string().regex(MEDIA_KEY_RE, 'Invalid media key'),
	mime: z.string().max(100).default(''),
	size: z.number().int().min(0).max(MEDIA_MAX_BYTES).default(0),
	caption: z.string().max(MAX_SLIDE_CAPTION, 'Caption must be 300 characters or less').optional(),
	width: z.number().int().min(0).max(20000).optional(),
	height: z.number().int().min(0).max(20000).optional()
});

export const SLUG_RE = /^[a-z0-9-]{1,200}$/;

const blogPostBase = z.object({
	title: z.string().min(1, 'Title is required').max(100, 'Title must be 100 characters or less'),
	slug: z
		.string()
		.min(1, 'Slug is required')
		.max(200, 'Slug must be 200 characters or less')
		.regex(/^[a-z0-9-]+$/, 'Slug must only contain lowercase letters, numbers, and hyphens')
		.refine((slug) => !RESERVED_SLUGS.has(slug), 'This slug is reserved for a site page'),
	type: z.enum(POST_TYPES).default('article'),
	media: z.array(mediaItemSchema).max(MAX_SLIDES, 'A slideshow can have 30 slides').default([]),
	content: z
		.string()
		.max(500000, 'Content must be 500,000 characters or less')
		.refine(
			(content) =>
				embeddedDataImages(content).every((src) =>
					isDataImage(src, undefined, INLINE_IMAGE_MAX_CHARS)
				),
			'Inline images must be PNG, JPEG, WebP or GIF and under about 250 KB each'
		),
	thumbnail_url: z
		.string()
		.refine(
			(value) =>
				!value.startsWith('data:') || isDataImage(value, undefined, INLINE_IMAGE_MAX_CHARS),
			'Thumbnail must be a PNG, JPEG, WebP or GIF image under about 250 KB'
		)
		.refine(
			(value) =>
				value === '' ||
				value.startsWith('data:') ||
				THUMBNAIL_PATH_RE.test(value) ||
				isMediaPath(value) ||
				z.url().safeParse(value).success,
			'Must be a valid URL'
		)
		.optional(),
	tags: z.array(z.string().max(50, 'Tag must be 50 characters or less')).default([])
});

type PostRuleInput = {
	type: (typeof POST_TYPES)[number];
	media: { mime: string; caption?: string }[];
	content: string;
};

function checkPostRules(post: PostRuleInput, ctx: z.RefinementCtx) {
	const issue = (path: string, message: string) =>
		ctx.addIssue({ code: 'custom', path: [path], message });

	if (post.type === 'article') {
		if (!post.content) issue('content', 'Content is required');
		else if (post.content.length < 50) issue('content', 'Content must be at least 50 characters');
		if (post.media.length > 0) issue('media', 'Articles cannot have media');
		return;
	}

	const mimes = MIMES_BY_TYPE[post.type];
	const label = post.type === 'slideshow' ? 'slide' : post.type;
	if (post.type === 'slideshow') {
		if (post.media.length < 1) issue('media', 'Add at least one slide');
	} else {
		if (post.media.length !== 1) issue('media', `Add one ${label} file`);
		if (post.content.length > MAX_MEDIA_CAPTION) {
			issue('content', 'Caption must be 2,000 characters or less');
		}
	}
	if (post.media.some((item) => item.mime && !mimes.includes(item.mime))) {
		issue('media', `That file type is not allowed for a ${label}`);
	}
}

export const blogPostSchema = blogPostBase.superRefine(checkPostRules);
export const blogPostCreateSchema = blogPostSchema;

export const blogPostUpdateSchema = blogPostBase
	.extend({ id: z.string().min(1, 'ID is required') })
	.superRefine(checkPostRules);

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
	urlStyle: z.enum(['dated', 'slug']).optional(),
	message: z
		.object({
			text: z.string().max(300, 'Message text must be 300 characters or less'),
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

export const MAIL_TRANSPORTS = ['binding', 'cloudflare', 'smtp'] as const;
export const SMTP_TLS_MODES = ['starttls', 'implicit', 'off'] as const;

export const mailSettingsSchema = z.object({
	enabled: z.boolean().optional(),
	transport: z.enum(MAIL_TRANSPORTS).optional(),
	fromAddress: z
		.email('Must be a valid email')
		.max(255, 'Email must be 255 characters or less')
		.optional()
		.or(z.literal('')),
	fromName: z.string().max(50, 'Name must be 50 characters or less').optional(),
	cloudflareAccountId: z
		.string()
		.regex(/^[a-f0-9]{32}$/i, 'Account ID must be 32 hex characters')
		.optional()
		.or(z.literal('')),
	cloudflareApiToken: z.string().max(256, 'Token must be 256 characters or less').optional(),
	smtpHost: z.string().max(253, 'Host must be 253 characters or less').optional(),
	smtpPort: z.number().int().min(1).max(65535).optional(),
	smtpTls: z.enum(SMTP_TLS_MODES).optional(),
	smtpUsername: z.string().max(255, 'Username must be 255 characters or less').optional(),
	smtpPassword: z.string().max(512, 'Password must be 512 characters or less').optional()
});

export const subscribeSchema = z.object({
	email: z.email('Enter a valid email address').max(255, 'Email must be 255 characters or less'),
	website: z.string().max(200).optional()
});

export const subscriberLinkSchema = z.object({
	id: z.string().min(1).max(64),
	token: z.string().min(1).max(128)
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
	email: 'Email',
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
export type MailSettingsInput = z.infer<typeof mailSettingsSchema>;
export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
