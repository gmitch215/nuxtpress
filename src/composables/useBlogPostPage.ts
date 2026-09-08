import { datedPostPath, slugPostPath, type BlogPost } from '~/shared/types';

type Query = { slug: string; year?: number; month?: number; day?: number };

function normalizeSlug(raw: string): string {
	let slug = raw;
	if (slug.endsWith('.html')) slug = slug.slice(0, -5);
	else if (slug.endsWith('.htm')) slug = slug.slice(0, -4);
	try {
		slug = decodeURIComponent(slug);
	} catch {
		// a malformed escape sequence is not a reason to drop the lookup
	}
	return slug;
}

function notFound(): never {
	throw createError({
		statusCode: 404,
		statusMessage: 'Blog Post Not Found',
		message: `The blog post you're looking for doesn't exist or may have been removed.`,
		fatal: false
	});
}

function throwFor(error: unknown): never {
	const err = error as {
		statusCode?: number;
		status?: number;
		statusMessage?: string;
		message?: string;
	};
	const raw = err.statusCode ?? err.status ?? 500;
	const statusCode = Number.isFinite(Number(raw)) ? Number(raw) : 500;

	if (statusCode === 404) notFound();

	throw createError({
		statusCode,
		statusMessage: err.statusMessage || err.message || 'Unable to load blog post',
		fatal: false
	});
}

/**
 * Loads and describes one post for either permalink shape. `date` omitted resolves the newest
 * post with that slug; both shapes stay valid and the configured URL style only decides which
 * one is canonical.
 *
 * Everything that needs the Nuxt instance is resolved before the data await, because the
 * instance is not available to continuations after it.
 */
export async function useBlogPostPage(
	rawSlug: string,
	date?: { year: number; month: number; day: number }
) {
	const nuxtApp = useNuxtApp();
	const { style } = usePostUrl();
	const seo = useBlogPostSeoContext();

	const slug = normalizeSlug(rawSlug);

	const validDate =
		!date ||
		(Number.isInteger(date.year) &&
			Number.isInteger(date.month) &&
			Number.isInteger(date.day) &&
			date.year >= 2000 &&
			date.year <= new Date().getUTCFullYear() + 1 &&
			date.month >= 1 &&
			date.month <= 12 &&
			date.day >= 1 &&
			date.day <= 31);

	const key = date
		? `blog-post-${slug}-${date.year}-${date.month}-${date.day}`
		: `blog-post-${slug}`;

	const { data, error } = await useAsyncData(key, async () => {
		if (!validDate) return null;

		const query: Query = { slug };
		if (date) {
			query.year = date.year;
			query.month = date.month;
			query.day = date.day;
		}

		const res = await $fetch<BlogPost>('/api/blog/find', { method: 'GET', query });
		return {
			...res,
			created_at: new Date(res.created_at),
			updated_at: new Date(res.updated_at)
		};
	});

	if (error.value) throwFor(error.value);
	if (!data.value) notFound();

	// the guard above throws on null, so the loaded post is non-null past this point
	const post = data as Ref<BlogPost | null>;

	const primaryPath = computed(() =>
		style.value === 'slug' ? slugPostPath(post.value!) : datedPostPath(post.value!)
	);

	// only an await written directly in setup gets its Nuxt context restored by the compiler, so
	// the head composables below have to be run explicitly against the captured instance
	nuxtApp.runWithContext(() => applyBlogPostSeo(seo, post, primaryPath));

	return { post, slug, primaryPath };
}
