export const MIN_SECRET_LENGTH = 32;

/** The first candidate long enough to key the seals and signed links, or null. */
export function firstSecret(...candidates: (string | null | undefined)[]): string | null {
	return candidates.find((c) => typeof c === 'string' && c.length >= MIN_SECRET_LENGTH) ?? null;
}
