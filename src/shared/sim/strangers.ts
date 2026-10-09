// Strangers of other peoples (data/strangers.ts): who a wanderer or traveller is, how they look, whether the town
// takes them in, and a traveller asking to settle.
import { ORIGIN_DEFS, type OriginId, rulesOf } from '../data/origins';
import { SETTLE_CHANCE, STRANGER_CHANCE, STRANGER_ORIGINS, TRAVELLER_STRANGER_CHANCE } from '../data/strangers';
import { LIFESPANS } from '../data/lifespans';
import type { Rng } from '../rng';
import { becomeMonster } from './monsters';
import { townFull, makePerson, notify, sideOf, type GameState, type Person, type Traveller } from './state';
import { askVisitor, campEdge, joinTooSoon } from './townsfolk';
import { TICKS_PER_HOUR } from './time';

/** The people someone is of (their own, else the town's). */
export const peopleOf = (s: Pick<GameState, 'origin'>, p: Pick<Person, 'origin'>): OriginId => p.origin ?? s.origin ?? 'settlers';

/** A stranger's people, if this one is a stranger at all (null: one of the town's own). */
export function strangerOrigin(s: Pick<GameState, 'origin'>, rng: Rng, traveller = false): OriginId | null {
  if (!rng.chance(traveller ? TRAVELLER_STRANGER_CHANCE : STRANGER_CHANCE)) return null;
  const own = s.origin ?? 'settlers';
  const picks = STRANGER_ORIGINS.filter(([o]) => o !== own);
  return rng.weighted(Object.fromEntries(picks)) as OriginId;
}

/** Sea skins for the merfolk, by who they are. */
const SEA_SKINS = ['#7cc0b8', '#6aa8b0', '#8cc8c0', '#5a98a8'];

/** The look of a people on someone: the dwarves short, the fae and the merfolk long-eared (the merfolk sea-skinned),
 *  a stranger of the Blood Court pale. */
export function strangerLook(p: Pick<Person, 'id' | 'look' | 'origin'>, origin: OriginId): void {
  p.origin = origin;
  if (origin === 'dwarves') p.look.height = 0.86;
  if (origin === 'fae') p.look.ears = 'elf';
  if (origin === 'merfolk') {
    p.look.ears = 'elf';
    p.look.skin = SEA_SKINS[p.id % SEA_SKINS.length];
  }
  if (origin === 'vampire') p.look.skin = '#e8e0e8';
  if (origin === 'orcs') orcLook(p);
}

/** The greenskins of the horde: the pack's orc body (tusks and pointed ears), a green skin under it for the old
 *  side-on figure. */
const ORC_SKINS = ['#6a9a4a', '#5a8a3e', '#7aa456', '#4e7a38', '#86a860'];
export function orcLook(p: Pick<Person, 'id' | 'look'>): void {
  p.look.body = 'orc';
  p.look.skin = ORC_SKINS[p.id % ORC_SKINS.length];
  p.look.ears = 'elf';
}

/** A stranger made one of their people: the look, and the Blood Court's and the Moon Pack's curses. */
export function makeStranger(s: GameState, p: Person, origin: OriginId): void {
  strangerLook(p, origin);
  if (origin === 'vampire') becomeMonster(s, p, 'vampire');
  if (origin === 'werewolf') becomeMonster(s, p, 'werewolf');
}

/** Whether the town takes in one of another people: a xenophobic people keeps to its own. */
export const welcomes = (s: Pick<GameState, 'origin'>, origin: OriginId | null) => !origin || origin === (s.origin ?? 'settlers') || !ORIGIN_DEFS[s.origin ?? 'settlers'].rules.xenophobic;

/** "a dwarf", "a settler": what one of a people is called. */
export const oneOf = (origin: OriginId) => LIFESPANS[origin].one;

/** How long a traveller who asks to settle waits at the edge of town. */
const SETTLE_WAIT_HOURS = 6;

/** A traveller leaving the shop well served may ask to settle (a bed free, nobody else waiting at the gate): they
 *  become the town's visitor, to be taken in or sent on (a xenophobic town sends a stranger on at once). */
export function offerToSettle(s: GameState, t: Traveller, rng: Rng, housingFree: boolean): boolean {
  if (s.visitor || !housingFree || townFull(s) || joinTooSoon(s) || !rng.chance(SETTLE_CHANCE)) return false;
  const origin = t.origin ?? null;
  if (!welcomes(s, origin)) {
    notify(s, `${t.name}, ${oneOf(origin!)}, asked to stay, and was sent on: ${ORIGIN_DEFS[s.origin!].name} keep to their own.`);
    return false;
  }
  const type = t.tier && t.tier >= 3 ? 'elder' : t.venue === 'tavern' ? 'wanderer' : 'crafter';
  const person = makePerson(rng, s.nextId++, type, { x: t.x, y: t.y }, [...s.people.map((p) => p.name)]);
  person.name = t.name;
  person.look = { ...t.look };
  if (origin) makeStranger(s, person, origin);
  const side = sideOf(s, t);
  const wait = campEdge(s, side);
  person.dir = side < 0 ? 1 : -1;
  s.visitor = { person, waitX: wait.x, waitY: wait.y, leavesTick: s.tick + SETTLE_WAIT_HOURS * TICKS_PER_HOUR, leavingTo: null };
  s.lastVisit = s.tick;
  notify(s, `${t.name}, ${origin ? oneOf(origin) + ' and ' : ''}a ${t.kind.toLowerCase()}, asks to settle here. See Townsfolk.`, true);
  if (!rulesOf(s).freeJoin) askVisitor(s, `${t.name}, ${origin ? oneOf(origin) + ' and ' : ''}a ${t.kind.toLowerCase()} who traded here`, '');
  return true;
}
