// The rare things the town has seen, for the phone's reveal cards (mobile/revealCard.ts: a new one in the list slides
// a card up) and the legends shelf (panel/shelfPanel.ts). Only read from what the sim already keeps (and `s.seen`:
// sim/seen.ts): no draws, nothing changes.
import type { GameState } from './state';

export interface RareView {
  /** The mythic callings come among the town (data/mythic.ts): who (null: no longer among us), which base, when. */
  mythics: { id: number; road: string; who: string | null; tick: number }[];
  /** The unique weapons found (data/uniques.ts), in the order found. */
  uniques: string[];
  /** The special newcomers found out (data/specials.ts), and who, while they're still in town. */
  specials: { id: string; who: string | null }[];
  /** The sagas finished (data/sagas.ts). */
  sagas: { id: string; outcome: 'triumph' | 'bittersweet' | 'ruin'; tick: number; hero: string | null }[];
  /** The dwellers of the Underdark's depths slain (data/underdark.ts `DEPTH_BY_N`), by depth, and when. */
  dwellers: { depth: number; tick: number }[];
  /** The dragon, once it has shown itself (sim/dragon.ts), and how it stands. */
  dragon: { kind: string; phase: string } | null;
  /** The bosses slain (by enemy id), and the top deed titles won (data/deeds.ts). */
  bosses: string[];
  deeds: string[];
}

export function rareView(s: GameState): RareView {
  const name = (id: number) => s.people.find((p) => p.id === id)?.name ?? null;
  return {
    mythics: (s.mythics ?? []).map((m) => ({ id: m.id, road: m.road, who: name(m.id), tick: m.tick })),
    uniques: [...(s.uniques ?? [])],
    specials: (s.seen?.specials ?? []).map((id) => ({ id, who: s.people.find((p) => p.secret?.id === id && p.secret.found)?.name ?? null })),
    sagas: (s.sagasDone ?? []).map((d) => ({ id: d.id, outcome: d.outcome, tick: d.tick, hero: d.hero ?? null })),
    dwellers: (s.underdark?.deeps ?? []).flatMap((d, i) => (d?.slain !== undefined ? [{ depth: i + 1, tick: d.slain }] : [])),
    dragon: s.dragon ? { kind: s.dragon.kind, phase: s.dragon.phase } : null,
    bosses: [...(s.seen?.bosses ?? [])],
    deeds: [...(s.seen?.deeds ?? [])],
  };
}
