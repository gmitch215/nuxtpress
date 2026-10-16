import { sessionPassword } from '~/server/utils/session-password';
import { firstSecret } from '~/shared/secret';

export default defineEventHandler(async (event) => {
	try {
		const cfg = useRuntimeConfig(event);
		// nuxt-auth-utils reads the password from this request's config, so hand it the stored one
		if (firstSecret(cfg.session?.password)) return;
		const password = await sessionPassword();
		if (password && cfg.session) cfg.session.password = password;
	} catch (error) {
		// never block a request because session bootstrap failed; login routes will surface a clear 500
		console.warn('session bootstrap failed:', error);
	}
});
