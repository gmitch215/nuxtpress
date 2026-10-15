import type { MediaItem } from '~/shared/media';

export type UploadedMedia = MediaItem & { url: string };

/** PUTs the raw file body so the Worker can stream it to storage; fetch cannot report upload progress. */
export function uploadMedia(
	file: Blob,
	mime: string,
	onProgress?: (fraction: number) => void
): Promise<UploadedMedia> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open('PUT', '/api/media/upload');
		xhr.setRequestHeader('Content-Type', mime);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) onProgress?.(event.loaded / event.total);
		};
		xhr.onerror = () => reject(new Error('The upload failed, check your connection'));
		xhr.onload = () => {
			let body: any = null;
			try {
				body = JSON.parse(xhr.responseText);
			} catch {
				// the message below covers a non-JSON failure
			}
			if (xhr.status >= 200 && xhr.status < 300 && body?.key) {
				resolve(body as UploadedMedia);
			} else {
				reject(new Error(body?.statusMessage || `The upload failed (${xhr.status})`));
			}
		};
		xhr.send(file);
	});
}

export type PreparedImage = { blob: Blob; mime: string; width: number; height: number };

/** Slides are shrunk and re-encoded as WebP in the browser; GIFs pass through so they keep animating. */
export async function prepareSlide(file: File, maxDimension = 2000): Promise<PreparedImage> {
	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(file);
	} catch {
		throw new Error('That file is not a readable image');
	}
	const original = {
		blob: file as Blob,
		mime: file.type,
		width: bitmap.width,
		height: bitmap.height
	};
	if (file.type === 'image/gif') {
		bitmap.close();
		return original;
	}

	const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	bitmap.close();

	const encoded: Blob | null = await new Promise((resolve) =>
		canvas.toBlob(resolve, 'image/webp', 0.85)
	);
	if (!encoded || encoded.type !== 'image/webp' || encoded.size >= file.size) {
		return { ...original, width: canvas.width, height: canvas.height };
	}
	return { blob: encoded, mime: 'image/webp', width: canvas.width, height: canvas.height };
}

/** One frame near the start of a video, as a WebP. Resolves null when the browser cannot decode the file. */
export function captureVideoPoster(file: File, timeoutMs = 8000): Promise<Blob | null> {
	return new Promise((resolve) => {
		const url = URL.createObjectURL(file);
		const video = document.createElement('video');
		video.muted = true;
		video.playsInline = true;
		video.preload = 'auto';

		const finish = (blob: Blob | null) => {
			clearTimeout(timer);
			URL.revokeObjectURL(url);
			video.removeAttribute('src');
			video.load();
			resolve(blob);
		};
		const timer = setTimeout(() => finish(null), timeoutMs);

		let target = 0;
		const draw = () => {
			const scale = Math.min(1, 1280 / Math.max(video.videoWidth, 1));
			const canvas = document.createElement('canvas');
			canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
			canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
			canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
			canvas.toBlob((blob) => finish(blob), 'image/webp', 0.85);
		};

		video.onerror = () => finish(null);
		video.onloadedmetadata = () => {
			const duration = Number.isFinite(video.duration) ? video.duration : 0;
			target = Math.min(1, duration / 10);
			if (target > 0) video.currentTime = target;
		};
		// a frame at time zero never fires `seeked`, so it is drawn as soon as it has loaded
		video.onloadeddata = () => {
			if (target === 0) draw();
		};
		video.onseeked = draw;
		video.src = url;
	});
}
