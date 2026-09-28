// Looking ahead (DESIGN §10): the sim is deterministic and nothing the player does can change it while the
// game is closed, so running a copy of it forward tells exactly when raids will hit and what else will
// happen. Used to schedule phone alerts on close.

import { RAID_KIND_BY_ID } from '../data/raids';
import { Sim } from './sim';
import type { GameState } from './state';

export type ForecastKind = 'raid' | 'death' | 'expedition' | 'choice';

export interface ForecastEvent {
  kind: ForecastKind;
  /** Game tick it happens (a raid: when the raiders reach town). */
  tick: number;
  title: string;
  text: string;
}

/** Run a copy of the game `ticks` ahead and list what's coming (up to `max` events). */
export function forecast(state: GameState, ticks: number, max = 12): ForecastEvent[] {
  const s: GameState = JSON.parse(JSON.stringify(state));
  const sim = new Sim(s);
  const out: ForecastEvent[] = [];
  const seenRaids = new Set<number>();
  const seenPrompts = new Set(s.prompts.map((p) => p.id));
  let lastNotice = s.notices.at(-1)?.id ?? 0;
  for (let i = 0; i < ticks && out.length < max && !s.gameOver && !s.paused; i++) {
    sim.step();
    if (s.raid && !seenRaids.has(s.raid.id)) {
      seenRaids.add(s.raid.id);
      const kind = RAID_KIND_BY_ID[s.raid.kind];
      out.push({ kind: 'raid', tick: s.raid.arrivesTick, title: `${kind.name} coming!`, text: `${s.raid.raiders.length} raiders will reach your town.` });
    }
    for (const p of s.prompts) {
      if (seenPrompts.has(p.id)) continue;
      seenPrompts.add(p.id);
      if (p.kind !== 'raid') out.push({ kind: 'choice', tick: s.tick, title: p.title, text: `${p.text} (it will choose for you in an hour)` });
    }
    for (const n of s.notices) {
      if (n.id <= lastNotice) continue;
      if (/has died|carried off|camp breaks apart/.test(n.text)) out.push({ kind: 'death', tick: n.tick, title: 'Bad news', text: n.text });
      else if (/party is back|No one came back/.test(n.text)) out.push({ kind: 'expedition', tick: n.tick, title: 'Expedition', text: n.text });
    }
    lastNotice = s.notices.at(-1)?.id ?? lastNotice;
  }
  return out.slice(0, max);
}
