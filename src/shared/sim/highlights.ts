// The morning report card (CLAUDE.md, "More to watch"): coming back to the town, the three biggest things that
// happened while you were away, each as a small picture and a line. Picked from the journal's milestones: deaths
// first (all on one card), then a new age, raids, weddings, newcomers, great buildings, research.

import { BUILDING_BY_ID } from '../data/buildings';
import { RESEARCH_STATIONS } from '../data/research';
import type { GameState, JournalEntry } from './state';

/** What a card shows: a building's picture, or a townsperson (still living). */
export interface Highlight {
  text: string;
  building?: string;
  person?: number;
}

/** The era capstones, for a new age's card. */
const CAPSTONE_OF: Record<string, string> = { medieval: 'elder_lodge', industrial: 'town_hall', modern: 'power_station', space: 'mission_control' };
const BIG = new Set(Object.values(CAPSTONE_OF).concat(['launch_site', 'emporium', 'tavern', 'university', 'ai_core', 'habitat_dome']));

/** How many cards the report shows. */
export const HIGHLIGHTS = 3;

export function highlights(s: GameState, events: readonly JournalEntry[]): Highlight[] {
  const byName = (name: string) => s.people.find((p) => p.name === name)?.id;
  const has = (id: string) => s.buildings.some((b) => b.def === id && b.status === 'done');
  const station = Object.keys(RESEARCH_STATIONS).find(has) ?? 'campfire';
  const wall = ['force_wall', 'concrete_wall', 'brick_wall', 'stone_wall', 'palisade_wall'].find(has) ?? 'palisade_wall';
  const scored: [number, Highlight][] = [];
  const dead: string[] = [];
  for (const e of events) {
    if (!e.key) continue;
    const t = e.text;
    let m: RegExpExecArray | null;
    if ((m = /^(.+?) has died /.exec(t))) dead.push(m[1]);
    else if ((m = /^A new age begins: the (.+?) era/.exec(t))) scored.push([95, { text: `A new age: the ${m[1]} era`, building: CAPSTONE_OF[s.era] }]);
    else if (t.startsWith('Raid by')) scored.push([85, { text: t, building: wall }]);
    else if ((m = /^(.+?) and (.+?) were married/.exec(t))) scored.push([70, { text: `${m[1]} and ${m[2]} were married`, person: byName(m[1]) }]);
    else if ((m = /^(.+?) joined the town/.exec(t))) scored.push([60, { text: t, person: byName(m[1]) }]);
    else if ((m = /^Finished building: (.+)$/.exec(t))) {
      const def = Object.values(BUILDING_BY_ID).find((d) => d.name === m![1]);
      scored.push([def && BIG.has(def.id) ? 90 : 50, { text: `Built: ${m[1]}`, building: def?.id }]);
    } else if (t.startsWith('Research complete')) scored.push([40, { text: t.replace('Research complete: ', 'Learned: '), building: station }]);
    else scored.push([20, { text: t, building: 'campfire' }]);
  }
  if (dead.length) scored.push([100, { text: dead.length === 1 ? `${dead[0]} died` : `${dead.length} died: ${dead.join(', ')}`, building: has('graveyard') ? 'graveyard' : 'campfire' }]);
  // (the latest of equal weight first: the stable sort keeps journal order, so reverse it before sorting)
  return scored
    .reverse()
    .sort((a, b) => b[0] - a[0])
    .map(([, h]) => h)
    .filter((h, i, all) => all.findIndex((q) => q.text === h.text) === i)
    .slice(0, HIGHLIGHTS);
}
