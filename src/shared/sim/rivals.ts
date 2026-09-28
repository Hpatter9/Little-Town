// Rival origins in a raid (data/rivals.ts): the lord at the head of a rival army casts its origin's spells against
// the town every few seconds: draining and storming the townsfolk, raising and mending its own, and hexing the
// defenders (held, fogged, an EMP) or blessing its army (frenzied, warded). raids.ts reads the hexes.

import { WORLD_WIDTH } from '../constants';
import { BUILDING_BY_ID } from '../data/buildings';
import { ENEMIES } from '../data/enemies';
import { FOG_AIM, FRENZY, HOLD_LOSS, RIVAL_HP_BASE, RIVAL_HP_PER_DAY, rivalOfLeader, WARD, type RivalSpell, type RivalSpellKind } from '../data/rivals';
import type { Rng } from '../rng';
import { buildingCentreX, defOf } from './buildings';
import { flammable, setFire } from './fire';
import { knockDown } from './health';
import { guardRate } from './origin';
import { notify, personFx, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_DAY } from './time';

/** The hexes and blessings a lord can lay on a fight. */
export type HexKind = Extract<RivalSpellKind, 'hold' | 'fog' | 'emp' | 'frenzy' | 'ward'>;
const HEXES: readonly RivalSpellKind[] = ['hold', 'fog', 'emp', 'frenzy', 'ward'];

/** Raiders on the field at once, at most (a lord stops summoning past this). */
const MAX_ON_FIELD = 12;
/** Seconds before a lord's first spell, and between its spells' first casts. */
const FIRST_CAST = 4;
const STAGGER = 5;
/** A raging lord casts this much more often. */
const RAGE_CASTING = 0.7;

export function hexOn(s: GameState, kind: HexKind): boolean {
  return (s.raid?.phase === 'active' && (s.raid.hex?.[kind]?.until ?? -1) > s.tick) || false;
}

/** A defender held by a hex loses their strike (a machine in an EMP always does). */
export function heldBack(s: GameState, p: Person, rng: Rng): boolean {
  if (p.machine && hexOn(s, 'emp')) return true;
  return hexOn(s, 'hold') && rng.chance(HOLD_LOSS);
}
/** Taken off a defender's (or a turret's) aim in a fog. */
export const fogAim = (s: GameState) => (hexOn(s, 'fog') ? FOG_AIM : 0);
/** What raiders are hit for, while warded; how hard and fast they strike, while frenzied. */
export const wardOf = (s: GameState) => (hexOn(s, 'ward') ? WARD : 1);
export const frenzyOf = (s: GameState) => (hexOn(s, 'frenzy') ? FRENZY : 1);
/** Turrets and traps fall silent in an EMP. */
export const turretsDown = (s: GameState) => hexOn(s, 'emp');

/** A rival lord's health, grown with the days (set when the raid is gathered). */
export const lordHp = (s: GameState, kind: string) => Math.round(ENEMIES[kind].hp * (RIVAL_HP_BASE + (s.tick / TICKS_PER_DAY) * RIVAL_HP_PER_DAY));

/** The townsfolk a spell can reach: in town, standing, not hidden in bed. */
const standing = (s: GameState) => s.people.filter((p) => p.away === null && !p.downed && !((p.task?.type === 'shelter' || p.task?.type === 'sleep') && p.bed !== null && p.activity === 'sleep'));
const onField = (rd: Raider) => !rd.down && !rd.gone && !rd.ally;
const onMap = (rd: Raider) => rd.x >= 0 && rd.x <= WORLD_WIDTH;

function hurt(s: GameState, p: Person, dmg: number): number {
  const d = Math.max(1, Math.round(dmg * guardRate(s)));
  p.hp = Math.max(0, p.hp - d);
  if (p.hp === 0) {
    knockDown(s, p);
    notify(s, `${p.name} was struck down!`);
  }
  return d;
}

/** Cast one spell; false if there was nothing for it to do (it'll try again shortly). */
function cast(s: GameState, r: Raid, rd: Raider, sp: RivalSpell, rng: Rng): boolean {
  switch (sp.kind) {
    case 'drain': {
      const near = standing(s)
        .sort((a, b) => Math.abs(a.x - rd.x) - Math.abs(b.x - rd.x))
        .slice(0, 2);
      if (!near.length) return false;
      let took = 0;
      for (const p of near) {
        took += hurt(s, p, sp.power);
        personFx(s, p.id, 'vampire');
      }
      rd.hp = Math.min(rd.maxHp, rd.hp + took);
      return true;
    }
    case 'storm': {
      const all = standing(s);
      if (!all.length) return false;
      for (let i = 0; i < 3 && all.length; i++) hurt(s, all.splice(rng.int(0, all.length - 1), 1)[0], sp.power);
      if (sp.burns && !s.buildings.some((b) => b.def === 'shield_generator' && b.status === 'done')) {
        const b = s.buildings
          .filter((q) => q.status === 'done' && q.fire === undefined && !defOf(q).hp && flammable(q))
          .sort((a, c) => Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(c) - rd.x))[0];
        if (b && rng.chance(0.5)) setFire(s, b);
      }
      return true;
    }
    case 'raise': {
      const fallen = r.raiders.filter((q) => q.down && !q.ally && !q.gone && !ENEMIES[q.kind].kit && !q.raiseChecked).slice(0, sp.power);
      if (!fallen.length) return false;
      for (const q of fallen) {
        q.down = false;
        q.fleeing = false;
        q.hp = Math.round(q.maxHp / 2);
        q.conjuredAt = s.tick;
      }
      return true;
    }
    case 'mend': {
      const hurtOnes = r.raiders.filter((q) => onField(q) && q.hp < q.maxHp * 0.85);
      if (!hurtOnes.length) return false;
      for (const q of hurtOnes) {
        q.hp = Math.min(q.maxHp, q.hp + Math.round(q.maxHp * sp.power));
        q.conjuredAt = s.tick;
      }
      return true;
    }
    case 'summon': {
      if (r.raiders.filter(onField).length >= MAX_ON_FIELD || !sp.summons) return false;
      const d = ENEMIES[sp.summons];
      for (let i = 0; i < sp.power; i++) {
        r.raiders.push({ id: s.nextId++, kind: sp.summons, x: rd.x - rd.dir * (24 + i * 16), dir: rd.dir, hp: d.hp, maxHp: d.hp, cooldown: 10, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm', conjuredAt: s.tick });
      }
      return true;
    }
    case 'hold':
    case 'fog':
    case 'emp': {
      // (only worth it with defenders out)
      const defenders = s.people.filter((p) => p.away === null && !p.downed && p.task?.type === 'defend');
      const turrets = sp.kind === 'emp' && s.buildings.some((b) => b.status === 'done' && BUILDING_BY_ID[b.def]?.defense);
      if (!defenders.length && !turrets) return false;
      (r.hex ??= {})[sp.kind] = { until: s.tick + sp.power * TICK_HZ, name: sp.name };
      for (const p of defenders) if (sp.kind !== 'emp' || p.machine) personFx(s, p.id, 'frost');
      return true;
    }
    case 'frenzy':
    case 'ward':
      (r.hex ??= {})[sp.kind] = { until: s.tick + sp.power * TICK_HZ, name: sp.name };
      return true;
    case 'dread': {
      const all = s.people.filter((p) => p.away === null);
      if (!all.length) return false;
      for (const p of all) p.morale = Math.max(0, p.morale - sp.power);
      return true;
    }
    case 'shatter': {
      const wall = s.buildings
        .filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def].hp && (b.hp ?? 0) > 0)
        .sort((a, b) => Math.abs(buildingCentreX(a) - rd.x) - Math.abs(buildingCentreX(b) - rd.x))[0];
      if (!wall) return false;
      wall.hp = Math.max(0, (wall.hp ?? 0) - sp.power);
      if (wall.hp === 0) {
        s.buildings = s.buildings.filter((b) => b !== wall);
        notify(s, `The ${defOf(wall).name.toLowerCase()} came down!`, true);
      }
      return true;
    }
    case 'plunder': {
      const n = Math.floor((s.coins ?? 0) * sp.power);
      if (n < 3) return false;
      s.coins = (s.coins ?? 0) - n;
      notify(s, `They made off with ${n} coins.`, true);
      return true;
    }
  }
}

/** Every tick of a raid: each rival lord on the map casts whatever spell is ready (one at a time). */
export function rivalsInRaid(s: GameState, r: Raid, rng: Rng): void {
  if (r.phase !== 'active') return;
  for (const rd of r.raiders) {
    if (!onField(rd) || rd.fleeing || !onMap(rd)) continue;
    const rival = rivalOfLeader(rd.kind);
    if (!rival) continue;
    const at = (rd.spellAt ??= {});
    for (const [i, sp] of rival.spells.entries()) {
      if (at[sp.id] === undefined) {
        at[sp.id] = s.tick + (FIRST_CAST + i * STAGGER) * TICK_HZ;
        continue;
      }
      if (s.tick < at[sp.id]) continue;
      if (!cast(s, r, rd, sp, rng)) {
        at[sp.id] = s.tick + 2 * TICK_HZ;
        continue;
      }
      at[sp.id] = s.tick + Math.round(sp.every * TICK_HZ * (rd.enraged ? RAGE_CASTING : 1));
      rd.lastCast = s.tick;
      notify(s, sp.text, HEXES.includes(sp.kind) || sp.kind === 'raise' || sp.kind === 'summon');
      break;
    }
  }
}

/** The hexes and blessings on the fight right now, for the HUD. */
export function hexesNow(s: GameState): { kind: HexKind; name: string; seconds: number }[] {
  const h = s.raid?.phase === 'active' ? s.raid.hex : undefined;
  if (!h) return [];
  return (Object.entries(h) as [HexKind, { until: number; name: string }][]).filter(([, v]) => v.until > s.tick).map(([kind, v]) => ({ kind, name: v.name, seconds: Math.ceil((v.until - s.tick) / TICK_HZ) }));
}
