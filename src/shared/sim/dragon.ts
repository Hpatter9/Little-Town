// The Dragon (the owner's ask: something massive). Once a town is settled and grown (`DRAGON_FIRST_DAY`,
// `DRAGON_PEOPLE` grown-ups), now and then a dragon comes to the hills: one of three by the land (the Rimewyrm in the
// cold, the Ashen Wyrm in the desert, else Vermithrax the Red). First it is seen (`omen`): a shadow crossing the land
// high up, every few hours (`OMEN_FLIGHTS` of them). Then it lands and demands tribute (a prompt of kind `dragon` in
// the event box): pay the coins (`tributeOf`), give up half the herds, or refuse. Paid, it goes and comes back
// `RETURN_DAYS` later wanting more (`RAISE`). Refused, its wrath comes on the town every `WRATH_HOURS`: a pass low
// over the roofs (`pass`), setting one or two alight, carrying off a beast from a pen, and burning whoever is out of
// doors under it (`BURN_CHANCE`, `BURN_KILLS`); every defence engine and everyone with a bow strikes back
// (`volley`), and wounded past `FLEE_AT` it flies off for good. After `PASSES_THEN_ASK` passes it asks again. All the
// while its lair is on the Expedition Board (`dragon:lair`): a party that slays it there brings home its hoard
// (`HOARD`), the town is renowned and the dragon is gone for good (`slain`). Every roll is the seed's own.

import type { Destination } from '../data/expeditions';
import { ENEMIES } from '../data/enemies';
import type { Material } from '../data/materials';
import { hashSeed, Rng } from '../rng';
import { buildingCentre, defOf, depositNear } from './buildings';
import { campXY, castSpellFx, maxHp, notify, setOutcome, type Expedition, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendar } from './time';
import { setFire } from './fire';
import { killPerson } from './health';
import { woundPerson } from './injuries';
import { payParty } from './economy';
import { isChild } from './social';
import { addRenown } from './shop';
import { describeFoes } from './places';
import { CELL } from './land';
import { eventPicture } from '../data/eventScenes';
import { weatherAt } from './weather';

export const DRAGON_DEST = 'dragon:lair';
export const DRAGON_FIRST_DAY = 9;
export const DRAGON_PEOPLE = 6;
/** The chance each hour, once it may come, that it does (about one in two days). */
export const DRAGON_HOURLY = 0.02;
export const OMEN_FLIGHTS = 3;
export const OMEN_HOURS = 6;
export const DEMAND_HOURS = 8;
export const RETURN_DAYS = 5;
export const RAISE = 1.5;
export const WRATH_HOURS = 7;
export const PASSES_THEN_ASK = 3;
/** How long a pass takes across the map (ticks), and how low (cells either side of its line) its fire reaches. */
export const PASS_TICKS = 140;
export const BURN_REACH = 2.5;
export const BURN_CHANCE = 0.45;
export const BURN_KILLS = 0.25;
/** Wounded to this share of its health, it flies off and never comes back. */
export const FLEE_AT = 0.35;
/** What it takes from each volley: a defence engine's blow times this, an archer's level plus this. */
export const ENGINE_MULT = 3;
export const ARCHER_BASE = 6;
/** Its hoard, brought home by the party that slays it in its lair. */
export const HOARD: Partial<Record<Material, number>> = { gold: 24, gems: 10, dragon_heart: 1, wyrm_scale: 4 };
export const HOARD_COINS = 600;

export type DragonPhase = 'omen' | 'demand' | 'paid' | 'wrath' | 'driven' | 'slain';
export interface Flight {
  start: number;
  ticks: number;
  from: { x: number; y: number };
  to: { x: number; y: number };
  /** Low over the town breathing fire (a pass), or high and far (an omen, or flying off). */
  low: boolean;
}
export interface DragonState {
  /** The dragon's enemy id (data/enemies.ts and dungeonBosses.ts). */
  kind: string;
  phase: DragonPhase;
  hp: number;
  maxHp: number;
  /** When the next thing happens: a flight, the demand, the next pass. */
  next: number;
  flights: number;
  passes: number;
  tribute: number;
  paid: number;
  flight?: Flight;
  /** Where its lair is, on the world (for the card). */
  lair: string;
}

/** Which dragon a land draws. */
export function dragonFor(biome: string): string {
  return biome === 'tundra' ? 'rimewyrm' : biome === 'desert' ? 'ashen_wyrm' : 'dragon';
}
const LAIRS: Record<string, string> = { rimewyrm: 'the glacier caves to the north', ashen_wyrm: 'the burnt crags past the dunes', dragon: 'the red crags over the hills' };
export const dragonName = (kind: string) => ENEMIES[kind]?.name ?? 'The Dragon';

const grown = (s: GameState) => s.people.filter((p) => !isChild(p) && p.away === null).length;
const rngOf = (s: GameState, salt: number) => Rng.from(hashSeed(s.seed), s.tick, 0xd4a6 + salt);

/** What it asks: a share of the treasury, more for a bigger town, and more each time it's paid. */
export function tributeOf(s: GameState, d: DragonState): number {
  const base = Math.max(80, Math.round((s.coins ?? 0) * 0.35 + grown(s) * 12));
  return Math.round(base * RAISE ** d.paid);
}

/** Each hour (and each tick for its flight's end): the dragon comes, flies, asks, burns, or leaves. */
export function dragonTick(s: GameState): void {
  const d = s.dragon;
  if (d?.flight && s.tick >= d.flight.start + d.flight.ticks) d.flight = undefined;
  if (d?.flight?.low && s.tick === d.flight.start + Math.floor(d.flight.ticks / 2)) pass(s, d);
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.dragons === false) return;
  if (!d) return maybeCome(s);
  if (d.phase === 'slain' || d.phase === 'driven') return;
  if (s.tick < d.next) return;
  switch (d.phase) {
    case 'omen':
      if (d.flights < OMEN_FLIGHTS) {
        fly(s, d, false);
        d.flights++;
        notify(s, d.flights === 1 ? `A shadow passes over the land, vast and high: ${dragonName(d.kind)} has come to ${LAIRS[d.kind]}.` : `${dragonName(d.kind)} circles high over the town again, looking down.`, true);
        d.next = s.tick + OMEN_HOURS * TICKS_PER_HOUR;
      } else demand(s, d);
      return;
    case 'paid':
      demand(s, d);
      return;
    case 'wrath':
      fly(s, d, true);
      d.passes++;
      d.next = s.tick + WRATH_HOURS * TICKS_PER_HOUR;
      return;
    case 'demand':
      return;
  }
}

function maybeCome(s: GameState): void {
  if (calendar(s.tick).day < DRAGON_FIRST_DAY || grown(s) < DRAGON_PEOPLE) return;
  if (!rngOf(s, 1).chance(DRAGON_HOURLY)) return;
  summonDragon(s);
}

/** The dragon comes (tests and previews call it directly). */
export function summonDragon(s: GameState, kind = dragonFor(s.biome ?? 'forest')): DragonState {
  const hp = (ENEMIES[kind]?.hp ?? 900) * 1.5;
  const d: DragonState = { kind, phase: 'omen', hp, maxHp: hp, next: s.tick, flights: 0, passes: 0, tribute: 0, paid: 0, lair: LAIRS[kind] ?? 'the far crags' };
  s.dragon = d;
  return d;
}

/** A flight across the land: high and far for an omen, low over the town for a pass. */
function fly(s: GameState, d: DragonState, low: boolean): void {
  const rng = rngOf(s, 2 + d.flights + d.passes);
  const camp = campXY(s);
  const span = (low ? 22 : 30) * CELL;
  const ang = rng.next() * Math.PI * 2;
  const off = low ? 0 : (rng.next() - 0.5) * 16 * CELL;
  const cx = camp.x + Math.cos(ang + Math.PI / 2) * off;
  const cy = camp.y + Math.sin(ang + Math.PI / 2) * off;
  d.flight = { start: s.tick, ticks: low ? PASS_TICKS : PASS_TICKS * 1.4, from: { x: cx - Math.cos(ang) * span, y: cy - Math.sin(ang) * span }, to: { x: cx + Math.cos(ang) * span, y: cy + Math.sin(ang) * span }, low };
}

/** It lands on the hill and asks. */
function demand(s: GameState, d: DragonState): void {
  if (s.prompts.some((p) => p.kind === 'dragon')) return;
  d.phase = 'demand';
  d.tribute = tributeOf(s, d);
  const herds = s.buildings.filter((b) => (b.herd?.head ?? 0) > 0).reduce((n, b) => n + (b.herd?.head ?? 0), 0);
  const name = dragonName(d.kind);
  const coins = s.coins ?? 0;
  const options = [`Pay the tribute (${d.tribute} coins)`, ...(herds >= 3 ? [`Give it half the herds (${Math.ceil(herds / 2)} beasts)`] : []), 'Refuse: let it come'];
  const cal = calendar(s.tick);
  const text = d.paid
    ? `${name} is back on the hill above the town, smoke curling from its jaws. It wants more this time: ${d.tribute} coins. The treasury holds ${coins}.`
    : `${name} lands on the hill above the town, folds its wings and speaks, in a voice like a landslide: tribute, or fire. It wants ${d.tribute} coins. The treasury holds ${coins}.`;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'dragon',
    expedition: null,
    title: `${name} demands tribute`,
    text,
    story: `${text} Its lair is in ${d.lair}; a party bold enough might go there and end it. Refused, it will come down on the roofs.`,
    picture: eventPicture(`dragon:${d.kind}`, 'dragon fire mountain lair', { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: false }),
    options,
    // (left unanswered: paid if the treasury can, else the herds, else it is refused)
    defaultOption: coins >= d.tribute ? 0 : herds >= 3 ? 1 : options.length - 1,
    expiresTick: s.tick + DEMAND_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  notify(s, `${name} lands on the hill and demands ${d.tribute} coins in tribute!`, true);
}

/** The answer to its demand. */
export function answerDragon(s: GameState, prompt: Prompt, option: number): void {
  const d = s.dragon;
  if (!d || d.phase !== 'demand') return;
  const name = dragonName(d.kind);
  const choice = prompt.options[option] ?? '';
  if (choice.startsWith('Pay') && (s.coins ?? 0) >= d.tribute) {
    s.coins = (s.coins ?? 0) - d.tribute;
    d.paid++;
    d.phase = 'paid';
    d.next = s.tick + RETURN_DAYS * TICKS_PER_DAY;
    fly(s, d, false);
    return say(s, `The town pays ${d.tribute} coins. ${name} gathers the gold in its claws and flies off to its lair. It will be back.`);
  }
  if (choice.startsWith('Give')) {
    let left = Math.ceil(s.buildings.reduce((n, b) => n + (b.herd?.head ?? 0), 0) / 2);
    for (const b of s.buildings)
      while (left > 0 && b.herd && b.herd.head > 0) {
        b.herd.head--;
        left--;
      }
    d.paid++;
    d.phase = 'paid';
    d.next = s.tick + RETURN_DAYS * TICKS_PER_DAY;
    fly(s, d, false);
    return say(s, `The herds are driven up the hill. ${name} eats its fill and flies off heavy. It will be back.`);
  }
  d.phase = 'wrath';
  d.passes = 0;
  d.next = s.tick + 2 * TICKS_PER_HOUR;
  (s.marks ??= []).push({ lever: 'morale', value: -4, until: s.tick + TICKS_PER_DAY, text: `${name} is angry` });
  say(s, `${prompt.options[option] === choice && choice.startsWith('Pay') ? 'There was not gold enough. ' : ''}The town will not pay. ${name} roars and lifts into the sky. Bar the doors.`);
}

function say(s: GameState, text: string): void {
  setOutcome(s, 'The dragon', null, text);
  notify(s, text, true);
}

/** A pass low over the roofs: fire, a beast carried off, the folk out of doors burned; the town strikes back. */
function pass(s: GameState, d: DragonState): void {
  const f = d.flight!;
  const rng = rngOf(s, 40 + d.passes);
  const name = dragonName(d.kind);
  const near = (x: number, y: number) => distToLine(x, y, f.from, f.to) < BURN_REACH * CELL;
  const what: string[] = [];
  // fire on the roofs under it
  const roofs = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !b.room && !defOf(b).seat && !b.fire && near(buildingCentre(b).x, buildingCentre(b).y));
  for (let i = 0; i < Math.min(roofs.length, 1 + (rng.chance(0.5) ? 1 : 0)); i++) {
    const b = roofs.splice(Math.floor(rng.next() * roofs.length), 1)[0];
    castSpellFx(s, 'dragon:fire', { x: buildingCentre(b).x, y: buildingCentre(b).y }, [buildingCentre(b)], 2);
    if (setFire(s, b, true)) what.push(`the ${defOf(b).name.toLowerCase()} burns`);
  }
  // a beast from a pen
  const pen = s.buildings.find((b) => (b.herd?.head ?? 0) > 0 && near(buildingCentre(b).x, buildingCentre(b).y)) ?? (rng.chance(0.5) ? s.buildings.find((b) => (b.herd?.head ?? 0) > 0) : undefined);
  if (pen?.herd) {
    pen.herd.head--;
    what.push('a beast is snatched from its pen');
  }
  // whoever is out of doors under it
  const out = s.people.filter((p) => p.away === null && !p.downed && p.task?.type !== 'sleep' && near(p.x, p.y));
  for (const p of out) {
    if (!rng.chance(BURN_CHANCE)) continue;
    if (rng.chance(BURN_KILLS)) {
      what.push(`${p.name} is burned to ash`);
      killPerson(s, p, `burned by ${name}`);
      continue;
    }
    const dmg = maxHp(p) * (0.25 + rng.next() * 0.25);
    p.hp = Math.max(1, p.hp - dmg);
    woundPerson(s, p, dmg, 'burn', rng);
    what.push(`${p.name} is burned`);
  }
  // the town strikes back
  const hurt = volley(s);
  d.hp = Math.max(0, d.hp - hurt.dmg);
  const struck = hurt.dmg > 0 ? ` The town strikes back (${hurt.by}): ${Math.round(hurt.dmg)} harm, ${Math.round((d.hp / d.maxHp) * 100)}% of it left.` : ' Nothing in the town can reach it.';
  notify(s, `${name} sweeps low over the town breathing fire: ${what.length ? what.join(', ') : 'it misses everything'}.${struck}`, true);
  if (d.hp <= d.maxHp * FLEE_AT) {
    d.phase = 'driven';
    (s.marks ??= []).push({ lever: 'morale', value: 8, until: s.tick + 2 * TICKS_PER_DAY, text: `We drove off ${name}` });
    notify(s, `Torn and bleeding, ${name} flies off to ${d.lair} and does not come back. The town has driven off a dragon!`, true);
    return;
  }
  if (d.passes >= PASSES_THEN_ASK && d.passes % PASSES_THEN_ASK === 0) {
    d.paid = Math.max(d.paid, 1);
    d.phase = 'paid';
    d.next = s.tick + 4 * TICKS_PER_HOUR;
  }
}

/** Every defence engine standing, and everyone home with a bow (or a calling that shoots), against it. */
export function volley(s: GameState): { dmg: number; by: string } {
  let dmg = 0;
  let engines = 0;
  for (const b of s.buildings) {
    const def = b.status === 'done' ? defOf(b).defense : undefined;
    if (!def) continue;
    engines++;
    dmg += ((def.damage[0] + def.damage[1]) / 2) * ENGINE_MULT;
  }
  let archers = 0;
  for (const p of s.people) {
    if (p.away !== null || p.downed || isChild(p)) continue;
    if (!shoots(p)) continue;
    archers++;
    dmg += ARCHER_BASE + (p.level ?? 1);
  }
  const by = [engines ? `${engines} engine${engines > 1 ? 's' : ''}` : '', archers ? `${archers} bow${archers > 1 ? 's' : ''}` : ''].filter(Boolean).join(' and ');
  return { dmg, by };
}
const shoots = (p: Person) => {
  const w = p.gear?.weapon;
  return !!w && /bow|sling|gun|rifle|musket|pistol|crossbow|javelin/.test(w);
};

function distToLine(x: number, y: number, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const t = Math.max(0, Math.min(1, ((x - a.x) * dx + (y - a.y) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - (a.x + t * dx), y - (a.y + t * dy));
}

/* ------------------------------------------------------------ the lair */

export const isDragonDest = (id: string) => id === DRAGON_DEST;
const lairOpen = (s: GameState) => !!s.dragon && s.dragon.phase !== 'omen' && s.dragon.phase !== 'slain';

export function dragonDestination(s: GameState): Destination | undefined {
  const d = s.dragon;
  if (!d || !lairOpen(s)) return undefined;
  const foes = { [d.kind]: 1, drake: 2 };
  return {
    id: DRAGON_DEST,
    name: `${dragonName(d.kind)}'s Lair`,
    type: 'clear',
    outSeconds: 140,
    workSeconds: 30,
    secondsPerUnit: 8,
    loot: {},
    threats: describeFoes(foes),
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: foes, weight: 1 }] },
    recommendedParty: 6,
    scenery: 'cave',
    description: `${dragonName(d.kind)} lairs in ${d.lair}, on a hoard of gold and gems. Slay it there and the hoard is the town's, and the dragon troubles nobody again.${d.phase === 'driven' ? ' It was driven off torn and bleeding.' : ''}`,
  };
}
export const dragonDestinations = (s: GameState): Destination[] => {
  const d = dragonDestination(s);
  return d ? [d] : [];
};

/** A party home from the lair: won, the dragon is slain and its hoard comes home. */
export function dragonHome(s: GameState, e: Expedition, members: Person[]): void {
  if (!isDragonDest(e.dest) || !s.dragon) return;
  const d = s.dragon;
  const name = dragonName(d.kind);
  if (!e.cleared) {
    if (!e.recalled) notify(s, `The party came back from ${name}'s lair beaten. The dragon lives.`, true);
    return;
  }
  d.phase = 'slain';
  d.flight = undefined;
  s.prompts = s.prompts.filter((p) => p.kind !== 'dragon');
  depositNear(s, campXY(s), { ...HOARD });
  const standing = members.filter((p) => !p.downed);
  payParty(s, standing.length ? standing : members, HOARD_COINS, `A share of ${name}'s hoard`);
  for (const p of standing) (p.titles ??= []).includes('Dragonslayer') || p.titles.push('Dragonslayer');
  for (const b of s.buildings) if (b.shop) addRenown(b, 10);
  (s.marks ??= []).push({ lever: 'morale', value: 12, until: s.tick + 3 * TICKS_PER_DAY, text: `${name} is slain!` });
  notify(s, `${name} is slain in its lair! ${standing.map((p) => p.name).join(', ')} come home Dragonslayers, with its hoard: ${HOARD_COINS} coins, gold, gems and its heart.`, true);
}

/* ------------------------------------------------------------ seen */

export interface DragonView {
  kind: string;
  name: string;
  phase: DragonPhase;
  hp: number;
  tribute: number;
  lair: string;
  /** In the air now: where along its flight (0 to 1), its line, and whether low over the town. */
  flight: { t: number; from: { x: number; y: number }; to: { x: number; y: number }; low: boolean } | null;
}
export function dragonView(s: GameState): DragonView | null {
  const d = s.dragon;
  if (!d) return null;
  const f = d.flight;
  return {
    kind: d.kind,
    name: dragonName(d.kind),
    phase: d.phase,
    hp: d.hp / d.maxHp,
    tribute: d.tribute,
    lair: d.lair,
    flight: f ? { t: (s.tick - f.start) / f.ticks, from: f.from, to: f.to, low: f.low } : null,
  };
}
