// Classes and levels (see data/classes.ts, data/levels.ts): who is given which class, the level XP that everything
// earns, evolutions, what each class may wear and wield, the allies some bring to a fight, and what they do in raids.

import { ASCEND_DAILY, CLASS_DEFS, CLASSES, className, NECRO_RANGE, STAGE_LEVELS, TAME_EVERY, TAME_RANGE, type ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { FOUNDERS } from '../data/founders';
import { callingName, FOUNDER_CLASS } from '../data/founderClasses';
import { ITEM_BY_ID, type ItemDef } from '../data/items';
import { LEVEL_SHARE_FIGHT, LEVEL_SHARE_WORK, levelOf, MAX_LEVEL, stageOf, xpToLevel } from '../data/levels';
import type { Skill } from '../data/skills';
import { hashSeed, mixSeed, Rng } from '../rng';
import { isBeast, unitFighter, type Fighter } from './combat';
import { isChild } from './social';
import { notify, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_DAY } from './time';

/* ------------------------------------------------------------ who gets which class */

/** How strongly a class draws someone: its rarity, and how good they are at the skills it's drawn to. */
export function classPull(p: Person, cls: ClassId): number {
  const d = CLASS_DEFS[cls];
  const fit = 1 + Object.entries(d.affinity).reduce((n, [k, a]) => n + (a ?? 0) * (p.skills[k as Skill]?.level ?? 0), 0) / 6;
  return d.rarity * fit * fit;
}

/** Give someone their class, once and for life: at random, weighted by classPull (decided by the seed, so a town plays
 *  the same every time). */
export function assignClass(s: GameState, p: Person): ClassId {
  const rng = new Rng(mixSeed(hashSeed(s.seed), p.id * 7907 + 13));
  const pulls = CLASSES.map((c) => classPull(p, c));
  let roll = rng.next() * pulls.reduce((a, b) => a + b, 0);
  let cls: ClassId = CLASSES[0];
  for (let i = 0; i < CLASSES.length; i++) {
    roll -= pulls[i];
    if (roll <= 0) {
      cls = CLASSES[i];
      break;
    }
  }
  p.cls = cls;
  p.level ??= 1;
  p.stageSeen = stageOf(p);
  return cls;
}

/** Someone rises to their class's last stage (from the daily chance, a quest or an event). */
export function ascend(s: GameState, p: Person, why = 'Their power has grown past all measure'): void {
  if (p.ascended || !p.cls) return;
  p.ascended = true;
  p.stageSeen = stageOf(p);
  const name = callingName(p, stageOf(p))!;
  notify(s, `${why}: ${p.name} ascends, and is now ${aCalling(name)}!`, true);
}

/** Every hour: grown-ups without a class are given one (newcomers, the newly grown, towns from before classes), and
 *  those whose class has evolved are announced. */
export function classesHourly(s: GameState): void {
  adoptFounderCalling(s);
  for (const p of s.people) {
    if (isChild(p) || p.away !== null) continue;
    if (!p.cls) {
      const cls = assignClass(s, p);
      const rare = CLASS_DEFS[cls].rarity < 0.25;
      notify(s, `${p.name} is ${/^[AEIOU]/.test(className(cls, 0)) ? 'an' : 'a'} ${className(cls, stageOf(p))}${rare ? ': a rare calling!' : '.'}`, rare);
      continue;
    }
    // (at the last stage's level, each day a small chance to ascend to it: decided by the seed)
    if (!p.ascended && levelOf(p) >= STAGE_LEVELS[4] && s.tick % TICKS_PER_DAY === 0 && new Rng(mixSeed(hashSeed(s.seed), p.id, s.tick)).chance(ASCEND_DAILY)) ascend(s, p);
    const st = stageOf(p);
    if (st > (p.stageSeen ?? 0)) {
      p.stageSeen = st;
      const name = callingName(p, st)!;
      notify(s, `${p.name} has become ${aCalling(name)} (level ${levelOf(p)})!`, true);
    }
  }
}

/** A calling's name with 'a' or 'an' before it ('The Eternal Hearth' as it is). */
export const aCalling = (name: string) => (/^The /.test(name) ? name : `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`);

/** A town founded before founders had callings of their own: its founder (always the first person) takes theirs,
 *  found by their look, keeping their level. */
function adoptFounderCalling(s: GameState): void {
  const p = s.people.find((q) => q.id === 1);
  if (!p || p.fcls !== undefined) return;
  const look = JSON.stringify(p.look);
  const def = Object.values(FOUNDERS).flat().find((f) => JSON.stringify(f.look) === look);
  const calling = def ? FOUNDER_CLASS[def.id] : undefined;
  p.fcls = calling?.id ?? null;
  if (!calling) return;
  p.cls = calling.base;
  p.level ??= 1;
  p.stageSeen = stageOf(p);
}

/* ------------------------------------------------------------ levels */

/** Level XP from skill XP (gainSkill calls it): fighting counts for more than work. */
export function gainLevelXp(p: Person, skill: Skill, xp: number): void {
  if (levelOf(p) >= MAX_LEVEL) return;
  p.lvXp = (p.lvXp ?? 0) + xp * (skill === 'melee' || skill === 'ranged' ? LEVEL_SHARE_FIGHT : LEVEL_SHARE_WORK);
  p.level ??= 1;
  while (p.level < MAX_LEVEL && p.lvXp >= xpToLevel(p.level)) {
    p.lvXp -= xpToLevel(p.level);
    p.level++;
  }
}

/** The share of the way to the next level. */
export const levelProgress = (p: Person) => (levelOf(p) >= MAX_LEVEL ? 1 : Math.min(1, (p.lvXp ?? 0) / xpToLevel(levelOf(p))));

/* ------------------------------------------------------------ gear by class */

/** Whether someone's class lets them wear or wield a piece: weapons by family, armour by weight (tools, torches,
 *  cloaks and charms, and anyone without a class yet: anything). */
export function canWear(p: Pick<Person, 'cls'>, def: ItemDef | string): boolean {
  const d = typeof def === 'string' ? ITEM_BY_ID[def] : def;
  if (!p.cls || !d) return true;
  const c = CLASS_DEFS[p.cls];
  if (d.slot === 'weapon' && d.family) return c.weapons.includes(d.family);
  if (d.weight && d.weight !== 'trinket') return c.armour.includes(d.weight);
  return true;
}

/** Allies a party brings into a battle: a Summoner's spirit, a Beast Tamer's wolf. */
export function classAllies(members: Person[]): Fighter[] {
  const out: Fighter[] = [];
  for (const p of members) {
    if (p.hp <= 0 || p.downed) continue;
    if (p.cls === 'summoner') out.push(unitFighter('spirit', 'party', -p.id * 10 - 1));
    if (p.cls === 'beast_tamer') out.push(unitFighter('companion_wolf', 'party', -p.id * 10 - 2));
  }
  return out;
}

/* ------------------------------------------------------------ raids at home */

const inTown = (s: GameState, cls: ClassId) => s.people.filter((p) => p.cls === cls && p.away === null && !p.downed);

/** An ally raider (summoned, raised or tamed) next to x. */
export function ally(s: GameState, kind: string, x: number, dir: 1 | -1): Raider {
  const d = ENEMIES[kind];
  return { id: s.nextId++, kind, x, dir, hp: d.hp, maxHp: d.hp, cooldown: 5, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm', ally: true, conjuredAt: s.tick };
}

/** When raiders arrive: each Summoner in town calls a spirit; each Necromancer calls one of the town's own dead up
 *  out of the graveyard (while there are graves to call on). */
export function summonForRaid(s: GameState, r: Raid): void {
  for (const p of inTown(s, 'summoner')) r.raiders.push(ally(s, 'spirit', p.x, p.dir));
  if (inTown(s, 'summoner').length) notify(s, 'Spirits answer the summoner\'s call!');
  const yard = s.buildings.find((b) => b.def === 'graveyard' && b.status === 'done');
  const graves = s.graves ?? [];
  if (!yard || !graves.length) return;
  const necros = inTown(s, 'necromancer').slice(0, graves.length);
  necros.forEach((p, i) => {
    const g = graves[graves.length - 1 - i];
    const ghost = ally(s, 'grave_ghost', g.x, p.dir);
    ghost.risenFrom = g.name;
    r.raiders.push(ghost);
  });
  if (necros.length) notify(s, `The necromancer calls on the graveyard: ${necros.map((_, i) => graves[graves.length - 1 - i].name).join(' and ')} ${necros.length === 1 ? 'rises' : 'rise'} to defend the town once more.`, true);
}

/** Every tick of a raid: Necromancers raise the fallen, Beast Tamers win over wild beasts. */
export function classesInRaid(s: GameState, r: Raid): void {
  const necros = inTown(s, 'necromancer');
  if (necros.length) {
    for (const rd of r.raiders) {
      if (!rd.down || rd.ally || rd.raiseChecked) continue;
      rd.raiseChecked = true;
      if ((r.raised ?? 0) >= necros.length * 2) continue;
      if (!necros.some((p) => Math.abs(p.x - rd.x) <= NECRO_RANGE)) continue;
      if (rd.risenFrom) continue; // (the townsfolk the dead took stay at rest)
      rd.down = false;
      rd.ally = true;
      rd.hp = Math.round(rd.maxHp / 2);
      rd.fleeing = false;
      rd.carrying = {};
      rd.conjuredAt = s.tick;
      r.raised = (r.raised ?? 0) + 1;
      notify(s, `The necromancer raises the fallen ${ENEMIES[rd.kind].name.toLowerCase()} to fight for the town!`);
    }
  }
  const tamers = inTown(s, 'beast_tamer');
  if (tamers.length && s.tick >= (r.nextTame ?? 0)) {
    for (const p of tamers) {
      const beast = r.raiders.find((rd) => !rd.down && !rd.gone && !rd.ally && isBeast(rd.kind) && !ENEMIES[rd.kind].boss && Math.abs(rd.x - p.x) <= TAME_RANGE);
      if (!beast) continue;
      beast.ally = true;
      beast.fleeing = false;
      beast.conjuredAt = s.tick;
      r.nextTame = s.tick + TAME_EVERY * TICK_HZ;
      notify(s, `${p.name} tames the ${ENEMIES[beast.kind].name.toLowerCase()}: it turns on the others!`);
    }
  }
}
