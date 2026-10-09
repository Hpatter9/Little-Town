// Gods and faith (the owner's pick): the town keeps its people's four gods (data/gods.ts) by itself. Every day each
// god's favour drifts toward nothing, sinks further where there's nowhere to worship, and rises with every shrine,
// temple and cathedral standing and every pious soul in town; each morning the town lays an offering before the god
// it has most neglected, and once a week holds a rite for them all. A god well pleased may bless the town (a lever
// lifted for a day, seen on the map as a holy light); a god angered may strike: blight on the fields, a sickness, the
// town's arms failing it with raiders sooner, or lightning setting a roof alight and killing whoever it finds outdoors.
// The rolls are the seed's own (by the hour and the god), so the town's other chances are untouched. Off with the
// autopilot, like the events (the tests' plain towns keep no gods).

import { Rng, hashSeed, mixSeed } from '../rng';
import {
  BLESS_AT, BLESS_CHANCE, DOMAINS, DOMAIN_DEFS, FAITH_HOUR, FAVOUR_DRIFT, FAVOUR_MOST, LIGHTNING_KILLS, NEGLECT, OFFER_PER,
  OFFERING_FAVOUR, PANTHEONS, PIOUS, RITE_EVERY_DAYS, RITE_FAVOUR, SIGN_HOURS, SIGN_SPENDS, WORSHIP, WRATH_AT, WRATH_CHANCE,
  type Domain,
} from '../data/gods';
import { holdRite } from './ceremonies';
import { natureOf } from '../data/natures';
import type { Material } from '../data/materials';
import { CROPS } from '../data/crops';
import { buildingCentre, buildingDoor, canUpgrade, defOf, placeBlueprint, upgrade, unlockInfo, isUnlocked } from './buildings';
import { BUILDING_BY_ID, UPGRADES } from '../data/buildings';
import { FOOD_VALUE } from '../data/people';
import { findSpot } from './planner';
import { sicken } from './doom';
import { takeFromStorage } from './expeditions';
import { setFire } from './fire';
import { killPerson } from './health';
import { castSpellFx, foodDaysFor, maxHp, notify, tireless, type GameState } from './state';
import { totalStock } from './buildings';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface FaithState {
  favour: Record<Domain, number>;
  /** The latest signs, newest last: a blessing or a wrath, and when. */
  signs: { tick: number; god: Domain; kind: 'bless' | 'wrath'; text: string }[];
  lastRite?: number;
}

const SIGNS_KEPT = 8;
/** The town raises its first shrine at this many grown-ups (sooner if a god turns ugly), and a temple at this many people. */
const SHRINE_PEOPLE = 3;
const TEMPLE_PEOPLE = 8;

export function faithOf(s: GameState): FaithState {
  return (s.faith ??= { favour: { harvest: 10, hearth: 10, war: 10, sky: 10 }, signs: [] });
}

/** The god of a domain for this town: [name, title]. */
export const godOf = (s: GameState, d: Domain): [string, string] => PANTHEONS[s.origin ?? 'settlers'][DOMAINS.indexOf(d)];

/** How a god feels, in a word. */
export function moodOf(f: number): string {
  return f >= BLESS_AT ? 'well pleased' : f >= 20 ? 'content' : f > -10 ? 'watchful' : f > WRATH_AT ? 'displeased' : 'wrathful';
}

const clamp = (v: number) => Math.max(-FAVOUR_MOST, Math.min(FAVOUR_MOST, v));
const roll = (s: GameState, ...salts: number[]) => (mixSeed(hashSeed(s.seed), 0xfa17, s.tick, ...salts) >>> 0) / 4294967296;

/** Hourly from sim.ts: the morning's offering and signs, the weekly rite. */
export function faithHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0 || s.tick === 0) return;
  if (calendar(s.tick).hour !== FAITH_HOUR) return;
  const f = faithOf(s);
  const home = s.people.filter((p) => p.away === null);
  if (!home.length) return;
  // drift, neglect and worship
  const worship = s.buildings.filter((b) => b.status === 'done').reduce((n, b) => n + (WORSHIP[b.def] ?? 0), 0);
  const pious = home.filter((p) => natureOf(p).id === 'pious').length * PIOUS;
  for (const d of DOMAINS) {
    const v = f.favour[d];
    const drift = Math.sign(v) * Math.min(Math.abs(v), FAVOUR_DRIFT);
    f.favour[d] = clamp(v - drift + worship + pious - (worship ? 0 : NEGLECT));
  }
  if (worship) offer(s, f, home.length); // (an offering wants an altar to lay it on)
  buildForGods(s, f, home.length);
  // the weekly rite (the town gathers a while: the ceremonies' gatherings stay for funerals and feasts)
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  if (worship && day - (f.lastRite ?? -RITE_EVERY_DAYS) >= RITE_EVERY_DAYS) {
    f.lastRite = day;
    for (const d of DOMAINS) f.favour[d] = clamp(f.favour[d] + RITE_FAVOUR);
    (s.marks ??= []).push({ lever: 'morale', value: 3, until: s.tick + 12 * TICKS_PER_HOUR, text: 'The rite was kept' });
    notify(s, `The town keeps the rite of the four gods: ${DOMAINS.map((d) => godOf(s, d)[0]).join(', ')}.`);
    // (the faithful walk from the fire to the greatest place of worship and kneel before it: sim/ceremonies.ts)
    const temple = s.buildings.filter((b) => b.status === 'done' && WORSHIP[b.def]).sort((a, b) => WORSHIP[b.def]! - WORSHIP[a.def]!)[0];
    if (temple) {
      const door = buildingDoor(temple);
      holdRite(s, { x: door.x, y: door.y + 34 }, day);
    }
  }
  // a sign: the most moved god first
  const order = [...DOMAINS].sort((a, b) => Math.abs(f.favour[b]) - Math.abs(f.favour[a]));
  for (const d of order) {
    const v = f.favour[d];
    if (v >= BLESS_AT && roll(s, DOMAINS.indexOf(d), 1) < BLESS_CHANCE) return bless(s, f, d);
    if (v <= WRATH_AT && roll(s, DOMAINS.indexOf(d), 2) < WRATH_CHANCE) return smite(s, f, d);
  }
}

/** The morning's offering, to the god least pleased: what it likes best that the town has to spare. */
function offer(s: GameState, f: FaithState, people: number): void {
  const d = [...DOMAINS].sort((a, b) => f.favour[a] - f.favour[b])[0];
  const n = Math.max(1, Math.ceil(people / OFFER_PER));
  const stock = totalStock(s);
  for (const m of DOMAIN_DEFS[d].offer) {
    if (m === 'coins') {
      if ((s.coins ?? 0) >= n * 4 + 40) {
        s.coins! -= n * 4;
        f.favour[d] = clamp(f.favour[d] + OFFERING_FAVOUR);
        return;
      }
      continue;
    }
    if ((stock[m as Material] ?? 0) >= n * 3) {
      takeFromStorage(s, m as Material, n);
      f.favour[d] = clamp(f.favour[d] + OFFERING_FAVOUR);
      return;
    }
  }
}

function sign(s: GameState, f: FaithState, d: Domain, kind: 'bless' | 'wrath', text: string): void {
  f.signs.push({ tick: s.tick, god: d, kind, text });
  if (f.signs.length > SIGNS_KEPT) f.signs.splice(0, f.signs.length - SIGNS_KEPT);
  f.favour[d] = clamp(f.favour[d] + (kind === 'bless' ? -SIGN_SPENDS : SIGN_SPENDS));
  notify(s, text, true);
}

/** A god well pleased: its gift for a day, and a holy light over the town's seat (or fire). */
function bless(s: GameState, f: FaithState, d: Domain): void {
  const def = DOMAIN_DEFS[d];
  const [name, title] = godOf(s, d);
  (s.marks ??= []).push({ lever: def.bless.lever, value: def.bless.value, until: s.tick + SIGN_HOURS * TICKS_PER_HOUR, text: `${name}'s blessing` });
  const at = holyPlace(s);
  castSpellFx(s, 'god:bless', at, s.people.filter((p) => p.away === null).slice(0, 10).map((p) => ({ x: p.x, y: p.y, id: p.id })), 4);
  sign(s, f, d, 'bless', `✨ ${name}, ${title}, ${def.bless.text}.`);
}

/** A god angered strikes. */
function smite(s: GameState, f: FaithState, d: Domain): void {
  const def = DOMAIN_DEFS[d];
  const [name] = godOf(s, d);
  const rng = Rng.from(hashSeed(s.seed), 0xa7a7, s.tick);
  const head = `⚡ ${name} ${def.wrathText}`;
  const day = s.tick + SIGN_HOURS * TICKS_PER_HOUR;
  switch (def.wrath) {
    case 'blight': {
      const fields = s.buildings.filter((b) => b.status === 'done' && CROPS[b.def] && b.crop && b.crop.stage === 'growing');
      for (const b of fields.slice(0, 2)) {
        b.crop!.growth = Math.max(0, b.crop!.growth - 0.6);
        castSpellFx(s, 'god:blight', buildingCentre(b), [], 3);
      }
      (s.marks ??= []).push({ lever: 'crops', value: 0.7, until: day, text: `${name}'s anger` });
      return sign(s, f, d, 'wrath', `${head}: ${fields.length ? 'the crops wither in the rows' : 'the very soil turns sour'}.`);
    }
    case 'plague': {
      const sick = s.people.filter((p) => p.away === null && !tireless(p)).slice(0, 2);
      for (const p of sick) sicken(s, p, rng);
      return sign(s, f, d, 'wrath', `${head}: ${sick.map((p) => p.name).join(' and ') || 'nobody'} fall${sick.length === 1 ? 's' : ''} ill.`);
    }
    case 'defeat': {
      (s.marks ??= []).push({ lever: 'fight', value: 0.75, until: day, text: `${name} has turned away` });
      s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + 6 * TICKS_PER_HOUR);
      return sign(s, f, d, 'wrath', `${head}: blades feel heavy, and raiders smell weakness.`);
    }
    case 'lightning': {
      const roofs = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !b.room && !defOf(b).seat);
      const hit = roofs.length ? roofs[Math.floor(rng.next() * roofs.length)] : undefined;
      if (hit) {
        castSpellFx(s, 'god:lightning', buildingCentre(hit), [{ ...buildingCentre(hit) }], 2);
        setFire(s, hit, true);
      }
      const out = s.people.filter((p) => p.away === null && !p.downed && p.task?.type !== 'sleep');
      const struck = out.length && rng.next() < 0.5 ? out[Math.floor(rng.next() * out.length)] : undefined;
      let what = hit ? `the ${defOf(hit).name.toLowerCase()} is struck and burns` : 'the sky splits over the town';
      if (struck) {
        castSpellFx(s, 'god:lightning', { x: struck.x, y: struck.y, id: struck.id }, [{ x: struck.x, y: struck.y, id: struck.id }], 2);
        if (rng.next() < LIGHTNING_KILLS) {
          sign(s, f, d, 'wrath', `${head}: ${what}, and ${struck.name} is struck dead.`);
          return killPerson(s, struck, 'struck by lightning');
        }
        struck.hp = Math.max(1, struck.hp - maxHp(struck) * 0.4);
        what += `, and ${struck.name} is thrown down, burned`;
      }
      return sign(s, f, d, 'wrath', `${head}: ${what}.`);
    }
  }
}

/** The town raises a shrine once it's settled (three grown-ups, food in store) or a god turns ugly, and rebuilds it
 *  grander (a temple, then a cathedral) as it learns how and has the makings twice over. */
function buildForGods(s: GameState, f: FaithState, people: number): void {
  const mine = s.buildings.filter((b) => WORSHIP[b.def]);
  if (mine.some((b) => b.status !== 'done')) return;
  const grown = s.people.filter((p) => p.bornTick == null).length;
  if (!mine.length) {
    const uneasy = DOMAINS.some((d) => f.favour[d] <= -20);
    if ((grown < SHRINE_PEOPLE && !uneasy) || foodDays(s) < 2) return;
    const def = BUILDING_BY_ID.wayside_shrine;
    const at = findSpot(s, def);
    if (at) placeBlueprint(s, def.id, at.x, at.y, false, false, !!at.wild);
    return;
  }
  const b = mine.sort((a, c) => WORSHIP[c.def] - WORSHIP[a.def])[0];
  const next = UPGRADES[b.def] ? BUILDING_BY_ID[UPGRADES[b.def]] : undefined;
  if (!next || !isUnlocked(unlockInfo(s), next) || people < TEMPLE_PEOPLE) return;
  const stock = totalStock(s);
  if (!Object.entries(next.cost).every(([m, n]) => (stock[m as Material] ?? 0) >= (n ?? 0) * 2)) return;
  if (canUpgrade(s, b.id).ok) upgrade(s, b.id);
}

function foodDays(s: GameState): number {
  const stock = totalStock(s);
  return foodDaysFor(s, Object.entries(FOOD_VALUE).reduce((n, [m, v]) => n + (stock[m as Material] ?? 0) * (v ?? 0), 0));
}

function holyPlace(s: GameState) {
  const b = s.buildings.find((q) => q.status === 'done' && WORSHIP[q.def]) ?? s.buildings.find((q) => defOf(q).seat) ?? s.buildings[0];
  return b ? buildingCentre(b) : { x: 0, y: 0 };
}

/** What the Town menu's Faith tab shows. */
export interface FaithView {
  gods: { domain: Domain; name: string; title: string; keeps: string; favour: number; mood: string; blessing: string; wrath: string; offer: string }[];
  signs: { day: number; text: string; kind: 'bless' | 'wrath' }[];
  /** The places of worship standing, and what they add a day. */
  worship: number;
  places: string[];
  nextRite: number | null;
  on: boolean;
}

export function faithView(s: GameState): FaithView {
  const f = faithOf(s);
  const done = s.buildings.filter((b) => b.status === 'done' && WORSHIP[b.def]);
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  return {
    gods: DOMAINS.map((d) => {
      const [name, title] = godOf(s, d);
      const def = DOMAIN_DEFS[d];
      return { domain: d, name, title, keeps: def.keeps, favour: Math.round(f.favour[d]), mood: moodOf(f.favour[d]), blessing: def.bless.text, wrath: def.wrathText, offer: def.offer.join(', ') };
    }),
    signs: [...f.signs].reverse().map((g) => ({ day: calendar(g.tick).day, text: g.text, kind: g.kind })),
    worship: done.reduce((n, b) => n + WORSHIP[b.def], 0),
    places: done.map((b) => defOf(b).name),
    nextRite: done.length ? Math.max(0, (f.lastRite ?? -RITE_EVERY_DAYS) + RITE_EVERY_DAYS - day) : null,
    on: s.autopilot !== false,
  };
}
