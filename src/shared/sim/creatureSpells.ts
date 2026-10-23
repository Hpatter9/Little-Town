// The God creature's spells (the owner's ask: it learns spells by its nature, or from watching the townsfolk use them;
// "a curious thing, always learning and adapting"). The numbers and the list are in data/creatureSpells.ts.
//  - By its nature (`learnByNature`, hourly): a good beast comes to heal, call rain on the fields and raise a shield; a
//    cruel one to terrify, hurl fire and call lightning, each at its rating (`NATURE_SPELLS`). Once known, it keeps it.
//  - By watching (`creatureWatches`): a townsperson's spell cast within its sight (on the raid board, in a party's
//    fight, or practised in the town: `watchInTown`) is counted (`seen`), and learned at a chance that grows each time
//    it has seen it, by its kind's knack for learning, and less for a great spell.
//  - It gets better at what it uses (`skill`, by `PRACTICE` a cast): its spells hit harder and its miracles do more.
//  - It casts them: in the town as a deed (`miracle`, the miracle move: `workMiracle`), in raids on the board and in a
//    party's fights (`creatureKit`: its spells as a kit, weaker than a caster's by `spellPower` and slower by
//    `SPELL_SLOW`, so it is strong but does not win the fight alone).
// Every roll is from its own side stream (`${seed}:creature:${tick}:...`).

import { CREATURE_DEFS } from '../data/creature';
import { CRUEL_MAGIC, FIRST_SKILL, LEVEL_HARD, MIRACLE_GAP_HOURS, NATURE_SKILL, NATURE_SPELLS, PRACTICE, PRACTISE_SEEN, SEEN_BONUS, SIGHT_CELLS, SPELLS_MOST, SPELL_SLOW, TOWN_ALIGN, WATCH_LEARN, WATCH_MOST, natureReaches, spellPower, townMagicOf, type TownMagic } from '../data/creatureSpells';
import { levelOf } from '../data/levels';
import { SPELL_BY_ID, spellsKnown } from '../data/spells';
import { hashSeed, Rng } from '../rng';
import type { Kit, KitAction } from './actions';
import { depositNear } from './buildings';
import { remember, type CreatureState } from './creature';
import { cropOf, isField } from './farming';
import { flammable, setFire } from './fire';
import { castsMagic } from '../data/classes';
import { isChild } from './social';
import { campXY, maxHp, notify, type GameState, type Person } from './state';
import { TICK_HZ, TICKS_PER_HOUR } from './time';
import { CELL } from './land';

/** A spell it knows: how well it casts it (0 to 1), how often it has, and how it came by it. */
export interface CreatureSpell {
  skill: number;
  uses: number;
  /** "its nature", or "watching <name>". */
  from: string;
  /** When it learned it (tick). */
  at: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const rngOf = (s: GameState, salt: string) => new Rng(hashSeed(`${s.seed}:creature:${s.tick}:${salt}`));
const nameOf = (id: string) => SPELL_BY_ID[id]?.name ?? id;

/** Whether it knows a spell. */
export const knows = (c: CreatureState, id: string) => !!c.spells?.[id];

/** It learns a spell (making room by forgetting the least used, never one of its nature's). True if it was new. */
export function learnSpell(s: GameState, c: CreatureState, id: string, from: string, skill: number): boolean {
  if (!SPELL_BY_ID[id] || knows(c, id)) return false;
  const spells = (c.spells ??= {});
  const ids = Object.keys(spells);
  if (ids.length >= SPELLS_MOST) {
    const nature = new Set(NATURE_SPELLS.map((n) => n.id));
    const least = ids.filter((k) => !nature.has(k)).sort((a, b) => spells[a].uses - spells[b].uses)[0];
    if (!least) return false;
    delete spells[least];
  }
  spells[id] = { skill, uses: 0, from, at: s.tick };
  return true;
}

/** Hourly: its nature brings it the miracles of its side once its rating reaches them. */
export function learnByNature(s: GameState, c: CreatureState): void {
  for (const n of NATURE_SPELLS) {
    if (!natureReaches(n, c.align) || knows(c, n.id)) continue;
    if (!learnSpell(s, c, n.id, 'its nature', NATURE_SKILL)) continue;
    const text = `${c.name} has found a new power in itself: ${nameOf(n.id)}.`;
    remember(s, c, text);
    notify(s, text, true);
  }
}

/** It sees a spell cast (by `who`): counted, and learned at a chance (true when it was learned just now). */
export function creatureWatches(s: GameState, c: CreatureState, id: string, who: string): boolean {
  const d = SPELL_BY_ID[id];
  if (!d || c.dead) return false;
  const seen = (c.seen ??= {});
  const before = seen[id] ?? 0;
  seen[id] = before + 1;
  if (knows(c, id)) return false;
  const chance = Math.min(WATCH_MOST, WATCH_LEARN * CREATURE_DEFS[c.kind].learn * (1 + SEEN_BONUS * before)) * Math.max(0.2, 1 - d.level / LEVEL_HARD);
  if (!rngOf(s, `watch:${id}:${who}`).chance(chance)) return false;
  if (!learnSpell(s, c, id, `watching ${who}`, FIRST_SKILL)) return false;
  const text = `${c.name} watched ${who} cast ${d.name}, and has learned it!`;
  remember(s, c, text);
  notify(s, text, true);
  return true;
}

/** Hourly: a caster at home within its sight practises their craft, and it watches (a chance an hour each). */
export function watchInTown(s: GameState, c: CreatureState): void {
  const near = s.people.filter((p) => p.away === null && !p.downed && castsMagic(p.cls) && Math.hypot(p.x - c.x, p.y - c.y) <= SIGHT_CELLS * CELL);
  for (const p of near) {
    const rng = rngOf(s, `practise:${p.id}`);
    if (!rng.chance(PRACTISE_SEEN)) continue;
    const known = [...spellsKnown(p.cls, levelOf(p)), ...(p.arcana?.spells ?? []).map((id) => SPELL_BY_ID[id]).filter((x) => !!x)];
    if (!known.length) continue;
    creatureWatches(s, c, rng.pick(known).id, p.name);
  }
}

/** It used a spell: it gets better at it. */
export function practise(c: CreatureState, id: string): void {
  const sp = c.spells?.[id];
  if (!sp) return;
  sp.uses++;
  sp.skill = Math.min(1, sp.skill + PRACTICE);
}

/** Its spells as a fight's kit (the raid board, a party's fights): each a little weaker than a caster's, by how well
 *  it has them, and slower to come round. Undefined when it knows none. */
export function creatureKit(c: CreatureState): Kit | undefined {
  const ids = Object.keys(c.spells ?? {}).filter((id) => SPELL_BY_ID[id]);
  if (!ids.length) return undefined;
  const actions: KitAction[] = ids.map((id) => {
    const d = SPELL_BY_ID[id];
    const k = spellPower(c.spells![id].skill);
    const effects = d.effects.map((e) => (e.kind === 'damage' || e.kind === 'heal' || e.kind === 'drain' ? { ...e, power: (e.power ?? 1) * k } : e));
    return { id, name: d.name, spell: true, level: d.level, cooldown: Math.round(d.cooldown * SPELL_SLOW * TICK_HZ), ready: 0, effects, use: d.use, cost: 0, pool: 'mp' };
  });
  return { actions, passive: { damage: 0, power: 0, healing: 0, crit: 0, critDamage: 0, counter: 0, lifesteal: 0, thorns: 0, guard: 0, resist: 0, regen: 0, lastStand: 0, firstStrike: false } };
}

/** What it would work in the town now, and on whom: the spell it knows that has something to do, best first by its
 *  mood (a cruel spell only when it is angry or cruel at heart). Null: nothing to do with its magic this hour. */
export function miracleFor(s: GameState, c: CreatureState, angry: boolean): { id: string; magic: TownMagic; on?: Person } | null {
  if (!c.spells || s.tick - (c.castAt ?? -Infinity) < MIRACLE_GAP_HOURS * TICKS_PER_HOUR) return null;
  const home = s.people.filter((p) => p.away === null && !p.downed);
  const founder = home.find((p) => p.id === s.mainId);
  const hurt = [...(founder ? [founder] : []), ...home].find((p) => p.hp < maxHp(p) * 0.7);
  const growing = s.buildings.some((b) => isField(b) && cropOf(b).stage === 'growing');
  const victims = home.filter((p) => p.id !== s.mainId && !isChild(p));
  const ids = Object.keys(c.spells).sort((a, b) => c.spells![b].skill - c.spells![a].skill);
  for (const id of ids) {
    const magic = townMagicOf(id);
    if (CRUEL_MAGIC.has(magic) && !angry && c.align > -40) continue;
    if (magic === 'heal' && hurt) return { id, magic, on: hurt };
    if (magic === 'rain' && growing) return { id, magic };
    if ((magic === 'terror' || magic === 'lightning') && victims.length) return { id, magic, on: victims[Math.floor(s.tick / TICKS_PER_HOUR) % victims.length] };
    if (magic === 'shield' || magic === 'bless' || magic === 'hunt' || magic === 'fire' || magic === 'show') return { id, magic };
  }
  return null;
}

/** It works a spell in the town (the `miracle` deed): what it does, told. Its nature moves by the spell. */
export function workMiracle(s: GameState, c: CreatureState, m: { id: string; magic: TownMagic; on?: Person }, rng: Rng): string {
  const skill = c.spells?.[m.id]?.skill ?? FIRST_SKILL;
  const k = 0.5 + skill;
  const name = nameOf(m.id);
  const home = s.people.filter((p) => p.away === null && !p.downed);
  c.castAt = s.tick;
  practise(c, m.id);
  c.align = clamp(c.align + TOWN_ALIGN[m.magic], -100, 100);
  switch (m.magic) {
    case 'heal':
      if (m.on) m.on.hp = Math.min(maxHp(m.on), m.on.hp + Math.round(maxHp(m.on) * 0.25 * k));
      return m.on ? `cast ${name} on ${m.on.name}, and their wounds closed` : `cast ${name}`;
    case 'rain':
      for (const b of s.buildings) if (isField(b) && cropOf(b).stage === 'growing') cropOf(b).growth = Math.min(0.999, cropOf(b).growth + 0.06 * k);
      return `called ${name} down on the fields`;
    case 'shield':
      for (const p of home) p.morale = clamp(p.morale + 3);
      return `raised ${name} over the town, shining`;
    case 'bless':
      for (const p of home) if (Math.hypot(p.x - c.x, p.y - c.y) < SIGHT_CELLS * CELL) p.morale = clamp(p.morale + 2);
      return `cast ${name} over the folk about it`;
    case 'show':
      for (const p of home) if (isChild(p)) p.morale = clamp(p.morale + 5);
      c.play = clamp(c.play + 15);
      return `cast ${name} for the children, who shrieked with delight`;
    case 'hunt': {
      const n = Math.max(1, Math.round(2 * k));
      depositNear(s, campXY(s), { meat: n });
      return `brought down game in the wild with ${name}`;
    }
    case 'terror':
      if (m.on) m.on.morale = clamp(m.on.morale - 15);
      for (const p of home) if (p !== m.on) p.morale = clamp(p.morale - 2);
      return m.on ? `cast ${name} on ${m.on.name}, who fled screaming` : `cast ${name}`;
    case 'lightning':
      if (m.on) m.on.hp = Math.max(1, m.on.hp - Math.round(maxHp(m.on) * 0.3 * k));
      return m.on ? `called ${name} down on ${m.on.name}` : `called ${name} down`;
    case 'fire': {
      // (in a rage it sets a building alight; else it scorches a field)
      const angry = c.anger >= 50;
      const blds = s.buildings.filter((b) => b.status === 'done' && flammable(b));
      if (angry && blds.length) {
        const b = rng.pick(blds);
        setFire(s, b, true);
        return `hurled ${name} into the town, and set it alight`;
      }
      const field = s.buildings.find((b) => isField(b) && cropOf(b).stage === 'growing');
      if (field) cropOf(field).growth = Math.max(0, cropOf(field).growth - 0.5);
      return field ? `scorched a field with ${name}` : `hurled ${name} at the sky`;
    }
  }
}

/** Its spells for its card: each, how well it has it, and how it came by it, best first; and what it has seen but not
 *  learned yet (times seen). */
export function spellsSeen(c: CreatureState): { known: { id: string; name: string; skill: number; uses: number; from: string }[]; learning: { name: string; seen: number }[] } {
  const known = Object.entries(c.spells ?? {})
    .filter(([id]) => SPELL_BY_ID[id])
    .sort((a, b) => b[1].skill - a[1].skill)
    .map(([id, sp]) => ({ id, name: nameOf(id), skill: Math.round(sp.skill * 100) / 100, uses: sp.uses, from: sp.from }));
  const learning = Object.entries(c.seen ?? {})
    .filter(([id]) => !knows(c, id) && SPELL_BY_ID[id])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, n]) => ({ name: nameOf(id), seen: n }));
  return { known, learning };
}
