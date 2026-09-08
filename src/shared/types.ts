export type BlogPost = {
	id: string;
	title: string;
	slug: string;
	content: string;
	thumbnail?: Uint8Array;
	thumbnail_url?: string;
	created_at: Date;
	updated_at: Date;
	tags: string[];
	author_id?: string | null;
	author?: PublicUser | null;
};

export type BlogPostData = Omit<BlogPost, 'id' | 'created_at' | 'updated_at' | 'author'>;

export type PublicUser = {
	id: string;
	username: string;
	displayName: string;
	role: 'administrator' | 'author';
	avatarPathname?: string | null;
	bio?: string | null;
};

export type AdminUser = PublicUser & {
	isActive: boolean;
	createdAt: string;
	updatedAt: string;
	postCount: number;
};

export function formatDate(date: Date) {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}

export type BlogPostSummary = {
	id: string;
	title: string;
	slug: string;
	excerpt: string;
	thumbnail_url?: string;
	created_at: Date;
	updated_at: Date;
	tags: string[];
	author_id?: string | null;
	author?: PublicUser | null;
};

export type UrlStyle = 'dated' | 'slug';

/** Dated permalink for a post; the primary URL regardless of the configured default. */
export function datedPostPath(post: { slug: string; created_at: Date | string }): string {
	const d = new Date(post.created_at);
	return `/${d.getUTCFullYear()}/${d.getUTCMonth() + 1}/${d.getUTCDate()}/${post.slug}`;
}

/** Slug-only permalink for a post; always resolvable, default only when urlStyle is 'slug'. */
export function slugPostPath(post: { slug: string }): string {
	return `/${post.slug}`;
}

export function postPath(
	post: { slug: string; created_at: Date | string },
	style: UrlStyle = 'dated'
): string {
	return style === 'slug' ? slugPostPath(post) : datedPostPath(post);
}
