/**
 * Real crawler and automation tokens. Deliberately narrow: the previous list matched bare
 * "fetch", "preview" and "monitor", which silently dropped ordinary traffic and every
 * headless-browser test run along with it.
 */
const BOT_RE =
	/(bot\b|bot\/|[a-z]bot|crawler|crawling|spider|scraper|slurp|archiver|feedfetcher|pingdom|uptimerobot|statuscake|semrush|ahrefs|mj12|dotbot|petalbot|bytespider|gptbot|oai-searchbot|chatgpt-user|claudebot|claude-web|anthropic-ai|perplexitybot|google-extended|applebot|bingpreview|yandex|baiduspider|duckduckbot|facebookexternalhit|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|embedly|quora link preview|showyoubot|outbrain|vkshare|w3c_validator|chrome-lighthouse|phantomjs|puppeteer|playwright|headlesschrome|python-requests|go-http-client|okhttp|axios\/|node-fetch|libwww-perl|curl\/|wget\/)/i;

/** Automation UAs that only ever appear in our own e2e runs. */
const AUTOMATION_RE = /(headlesschrome|playwright|puppeteer|chrome-lighthouse|phantomjs)/i;

export function isBotUA(ua: string): boolean {
	if (!ua) return true;
	// dev and test drive the app through a headless browser; treating that as a bot makes the
	// analytics pipeline untestable end to end
	if (import.meta.dev && AUTOMATION_RE.test(ua)) return false;
	return BOT_RE.test(ua);
}

export function classifyDevice(ua: string): 'mobile' | 'tablet' | 'desktop' {
	if (!ua) return 'desktop';
	const lower = ua.toLowerCase();
	if (/ipad|tablet|playbook|silk|(android(?!.*mobi))/.test(lower)) return 'tablet';
	if (/mobi|android|iphone|ipod|iemobile|blackberry|opera mini/.test(lower)) return 'mobile';
	return 'desktop';
}

export function classifyBrowser(ua: string): string {
	if (!ua) return 'other';
	const lower = ua.toLowerCase();
	if (lower.includes('edg/') || lower.includes('edga/') || lower.includes('edgios/')) return 'edge';
	if (lower.includes('opr/') || lower.includes('opera')) return 'opera';
	if (lower.includes('samsungbrowser')) return 'samsung';
	if (lower.includes('firefox/') || lower.includes('fxios/')) return 'firefox';
	if (lower.includes('crios/')) return 'chrome';
	if (lower.includes('chrome/') && !lower.includes('chromium')) return 'chrome';
	if (lower.includes('chromium')) return 'chromium';
	if (lower.includes('safari/')) return 'safari';
	return 'other';
}

export function classifyOs(ua: string): string {
	if (!ua) return 'other';
	const lower = ua.toLowerCase();
	// windows phone has to lose to windows nt only after its own check
	if (lower.includes('windows phone')) return 'windows phone';
	if (lower.includes('windows')) return 'windows';
	if (/iphone|ipad|ipod|ios/.test(lower)) return 'ios';
	if (lower.includes('android')) return 'android';
	if (lower.includes('cros')) return 'chromeos';
	if (/mac os x|macintosh/.test(lower)) return 'macos';
	if (lower.includes('linux')) return 'linux';
	return 'other';
}

const COUNTRY_RE = /^[A-Z]{2}$/;

/**
 * Two-letter country from Cloudflare's edge header. Nothing finer is collected, and anything
 * that is not a plain ISO country code (including CF's "XX"/"T1" placeholders) becomes unknown.
 */
export function classifyCountry(raw: string | undefined): string {
	const value = String(raw || '').toUpperCase();
	if (!COUNTRY_RE.test(value) || value === 'XX' || value === 'T1') return 'unknown';
	return value;
}

/** Referrer host only; the full URL can carry search terms and personal identifiers. */
export function referrerHost(raw: string | undefined, selfHost: string): string {
	if (!raw) return 'direct';
	try {
		const host = new URL(raw).host.toLowerCase().replace(/^www\./, '');
		if (!host) return 'direct';
		return host === selfHost.toLowerCase().replace(/^www\./, '') ? 'internal' : host;
	} catch {
		return 'direct';
	}
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
		hex += (bytes[i] ?? 0).toString(16).padStart(2, '0');
	}
	return hex;
}
