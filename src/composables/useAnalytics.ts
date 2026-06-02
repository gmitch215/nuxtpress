type TrackPayload = {
	slug: string;
	active: number;
	depth: 0 | 25 | 50 | 75 | 100;
	referrer: 'external' | 'internal' | 'direct';
	prevSlug?: string;
	isExit: boolean;
};

function dntEnabled(): boolean {
	if (typeof navigator === 'undefined') return false;
	const dnt = (navigator as any).doNotTrack || (window as any).doNotTrack;
	return dnt === '1' || dnt === 'yes';
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

export function useAnalytics(slug: () => string) {
	if (!import.meta.client) return { start() {}, stop() {} };

	let started = false;
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
			const ref = new URL(document.referrer);
			if (ref.host === location.host) return 'internal';
			return 'external';
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
		maxDepth = Math.max(maxDepth, depthFor((scrolled / totalScrollable) * 100));
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

	function flush(isExit: boolean) {
		tick();
		const cur = slug();
		if (!cur) return;
		const payload: TrackPayload = {
			slug: cur,
			active: Math.round(activeMs),
			depth: maxDepth,
			referrer: readReferrer(),
			isExit
		};
		send(payload);
		activeMs = 0;
	}

	function start() {
		if (started || dntEnabled()) return;
		started = true;
		visible = document.visibilityState === 'visible';
		if (visible) resetIdle();
		readDepth();
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
		}, 15000);
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
	}

	return { start, stop };
}
