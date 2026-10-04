// The Moon Pack (data/pack.ts): the pack's renown, the full-moon hunt, the rival packs' raids and their breaking, the
// hunting grounds, challenges to the Alpha, and the Great Hunt that wins the game. Everything here is the town's own
// doing but the war parties, which the player sends from the Expedition Board like a dungeon delve.
import {
  CHALLENGE_CHANCE,
  CHALLENGE_GAP_DAYS,
  CHALLENGE_LEVEL_EDGE,
  GREAT_BEAST,
  GREAT_BEAST_RENOWN,
  GROUNDS_YIELD,
  HUNT_DEST,
  HUNT_HOUR,
  HUNT_KEEP_HOME,
  HUNT_PARTY,
  huntDestination,
  isPackDest,
  PACK_RAID_CHANCE,
  PACK_RAID_FROM_DAY,
  PACK_RENOWN,
  packDestination,
  packIdOf,
  RENOWN_FIGHT,
  RENOWN_FIGHT_MAX,
  RIVAL_PACK_BY_ID,
  RIVAL_PACKS,
  type RivalPackDef,
} from '../data/pack';
import type { Destination } from '../data/expeditions';
import { levelOf } from '../data/levels';
import type { Rng } from '../rng';
import { depositNear } from './buildings';
import { becomeMonster, fullMoon, moonPhaseOf, FULL_MOON_PHASE } from './monsters';
import { isChild } from './social';
import { townFull, campXY, makePerson, maxHp, notify, type Expedition, type GameState, type Person, type Raid } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export interface PackState {
  /** The pack's name in the hills. */
  renown: number;
  /** Full-moon hunts run. */
  hunts: number;
  /** Rival packs broken (data/pack.ts ids). */
  broken: string[];
  /** Hunting grounds held (a broken pack's hills each). */
  grounds: number;
  /** The Great Beast has fallen to the hunt. */
  beast?: 'slain';
  /** The last challenge to the Alpha (tick). */
  lastChallenge?: number;
  /** Which rival pack raided last (they take turns). */
  lastRaid?: number;
}

export const packOn = (s: Pick<GameState, 'origin'>) => s.origin === 'werewolf';

export function packState(s: GameState): PackState {
  return (s.pack ??= { renown: 0, hunts: 0, broken: [], grounds: 0 });
}

/** The pack's renown adds to every blow (sim/origin.ts). */
export const packFightMult = (s: Pick<GameState, 'origin' | 'pack'>) => (packOn(s) && s.pack ? 1 + Math.min(RENOWN_FIGHT_MAX, s.pack.renown * RENOWN_FIGHT) : 1);

export const unbrokenPacks = (s: GameState): RivalPackDef[] => RIVAL_PACKS.filter((p) => !(s.pack?.broken ?? []).includes(p.id));
export const beastDue = (s: GameState) => !!s.pack && s.pack.renown >= GREAT_BEAST_RENOWN && s.pack.beast !== 'slain';

/** The hunt's and the lairs' destinations (sim/expeditions.ts destinationOf). */
export function packDestinationOf(s: GameState, id: string): Destination | undefined {
  if (!packOn(s)) return undefined;
  if (id === HUNT_DEST) return huntDestination(beastDue(s));
  const def = isPackDest(id) ? RIVAL_PACK_BY_ID[packIdOf(id)] : undefined;
  return def ? packDestination(def) : undefined;
}
/** The lairs still standing, for the Expedition Board. */
export const packDestinations = (s: GameState): Destination[] => (packOn(s) ? unbrokenPacks(s).map(packDestination) : []);
export const packDestUnlocked = (s: GameState, id: string) => packOn(s) && (id === HUNT_DEST || (isPackDest(id) && !(s.pack?.broken ?? []).includes(packIdOf(id))));

export function gainRenown(s: GameState, n: number, why: string): void {
  const p = packState(s);
  p.renown += n;
  notify(s, `${why} The pack's renown grows (${p.renown}).`, n >= PACK_RENOWN.lair);
  checkGreatHunt(s);
}

/** Once an hour: the grounds' game at dawn, a challenge the morning after a full moon, a rival pack at its dusk, and
 *  the hunt at its height. `send` runs the hunt out (sim/expeditions.ts sendExpedition); `raid` starts a rival's raid. */
export function packHourly(s: GameState, rng: Rng, send: (dest: string, members: number[]) => Expedition | null, raid: (kind: string, budget: number) => void): void {
  if (!packOn(s) || s.gameOver || s.tick % TICKS_PER_HOUR !== 0) return;
  const c = calendar(s.tick);
  const p = packState(s);
  if (c.hour === 6 && p.grounds > 0) {
    depositNear(s, campXY(s), { meat: GROUNDS_YIELD.meat * p.grounds, hide: GROUNDS_YIELD.hide * p.grounds });
    notify(s, `Game from the pack's hunting ground${p.grounds > 1 ? 's' : ''}: ${GROUNDS_YIELD.meat * p.grounds} meat and ${GROUNDS_YIELD.hide * p.grounds} hide.`);
  }
  if (c.hour === 7 && moonPhaseOf(c.day - 1) === FULL_MOON_PHASE) challenge(s, rng);
  if (c.hour === 19 && fullMoon(s) && !s.raid && c.day >= PACK_RAID_FROM_DAY && rng.chance(PACK_RAID_CHANCE)) {
    const packs = unbrokenPacks(s);
    if (packs.length) {
      const def = packs[((p.lastRaid ?? -1) + 1) % packs.length];
      p.lastRaid = packs.indexOf(def);
      const grown = s.people.filter((q) => q.away === null && !isChild(q)).length;
      raid(`pack_${def.id}`, 40 + def.strength * 12 + grown * 3);
    }
  }
  if (c.hour === HUNT_HOUR && fullMoon(s) && !s.raid && !s.expeditions.some((e) => e.hunt)) sendHunt(s, send);
}

/** The pack runs out under the full moon: the Alpha first, then the fittest, a third kept home to guard the den. */
function sendHunt(s: GameState, send: (dest: string, members: number[]) => Expedition | null): void {
  const able = s.people.filter((q) => q.away === null && !q.downed && !q.sick && !isChild(q) && q.monster === 'werewolf' && q.hp >= maxHp(q) * 0.6);
  if (able.length < 2) return;
  const sorted = [...able].sort((a, b) => Number(b.id === s.mainId) - Number(a.id === s.mainId) || levelOf(b) - levelOf(a));
  const going = sorted.slice(0, Math.min(HUNT_PARTY, Math.max(2, able.length - Math.ceil(able.length * HUNT_KEEP_HOME))));
  const e = send(HUNT_DEST, going.map((q) => q.id));
  if (!e) return;
  e.hunt = true;
  notify(s, `The moon is full. ${going.map((q) => q.name).join(', ')} run out to hunt${beastDue(s) ? ': the Great Beast is abroad' : ''}.`, true);
}

/** A party is home: a hunt's renown; a broken pack's hills, and its survivors who come over. */
export function packHome(s: GameState, e: Expedition, rng: Rng): void {
  if (!packOn(s)) return;
  if (e.hunt && !e.recalled) {
    packState(s).hunts++;
    gainRenown(s, PACK_RENOWN.hunt, 'The hunt is home.');
  }
  if (isPackDest(e.dest) && e.cleared) breakPack(s, packIdOf(e.dest), rng, true);
}

/** A rival pack is broken: its hills are the pack's hunting ground, and (beaten at its lair) one or two come over. */
export function breakPack(s: GameState, id: string, rng: Rng, atLair: boolean): void {
  const p = packState(s);
  const def = RIVAL_PACK_BY_ID[id];
  if (!def || p.broken.includes(id)) return;
  p.broken.push(id);
  p.grounds++;
  if (atLair && !townFull(s)) {
    const n = Math.min(1 + rng.int(0, 1), s.popTarget === undefined ? 2 : s.popTarget - s.people.length);
    const names: string[] = [];
    for (let i = 0; i < n; i++) {
      const q = makePerson(rng, s.nextId++, 'hunter', campXY(s), s.people.map((o) => o.name));
      becomeMonster(s, q, 'werewolf');
      s.people.push(q);
      names.push(q.name);
    }
    notify(s, `${def.alpha} is dead and ${def.name} is broken! ${def.lair[0].toUpperCase()}${def.lair.slice(1)} is the pack's hunting ground now, and ${names.join(' and ')} of the beaten pack ${n === 1 ? 'runs' : 'run'} with the town.`, true);
  } else notify(s, `${def.alpha} fell at the town's gate: ${def.name} is broken, and ${def.lair} is the pack's hunting ground now.`, true);
  gainRenown(s, PACK_RENOWN.pack, `${def.name[0].toUpperCase()}${def.name.slice(1)} will not howl again.`);
}

/** A raid ended: a rival pack whose alpha fell is broken; a beast raid beaten is renown. */
export function packRaidBeaten(s: GameState, r: Raid, rng: Rng): void {
  if (!packOn(s)) return;
  const foes = r.raiders.filter((q) => !q.ally);
  if (!foes.length || !foes.every((q) => q.down)) return;
  if (r.kind.startsWith('pack_')) breakPack(s, r.kind.slice(5), rng, false);
  else if (BEAST_KINDS.has(r.kind)) gainRenown(s, PACK_RENOWN.beastRaid, 'The beasts are driven off.');
}
const BEAST_KINDS = new Set(['wolves', 'boars', 'lions', 'wild_dogs', 'crocodiles', 'cave_bear', 'moon_werewolves']);

/** A lair on the land cleared (sim/places.ts). */
export function packLairCleared(s: GameState): void {
  if (packOn(s)) gainRenown(s, PACK_RENOWN.lair, 'A lair is cleared.');
}

/** A boss fell to the pack (sim/bosses.ts): the Great Beast is the hunt's crown. */
export function packBossSlain(s: GameState, kind: string): void {
  if (!packOn(s) || kind !== GREAT_BEAST) return;
  const p = packState(s);
  if (p.beast === 'slain') return;
  p.beast = 'slain';
  gainRenown(s, PACK_RENOWN.beast, 'The Pale Behemoth has fallen to the pack!');
}

/** The Great Hunt: every rival pack broken and the Great Beast slain, and the land is the pack's. */
export function checkGreatHunt(s: GameState): void {
  const p = s.pack;
  if (!packOn(s) || !p || s.gameOver || p.beast !== 'slain' || p.broken.length < RIVAL_PACKS.length) return;
  const days = Math.floor(s.tick / TICKS_PER_DAY) + 1;
  s.gameOver = {
    tick: s.tick,
    won: true,
    text: `The last rival pack is broken and the Pale Behemoth lies dead under the moon. After ${days} days every hill answers the pack's howl: the Great Hunt is over, and the land is yours. You won!`,
  };
  notify(s, 'The Great Hunt is won: the land belongs to the pack.', true);
}

/** The morning after a full moon, one of the pack who has outgrown the Alpha may challenge them: a fight of teeth and
 *  standing, the loser left bloodied, the winner the Alpha. Never two within CHALLENGE_GAP_DAYS. */
export function challenge(s: GameState, rng: Rng): void {
  const p = packState(s);
  if (s.tick - (p.lastChallenge ?? -Infinity) < CHALLENGE_GAP_DAYS * TICKS_PER_DAY) return;
  const alpha = s.people.find((q) => q.id === s.mainId);
  if (!alpha || alpha.away !== null || alpha.downed) return;
  const rivals = s.people.filter((q) => q !== alpha && q.away === null && !q.downed && !q.sick && !isChild(q) && q.monster === 'werewolf' && levelOf(q) >= levelOf(alpha) + CHALLENGE_LEVEL_EDGE);
  if (!rivals.length || !rng.chance(CHALLENGE_CHANCE)) return;
  const rival = rivals.sort((a, b) => levelOf(b) - levelOf(a))[0];
  p.lastChallenge = s.tick;
  const might = (q: Person) => levelOf(q) * 3 + q.skills.melee.level * 2 + q.hp / 8 + rng.range(0, 12);
  const winner = might(rival) > might(alpha) ? rival : alpha;
  const loser = winner === rival ? alpha : rival;
  loser.hp = Math.max(1, Math.round(maxHp(loser) * 0.25));
  loser.morale = Math.max(0, loser.morale - 15);
  winner.morale = Math.min(100, winner.morale + 10);
  if (winner === rival) {
    s.mainId = rival.id;
    notify(s, `${rival.name} challenged ${alpha.name} for the pack at dawn and won. ${rival.name} is the Alpha now; ${alpha.name} limps off to lick their wounds.`, true);
  } else notify(s, `${rival.name} challenged ${alpha.name} for the pack at dawn and lost. ${alpha.name} is the Alpha still.`, true);
}

/** For the snapshot. */
export interface PackView {
  renown: number;
  hunts: number;
  grounds: number;
  beast: 'due' | 'slain' | 'far';
  packs: { id: string; name: string; alpha: string; broken: boolean }[];
  moon: number;
}
export function packView(s: GameState): PackView | null {
  if (!packOn(s)) return null;
  const p = packState(s);
  return {
    renown: p.renown,
    hunts: p.hunts,
    grounds: p.grounds,
    beast: p.beast === 'slain' ? 'slain' : beastDue(s) ? 'due' : 'far',
    packs: RIVAL_PACKS.map((d) => ({ id: d.id, name: d.name, alpha: d.alpha, broken: p.broken.includes(d.id) })),
    moon: moonPhaseOf(calendar(s.tick).day),
  };
}

