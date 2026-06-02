export default defineEventHandler(async (event) => {
	const session = await getUserSession(event);
	const user = session.user;
	return {
		loggedIn: Boolean(user),
		user: user
			? {
					id: user.id,
					username: user.username,
					displayName: user.displayName,
					role: user.role,
					avatarPathname: user.avatarPathname ?? null
				}
			: null
	};
});
