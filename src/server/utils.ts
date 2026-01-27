import { H3Event } from 'h3';
import { kv } from 'hub:kv';

export async function ensureLoggedIn(event: H3Event) {
	const config = useRuntimeConfig();
	if (!config.password || config.password === 'password') {
		throw createError({
			statusCode: 500,
			statusMessage: 'App does not have a configured password, serving read-only state'
		});
	}

	const token = getCookie(event, 'admin');
	const ip = getRequestIP(event);
	const sessionId = ip || getCookie(event, 'admin_session_id');

	if (!token) {
		throw createError({
			statusCode: 401,
			statusMessage: 'Unauthorized'
		});
	}

	if (!sessionId) {
		throw createError({
			statusCode: 400,
			statusMessage: 'Unable to identify client'
		});
	}

	const storedToken = await kv.get(`nuxtpress:admin_session:${sessionId}`);
	if (storedToken !== token) {
		throw createError({
			statusCode: 403,
			statusMessage: 'Invalid Session'
		});
	}
}

// Note: Table creation is now handled by Drizzle migrations
// Run: npx nuxt db generate && npx nuxt db migrate
// This function is kept for backward compatibility but is no longer needed
export function checkTable() {
	// Table schema is now managed by Drizzle ORM in server/db/schema.ts
	// To create/update tables, run: npx nuxt db generate && npx nuxt db migrate
}
