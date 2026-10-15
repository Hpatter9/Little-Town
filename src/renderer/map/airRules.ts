// The land's weather and its wilder life (the owner's ask), as pure rules: eyes glinting at the forest's edge and the
// fog's after dark, wisps over the graveyard, geese passing over in their Vs in spring and autumn, tumbleweeds and dust
// devils on the dry lands, weathervanes turning on the roofs and wind chimes ringing in the gusts, and sun shafts slanting
// through the woods with a haze at dawn. The drawing is map/mapEyes.ts, mapGeese.ts, mapDust.ts, mapVanes.ts and
// mapSunShafts.ts; nothing of it is in the sim, and it is tested.

import { hashSeed } from '../../shared/rng';
import { groundAt, type LandMap } from '../../shared/sim/land';

/** The sky as these rules see it (main.ts, per snapshot). */
export interface Sky {
  season: string;
  weather: string;
  /** 0 night .. 1 day. */
  daylight: number;
  /** The hour, fractions allowed. */
  hour: number;
}

const frac = (key: string) => (hashSeed(key) % 10007) / 10007;

/* ------------------------------------------------------------ eyes in the dark */

/** How many pairs of eyes at most, in the open land and the worst of nights, and how near someone comes (px) before
 *  they're gone. */
export const EYES_BASE = 3;
export const EYES_MOST = 10;
export const EYES_SHY = 120;
/** How many pairs of eyes watch from the dark now: none by day; more in winter (hungry) and on blighted land. */
export function eyesWanted(sky: Sky, blighted: boolean): number {
  if (sky.daylight > 0.25 || sky.weather === 'storm') return 0;
  let n = EYES_BASE * (sky.season === 'winter' ? 1.7 : 1) * (blighted ? 1.8 : 1) * (sky.weather === 'fog' ? 1.3 : 1);
  // (fewer while the dusk is still light)
  n *= Math.min(1, (0.25 - sky.daylight) / 0.12 + 0.3);
  return Math.min(EYES_MOST, Math.round(n));
}
/** Where eyes may watch from: a wood's cell with open ground beside it (the forest's edge). */
export function forestEdge(land: LandMap, x: number, y: number): boolean {
  if (x < 1 || y < 1 || x >= land.w - 1 || y >= land.h - 1) return false;
  if (groundAt(land, x, y) !== 'forest') return false;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const g = groundAt(land, x + dx, y + dy);
    if (g === 'grass' || g === 'fertile' || g === 'sand' || g === 'hill') return true;
  }
  return false;
}
/** The eyes' colour: a wolf's amber, a cat's green, now and then a pale blue; red on blighted land. */
export function eyeColour(blighted: boolean, key: number): number {
  if (blighted) return key % 3 === 0 ? 0xff6a30 : 0xff2a2a;
  return [0xffc040, 0xffd060, 0x9cff60, 0xffc040, 0xa8d8ff][key % 5];
}
/** Whether the eyes are shut a moment (a blink): a short one every few seconds, by their own clock. */
export function blinking(t: number, phase: number): boolean {
  return ((t + phase) % 3.7) < 0.13;
}

/** Wisps over a graveyard after dark: a couple, more in a town of the dead (the liches, the Blood Court). */
export const WISPS_PER_GRAVEYARD = 2;
export const WISPS_UNDEAD = 5;
export const WISPS_MOST = 9;
export function wispsWanted(daylight: number, graveyards: number, undead: boolean): number {
  if (daylight > 0.3 || graveyards <= 0) return 0;
  return Math.min(WISPS_MOST, graveyards * (undead ? WISPS_UNDEAD : WISPS_PER_GRAVEYARD));
}

/* ------------------------------------------------------------ geese */

/** How often a skein of geese crosses (seconds, at random up to twice), and how many in it. */
export const GEESE_EVERY = 45;
export const GEESE_LEAST = 5;
export const GEESE_MOST = 11;
/** Geese pass over in spring (north) and autumn (south), by day, in weather they fly in. */
export function geeseFly(sky: Sky): boolean {
  if (sky.season !== 'spring' && sky.season !== 'autumn') return false;
  return sky.daylight > 0.45 && (sky.weather === 'clear' || sky.weather === 'cloudy' || sky.weather === 'fog');
}
/** The way a skein flies (radians, y down): north in spring, south in autumn, leaning east or west by its number. */
export function geeseHeading(season: string, key: number): number {
  const lean = ((key % 7) - 3) * 0.12;
  return (season === 'spring' ? -Math.PI / 2 : Math.PI / 2) + lean;
}
/** A V's places, in the skein's own frame (px: ahead along +x, aside along y): the leader at the point, the rest
 *  alternately down either arm, each a little further back. */
export const V_BACK = 20;
export const V_ASIDE = 16;
export function vFormation(n: number): { ahead: number; aside: number }[] {
  const out = [{ ahead: 0, aside: 0 }];
  for (let i = 1; i < n; i++) {
    const rank = Math.ceil(i / 2);
    out.push({ ahead: -rank * V_BACK, aside: (i % 2 ? -1 : 1) * rank * V_ASIDE });
  }
  return out;
}
/** Which of the four rows of a bird's frames to show for a heading (the sheet's down, left, right, up). */
export function facingRow(heading: number): 0 | 1 | 2 | 3 {
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  if (Math.abs(dy) > Math.abs(dx)) return dy > 0 ? 0 : 3;
  return dx < 0 ? 1 : 2;
}

/* ------------------------------------------------------------ the dry lands */

/** The most tumbleweeds and dust devils at once. */
export const TUMBLEWEEDS_MOST = 5;
export const DEVILS_MOST = 2;
/** Tumbleweeds rolling and dust devils whirling on a dry land (the desert, the steppe, the ashlands), by day out of the
 *  rain and snow; more as the wind rises. */
export function dustWanted(dry: boolean, cold: boolean, sky: Sky, wind: number): { weeds: number; devils: number } {
  if (!dry || cold || sky.daylight < 0.4 || sky.weather === 'rain' || sky.weather === 'snow' || sky.season === 'winter') return { weeds: 0, devils: 0 };
  const w = Math.max(0, Math.min(2, wind));
  const weeds = Math.min(TUMBLEWEEDS_MOST, Math.round(1 + w * 2.2));
  // (dust devils on the hot still afternoons more than in a gale)
  const afternoon = sky.hour >= 11 && sky.hour <= 17;
  const devils = sky.weather === 'storm' ? 0 : Math.min(DEVILS_MOST, (afternoon ? 1 : 0) + (sky.weather === 'clear' && w < 1 ? 1 : 0));
  return { weeds, devils };
}

/* ------------------------------------------------------------ weathervanes and wind chimes */

/** The buildings with a pitched roof a weathervane may stand on (the lean-to and hide tent are drawn as a cottage, but
 *  for the peoples who live in tents and yurts: `TENT_PEOPLES`), and the share of them that have one. */
export const VANE_ON = new Set([
  'lean_to', 'hide_tent', 'cottage', 'rowhouse', 'longhouse', 'elder_lodge', 'town_hall', 'trophy_hall', 'tavern', 'fireside_inn', 'general_store', 'emporium',
  'bakery', 'smithy', 'sawmill', 'school', 'library', 'stable', 'infirmary', 'scriptorium', 'barracks', 'granary', 'theatre',
]);
export const VANE_SHARE = 0.4;
export const TENT_PEOPLES = new Set(['nomads', 'orcs']);
/** The homes a wind chime may hang at, and the share that have one. */
export const CHIME_ON = new Set(['lean_to', 'longhouse', 'cottage', 'rowhouse', 'apartments', 'fireside_inn', 'tavern']);
export const CHIME_SHARE = 0.3;
export const hasVane = (id: number, def: string, style = 'town') => VANE_ON.has(def) && !TENT_PEOPLES.has(style) && frac(`vane:${id}`) < VANE_SHARE;
export const hasChime = (id: number, def: string) => CHIME_ON.has(def) && frac(`chime:${id}`) < CHIME_SHARE;
/** A gust at a point (0..1): the same wave that runs across the woods (MapView `sway`). */
export function gustAt(t: number, x: number, y: number): number {
  return Math.max(0, Math.sin(t * 0.55 - x * 0.004 + y * 0.001)) ** 3;
}
/** Which way a vane's arrow points (radians, 0 east, about a vertical axis): into the west wind the clouds drift on,
 *  swung by the gusts and wandering when the air is still. */
export function vaneAngle(t: number, wind: number, gust: number, phase: number): number {
  const steady = Math.min(1, wind);
  const wander = Math.sin(t * 0.13 + phase) * 2.2 * (1 - steady);
  return Math.PI + wander + Math.sin(t * (1.2 + wind) + phase) * 0.35 * steady + gust * 0.6 * Math.sin(t * 3.1 + phase);
}
/** The wind a chime needs to ring, the gust that rings it, the least time between two rings of the town's chimes heard
 *  (seconds), and how wide the view may be (world px) for them to be near enough to hear. */
export const CHIME_WIND = 0.35;
export const CHIME_GUST = 0.55;
export const CHIME_GAP = 6;
export const CHIME_NEAR_VIEW = 1400;
/** Whether a chime rings now: the wind up, and a gust just come past `CHIME_GUST`. */
export function chimeRings(wind: number, gust: number, wasGust: number): boolean {
  return wind >= CHIME_WIND && gust >= CHIME_GUST && wasGust < CHIME_GUST;
}

/* ------------------------------------------------------------ sun shafts and the dawn haze */

/** How strong the shafts of sun through the woods are (0..1): in the golden hours (`GOLDEN`: 6 to 8, 17 to 19), at their
 *  best in the middle of one, in fair weather (fainter under cloud and in winter). */
export const GOLDEN: readonly [number, number][] = [
  [6, 8],
  [17, 19],
];
export const SHAFTS_MOST = 9;
export function shaftsStrength(sky: Sky): number {
  const fair = sky.weather === 'clear' ? 1 : sky.weather === 'cloudy' ? 0.45 : 0;
  if (!fair) return 0;
  for (const [a, b] of GOLDEN) {
    if (sky.hour < a || sky.hour > b) continue;
    const mid = (a + b) / 2;
    const k = 1 - Math.abs(sky.hour - mid) / ((b - a) / 2);
    return Math.max(0, Math.min(1, k * 1.4)) * fair * (sky.season === 'winter' ? 0.6 : 1);
  }
  return 0;
}
/** The shafts' slant (radians from upright): the sun low in the east of a morning throws them leaning one way, low in
 *  the west of an evening the other. */
export function shaftSlant(hour: number): number {
  return hour < 12 ? 0.55 : -0.55;
}
/** The haze lying low at dawn (0..1): from 5 to past 8, thickest about 6, more in spring and autumn and on a wet land,
 *  none in rain or a storm (the rain has it). */
export function dawnHaze(sky: Sky, wet: boolean): number {
  if (sky.weather === 'rain' || sky.weather === 'storm' || sky.weather === 'snow') return 0;
  if (sky.hour < 4.5 || sky.hour > 8.5) return 0;
  const k = sky.hour < 6 ? (sky.hour - 4.5) / 1.5 : 1 - (sky.hour - 6) / 2.5;
  const season = sky.season === 'spring' || sky.season === 'autumn' ? 1 : sky.season === 'summer' ? 0.6 : 0.8;
  return Math.max(0, Math.min(1, k)) * season * (wet ? 1.25 : 1) * (sky.weather === 'fog' ? 0.5 : 1);
}
