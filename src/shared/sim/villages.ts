// Daughter villages (data/villages.ts has the numbers and the story). A big town's restless sort gathers a few
// others and asks to go and found a village of their own out on the land: a question for the player (bless them,
// let them go, forbid it). Gone, they're `s.villages` (`Village`): the named folk who left (and any who marry in),
// a head count beside them, a leader, a spot on the land with its houses and fields laid out (`plots`, drawn by the
// map as ordinary buildings), what it has made to send, and its loyalty. Each morning it grows, works its land, and
// its loyalty drifts (by its leader's nature, the tax, how it's been treated); its folk and the town's may marry;
// it may be beset (a question: send fighters, pay sellswords, leave them to it); a rebel village raids. Each hour a
// loaded cart sets out down the road to the town's market (a band of `village` kind, sim/bands.ts): tithe from a
// loyal village, sold from a cooler one. When the town is raided a loyal village sends fighters (`villageAllies`,
// from startRaid). A rebel village is won back by gifts or by a party sent to bring it to heel (the destination
// `village:<id>`, `villageHome` from comeHome). Off with the autopilot (the tests' plainGame), like the other
// self-running parts; the tests found villages themselves.

import { BUILDING_BY_ID } from '../data/buildings';
import { openGround } from '../data/biomes';
import type { Destination } from '../data/expeditions';
import type { Material } from '../data/materials';
import { natureOf } from '../data/natures';
import { FOOD_VALUE } from '../data/people';
import { RAID_KIND_BY_ID } from '../data/raids';
import { WORTH } from '../data/trade';
import { eventPicture } from '../data/eventScenes';
import {
  BESET_DAILY, BESET_FOES, BESET_HOURS, BESET_LOSS, BESET_LOSS_PAID, BESET_OPTIONS, BLESSING, BLESSING_FOOD, CART_LOAD, CART_STAY_HOURS, GIFT_COINS, GIFT_LOYALTY, GROUND_MAKES, HEELED_LOYALTY, HELP_AT, HELP_CHANCE, HELP_FOLK, HELP_HOURS, HELP_HURT, HELP_KILLS, HELP_SENT,
  HELPED_LOYALTY, HELPERS, LOYALTY_DRIFT, LOYALTY_REST, LOYALTY_REST_BY_NATURE, LOYALTY_START, MAKES_PER_HEAD, MILITIA_BY_ERA, NAME_ENDS, NAME_ROOTS, PAID_LOYALTY, PARTING_HOURS, PARTING_OPTIONS, REBEL_AT, REBEL_BUDGET_SHARE, REBEL_RAID_DAILY, RECONCILE_AT, REFUSED_LOYALTY,
  SELLSWORDS_COINS, SENT_HELP_LOYALTY, SETTLERS, TAX_LOYALTY, TITHE_AT, VILLAGE_DIST, VILLAGE_FROM_DAY, VILLAGE_GAP_DAYS, VILLAGE_GROWTH, VILLAGE_HOUR, VILLAGE_KEEP, VILLAGE_MOST_FOLK, VILLAGE_PEOPLE, VILLAGE_PEOPLE_AT_SIZE, VILLAGE_R, VILLAGE_TIERS, VILLAGES_MOST, WED_DAILY, WED_LOYALTY, WORTH_SHARE,
} from '../data/villages';
import { hashSeed, mixSeed, Rng } from '../rng';
import { depthOf, depositNear, layStreet, nearestStreet } from './buildings';
import { weddingFeast } from './ceremonies';
import { earn, makePerson, notify, townFull, type Building, type GameState, type Person, type Prompt, type Raider, type Raid } from './state';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { CELL, groundAt, inMap, isRoad, setGround, WILD, wet, type Pt } from './land';
import { raidBudget, startRaid } from './raids';
import { isChild } from './social';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds, housingCapacity } from './townsfolk';
import { takeFromStorage } from './expeditions';
import { seaTown } from './sea';
import { weatherAt } from './weather';
import { spawnVillageCart } from './bands';
import { queueScene } from './cutscenes';

export interface VillagePlot {
  def: string;
  x: number;
  y: number;
  /** A field's growth, kept turning with the seasons (only for the picture). */
  field?: boolean;
}

export interface Village {
  id: number;
  name: string;
  /** Its middle (a cell). */
  x: number;
  y: number;
  founded: number;
  leader: number;
  /** The named folk: those who left the town, and any who married in. */
  folk: Person[];
  /** Everyone, named and not. */
  pop: number;
  loyalty: number;
  rebel?: boolean;
  /** What it has made and not yet sent. */
  goods: Partial<Record<Material, number>>;
  /** Its houses, fields and fire, laid out as it grows. */
  plots: VillagePlot[];
  /** The latest of its news, newest first. */
  news: string[];
  /** Under attack: by what, and the question's id. */
  beset?: { foe: string; prompt: number; until: number };
  /** The town's fighters gone to its aid, and when they're back. */
  helpers?: { ids: number[]; until: number };
  /** A cart of its on the road (a band's id). */
  cart?: number;
}

/** The plan of a village waiting on the town's answer. */
export interface VillagePlan {
  ids: number[];
  leader: number;
  x: number;
  y: number;
  name: string;
  prompt: number;
}

const villagesOf = (s: GameState): Village[] => (s.villages ??= []);
const grownAtHome = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p) && !p.downed);
const rngOf = (s: GameState, salt: number) => new Rng(mixSeed(hashSeed(s.seed), 0x71a6e, s.tick * 7 + salt));
const VILLAGE_DEST = 'village:';
export const isVillageDest = (id: string) => id.startsWith(VILLAGE_DEST);
export const villageById = (s: GameState, id: number) => (s.villages ?? []).find((v) => v.id === id);
const tell = (v: Village, line: string) => {
  v.news.unshift(line);
  if (v.news.length > 8) v.news.length = 8;
};
const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const tierOf = (v: Pick<Village, 'pop'>) => [...VILLAGE_TIERS].reverse().find((t) => v.pop >= t.at)!.name;
export const leaderOf = (v: Village) => v.folk.find((p) => p.id === v.leader) ?? v.folk[0];

/* ------------------------------------------------------------ where, and who */

/** A spot for a village: out on the land, on firm buildable ground, clear of the town and the other villages. */
export function villageSpot(s: GameState, rng: Rng): Pt | null {
  const m = s.land;
  let best: Pt | null = null;
  let bestScore = -Infinity;
  for (let i = 0; i < 40; i++) {
    const a = rng.next() * Math.PI * 2;
    const d = rng.range(VILLAGE_DIST[0], VILLAGE_DIST[1]);
    const x = Math.round(m.camp.x + Math.cos(a) * d);
    const y = Math.round(m.camp.y + Math.sin(a) * d);
    if (!inMap(m, x - VILLAGE_R - 2, y - VILLAGE_R - 2) || !inMap(m, x + VILLAGE_R + 2, y + VILLAGE_R + 2)) continue;
    if ((s.villages ?? []).some((v) => Math.hypot(v.x - x, v.y - y) < VILLAGE_KEEP * 2.5)) continue;
    if (s.buildings.some((b) => Math.hypot(b.tile - x, b.row - y) < VILLAGE_KEEP + 3)) continue;
    let score = 0;
    let bad = false;
    for (let dy = -VILLAGE_R; dy <= VILLAGE_R && !bad; dy++)
      for (let dx = -VILLAGE_R; dx <= VILLAGE_R; dx++) {
        const g = groundAt(m, x + dx, y + dy);
        if (wet(g) || g === 'mountain' || g === 'hall') {
          if (Math.hypot(dx, dy) <= 2) bad = true;
          score -= 3;
        } else if (WILD.includes(g)) score -= 0.5;
        else score += 1;
      }
    if (bad) continue;
    // (some of each kind of land round it, to work: a village by the wood and the fields)
    const kinds = new Set<string>();
    for (let dy = -8; dy <= 8; dy += 2) for (let dx = -8; dx <= 8; dx += 2) kinds.add(groundAt(m, x + dx, y + dy));
    score += kinds.size * 4;
    if (score > bestScore) {
      bestScore = score;
      best = { x, y };
    }
  }
  return best;
}

/** Who would go: a leader (the restless, proud or bold sort first, never the founder, a guard or a post's keeper),
 *  their partner and children, then others of the restless sort. */
export function pickSettlers(s: GameState, rng: Rng): { leader: Person; ids: number[] } | null {
  const home = grownAtHome(s).filter((p) => p.id !== s.mainId && !p.guard && !p.monster && !p.skirmish);
  if (home.length < 3) return null;
  const bent = (p: Person) => ({ restless: 3, proud: 3, bold: 2, curious: 2, stern: 1, greedy: 1 })[natureOf(p).id as string] ?? 0;
  const leader = [...home].sort((a, b) => bent(b) - bent(a) || b.skills.social.level - a.skills.social.level || a.id - b.id)[0];
  const n = Math.max(2, Math.min(rng.int(SETTLERS[0], SETTLERS[1]), Math.floor(grownAtHome(s).length / 4)));
  const ids = [leader.id];
  const add = (p: Person | undefined) => {
    if (p && !ids.includes(p.id) && p.id !== s.mainId && p.away === null) ids.push(p.id);
  };
  if (leader.partner != null) add(s.people.find((p) => p.id === leader.partner));
  for (const c of s.people.filter((p) => isChild(p) && (p.parents ?? []).includes(leader.id))) add(c);
  const rest = home.filter((p) => !ids.includes(p.id) && p.partner == null).sort((a, b) => bent(b) - bent(a) || a.id - b.id);
  for (const p of rest) {
    if (ids.filter((id) => !isChild(s.people.find((q) => q.id === id)!)).length >= n) break;
    add(p);
  }
  return ids.length >= 2 ? { leader, ids } : null;
}

const nameFor = (s: GameState, rng: Rng): string => {
  const taken = new Set((s.villages ?? []).map((v) => v.name));
  for (let i = 0; i < 20; i++) {
    const n = rng.pick(NAME_ROOTS) + rng.pick(NAME_ENDS);
    if (!taken.has(n)) return n;
  }
  return `New ${rng.pick(NAME_ROOTS)}`;
};

/* ------------------------------------------------------------ the parting */

function wantVillage(s: GameState): boolean {
  if (s.villagePlan || s.raid) return false;
  if (s.nomad && !s.nomad.settled) return false;
  if (villagesOf(s).length >= VILLAGES_MOST) return false;
  if (s.tick < VILLAGE_FROM_DAY * TICKS_PER_DAY) return false;
  if (s.lastVillage !== undefined && s.tick - s.lastVillage < VILLAGE_GAP_DAYS * TICKS_PER_DAY) return false;
  const grown = grownAtHome(s).length;
  const atSize = s.popTarget !== undefined && townFull(s);
  return grown >= VILLAGE_PEOPLE || (atSize && grown >= VILLAGE_PEOPLE_AT_SIZE);
}

/** Some of the town ask to go: the question for the player. */
export function proposeVillage(s: GameState, rng: Rng): boolean {
  const who = pickSettlers(s, rng);
  const at = villageSpot(s, rng);
  if (!who || !at) return false;
  const name = nameFor(s, rng);
  const goers = who.ids.map((id) => s.people.find((p) => p.id === id)!).filter(Boolean);
  const dir = compass(s, at);
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'village',
    expedition: null,
    title: `${who.leader.name} would found a village`,
    text: `${who.leader.name} and ${goers.length - 1} others want to found a village of their own, ${dir}: ${name}.`,
    options: [...PARTING_OPTIONS],
    defaultOption: 0,
    expiresTick: s.tick + PARTING_HOURS * TICKS_PER_HOUR,
    story: `${who.leader.name} has been looking at the land ${dir} for weeks, and tonight says so by the fire: there is good ground out there, and the town has grown crowded. ${goers.length - 1 === 1 ? 'One other wants' : `${goers.length - 1} others want`} to go too: ${goers.slice(1).map((p) => p.name).join(', ')}.\n\nThey'd call it ${name}. They'd keep their own counsel, and send the town what they could spare. Blessed, they go with wood, stone and food from the stores and remember it kindly; let go, they go with what they carry; forbidden, they may stay, sore about it, or go anyway and remember that instead.`,
    picture: eventPicture(`village:${s.tick}`, 'fields road travellers new land hope', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: who.leader.id,
    village: { about: 'parting' },
  };
  s.prompts.push(prompt);
  s.villagePlan = { ids: who.ids, leader: who.leader.id, x: at.x, y: at.y, name, prompt: prompt.id };
  notify(s, `${who.leader.name} and ${goers.length - 1} others want to go and found a village, ${dir}.`, true);
  return true;
}

const compass = (s: GameState, at: Pt): string => {
  const dx = at.x - s.land.camp.x;
  const dy = at.y - s.land.camp.y;
  const ns = dy < -Math.abs(dx) / 2 ? 'north' : dy > Math.abs(dx) / 2 ? 'south' : '';
  const ew = dx < -Math.abs(dy) / 2 ? 'west' : dx > Math.abs(dy) / 2 ? 'east' : '';
  return `to the ${ns && ew ? `${ns}-${ew}` : ns || ew || 'north'}`;
};

/** The player's answer (or the default when their wait is up). */
export function answerParting(s: GameState, option: number, rng: Rng): void {
  const plan = s.villagePlan;
  if (!plan) return;
  s.villagePlan = undefined;
  s.prompts = s.prompts.filter((p) => p.id !== plan.prompt);
  const choice = PARTING_OPTIONS[option] ?? PARTING_OPTIONS[1];
  if (choice === PARTING_OPTIONS[2]) {
    if (!rng.chance(0.4)) {
      for (const id of plan.ids) {
        const p = s.people.find((q) => q.id === id);
        if (p) p.sore = { until: s.tick + 2 * TICKS_PER_DAY, value: -8, text: 'Forbidden to found a village' };
      }
      s.lastVillage = s.tick;
      notify(s, 'The town forbids it. They stay, and say little at the fire for a while.', true);
      return;
    }
    foundVillage(s, plan, LOYALTY_START.forbidden, rng);
    notify(s, 'Forbidden, they go anyway, before dawn, and take the long way round the town.', true);
    return;
  }
  let loyalty: number = LOYALTY_START.let;
  if (choice === PARTING_OPTIONS[0]) {
    let food = 0;
    for (const m of Object.keys(FOOD_VALUE) as Material[]) if (food < BLESSING_FOOD) food += takeFromStorage(s, m, BLESSING_FOOD - food);
    for (const [m, n] of Object.entries(BLESSING) as [Material, number][]) takeFromStorage(s, m, n);
    loyalty = LOYALTY_START.blessed;
  }
  foundVillage(s, plan, loyalty, rng);
}

/** They go: the village is founded, its ground cleared, a road planned to it. */
export function foundVillage(s: GameState, plan: Omit<VillagePlan, 'prompt'>, loyalty: number, _rng?: Rng): Village | null {
  const goers = plan.ids.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p && p.away === null);
  if (!goers.length) return null;
  s.people = s.people.filter((p) => !goers.includes(p));
  for (const p of goers) {
    p.task = null;
    p.guard = false;
    p.x = (plan.x + 0.5) * CELL;
    p.y = (plan.y + 0.5) * CELL;
    if (p.partner != null && !goers.some((q) => q.id === p.partner)) {
      // (a partner left behind: they part, sadly)
      const q = s.people.find((o) => o.id === p.partner);
      if (q) q.partner = null;
      p.partner = null;
    }
  }
  const v: Village = {
    id: s.nextId++,
    name: plan.name,
    x: plan.x,
    y: plan.y,
    founded: s.tick,
    leader: goers.some((p) => p.id === plan.leader) ? plan.leader : goers[0].id,
    folk: goers,
    pop: goers.length,
    loyalty,
    goods: {},
    plots: [],
    news: [],
  };
  villagesOf(s).push(v);
  s.lastVillage = s.tick;
  assignBeds(s);
  // (the land out there is known now, and the village's plots laid)
  const reach = Math.ceil(Math.hypot(v.x - s.land.camp.x, v.y - s.land.camp.y)) + VILLAGE_R + 3;
  if (s.land.open < reach) s.land.open = reach;
  layPlots(s, v);
  // (a road from the village's fire to the town's streets, for the town to lay)
  const from = { x: v.x, y: v.y + 2 };
  layStreet(s, from, nearestStreet(s, from), 200);
  tell(v, `Founded by ${leaderOf(v).name} and ${goers.length - 1} others.`);
  // (the parting, told: data/cutscenes.ts)
  if (s.autopilot !== false) queueScene(s, 'village_founded', { vars: { village: v.name, leader: leaderOf(v).name }, people: { hero: leaderOf(v), worrier: goers.find((p) => p.id !== v.leader && !isChild(p)) } });
  notify(s, `${leaderOf(v).name} leads ${goers.length - 1} others out to found ${v.name}, ${compass(s, v)}.`, true);
  return v;
}

/* ------------------------------------------------------------ its houses and fields */

const HOME_BY_ERA: Record<string, string> = { neolithic: 'longhouse', medieval: 'cottage', industrial: 'rowhouse', modern: 'apartments', space: 'habitat_dome' };

/** How many houses and fields it should have by its people. */
const wantedPlots = (v: Village) => ({ homes: Math.max(1, Math.ceil(v.pop / 3.5)), fields: Math.max(1, Math.ceil(v.pop / 7)) });

/** Lay any houses and fields it has grown into, round its fire, on cleared ground. */
export function layPlots(s: GameState, v: Village): void {
  if (!v.plots.length) place(s, v, 'campfire', true);
  const want = wantedPlots(v);
  const homes = () => v.plots.filter((p) => !p.field && p.def !== 'campfire').length;
  const fields = () => v.plots.filter((p) => p.field).length;
  let guard = 0;
  while ((homes() < want.homes || fields() < want.fields) && guard++ < 12) {
    const field = fields() < want.fields && (homes() >= want.homes || fields() * 3 < homes());
    if (!place(s, v, field ? 'garden_plot' : (HOME_BY_ERA[s.era] ?? 'cottage'), false, field)) break;
  }
}

function place(s: GameState, v: Village, def: string, middle: boolean, field = false): boolean {
  const d = BUILDING_BY_ID[def];
  if (!d) return false;
  const w = d.width;
  const h = depthOf(d);
  const m = s.land;
  const taken = (x: number, y: number) => v.plots.some((p) => {
    const pd = BUILDING_BY_ID[p.def];
    return x >= p.x - 1 && x < p.x + pd.width + 1 && y >= p.y - 1 && y < p.y + depthOf(pd) + 1;
  });
  const fits = (x0: number, y0: number) => {
    for (let y = y0; y < y0 + h; y++)
      for (let x = x0; x < x0 + w; x++) {
        if (!inMap(m, x, y) || taken(x, y) || isRoad(m, x, y)) return false;
        const g = groundAt(m, x, y);
        if (wet(g) || g === 'mountain' || g === 'hall') return false;
        if (x === v.x && y === v.y + 2) return false; // (the road out)
      }
    return true;
  };
  // (round the fire, the nearest that fits; fields out on the edge)
  const spots: { x: number; y: number; d: number }[] = [];
  const r = middle ? 0 : VILLAGE_R + 4;
  for (let y = v.y - r - h; y <= v.y + r; y++)
    for (let x = v.x - r - w; x <= v.x + r; x++) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const dd = Math.hypot(cx - (v.x + 1), cy - (v.y + 0.5));
      spots.push({ x, y, d: field ? Math.abs(dd - 6) : dd });
    }
  spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
  for (const sp of middle ? [{ x: v.x, y: v.y, d: 0 }] : spots) {
    if (!middle && sp.d < 2) continue;
    if (!fits(sp.x, sp.y) && !middle) continue;
    for (let y = sp.y; y < sp.y + h; y++) for (let x = sp.x; x < sp.x + w; x++) if (inMap(m, x, y) && WILD.includes(groundAt(m, x, y))) setGround(m, x, y, openGround(s.biome));
    v.plots.push(field ? { def, x: sp.x, y: sp.y, field } : { def, x: sp.x, y: sp.y });
    return true;
  }
  return false;
}

/** Nothing of the town's may be built this near a village's middle. */
export const nearVillage = (s: Pick<GameState, 'villages'>, x: number, y: number) => (s.villages ?? []).some((v) => Math.hypot(x - v.x, y - v.y) < VILLAGE_KEEP + (v.pop > 12 ? 2 : 0));

/** The village's houses and fields as buildings, for the map (ids below zero: never the town's). */
export function villageBuildings(s: GameState): Building[] {
  const out: Building[] = [];
  for (const v of s.villages ?? [])
    v.plots.forEach((p, i) => {
      const b: Building = { id: -(v.id * 100 + i + 1), def: p.def, tile: p.x, row: p.y, status: 'done', delivered: {}, progress: 1, store: {}, builtAt: v.founded };
      if (p.field) {
        const cal = calendar(s.tick);
        const growth = cal.season === 'winter' ? 0 : ((cal.day % 3) * 24 + cal.hour + i * 5) / 72;
        b.crop = { stage: cal.season === 'winter' ? 'fallow' : growth > 0.85 ? 'ripe' : 'growing', growth: Math.min(1, growth), work: 0 };
      }
      out.push(b);
    });
  return out;
}

/** The village a map building belongs to, by its id. */
export const villageOfBuilding = (s: GameState, id: number) => (id < 0 ? villageById(s, Math.floor((-id - 1) / 100)) : undefined);

/* ------------------------------------------------------------ each day */

function makesOf(s: GameState, v: Village): Material[] {
  const counts: Partial<Record<Material, number>> = {};
  for (let dy = -9; dy <= 9; dy++)
    for (let dx = -9; dx <= 9; dx++) {
      const m = GROUND_MAKES[groundAt(s.land, v.x + dx, v.y + dy)];
      if (m) counts[m] = (counts[m] ?? 0) + 1;
    }
  return (Object.entries(counts) as [Material, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => m);
}
export const villageMakes = makesOf;

function villageDay(s: GameState, v: Village, rng: Rng): void {
  // grows, while it's not beset and isn't too big
  if (!v.beset && v.pop < VILLAGE_MOST_FOLK && rng.chance(Math.min(0.9, v.pop * VILLAGE_GROWTH))) {
    v.pop++;
    tell(v, rng.chance(0.5) ? 'A child was born.' : 'A wanderer settled.');
  }
  // works its land
  const makes = makesOf(s, v);
  const total = v.pop * MAKES_PER_HEAD;
  makes.forEach((m, i) => {
    const share = i === 0 ? 0.5 : i === 1 ? 0.3 : 0.2;
    v.goods[m] = (v.goods[m] ?? 0) + total * share;
  });
  layPlots(s, v);
  // its loyalty drifts toward its leader's rest, and the tax pulls on it
  const lead = leaderOf(v);
  const rest = lead ? (LOYALTY_REST_BY_NATURE[natureOf(lead).id] ?? LOYALTY_REST) : LOYALTY_REST;
  const before = v.loyalty;
  v.loyalty = clamp(v.loyalty + (rest - v.loyalty) * LOYALTY_DRIFT + (TAX_LOYALTY[s.tax ?? 'fair'] ?? 0));
  if (!v.rebel && v.loyalty < REBEL_AT && before >= REBEL_AT) breakAway(s, v);
  if (v.rebel && v.loyalty >= RECONCILE_AT) reconcile(s, v, 'Its quarrel with the town is mended.');
  // a wedding between the village and the town
  if (!v.rebel && rng.chance(WED_DAILY)) wedding(s, v, rng);
  // beset
  if (!v.beset && !v.rebel && rng.chance(BESET_DAILY * (1 + v.pop / 20))) beset(s, v, rng);
  // a rebel village raids
  if (v.rebel && !s.raid && rng.chance(REBEL_RAID_DAILY)) rebelRaid(s, v, rng);
}

function breakAway(s: GameState, v: Village): void {
  v.rebel = true;
  tell(v, 'Broke away from the town.');
  notify(s, `${v.name} breaks away! ${leaderOf(v)?.name ?? 'Its leader'} says the town has taken enough from them, and they'll answer to nobody now.`, true);
}

function reconcile(s: GameState, v: Village, why: string): void {
  v.rebel = false;
  tell(v, why);
  notify(s, `${v.name} is the town's again. ${why}`, true);
}

function rebelRaid(s: GameState, v: Village, rng: Rng): void {
  const kind = RAID_KIND_BY_ID.village_rebels;
  if (!kind) return;
  startRaid(s, kind, Math.max(20, Math.round(raidBudget(s) * REBEL_BUDGET_SHARE)), rng);
  tell(v, 'Sent its young hotheads to raid the town.');
  notify(s, `Rebels out of ${v.name} are coming to take what they say is theirs!`, true);
}

function wedding(s: GameState, v: Village, rng: Rng): void {
  const single = (p: Person) => !isChild(p) && p.partner == null && !p.monster && p.away === null && !p.downed;
  const town = s.people.filter((p) => single(p) && p.id !== s.mainId);
  if (!town.length) return;
  const ours = town[rng.int(0, town.length - 1)];
  let theirs = v.folk.find((p) => single(p) && p.id !== v.leader);
  const moveIn = !townFull(s) && housingCapacity(s) > s.people.length;
  if (!theirs) {
    if (v.pop <= v.folk.length) return;
    theirs = makePerson(rng, s.nextId++, 'gatherer', { x: (v.x + 0.5) * CELL, y: (v.y + 0.5) * CELL }, [...s.people, ...v.folk].map((p) => p.name));
    theirs.origin = ours.origin;
    v.folk.push(theirs);
  }
  ours.partner = theirs.id;
  theirs.partner = ours.id;
  ours.married = theirs.married = true;
  v.loyalty = clamp(v.loyalty + WED_LOYALTY);
  if (moveIn) {
    v.folk = v.folk.filter((p) => p !== theirs);
    v.pop = Math.max(v.folk.length, v.pop - 1);
    theirs.x = (v.x + 0.5) * CELL;
    theirs.y = (v.y + 0.5) * CELL;
    theirs.away = null;
    theirs.task = null;
    s.people.push(theirs);
    assignBeds(s);
    weddingFeast(s, ours, theirs);
    tell(v, `${theirs.name} married ${ours.name} and went to live in the town.`);
    notify(s, `${theirs.name} of ${v.name} weds ${ours.name}, and comes to live in the town.`, true);
  } else {
    s.people = s.people.filter((p) => p !== ours);
    ours.task = null;
    ours.guard = false;
    v.folk.push(ours);
    v.pop++;
    assignBeds(s);
    tell(v, `${ours.name} of the town married ${theirs.name} and came to live here.`);
    notify(s, `${ours.name} weds ${theirs.name} of ${v.name}, and goes to live there.`, true);
  }
}

/* ------------------------------------------------------------ beset */

function beset(s: GameState, v: Village, rng: Rng): void {
  const foe = rng.pick([...BESET_FOES]);
  const cal = calendar(s.tick);
  const can = s.coins !== undefined && (s.coins ?? 0) >= SELLSWORDS_COINS;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'village',
    expedition: null,
    title: `${v.name} is beset`,
    text: `A runner from ${v.name}: ${foe} are at their fences. They ask the town for help.`,
    options: [...BESET_OPTIONS],
    defaultOption: can ? 1 : 0,
    expiresTick: s.tick + BESET_HOURS * TICKS_PER_HOUR,
    story: `A runner comes in from ${v.name}, out of breath and muddy to the knees: ${foe} are at their fences, and ${leaderOf(v)?.name ?? 'their leader'} asks the town for help.\n\nThe town can send ${HELPERS} of its best fighters (gone most of a day, and they may come back hurt, or not at all), pay sellswords to go (${SELLSWORDS_COINS} coins; the treasury holds ${Math.floor(s.coins ?? 0)}), or leave ${v.name} to it. ${v.name} has ${v.pop} people, and will remember what the town does.`,
    picture: eventPicture(`beset:${v.id}:${s.tick}`, 'village raid fire defence fight', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    village: { about: 'beset', id: v.id },
  };
  s.prompts.push(prompt);
  v.beset = { foe, prompt: prompt.id, until: prompt.expiresTick };
  tell(v, `Beset by ${foe}.`);
  notify(s, `${v.name} is beset by ${foe}, and asks the town for help!`, true);
}

export function answerBeset(s: GameState, v: Village, option: number, rng: Rng): void {
  const b = v.beset;
  if (!b) return;
  v.beset = undefined;
  s.prompts = s.prompts.filter((p) => p.id !== b.prompt);
  const choice = BESET_OPTIONS[option] ?? BESET_OPTIONS[2];
  const lose = (share: number) => {
    const n = Math.max(1, Math.round(v.pop * share));
    v.pop = Math.max(1, v.pop - n);
    // (the named die first only if there are none other)
    while (v.folk.length > v.pop) {
      const gone = v.folk.filter((p) => p.id !== v.leader).pop() ?? v.folk[0];
      v.folk = v.folk.filter((p) => p !== gone);
    }
    return n;
  };
  if (choice === BESET_OPTIONS[0]) {
    const fighters = grownAtHome(s)
      .filter((p) => !p.monster || true)
      .filter((p) => p.id !== s.mainId || grownAtHome(s).length < 4)
      .sort((a, b) => Math.max(b.skills.melee.level, b.skills.ranged.level) - Math.max(a.skills.melee.level, a.skills.ranged.level) || a.id - b.id)
      .slice(0, HELPERS);
    if (!fighters.length) return answerBeset(s, { ...v, beset: b }, 2, rng);
    for (const p of fighters) {
      p.away = -(3_000_000 + v.id);
      p.task = null;
    }
    v.helpers = { ids: fighters.map((p) => p.id), until: s.tick + HELP_HOURS * TICKS_PER_HOUR };
    v.loyalty = clamp(v.loyalty + HELPED_LOYALTY);
    tell(v, `The town sent ${fighters.map((p) => p.name).join(', ')} to drive off the ${b.foe}.`);
    notify(s, `${fighters.map((p) => p.name).join(', ')} go to ${v.name}'s aid against ${b.foe}.`, true);
    return;
  }
  if (choice === BESET_OPTIONS[1] && (s.coins ?? 0) >= SELLSWORDS_COINS) {
    s.coins = (s.coins ?? 0) - SELLSWORDS_COINS;
    earn(s, 'realm', -SELLSWORDS_COINS);
    const n = lose(BESET_LOSS_PAID);
    v.loyalty = clamp(v.loyalty + PAID_LOYALTY);
    tell(v, `Sellswords paid by the town drove off the ${b.foe}; ${n} lost.`);
    notify(s, `Sellswords paid by the town drive the ${b.foe} from ${v.name}. ${n} of theirs were lost.`, true);
    return;
  }
  const n = lose(rng.range(BESET_LOSS[0], BESET_LOSS[1]));
  v.loyalty = clamp(v.loyalty + REFUSED_LOYALTY);
  tell(v, `Left alone against the ${b.foe}: ${n} lost. They won't forget it.`);
  notify(s, `${v.name} faced the ${b.foe} alone and lost ${n} of their people. They won't forget it.`, true);
  if (!v.rebel && v.loyalty < REBEL_AT) breakAway(s, v);
}

/** The town's fighters come back from a village's aid. */
function helpersHome(s: GameState, v: Village, rng: Rng): void {
  const h = v.helpers!;
  v.helpers = undefined;
  const back: string[] = [];
  const lost: string[] = [];
  for (const id of h.ids) {
    const p = s.people.find((q) => q.id === id);
    if (!p || p.away !== -(3_000_000 + v.id)) continue;
    p.away = null;
    p.x = (v.x + 0.5) * CELL;
    p.y = (v.y + 2.5) * CELL;
    if (rng.chance(HELP_KILLS)) {
      killPerson(s, p, `fell defending ${v.name}`);
      lost.push(p.name);
      continue;
    }
    if (rng.chance(HELP_HURT)) {
      const hp = Math.round(p.hp * 0.4);
      p.hp = Math.max(1, p.hp - hp);
      minorWound(s, p, hp, rng);
    }
    back.push(p.name);
    v.loyalty = clamp(v.loyalty + SENT_HELP_LOYALTY);
  }
  tell(v, `The town's fighters drove off the raiders${lost.length ? `; ${lost.join(', ')} fell here` : ''}.`);
  notify(s, `${back.length ? `${back.join(', ')} come home from ${v.name}` : `None came home from ${v.name}`}${lost.length ? `; ${lost.join(', ')} fell defending it` : ', its foes driven off'}.`, true);
}

/* ------------------------------------------------------------ carts */

/** A loaded cart reaches the town's market: tithe, or sold. */
export function cartArrives(s: GameState, villageId: number, at: Pt): void {
  const v = villageById(s, villageId);
  if (!v) return;
  const load: Partial<Record<Material, number>> = {};
  for (const [m, n] of Object.entries(v.goods) as [Material, number][]) {
    const k = Math.floor(n);
    if (k > 0) {
      load[m] = k;
      v.goods[m] = n - k;
    }
  }
  const worth = Object.entries(load).reduce((t, [m, n]) => t + (WORTH[m as Material] ?? 1) * (n ?? 0), 0);
  const what = Object.entries(load).map(([m, n]) => `${n} ${m.replace(/_/g, ' ')}`).join(', ');
  if (!what) return;
  if (v.loyalty >= TITHE_AT) {
    depositNear(s, at, load);
    tell(v, `Sent the town ${what} as tithe.`);
    notify(s, `A cart from ${v.name} brings ${what}: their tithe to the town.`);
    return;
  }
  const price = Math.round(worth * WORTH_SHARE);
  if ((s.coins ?? 0) >= price) {
    s.coins = (s.coins ?? 0) - price;
    earn(s, 'goods', -price);
    depositNear(s, at, load);
    v.loyalty = clamp(v.loyalty + 1);
    tell(v, `Sold the town ${what} for ${price} coins.`);
    notify(s, `A cart from ${v.name} sells the town ${what} for ${price} coins.`);
  } else {
    for (const [m, n] of Object.entries(load) as [Material, number][]) v.goods[m] = (v.goods[m] ?? 0) + n;
    v.loyalty = clamp(v.loyalty - 2);
    tell(v, 'The town could not pay for the cart; it went home full.');
    notify(s, `A cart from ${v.name} goes home full: the treasury couldn't pay for its ${what}.`);
  }
}

const loaded = (v: Village) => Object.values(v.goods).reduce((t, n) => t + Math.floor(n ?? 0), 0);

/* ------------------------------------------------------------ the hour */

export function villagesHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  const rng = rngOf(s, 1);
  const hour = calendar(s.tick).hour;
  // (the parting's question unanswered: the default stands)
  if (s.villagePlan && !s.prompts.some((p) => p.id === s.villagePlan!.prompt)) answerParting(s, 0, rng);
  if (hour === VILLAGE_HOUR && wantVillage(s)) proposeVillage(s, rng);
  for (const v of [...villagesOf(s)]) {
    if (hour === VILLAGE_HOUR) villageDay(s, v, rngOf(s, v.id));
    if (v.beset && s.tick >= v.beset.until) {
      const p = s.prompts.find((q) => q.id === v.beset!.prompt);
      answerBeset(s, v, p ? p.defaultOption : 2, rng);
    }
    if (v.helpers && s.tick >= v.helpers.until) helpersHome(s, v, rng);
    if (v.cart !== undefined && !(s.bands ?? []).some((b) => b.id === v.cart)) v.cart = undefined;
    if (!v.rebel && v.cart === undefined && loaded(v) >= CART_LOAD && !s.raid && hour >= 7 && hour <= 16) v.cart = spawnVillageCart(s, rng, v.id, { x: (v.x + 0.5) * CELL, y: (v.y + 2.5) * CELL }, CART_STAY_HOURS).id;
  }
}

/* ------------------------------------------------------------ the town's raids */

/** A raid on the town: loyal villages send fighters. */
export function villageAllies(s: GameState, r: Raid, rng: Rng, make: (kind: string, at: Pt) => Raider): number {
  let sent = 0;
  for (const v of s.villages ?? []) {
    if (v.rebel || v.loyalty < HELP_AT || v.pop < HELP_FOLK || r.kind === 'village_rebels' || !rng.chance(HELP_CHANCE)) continue;
    const kinds = MILITIA_BY_ERA[s.era] ?? MILITIA_BY_ERA.medieval;
    const n = rng.int(HELP_SENT[0], HELP_SENT[1]);
    for (let i = 0; i < n; i++) r.raiders.push(make(kinds[i % kinds.length], { x: (v.x + 0.5) * CELL, y: (v.y + 0.5) * CELL }));
    sent += n;
    v.loyalty = clamp(v.loyalty + SENT_HELP_LOYALTY);
    tell(v, `Sent ${n} to fight beside the town.`);
    notify(s, `${v.name} sends ${n} of its own to stand with the town!`, true);
  }
  return sent;
}

/** A village's question answered (the parting, or a village beset). */
export function answerVillagePrompt(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  if (prompt.village?.about === 'parting') return answerParting(s, option, rng);
  const v = prompt.village?.id !== undefined ? villageById(s, prompt.village.id) : undefined;
  if (v) answerBeset(s, v, option, rng);
}

/* ------------------------------------------------------------ the player */

/** A gift from the treasury: loyalty up (half as much to a rebel village). */
export function giftVillage(s: GameState, id: number): boolean {
  const v = villageById(s, id);
  if (!v || (s.coins ?? 0) < GIFT_COINS) return false;
  s.coins = (s.coins ?? 0) - GIFT_COINS;
  earn(s, 'realm', -GIFT_COINS);
  v.loyalty = clamp(v.loyalty + (v.rebel ? GIFT_LOYALTY / 2 : GIFT_LOYALTY));
  tell(v, `The town sent a gift of ${GIFT_COINS} coins.`);
  notify(s, `The town sends ${v.name} a gift of ${GIFT_COINS} coins.`);
  if (v.rebel && v.loyalty >= RECONCILE_AT) reconcile(s, v, 'The gifts have won it back.');
  return true;
}

/** A rebel village, on the Expedition Board: a party sent to bring it to heel. */
export function villageDestination(s: GameState, id: string): Destination | undefined {
  const v = villageById(s, Number(id.slice(VILLAGE_DEST.length)));
  if (!v || !v.rebel) return undefined;
  const kinds = MILITIA_BY_ERA[s.era] ?? MILITIA_BY_ERA.medieval;
  const foes: Record<string, number> = { [kinds[0]]: Math.min(6, 2 + Math.floor(v.pop / 6)), ...(kinds[1] ? { [kinds[1]]: Math.min(4, 1 + Math.floor(v.pop / 10)) } : {}) };
  return {
    id: `${VILLAGE_DEST}${v.id}`,
    name: `Bring ${v.name} to heel`,
    type: 'clear',
    outSeconds: 60,
    workSeconds: 20,
    secondsPerUnit: 8,
    loot: {},
    threats: Object.keys(foes).join(', '),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: foes, weight: 1 }] },
    recommendedParty: 5,
    scenery: 'woods',
    description: `${v.name} has broken away under ${leaderOf(v)?.name ?? 'its leader'}. A party sent to beat its hotheads would bring it back to the town, and a tribute with it.`,
  };
}
export const villageDestinations = (s: GameState): Destination[] => (s.villages ?? []).filter((v) => v.rebel).map((v) => villageDestination(s, `${VILLAGE_DEST}${v.id}`)!).filter(Boolean);

/** A party home from a rebel village: won, it's the town's again. */
export function villageHome(s: GameState, dest: string, cleared: boolean): void {
  if (!isVillageDest(dest)) return;
  const v = villageById(s, Number(dest.slice(VILLAGE_DEST.length)));
  if (!v || !v.rebel) return;
  if (!cleared) {
    v.loyalty = clamp(v.loyalty - 5);
    notify(s, `The party came back from ${v.name} beaten. The rebels crow about it.`, true);
    return;
  }
  v.loyalty = Math.max(v.loyalty, HEELED_LOYALTY);
  const tribute = 10 + v.pop * 2;
  s.coins = (s.coins ?? 0) + tribute;
  earn(s, 'realm', tribute);
  reconcile(s, v, `Brought to heel, it pays ${tribute} coins.`);
}

/* ------------------------------------------------------------ seen */

export interface VillageView {
  id: number;
  name: string;
  x: number;
  y: number;
  tier: string;
  pop: number;
  loyalty: number;
  rebel: boolean;
  leader: string;
  leaderNature: string;
  founded: number;
  makes: string[];
  goods: number;
  news: string[];
  folk: { id: number; name: string; look: Person['look'] }[];
  beset: string | null;
  helpers: string[];
  cartOut: boolean;
  tithe: boolean;
  canGift: boolean;
}

export function villageViews(s: GameState): VillageView[] {
  return (s.villages ?? []).map((v) => {
    const lead = leaderOf(v);
    return {
      id: v.id,
      name: v.name,
      x: v.x,
      y: v.y,
      tier: tierOf(v),
      pop: v.pop,
      loyalty: Math.round(v.loyalty),
      rebel: !!v.rebel,
      leader: lead?.name ?? 'nobody',
      leaderNature: lead ? natureOf(lead).name : '',
      founded: Math.floor(v.founded / TICKS_PER_DAY) + 1,
      makes: makesOf(s, v).map((m) => m.replace(/_/g, ' ')),
      goods: loaded(v),
      news: v.news.slice(0, 5),
      folk: v.folk.slice(0, 6).map((p) => ({ id: p.id, name: p.name, look: p.look })),
      beset: v.beset?.foe ?? null,
      helpers: (v.helpers?.ids ?? []).map((id) => s.people.find((p) => p.id === id)?.name ?? '').filter(Boolean),
      cartOut: v.cart !== undefined,
      tithe: v.loyalty >= TITHE_AT,
      canGift: (s.coins ?? 0) >= GIFT_COINS,
    };
  });
}
export { GIFT_COINS };
