import type { APIRequestContext } from '@playwright/test';
import { loginViaApi } from './auth';

export async function createPost(
	request: APIRequestContext,
	post: { title: string; slug: string; content: string; tags?: string[]; thumbnail_url?: string }
) {
	await loginViaApi(request);
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
	await loginViaApi(request);
	const res = await request.delete(`/api/blog/remove?id=${id}`);
	return res.ok();
}
