import { kv } from 'hub:kv';
import { ensureDatabase } from '~/server/utils/db';
import { cloudflareEnv, mailActive, MailError } from '~/server/utils/mail';
import { siteOrigin, subscribe } from '~/server/utils/subscribers';
import { firstZodIssueMessage, subscribeSchema } from '~/shared/schemas';

const RATE_LIMIT_SECONDS = 60;

async function clientKey(event: Parameters<typeof getRequestHeader>[0]): Promise<string> {
	const ip =
		getRequestHeader(event, 'cf-connecting-ip') ||
		getRequestHeader(event, 'x-real-ip') ||
		getRequestHeader(event, 'x-forwarded-for')?.split(',')[0]?.trim() ||
		getRequestIP(event) ||
		'unknown';
	const salt = useRuntimeConfig().analyticsSalt || 'dev-salt';
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:${ip}`));
	return [...new Uint8Array(digest)]
		.slice(0, 12)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export default defineEventHandler(async (event) => {
	await ensureDatabase();
	const env = cloudflareEnv(event);

	if (!(await mailActive(env))) {
		throw createError({ statusCode: 404, statusMessage: 'Subscriptions are not enabled' });
	}

	const parsed = subscribeSchema.safeParse(await readBody(event));
	if (!parsed.success) {
		throw createError({
			statusCode: 400,
			statusMessage: firstZodIssueMessage(parsed.error.issues, 'Enter a valid email address')
		});
	}

	if (parsed.data.website) return { ok: true };

	const origin = await siteOrigin();
	if (!origin) {
		throw createError({ statusCode: 503, statusMessage: 'Subscriptions are not ready yet' });
	}

	const limitKey = `nuxtpress:rl:subscribe:${await clientKey(event)}`;
	if (await kv.get(limitKey)) {
		throw createError({
			statusCode: 429,
			statusMessage: 'Too many attempts, try again in a minute'
		});
	}
	await kv.set(limitKey, '1', { ttl: RATE_LIMIT_SECONDS });

	try {
		await subscribe(env, parsed.data.email, origin);
	} catch (error) {
		if (error instanceof MailError) {
			console.error('subscribe confirmation failed:', error.message);
			throw createError({
				statusCode: 502,
				statusMessage: 'The confirmation email could not be sent, try again later'
			});
		}
		throw error;
	}

	return { ok: true };
});
