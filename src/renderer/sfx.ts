// What the town sounds like from one snapshot to the next (the owner's asks: many more sound effects, and building,
// fighting and such that match what's seen). Pure: compares the last snapshot with the new one and says which cues
// (ambience.ts) to play, where across the screen, and when.
//
// - The town on the map (`soundsBetween`): every blow by the weapon in hand (`weaponCue`: a sword's swish, a mace's
//   knock, a spear's thrust, a bow, a crossbow, a gun, a staff's zap), a raider's by what it is (`foeCue`: a beast
//   bites), shields turning blows, the fallen, the towers loosing, spells, and the work in view (`workSounds`: the
//   axe, the pick, the builder's hammer, and at a station its own trade (`stationCue`): the anvil, the saw, the loom,
//   the cook's knife, the still, the chisel, the machines, a page turned; the sickle, the hoe).
// - Wherever the player is looking (`globalSounds`): coins in, a level gained, a question asked, a raid won or lost,
//   the rooster and the bell, a feast or a funeral, a birth, the ground shaking.
// - A watched party's fight (`fightSounds`) and the raid's tactics board (`tacticsSounds`), which hide the map.
// A few of each kind at most, so a big fight isn't a wall of noise.

import type { Cue } from './ambience';
import type { ExpeditionView, Snapshot } from '../shared/sim/snapshot';
import { ITEM_BY_ID } from '../shared/data/items';
import { ENEMIES, natureOf } from '../shared/data/enemies';
import { CLASS_DEFS, type ClassId } from '../shared/data/classes';
import type { FamilyId } from '../shared/data/weapons';

export interface Sound {
  cue: Cue;
  pan: number;
  delay: number;
}

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The most of one kind a snapshot plays. */
const MOST = 2;
/** Ticks: a blow struck or landed since the last snapshot. */
const FRESH = 3;
/** The share of snapshots a worker in view is heard (about once a second each). */
const WORK_HEARD = 0.09;
/** Workers heard at once. */
const WORKERS_MOST = 3;
/** Where the two sides stand on a watched fight's screen: the foes left, the party right. */
const FIGHT_PAN = 0.45;

const inView = (v: View, x: number, y: number) => x >= v.x && x <= v.x + v.w && y >= v.y && y <= v.y + v.h;
const panOf = (v: View, x: number) => Math.max(-0.9, Math.min(0.9, ((x - v.x) / Math.max(1, v.w)) * 1.6 - 0.8));
const MENDS = /heal|mend|bless|cure|life|regen|restor|renew|soothe|tend/i;

/** Each family of weapon's sound (data/weapons.ts `FAMILIES`). */
const FAMILY_CUE: Record<FamilyId, Cue> = {
  dg: 'slash', sw: 'slash', ax: 'slash', gs: 'slash', sc: 'slash', cl: 'slash',
  mc: 'bash', fl: 'bash',
  sp: 'stab', pl: 'stab',
  sl: 'throw', th: 'throw',
  bw: 'arrow', lb: 'arrow', cb: 'crossbow',
  st: 'zap', wd: 'zap',
  pi: 'gunshot', lg: 'gunshot', sg: 'gunshot', ag: 'burst', en: 'laser', hv: 'boom',
};

/** A townsperson's blow: by the weapon in hand; with none, a caster's bolt, a thrown stone, or fists. */
export function weaponCue(weapon: string | undefined, cls: ClassId | null, opts: { ranged?: boolean; beast?: boolean } = {}): Cue {
  if (opts.beast) return 'bite';
  const fam = weapon ? ITEM_BY_ID[weapon]?.family : undefined;
  if (fam) return FAMILY_CUE[fam];
  const role = cls ? CLASS_DEFS[cls]?.role : undefined;
  if (role === 'caster' || role === 'healer') return 'zap';
  if (opts.ranged || (cls && CLASS_DEFS[cls]?.ranged)) return 'throw';
  return 'bash';
}

/** A foe's blow, by what it is: beasts bite, machines shoot beams or batter, the rest cut or shoot. */
export function foeCue(kind: string, ranged?: boolean): Cue {
  const shoots = ranged ?? ENEMIES[kind]?.ranged ?? false;
  const nature = ENEMIES[kind] ? natureOf(kind) : 'person';
  if (nature === 'beast') return shoots ? 'zap' : 'bite';
  if (nature === 'machine') return shoots ? 'laser' : 'bash';
  return shoots ? 'arrow' : 'slash';
}

/** The sound of a crafting station's trade, by its building (null: the builder's hammer will do). */
export function stationCue(def: string | null | undefined): Cue | null {
  if (!def) return null;
  // (the most particular first: a sawmill is a saw, a nanoforge a machine, a glamour loom a loom)
  if (/sawmill|saw_|carpent|cooper|joiner|workbench|boat|furniture/.test(def)) return 'saw';
  if (/nano|factory|plant|assembl|fab|robot|electron|refin|print|clock|appliance|garage|cement/.test(def)) return 'machine';
  if (/smith|forge|bloomery|armour|armor|weapon|foundry|steel|monster_guild/.test(def)) return 'anvil';
  if (/loom|weav|tailor|textile|felt|dye|spin|basket/.test(def)) return 'loom';
  if (/tann|pelt/.test(def)) return 'reap';
  if (/alemb|alchem|apothec|pharm|herb|lab|blood|brew|still|cellar|grog|chandl|clone|vat/.test(def)) return 'bubble';
  if (/campfire|tavern|inn|bak|kitchen|smoke|cann|mill|oven|butcher|drying/.test(def)) return 'pound';
  if (/kiln|jewel|gem|mason|carv|glass|stone|pearl|cutter/.test(def)) return 'chisel';
  if (/lodge|librar|school|scripto|universit|study|observ|academy/.test(def)) return 'page';
  return null;
}

/** The workers in view, a few at a time: what each is heard doing (`r` for the chances). */
export function workSounds(next: Snapshot, v: View, r: () => number = Math.random): Sound[] {
  const out: Sound[] = [];
  let n = 0;
  for (const p of next.people) {
    if (n >= WORKERS_MOST || p.away !== null || p.indoors || !inView(v, p.x, p.y)) continue;
    const cue = workCue(p.activity, p.work);
    if (!cue) continue;
    n++;
    // (the quiet ones, a page or the water, less often)
    const rate = cue === 'page' || cue === 'splash' ? WORK_HEARD / 3 : WORK_HEARD;
    if (r() < rate) out.push({ cue, pan: panOf(v, p.x), delay: r() * 0.05 });
  }
  return out;
}

/** What a townsperson at work sounds like: by what they're doing, and at a station by its trade. */
export function workCue(activity: string, work?: { kind: string; at: string | null }): Cue | null {
  switch (activity) {
    case 'chop':
      return 'chop';
    case 'mine':
      return 'mine';
    case 'reap':
      return 'reap';
    case 'till':
      return 'till';
    case 'fish':
      return 'splash';
    case 'spar':
      return 'clash';
    case 'research':
      return 'page';
    case 'build':
      switch (work?.kind) {
        case 'craft':
          return stationCue(work.at) ?? 'build';
        case 'pave':
          return 'chisel';
        case 'extinguish':
          return 'splash';
        case 'light':
          return null;
        default:
          return 'build';
      }
    default:
      return null;
  }
}

type Play = (cue: Cue, pan?: number, delay?: number) => void;

function player(r: () => number): { out: Sound[]; play: Play } {
  const out: Sound[] = [];
  const count: Partial<Record<Cue, number>> = {};
  const play: Play = (cue, pan = 0, delay = 0) => {
    if ((count[cue] ?? 0) >= MOST) return;
    count[cue] = (count[cue] ?? 0) + 1;
    out.push({ cue, pan, delay: delay + r() * 0.05 });
  };
  return { out, play };
}

/** The town on the map, and everything heard wherever the player looks (`r` for the chances: Math.random in the game,
 *  a fixed stream in tests). */
export function soundsBetween(prev: Snapshot | null, next: Snapshot, v: View, r: () => number = Math.random): Sound[] {
  const { out, play } = player(r);
  if (!prev) return out;
  townPart(prev, next, v, r, play);
  globalPart(prev, next, r, play);
  return out;
}

/** What's heard whatever is on the screen (a watched fight, the tactics board, a building looked into). */
export function globalSounds(prev: Snapshot | null, next: Snapshot, r: () => number = Math.random): Sound[] {
  const { out, play } = player(r);
  if (prev) globalPart(prev, next, r, play);
  return out;
}

function townPart(prev: Snapshot, next: Snapshot, v: View, r: () => number, play: Play): void {
  const before = new Map(prev.people.map((p) => [p.id, p]));
  // the townsfolk: blows struck by what's in hand, blows turned and taken, doors
  for (const p of next.people) {
    if (p.away !== null) continue;
    const was = before.get(p.id);
    const seen = inView(v, p.x, p.y) && !p.indoors;
    const pan = panOf(v, p.x);
    if (seen && p.sinceBlow >= 0 && p.sinceBlow < FRESH && (!was || was.sinceBlow > p.sinceBlow)) play(weaponCue(p.gear?.weapon, p.cls, { beast: !!p.beast }), pan);
    if (seen && p.sinceBlock >= 0 && p.sinceBlock < FRESH && (!was || was.sinceBlock > p.sinceBlock)) play('block', pan);
    else if (seen && p.sinceHit >= 0 && p.sinceHit < FRESH && (!was || was.sinceHit > p.sinceHit)) play(r() < 0.5 ? 'hurt' : 'thud', pan, 0.08);
    if (was && seen && p.indoors !== was.indoors && r() < 0.25) play('door', pan);
  }
  // the raiders: their blows, struck, and falling
  const raidersBefore = new Map((prev.raid?.raiders ?? []).map((x) => [x.id, x]));
  for (const x of next.raid?.raiders ?? []) {
    const was = raidersBefore.get(x.id);
    if (!inView(v, x.x, x.y) || x.gone) continue;
    const pan = panOf(v, x.x);
    if (x.down && was && !was.down) play('fall', pan);
    else if (!x.down) {
      if (x.sinceAction >= 0 && x.sinceAction < FRESH && (!was || was.sinceAction > x.sinceAction)) play(foeCue(x.kind), pan);
      if (x.sinceHit >= 0 && x.sinceHit < FRESH && (!was || was.sinceHit > x.sinceHit)) play('thud', pan, 0.06);
    }
  }
  // the battle on the map: the towers and engines loosing, fire thrown
  const dt = Math.max(1, next.tick - prev.tick) / 10;
  for (const sh of next.battle?.shots ?? []) {
    if (sh.age >= dt) continue;
    const x = sh.from[0] * 32;
    if (!inView(v, x, sh.from[1] * 32)) continue;
    if (sh.kind === 'tower') play('ballista', panOf(v, x));
    else if (sh.kind === 'fire') play('whoosh', panOf(v, x));
  }
  // spells cast
  const lastSpell = prev.spells.reduce((m, sp) => Math.max(m, sp.n), -1);
  for (const sp of next.spells) if (sp.n > lastSpell) play(MENDS.test(sp.name) ? 'heal' : 'spell', panOf(v, sp.x));
  // horses on the road, now and then
  if (next.travellers?.some((t) => inView(v, t.x, t.y)) && r() < 0.01) play('gallop', r() * 1.2 - 0.6);
}

function globalPart(prev: Snapshot, next: Snapshot, r: () => number, play: Play): void {
  const before = new Map(prev.people.map((p) => [p.id, p]));
  const dark = next.theme === 'lich' || next.theme === 'robot';
  for (const p of next.people) {
    const was = before.get(p.id);
    if (was && p.level > was.level) play('levelup', 0, 0.1);
    if (!was && p.ageYears < 1 && prev.people.length) play('baby');
  }
  // coins in
  if (next.coins - prev.coins >= 5) play('coin', 0.3);
  // a question for the player
  const asked = new Set(prev.prompts.map((p) => p.id));
  if (next.prompts.some((p) => !asked.has(p.id))) play('chime');
  // a raid ends
  if (next.raidRecap && next.raidRecap.tick !== prev.raidRecap?.tick) play(next.raidRecap.outcome === 'pillaged' ? 'dirge' : 'fanfare', 0, 0.3);
  // the day's hours
  const h0 = prev.calendar.hour;
  const h1 = next.calendar.hour;
  if (h1 !== h0) {
    if (h1 === 6 && !dark) play('rooster', r() * 1.2 - 0.6);
    if ((h1 === 12 || h1 === 18) && next.people.length >= 6) play('bell', r() * 1.2 - 0.6);
  }
  // gatherings
  if (next.gathering && next.gathering.key !== prev.gathering?.key) {
    const k = next.gathering.kind;
    play(k === 'funeral' || k === 'great_funeral' ? 'dirge' : 'cheer');
  }
  // disasters: the ground shaking, the fire's rush
  if (next.disaster && next.disaster.kind !== prev.disaster?.kind) play(next.disaster.kind === 'wildfire' ? 'whoosh' : 'rumble');
}

/** A watched party's fight: each side's blows (the party by their weapons, the foes by what they are), spells and
 *  skills, the hurt, the fallen, and how it ended. `dt` is the ticks since the last snapshot. */
export function fightSounds(prev: ExpeditionView | null, next: ExpeditionView, dt: number, r: () => number = Math.random): Sound[] {
  const { out, play } = player(r);
  if (!prev || prev.id !== next.id) return out;
  const fresh = Math.max(FRESH, dt);
  const before = new Map((prev.battle ?? []).map((f) => [`${f.side}:${f.ref}`, f]));
  const fighters = new Map((next.battle ?? []).map((f) => [`${f.side}:${f.ref}`, f]));
  const sidePan = (side: 'party' | 'enemy') => (side === 'party' ? FIGHT_PAN : -FIGHT_PAN) + (r() - 0.5) * 0.2;
  // the spells and skills used: an ultimate's blast, a mending chime, a spell's shimmer, a skill by the weapon
  const acted = new Set<string>();
  const seen = new Set((prev.acts ?? []).map((a) => `${a.side}:${a.ref}:${a.name}:${a.age}`));
  for (const a of next.acts ?? []) {
    if (a.age >= fresh || seen.has(`${a.side}:${a.ref}:${a.name}:${a.age - dt}`)) continue;
    const key = `${a.side}:${a.ref}`;
    acted.add(key);
    const f = fighters.get(key);
    if (a.ult) play('ult', sidePan(a.side));
    else if (a.spell) play(MENDS.test(a.name) ? 'heal' : 'spell', sidePan(a.side));
    else if (f) play(f.side === 'party' ? weaponCue(f.gear.weapon, f.cls, { ranged: f.ranged, beast: f.wolf }) : foeCue(f.kind, f.ranged), sidePan(a.side));
  }
  for (const [key, f] of fighters) {
    const was = before.get(key);
    if (!was) continue;
    if (f.down && !was.down) {
      play('fall', sidePan(f.side), 0.1);
      continue;
    }
    if (f.down) continue;
    if (!acted.has(key) && f.sinceAction < fresh && f.sinceAction < was.sinceAction)
      play(f.side === 'party' ? weaponCue(f.gear.weapon, f.cls, { ranged: f.ranged, beast: f.wolf }) : foeCue(f.kind, f.ranged), sidePan(f.side));
    if (f.sinceHit < fresh && f.sinceHit < was.sinceHit) {
      const healed = f.pop?.heal && f.pop.age < fresh;
      if (healed) play('heal', sidePan(f.side));
      else if (f.hitFx === 'fire') play('whoosh', sidePan(f.side), 0.08);
      else if (f.hitFx === 'lightning') play('zap', sidePan(f.side), 0.08);
      else play(f.side === 'party' && r() < 0.5 ? 'hurt' : 'thud', sidePan(f.side), 0.08);
    }
  }
  // the end of it
  if (next.result && !prev.result) play(next.result.outcome === 'won' ? 'fanfare' : next.result.outcome === 'lost' ? 'dirge' : 'whoosh', 0, 0.2);
  return out;
}

/** The raid's tactics board: each happening on it (sim/tactics.ts `fx` and `hits`), heard as it comes. */
export function tacticsSounds(prev: Snapshot | null, next: Snapshot, r: () => number = Math.random): Sound[] {
  const { out, play } = player(r);
  const t = next.tactics;
  if (!prev || !t || !prev.tactics) return out;
  const dt = Math.max(1, next.tick - prev.tick);
  const span = Math.max(1, t.w + t.h);
  const panAt = (u: number, v: number) => Math.max(-0.9, Math.min(0.9, ((u - v) / span) * 1.6));
  const unitAt = (u: number, v: number) => t.units.find((q) => q.u === u && q.v === v);
  const people = new Map(next.people.map((p) => [p.id, p]));
  const raiders = new Map((next.raid?.raiders ?? []).map((x) => [x.id, x]));
  /** Whoever stands at a tile, by what they strike with. */
  const blowOf = (u: number, v: number, shot: boolean): Cue => {
    const q = unitAt(u, v);
    if (!q) return shot ? 'arrow' : 'slash';
    if (q.tower) return 'ballista';
    if (q.key.startsWith('p')) {
      const p = people.get(q.ref);
      return weaponCue(p?.gear?.weapon, p?.cls ?? null, { ranged: shot, beast: !!p?.beast });
    }
    const x = raiders.get(q.ref);
    return x ? foeCue(x.kind, shot || undefined) : shot ? 'arrow' : 'slash';
  };
  for (const fx of t.fx) {
    if (fx.age >= dt) continue;
    const [u, v] = fx.from;
    const pan = panAt(u, v);
    switch (fx.kind) {
      case 'blow':
        play(blowOf(u, v, false), pan);
        break;
      case 'shot':
        play(blowOf(u, v, true), pan);
        break;
      case 'act':
        play(fx.ult ? 'ult' : MENDS.test(fx.name ?? '') ? 'heal' : 'spell', pan);
        break;
      case 'tend':
        play('heal', pan);
        break;
      case 'tower':
        play('ballista', pan);
        break;
      case 'trap':
        play('snap', pan);
        break;
      case 'stun':
        play('bash', pan);
        break;
      case 'chest':
        play('coin', pan);
        break;
      case 'lost':
        play('dirge', pan);
        break;
      case 'area':
        break;
    }
  }
  // blows landing (a townsperson cries out, a raider grunts), mending
  for (const h of t.hits) {
    if (h.age >= dt) continue;
    if (h.heal) continue;
    play(!h.foe && r() < 0.5 ? 'hurt' : 'thud', panAt(h.u, h.v), 0.1);
  }
  // the fallen
  const wasDown = new Set(prev.tactics.units.filter((q) => q.count !== null || q.hp <= 0).map((q) => q.key));
  for (const q of t.units) if ((q.count !== null || q.hp <= 0) && !wasDown.has(q.key) && prev.tactics.units.some((w) => w.key === q.key)) play('fall', panAt(q.u, q.v), 0.15);
  return out;
}
