// The townsfolk of the isometric view: the rules, with no Pixi and no DOM (so the tests can run them). Which way a
// person faces, which animation they play for what they're doing, which look they wear, and which frame shows when.
// The map positions are the top-down ones (x east, y south); the 2:1 diamond grid turns a step east into a step
// down-right on screen, so "east on the map" faces south-east on screen.

import type { Slot } from '../../shared/data/items';
import type { PersonView } from '../../shared/sim/snapshot';

/** The eight facings, in the order the art's index.json lists them: the way the person faces on screen. */
export const FOLK_DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'] as const;
export type FolkDir = (typeof FOLK_DIRS)[number];

/** The facing for a step on the map (dx east, dy south), or null if they haven't moved. */
export function facingFromVector(dx: number, dy: number): FolkDir | null {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) return null;
  // Map angle 0 (east) is screen south-east; each quarter turn clockwise on the map is two steps round the screen.
  const deg = (Math.atan2(dy, dx) * 180) / Math.PI;
  const i = Math.round((1 - deg / 45) % 8);
  return FOLK_DIRS[((i % 8) + 8) % 8];
}

/** The facing from one map spot to another (a target to work on, a foe), or null if they're on the same spot. */
export const facingToward = (fromX: number, fromY: number, toX: number, toY: number): FolkDir | null => facingFromVector(toX - fromX, toY - fromY);

/* ------------------------------------------------------------ animations */

/** Every animation a look may have ('stand' is the still rotation frame: every look has it). */
export type FolkAnim = 'stand' | 'walk' | 'run' | 'idle' | 'death' | 'hurt' | 'cast_1h' | 'cast_2h' | 'chop' | 'hammer' | 'attack_1h' | 'attack_bow' | 'attack_2h';

/** What the snapshot says about a person that decides their animation (a PersonView has all of it). */
export type FolkState = Pick<PersonView, 'id' | 'activity' | 'sinceHit' | 'sinceBlow' | 'defending' | 'downed' | 'hp'> & {
  /** Set from a PersonView: a child is `lifeStage === 'child'` (`growsUpIn` reads 0 once grown, so it is only a stand-in). */
  lifeStage?: PersonView['lifeStage'];
  growsUpIn?: PersonView['growsUpIn'];
  look: Pick<PersonView['look'], 'gender' | 'outfit'>;
  gear: Partial<Record<Slot, string>>;
  work?: PersonView['work'];
  origin?: PersonView['origin'];
  rally?: PersonView['rally'];
};

/** The speed (map pixels a second) from which a walker is running. */
export const RUN_SPEED = 70;
/** A blow landed this many ticks ago still shows the hurt animation (ticks run 10 a second). */
export const HURT_TICKS = 6;
/** A strike this many ticks ago still shows the attack animation. */
export const BLOW_TICKS = 8;

export interface FolkPlay {
  anim: FolkAnim;
  /** Frames a second at normal pace (scaled by `rate`). */
  fps: number;
  loop: boolean;
}

const FPS: Record<FolkAnim, number> = { stand: 1, walk: 8, run: 12, idle: 4, death: 8, hurt: 10, cast_1h: 8, cast_2h: 8, chop: 8, hammer: 8, attack_1h: 10, attack_bow: 10, attack_2h: 10 };
const ONCE: ReadonlySet<FolkAnim> = new Set(['death', 'hurt']);

/** What to try, in order, when a look lacks an animation. `run` falls back to a faster walk (see `play`). */
const FALLBACK: Record<FolkAnim, FolkAnim[]> = {
  stand: [],
  idle: ['stand'],
  walk: ['stand'],
  run: ['walk', 'stand'],
  death: ['hurt', 'stand'],
  hurt: ['idle', 'stand'],
  cast_1h: ['cast_2h', 'attack_1h', 'idle', 'stand'],
  cast_2h: ['cast_1h', 'attack_2h', 'idle', 'stand'],
  // (a look with no tool drawn still works, never stands idle at it: the other tool, else its punch or its thrown
  // spell, which reads as hammering, hewing or a druid's working; the owner's ask)
  chop: ['hammer', 'attack_1h', 'cast_1h', 'idle', 'stand'],
  hammer: ['chop', 'attack_1h', 'cast_1h', 'idle', 'stand'],
  // (a casting people's cast fights with its thrown spell)
  attack_1h: ['attack_2h', 'chop', 'hammer', 'cast_1h', 'idle', 'stand'],
  attack_2h: ['attack_1h', 'chop', 'hammer', 'cast_1h', 'idle', 'stand'],
  attack_bow: ['attack_1h', 'idle', 'stand'],
};

/** Weapon families (data/weapons.ts) by the armed look that holds them. */
const ARMED: Record<string, 'axe' | 'hammer' | 'sword' | 'bow' | 'greatsword' | 'staff'> = {
  ax: 'axe', dg: 'sword', sw: 'sword', sp: 'sword', mc: 'hammer', fl: 'sword', sc: 'sword', cl: 'sword', th: 'sword',
  bw: 'bow', lb: 'bow', cb: 'bow', sl: 'bow', st: 'staff', wd: 'staff', pl: 'greatsword', gs: 'greatsword', sg: 'greatsword', hv: 'greatsword', lg: 'greatsword',
};

/** The weapon family of an item id is looked up by the caller (data/items.ts); this maps it to the armed look. */
export const armedKind = (family: string | undefined) => (family ? ARMED[family] : undefined);

/** The armed look's suffix for what someone is about to do: an axe to fell, a hammer to build or smith, their weapon
 *  to fight. Null: the bare-handed look. `family` is their weapon's family (ItemDef.family), if they carry one. */
export function armedSuffix(st: Pick<FolkState, 'activity' | 'work'>, family: string | undefined, fighting: boolean): string | null {
  if (fighting) return armedKind(family) ?? null;
  if (st.activity === 'chop') return 'axe';
  if (st.activity === 'build' || st.activity === 'mine' || st.work?.kind === 'craft' || st.work?.kind === 'build' || st.work?.kind === 'repair' || st.work?.kind === 'pave') return 'hammer';
  return null;
}

/** Is this person in a fight right now (a blow struck lately, in the fight, or under arms in a raid)? */
export const isFighting = (st: Pick<FolkState, 'activity' | 'sinceBlow' | 'defending'>): boolean =>
  st.activity === 'fight' || st.activity === 'spar' || st.sinceBlow < BLOW_TICKS || (st.defending && st.sinceBlow < 30);

/** The animation they'd like now, before checking what the look has. `speed` is how fast they moved lately (map px/s). */
export function wantedAnim(st: FolkState, speed: number, family: string | undefined): FolkAnim {
  if (st.downed || st.hp <= 0) return 'death';
  if (st.sinceHit < HURT_TICKS) return 'hurt';
  if (isFighting(st)) {
    const k = armedKind(family);
    if (k === 'bow') return 'attack_bow';
    if (k === 'staff') return 'cast_2h';
    if (k === 'greatsword') return 'attack_2h';
    return 'attack_1h';
  }
  // (casting a line looks like the thrown move)
  if (st.activity === 'pray' || st.activity === 'draw' || st.activity === 'research' || st.activity === 'fish') return 'cast_1h';
  if (st.activity === 'chop') return 'chop';
  if (st.activity === 'build' || st.activity === 'mine' || st.activity === 'till' || st.activity === 'reap' || st.activity === 'forage' || st.work?.kind === 'craft') return 'hammer';
  if (speed > 1 || st.activity === 'walk' || st.activity === 'stroll') {
    if (speed <= 1) return st.activity === 'walk' || st.activity === 'stroll' ? 'idle' : 'stand'; // (the walk task, but not moving: held up)
    return speed >= RUN_SPEED || st.rally === 'on' ? 'run' : 'walk';
  }
  return 'idle';
}

/** The animation to play: the wanted one, or the first the look has. A look with no `run` walks faster instead
 *  (`rate` above 1). `has(anim)` says whether the look has it (`stand` always is). */
export function play(wanted: FolkAnim, has: (a: FolkAnim) => boolean): FolkPlay & { rate: number } {
  const chain = [wanted, ...FALLBACK[wanted]];
  const anim = chain.find((a) => a === 'stand' || has(a)) ?? 'stand';
  const rate = wanted === 'run' && anim === 'walk' ? 1.5 : 1;
  return { anim, fps: FPS[anim], loop: !ONCE.has(anim), rate };
}

/* ------------------------------------------------------------ looks */

/** The base looks drawn so far, per people (folder names under art/iso/folk/). Add a look here as its art arrives.
 *  `child_boy` and `child_girl` are the children's own looks (CHILD_LOOKS): never picked for a grown person. */
export const FOLK_LOOKS: Record<string, readonly string[]> = {
  settlers: ['woman_base', 'woman_leather', 'woman_plate', 'man_base', 'man_leather', 'man_plate', 'dwarf_base', 'dwarf_apron', 'dwarf_plate', 'child_boy', 'child_girl'],
  // (the peoples' own casts: walk, idle, death and an attack (a punch, or a thrown spell), no armed looks)
  orcs: ['man_brute', 'woman_orc', 'man_shaman', 'child_boy', 'child_girl'],
  lich: ['man_lord', 'woman_ghoul', 'man_skeleton', 'child_boy', 'child_girl'],
  druid: ['man_elder', 'woman_druid', 'man_warden', 'child_boy', 'child_girl'],
  vampire: ['man_lord', 'woman_lady', 'man_thrall', 'child_boy', 'child_girl'],
  // (the Moon Pack's `man_beast` is the wolf form, kept for when a werewolf turns: not an everyday look)
  werewolf: ['man_hunter', 'woman_huntress', 'child_boy', 'child_girl'],
  robot: ['man_worker', 'man_guard', 'woman_android', 'child_boy', 'child_girl'],
  merfolk: ['man_mer', 'woman_mer', 'man_fisher', 'child_boy', 'child_girl'],
  nomads: ['man_rider', 'woman_nomad', 'man_herder', 'child_boy', 'child_girl'],
  fae: ['man_fae', 'woman_fae', 'man_sprite', 'child_boy', 'child_girl'],
  alchemists: ['man_master', 'woman_alchemist', 'man_apprentice', 'child_boy', 'child_girl'],
  knights: ['man_knight', 'woman_knight', 'man_squire', 'child_boy', 'child_girl'],
};

/** Is this person a child? (the snapshot's life stage; older callers with only `growsUpIn` still count while it's above 0) */
export const isFolkChild = (st: Pick<FolkState, 'lifeStage' | 'growsUpIn'>): boolean => st.lifeStage === 'child' || (st.lifeStage === undefined && (st.growsUpIn ?? 0) > 0);

/** How big a child is drawn, against the adult art. The children's looks are already drawn child-sized (about 80px
 *  tall in their frame against a grown look's 95, with a big head and short limbs), so this only takes them down a
 *  little more: at 0.85 a child stands about 70% of a grown-up's height. */
export const CHILD_SCALE = 0.85;

/** The children's art stands this many pixels higher in its frame than the grown looks' (their feet are about 40px
 *  above the frame's foot, a grown look's about 29), so a child is dropped by this much to stand on the same spot. */
export const CHILD_FEET_LIFT = 11;

/** How tall a child's full figure stands against a grown-up's (the menus' full portraits crop each figure to itself,
 *  so they scale a child by this rather than CHILD_SCALE): the art's 80 against 95, then CHILD_SCALE. */
export const CHILD_FIGURE = (80 / 95) * CHILD_SCALE;

/** Is this one of the children's looks (`child_boy`, `child_girl`)? */
export const isChildLook = (look: string): boolean => look.startsWith('child_');

/** The looks a child wears, per people: PixelLab's boy and girl, short-limbed and big-headed, in the people's own
 *  dress. They have walk, idle and death only; everything else falls back to those (FALLBACK). */
export const CHILD_LOOKS: Record<string, { boy: readonly string[]; girl: readonly string[] }> = Object.fromEntries(
  Object.keys(FOLK_LOOKS).map((p) => [p, { boy: ['child_boy'], girl: ['child_girl'] }]),
);

/** The base look's dress by what they wear: plate for heavy body armour, leather for light or medium, base otherwise. */
export const dressOf = (weight: string | undefined): 'plate' | 'leather' | 'base' =>
  weight === 'heavy' ? 'plate' : weight === 'medium' || weight === 'light' ? 'leather' : 'base';

/** A small stable hash of a person's id (the same person always gets the same pick; no randomness). */
export function idHash(id: number, salt = 0): number {
  let h = (Math.imul(id | 0, 0x9e3779b1) ^ Math.imul(salt + 1, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x2c1b3c6d) >>> 0;
  h = Math.imul(h ^ (h >>> 12), 0x297a2d39) >>> 0;
  return (h ^ (h >>> 15)) >>> 0;
}

export interface FolkLookPick {
  people: string;
  look: string;
}

/** Which look a person wears: their people's folder (settlers where their own isn't drawn yet); a child the boy or girl
 *  look (CHILD_LOOKS; dwarf children the settlers'); a grown person a look of their sex (a look named `man_*` or
 *  `woman_*`), the one in their outfit's colour first, else a stable pick by id. */
export function pickLook(st: Pick<FolkState, 'id' | 'origin' | 'look'> & Partial<Pick<FolkState, 'lifeStage' | 'growsUpIn'>>, looks: Record<string, readonly string[]> = FOLK_LOOKS, dress?: 'plate' | 'leather' | 'base'): FolkLookPick {
  const people = st.origin && looks[st.origin]?.length ? st.origin : 'settlers';
  const drawn = looks[people] ?? [];
  if (isFolkChild(st)) {
    const kids = CHILD_LOOKS[people]?.[st.look.gender === 'f' ? 'girl' : 'boy'].filter((l) => drawn.includes(l));
    if (kids?.length) return { people, look: kids[idHash(st.id, 1) % kids.length] };
  }
  // (a grown person never wears a child's look, whatever else the folder lacks)
  const every = drawn.filter((l) => !isChildLook(l));
  // (dwarves wear the dwarf looks, where a folder has them; everyone else the human ones)
  const dwarf = st.origin === 'dwarves' && every.some((l) => l.startsWith('dwarf_'));
  const kin = every.filter((l) => l.startsWith('dwarf_') === dwarf);
  const all = kin.length ? kin : every;
  const dressed = dress ? all.filter((l) => l.endsWith(`_${dress}`)) : [];
  if (dressed.length) {
    const sx = dressed.filter((l) => l.startsWith(st.look.gender === 'f' ? 'woman_' : 'man_'));
    const from = sx.length ? sx : dressed;
    return { people, look: from[idHash(st.id, 1) % from.length] };
  }
  const sexed = all.filter((l) => l.startsWith(st.look.gender === 'f' ? 'woman_' : 'man_'));
  const pool = sexed.length ? sexed : all;
  if (!pool.length) return { people, look: 'woman_leather' };
  const byOutfit = pool.filter((l) => l.endsWith(`_${st.look.outfit}`));
  const from = byOutfit.length ? byOutfit : pool;
  return { people, look: from[idHash(st.id, 1) % from.length] };
}

/** The look's folder path (below the folk root), armed or bare: `settlers/woman_leather+axe`. */
export const lookPath = (p: FolkLookPick, suffix: string | null): string => `${p.people}/${p.look}${suffix ? `+${suffix}` : ''}`;

/** The tool a look holds instead when it has no armed look for the one wanted: the peoples' own looks each carry one
 *  tool, an axe or a hammer, so someone felling a tree with only a hammer drawn swings the hammer rather than stand idle. */
export const otherTool = (suffix: string | null): string | null => (suffix === 'axe' ? 'hammer' : suffix === 'hammer' ? 'axe' : null);

/* ------------------------------------------------------------ frames */

/** The frame to show `seconds` into an animation of `count` frames at `fps`: looping, or play once and hold the last. */
export function frameAt(count: number, fps: number, seconds: number, loop: boolean): number {
  if (count <= 1) return 0;
  const i = Math.floor(Math.max(0, seconds) * fps);
  return loop ? i % count : Math.min(count - 1, i);
}
