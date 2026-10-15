import { INLINE_IMAGE_MAX_CHARS, INLINE_IMAGE_TYPES, isDataImage } from '~/shared/images';

export type InlineImageOptions = {
	maxDimension?: number;
	types?: readonly string[];
	output?: 'image/webp' | 'image/png';
};

const QUALITIES = [0.85, 0.7, 0.55, 0.4];
const MIN_DIMENSION = 160;

function readAsDataUrl(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => resolve(String(reader.result));
		reader.onerror = () => reject(new Error('Could not read the image file'));
		reader.readAsDataURL(file);
	});
}

async function decode(file: Blob): Promise<ImageBitmap> {
	try {
		return await createImageBitmap(file);
	} catch {
		throw new Error('That file is not a readable image');
	}
}

function encode(bitmap: ImageBitmap, scale: number, type: string, quality: number): string {
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(bitmap.width * scale));
	canvas.height = Math.max(1, Math.round(bitmap.height * scale));
	canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
	return canvas.toDataURL(type, quality);
}

/**
 * Turns an uploaded image into a data URL that fits the server's size cap. Raster images are
 * downscaled and re-encoded; GIF and ICO pass through because a canvas would flatten them.
 */
export async function fileToInlineImage(
	file: File,
	options: InlineImageOptions = {}
): Promise<string> {
	const { maxDimension = 1600, types = INLINE_IMAGE_TYPES, output = 'image/webp' } = options;

	if (!types.includes(file.type)) {
		throw new Error('Use a PNG, JPEG, WebP or GIF image');
	}

	if (file.type === 'image/gif' || file.type.includes('icon')) {
		const raw = await readAsDataUrl(file);
		if (!isDataImage(raw, types, INLINE_IMAGE_MAX_CHARS)) {
			throw new Error('That image is too large (limit is about 250 KB)');
		}
		return raw;
	}

	const bitmap = await decode(file);
	let scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));

	do {
		for (const quality of output === 'image/png' ? [1] : QUALITIES) {
			const result = encode(bitmap, scale, output, quality);
			if (isDataImage(result, INLINE_IMAGE_TYPES, INLINE_IMAGE_MAX_CHARS)) {
				bitmap.close();
				return result;
			}
		}
		scale *= 0.75;
	} while (Math.max(bitmap.width, bitmap.height) * scale >= MIN_DIMENSION);

	bitmap.close();
	throw new Error('That image is too large to embed, try a smaller one');
}
