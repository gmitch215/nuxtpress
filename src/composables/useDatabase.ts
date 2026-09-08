import type { BlogPost, BlogPostData, BlogPostSummary } from '~/shared/types';

export function useBlogPosts() {
	// fetched during SSR so post links are in the served HTML for crawlers and no-JS clients
	const { data, refresh } = useAsyncData<BlogPostSummary[]>(
		'blog-posts',
		() => $fetch<BlogPostSummary[]>('/api/blog/list'),
		{ default: () => [] }
	);

	const posts = computed(() => data.value ?? []);

	const fetchPosts = async () => {
		await refresh();
		return posts.value;
	};

	const addPost = async (post: BlogPostData): Promise<BlogPost> => {
		const res = await $fetch<BlogPost>('/api/blog/create', {
			method: 'POST',
			body: { post }
		});

		await refresh();
		return res;
	};

	const updatePost = async (post: BlogPostData & { id: string }) => {
		const res = await $fetch<BlogPost>('/api/blog/update', {
			method: 'PATCH',
			body: { post }
		});

		await refresh();
		return res;
	};

	const deletePost = async (id: string) => {
		await $fetch(`/api/blog/remove?id=${id}`, {
			method: 'DELETE'
		});
		await refresh();
	};

	return {
		posts,
		fetchPosts,
		addPost,
		updatePost,
		deletePost
	};
}

export type SettingsState = {
	name?: string;
	description?: string;
	bio?: string;
	author?: string;
	themeColor?: string;
	favicon?: string;
	faviconPng?: string;
	website?: string;
	github?: string;
	twitter?: string;
	instagram?: string;
	patreon?: string;
	linkedin?: string;
	discord?: string;
	supportEmail?: string;
	urlStyle?: 'dated' | 'slug';
	message?: {
		text: string;
		icon?: string | null;
		ttl: number;
		type: 'success' | 'warning' | 'error' | 'info';
		link?: string | null;
	} | null;
};

export function useSettings() {
	const settings = useState<SettingsState>('blog-settings', () => ({}));

	const fetchSettings = async () => {
		const res = await $fetch<SettingsState>('/api/settings', {
			method: 'GET'
		});

		settings.value = res;
		return res;
	};

	return {
		settings,
		fetchSettings
	};
}

export function useDrafts() {
	const drafts = useState<Partial<BlogPostData>[]>('blog-drafts', () => []);

	const fetchDrafts = async () => {
		const res = await $fetch<{ drafts: Partial<BlogPostData>[] }>('/api/blog/draft', {
			method: 'GET'
		});

		drafts.value = res.drafts;
		return res.drafts;
	};

	const saveDraft = async (draft: Partial<BlogPostData> & { slug: string }) => {
		await $fetch('/api/blog/draft', {
			method: 'POST',
			body: { post: draft }
		});
		await fetchDrafts();
	};

	return {
		drafts,
		fetchDrafts,
		saveDraft
	};
}
