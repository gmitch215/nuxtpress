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
};

export type BlogPostData = Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>;

export function formatDate(date: Date) {
	return new Date(date).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'long',
		day: 'numeric'
	});
}
