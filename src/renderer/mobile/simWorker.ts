// The phone's sim worker: the game runs here, off the page's thread (shared/simHost.ts), so drawing and taps never
// wait on it. Built into out/web/simWorker.js by tools/build-web.mjs. Where a browser can't start a worker, the page
// loads this same file as a plain script instead, and runs the game itself through `__simHost`.

import { startSimHost, type FromHost, type ToHost } from '../../shared/simHost';

const scope = self as unknown as {
  postMessage(m: FromHost): void;
  onmessage: ((e: MessageEvent<ToHost>) => void) | null;
  importScripts?: unknown;
  __simHost?: typeof startSimHost;
};
if (typeof scope.importScripts === 'function') {
  const take = startSimHost((m) => scope.postMessage(m));
  scope.onmessage = (e) => take(e.data);
} else scope.__simHost = startSimHost;
