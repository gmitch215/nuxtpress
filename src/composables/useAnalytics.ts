type TrackPayload = {
	slug: string;
	kind: 'post' | 'page';
	vsid: string;
	active: number;
	depth: 0 | 25 | 50 | 75 | 100;
	referrer: 'external' | 'internal' | 'direct';
	referrerUrl?: string;
	isExit: boolean;
};

/** Respects Do Not Track and Global Privacy Control before anything is sent. */
function optedOut(): boolean {
	if (typeof navigator === 'undefined') return false;
	const nav = navigator as Navigator & { doNotTrack?: string; globalPrivacyControl?: boolean };
	const dnt = nav.doNotTrack || (window as unknown as { doNotTrack?: string }).doNotTrack;
	return dnt === '1' || dnt === 'yes' || nav.globalPrivacyControl === true;
}

function send(payload: TrackPayload) {
	try {
		const body = JSON.stringify(payload);
		if (navigator.sendBeacon) {
			const blob = new Blob([body], { type: 'application/json' });
			if (navigator.sendBeacon('/api/analytics/track', blob)) return;
		}
		fetch('/api/analytics/track', {
			method: 'POST',
			body,
			headers: { 'Content-Type': 'application/json' },
			keepalive: true,
			credentials: 'same-origin'
		}).catch(() => {});
	} catch {}
}

export function useAnalytics(slug: () => string, kind: 'post' | 'page' = 'post') {
	if (!import.meta.client) return { start() {}, stop() {} };

	let started = false;
	let visitId = '';
	let activeMs = 0;
	let lastTickAt = 0;
	let idleTimer: number | null = null;
	let heartbeat: number | null = null;
	let maxDepth: 0 | 25 | 50 | 75 | 100 = 0;
	let visible = false;
	let unloaded = false;

	function depthFor(pct: number): 0 | 25 | 50 | 75 | 100 {
		if (pct >= 95) return 100;
		if (pct >= 75) return 75;
		if (pct >= 50) return 50;
		if (pct >= 25) return 25;
		return 0;
	}

	function readReferrer(): 'external' | 'internal' | 'direct' {
		try {
			if (!document.referrer) return 'direct';
			return new URL(document.referrer).host === location.host ? 'internal' : 'external';
		} catch {
			return 'direct';
		}
	}

	function tick() {
		if (!visible) return;
		const now = performance.now();
		if (lastTickAt > 0) activeMs += now - lastTickAt;
		lastTickAt = now;
	}

	function pause() {
		if (visible) tick();
		visible = false;
		lastTickAt = 0;
	}

	function resume() {
		if (visible) return;
		visible = true;
		lastTickAt = performance.now();
	}

	function resetIdle() {
		if (idleTimer) clearTimeout(idleTimer);
		resume();
		idleTimer = window.setTimeout(() => pause(), 30000);
	}

	function readDepth() {
		const doc = document.documentElement;
		const totalScrollable = Math.max(1, doc.scrollHeight - window.innerHeight);
		const scrolled = Math.min(totalScrollable, window.scrollY);
		const next = depthFor((scrolled / totalScrollable) * 100);
		if (next > maxDepth) maxDepth = next;
	}

	let rafPending = false;
	function onScroll() {
		if (rafPending) return;
		rafPending = true;
		requestAnimationFrame(() => {
			rafPending = false;
			readDepth();
			resetIdle();
		});
	}

	function onVisibility() {
		if (document.visibilityState === 'visible') resetIdle();
		else pause();
	}

	function onActivity() {
		resetIdle();
	}

	// active time and depth are reported cumulatively per visit, so the server can fold a
	// visit's beacons with max() instead of counting every heartbeat as another view
	function flush(isExit: boolean) {
		tick();
		const cur = slug();
		if (!cur) return;
		send({
			slug: cur,
			kind,
			vsid: visitId,
			active: Math.round(activeMs),
			depth: maxDepth,
			referrer: readReferrer(),
			referrerUrl: document.referrer || undefined,
			isExit
		});
	}

	function onPageHide() {
		if (unloaded) return;
		unloaded = true;
		flush(true);
	}

	function onBeforeUnload() {
		if (unloaded) return;
		unloaded = true;
		flush(true);
	}

	function start() {
		if (started || optedOut()) return;
		started = true;
		unloaded = false;
		visitId = crypto.randomUUID().replace(/-/g, '').slice(0, 16);
		visible = document.visibilityState === 'visible';
		if (visible) resetIdle();
		readDepth();
		// a view counts on arrival; waiting for the heartbeat lost every short visit
		flush(false);
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('keydown', onActivity, { passive: true });
		window.addEventListener('mousemove', onActivity, { passive: true });
		document.addEventListener('visibilitychange', onVisibility);
		window.addEventListener('pagehide', onPageHide);
		window.addEventListener('beforeunload', onBeforeUnload);
		heartbeat = window.setInterval(() => {
			if (unloaded) return;
			tick();
			if (activeMs > 0) flush(false);
		}, 30000);
	}

	function stop() {
		if (!started) return;
		if (heartbeat) clearInterval(heartbeat);
		if (idleTimer) clearTimeout(idleTimer);
		window.removeEventListener('scroll', onScroll);
		window.removeEventListener('keydown', onActivity);
		window.removeEventListener('mousemove', onActivity);
		document.removeEventListener('visibilitychange', onVisibility);
		window.removeEventListener('pagehide', onPageHide);
		window.removeEventListener('beforeunload', onBeforeUnload);
		if (!unloaded) flush(true);
		started = false;
		maxDepth = 0;
		activeMs = 0;
		visitId = '';
	}

	return { start, stop };
}
