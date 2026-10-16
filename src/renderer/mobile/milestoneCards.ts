// The town's rank changes and its firsts, each told once as a framed card (sim/tiers.ts, sim/milestones.ts). Reads the
// snapshot only: the first snapshot's cards are taken as seen (a town loaded, or an older save, is not told its past),
// and each new key after that is shown. Several at once (a catch-up) are shown one after another, the newest last.

import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { showReveal, type RevealCard } from './revealStub';

/** The cards a snapshot holds, by key: the firsts (oldest first) and the latest rank change. */
export function cardsOf(s: Snapshot): { key: string; card: RevealCard }[] {
  const out: { key: string; card: RevealCard }[] = [];
  for (const m of [...(s.annals.milestones ?? [])].reverse()) out.push({ key: `m:${m.id}`, card: { kind: 'first', icon: m.icon, title: m.title, line: m.line, foot: `Day ${m.day}` } });
  const r = s.rank.last;
  if (r) out.push({ key: r.key, card: { kind: r.kind, icon: r.kind === 'rise' ? 'good' : 'loss', title: r.kind === 'rise' ? `${r.to}` : `Fallen to ${r.to}`, line: r.kind === 'rise' ? `${r.from} no longer. ${r.line}` : r.line, aside: r.memory, foot: `Day ${r.day}` } });
  return out;
}

export function watchMilestones(bridge: Bridge): void {
  let seen: Set<string> | null = null;
  bridge.onSnapshot((s) => {
    if (s.catchingUp != null) return;
    const cards = cardsOf(s);
    if (!seen) {
      seen = new Set(cards.map((c) => c.key));
      return;
    }
    for (const c of cards) {
      if (seen.has(c.key)) continue;
      seen.add(c.key);
      showReveal(c.card);
    }
  });
}
