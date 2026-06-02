import type { APIRequestContext } from '@playwright/test';
import { request as plRequest } from '@playwright/test';
import { TEST_ADMIN, loginViaApi } from './auth';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8787';

export async function createPost(
	request: APIRequestContext,
	post: { title: string; slug: string; content: string; tags?: string[]; thumbnail_url?: string }
) {
	const res = await request.post('/api/blog/create', {
		data: {
			post: {
				...post,
				tags: post.tags ?? [],
				content: post.content.padEnd(60, ' filler text to clear validation minimum')
			}
		}
	});
	if (!res.ok()) throw new Error(`create post failed: ${res.status()} ${await res.text()}`);
	return res.json();
}

export async function listPosts(request: APIRequestContext) {
	const res = await request.get('/api/blog/list');
	return res.json();
}

export async function deletePost(request: APIRequestContext, id: string) {
	const res = await request.delete(`/api/blog/remove?id=${id}`);
	return res.ok();
}

/** standalone authed APIRequestContext for tests that run their page in anon mode */
export async function adminApi() {
	const ctx = await plRequest.newContext({ baseURL: BASE_URL });
	await loginViaApi(ctx, TEST_ADMIN);
	return ctx;
}
