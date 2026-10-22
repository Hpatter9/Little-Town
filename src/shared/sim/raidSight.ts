// A raid is announced only once it is seen (the owner's ask, with the fog of war, sim/fog.ts). A scheduled land raid sets
// out veiled: a vague sign in the news, no warning, no prompt, no raid card. It comes in along the camp's row from far
// off (`APPROACH_CELLS` past the town's edge); each few ticks we ask whether anyone who sees it is near enough: a
// townsperson (`sightOf`), a finished building (`buildingSight`: a watchtower, a gate or the seat sees furthest).
// The first to see it raises the warning, and what a lookout's longer warning gave is now how early it sees them.
// Raids that arrive unseen are simply here. Autopilot only, so the plain test towns keep their old warning.

import { APPROACH_CELLS, HOST_SIGNS, RAID_SIGNS, SEA_SIGNS, SPOTTED_LEAD_TICKS } from '../data/raidSight';
import { buildingSight, sightOf } from './fog';
import { CELL } from './land';
import { notify, type GameState, type Raid } from './state';


/** Whether a scheduled raid sets out veiled in this town. */
export const veilsRaids = (s: GameState): boolean => s.autopilot !== false && s.explored !== undefined;

/** The vague sign as the raid sets out. */
export function sayVagueSign(s: GameState, raid: Raid, fromSea = false): void {
  const where = raid.side < 0 ? 'west' : 'east';
  const signs = fromSea ? SEA_SIGNS : raid.host !== undefined ? HOST_SIGNS : RAID_SIGNS;
  notify(s, signs[raid.id % signs.length].replace('{where}', where));
}

/** A source's own words about its raid (a saga's title, "the host is here"): said now, or kept until the raid is seen. */
export function raidNews(s: GameState, raid: Raid, text: string, important = false): void {
  if (!raid.veil) return notify(s, text, important);
  (raid.veil.news ??= []).push(important ? `!${text}` : text);
}

/** A source's own title and words for the raid's warning (sagas, secret newcomers): put on its prompt, now or when it is seen. */
export function raidPromptWords(s: GameState, raid: Raid, title: string, text: string): void {
  if (raid.veil) {
    raid.veil.title = title;
    raid.veil.text = text;
    return;
  }
  const prompt = s.prompts.find((q) => q.id === raid.prompt);
  if (!prompt) return;
  prompt.title = title;
  prompt.text = `${text} ${prompt.text}`;
}

/** The cells (x, y) the leading raiders have reached now, on the camp's row, `edgeX` the town's edge in pixels. */
function approachAt(s: GameState, r: Raid, edgeX: number, campY: number): { x: number; y: number } {
  const v = r.veil!;
  const left = Math.max(0, r.arrivesTick - s.tick) / Math.max(1, v.total);
  return { x: (edgeX + r.side * left * APPROACH_CELLS * CELL) / CELL, y: campY / CELL };
}

/** Who sees the approaching raid, if anyone: a name for the warning (the lookout), '' for a plain sighting. Null: none. */
export function raidSeenBy(s: GameState, r: Raid, edgeX: number, campY: number): string | null {
  const at = approachAt(s, r, edgeX, campY);
  let by: string | null = null;
  for (const b of s.buildings) {
    if (b.status !== 'done') continue;
    if (Math.hypot(b.tile - at.x, b.row - at.y) <= buildingSight(b)) return 'building';
  }
  for (const p of s.people) {
    if (p.away !== null || p.downed) continue;
    if (Math.hypot(p.x / CELL - at.x, p.y / CELL - at.y) <= sightOf(s, p)) by = 'person';
  }
  return by;
}

/** Floor of the warning once seen. */
export const leadAfterSeen = (s: GameState, r: Raid): number => Math.max(r.arrivesTick, s.tick + SPOTTED_LEAD_TICKS);
