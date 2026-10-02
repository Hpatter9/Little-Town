// Moving to the next era (DESIGN §2): finishing an era's capstone building opens the next one. Everything
// timed from then on is stretched by the new era's multiplier, and its research appears. In the last era
// the capstone is the Launch Site: once the ship is built, a countdown starts, and at zero the town leaves
// for the stars (the game is won).

import { ERA_NAMES, nextEra } from '../data/eras';
import { notify, type Building, type GameState } from './state';
import { clearStairs } from './castle';
import { layOutGraves } from './health';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

/** Capstone building for each era but the last. */
const CAPSTONES: Record<string, string> = { neolithic: 'elder_lodge', medieval: 'town_hall', industrial: 'power_station', modern: 'mission_control' };

/** Game hours from the finished ship to lift-off. */
export const LAUNCH_COUNTDOWN_HOURS = 12;

/** Called when a building is finished (also a few one-off effects: the graveyard gathers the town's graves). */
export function onBuilt(s: GameState, b: Building): void {
  if (b.def === 'graveyard' && s.graves?.length) {
    layOutGraves(s);
    notify(s, 'The dead are moved to the new graveyard and laid properly to rest.');
  }
  if (b.def === 'launch_site' && s.launchTick == null) {
    s.launchTick = s.tick + LAUNCH_COUNTDOWN_HOURS * TICKS_PER_HOUR;
    notify(s, `The ship stands ready on the Launch Site. Lift-off in ${LAUNCH_COUNTDOWN_HOURS} hours: keep the town safe until then!`, true);
    return;
  }
  if (CAPSTONES[s.era] !== b.def) return;
  const next = nextEra(s.era);
  if (!next) return;
  s.era = next;
  s.eraReady = false;
  // (a castle's keep widens with the age: its stair towers move out, and rooms above them step aside)
  clearStairs(s);
  notify(s, `A new age begins: the ${ERA_NAMES[next]} era. New research is open, and work takes longer but builds greater things.`, true);
}

/** Every tick: the launch countdown. If the Launch Site is lost, the countdown stops. */
export function updateLaunch(s: GameState): void {
  if (s.launchTick == null) return;
  const site = s.buildings.some((b) => b.def === 'launch_site' && b.status === 'done');
  if (!site) {
    s.launchTick = null;
    notify(s, 'The Launch Site is gone, and the launch with it.', true);
    return;
  }
  if (s.tick < s.launchTick) return;
  const days = Math.floor(s.tick / TICKS_PER_DAY) + 1;
  const people = s.people.length;
  s.gameOver = {
    tick: s.tick,
    won: true,
    text: `Engines roar, and the ship climbs into the sky. After ${days} days, ${people === 1 ? 'the last of the town' : `all ${people} townsfolk`} leave for the stars. From a campfire to the stars: you won!`,
  };
  notify(s, s.gameOver.text, true);
}
