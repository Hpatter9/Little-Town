// The townsfolk dressed from the Himeko Sutori sprite share (the owner's call: the new townsfolk sprites, founders
// too). Each person is a stack of the pack's layers (tools/import-himeko.cjs copies them into art/himeko/, each a
// file beside the page fetched when first worn): a body by skin and sex, hair and beard, the outfit of their calling
// (grander at each stage), a helm and shield by what they wear, the weapon of its family in a fight and the tool of
// the work in hand. Every layer is the same grid of 128px cells, 8 poses by 4 facings: stand, two steps, the arm
// raised, the lunge, two punches (here: shooting and casting) and the kneel; front, left, right, back. No Pixi here,
// so the menus can draw them too (the map wraps the canvases in textures).

import type { ClassId } from '../../shared/data/classes';
import { ITEM_BY_ID } from '../../shared/data/items';
import type { Slot } from '../../shared/data/items';
import { SKINS, type Look } from '../../shared/data/people';
import type { PersonView } from '../../shared/sim/snapshot';
import manifest from './himeko.json';

/** Where the feet stand in a cell, and the figure's height there (the man's template, standing). */
export const HK_FEET = manifest.feet[0][1];
export const HK_FIGURE = manifest.feet[0][1] - manifest.feet[0][0];
export const HK_CELL = 128;
const HAS = new Set<string>(manifest.keys);
const url = (k: string) => `himeko/${k}.png`;

/** What a person's look is made from. */
export interface HkWho {
  id: number;
  look: Look;
  gear: Partial<Record<Slot, string>>;
  cls: ClassId | null;
  /** Their calling's stage, 0 to 4. */
  stage: number;
  founder: boolean;
  monster: string | null;
  child: boolean;
  /** A stranger passing through (dressed for the road). */
  traveller: boolean;
  /** Lost an eye (an eyepatch), carries a scar. */
  eyeLost: boolean;
  scarred: boolean;
}

/* ------------------------------------------------------------ choosing the layers */

type Sex = 'male' | 'female';
const sexed = (prefix: string, sex: Sex) => {
  // (the first layer starting with the prefix in this cut: 'female' also ends in 'male', so a man's is checked for it)
  for (const k of manifest.keys) if (k.startsWith(prefix) && (sex === 'female' ? k.endsWith('female') : k.endsWith('male') && !k.endsWith('female'))) return k;
  return null;
};
const sexedTop = (prefix: string, sex: Sex) => {
  for (const k of manifest.keys) if (k.startsWith(prefix) && k.endsWith(`${sex}top`) && (sex === 'female' || !k.endsWith('femaletop'))) return k;
  return null;
};

/** Hair colours the pack has, and a colour for each to match against. */
const HAIR: [string, number][] = [
  ['black', 0x1e1a18], ['brown', 0x5a3a24], ['blonde', 0xd8b878], ['red', 0x9a3822], ['orange', 0xd07a30],
  ['white', 0xe4e0d8], ['pink', 0xd8589c], ['violet', 0x8a4ac0], ['blue', 0x3a5ac8], ['green', 0x3a9a4a],
];
const rgb = (hex: string | number) => {
  const n = typeof hex === 'number' ? hex : parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
function hairColour(hex: string): string {
  const [r, g, b] = rgb(hex);
  let best = 'brown';
  let bd = Infinity;
  for (const [name, c] of HAIR) {
    const [cr, cg, cb] = rgb(c);
    const d = (r - cr) ** 2 * 0.3 + (g - cg) ** 2 * 0.59 + (b - cb) ** 2 * 0.11;
    if (d < bd) [bd, best] = [d, name];
  }
  // (grey reads as white; a mid brown can come out orange, which the pack's orange isn't)
  return best;
}
/** The skin's template: light, tan or dark. */
function skinOf(hex: string): '' | 'tan' | 'dark' {
  const i = SKINS.indexOf(hex);
  if (i >= 0) return i < 4 ? '' : i < 8 ? 'tan' : 'dark';
  const [r, g, b] = rgb(hex);
  const l = 0.3 * r + 0.59 * g + 0.11 * b;
  return l > 190 ? '' : l > 130 ? 'tan' : 'dark';
}

/** Each calling's outfit, by the line of the pack's outfits (six grades each). */
const OUTFIT: Record<ClassId, string> = {
  knight: 'paladin', guardian: 'plate', dragoon: 'plate', samurai: 'leather', warrior: 'barbarian', blood_knight: 'warlock',
  ranger: 'ranger', hunter: 'ranger', beast_tamer: 'ranger', archer: 'leather', assassin: 'leather',
  mage: 'mage', chronomancer: 'mage', spellblade: 'mage', witch: 'warlock', necromancer: 'warlock', summoner: 'warlock',
  white_mage: 'cleric', monk: 'cleric', shaman: 'druid', druid: 'druid', bard: 'illusion', dancer: 'illusion',
  alchemist: 'alch', engineer: 'gun',
};
/** Their helm when they wear nothing on their head: the casters' hats, the healers' caps. */
const BARE_HEAD: Partial<Record<ClassId, string>> = {
  mage: 'mage', chronomancer: 'mage', witch: 'mage', white_mage: 'prayercap', monk: 'prayercap', assassin: 'ninjamask',
  dancer: 'domino', bard: 'musketeerhat', engineer: 'gogglesred',
};
/** The outfits that are robes (worn with no armour on), and the weight of armour each outfit line is. */
const ROBES = new Set(['mage', 'cleric', 'warlock', 'druid', 'illusion', 'alch']);
const OUTFIT_WEIGHT: Record<string, string> = { paladin: 'heavy', plate: 'heavy', barbarian: 'medium', gun: 'medium', alch: 'medium', leather: 'light', ranger: 'light', illusion: 'cloth', mage: 'cloth', cleric: 'cloth', warlock: 'cloth', druid: 'cloth' };
/** An outfit for armour of each weight when it isn't of the calling's own line. */
const ARMOUR_OUTFIT: Record<string, string> = { heavy: 'plate', medium: 'leather', light: 'leather', cloth: 'adventurer' };
/** The grade of outfit at each of the calling's five stages. */
const GRADE = [1, 2, 3, 4, 6];

/** Each weapon family's pieces in the pack, weakest first (pick by the item's tier). */
const WEAPON: Record<string, string[]> = {
  dg: ['dagger01', 'dagger02', 'dagger03', 'dagger04', 'dagger05'],
  // (the pack has no claws or throwing weapons: knives stand in; a sling, too small to show, is bare-handed)
  cl: ['dagger03', 'dagger04', 'dagger05'],
  th: ['dagger01', 'dagger02'],
  sw: ['sword01', 'sword02', 'sword03', 'sword05', 'sword06', 'sword07'],
  ax: ['axe01', 'axe02', 'axe03', 'axe04', 'axe05', 'axe06'],
  mc: ['hammer01', 'hammer02', 'hammer04', 'hammer05', 'hammer06'],
  fl: ['hammer04'],
  sp: ['greataxe04'],
  pl: ['greataxe04'],
  gs: ['greatsword01', 'greatsword02', 'greatsword03', 'greatsword05', 'greatsword06'],
  sc: ['scythe01', 'scythe02', 'scythe03', 'scythe04'],
  bw: ['bow01', 'bow02', 'bow04', 'bow05', 'bow06'],
  lb: ['bow03'],
  cb: ['gun01crossbow'],
  st: ['staff01', 'staff02', 'staff03', 'staffgnarled', 'staff04', 'staffcrescent', 'staff05', 'staffmysterious'],
  wd: ['wand01', 'wand02', 'wand03', 'wand04', 'wand05'],
  pi: ['pistol01', 'pistol02', 'pistol03', 'pistol04', 'pistol06'],
  lg: ['gun03arquebus'],
  sg: ['gun02blunderbuss'],
  ag: ['pistol05'],
  en: ['gun05zapper'],
  hv: ['gun06shouldercannon'],
};
/** The work in hand's tool. */
const TOOL: Record<string, string[]> = { chop: ['axe01'], build: ['hammer01'], reap: ['sickle01', 'scythe01'], mine: ['greathammer01'], till: ['staff01'], forage: ['sickle01', 'dagger01'] };

/** The layers of a person, back to front (keys of art/himeko/), for what they're doing now. */
export function hkLayers(w: HkWho, doing: { fighting: boolean; activity: string }): string[] {
  const sex: Sex = w.look.gender === 'f' ? 'female' : 'male';
  const skin = skinOf(w.look.skin);
  const out: (string | null)[] = [];
  const bone = w.look.body === 'skeleton' || w.monster === 'undead';
  const colour = hairColour(w.look.hairColor);
  const style = w.look.hair;
  // the hair behind the body
  const longHair = ['long', 'loose', 'shoulderl', 'longknot'].includes(style);
  if (!bone && sex === 'female') {
    if (longHair) out.push(`hairlong${colour}rear`);
    else if (style === 'ponytail') out.push(`hairpigtails${colour}rear`);
    else if (style !== 'shortknot') out.push(`hairshort${colour}rear`);
  }
  // the body
  out.push(bone ? 'skeleton' : w.look.body === 'orc' ? 'orc' : `template${sex}${skin}`);
  if (!bone) {
    if (w.scarred) out.push(sexed('scar', sex));
    if (w.eyeLost) out.push(sexed('eyepatch', sex));
    else if (!skin && w.id % 7 === 3) out.push(sexed('freckles', sex));
    if (sex === 'male' && w.look.beard) out.push(`${['beard', 'goatee', 'sideburns'][w.id % 3]}${colour === 'blonde' ? 'blond' : colour}`);
  }
  // what they wear: the body armour they have on (the user's ask: the gear they're equipped with shows), in their
  // calling's style where it's of that weight, at the armour's tier; with none, a caster's robes, a founder's own
  // outfit, a traveller's road clothes, else everyday clothes
  const body = w.gear.body ? ITEM_BY_ID[w.gear.body] : undefined;
  const own = w.cls ? OUTFIT[w.cls] : null;
  const robed = own !== null && ROBES.has(own);
  let family: string;
  let grade = 1;
  const weight = body?.weight;
  if (weight === 'heavy' || weight === 'medium' || weight === 'light' || weight === 'cloth') {
    const fits = own !== null && OUTFIT_WEIGHT[own] === weight;
    family = fits ? own! : ARMOUR_OUTFIT[weight];
    grade = Math.max(1, Math.min(6, 1 + Math.floor(((body!.tier ?? 1) - 1) / 2) + (weight === 'medium' && !fits ? 2 : 0)));
  } else if (robed || w.founder) {
    family = own ?? 'adventurer';
    grade = GRADE[Math.max(0, Math.min(4, w.stage))];
  } else if (w.traveller || w.cls) [family, grade] = ['adventurer', 1 + (w.id % 2)];
  else [family, grade] = ['peasant', 1 + (w.id % 2)];
  if (w.founder && !body && grade < 3) grade = 3; // (a founder dresses the part from the first)
  out.push(sexed(`${family}0${grade}`, sex) ?? sexed(`${family}01`, sex));
  out.push(sexedTop(`${family}0${grade}`, sex));
  // the hair in front (and a man's bangs)
  if (!bone) {
    if (sex === 'female') {
      if (longHair) out.push(`hairlong${colour}front`);
      else if (style === 'ponytail') out.push(`hairpigtails${colour}front`);
      else if (style === 'shortknot') out.push(`hairpixie${colour}`);
      else out.push(`hairshort${colour}front`);
    } else if (style !== 'shortknot') out.push(`${longHair || style === 'ponytail' ? 'bangslayers' : 'bangsbig'}${colour}`);
  }
  // a helm: what they wear on their head, by its weight; else their calling's hat; a founder their crown
  const head = w.gear.head ? ITEM_BY_ID[w.gear.head] : undefined;
  const helm =
    head?.weight === 'heavy' ? (w.cls === 'samurai' ? 'samurai' : w.cls === 'warrior' || w.cls === 'blood_knight' ? 'horned' : 'armet')
    : head?.weight === 'medium' ? (w.id % 2 ? 'sallet' : 'guard')
    : head?.weight === 'light' ? (w.cls === 'ranger' || w.cls === 'hunter' ? 'hoodgreen' : 'hoodred')
    : w.founder ? (w.cls && ['mage', 'witch', 'necromancer', 'summoner', 'chronomancer', 'druid', 'shaman'].includes(w.cls) ? 'magecrown' : 'crown')
    : w.cls ? (BARE_HEAD[w.cls] ?? null)
    : null;
  if (helm) out.push(sexed(`helm${helm}`, sex));
  // a shield, by its kind
  const off = w.gear.offhand ? ITEM_BY_ID[w.gear.offhand] : undefined;
  const shield = off && (off.weight === 'shield' || off.effects?.block) ? off : undefined;
  if (shield) {
    const kinds = /tower|pavise|wall/i.test(shield.name) ? ['shield04tower', 'shield05guardian'] : /buckler/i.test(shield.name) ? ['shieldbuckler'] : ['shieldround', 'shieldheatersm', 'shield06suncrest'];
    out.push(sexed(kinds[w.id % kinds.length], sex));
  }
  // the weapon of its family in a fight, else the tool of the work in hand
  const weapon = w.gear.weapon ? ITEM_BY_ID[w.gear.weapon] : undefined;
  // (a weapon they carry shows whenever their hands aren't full of the work's tool, not only in a fight)
  if ((doing.fighting || (!TOOL[doing.activity] && !w.child)) && weapon?.family && WEAPON[weapon.family]) {
    const list = WEAPON[weapon.family];
    out.push(sexed(list[Math.max(0, Math.min(list.length - 1, Math.floor(((weapon.tier ?? 1) - 1) / 2)))], sex));
  } else if (TOOL[doing.activity]) out.push(TOOL[doing.activity].map((t) => sexed(t, sex)).find((k) => k) ?? null); // (the pack's sickle is a man's only)
  return out.filter((k): k is string => !!k && HAS.has(k));
}

/* ------------------------------------------------------------ the poses */

export type HkFacing = 'down' | 'left' | 'right' | 'up';
const ROW: Record<HkFacing, number> = { down: 0, left: 1, right: 2, up: 3 };
const WALK = [1, 0, 2, 0];

/** The cell for what they're doing: [column, row]. */
export function hkPose(o: { facing: HkFacing; moving: boolean; walked: number; working: boolean; sinceBlow: number; sinceHit: number; down: boolean; ranged: boolean; now: number }): [number, number] {
  const row = ROW[o.facing];
  if (o.down) return [7, row];
  if (o.sinceHit < 3) return [7, row]; // (a flinch)
  if (o.sinceBlow < 6) return [o.ranged ? 5 : o.sinceBlow < 3 ? 3 : 4, row];
  if (o.working) return [Math.floor(o.now / 350) % 2 ? 4 : 3, row];
  if (o.moving) return [WALK[Math.floor(o.walked / 7) % 4], row];
  return [0, row];
}

/* ------------------------------------------------------------ drawing */

const images = new Map<string, HTMLImageElement | 'loading' | 'failed'>();
const waiting: (() => void | boolean)[] = [];
let told = false;
/** Call back when more layers have loaded (to draw again); a callback that returns true is done and dropped (a
 *  picture painted once its layers came). */
export function onHkLoad(fn: () => void | boolean): void {
  waiting.push(fn);
}
function image(k: string): HTMLImageElement | null {
  const im = images.get(k);
  if (im === undefined) {
    images.set(k, 'loading');
    const i = new Image();
    i.onload = () => {
      images.set(k, i);
      // (one call for all that load together, not one per layer)
      if (told) return;
      told = true;
      setTimeout(() => {
        told = false;
        for (const fn of [...waiting]) if (fn() === true) waiting.splice(waiting.indexOf(fn), 1);
      }, 50);
    };
    i.onerror = () => images.set(k, 'failed');
    i.src = url(k);
    return null;
  }
  return typeof im === 'string' ? null : im;
}

/** Composed cells, by the layers and the cell (the most recent kept). */
const cells = new Map<string, HTMLCanvasElement>();
const MOST_CELLS = 900;

/** One cell of a person's stack of layers, as a canvas (128 square, feet at HK_FEET), or null while its layers load. */
export function hkCell(keys: string[], col: number, row: number): HTMLCanvasElement | null {
  const key = `${keys.join('+')}|${col},${row}`;
  const hit = cells.get(key);
  if (hit) {
    cells.delete(key);
    cells.set(key, hit);
    return hit;
  }
  const ims = keys.map(image);
  if (ims.some((im, i) => !im && images.get(keys[i]) !== 'failed')) return null;
  const c = document.createElement('canvas');
  c.width = c.height = HK_CELL;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  for (const im of ims) if (im) g.drawImage(im, col * HK_CELL, row * HK_CELL, HK_CELL, HK_CELL, 0, 0, HK_CELL, HK_CELL);
  cells.set(key, c);
  if (cells.size > MOST_CELLS) {
    const old = cells.keys().next().value!;
    const gone = cells.get(old)!;
    cells.delete(old);
    for (const fn of evicted) fn(gone);
  }
  return c;
}
const evicted: ((c: HTMLCanvasElement) => void)[] = [];
/** Told of each cell dropped from the cache (the map frees its texture). */
export function onHkEvict(fn: (c: HTMLCanvasElement) => void): void {
  evicted.push(fn);
}

/* ------------------------------------------------------------ for the menus */

/** What a townsperson's look is made from, from their view in the snapshot. */
export function hkWhoOf(v: PersonView): HkWho {
  return {
    id: v.id, look: v.look, gear: v.gear, cls: v.cls, stage: v.stage, founder: v.founderCalling, monster: v.monster,
    child: v.growsUpIn !== null, traveller: v.typeName === 'Traveller',
    eyeLost: v.body.marks.some((m) => /eye/i.test(m.part) && (m.look === 'patch' || m.look === 'gone')),
    scarred: v.body.lasting.some((l) => l.startsWith('scarred')),
  };
}
/** The townsfolk as of the last snapshot (main.ts: `hkKnow`), so a view that has only someone's id, look and gear (a
 *  party on the fight screen, the diggers in a mine) dresses them as the map does. */
const known = new Map<number, HkWho>();
export function hkKnow(people: PersonView[]): void {
  known.clear();
  for (const p of people) known.set(p.id, hkWhoOf(p));
}
/** A townsperson by their id (with the gear given, which may be what they carry on a trip); someone unknown is plain. */
export function hkWhoById(id: number, look: Look, gear?: Partial<Record<Slot, string>>): HkWho {
  const w = known.get(id);
  return w ? { ...w, gear: gear ?? w.gear } : hkWhoOfLook(id, look, { gear });
}
/** Someone known only by their look (a stranger at the shop, a founder to choose): plain for their station. */
export function hkWhoOfLook(id: number, look: Look, o: { cls?: ClassId | null; founder?: boolean; traveller?: boolean; gear?: Partial<Record<Slot, string>> } = {}): HkWho {
  return { id, look, gear: o.gear ?? {}, cls: o.cls ?? null, stage: 0, founder: !!o.founder, monster: null, child: false, traveller: !!o.traveller, eyeLost: false, scarred: false };
}

/** Draw a person's cell into a canvas: centred on `cx`, feet on `feetY`, the figure `height` tall. False while their
 *  layers load (onHkLoad says when to try again). */
export function hkDraw(g: CanvasRenderingContext2D, keys: string[], col: number, row: number, cx: number, feetY: number, height: number): boolean {
  const c = hkCell(keys, col, row);
  if (!c) return false;
  const k = height / HK_FIGURE;
  const smooth = g.imageSmoothingEnabled;
  g.imageSmoothingEnabled = false;
  g.drawImage(c, Math.round(cx - (HK_CELL / 2) * k), Math.round(feetY - HK_FEET * k), Math.round(HK_CELL * k), Math.round(HK_CELL * k));
  g.imageSmoothingEnabled = smooth;
  return true;
}
