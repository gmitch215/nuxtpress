export type BlogPost = {
	id: string;
	title: string;
	slug: string;
	content: string;
	thumbnail?: Uint8Array;
	created_at: Date;
	updated_at: Date;
	tags: string[];
};

function checkTable(db: ReturnType<typeof hubDatabase>) {
	db.prepare(
		`CREATE TABLE IF NOT EXISTS blog_posts (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		slug TEXT NOT NULL UNIQUE,
		content TEXT NOT NULL,
		thumbnail BLOB,
		created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
		tags TEXT
	);`
	).run();
}

export function useBlogPosts() {
	const db = hubDatabase();

	const posts = useState<BlogPost[]>('blog-posts', () => []);

	const fetchPosts = async () => {
		// create table if it doesn't exist
		checkTable(db);

		const rows = await db.prepare('SELECT * FROM blog_posts ORDER BY created_at DESC').all();
		posts.value = rows.results.map((row: any) => ({
			...row,
			created_at: new Date(row.created_at as string),
			updated_at: new Date(row.updated_at as string),
			tags: row.tags ? (row.tags as string).split(',').map((t) => t.trim()) : []
		}));
	};

	const addPost = async (
		post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>
	): Promise<BlogPost> => {
		// create table if it doesn't exist
		checkTable(db);

		const id = crypto.randomUUID().replace(/-/g, '');

		await db
			.prepare(
				`INSERT INTO blog_posts (id, title, slug, content, thumbnail, tags)
			VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
			)
			.bind(id, post.title, post.slug, post.content, post.thumbnail, post.tags.join(','))
			.run();
		await fetchPosts();
		return { id, ...post, created_at: new Date(), updated_at: new Date() };
	};

	const updatePost = async (post: Omit<BlogPost, 'created_at' | 'updated_at'>) => {
		// create table if it doesn't exist
		checkTable(db);

		await db
			.prepare(
				`UPDATE blog_posts SET
				title = ?1,
				slug = ?2,
				content = ?3,
				thumbnail = ?4,
				updated_at = CURRENT_TIMESTAMP,
				tags = ?5
				WHERE id = ?6`
			)
			.bind(post.title, post.slug, post.content, post.thumbnail, post.tags.join(','), post.id)
			.run();
		await fetchPosts();
	};

	const deletePost = async (id: string) => {
		// create table if it doesn't exist
		checkTable(db);

		await db.prepare('DELETE FROM blog_posts WHERE id = ?1').bind(id).run();
		await fetchPosts();
	};

	return {
		posts,
		fetchPosts,
		addPost,
		updatePost,
		deletePost
	};
}
