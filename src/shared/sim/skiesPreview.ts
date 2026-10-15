// For previews only (`__skies(what)` in the phone page's console, through the sim host): a mast and an airship at
// once, a party flown off and watched, sky pirates sighted, a hunter over the town. Never called by the game.

import { BUILDING_BY_ID } from '../data/buildings';
import { Rng } from '../rng';
import { placeBlueprint } from './buildings';
import { sendExpedition } from './expeditions';
import { findSpot } from './planner';
import { bestAirship, launchAirship, mastOf, seePirates, spawnSkyHunter } from './skies';
import type { GameState } from './state';

export function skiesPreview(s: GameState, what: string): unknown {
  if (what === 'airship' || what === 'fly') {
    if (!mastOf(s)) {
      const at = findSpot(s, BUILDING_BY_ID.airship_mast);
      if (!at || !placeBlueprint(s, 'airship_mast', at.x, at.y, false, false, !!at.wild).ok) return 'no room for a mast';
      const b = s.buildings.find((q) => q.def === 'airship_mast')!;
      b.status = 'done';
      b.progress = 1;
      b.overgrown = undefined;
    }
    if (!s.airships?.some((a) => a.away === null)) launchAirship(s, bestAirship(s)?.kind ?? 'zeppelin');
    if (what === 'fly') {
      const p = s.people.find((q) => q.away === null && !q.downed);
      if (!p || !sendExpedition(s, 'riverbank', [p.id]).ok) return 'nobody to fly';
      s.watching = s.expeditions[s.expeditions.length - 1].id;
    }
    return 'ok';
  }
  if (what === 'pirates') {
    // (sighted, and over the town in half a minute rather than an hour)
    seePirates(s);
    if (s.skies?.pirates) s.skies.pirates.at = s.tick + 300;
    return 'ok';
  }
  if (what === 'hunter') return spawnSkyHunter(s, new Rng(s.tick));
  return 'airship | fly | pirates | hunter';
}
