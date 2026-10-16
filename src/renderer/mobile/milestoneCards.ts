// The town's rank changes and its firsts, each told once as a framed card (sim/tiers.ts, sim/milestones.ts). Reads the
// snapshot only: the first snapshot's cards are taken as seen (a town loaded, or an older save, is not told its past),
// and each new key after that is shown. Several at once (a catch-up) are shown one after another, the newest last.

import type { Bridge } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import { showReveal, type RevealCard } from './revealCard';

/** The cards a snapshot holds, by key: the firsts (oldest first) and the latest rank change, in the reveal card's shape
 *  (mobile/revealCard.ts): the kind as the small line over the title, the line as lore, the day as the rarity line. */
export function cardsOf(s: Snapshot): { key: string; card: RevealCard }[] {
  const out: { key: string; card: RevealCard }[] = [];
  for (const m of [...(s.annals.milestones ?? [])].reverse()) out.push({ key: `m:${m.id}`, card: { key: `m:${m.id}`, kind: 'A first for the town', icon: m.icon, title: m.title, lore: m.line, rarity: `Day ${m.day}`, tone: 'gold' } });
  const r = s.rank.last;
  if (r) {
    const lore = r.kind === 'rise' ? `${r.from} no longer. ${r.line}` : r.line;
    out.push({ key: r.key, card: { key: r.key, kind: r.kind === 'rise' ? 'The town rises' : 'The town falls', icon: r.kind === 'rise' ? 'good' : 'loss', title: r.kind === 'rise' ? `${r.to}` : `Fallen to ${r.to}`, lore: r.memory ? `${lore} ${r.memory}` : lore, rarity: `Day ${r.day}`, tone: r.kind === 'rise' ? 'gold' : 'dark' } });
  }
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
