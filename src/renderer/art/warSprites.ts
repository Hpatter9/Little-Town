// The War tab's sprites (panel/warMap.ts, panel/warBoard.ts), none of it Pixi: images loaded once and kept, with one
// callback when any arrives (so a canvas can be painted again); the props atlases (props/<set>.png) cut by frame; the
// Craftpix pack hero sheets (packs/<id>.png) and the RPG Maker beast and horse sheets; the pack buildings that stand
// for settlements and landmarks; and the troops as figures: every troop kind (data/troops.ts) is a Himeko Sutori
// figure dressed and armed for its kind through hkFolk.ts (a mounted kind on a horse), or a pack creature (hounds,
// wolves, constructs, beasts), so a squad on the board and in its formation card is the soldiers it holds.

import { ITEM_BY_ID } from '../../shared/data/items';
import type { Look } from '../../shared/data/people';
import type { ClassId } from '../../shared/data/classes';
import { HAIR_COLORS, SKINS } from '../../shared/data/people';
import { loadImage } from './loadImage';
import { hkDraw, hkLayers, onHkLoad, type HkWho } from './hkFolk';
import { PACK_LAYOUT, packUrl } from './creatures/packs';
import manifest from './props.json';
import kindsJson from './propKinds.json';
import evergreenJson from './propEvergreen.json';
import horseUrl from './creatures/horse.png';
import wolfUrl from './creatures/wolfdog.png';
import bearUrl from './creatures/bear.png';
import lionsUrl from './creatures/lions.png';
import suHouse from './packs/su_house.png';
import ttLong from './packs/tt_long.png';
import ttGable from './packs/tt_gable.png';
import suCastle from './packs/su_castle.png';
import suRoundCastle from './packs/su_roundcastle.png';
import suTent from './packs/su_tent.png';
import rockyYurt from './packs/rocky_yurt1.png';
import rockyTipi from './packs/rocky_tipi1.png';
import caveGate from './packs/cave_gate.png';
import fence1 from './fields/fence1.png';
import fence3 from './fields/fence3.png';
import fence7 from './fields/fence7.png';
import fence9 from './fields/fence9.png';
import suWatchtower from './packs/su_watchtower.png';
import rockyMine from './packs/rocky_mine1.png';
import caveAltar from './packs/cave_altar.png';
import villageSign from './village/sign.png';
import palisade17 from './village/palisade17.png';
import palisade25 from './village/palisade25.png';
import dwalls from './village/dwalls.png';
import campfire from './fields/campfire.png';
import cobble0 from './td/cobble_0.png';
import cobble1 from './td/cobble_1.png';
import cobble2 from './td/cobble_2.png';
import cobble3 from './td/cobble_3.png';

/* ------------------------------------------------------------ loading */

const images = new Map<string, HTMLImageElement | 'loading' | 'failed'>();
const listeners = new Set<() => void>();
/** Call back whenever a sprite the war's canvases wanted has arrived (and when the Himeko layers do). */
export function onWarArt(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
let hooked = false;
function told(): void {
  for (const fn of listeners) fn();
}
/** Tell the listeners something else they paint with has arrived (the ground detail sheets). */
export const notifyWarArt = told;
/** An image, loaded once; null until it has (asked for, if it hasn't been). */
export function warImage(url: string): HTMLImageElement | null {
  const im = images.get(url);
  if (im && im !== 'loading' && im !== 'failed') return im;
  if (!im) {
    images.set(url, 'loading');
    loadImage(url).then(
      (loaded) => {
        images.set(url, loaded);
        told();
      },
      () => images.set(url, 'failed'),
    );
  }
  if (!hooked) {
    hooked = true;
    onHkLoad(() => {
      told();
      return false;
    });
  }
  return null;
}

/* ------------------------------------------------------------ the props atlases */

export type WarPropSet = 'wild' | 'winter' | 'desert' | 'coast' | 'cave' | 'sea' | 'grove' | 'places' | 'undead';
const FRAMES = manifest as Record<WarPropSet, [number, number, number, number][]>;
const KINDS = kindsJson as Record<WarPropSet, string[]>;
const EVERGREEN = evergreenJson as Record<WarPropSet, number[]>;
/** The frames of a kind in a set ('tree', 'bush', 'rock', 'plant', 'cave', 'bones', 'ruin', 'skull', 'circle', 'camp'...). */
export function propsOfKind(set: WarPropSet, kind: string, evergreen = false): number[] {
  const out: number[] = [];
  const ever = EVERGREEN[set] ?? [];
  (KINDS[set] ?? []).forEach((k, i) => {
    if (k === kind && (!evergreen || ever.includes(i) || !ever.length)) out.push(i);
  });
  return out;
}
/** Draw a prop frame with its feet (the bottom middle) at (cx, feetY), `height` px tall (its width in proportion).
 *  False until the atlas has loaded. */
export function drawProp(g: CanvasRenderingContext2D, set: WarPropSet, i: number, cx: number, feetY: number, height: number, alpha = 1): boolean {
  const im = warImage(`props/${set}.png`);
  const f = FRAMES[set]?.[i];
  if (!im || !f) return false;
  const k = height / f[3];
  const w = f[2] * k;
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.drawImage(im, f[0], f[1], f[2], f[3], Math.round(cx - w / 2), Math.round(feetY - height), Math.round(w), Math.round(height));
  g.globalAlpha = a;
  return true;
}
/** A prop frame's width over its height. */
export const propAspect = (set: WarPropSet, i: number) => {
  const f = FRAMES[set]?.[i];
  return f ? f[2] / f[3] : 1;
};

/* ------------------------------------------------------------ the pack buildings and pieces */

export const SPRITES = {
  house: suHouse, longhouse: ttLong, gable: ttGable, keep: suCastle, castle: suRoundCastle, tent: suTent, yurt: rockyYurt, tipi: rockyTipi,
  caveGate, watchtower: suWatchtower, mine: rockyMine, altar: caveAltar, sign: villageSign, palisadeA: palisade17, palisadeB: palisade25, campfire,
} as const;
export type SpriteId = keyof typeof SPRITES;
/** Draw one of the pack pictures with its feet (bottom middle) at (cx, feetY), `height` px tall. False until loaded. */
export function drawSprite(g: CanvasRenderingContext2D, id: SpriteId, cx: number, feetY: number, height: number, alpha = 1): boolean {
  const im = warImage(SPRITES[id]);
  if (!im) return false;
  const k = height / im.naturalHeight;
  const w = im.naturalWidth * k;
  const a = g.globalAlpha;
  g.globalAlpha = a * alpha;
  g.drawImage(im, Math.round(cx - w / 2), Math.round(feetY - height), Math.round(w), Math.round(height));
  g.globalAlpha = a;
  return true;
}
/** A rail fence round a plot `w` by `h` px at (x, y), from the Fields pack's rails (as the pens' fences are): the rails along
 *  the back and the front, the rail seen end on down the sides, a post at each corner; `k` the pack px to screen px. */
export function drawFenceRun(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, k: number): boolean {
  const rails = [warImage(fence1), warImage(fence3)];
  const side = warImage(fence7);
  const post = warImage(fence9);
  if (!rails[0] || !rails[1] || !side || !post) return false;
  const railH = 15 * k;
  const railW = 27 * k;
  for (let i = 0, rx = x; rx < x + w - 1; i++, rx += railW) {
    const im = rails[i % 2]!;
    const ww = Math.min(railW, x + w - rx);
    g.drawImage(im, 0, 0, Math.round((ww / railW) * im.naturalWidth), im.naturalHeight, Math.round(rx), Math.round(y - railH * 0.6), Math.round(ww), Math.round(railH));
    g.drawImage(im, 0, 0, Math.round((ww / railW) * im.naturalWidth), im.naturalHeight, Math.round(rx), Math.round(y + h - railH * 0.6), Math.round(ww), Math.round(railH));
  }
  const sideH = 31 * k;
  for (let sy = y + railH * 0.2; sy < y + h - railH * 0.5; sy += sideH - k) {
    const hh = Math.min(sideH, y + h - railH * 0.5 - sy);
    g.drawImage(side, 0, 0, side.naturalWidth, Math.round((hh / sideH) * side.naturalHeight), Math.round(x - 3 * k), Math.round(sy), Math.round(7 * k), Math.round(hh));
    g.drawImage(side, 0, 0, side.naturalWidth, Math.round((hh / sideH) * side.naturalHeight), Math.round(x + w - 4 * k), Math.round(sy), Math.round(7 * k), Math.round(hh));
  }
  for (const [px, py] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) g.drawImage(post, Math.round(px - 2.5 * k), Math.round(py - 7 * k), Math.round(5 * k), Math.round(8 * k));
  return true;
}

/** The dungeon pack's stonework (village/dwalls.png): a wall piece and a gate, cropped as packBuildings.ts does. */
export const STONE_WALL: [number, number, number, number] = [32, 240, 32, 48];
export const STONE_GATE: [number, number, number, number] = [80, 288, 48, 48];
export function drawStone(g: CanvasRenderingContext2D, crop: [number, number, number, number], x: number, y: number, w: number, h: number): boolean {
  const im = warImage(dwalls);
  if (!im) return false;
  g.drawImage(im, crop[0], crop[1], crop[2], crop[3], Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  return true;
}
/** The first flame frame of the Fields pack's campfire (32px frames across). */
export function drawCampfire(g: CanvasRenderingContext2D, cx: number, feetY: number, height: number, frame = 0): boolean {
  const im = warImage(campfire);
  if (!im) return false;
  const k = height / 32;
  g.drawImage(im, (frame % 6) * 32, 0, 32, 32, Math.round(cx - 16 * k), Math.round(feetY - 32 * k), Math.round(32 * k), Math.round(32 * k));
  return true;
}
const COBBLES = [cobble0, cobble1, cobble2, cobble3];
/** A cobble tile of the Fields tileset (td/cobble_N.png, 32px) scaled to `size`. */
export function drawCobble(g: CanvasRenderingContext2D, n: number, x: number, y: number, size: number): boolean {
  const im = warImage(COBBLES[((n % COBBLES.length) + COBBLES.length) % COBBLES.length]);
  if (!im) return false;
  g.drawImage(im, Math.round(x), Math.round(y), Math.round(size), Math.round(size));
  return true;
}

/* ------------------------------------------------------------ figures */

export type Facing = 'left' | 'right' | 'down';
const HK_ROW: Record<Facing, number> = { down: 0, left: 1, right: 2 };

/** Draw a Himeko figure standing (its weapon in hand), feet at (cx, feetY), `height` tall. */
export function drawWho(g: CanvasRenderingContext2D, who: HkWho, facing: Facing, cx: number, feetY: number, height: number): boolean {
  const keys = hkLayers(who, { fighting: true, activity: 'idle' });
  return hkDraw(g, keys, 0, HK_ROW[facing], cx, feetY, height);
}

/** Draw a Craftpix pack sheet's first idle frame, feet at (cx, feetY), the figure `height` tall. */
export function drawPack(g: CanvasRenderingContext2D, id: string, facing: Facing, cx: number, feetY: number, height: number): boolean {
  const p = PACK_LAYOUT[id];
  const im = p ? warImage(packUrl(id)) : null;
  if (!p || !im) return false;
  const row = Math.max(0, p.rows.indexOf('idle'));
  const k = height / Math.max(1, p.figure);
  const w = p.w * k;
  const h = p.h * k;
  const flip = (facing === 'left') === !!p.facesRight;
  g.save();
  g.translate(Math.round(cx), Math.round(feetY));
  if (flip) g.scale(-1, 1);
  g.imageSmoothingEnabled = false;
  g.drawImage(im, 0, row * p.h, p.w, p.h, Math.round(-w / 2), Math.round(-h), Math.round(w), Math.round(h));
  g.restore();
  return true;
}

/** The RPG Maker sheets: 48px frames, blocks of three steps across and four facings down (down, left, right, up). */
const MV: Record<'horse' | 'wolf' | 'bear' | 'lions', string> = { horse: horseUrl, wolf: wolfUrl, bear: bearUrl, lions: lionsUrl };
export function drawBeast(g: CanvasRenderingContext2D, sheet: keyof typeof MV, block: number, facing: Facing, cx: number, feetY: number, height: number): boolean {
  const im = warImage(MV[sheet]);
  if (!im) return false;
  const F = 48;
  const bx = (block % 4) * 3 + 1;
  const by = Math.floor(block / 4) * 4 + (facing === 'down' ? 0 : facing === 'left' ? 1 : 2);
  const k = height / 40; // (the creature stands about 40 of the frame's 48 px)
  g.save();
  g.imageSmoothingEnabled = false;
  g.drawImage(im, bx * F, by * F, F, F, Math.round(cx - (F * k) / 2), Math.round(feetY - F * k + 4 * k), Math.round(F * k), Math.round(F * k));
  g.restore();
  return true;
}

/* ------------------------------------------------------------ the troops as figures */

/** How a troop kind is drawn: a Himeko figure dressed for it (and mounted, for the horse), or a creature. */
export type TroopLook =
  | { kind: 'hk'; cls?: ClassId | null; body?: string; head?: string; weapon?: string; offhand?: string; pale?: boolean; bone?: boolean; mounted?: boolean }
  | { kind: 'pack'; ids: string[] }
  | { kind: 'beast'; sheet: 'wolf' | 'bear' | 'lions'; blocks: number[] };
export const TROOP_LOOKS: Record<string, TroopLook> = {
  militia: { kind: 'hk', weapon: 'wooden_club' },
  spearmen: { kind: 'hk', body: 'hide_vest', weapon: 'spear', offhand: 'wicker_shield' },
  slingers: { kind: 'hk', weapon: 'sling' },
  skirmishers: { kind: 'hk', body: 'leather_armor', weapon: 'hunting_spear' },
  war_hounds: { kind: 'beast', sheet: 'wolf', blocks: [4, 5, 6, 7] },
  archers: { kind: 'hk', body: 'leather_armor', head: 'leather_cap', weapon: 'bow' },
  shieldbearers: { kind: 'hk', body: 'chainmail', head: 'nasal_helm', weapon: 'short_sword', offhand: 'tower_shield' },
  swordsmen: { kind: 'hk', body: 'chainmail', head: 'mail_coif', weapon: 'arming_sword', offhand: 'iron_buckler' },
  pikemen: { kind: 'hk', body: 'ring_mail', head: 'nasal_helm', weapon: 'pike' },
  light_horse: { kind: 'hk', body: 'leather_armor', weapon: 'hunting_spear', mounted: true },
  heavy_horse: { kind: 'hk', body: 'plate_harness', head: 'great_helm', weapon: 'pike', offhand: 'heater_shield', mounted: true },
  crossbowmen: { kind: 'hk', body: 'studded_leather', head: 'leather_hood', weapon: 'light_crossbow' },
  battlemages: { kind: 'hk', cls: 'mage', weapon: 'oak_staff' },
  healers: { kind: 'hk', cls: 'white_mage', weapon: 'oak_staff' },
  siege_crew: { kind: 'hk', body: 'leather_armor', weapon: 'stone_maul' },
  musketeers: { kind: 'hk', body: 'frock_coat', weapon: 'musket' },
  grenadiers: { kind: 'hk', body: 'field_jacket', head: 'steel_pot_helm', weapon: 'blunderbuss' },
  riflemen: { kind: 'hk', body: 'duster', head: 'kevlar_helmet', weapon: 'rifle' },
  thralls: { kind: 'hk', body: 'hide_vest', weapon: 'flint_dagger', pale: true },
  bone_legion: { kind: 'hk', weapon: 'spear', offhand: 'wicker_shield', bone: true },
  wolf_pack: { kind: 'pack', ids: ['werewolf_black', 'werewolf_red', 'werewolf_white'] },
  constructs: { kind: 'pack', ids: ['robot_infantry', 'robot_swordsman'] },
  ironbreakers: { kind: 'hk', body: 'plate_harness', head: 'great_helm', weapon: 'battle_axe', offhand: 'iron_shield' },
  tide_guard: { kind: 'hk', body: 'bone_scale_coat', weapon: 'bone_harpoon' },
  horse_archers: { kind: 'hk', body: 'leather_armor', weapon: 'composite_bow', mounted: true },
  glamour_knights: { kind: 'hk', body: 'full_plate', head: 'visored_bascinet', weapon: 'arming_sword', offhand: 'heater_shield' },
  bombardiers: { kind: 'hk', body: 'alchemist_coat', weapon: 'blunderbuss' },
  templars: { kind: 'hk', body: 'plate_harness', head: 'great_helm', weapon: 'arming_sword', offhand: 'heater_shield' },
  briar_wardens: { kind: 'hk', cls: 'druid', weapon: 'oak_staff' },
  // the foes' own (data/troops.ts FOE_TROOPS)
  lair_beasts: { kind: 'beast', sheet: 'wolf', blocks: [0, 1, 2, 3] },
  great_beast: { kind: 'beast', sheet: 'bear', blocks: [0, 1] },
  levies: { kind: 'hk', weapon: 'wooden_club' },
  town_guard: { kind: 'hk', body: 'chainmail', head: 'nasal_helm', weapon: 'short_sword', offhand: 'iron_shield' },
  town_archers: { kind: 'hk', body: 'leather_armor', weapon: 'bow' },
};
/** A captain of a power, by its people: a pack hero where one suits, else a Himeko figure in plate. */
export const CAPTAIN_PACK: Record<string, string> = {
  knights: 'knight_1', nomads: 'horde_2', werewolf: 'werewolf_black', robot: 'robot_infantry', lich: 'skeleton_warrior', druid: 'wanderer_mage',
  fae: 'kitsune', alchemists: 'fire_wizard', brotherhood: 'pirate_leader',
};
export const CAPTAIN_LOOK: Record<string, TroopLook> = {
  vampire: { kind: 'hk', body: 'embroidered_robe', weapon: 'arming_sword', pale: true },
  dwarves: { kind: 'hk', body: 'plate_harness', head: 'great_helm', weapon: 'battle_axe', offhand: 'iron_shield' },
  merfolk: { kind: 'hk', body: 'scale_hauberk', weapon: 'iron_spear' },
  settlers: { kind: 'hk', body: 'plate_harness', head: 'great_helm', weapon: 'arming_sword', offhand: 'heater_shield' },
};
/** The lair's master and the pack. */
export const LAIR_MASTER = 'boar_king';

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
/** A generic soldier's look: the i-th of a kind differs in sex, skin and hair. */
function soldierLook(seed: number, pale: boolean, bone: boolean): Look {
  const g = seed % 3 === 1 ? 'f' : 'm';
  return {
    gender: g,
    skin: pale ? SKINS[0] : SKINS[seed % 8],
    hair: ['plain', 'ponytail', 'unkempt', 'bangs'][seed % 4],
    hairColor: HAIR_COLORS[(seed * 7) % HAIR_COLORS.length],
    beard: g === 'm' && seed % 3 === 0,
    outfit: '#7a5a3a',
    ...(bone ? { body: 'skeleton' as const } : {}),
  };
}
/** A troop kind's i-th soldier as a Himeko `who` (null for a creature kind). */
export function troopWho(troopId: string, i: number): HkWho | null {
  const look = TROOP_LOOKS[troopId];
  if (!look || look.kind !== 'hk') return null;
  const seed = (hash(troopId) + i * 97) % 10007;
  const gear: HkWho['gear'] = {};
  if (look.body && ITEM_BY_ID[look.body]) gear.body = look.body;
  if (look.head && ITEM_BY_ID[look.head]) gear.head = look.head;
  if (look.weapon && ITEM_BY_ID[look.weapon]) gear.weapon = look.weapon;
  if (look.offhand && ITEM_BY_ID[look.offhand]) gear.offhand = look.offhand;
  return { id: 900000 + seed, look: soldierLook(seed, !!look.pale, !!look.bone), gear, cls: look.cls ?? null, stage: 1, founder: false, monster: look.bone ? 'undead' : null, child: false, traveller: false, eyeLost: false, scarred: false };
}
/** A captain of `origin` (a power's, or the town's own) as a Himeko `who`, when no pack hero stands for them. */
export function captainWho(origin: string, i: number): HkWho | null {
  const look = CAPTAIN_LOOK[origin] ?? CAPTAIN_LOOK.settlers;
  if (look.kind !== 'hk') return null;
  const seed = (hash(`captain:${origin}`) + i * 31) % 10007;
  const gear: HkWho['gear'] = {};
  if (look.body) gear.body = look.body;
  if (look.head) gear.head = look.head;
  if (look.weapon) gear.weapon = look.weapon;
  if (look.offhand) gear.offhand = look.offhand;
  return { id: 910000 + seed, look: soldierLook(seed, !!look.pale, false), gear, cls: null, stage: 3, founder: true, monster: null, child: false, traveller: false, eyeLost: false, scarred: false };
}

/** Draw a troop kind's i-th soldier, feet at (cx, feetY), `height` tall (a rider and horse a little wider). */
export function drawTroop(g: CanvasRenderingContext2D, troopId: string, i: number, facing: Facing, cx: number, feetY: number, height: number): boolean {
  const look = TROOP_LOOKS[troopId];
  if (!look) return false;
  if (look.kind === 'pack') return drawPack(g, look.ids[i % look.ids.length], facing, cx, feetY, height);
  if (look.kind === 'beast') return drawBeast(g, look.sheet, look.blocks[i % look.blocks.length], facing, cx, feetY, height * 0.8);
  const who = troopWho(troopId, i);
  if (!who) return false;
  if (look.mounted) {
    const horse = drawBeast(g, 'horse', i % 8, facing, cx, feetY, height * 0.9);
    const rider = drawWho(g, who, facing, cx + (facing === 'right' ? -height * 0.04 : facing === 'left' ? height * 0.04 : 0), feetY - height * 0.42, height * 0.78);
    return horse || rider;
  }
  return drawWho(g, who, facing, cx, feetY, height);
}
/** Draw a captain of a power: its pack hero, else a figure in plate. */
export function drawCaptain(g: CanvasRenderingContext2D, origin: string, i: number, facing: Facing, cx: number, feetY: number, height: number): boolean {
  const pack = CAPTAIN_PACK[origin];
  if (pack) return drawPack(g, pack, facing, cx, feetY, height);
  const who = captainWho(origin, i);
  return who ? drawWho(g, who, facing, cx, feetY, height) : false;
}

/** The war's own colours. */
export const REALM_COLOURS = ['#ffd24a', '#d04a4a', '#4a7ad0', '#8a4ad0', '#2ab0a0', '#d04a9a', '#7aa02a', '#c86a1a', '#4ab0d0', '#a05a3a', '#e8e8e8', '#6a6ad0'];
