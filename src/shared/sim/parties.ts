// Parties that form themselves (PLAN.md step 5, data/parties.ts). Once an hour in the morning, an adventurer at home
// who is rested and healed proposes a trip to a place the player hasn't forbidden; they
// recruit a balanced party (a front line, a healer, someone to deal the damage, a scout) from those fit to go,
// leaning on friendship, never taking two enemies together, and bringing whoever is devoted to someone going. The
// town keeps its guards, its keepers, the founder and half its grown-ups home. If the party isn't strong enough for
// the place, it doesn't go. A bounty the treasury posts draws the adventurers to a place, is held aside, and is paid to the party that does the
// job.

import { BUILDING_BY_ID } from '../data/buildings';
import { CLASS_DEFS, type ClassRole } from '../data/classes';
import { FOUNDER_CLASS } from '../data/founderClasses';
import { DUNGEON_BY_ID } from '../data/dungeons';
import { ENEMIES } from '../data/enemies';
import { DESTINATIONS, MAX_DELVERS, MAX_EXPEDITIONS, MAX_PARTY, the, The, type Destination } from '../data/expeditions';
import { HUNT_DEST } from '../data/pack';
import { isPlaceDest } from '../data/places';
import { natureOf } from '../data/natures';
import { levelOf } from '../data/levels';
import { PURSE_SCALE } from '../data/shop';
import {
  BOUNTY_MOST,
  BOUNTY_STEP,
  DARE,
  DARE_BOLD,
  FIT_FOOD,
  FIT_HP,
  FIT_REST,
  KEEP_HOME_SHARE,
  MIN_TOWN_FOR_TRIPS,
  PARTY_GAP_HOURS,
  PULL_BOUNTY,
  PULL_FIGHT,
  PULL_NEW,
  RECRUIT_ADVENTURER,
  RECRUIT_DEVOTED,
  RECRUIT_OPINION,
  RECRUIT_ROLE,
  SET_OUT_FROM,
  SET_OUT_UNTIL,
  STRENGTH_PER_LEVEL,
  TRIP_REST_HOURS,
} from '../data/parties';
import { DEVOTED, ENEMY } from '../data/social';
import { ambitionOf } from './ambition';
import { boatDef, freeBoat } from './boats';
import { payParty } from './economy';
import { destinationOf, destinationUnlocked, rolesFor, STAKES, sendExpedition, planParty, type SendCheck, type Stakes } from './expeditions';
import { placeDestinations } from './places';
import { packDestinations } from './pack';
import { isChild, opinion } from './social';
import { alarmRaised } from './people';
import { earn, maxHp, notify, type Expedition, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

/** Every destination on the board now (the world's, the places on the land, the rival packs' lairs). */
export const boardDestinations = (s: GameState): Destination[] => [...DESTINATIONS, ...placeDestinations(s), ...packDestinations(s)];

/** The player's veto: destinations no party may choose. */
export const vetoed = (s: GameState, id: string) => (s.vetoed ?? []).includes(id);
export function setVeto(s: GameState, id: string, on: boolean): void {
  const v = new Set(s.vetoed ?? []);
  if (on) v.add(id);
  else v.delete(id);
  s.vetoed = [...v];
  if (on) withdrawBounty(s, id);
}

/** A bounty's step (times the era's purse scale). */
export const bountyStep = (s: GameState) => Math.round(BOUNTY_STEP * PURSE_SCALE[s.era]);
export const bountyOn = (s: GameState, id: string) => s.bounties?.[id] ?? 0;

/** The treasury posts (or raises) a bounty on a destination: the coins are set aside from the treasury at once. */
export function postBounty(s: GameState, id: string): SendCheck {
  const step = bountyStep(s);
  if (vetoed(s, id)) return { ok: false, reason: 'That place is forbidden' };
  if (!destinationOf(s, id)) return { ok: false, reason: 'Unknown destination' };
  if (bountyOn(s, id) >= step * BOUNTY_MOST) return { ok: false, reason: 'The bounty is as high as it goes' };
  if ((s.coins ?? 0) < step) return { ok: false, reason: `The treasury needs ${step} coins` };
  s.coins = (s.coins ?? 0) - step;
  earn(s, 'bounties', -step);
  (s.bounties ??= {})[id] = bountyOn(s, id) + step;
  return { ok: true };
}

/** The bounty taken back into the treasury. */
export function withdrawBounty(s: GameState, id: string): void {
  const n = bountyOn(s, id);
  if (!n) return;
  s.coins = (s.coins ?? 0) + n;
  earn(s, 'bounties', n);
  delete s.bounties![id];
}

/** A party is home: did it do the job? (A dungeon cleared, a threat put down, else back unrecalled on its feet.) */
export function jobDone(e: Expedition, members: Person[]): boolean {
  if (e.recalled) return false;
  if (e.delve) return !!e.delve.cleared;
  const d = DESTINATIONS.find((q) => q.id === e.dest);
  if (!d || d.type === 'clear' || isPlaceDest(e.dest)) return !!e.cleared;
  return members.some((p) => !p.downed);
}

/** The bounty on the place a party came home from, paid to them if they did the job. */
export function payBounty(s: GameState, e: Expedition, members: Person[]): void {
  const n = bountyOn(s, e.dest);
  if (!n || !jobDone(e, members)) return;
  delete s.bounties![e.dest];
  const d = destinationOf(s, e.dest);
  payParty(s, members.filter((p) => !p.downed).length ? members.filter((p) => !p.downed) : members, n, `The bounty on ${d ? d.name : 'the place'}`);
  notify(s, `${The(d?.name ?? 'the place')} party claims the bounty: ${n} coins.`, true);
}

/* ------------------------------------------------------------ who is fit, and who may go */

const keeping = (s: GameState, p: Person) =>
  s.buildings.some((b) => b.operator === p.id && b.status === 'done' && (!!BUILDING_BY_ID[b.def]?.floor || b.def === 'infirmary' || b.def === 'healers_hut'));

/** Fit for a trip: grown, at home and on their feet, healed, rested, fed, and not just back from one. */
export function fitToGo(s: GameState, p: Person): boolean {
  if (p.away !== null || p.downed || p.sick || isChild(p)) return false;
  if (p.hp < maxHp(p) * FIT_HP || p.needs.rest < FIT_REST || p.needs.food < FIT_FOOD) return false;
  if (p.homeAt != null && s.tick - p.homeAt < TRIP_REST_HOURS * TICKS_PER_HOUR) return false;
  return true;
}

/** Who may be asked along: fit, and not someone the town keeps home (a guard, a keeper, the founder). */
export const mayGo = (s: GameState, p: Person) => fitToGo(s, p) && !p.guard && p.id !== s.mainId && !keeping(s, p);

/** How many more may be away now, leaving half the grown-ups home. */
export function roomAway(s: GameState): number {
  const grown = s.people.filter((p) => !isChild(p));
  if (grown.length < MIN_TOWN_FOR_TRIPS) return 0;
  const away = grown.filter((p) => p.away !== null).length;
  return Math.max(0, Math.floor(grown.length * (1 - KEEP_HOME_SHARE)) - away);
}

/** What a person brings to a party: their calling's role, else what their skills lean to. */
export function partRole(p: Person): ClassRole {
  const cls = p.fcls ? FOUNDER_CLASS[p.fcls]?.base : p.cls;
  const role = cls ? CLASS_DEFS[cls]?.role : undefined;
  if (role) return role;
  if (p.skills.medicine.level >= 5 && p.skills.medicine.level >= p.skills.melee.level) return 'healer';
  return p.skills.ranged.level > p.skills.melee.level ? 'shooter' : 'bruiser';
}
type Slot = 'front' | 'heal' | 'damage' | 'scout';
const SLOT_OF: Record<ClassRole, Slot> = { tank: 'front', bruiser: 'front', striker: 'damage', caster: 'damage', shooter: 'scout', healer: 'heal', support: 'heal' };
/** The roles a party wants, in the order it fills them. */
const WANTS: readonly Slot[] = ['front', 'heal', 'damage', 'scout', 'front', 'damage'];

/** A party's strength: each member's health, more by their level. */
export const strengthOf = (members: Person[]) => members.reduce((n, p) => n + maxHp(p) * (1 + levelOf(p) * STRENGTH_PER_LEVEL), 0);

/** A place's danger: the heaviest group of foes it may hold (a dungeon's boss and its guard), by their health. */
export function dangerOf(d: Destination): number {
  const hp = (g: Record<string, number>) => Object.entries(g).reduce((n, [id, k]) => n + (ENEMIES[id]?.hp ?? 30) * k, 0);
  const dungeon = DUNGEON_BY_ID[d.id];
  if (dungeon) return Math.max(...dungeon.bosses.map(hp), ...dungeon.foes.map(hp));
  const groups = d.encounters.groups.map((g) => hp(g.enemies as Record<string, number>));
  return groups.length && (d.encounters.arrival > 0 || d.encounters.ambush > 0 || d.type === 'clear') ? Math.max(...groups) : 0;
}

/** The most a party for this place may number. */
const mostFor = (s: GameState, d: Destination) => {
  // (an island's party is her crew)
  const boat = d.byBoat ? freeBoat(s) : undefined;
  if (boat) return Math.min(boatDef(boat).crew, MAX_DELVERS);
  return d.type === 'delve' || isPlaceDest(d.id) || d.id.startsWith('pack:') ? MAX_DELVERS : MAX_PARTY;
};

/** Recruit a party round a leader for a destination: by the roles still wanted, by liking, never an enemy of anyone
 *  already going, and whoever is devoted to someone going comes too if there's room. */
export function recruit(s: GameState, leader: Person, d: Destination, pool: Person[], size: number): Person[] {
  const party = [leader];
  const left = pool.filter((p) => p !== leader && opinion(s, p.id, leader.id) > ENEMY);
  const devotedTo = (p: Person) => party.some((q) => q.partner === p.id || opinion(s, p.id, q.id) >= DEVOTED);
  const filled = (slot: Slot) => party.filter((q) => SLOT_OF[partRole(q)] === slot).length;
  let w = 0;
  while (party.length < size && left.length) {
    // the next role the party lacks
    while (w < WANTS.length && filled(WANTS[w]) >= WANTS.slice(0, w + 1).filter((x) => x === WANTS[w]).length) w++;
    const want = WANTS[w];
    let best: Person | undefined;
    let bestScore = -Infinity;
    for (const p of left) {
      if (party.some((q) => opinion(s, p.id, q.id) <= ENEMY)) continue;
      const liking = party.reduce((n, q) => n + opinion(s, p.id, q.id), 0) / party.length;
      const score =
        liking * RECRUIT_OPINION +
        (want && SLOT_OF[partRole(p)] === want ? RECRUIT_ROLE : 0) +
        (ambitionOf(p) === 'adventurer' ? RECRUIT_ADVENTURER : 0) +
        (devotedTo(p) ? RECRUIT_DEVOTED : 0) +
        levelOf(p) / 10 -
        (d.type === 'gather' ? 0 : partRole(p) === 'healer' && filled('heal') ? 2 : 0);
      if (score > bestScore) {
        bestScore = score;
        best = p;
      }
    }
    if (!best) break;
    party.push(best);
    left.splice(left.indexOf(best), 1);
  }
  return party;
}

/** Whether a party dares a place. */
export function dares(leader: Person, party: Person[], d: Destination): boolean {
  const danger = dangerOf(d);
  if (!danger) return true;
  const bold = ['bold', 'restless', 'proud'].includes(natureOf(leader).id);
  return strengthOf(party) >= danger * (bold ? DARE_BOLD : DARE);
}

/** How much a place draws a leader: a bounty, a fight for an adventurer, somewhere not yet seen. */
function pull(s: GameState, leader: Person, d: Destination): number {
  let n = bountyOn(s, d.id) * PULL_BOUNTY;
  if (!s.scouted.includes(d.id)) n += PULL_NEW;
  if (ambitionOf(leader) === 'adventurer' && dangerOf(d) > 0) n += PULL_FIGHT;
  if (d.type === 'gather') n += 1;
  return n;
}

/** Which places a party might set out for now. */
function choosable(s: GameState): Destination[] {
  const going = new Set(s.expeditions.map((e) => e.dest));
  return boardDestinations(s).filter(
    (d) => d.id !== HUNT_DEST && !vetoed(s, d.id) && !going.has(d.id) && destinationUnlocked(s, d) && (!d.coins || (s.coins ?? 0) >= d.coins * 2) && (!d.byBoat || !!freeBoat(s)),
  );
}

export interface PartyPlan {
  dest: string;
  leader: number;
  members: number[];
  stakes: Stakes;
}

/** The party that would form now, if any: the leader, where they'd go, who'd come, and how boldly. */
export function proposeParty(s: GameState): PartyPlan | null {
  if (s.expeditions.length >= MAX_EXPEDITIONS || s.raid || alarmRaised(s)) return null;
  const room = roomAway(s);
  if (room < 1) return null;
  const pool = s.people.filter((p) => mayGo(s, p));
  if (!pool.length) return null;
  const places = choosable(s);
  if (!places.length) return null;
  // the leaders: the adventurers among the fit (nobody else leads a party), the most seasoned first
  const leaders = pool.filter((p) => ambitionOf(p) === 'adventurer').sort((a, b) => levelOf(b) - levelOf(a) || a.id - b.id);
  for (const leader of leaders) {
    const ranked = [...places].sort((a, b) => pull(s, leader, b) - pull(s, leader, a) || a.id.localeCompare(b.id));
    for (const d of ranked) {
      const size = Math.max(1, Math.min(room, mostFor(s, d), Math.max(d.recommendedParty, dangerOf(d) ? 3 : 1)));
      const party = recruit(s, leader, d, pool, size);
      if (!dares(leader, party, d)) continue;
      const bold = ['bold', 'restless', 'proud'].includes(natureOf(leader).id);
      return { dest: d.id, leader: leader.id, members: party.map((p) => p.id), stakes: bold ? 'risky' : 'safe' };
    }
  }
  return null;
}

/** Once an hour in the morning: a party may form and set out (the town running itself: not with the autopilot off). */
export function partiesHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  const h = calendar(s.tick).hour;
  if (h < SET_OUT_FROM || h >= SET_OUT_UNTIL) return;
  if (s.lastParty != null && s.tick - s.lastParty < PARTY_GAP_HOURS * TICKS_PER_HOUR) return;
  const plan = proposeParty(s);
  if (!plan) return;
  const d = destinationOf(s, plan.dest)!;
  const members = plan.members.map((id) => s.people.find((p) => p.id === id)!);
  const town = planParty(s, plan.dest);
  const r = sendExpedition(s, plan.dest, plan.members, rolesFor(members, d), STAKES[plan.stakes].stance, Math.min(town.horses, members.length), town.truck && plan.stakes === 'risky');
  if (!r.ok) return;
  s.expeditions[s.expeditions.length - 1].stakes = plan.stakes;
  s.expeditions[s.expeditions.length - 1].leader = plan.leader;
  s.lastParty = s.tick;
  const leader = members[0];
  const bounty = bountyOn(s, d.id);
  notify(s, `${leader.name} gathers a party for ${the(d.name)}${bounty ? `, after the bounty of ${bounty} coins` : ''}.`, true);
}
