// The Calamity (data/calamity.ts): every town's long story. It wakes on `CALAMITY_WAKES`, and each morning its dread
// rises by `DREAD_PER_DAY` and more for every nest left to grow on the land (sim/nests.ts), less for the ward stones
// standing. Its stages, by the dread: omens (a sign each night, now and then); the spreading (its heart comes on the
// Expedition Board, its scar blights the land round it and widens each day, nests come thicker and grow faster); the
// cults (townsfolk with low spirits are lured, and do it harm in secret till found out and cast out); the armies (it
// raids); and at 100 the last siege, its whole host led by its avatar, warned a day ahead. The avatar struck down, the
// town has won the game; the siege lost, the town is burned, the dread falls back to `SIEGE_LOST_DREAD` and climbs
// again, and the third lost siege is the end. Each stage is told in the event box. Only in a town running itself;
// rolls are the seed's own.

// The Calamity (data/calamity.ts): the Great Enemy's stirring made manifest, not a second villain on a clock of its
// own. Which Calamity a town has follows from its Enemy (`ENEMY_CALAMITY`), and the Enemy's **plan** (sim/greatEnemy.ts)
// drives it: it wakes far off in the omens (`CALAMITY_AT.wakes`), its heart opens on the Expedition Board and its scar
// blights the land round it after the stirring (`spreading`; nests come thicker and grow faster), its cult takes root
// and lures the low-spirited (`cults`), and from the march the Enemy's hosts are its armies; the last siege is the
// Enemy's, and so is the peace. Its heart is the Enemy's forward seat, held by a lieutenant's work: a party that clears
// it sets the plan back (`HEART_SETBACK`), which is a setback and not the end of the story. Nests burned out and
// ward stones standing slow the plan too. The dread the menus show is the plan's share of the way to the siege.
// Only in a town running itself; rolls are the seed's own (the `calamity` stream).

import {
  CALAMITIES,
  CALAMITY_AT,
  CULT_DAILY,
  ENEMY_CALAMITY,
  FOUND_CHANCE,
  HEART_FAR,
  HEART_QUIET_DAYS,
  HEART_SETBACK,
  LURE_BELOW,
  LURE_CHANCE,
  NEST_HASTE,
  RITE_PLAN,
  SCAR_MOST,
  SCAR_PER_DAY,
  SCAR_START,
  STAGE_NAMES,
  WARD,
  WARD_SLOW,
  WARDS_MOST,
  type CalamityKind,
  type CalamityStage,
} from '../data/calamity';
import { GREAT_ENEMIES, PLAN_AT } from '../data/greatEnemy';
import { BUILDING_BY_ID } from '../data/buildings';
import { eventPicture } from '../data/eventScenes';
import type { Destination } from '../data/expeditions';
import { DANGER_PACE } from '../data/pace';
import { directionName } from '../data/places';
import { hashSeed, Rng } from '../rng';
import { assignBeds } from './townsfolk';
import { placeBlueprint } from './buildings';
import { setFire } from './fire';
import { groundAt, inMap, wet } from './land';
import { nestsOf } from './nests';
import { findSpot } from './planner';
import { seaTown } from './sea';
import { campCell, notify, type GameState, type Person, type Prompt } from './state';
import type { GreatEnemyState } from './greatEnemy';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { isChild } from './social';
import { queueScene } from './cutscenes';
import { STAGE_SCENES, wakeSceneOf } from '../data/cutscenes';

export interface CalamityState {
  kind: CalamityKind;
  /** 0 to 100: the Enemy's plan as a share of the way to the siege (kept for the menus). */
  dread: number;
  stage: CalamityStage;
  woke: number;
  /** Its heart on the land (a cell), and how wide its scar has spread (cells; 0 before the spreading). */
  heart: { x: number; y: number } | null;
  scar: number;
  /** When a party last cleared its heart (it reforms after `HEART_QUIET_DAYS`). */
  heartCleared?: number;
  /** Driven by the Great Enemy's plan (set once; a save from before the Calamity became its stage lacks it: sim/greatEnemy.ts `bindCalamity`). */
  driven?: true;
  /** When the Enemy was slain and the land began to heal. */
  beaten?: number;
  /** The latest omen, for the menus. */
  omen?: string;
  /** (Old saves, from when it ran its own siege: sim/greatEnemy.ts `bindCalamity` carries them to the Enemy.) */
  siegeAt?: number;
  lost?: number;
}

const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:calamity:${salt.join(':')}`));
const def = (c: CalamityState) => CALAMITIES[c.kind];
const enemyIn = (s: GameState) => s.greatEnemy && s.greatEnemy.chosen >= 0 ? GREAT_ENEMIES[s.greatEnemy.kind] : undefined;
const ended = (e: GreatEnemyState) => e.stage === 'peace' || e.stage === 'fallen';
const planOfDread = (dread: number) => (dread * PLAN_AT.siege) / 100;

/** A line in the Enemy's Chronicle (the arc's one telling: sim/greatEnemy.ts keeps the last 24). */
function chronicle(s: GameState, e: GreatEnemyState | undefined, text: string): void {
  if (!e) return;
  e.log.push({ day: calendar(s.tick).day, text });
  if (e.log.length > 24) e.log.splice(0, e.log.length - 24);
}

/** The stage the Enemy's plan has brought it to (never back). */
export function stageOfEnemy(e: Pick<GreatEnemyState, 'plan' | 'stage'>): CalamityStage {
  if (e.stage === 'siege') return 5;
  if (e.stage === 'march') return 4;
  if (e.plan >= CALAMITY_AT.cults) return 3;
  if (e.plan >= CALAMITY_AT.spreading) return 2;
  return e.plan >= CALAMITY_AT.wakes ? 1 : 0;
}

/** It wakes: its heart far out on the land, its kind the Enemy's. */
export function wakeCalamity(s: GameState, kind: CalamityKind = s.greatEnemy ? ENEMY_CALAMITY[s.greatEnemy.kind] : 'tyrant'): CalamityState {
  const c: CalamityState = { kind, dread: 0, stage: 1, woke: s.tick, heart: heartSpot(s), scar: 0, driven: true };
  s.calamity = c;
  const e = enemyIn(s);
  chronicle(s, s.greatEnemy, `${capital(def(c).name)} woke, ${e?.short ?? 'the Enemy'}'s doing`);
  tell(s, c, `${capital(def(c).name)} wakes`, `${def(c).waking}${e ? ` It is ${e.name}'s doing: ${e.short} sends it ahead of itself, and the land will feel it first.` : ''}`, 'omen', wakeSceneOf(c.kind));
  return c;
}

/** A dry cell about `HEART_FAR` from the camp (the nearest the land allows). */
function heartSpot(s: GameState): { x: number; y: number } | null {
  const camp = campCell(s);
  const g = roll(s, 'heart');
  for (let far = HEART_FAR; far >= 20; far -= 6)
    for (let tries = 0; tries < 30; tries++) {
      const a = g.range(0, Math.PI * 2);
      const x = Math.round(camp.x + Math.cos(a) * far);
      const y = Math.round(camp.y + Math.sin(a) * far);
      if (!inMap(s.land, x, y) || x < 2 || y < 2 || x >= s.land.w - 2 || y >= s.land.h - 2) continue;
      const gr = groundAt(s.land, x, y);
      if (wet(gr) || gr === 'mountain' || gr === 'hall') continue;
      return { x, y };
    }
  return null;
}

/* ------------------------------------------------------------ driven by the plan */

/** How much the Calamity quickens the Enemy's plan today (a day's pace): for each level of each nest left on the land,
 *  less for each ward stone standing. Nothing before it has spread. */
export function calamityPace(s: GameState): number {
  const c = s.calamity;
  if (!c || c.beaten !== undefined || c.stage < 2) return 0;
  const nests = nestsOf(s).reduce((n, p) => n + p.nest!.level, 0);
  const wards = s.buildings.filter((b) => b.def === WARD && b.status === 'done').length;
  return NEST_HASTE * nests - WARD_SLOW * wards;
}

/** The plan moves by some days (a nest burned out, a heart struck, a rite held), never into the siege on its own. */
export function shiftPlan(s: GameState, days: number): boolean {
  const e = s.greatEnemy;
  if (!e || ended(e) || e.siegeAt !== undefined) return false;
  e.plan = Math.max(0, Math.min(PLAN_AT.siege - 0.1, e.plan + days));
  return true;
}

/** The dread (as the menus count it, 0 to 100) moves: the plan moves with it. */
export const shiftDread = (s: GameState, dread: number) => shiftPlan(s, planOfDread(dread));

/** The Enemy's plan has moved (from sim/greatEnemy.ts, each morning and when a stage is forced): the Calamity wakes
 *  and passes into its stages with it, each told once, and the dread follows the plan. */
export function calamitySync(s: GameState, e: GreatEnemyState): void {
  const c = s.calamity;
  if (c?.beaten !== undefined || ended(e)) return;
  const stage = stageOfEnemy(e);
  if (!c) {
    if (stage < 1) return;
    wakeCalamity(s, ENEMY_CALAMITY[e.kind]);
  }
  const now = s.calamity!;
  now.dread = Math.min(100, Math.round(((e.plan * 100) / PLAN_AT.siege) * 10) / 10);
  if (stage > now.stage) {
    for (let k = now.stage + 1; k <= stage; k++) {
      now.stage = k as CalamityStage;
      if (k <= 3) chronicle(s, e, `${capital(def(now).name)}: ${STAGE_NAMES[k].toLowerCase()}`);
      if (k <= 3) tell(s, now, `${capital(def(now).name)}: ${STAGE_NAMES[k].toLowerCase()}`, stageStory(s, now, k), 'omen', STAGE_SCENES[k]);
    }
  }
}

/** Each morning, from the Enemy's day (`g` is the Calamity's own stream): the scar widens, ward stones are raised, the
 *  cult does its deeds. */
export function calamityDaily(s: GameState, e: GreatEnemyState, g: Rng = roll(s, 'day', calendar(s.tick).day)): void {
  calamitySync(s, e);
  const c = s.calamity;
  if (!c || c.beaten !== undefined || ended(e)) return;
  if (c.stage >= 2) {
    if (c.heartCleared === undefined || s.tick - c.heartCleared >= HEART_QUIET_DAYS * TICKS_PER_DAY) c.scar = Math.min(SCAR_MOST, Math.max(c.scar, SCAR_START) + SCAR_PER_DAY);
    raiseWards(s, c);
  }
  if (c.stage >= 3 && g.chance(CULT_DAILY)) cultDeed(s, c, g);
  if (c.stage >= 3) cultFound(s, c, g);
}

/** The Enemy is slain (from sim/greatEnemy.ts `victory`): the blight lifts and the cult scatters. */
export function calamityLifts(s: GameState): void {
  const c = s.calamity;
  if (!c || c.beaten !== undefined) return;
  c.beaten = s.tick;
  c.scar = 0;
  for (const p of s.people) if (p.cultist) p.cultist = undefined;
}

/** An omen of the Enemy's, foreshadowing the Calamity it will bring (the lines of its Calamity, from the omens on). */
export const calamityOmens = (kind: keyof typeof ENEMY_CALAMITY): string[] => CALAMITIES[ENEMY_CALAMITY[kind]].omens;

function stageStory(s: GameState, c: CalamityState, stage: number): string {
  const d = def(c);
  const e = enemyIn(s);
  const by = e ? ` It is ${e.name}'s work.` : '';
  const more: Record<number, string> = {
    2: `Its heart, ${d.heart}, ${e ? `where ${e.short}'s lieutenant works the land` : 'can be struck at'}, can be struck at: a party that clears it sets ${e ? e.short + "'s" : 'the'} plans back. Ward stones slow the blight, and every nest burned out weakens it.`,
    3: `${capital(d.cult)} meets in secret. Anyone in low spirits may be drawn in, and do the town harm before they're found out.`,
  };
  return `${d.stages[stage]}${by} ${more[stage] ?? ''}`.trim();
}

/** Ward stones: one for each stage from the spreading, up to `WARDS_MOST`, raised one at a time. */
function raiseWards(s: GameState, c: CalamityState): void {
  const wards = s.buildings.filter((b) => b.def === WARD);
  if (wards.some((b) => b.status !== 'done') || wards.length >= Math.min(WARDS_MOST, c.stage - 1)) return;
  const d = BUILDING_BY_ID[WARD];
  const at = findSpot(s, d);
  if (at && placeBlueprint(s, WARD, at.x, at.y, false, false, !!at.wild)) notify(s, 'The town raises a ward stone against the dark.', true);
}

/** The cult does the town harm: lures someone, or its hidden members set a fire, rob the treasury or hold a rite. */
function cultDeed(s: GameState, c: CalamityState, g: Rng): void {
  const cult = def(c).cult;
  const lurable = s.people.filter((p) => p.away === null && p.id !== s.mainId && !isChild(p) && !p.undying && !p.cultist && p.morale < LURE_BELOW);
  if (lurable.length && g.chance(LURE_CHANCE)) {
    const p = g.pick(lurable);
    p.cultist = { since: s.tick };
    return; // (nobody knows: yet)
  }
  const hidden = s.people.filter((p) => p.cultist && !p.cultist.found);
  if (!hidden.length) {
    shiftPlan(s, RITE_PLAN);
    notify(s, `Fires were seen in the woods last night: ${cult} keeping its rites.`);
    return;
  }
  const deed = g.int(0, 2);
  if (deed === 0) {
    const b = g.pick(s.buildings.filter((q) => q.status === 'done' && q.def !== 'campfire' && !BUILDING_BY_ID[q.def]?.seat) as typeof s.buildings);
    if (b && setFire(s, b)) notify(s, `Fire! Someone set ${BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? 'a building'} alight in the night, and the town smells ${cult} in it.`, true);
  } else if (deed === 1 && (s.coins ?? 0) > 10) {
    const took = Math.max(5, Math.round((s.coins ?? 0) * 0.15));
    s.coins = (s.coins ?? 0) - took;
    notify(s, `${took} coins are missing from the treasury. Nobody saw who took them.`, true);
  } else {
    shiftPlan(s, 3 * RITE_PLAN);
    notify(s, `A rite was held at the town's edge in the night: someone of the town is with ${cult}.`, true);
  }
}

/** Each morning a cultist may be found out (more likely with guards about): the town casts them out. */
function cultFound(s: GameState, c: CalamityState, g: Rng): void {
  const guards = s.people.filter((p) => p.guard && p.away === null).length;
  for (const p of s.people.filter((q) => q.cultist && !q.cultist.found)) {
    if (!g.chance(FOUND_CHANCE * (1 + 0.5 * guards))) continue;
    p.cultist!.found = true;
    s.people = s.people.filter((q) => q !== p);
    assignBeds(s);
    notify(s, `${p.name} has been found out as one of ${def(c).cult}, and is cast out of the town.`, true);
  }
}

/* ------------------------------------------------------------ the heart */

export const HEART_DEST = 'calamity:heart';
export const isHeartDest = (id: string) => id === HEART_DEST;

/** Whether the heart stands to be struck at: from the spreading on, while the Enemy lives, and not lately cleared. */
export const heartOpen = (s: GameState) => {
  const c = s.calamity;
  return !!c?.heart && c.stage >= 2 && c.beaten === undefined && (!s.greatEnemy || !ended(s.greatEnemy)) && (c.heartCleared === undefined || s.tick - c.heartCleared >= HEART_QUIET_DAYS * TICKS_PER_DAY);
};

/** The lieutenant whose work the heart is (by the seed, so it is the same one every time). */
const keeperOf = (s: GameState, e: GreatEnemyState) => GREAT_ENEMIES[e.kind].lieutenants[hashSeed(`${s.seed}:calamity-keeper`) % GREAT_ENEMIES[e.kind].lieutenants.length];

/** The heart as a place on the Expedition Board (while it stands). A party already out `held` there keeps its place
 *  after clearing it (the heart is shut for a while, but the party still has to come home from it). */
export function heartDestination(s: GameState, held = false): Destination | undefined {
  const c = s.calamity;
  if (!c?.heart || (!held && !heartOpen(s))) return undefined;
  const d = def(c);
  const e = s.greatEnemy && s.greatEnemy.chosen >= 0 ? s.greatEnemy : undefined;
  const camp = campCell(s);
  const cells = Math.hypot(c.heart.x - camp.x, c.heart.y - camp.y);
  const guard = d.guard[Math.min(d.guard.length - 1, c.stage - 2)];
  const owner = e ? `${GREAT_ENEMIES[e.kind].name}'s forward seat, raised by ${capital(keeperOf(s, e).name)}` : `The heart of ${d.name}`;
  return {
    id: HEART_DEST,
    name: d.heart,
    type: 'clear',
    outSeconds: Math.round(cells * 7),
    workSeconds: 40,
    secondsPerUnit: 8,
    loot: { bone: 3, stone: 3 },
    threats: Object.entries(guard).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(', '),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { ...guard }, weight: 1 }] },
    recommendedParty: 5,
    scenery: 'cave',
    description: `${owner}, ${directionName(c.heart.x - camp.x, c.heart.y - camp.y)} of the town. Clearing it sets the plan back by ${HEART_SETBACK} days and shrinks its scar, but the Enemy is not ended by it.`,
  };
}

export const heartDestinations = (s: GameState): Destination[] => {
  const d = heartDestination(s);
  return d ? [d] : [];
};

/** A party cleared the heart (from sim/expeditions.ts, as a place is cleared): the Enemy's plan is set back. */
export function heartCleared(s: GameState): void {
  const c = s.calamity;
  if (!c || !heartOpen(s)) return;
  c.heartCleared = s.tick;
  c.scar = Math.max(SCAR_START, c.scar / 2);
  shiftPlan(s, -HEART_SETBACK);
  const e = s.greatEnemy;
  const who = e ? GREAT_ENEMIES[e.kind].short : def(c).name;
  chronicle(s, e, `A party broke ${def(c).heart}`);
  if (e) c.dread = Math.round(((e.plan * 100) / PLAN_AT.siege) * 10) / 10;
  (s.marks ??= []).push({ lever: 'morale', value: 6, until: s.tick + 2 * TICKS_PER_DAY, text: `We struck at ${def(c).heart}` });
  queueScene(s, 'calamity_heart');
  notify(s, `${def(c).heart} is broken! ${capital(who)}'s plans are set back (−${HEART_SETBACK} days); its heart will be a while gathering itself again.`, true);
}

/* ------------------------------------------------------------ telling */

function tell(s: GameState, c: CalamityState, title: string, story: string, words: string, scene?: string): void {
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: story.split('. ')[0] + '.',
    story,
    picture: eventPicture(`calamity:${c.kind}:${c.stage}`, `${def(c).picture} ${words}`, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: ['We will stand'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  // (with a cutscene to watch, the telling waits on it: sim/cutscenes.ts)
  const e = enemyIn(s);
  if (scene) queueScene(s, scene, { fallback: prompt, ...(e ? { vars: { enemy: e.name, short: e.short, seat: e.seat } } : {}) });
  else s.prompts.push(prompt);
  notify(s, `${title}.`, true);
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------ the view */

export interface CalamityView {
  kind: CalamityKind;
  name: string;
  /** The Great Enemy whose stirring it is (its name), and the lieutenant who keeps the heart. */
  enemy: string | null;
  keeper: string | null;
  heart: string;
  stage: number;
  stageName: string;
  /** 0 to 100 (the plan's share of the way to the siege), and how much it rises today. */
  dread: number;
  rising: number;
  /** What comes next, in a line. */
  next: string;
  omen: string | null;
  nests: number;
  wards: number;
  /** The heart's cell (once it can be struck at), its scar (cells), and whether a party can go now. */
  heartAt: { x: number; y: number } | null;
  scar: number;
  heartOpen: boolean;
  /** The heart as a trip on the board, while it can be struck at. */
  dest: Destination | null;
  /** Hours till the siege (warned), and the sieges lost (the Enemy's). */
  siegeIn: number | null;
  lost: number;
  beaten: boolean;
  cultists: number;
}

export function calamityView(s: GameState): CalamityView | null {
  const c = s.calamity;
  if (!c) return null;
  const d = def(c);
  const e = s.greatEnemy && s.greatEnemy.chosen >= 0 ? s.greatEnemy : undefined;
  const ed = e ? GREAT_ENEMIES[e.kind] : undefined;
  const rising = e ? ((e.pace * 100) / PLAN_AT.siege) / DANGER_PACE : 0;
  const nextPlan = [0, CALAMITY_AT.wakes, CALAMITY_AT.spreading, CALAMITY_AT.cults, PLAN_AT.march, PLAN_AT.siege][Math.min(5, c.stage + 1)];
  const next =
    c.beaten !== undefined
      ? 'Beaten. The land is healing.'
      : e?.siegeAt !== undefined
        ? 'The last siege is coming.'
        : c.stage >= 5
          ? 'The last siege.'
          : `${STAGE_NAMES[c.stage + 1]} at dread ${Math.round((nextPlan * 100) / PLAN_AT.siege)}${e && e.pace > 0 ? `, in about ${Math.max(1, Math.ceil(((nextPlan - e.plan) * DANGER_PACE) / e.pace))} days` : ''}.`;
  return {
    kind: c.kind,
    name: capital(d.name),
    enemy: ed ? capital(ed.name) : null,
    keeper: e ? capital(keeperOf(s, e).name) : null,
    heart: d.heart,
    stage: c.stage,
    stageName: STAGE_NAMES[c.stage],
    dread: Math.round(c.dread * 10) / 10,
    rising: Math.round(rising * 100) / 100,
    next,
    omen: c.omen ?? null,
    nests: nestsOf(s).filter((p) => p.found !== null).length,
    wards: s.buildings.filter((b) => b.def === WARD && b.status === 'done').length,
    heartAt: c.stage >= 2 && c.heart ? c.heart : null,
    scar: c.scar,
    heartOpen: heartOpen(s),
    dest: heartDestination(s) ?? null,
    siegeIn: e?.siegeAt !== undefined ? Math.max(0, Math.ceil((e.siegeAt - s.tick) / TICKS_PER_HOUR)) : null,
    lost: e?.lost ?? 0,
    beaten: c.beaten !== undefined,
    cultists: s.people.filter((p: Person) => p.cultist && !p.cultist.found).length,
  };
}
