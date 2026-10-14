// The desktop app sends the snapshots as what changed (main/main.ts, through `Bridge.onSnapDelta`): far less to copy
// across a tick than a whole snapshot, which is what the old way did ten times a second. This puts them back together
// in the page (shared/snapDelta.ts), so unchanged parts stay the same objects, as on the phone. Any other bridge (the
// phone's, a plain browser's) is used as it is.

import type { Bridge, SnapMessage } from '../shared/ipc';
import { SnapAssembler } from '../shared/snapDelta';
import type { Snapshot } from '../shared/sim/snapshot';

export function withDeltas(raw: Bridge | undefined): Bridge | undefined {
  if (!raw?.onSnapDelta) return raw;
  const assembler = new SnapAssembler();
  const listeners = new Set<(s: Snapshot) => void>();
  let first: ((s: Snapshot) => void) | null = null;
  const firstSnap = new Promise<Snapshot>((res) => (first = res));
  // (listening from the start, so nothing is missed while the page sets itself up)
  raw.onSnapDelta((m: SnapMessage) => {
    let s: Snapshot;
    if (m.full) s = assembler.seed(m.full);
    else if (m.d && assembler.current) s = assembler.apply(m.d);
    else return void raw.snapResync?.(); // (nothing to build on: ask for the whole one)
    first?.(s);
    first = null;
    for (const f of listeners) f(s);
  });
  // (the contextBridge's object is frozen: a new one, with everything else passed through)
  const out: Bridge = Object.create(null);
  for (const k of Object.keys(raw) as (keyof Bridge)[]) (out as unknown as Record<string, unknown>)[k] = raw[k];
  out.onSnapshot = (cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  out.getSnapshot = () => (assembler.current ? Promise.resolve(assembler.current) : Promise.race([firstSnap, raw.getSnapshot()]));
  return out;
}
