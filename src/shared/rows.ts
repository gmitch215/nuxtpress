/** libsql returns `rows`, D1 returns `results`; reading only one made every D1 count come back 0. */
export function rowsOf(result: unknown): any[] {
	const r = result as { rows?: unknown[]; results?: unknown[] } | null;
	return (r?.rows ?? r?.results ?? []) as any[];
}
