import { expect, type APIRequestContext } from '@playwright/test';
import { loginViaApi } from './auth';
import { makePng, makeWav } from './png';

export type Uploaded = { key: string; url: string; mime: string; size: number };

export async function upload(
	request: APIRequestContext,
	mime: string,
	buffer: Buffer
): Promise<Uploaded> {
	const res = await request.put('/api/media/upload', {
		headers: { 'content-type': mime },
		data: buffer
	});
	expect(res.ok(), await res.text()).toBe(true);
	return res.json();
}

export const uploadPng = (request: APIRequestContext, size = 16) =>
	upload(request, 'image/png', makePng(size, size));
export const uploadWav = (request: APIRequestContext) => upload(request, 'audio/wav', makeWav());
export const uploadVideo = (request: APIRequestContext) =>
	upload(request, 'video/webm', Buffer.from('not really a video but the server only stores bytes'));

export async function createMediaPost(
	request: APIRequestContext,
	post: Record<string, unknown>,
	extra: Record<string, unknown> = {},
	options: { login?: boolean } = {}
) {
	if (options.login !== false) await loginViaApi(request);
	const res = await request.post('/api/blog/create', {
		data: { post: { tags: [], content: '', slug: `media-${Date.now()}`, ...post }, ...extra }
	});
	return res;
}

export async function mediaExists(request: APIRequestContext, url: string): Promise<boolean> {
	return (await request.get(url)).status() === 200;
}
