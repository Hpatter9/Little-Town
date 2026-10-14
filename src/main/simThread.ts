// The desktop app's game thread: the sim, its catch-up after time away, the autosave's writing out and the alerts'
// look ahead run here (shared/simHost.ts, as the phone's Web Worker does), so the main process is free for the windows
// and the snapshots it hands them. Built into out/simThread.js; started by main/simClient.ts.

import { parentPort } from 'node:worker_threads';
import { startSimHost, type ToHost } from '../shared/simHost';

if (parentPort) {
  const port = parentPort;
  const take = startSimHost((m) => port.postMessage(m));
  port.on('message', (m: ToHost) => take(m));
}
