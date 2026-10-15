import { ensureDatabase } from '~/server/utils/db';
import { sweepMedia } from '~/server/utils/media';

export default defineTask({
	meta: { name: 'media:sweep', description: 'Delete uploads no post or draft references' },
	async run() {
		await ensureDatabase();
		return { result: await sweepMedia(useRuntimeConfig().media.sweepGraceMs) };
	}
});
