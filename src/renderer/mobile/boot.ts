// The phone page's first script, tiny and loaded in the head (index.html): it starts the game's worker and sends it
// the saved town at once, so the catch-up after time away is under way while the page's own 2 MB script (mobile.js)
// is still loading. What the worker says meanwhile is kept for the page (mobileBridge.ts `startGame` takes it all
// over). A browser with no workers, or `?inpage`, is left to mobileBridge as before.

const SAVE_KEY = 'littletown.save';
const ALERTS_KEY = 'littletown.alerts';

interface Boot {
  worker: Worker;
  early: unknown[];
  take: ((m: unknown) => void) | null;
  save: string | null;
}

function readKey(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

try {
  if (typeof Worker !== 'undefined' && !/[?&]inpage\b/.test(location.search)) {
    const save = readKey(SAVE_KEY);
    let alerts: unknown = {};
    try {
      alerts = JSON.parse(readKey(ALERTS_KEY) ?? '{}');
    } catch {}
    const worker = new Worker('simWorker.js');
    const boot: Boot = { worker, early: [], take: null, save };
    worker.onmessage = (e: MessageEvent) => (boot.take ? boot.take(e.data) : boot.early.push(e.data));
    worker.onerror = (e) => console.error('[boot] the sim worker failed', e);
    // (the worker tidies the alert settings itself: simHost.ts)
    worker.postMessage({ t: 'init', save, now: Date.now(), hidden: document.hidden, alerts });
    (window as unknown as { __simBoot?: Boot }).__simBoot = boot;
  }
} catch (err) {
  console.warn('[boot] no early start', err);
}
