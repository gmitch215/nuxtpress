import { ensureDatabase } from '~/server/utils/db';
import { checkLink, removeSubscriber } from '~/server/utils/subscribers';
import { subscriberLinkSchema } from '~/shared/schemas';

// serves both the unsubscribe page (JSON body) and RFC 8058 one-click (id and token in the query)
export default defineEventHandler(async (event) => {
	await ensureDatabase();

	const query = getQuery(event);
	const body = await readBody(event).catch(() => null);
	const source = body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
	const parsed = subscriberLinkSchema.safeParse({
		id: query.id ?? source.id,
		token: query.token ?? source.token
	});
	if (!parsed.success || !(await checkLink('unsubscribe', parsed.data.id, parsed.data.token))) {
		throw createError({ statusCode: 400, statusMessage: 'This link is invalid or has expired' });
	}

	await removeSubscriber(parsed.data.id);
	return { ok: true };
});
