// Each townsperson's own colours on the isometric looks, by baking. A look's sheets are labelled ahead of time
// (tools/folk-roles.py writes a roles.json beside each look's index.json): which colours of each sheet paint the skin,
// the hair (and beard), the main cloth and a second cloth (breeches, a skirt). A person's tint is the colour each of
// those turns into: their own skin and hair from their sim look (children inherit them from their parents; the
// founder's are the player's pick), and cloth dyed from their people's dyes by a stable hash of their id. The sheets
// are recoloured ONCE per (look, tint) on a canvas and cached as textures, so a person costs nothing extra per frame.
//
// Each colour is moved to its target keeping the art's shading: its hue, saturation and lightness are taken as an
// offset from the look's own average for that role (the roles.json `ref`) and laid on the target. So a dark-haired
// look given blonde hair keeps its strands and shadows, and a grey tunic dyed madder keeps its folds.
//
// Variety stays natural: skins run pale to deep brown, hair black, brown, auburn, ginger, blonde, ash and the greys of
// age, and the dyes are the ones a village had. The peoples with a colour of their own (orcs, liches, vampires, the
// Moon Pack, machines, merfolk, the fae) are not recoloured at all, and nor is a look with no roles.json. Pure pixel
// maths here (the tests run it); the canvas work is in folkLoader.ts and art/folkPortrait.ts.

import { CLOTH_COLORS, HAIR_CHOICES, HAIR_COLORS, SKINS, type Look } from '../../shared/data/people';
import type { LifeStage } from '../../shared/sim/ageing';
import { idHash, ownFittedLook, type FolkState } from './folkRules';

/** What a colour in the art paints. `brow` is the hair across the face (brows, moustache, beard): the hair's colour,
 *  toned a little towards the skin. */
export type FolkRole = 'skin' | 'hair' | 'cloth' | 'cloth2' | 'brow';
export const FOLK_ROLES: readonly FolkRole[] = ['skin', 'hair', 'cloth', 'cloth2', 'brow'];

/** What each role turns into ('#rrggbb'); a role left out keeps the art's colour (`brow` follows skin and hair). */
export type FolkTint = Partial<Record<Exclude<FolkRole, 'brow'>, string>>;
const TINTED: readonly Exclude<FolkRole, 'brow'>[] = ['skin', 'hair', 'cloth', 'cloth2'];

/** A look's labels (its roles.json): the look's own average colour per role (hue, saturation, lightness), and each
 *  sheet's colours by role ('rrggbb'). */
export interface FolkRoles {
  ref: Partial<Record<FolkRole, [number, number, number]>>;
  sheets: Record<string, Partial<Record<FolkRole, string[]>>>;
}

/** The peoples drawn as their art has them (their skin, hair and dress are their own colour). */
export const FIXED_CASTS: ReadonlySet<string> = new Set(['orcs', 'lich', 'vampire', 'werewolf', 'robot', 'merfolk', 'fae']);

/* ------------------------------------------------------------ the dyes */

// The cloth a village dyes: madder red, woad blue (light and dark), weld yellow, green (woad over weld), russet,
// undyed wool and linen, grey, black and walnut brown. Each people has its own share of them.
const MADDER = '#8a2e26', WOAD = '#3a5880', DARK_WOAD = '#283a5a', WELD = '#b8963a', GREEN = '#4a6a32', RUSSET = '#8a4e2c';
const UNDYED = '#c4b694', GREY = '#7a7670', BLACK = '#2e2b29', BROWN = '#6a4a30';

/** Each people's dyes for the main cloth (a people not listed uses the settlers'). */
export const DYES: Record<string, readonly string[]> = {
  settlers: [MADDER, WOAD, DARK_WOAD, WELD, GREEN, RUSSET, UNDYED, GREY, BLACK, BROWN],
  druid: [GREEN, '#5e7a3a', '#6a6a34', '#3a5a3e', BROWN, RUSSET, UNDYED, GREY],
  nomads: ['#2e3a6a', WOAD, MADDER, '#b8862a', '#a86a2a', BROWN, BLACK, UNDYED, '#2e5a5a'],
  alchemists: ['#5a3a6a', '#6a2a4a', '#2e6a6a', WOAD, GREEN, BROWN, BLACK, MADDER],
  knights: ['#9a2a26', '#2e4a8a', '#3a6a3a', WELD, BLACK, '#5a3a6a', '#d8d4c8'],
};
/** The dyes of someone whose fitted look is drawn (iso/folkRules.ts `ownFittedLook`), to suit it: the maiden's dress
 *  bright, the hunter's cloak the woods' greens and browns, the farmer's smock and the smith's shirt plain work cloth,
 *  the elders' dress sober. Theirs in armour too, so their colours never change with what they wear. Everyone else
 *  takes their people's dyes. (The elders' grey hair is drawn, and not relabelled: tools/folk-roles.py.) */
export const LOOK_DYES: Record<string, readonly string[]> = {
  woman_maiden: [MADDER, WOAD, WELD, GREEN, '#b04a6a', '#c06a2a', '#3a7a8a'],
  woman_hunter: [GREEN, '#5e6a3a', '#4a5a34', BROWN, RUSSET, '#5a4a2a'],
  man_farmer: [UNDYED, WELD, BROWN, GREY, GREEN, RUSSET],
  man_smith: [UNDYED, GREY, BROWN, DARK_WOAD, BLACK],
  man_elder: [BROWN, GREY, DARK_WOAD, UNDYED, BLACK, GREEN],
  woman_elder: [DARK_WOAD, BROWN, GREY, MADDER, BLACK, UNDYED],
};

/** The second cloth (breeches, a skirt): plainer stuff. */
export const PLAIN_DYES: readonly string[] = ['#5a4a3a', '#6a5a48', '#4a4440', '#7a6a54', '#3a3430', '#8a7a60', '#5a5048', '#3e4a5a'];
/** Hair in age: grey and white. */
export const OLD_HAIR: readonly string[] = ['#d8d4cc', '#b8b2a8', '#9a948c', '#ece8e0'];

/** The dyed cloths a founder can be dressed in (data/people.ts): worn as chosen. */
const CHOSEN_CLOTH: ReadonlySet<string> = new Set(CLOTH_COLORS.map((c) => c.toLowerCase()));

/** The greys among the everyday hair colours, and the rest (a young head's). A founder's white dye is not one. */
const GREYS: ReadonlySet<string> = new Set(HAIR_COLORS.filter((c) => { const [, s, l] = rgbToHsl(...hexRgb(c)); return s < 0.12 && l > 0.4; }));
const YOUNG_HAIR: readonly string[] = HAIR_COLORS.filter((c) => !GREYS.has(c));

/** Snap a colour to the nearest of a list (so the cache holds one recolour per list entry, not per stray hex). */
function nearest(hex: string, list: readonly string[]): string {
  const [r, g, b] = hexRgb(hex);
  let best = list[0], d = Infinity;
  for (const c of list) {
    const [r2, g2, b2] = hexRgb(c);
    const e = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (e < d) { d = e; best = c; }
  }
  return best;
}

/** The hair the deeper skins wear (natural in a medieval crowd, and it keeps the art's limits out of sight: platinum
 *  and white hair on the darkest skin show the face's every shading pixel). The deepest two of `SKINS` take black,
 *  the browns and auburn (and a mid grey in age); medium-brown skin (the three above them) up to light brown or ginger
 *  (and the middling greys); the lighter skins any. Null: any hair. */
export const DEEP_SKINS = 2;
export const MEDIUM_SKINS = 3;
const DARK_HAIR: readonly string[] = ['#1a1414', '#2a1c14', '#3c3434', '#4a3020', '#5a4636', '#6e4a2c', '#8a3a22'];
const MEDIUM_HAIR: readonly string[] = [...DARK_HAIR, '#9a6e40', '#b0542a'];
export function hairFor(skinIndex: number, aged: boolean): readonly string[] | null {
  const deep = skinIndex >= SKINS.length - DEEP_SKINS, medium = !deep && skinIndex >= SKINS.length - DEEP_SKINS - MEDIUM_SKINS;
  if (deep) return aged ? ['#9a948c'] : DARK_HAIR;
  if (medium) return aged ? ['#9a948c', '#b8b2a8'] : MEDIUM_HAIR;
  return null;
}

/** Someone's colours, from what the snapshot says about them: their sim look (skin, hair colour, a founder's chosen
 *  cloth), their age (grey hair for the elders: about half of them, and all the old), their id (the dyes) and their
 *  fitted look, once drawn (LOOK_DYES). Null for the peoples drawn in their own colours. Stable: the same person always
 *  gets the same tint. */
export function tintOf(st: { id: number; look?: Partial<Pick<Look, 'gender' | 'skin' | 'hairColor' | 'outfit' | 'body'>>; lifeStage?: LifeStage } & Partial<Pick<FolkState, 'origin' | 'typeName' | 'growsUpIn'>>, people = 'settlers'): FolkTint | null {
  if (FIXED_CASTS.has(people)) return null;
  const look = st.look ?? {};
  const t: FolkTint = {};
  // (a founder in a bone or orc body keeps the art's skin; anyone else's is theirs, snapped to the natural skins)
  if (look.skin && !look.body) t.skin = nearest(look.skin, SKINS);
  const old = st.lifeStage === 'old' || st.lifeStage === 'elder';
  const grey = st.lifeStage === 'old' || (st.lifeStage === 'elder' && idHash(st.id, 17) % 2 === 0);
  if (grey) t.hair = OLD_HAIR[idHash(st.id, 19) % OLD_HAIR.length];
  else if (look.hairColor) {
    t.hair = nearest(look.hairColor, HAIR_CHOICES);
    // (grey hair rolled for an elder recruit, or handed down to a child, is a colour of youth until they're old)
    if (!old && GREYS.has(t.hair)) t.hair = YOUNG_HAIR[idHash(st.id, 23) % YOUNG_HAIR.length];
  }
  // (the deepest skins wear the darker hair, and medium-brown skin no fairer than light brown or ginger)
  if (t.skin && t.hair) {
    const allowed = hairFor(SKINS.indexOf(t.skin), grey);
    if (allowed && !allowed.includes(t.hair)) t.hair = nearest(t.hair, allowed);
  }
  const fit = people === 'settlers' && st.look?.gender ? ownFittedLook({ ...st, look: { gender: st.look.gender, outfit: st.look.outfit ?? '' } }) : null;
  const dyes = (fit && LOOK_DYES[fit]) || DYES[people] || DYES.settlers;
  // (a founder dressed in a dyed cloth of the player's choosing wears it)
  t.cloth = look.outfit && CHOSEN_CLOTH.has(look.outfit.toLowerCase()) ? look.outfit.toLowerCase() : dyes[idHash(st.id, 11) % dyes.length];
  t.cloth2 = PLAIN_DYES[idHash(st.id, 13) % PLAIN_DYES.length];
  return t;
}

/** A tint's cache key ('0' for none: the art as drawn). */
export const tintKey = (t: FolkTint | null): string => (t ? TINTED.map((r) => (t[r] ?? '').replace('#', '')).join('.') : '0');

/* ------------------------------------------------------------ the pixel maths */

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [(h * 60 + 360) % 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

export function hexRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));

/** One colour of a role moved to the target, keeping its place in the art's shading: its offset from the look's own
 *  average (`ref`) is laid on the target (hue half as far, so a ramp's warm shadows stay warm but never wander;
 *  saturation in proportion; lightness scaled so the ramp fits between black and white). */
export function shade(r: number, g: number, b: number, ref: readonly [number, number, number], target: string): [number, number, number] {
  const [h, s, l] = rgbToHsl(r, g, b);
  const [th, ts, tl] = rgbToHsl(...hexRgb(target));
  // (a grey's hue means nothing: a grey role, or a grey pixel in one, takes the target's hue and saturation flat)
  const grey = ref[1] < 0.1 || s < 0.06;
  const dh = grey ? 0 : ((h - ref[0] + 540) % 360) - 180;
  const nh = (th + dh * 0.5 + 360) % 360;
  const ns = clamp(ts * (grey ? 1 : clamp(s / ref[1], 0.5, 1.6)), 0, 1);
  const k = clamp(Math.min(tl / Math.max(ref[2], 0.05), (1 - tl) / Math.max(1 - ref[2], 0.05)), 0.5, 1.4);
  const nl = clamp(tl + (l - ref[2]) * k, 0.03, 0.95);
  return hslToRgb(nh, ns, nl);
}

/** The colour changes for one sheet and tint: packed 0xrrggbb from, to. Empty if nothing changes. */
export function sheetMap(roles: FolkRoles | null, sheet: string, tint: FolkTint | null): Map<number, number> {
  const out = new Map<number, number>();
  const own = roles?.sheets[sheet];
  if (!tint || !own) return out;
  for (const role of FOLK_ROLES) {
    const target = role === 'brow' ? browOf(roles, tint) : tint[role], ref = roles.ref[role], hexes = own[role];
    if (!target || !ref || !hexes) continue;
    for (const hx of hexes) {
      const from = parseInt(hx, 16);
      const [r, g, b] = shade((from >> 16) & 255, (from >> 8) & 255, from & 255, ref, target);
      out.set(from, (r << 16) | (g << 8) | b);
    }
  }
  return out;
}

/** The colour of the hair across the face: the hair's, its lightness taken a third of the way to the skin's, so fair
 *  brows and a fair beard on a dark face (or black ones on a pale face) read as hair, not as a mask. */
export const BROW_PULL = 0.3;
function browOf(roles: FolkRoles, tint: FolkTint): string | undefined {
  if (!tint.hair) return undefined;
  const [hh, hs, hl] = rgbToHsl(...hexRgb(tint.hair));
  const skin = tint.skin ? rgbToHsl(...hexRgb(tint.skin)) : roles.ref.skin;
  const l = skin ? hl + (skin[2] - hl) * BROW_PULL : hl;
  const [r, g, b] = hslToRgb(hh, hs, l);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/** Recolour RGBA bytes in place by a sheet map (sheetMap). A colour not in the map, and a clear pixel, stay. */
export function recolour(data: Uint8ClampedArray | Uint8Array, map: Map<number, number>): void {
  if (map.size === 0) return;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] === 0) continue;
    const to = map.get((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
    if (to === undefined) continue;
    data[i] = to >> 16; data[i + 1] = (to >> 8) & 255; data[i + 2] = to & 255;
  }
}
