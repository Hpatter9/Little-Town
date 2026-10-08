// The Calamity (data/calamity.ts): every town's long story. It wakes on `CALAMITY_WAKES`, and each morning its dread
// rises by `DREAD_PER_DAY` and more for every nest left to grow on the land (sim/nests.ts), less for the ward stones
// standing. Its stages, by the dread: omens (a sign each night, now and then); the spreading (its heart comes on the
// Expedition Board, its scar blights the land round it and widens each day, nests come thicker and grow faster); the
// cults (townsfolk with low spirits are lured, and do it harm in secret till found out and cast out); the armies (it
// raids); and at 100 the last siege, its whole host led by its avatar, warned a day ahead. The avatar struck down, the
// town has won the game; the siege lost, the town is burned, the dread falls back to `SIEGE_LOST_DREAD` and climbs
// again, and the third lost siege is the end. Each stage is told in the event box. Only in a town running itself;
// rolls are the seed's own.

import {
  ARMY_DAILY,
  ARMY_SHARE,
  CALAMITIES,
  CALAMITY_HOUR,
  CALAMITY_KINDS,
  CALAMITY_WAKES,
  CULT_DAILY,
  DREAD_PER_DAY,
  DREAD_PER_NEST_LEVEL,
  FOUND_CHANCE,
  HEART_DREAD,
  HEART_FAR,
  HEART_QUIET_DAYS,
  LURE_BELOW,
  LURE_CHANCE,
  OMEN_HOUR,
  OMEN_NIGHTLY,
  SCAR_MOST,
  SCAR_PER_DAY,
  SCAR_START,
  SIEGE_LOST_DREAD,
  SIEGE_RUIN,
  SIEGE_SIZE,
  SIEGE_SIZE_PER_LOSS,
  SIEGE_WARNING_HOURS,
  SIEGES_TO_FALL,
  STAGE_NAMES,
  WARD,
  WARD_DREAD,
  WARDS_MOST,
  stageOfDread,
  type CalamityKind,
  type CalamityStage,
} from '../data/calamity';
import { BUILDING_BY_ID } from '../data/buildings';
import { RAID_KIND_BY_ID } from '../data/raids';
import { eventPicture } from '../data/eventScenes';
import type { Destination } from '../data/expeditions';
import { directionName } from '../data/places';
import { hashSeed, Rng } from '../rng';
import { assignBeds } from './townsfolk';
import { placeBlueprint } from './buildings';
import { setFire } from './fire';
import { groundAt, inMap, wet } from './land';
import { nestsOf } from './nests';
import { findSpot } from './planner';
import { raidBudget, scheduleNextRaid, startRaid } from './raids';
import { seaTown } from './sea';
import { campCell, notify, type GameState, type Person, type Prompt, type Raid } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { isChild } from './social';

export interface CalamityState {
  kind: CalamityKind;
  /** 0 to 100: how near it is. */
  dread: number;
  stage: CalamityStage;
  woke: number;
  /** Its heart on the land (a cell), and how wide its scar has spread (cells; 0 before the spreading). */
  heart: { x: number; y: number } | null;
  scar: number;
  /** When a party last cleared its heart (it reforms after `HEART_QUIET_DAYS`). */
  heartCleared?: number;
  /** The last siege: when it comes (warned), and the sieges lost. */
  siegeAt?: number;
  lost: number;
  /** When it was beaten for good. */
  beaten?: number;
  /** The latest omen, for the menus. */
  omen?: string;
}

const roll = (s: GameState, ...salt: (number | string)[]) => new Rng(hashSeed(`${s.seed}:calamity:${salt.join(':')}`));
const def = (c: CalamityState) => CALAMITIES[c.kind];

/** Which Calamity a town's seed brings. */
export const calamityKindOf = (seed: string): CalamityKind => CALAMITY_KINDS[hashSeed(`${seed}:calamity-kind`) % CALAMITY_KINDS.length];

/** It wakes: its kind from the seed, its heart far out on the land. */
export function wakeCalamity(s: GameState, kind: CalamityKind = calamityKindOf(s.seed)): CalamityState {
  const c: CalamityState = { kind, dread: 0, stage: 1, woke: s.tick, heart: heartSpot(s), scar: 0, lost: 0 };
  s.calamity = c;
  tell(s, c, `${capital(def(c).name)} wakes`, def(c).waking, 'omen');
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

/** Each hour: it wakes on its day; each night an omen may come; each morning the dread is reckoned and the stage's
 *  doings done; the siege comes when warned. */
export function calamityHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.gameOver || s.autopilot === false) return;
  const cal = calendar(s.tick);
  if (!s.calamity) {
    if (cal.day - 1 >= CALAMITY_WAKES && cal.hour === CALAMITY_HOUR) wakeCalamity(s);
    return;
  }
  const c = s.calamity;
  if (c.beaten !== undefined) return;
  if (c.siegeAt !== undefined && s.tick >= c.siegeAt && !s.raid) startSiege(s, c);
  if (cal.hour === OMEN_HOUR && roll(s, 'omen', cal.day).chance(OMEN_NIGHTLY)) omen(s, c);
  if (cal.hour === CALAMITY_HOUR) calamityDaily(s, c, roll(s, 'day', cal.day));
}

/** How much the dread rises today. */
export function dreadToday(s: GameState): number {
  const nests = nestsOf(s).reduce((n, p) => n + p.nest!.level, 0);
  const wards = s.buildings.filter((b) => b.def === WARD && b.status === 'done').length;
  return Math.max(0, DREAD_PER_DAY + DREAD_PER_NEST_LEVEL * nests - WARD_DREAD * wards);
}

function calamityDaily(s: GameState, c: CalamityState, g: Rng): void {
  if (c.siegeAt === undefined) c.dread = Math.min(100, c.dread + dreadToday(s));
  setStage(s, c, stageOfDread(c.dread));
  if (c.stage >= 2) {
    if (c.heartCleared === undefined || s.tick - c.heartCleared >= HEART_QUIET_DAYS * TICKS_PER_DAY) c.scar = Math.min(SCAR_MOST, Math.max(c.scar, SCAR_START) + SCAR_PER_DAY);
    raiseWards(s, c);
  }
  if (c.stage >= 3 && g.chance(CULT_DAILY)) cultDeed(s, c, g);
  if (c.stage >= 3) cultFound(s, c, g);
  if (c.stage === 4 && !s.raid && s.tick >= s.nextRaidTick - TICKS_PER_DAY && g.chance(ARMY_DAILY)) {
    const kind = RAID_KIND_BY_ID[def(c).army];
    const r = startRaid(s, kind, raidBudget(s) * ARMY_SHARE * (1 + c.dread / 100), g);
    r.calamity = 'army';
    scheduleNextRaid(s, g);
    notify(s, `${kind.name} march on the town!`, true);
  }
  if (c.stage === 5 && c.siegeAt === undefined && s.raid?.calamity !== 'siege') {
    c.siegeAt = s.tick + SIEGE_WARNING_HOURS * TICKS_PER_HOUR;
    notify(s, `${capital(def(c).name)} is coming. Its whole host will be at the gate within a day.`, true);
  }
}

/** The town passes into a stage: told in the event box. */
function setStage(s: GameState, c: CalamityState, stage: CalamityStage): void {
  if (stage <= c.stage) return;
  c.stage = stage;
  tell(s, c, `${capital(def(c).name)}: ${STAGE_NAMES[stage].toLowerCase()}`, stageStory(c, stage), stage >= 4 ? 'war' : 'omen');
}

function stageStory(c: CalamityState, stage: CalamityStage): string {
  const d = def(c);
  const more: Record<number, string> = {
    2: `Its heart, ${d.heart}, can be struck at: a party that clears it pushes the dread back. Ward stones slow it, and every nest burned out weakens it.`,
    3: `${capital(d.cult)} meets in secret. Anyone in low spirits may be drawn in, and do the town harm before they're found out.`,
    4: 'Its armies will come against the walls now. Keep the defences manned.',
    5: 'There is no turning it back now. Win, and the town is saved for good. Lose, and it will come again.',
  };
  return `${d.stages[stage]} ${more[stage] ?? ''}`.trim();
}

/** An omen in the night (a line in the journal, a chill on everyone). */
function omen(s: GameState, c: CalamityState): void {
  const lines = def(c).omens;
  const line = lines[roll(s, 'omen-line', s.tick).int(0, lines.length - 1)];
  c.omen = line;
  notify(s, `An omen: ${line}`, true);
  (s.marks ??= []).push({ lever: 'morale', value: -2, until: s.tick + 12 * TICKS_PER_HOUR, text: 'A bad omen' });
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
    c.dread = Math.min(100, c.dread + 1);
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
    c.dread = Math.min(100, c.dread + 3);
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

/* ------------------------------------------------------------ the last siege */

function startSiege(s: GameState, c: CalamityState): void {
  const d = def(c);
  const kind = RAID_KIND_BY_ID[d.army];
  const most = SIEGE_SIZE + SIEGE_SIZE_PER_LOSS * c.lost;
  const g = roll(s, 'siege', c.lost);
  const r = startRaid(s, kind, raidBudget(s) * 3, g, undefined, { most, siege: 0, leader: d.avatar, host: `calamity:${c.kind}` });
  r.calamity = 'siege';
  c.siegeAt = undefined;
  notify(s, `The last siege: ${d.name} has come to the gate with its whole host!`, true);
}

/** A raid of the Calamity's is over (from sim/raids.ts `endRaid`): a siege won is the game won; lost, the town burns
 *  and it comes again. */
export function calamityRaidOver(s: GameState, r: Raid): void {
  const c = s.calamity;
  if (!c || r.calamity !== 'siege') return;
  const d = def(c);
  const avatar = r.raiders.find((rd) => rd.kind === d.avatar && !rd.ally);
  if (avatar?.down) {
    c.beaten = s.tick;
    c.dread = 0;
    c.scar = 0;
    (s.marks ??= []).push({ lever: 'morale', value: 15, until: s.tick + 5 * TICKS_PER_DAY, text: `${capital(d.name)} is beaten!` });
    tell(s, c, `${capital(d.name)} is beaten`, `${d.stages[5].split('.')[0]} and fell before the walls. The blight lifts from the land, the cult scatters, and the town stands. Whatever comes after, this generation saved it.`, 'war');
    s.gameOver = { tick: s.tick, won: true, text: `${capital(d.name)} fell before the town's walls. The land is healing, and the town will be remembered for as long as anyone tells stories.` };
    return;
  }
  c.lost++;
  c.siegeAt = undefined;
  c.dread = SIEGE_LOST_DREAD;
  c.stage = 4;
  const g = roll(s, 'ruin', c.lost);
  const standing = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !BUILDING_BY_ID[b.def]?.seat);
  for (let i = 0; i < SIEGE_RUIN && standing.length; i++) setFire(s, standing.splice(g.int(0, standing.length - 1), 1)[0], true);
  if (c.lost >= SIEGES_TO_FALL) {
    s.gameOver = { tick: s.tick, text: `${capital(d.name)} broke the town at the third siege. Its people are scattered, and the land is its.` };
    return;
  }
  tell(s, c, `${capital(d.name)} withdraws`, `The town held, barely, but ${d.name} was not struck down. It draws back to gather its strength, and the town burns behind it. It will come again (${SIEGES_TO_FALL - c.lost} more ${SIEGES_TO_FALL - c.lost === 1 ? 'siege' : 'sieges'} lost and the town falls).`, 'war');
}

/* ------------------------------------------------------------ the heart */

export const HEART_DEST = 'calamity:heart';
export const isHeartDest = (id: string) => id === HEART_DEST;

/** Whether the heart stands to be struck at: from the spreading on, and not lately cleared. */
export const heartOpen = (s: GameState) => {
  const c = s.calamity;
  return !!c?.heart && c.stage >= 2 && c.beaten === undefined && (c.heartCleared === undefined || s.tick - c.heartCleared >= HEART_QUIET_DAYS * TICKS_PER_DAY);
};

/** The heart as a place on the Expedition Board (while it stands). */
export function heartDestination(s: GameState): Destination | undefined {
  const c = s.calamity;
  if (!c?.heart || !heartOpen(s)) return undefined;
  const d = def(c);
  const camp = campCell(s);
  const cells = Math.hypot(c.heart.x - camp.x, c.heart.y - camp.y);
  const guard = d.guard[Math.min(d.guard.length - 1, c.stage - 2)];
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
    description: `The heart of ${d.name}, ${directionName(c.heart.x - camp.x, c.heart.y - camp.y)} of the town. Clearing it pushes the dread back by ${HEART_DREAD} and shrinks its scar.`,
  };
}

export const heartDestinations = (s: GameState): Destination[] => {
  const d = heartDestination(s);
  return d ? [d] : [];
};

/** A party cleared the heart (from sim/expeditions.ts, as a place is cleared). */
export function heartCleared(s: GameState): void {
  const c = s.calamity;
  if (!c || !heartOpen(s)) return;
  c.heartCleared = s.tick;
  c.dread = Math.max(0, c.dread - HEART_DREAD);
  c.scar = Math.max(SCAR_START, c.scar / 2);
  (s.marks ??= []).push({ lever: 'morale', value: 6, until: s.tick + 2 * TICKS_PER_DAY, text: `We struck at ${def(c).heart}` });
  notify(s, `${def(c).heart} is broken! ${capital(def(c).name)} reels (dread −${HEART_DREAD}); its heart will be a while gathering itself again.`, true);
}

/* ------------------------------------------------------------ telling */

function tell(s: GameState, c: CalamityState, title: string, story: string, words: string): void {
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
  s.prompts.push(prompt);
  notify(s, `${title}.`, true);
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/* ------------------------------------------------------------ the view */

export interface CalamityView {
  kind: CalamityKind;
  name: string;
  heart: string;
  stage: number;
  stageName: string;
  /** 0 to 100, and how much it rises today. */
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
  /** Hours till the siege (warned), and the sieges lost. */
  siegeIn: number | null;
  lost: number;
  beaten: boolean;
  cultists: number;
}

export function calamityView(s: GameState): CalamityView | null {
  const c = s.calamity;
  if (!c) return null;
  const d = def(c);
  const rising = dreadToday(s);
  const nextAt = [0, 20, 45, 70, 100, 100][c.stage];
  const next =
    c.beaten !== undefined
      ? 'Beaten. The land is healing.'
      : c.siegeAt !== undefined
        ? 'The last siege is coming.'
        : c.stage >= 5
          ? 'The last siege.'
          : `${STAGE_NAMES[c.stage + 1]} at dread ${nextAt}${rising > 0 ? `, in about ${Math.max(1, Math.ceil((nextAt - c.dread) / rising))} days` : ''}.`;
  return {
    kind: c.kind,
    name: capital(d.name),
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
    siegeIn: c.siegeAt !== undefined ? Math.max(0, Math.ceil((c.siegeAt - s.tick) / TICKS_PER_HOUR)) : null,
    lost: c.lost,
    beaten: c.beaten !== undefined,
    cultists: s.people.filter((p: Person) => p.cultist && !p.cultist.found).length,
  };
}
