// The God creature and the townsfolk (the owner's ask: "They need to be able to interact with the townsfolk in many
// ways. Playing, helping, going on adventures with them if the creature decides it likes adventures. He prioritizes the
// founder though."). Its likings (play, work, adventure, magic: data/creature.ts `CREATURE_LIKINGS`) are its own: they
// start from its kind and a roll, drift with what it does while it is content, and the player may nudge one gently,
// never order it (`nudgeLiking`). It grows fond of whom it plays with, helps and heals (`fond`), the founder most.
// It goes with a party (`joinAdventures`): the founder's whenever it can (unless it has come to shun adventure), anyone
// else's only once it likes adventure. Away, it is off the map; in the party's fights it is one of them, with its
// spells (`creatureFighter`, `creatureBattleOver`), and it watches the casters (`watchBattle`). It comes home with the
// party (`creatureAwayTick`). Every roll is from its own side stream.

import { ADVENTURE_LIKE, ADVENTURE_SHUN, CREATURE_DEFS, CREATURE_LIKINGS, JOIN_CHANCE, KIND_LIKES, LIKE_DRIFT, LIKING_NAMES, NUDGE, NUDGE_HOURS, RAID_DEATH, creatureUnit, type CreatureDeed, type CreatureLiking } from '../data/creature';
import { SPELL_BY_NAME } from '../data/creatureSpells';
import { hashSeed, Rng } from '../rng';
import { unitFighter, type Battle, type Fighter } from './combat';
import { creatureAttack, creatureDies, creatureMaxHp, creatureOf, remember, type CreatureState } from './creature';
import { creatureKit, creatureWatches } from './creatureSpells';
import { CELL } from './land';
import { campXY, notify, type Expedition, type GameState } from './state';
import { TICKS_PER_HOUR } from './time';

const clamp = (n: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, n));
const rngOf = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:creature:${s.tick}:${salt}`));
/** The ref its fighter carries in a party's fight (no person's id is below zero). */
export const CREATURE_REF = -700000;

/** Its likings to begin with: its kind's, and a little of its own. */
export function startLikes(s: GameState, c: CreatureState): void {
  const rng = rngOf(s, 'likes');
  c.likes = {};
  for (const l of CREATURE_LIKINGS) c.likes[l] = Math.round(clamp(KIND_LIKES[c.kind][l] + (rng.next() - 0.5) * 0.3) * 100) / 100;
}

/** How much it likes something now (-1 to 1); an old save's beast has its kind's. */
export const likeOf = (c: CreatureState, l: CreatureLiking): number => c.likes?.[l] ?? KIND_LIKES[c.kind][l];

/** The liking a deed feeds. */
export function likingOf(d: CreatureDeed): CreatureLiking | null {
  if (d === 'play' || d === 'follow') return 'play';
  if (d === 'haul' || d === 'build' || d === 'farm' || d === 'guard' || d === 'hunt') return 'work';
  if (d === 'miracle') return 'magic';
  if (d === 'fight') return 'adventure';
  return null;
}

/** What it does while content, it comes to like a little more; what it is made to do while miserable, a little less. */
export function driftLike(c: CreatureState, l: CreatureLiking, happy: boolean): void {
  (c.likes ??= { ...KIND_LIKES[c.kind] })[l] = Math.round(clamp(likeOf(c, l) + (happy ? LIKE_DRIFT : -LIKE_DRIFT / 2)) * 1000) / 1000;
}

/** The player encourages (up) or discourages a liking: a gentle nudge, once in a while. A quick-tempered beast takes a
 *  nudge against its grain only half as well. Returns why not, or null. */
export function nudgeLiking(s: GameState, l: CreatureLiking, up: boolean): string | null {
  const c = creatureOf(s);
  if (!c || c.away) return c?.away ? `${c.name} is away` : 'There is no God creature';
  if (!CREATURE_LIKINGS.includes(l)) return 'No such liking';
  if (c.nudged !== undefined && s.tick - c.nudged < NUDGE_HOURS * TICKS_PER_HOUR) return `${c.name} has had enough coaxing for now`;
  const against = up ? likeOf(c, l) < 0 : likeOf(c, l) > 0;
  const step = NUDGE * (against ? 1 - CREATURE_DEFS[c.kind].temper / 2 : 1);
  (c.likes ??= { ...KIND_LIKES[c.kind] })[l] = Math.round(clamp(likeOf(c, l) + (up ? step : -step)) * 1000) / 1000;
  c.nudged = s.tick;
  notify(s, up ? `${c.name} is coaxed toward ${LIKING_NAMES[l].toLowerCase()}.` : `${c.name} is steered away from ${LIKING_NAMES[l].toLowerCase()}.`);
  return null;
}

/** It grows fond of someone (by `n`; the founder's ties count double). Only the dozen it cares for most are kept. */
export function befriend(s: GameState, c: CreatureState, id: number, n: number): void {
  const fond = (c.fond ??= {});
  fond[id] = Math.min(100, (fond[id] ?? 0) + n * (id === s.mainId ? 2 : 1));
  const ids = Object.keys(fond).map(Number);
  if (ids.length > 12) delete fond[ids.sort((a, b) => fond[a] - fond[b])[0]];
}

/** Its favourites, most loved first (names, of the living). */
export function favourites(s: GameState, c: CreatureState, n = 3): string[] {
  return Object.entries(c.fond ?? {})
    .map(([id, f]) => ({ p: s.people.find((q) => q.id === Number(id)), f }))
    .filter((x) => x.p && x.f >= 3)
    .sort((a, b) => b.f - a.f)
    .slice(0, n)
    .map((x) => x.p!.name);
}

/* ------------------------------------------------------------ adventures */

/** Can it go just now: alive, at home, awake, grown enough and not badly hurt. */
const canGo = (s: GameState, c: CreatureState) => !c.away && !c.dead && c.size >= 0.2 && c.hp >= creatureMaxHp(c) * 0.5 && !(c.doing === 'sleep' && s.tick < c.until);

/** Hourly: a party just out of the gate. It goes with the founder's whenever it can (unless it shuns adventure), with
 *  another only if it likes adventure, at a chance. True if it went. */
export function joinAdventures(s: GameState, c: CreatureState): boolean {
  if (!canGo(s, c) || s.raid) return false;
  const fresh = s.expeditions.filter((e) => e.phase === 'out' && e.elapsed < 2 * TICKS_PER_HOUR && !e.recalled);
  const founders = fresh.find((e) => e.members.includes(s.mainId));
  const like = likeOf(c, 'adventure');
  let go: Expedition | undefined;
  if (founders && like > ADVENTURE_SHUN) go = founders;
  else if (!founders && like >= ADVENTURE_LIKE && fresh.length && rngOf(s, 'join').chance(JOIN_CHANCE * (0.5 + like))) go = fresh[0];
  if (!go) return false;
  const lead = s.people.find((p) => p.id === (go.leader ?? go.members[0]));
  c.away = { expedition: go.id, founder: go === founders, since: s.tick, dest: go.dest };
  c.doing = 'wander';
  c.goal = undefined;
  c.path = undefined;
  c.ask = undefined;
  const text = go === founders ? `${c.name} would not be left behind: it goes with ${lead?.name ?? 'the founder'}'s party.` : `${c.name} bounds after ${lead?.name ?? 'a'}'s party: it has a taste for adventure.`;
  remember(s, c, text);
  notify(s, text, true);
  return true;
}

/** Every tick while it is away: once its party is home (or lost), it comes home too. */
export function creatureAwayTick(s: GameState, c: CreatureState): void {
  const a = c.away;
  if (!a || s.expeditions.some((e) => e.id === a.expedition)) return;
  c.away = undefined;
  const at = campXY(s);
  c.x = at.x + CELL * 2;
  c.y = at.y + CELL;
  c.path = undefined;
  c.goal = undefined;
  c.until = s.tick;
  c.play = Math.min(100, c.play + 25);
  driftLike(c, 'adventure', c.hp >= creatureMaxHp(c) * 0.5);
  if (a.founder) befriend(s, c, s.mainId, 4);
  const text = `${c.name} is home from the road${c.hp < creatureMaxHp(c) * 0.5 ? ', limping' : ''}.`;
  remember(s, c, text);
  notify(s, text);
}

/** Its fighter in a party's fight, if it went with the party: as big and strong as it is grown, with its spells. */
export function creatureFighter(s: GameState, e: Expedition): Fighter | null {
  const c = creatureOf(s);
  if (!c || c.away?.expedition !== e.id) return null;
  const f = unitFighter(creatureUnit(c.kind), 'party', CREATURE_REF);
  f.name = c.name;
  f.maxHp = creatureMaxHp(c);
  f.hp = Math.max(1, Math.round(c.hp));
  const blow = creatureAttack(c);
  f.damage = [Math.round(blow * 0.7), Math.round(blow * 1.2)];
  f.kit = creatureKit(c);
  f.cooldown = f.interval;
  return f;
}

/** A party's fight over: it keeps the health the fight left it; beaten down it may die (`RAID_DEATH`), else limps on. */
export function creatureBattleOver(s: GameState, e: Expedition, b: Battle): void {
  const c = creatureOf(s);
  const f = b.fighters.find((x) => x.ref === CREATURE_REF);
  if (!c || !f || c.away?.expedition !== e.id) return;
  for (const a of b.acts ?? []) if (a.ref === CREATURE_REF && SPELL_BY_NAME[a.name] && c.spells?.[SPELL_BY_NAME[a.name].id]) c.spells[SPELL_BY_NAME[a.name].id].uses++;
  (c.done.fight = (c.done.fight ?? 0) + 1);
  if (f.down || f.hp <= 0) {
    if (rngOf(s, `fell:${e.id}`).chance(RAID_DEATH)) return creatureDies(s, c, 'killed on the road');
    c.hp = Math.max(1, Math.round(creatureMaxHp(c) * 0.15));
    c.fear = Math.min(100, c.fear + 30);
    return;
  }
  c.hp = Math.max(1, Math.min(creatureMaxHp(c), Math.round(f.hp)));
  // (a fight's wins make it bolder, and fonder of the road)
  driftLike(c, 'adventure', b.outcome === 'won');
}

/** After each beat of a party's fight it is in: the spells the party's own cast, it watches. */
export function watchBattle(s: GameState, e: Expedition, b: Battle): void {
  const c = creatureOf(s);
  if (!c || c.away?.expedition !== e.id) return;
  for (const a of b.acts ?? []) {
    if (a.tick !== b.tick || a.side !== 'party' || a.ref < 0 || !a.meta?.spell) continue;
    const d = SPELL_BY_NAME[a.name];
    const p = s.people.find((q) => q.id === a.ref);
    if (d && p) creatureWatches(s, c, d.id, p.name);
  }
}
