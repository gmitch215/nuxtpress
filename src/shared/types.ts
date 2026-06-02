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
