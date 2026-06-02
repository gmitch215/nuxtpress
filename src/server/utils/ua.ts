export function isBotUA(ua: string): boolean {
	if (!ua) return true;
	const lower = ua.toLowerCase();
	return /(bot|crawler|spider|crawling|headlesschrome|phantomjs|preview|pingdom|fetch|wget|curl|monitor|uptime|chrome-lighthouse)/i.test(
		lower
	);
}

export function classifyDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (!ua) return 'desktop';
	const lower = ua.toLowerCase();
	if (/ipad|tablet/.test(lower)) return 'tablet';
	if (/mobi|android|iphone|ipod/.test(lower)) return 'mobile';
	return 'desktop';
}

export function classifyBrowser(ua: string): string {
	if (!ua) return 'other';
	const lower = ua.toLowerCase();
	if (lower.includes('edg/')) return 'edge';
	if (lower.includes('chrome/') && !lower.includes('chromium')) return 'chrome';
	if (lower.includes('firefox/')) return 'firefox';
	if (lower.includes('safari/') && !lower.includes('chrome')) return 'safari';
	if (lower.includes('opr/') || lower.includes('opera')) return 'opera';
	return 'other';
}

export async function visitorId(
	ip: string,
	ua: string,
	salt: string,
	day: string
): Promise<string> {
	const enc = new TextEncoder().encode(`${salt}:${day}:${ip || 'noip'}:${ua || 'noua'}`);
	const digest = await crypto.subtle.digest('SHA-256', enc);
	const bytes = new Uint8Array(digest);
	let hex = '';
	for (let i = 0; i < 12 && i < bytes.length; i++) {
		hex += bytes[i].toString(16).padStart(2, '0');
	}
	return hex;
}
