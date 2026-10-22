// Legends across towns, in a descendant's town (the owner's ask). A town founded by a legend's descendant
// (sim/legacy.ts `inherit`) carries its forebears as data from the founding (`s.ancestry`), so the sim stays
// deterministic: nothing here reads the device's legends again.
//  - The ancestors return as spirits: of a night one may visit (a blessing: wounds mended, a skill taught, spirits
//    lifted; the first asks how the town honours them), and in a raid one may stand with the town (an ally).
//  - The heirloom grows a +1 with each generation that carries it, and may be cursed (decided by the legend, so the same
//    heirloom is always the same): its bearer suffers now and then until the curse is lifted.
//  - The old town comes back. One that fell lies in ruins on the new town's land, its restless dead led by the shade of
//    its greatest; one that stood is the Old House, a power of the realm warm to its kin (sim/factions.ts), whose heroes
//    ride to the town's raids and who sends gifts and teachers, and its founder's barrow lies on the land. Laying the old
//    place's dead to rest (a party clears it) lifts the curse, strengthens the heirloom and brings the spirits closer.
// Everything runs with the autopilot on, on its own side stream.

import { ITEM_BY_ID } from '../data/items';
import { COMMON, gradeOf, MAX_PLUS, piece, plusOf } from '../data/quality';
import { FOOD_VALUE } from '../data/people';
import { MAX_SKILL, SKILLS, type Skill } from '../data/skills';
import { directionName, PLACE_APART } from '../data/places';
import type { Destination } from '../data/expeditions';
import type { Material } from '../data/materials';
import type { OriginId } from '../data/origins';
import {
  ALLY_CHANCE,
  ALLY_CHANCE_LAID,
  ASK_HOURS,
  BLESS_MEND,
  BLESS_MORALE,
  CURSE_CHANCE,
  CURSE_CHANCE_DAILY,
  CURSE_HOUR,
  CURSE_HURT,
  CURSE_MORALE,
  HONOUR_FOOD,
  HOUSE_ALLY_CHANCE,
  HOUSE_CHANCE,
  HOUSE_GAP_DAYS,
  HOUSE_GIFT_COINS,
  HOUSE_HOUR,
  LAID_MORALE,
  OLD_PLACE_COINS,
  OLD_PLACE_FAR,
  OLD_PLACE_NEAR,
  OLD_PLACE_RENOWN,
  VISIT_CHANCE,
  VISIT_CHANCE_LAID,
  VISIT_FROM_DAY,
  VISIT_GAP_DAYS,
  VISIT_HOUR,
} from '../data/legends';
import { hashSeed, Rng } from '../rng';
import { storages } from './buildings';
import { minorWound } from './injuries';
import { groundAt, inMap } from './land';
import type { Legend } from './legacy';
import { seedPlaces, type MapPlace } from './places';
import { isChild } from './social';
import { addStock, campCell, earn, maxHp, notify, setOutcome, type GameState, type Person, type Prompt, type Raid, type Raider } from './state';
import { askWays, tellStory } from './telling';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from './time';

export interface Spirit {
  name: string;
  calling: string | null;
  level: number;
  fell: boolean;
  cause?: string;
  kin: 'founder' | 'hero' | 'forebear';
}

export interface Ancestry {
  /** The legend this town was founded from, and its line. */
  from: string;
  line: string;
  founder: string;
  origin: OriginId;
  fate: Legend['fate'];
  /** The legend's generation (this town is the next). */
  generation: number;
  days: number;
  people: number;
  dead: number;
  renown: number;
  /** The founders of the line before this town, oldest first (the legend's own founder last). */
  forebears: string[];
  /** Who may come back as a spirit: the old founder, its heroes, and the line's older founders. */
  spirits: Spirit[];
  /** The heirloom: how many generations have carried it (its +N), and whether it is cursed. */
  heirloom?: { item: string; carried: number; cursed: boolean; lifted?: boolean };
  /** What became of the old town: ruins on this land (it fell), or the Old House, a power of the realm (it stood). */
  oldTown: 'ruins' | 'power';
  /** The old place on this land (a MapPlace id): the ruins, or the old founder's barrow. */
  place?: number;
  /** Its dead laid to rest (a party cleared it). */
  laid?: boolean;
  visits: number;
  lastVisit?: number;
  /** The first visit's question: how the town honours its forebears (null until asked). */
  honoured?: 'feast' | 'counsel' | 'rest' | null;
  lastHouse?: number;
  log: string[];
}

const LOG_MOST = 12;
function log(a: Ancestry, text: string): void {
  a.log.push(text);
  if (a.log.length > LOG_MOST) a.log.splice(0, a.log.length - LOG_MOST);
}

export const ancestryOf = (s: GameState): Ancestry | null => s.ancestry ?? null;

/** Founding from a legend: the forebears, the heirloom's strength and curse, and the old town come back. Pure data in,
 *  rolls from the legend and the seed only. (From sim/legacy.ts `inherit`, after the heirloom is in the stores.) */
export function foundAncestry(s: GameState, l: Legend): Ancestry {
  const spirits: Spirit[] = [];
  const founderHero = l.heroes.find((h) => h.name === l.founder);
  spirits.push({ name: l.founder, calling: founderHero?.calling ?? l.founderCalling ?? null, level: founderHero?.level ?? l.founderLevel ?? 1, fell: founderHero?.fell ?? l.fate === 'fell', cause: founderHero?.cause, kin: 'founder' });
  for (const h of l.heroes) if (h.name !== l.founder) spirits.push({ name: h.name, calling: h.calling, level: h.level, fell: h.fell, cause: h.cause, kin: 'hero' });
  for (const f of l.forebears ?? []) if (!spirits.some((x) => x.name === f)) spirits.push({ name: f, calling: null, level: 0, fell: true, kin: 'forebear' });
  const a: Ancestry = {
    from: l.id,
    line: l.of ?? `${l.founder}'s line`,
    founder: l.founder,
    origin: l.origin,
    fate: l.fate,
    generation: l.generation,
    days: l.days,
    people: l.people,
    dead: l.dead,
    renown: l.renown,
    forebears: [...(l.forebears ?? []), l.founder].slice(-8),
    spirits,
    oldTown: l.fate === 'fell' ? 'ruins' : 'power',
    visits: 0,
    honoured: null,
    log: [],
  };
  if (l.heirloom && ITEM_BY_ID[l.heirloom]) {
    const carried = (l.heirloomCarried ?? 0) + 1;
    // (a fresh heirloom may be cursed, by the legend; one carried before keeps what it was)
    const cursed = l.heirloomCarried ? !!l.cursed : new Rng(hashSeed(`${l.id}:heirloom`)).chance(CURSE_CHANCE);
    a.heirloom = { item: l.heirloom, carried, cursed };
    setHeirloomQ(s, l.heirloom, piece(l.heirloomGrade ?? COMMON, Math.min(MAX_PLUS, carried)));
  }
  s.ancestry = a;
  const p = layOldPlace(s, a);
  if (p) a.place = p.id;
  log(a, `Founded by the ${ordinal(a.generation + 1)} generation of ${a.line}.`);
  return a;
}

/** The heirloom's piece in the stores takes this quality (grade and +N). */
function setHeirloomQ(s: GameState, item: string, q: number): void {
  const all = (s.itemQ ??= {});
  const list = (all[item] ?? []).slice();
  const have = s.items[item] ?? 0;
  while (list.length < have) list.push(COMMON);
  if (!list.length) return;
  list.sort((a, b) => b - a);
  list[0] = Math.max(list[0], q);
  all[item] = list.sort((a, b) => b - a);
}

/** The heirloom grows a +1 wherever it is (in someone's hand, or the stores). */
function strengthenHeirloom(s: GameState, item: string): void {
  for (const p of s.people)
    for (const [slot, id] of Object.entries(p.gear))
      if (id === item) {
        const q = (p.gearQ ??= {}) as Record<string, number>;
        q[slot] = piece(gradeOf(q[slot]), Math.min(MAX_PLUS, plusOf(q[slot]) + 1));
        return;
      }
  const list = s.itemQ?.[item];
  if (list?.length) list[0] = piece(gradeOf(list[0]), Math.min(MAX_PLUS, plusOf(list[0]) + 1));
}

/** The old place on this land: the ruins of a town that fell, or the barrow of one that stood. Laid where the seed says,
 *  on dry ground some way out, apart from the land's other places. */
function layOldPlace(s: GameState, a: Ancestry): MapPlace | null {
  const list = (s.places ??= seedPlaces(s.land, s.seed));
  const rng = new Rng(hashSeed(`${s.seed}:oldplace:${a.from}`));
  const camp = campCell(s);
  for (let tries = 0; tries < 300; tries++) {
    const ang = rng.range(0, Math.PI * 2);
    const r = rng.range(OLD_PLACE_NEAR, OLD_PLACE_FAR);
    const x = Math.round(camp.x + Math.cos(ang) * r);
    const y = Math.round(camp.y + Math.sin(ang) * r);
    if (!inMap(s.land, x, y)) continue;
    const g = groundAt(s.land, x, y);
    if (g === 'water' || g === 'shallows' || g === 'mountain' || g === 'hall') continue;
    if (list.some((p) => Math.hypot(p.x - x, p.y - y) < PLACE_APART)) continue;
    const foes: Record<string, number> =
      a.oldTown === 'ruins' ? { restless_shade: Math.max(2, Math.min(5, 2 + Math.floor(a.dead / 4))), old_champion: 1 } : { barrow_guard: 2, old_champion: 1 };
    const p: MapPlace = { id: list.reduce((n, q) => Math.max(n, q.id), 0) + 1, kind: 'ruin', x, y, found: null, state: 'waiting', foes, old: true };
    list.push(p);
    return p;
  }
  return null;
}

/** The old place's name: "The Ruins of Hild's Town", "Hild's Barrow". */
export function oldPlaceName(s: GameState): string {
  const a = s.ancestry;
  if (!a) return 'The Old Place';
  return a.oldTown === 'ruins' ? `The Ruins of ${a.founder}'s Town` : `${a.founder}'s Barrow`;
}

/** The greatest the old town remembers (whose shade leads its dead). */
const greatest = (a: Ancestry): Spirit => a.spirits.filter((x) => x.kin !== 'forebear').sort((x, y) => y.level - x.level)[0] ?? a.spirits[0];

/** The old place as a destination on the board (from places.ts placeDestination). */
export function oldPlaceDestination(s: GameState, p: MapPlace, base: Destination): Destination {
  const a = s.ancestry;
  if (!a) return base;
  const camp = campCell(s);
  const where = directionName(p.x - camp.x, p.y - camp.y);
  const champ = greatest(a);
  return {
    ...base,
    name: `${oldPlaceName(s)} to the ${where}`,
    threats: a.oldTown === 'ruins' ? `The restless dead of ${a.founder}'s town, led by the shade of ${champ.name}` : `The barrow's guard, and the shade of ${champ.name} who keeps it`,
    recommendedParty: 4,
    scenery: a.oldTown === 'ruins' ? 'quarry' : 'cave',
    description:
      a.oldTown === 'ruins'
        ? `Where ${a.founder}'s town stood ${a.days} days before it fell. Its dead do not rest. Lay them to rest, and the line's spirits will be glad of it${a.heirloom?.cursed ? ', and the curse on the heirloom may lift' : ''}.`
        : `Where ${a.founder} was laid, guarded by the honoured dead, who test whoever comes. Win through, and the line's spirits will be glad of it${a.heirloom?.cursed ? ', and the curse on the heirloom may lift' : ''}.`,
  };
}

/** The old place found as the known land reaches it (from places.ts placesHourly). */
export function oldPlaceFound(s: GameState, p: MapPlace): void {
  const a = s.ancestry;
  if (!a) return;
  const camp = campCell(s);
  const where = directionName(p.x - camp.x, p.y - camp.y);
  const text =
    a.oldTown === 'ruins'
      ? `Under the grass to the ${where}: worked stones, a hearth, a toppled sign. It is ${a.founder}'s town, that fell. Its dead walk there still.`
      : `To the ${where}, a mound ringed with stones: the barrow where ${a.founder} was laid, and the honoured dead keep it.`;
  log(a, text);
  tellStory(s, oldPlaceName(s), `${text} The elders say a party could go and lay them to rest.`, a.oldTown === 'ruins' ? 'ruins dead ghosts' : 'barrow grave stones');
}

/** A party has cleared the old place: its dead laid to rest, the curse lifted, the heirloom strengthened. */
export function oldPlaceCleared(s: GameState, p: MapPlace, loot: Partial<Record<Material, number>>, rng: Rng): void {
  const a = s.ancestry;
  if (!a) return;
  a.laid = true;
  const coins = Math.round(OLD_PLACE_COINS + a.renown * OLD_PLACE_RENOWN + rng.int(0, 10));
  s.coins = (s.coins ?? 0) + coins;
  earn(s, 'events', coins);
  addStock(loot, a.oldTown === 'ruins' ? 'stone' : 'iron', 4);
  const bits: string[] = [`${coins} coins of the old house's to the treasury`];
  if (a.heirloom) {
    if (a.heirloom.cursed) {
      a.heirloom.cursed = false;
      a.heirloom.lifted = true;
      bits.push(`the curse on the ${ITEM_BY_ID[a.heirloom.item]?.name ?? 'heirloom'} is lifted`);
    }
    strengthenHeirloom(s, a.heirloom.item);
    bits.push(`the ${ITEM_BY_ID[a.heirloom.item]?.name ?? 'heirloom'} grows stronger`);
  }
  (s.marks ??= []).push({ lever: 'morale', value: LAID_MORALE, until: s.tick + 2 * TICKS_PER_DAY, text: `${a.founder}'s dead at rest` });
  const text = `${oldPlaceName(s)} is quiet at last: the dead of ${a.line} are laid to rest. ${bits.join(', ')}.`;
  log(a, text);
  notify(s, text, true);
  tellStory(s, 'Laid to rest', `${text} That night the spirits of the line came to the fire, and they were glad.`, 'ghosts rest peace graves');
  void p;
}

/** Once an hour: spirits by night, the curse by morning, the Old House by noon. */
export function ancestorsHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0 || s.gameOver) return;
  const a = s.ancestry;
  if (!a) return;
  const cal = calendarOf(s);
  const rng = new Rng(hashSeed(`${s.seed}:ancestors:${s.tick}`));
  if (cal.hour === VISIT_HOUR) visitTonight(s, a, rng);
  if (cal.hour === CURSE_HOUR) curseMorning(s, a, rng);
  if (cal.hour === HOUSE_HOUR && a.oldTown === 'power') houseNoon(s, a, rng);
}

const grownHere = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p) && !p.downed);

/** A spirit may come to the fire tonight. */
function visitTonight(s: GameState, a: Ancestry, rng: Rng): void {
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const gap = (a.honoured === 'rest' ? 2 : 1) * VISIT_GAP_DAYS * TICKS_PER_DAY;
  if (day < VISIT_FROM_DAY || (a.lastVisit !== undefined && s.tick - a.lastVisit < gap)) return;
  if (!rng.chance(a.laid ? VISIT_CHANCE_LAID : VISIT_CHANCE)) return;
  const spirit = rng.pick(a.spirits);
  a.lastVisit = s.tick;
  a.visits++;
  const who = spirit.kin === 'founder' ? `${spirit.name}, who founded the old town` : spirit.kin === 'forebear' ? `${spirit.name}, a founder of the line long gone` : `${spirit.name}${spirit.calling ? ` the ${spirit.calling.toLowerCase()}` : ''}`;
  // (the first visit asks how the town will honour its forebears, and tells of the old place)
  if (a.honoured === null || a.honoured === undefined) {
    revealOldPlace(s, a);
    const story = `In the small hours the fire burned blue, and ${who} stood beside it, pale as frost. "I am of your line," the spirit said. "We have not forgotten you. Will you remember us?"${a.place !== undefined ? ` Before it faded it turned its face toward ${oldPlaceName(s).replace(/^The /, 'the ')}.` : ''}`;
    askWays(s, { system: 'legacy', about: 'honour' }, `A spirit of ${a.line}`, story, 'ghost spirit night fire', ['Honour them with a feast', 'Ask their counsel', 'Bid them rest'], 0, ASK_HOURS);
    log(a, `${spirit.name}'s spirit came to the fire and asked to be remembered.`);
    return;
  }
  bless(s, a, spirit, who, rng, a.honoured === 'feast' ? 1.5 : 1);
}

/** A blessing from a visiting spirit: mending, a skill taught, or spirits lifted. */
function bless(s: GameState, a: Ancestry, spirit: Spirit, who: string, rng: Rng, k: number): void {
  const here = grownHere(s);
  const hurt = s.people.filter((p) => p.away === null && p.hp < maxHp(p) * 0.8);
  const kind = hurt.length && rng.chance(0.4) ? 'mend' : here.length && rng.chance(0.5) ? 'teach' : 'cheer';
  let text: string;
  if (kind === 'mend') {
    for (const p of hurt) p.hp = Math.min(maxHp(p), p.hp + (maxHp(p) - p.hp) * BLESS_MEND * k);
    text = `${who} came to the fire tonight and laid cold hands on the hurt: ${hurt.length} of them woke mended.`;
  } else if (kind === 'teach') {
    const p = rng.pick(here);
    const skill = bestSkill(p);
    p.skills[skill].level = Math.min(MAX_SKILL, p.skills[skill].level + Math.max(1, Math.round(k)));
    text = `${who} came to ${p.name} in a dream and showed them the old ways of ${skill}. They woke knowing more.`;
  } else {
    (s.marks ??= []).push({ lever: 'morale', value: Math.round(BLESS_MORALE * k), until: s.tick + TICKS_PER_DAY, text: `Visited by ${spirit.name}'s spirit` });
    text = `${who} walked among the sleepers tonight, and the town woke lighter of heart.`;
  }
  log(a, text);
  notify(s, text, true);
}

const bestSkill = (p: Person): Skill => SKILLS.reduce((b, k) => (p.skills[k].level > p.skills[b].level ? k : b), SKILLS[0]);

/** The old place is shown to the town (the first visit points the way). */
function revealOldPlace(s: GameState, a: Ancestry): void {
  const p = s.places?.find((q) => q.id === a.place);
  if (!p || p.found !== null) return;
  p.found = s.tick;
  oldPlaceFound(s, p);
}

/** The first visit's answer (from heritage.ts answerWays). */
export function answerLegacy(s: GameState, prompt: Prompt, option: number): void {
  const a = s.ancestry;
  if (!a) return;
  const pick = (['feast', 'counsel', 'rest'] as const)[option] ?? 'feast';
  a.honoured = pick;
  let text: string;
  if (pick === 'feast') {
    eatHonour(s, grownHere(s).length);
    (s.marks ??= []).push({ lever: 'morale', value: BLESS_MORALE * 2, until: s.tick + 2 * TICKS_PER_DAY, text: `The feast for ${a.line}` });
    text = `The town feasted its forebears by the fire, and set a place for the dead. The spirits will come gladly, and their blessings will be the greater.`;
  } else if (pick === 'counsel') {
    const topic = s.research.queue[0];
    if (topic) s.research.progress[topic] = (s.research.progress[topic] ?? 0) + (1 - (s.research.progress[topic] ?? 0)) * 0.3;
    text = topic ? `The spirit spoke of what the old town knew, and the scholars wrote it down: ${topic.replace(/_/g, ' ')} comes easier now.` : `The spirit spoke of the old town, and the elders listened.`;
  } else {
    text = `The town bade its forebears rest. They will come seldom now.`;
  }
  log(a, text);
  setOutcome(s, prompt.title, prompt.options[option] ?? null, text);
  notify(s, text, true);
}

/** Food for the honouring feast (the plainest first). */
function eatHonour(s: GameState, heads: number): void {
  let need = heads * HONOUR_FOOD;
  for (const m of Object.keys(FOOD_VALUE) as Material[])
    for (const st of storages(s))
      while (need > 0 && (st.store[m] ?? 0) > 0) {
        addStock(st.store, m, -1);
        need -= FOOD_VALUE[m]!;
      }
}

/** Who carries the heirloom now. */
export const heirloomBearer = (s: GameState): Person | undefined => {
  const item = s.ancestry?.heirloom?.item;
  return item ? s.people.find((p) => Object.values(p.gear).includes(item)) : undefined;
};

/** Of a morning the cursed heirloom may bite its bearer. */
function curseMorning(s: GameState, a: Ancestry, rng: Rng): void {
  if (!a.heirloom?.cursed) return;
  const p = heirloomBearer(s);
  if (!p || p.away !== null || !rng.chance(CURSE_CHANCE_DAILY)) return;
  const name = ITEM_BY_ID[a.heirloom.item]?.name ?? 'heirloom';
  if (rng.chance(0.5)) {
    minorWound(s, p, Math.round(maxHp(p) * CURSE_HURT), rng);
    notify(s, `The ${name} turned in ${p.name}'s hand: a cut that will not close cleanly. The curse of ${a.line} is on it.`, true);
  } else {
    p.sore = { until: s.tick + TICKS_PER_DAY, value: CURSE_MORALE, text: `The ${name}'s curse` };
    notify(s, `${p.name} dreamed of ${a.founder}'s town burning, and woke with the ${name} in their hands. The curse weighs on them.`, true);
  }
  log(a, `The curse of the ${name} bit ${p.name}.`);
}

/** At noon the Old House may send something: a gift, or one of its heroes to teach. */
function houseNoon(s: GameState, a: Ancestry, rng: Rng): void {
  const f = s.factions?.find((x) => x.id === 'old_house');
  if (!f || f.stance === 'destroyed' || f.stance === 'war' || f.attitude < 0) return;
  if (a.lastHouse !== undefined && s.tick - a.lastHouse < HOUSE_GAP_DAYS * TICKS_PER_DAY) return;
  if (!rng.chance(HOUSE_CHANCE)) return;
  a.lastHouse = s.tick;
  const living = a.spirits.filter((x) => !x.fell && x.kin !== 'forebear');
  const here = grownHere(s);
  if (living.length && here.length && rng.chance(0.5)) {
    const hero = rng.pick(living);
    const p = rng.pick(here);
    const skill: Skill = p.skills.melee.level >= p.skills.ranged.level ? 'melee' : 'ranged';
    p.skills[skill].level = Math.min(MAX_SKILL, p.skills[skill].level + 1);
    const text = `${hero.name}, remembered in the old town's songs and grey now, rode over from the Old House and spent a day teaching ${p.name} the ${skill === 'melee' ? 'blade' : 'bow'}.`;
    log(a, text);
    notify(s, text, true);
    return;
  }
  s.coins = (s.coins ?? 0) + HOUSE_GIFT_COINS;
  earn(s, 'realm', HOUSE_GIFT_COINS);
  for (const st of storages(s).slice(0, 1)) addStock(st.store, 'cloth', 3);
  const text = `A cart from the Old House, with ${HOUSE_GIFT_COINS} coins and bolts of cloth, "for ${a.founder}'s kin".`;
  log(a, text);
  notify(s, text, true);
}

/** In a raid not begun inside: a spirit may stand with the town, and the Old House's riders come (from raids.ts). */
export function ancestorAllies(s: GameState, r: Raid, inside: boolean, make: (kind: string) => Raider): number {
  const a = s.ancestry;
  if (!a || s.autopilot === false || inside) return 0;
  const rng = new Rng(hashSeed(`${s.seed}:ancestorAllies:${r.id}`));
  let n = 0;
  if (rng.chance(a.laid ? ALLY_CHANCE_LAID : ALLY_CHANCE)) {
    const spirit = rng.pick(a.spirits);
    r.raiders.push(make('ancestor_shade'));
    if (a.laid && rng.chance(0.5)) r.raiders.push(make('ancestor_shade'));
    n = r.raiders.filter((x) => x.kind === 'ancestor_shade').length;
    notify(s, `A cold light at the gate: the spirit of ${spirit.name} stands with the town.`, true);
    log(a, `${spirit.name}'s spirit fought beside the town in a raid.`);
  }
  const f = s.factions?.find((x) => x.id === 'old_house');
  if (a.oldTown === 'power' && f && (f.stance === 'alliance' || f.stance === 'trade' || f.attitude >= 50) && rng.chance(HOUSE_ALLY_CHANCE)) {
    r.raiders.push(make('house_rider'), make('house_rider'));
    n += 2;
    const hero = a.spirits.find((x) => !x.fell && x.kin === 'hero');
    notify(s, `Riders of the Old House come to their kin's aid${hero ? `, ${hero.name}'s banner at their head` : ''}.`, true);
  }
  return n;
}

/** What the People and Chronicle show of the town's forebears. */
export interface AncestryView {
  line: string;
  founder: string;
  generation: number;
  fate: Legend['fate'];
  forebears: string[];
  spirits: Spirit[];
  heirloom: { name: string; plus: number; carried: number; cursed: boolean; lifted: boolean; bearer: string | null } | null;
  oldTown: 'ruins' | 'power';
  place: { name: string; found: boolean; laid: boolean } | null;
  house: { stance: string; attitude: number } | null;
  visits: number;
  log: string[];
}

export function ancestryView(s: GameState): AncestryView | null {
  const a = s.ancestry;
  if (!a) return null;
  const p = s.places?.find((q) => q.id === a.place);
  const item = a.heirloom ? ITEM_BY_ID[a.heirloom.item] : undefined;
  const bearer = heirloomBearer(s);
  const q = bearer ? (Object.entries(bearer.gear).find(([, id]) => id === a.heirloom!.item)?.[0] as string | undefined) : undefined;
  const plus = bearer && q ? plusOf((bearer.gearQ as Record<string, number> | undefined)?.[q]) : plusOf(a.heirloom ? s.itemQ?.[a.heirloom.item]?.[0] : undefined);
  const house = s.factions?.find((f) => f.id === 'old_house');
  return {
    line: a.line,
    founder: a.founder,
    generation: a.generation + 1,
    fate: a.fate,
    forebears: a.forebears,
    spirits: a.spirits,
    heirloom: a.heirloom && item ? { name: item.name, plus, carried: a.heirloom.carried, cursed: a.heirloom.cursed, lifted: !!a.heirloom.lifted, bearer: bearer?.name ?? null } : null,
    oldTown: a.oldTown,
    place: p ? { name: oldPlaceName(s), found: p.found !== null, laid: !!a.laid } : null,
    house: house ? { stance: house.stance, attitude: Math.round(house.attitude) } : null,
    visits: a.visits,
    log: a.log.slice(-6),
  };
}

const ordinal = (n: number) => `${n}${n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th'}`;
