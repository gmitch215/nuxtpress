import type { BlogPost } from '~/shared/types';

export function useBlogPosts() {
	const posts = useState<BlogPost[]>('blog-posts', () => []);

	const fetchPosts = async () => {
		const res = await $fetch<BlogPost[]>('/api/blog/list', {
			method: 'GET'
		});

		posts.value = res;
		return res;
	};

	const usePost = (slug: string, date: { year: number; month: number; day: number }) => {
		const post = useState<BlogPost | null>(
			`blog-post-${slug}-${date.year}-${date.month}-${date.day}`,
			() => null
		);

		const fetchPost = async (): Promise<BlogPost | null> => {
			try {
				const res = await $fetch<BlogPost>(
					`/api/blog/find?slug=${slug}&year=${date.year}&month=${date.month}&day=${date.day}`,
					{
						method: 'GET'
					}
				);
				post.value = res;
				return res;
			} catch (error) {
				return null;
			}
		};

		if (!post.value) {
			fetchPost();
		}

		return {
			post,
			fetchPost
		};
	};

	const addPost = async (
		post: Omit<BlogPost, 'id' | 'created_at' | 'updated_at'>
	): Promise<BlogPost> => {
		const res = await $fetch<BlogPost>('/api/blog/create', {
			method: 'POST',
			body: { post }
		});

		await fetchPosts();
		return res;
	};

	const updatePost = async (post: Omit<BlogPost, 'created_at' | 'updated_at'>) => {
		const res = await $fetch<BlogPost>('/api/blog/update', {
			method: 'PATCH',
			body: { post }
		});

		await fetchPosts();
		return res;
	};

	const deletePost = async (id: string) => {
		await $fetch(`/api/blog/remove?id=${id}`, {
			method: 'DELETE'
		});
		await fetchPosts();
	};

	return {
		posts,
		usePost,
		fetchPosts,
		addPost,
		updatePost,
		deletePost
	};
}

export function useBlogPost(id: string) {
	const { posts, fetchPosts } = useBlogPosts();

	const post = computed(() => posts.value.find((p) => p.id === id) || null);

	onMounted(async () => {
		if (posts.value.length === 0) {
			await fetchPosts();
		}
	});

	return {
		post
	};
}

export function useSettings() {
	const settings = useState<{
		name?: string;
		description?: string;
		author?: string;
		themeColor?: string;
		favicon?: string;
		faviconPng?: string;
		github?: string;
		twitter?: string;
		instagram?: string;
		patreon?: string;
	}>('blog-settings', () => ({}));

	const fetchSettings = async () => {
		const res = await $fetch('/api/settings', {
			method: 'GET'
		});

		settings.value = res;
		return res;
	};

	const initSettings = async () => {
		if (Object.keys(settings.value).length === 0) {
			await fetchSettings();
		}
	};

	if (import.meta.server) {
		initSettings();
	}

	onMounted(async () => {
		await initSettings();
	});

	return {
		settings,
		fetchSettings
	};
}
