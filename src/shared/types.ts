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
