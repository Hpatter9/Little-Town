// The lights in the buildings' pictures (the owner's ask: windows at night glow as if there are lights inside, and
// torches and lights flicker properly). Placed by hand on each kit piece that has windows, for the five peoples one can
// play (settlers, dwarves, knights, the liches' necropolis, the Blood Court) and the shared pieces (art/iso/buildings/):
// each a window's middle and size in the piece's own px, and what it is. Pure (no Pixi, no page), so the tests can
// check it; iso/isoView.ts draws a warm glow on each after dark. A kit with no entry here keeps the old guess
// (iso/isoLight.ts `windowSpots`).

/** What a light in a picture is: a window (lit while someone is inside), a flame on the building (a brazier, a
 *  lantern hung by the door: lit all night), a forge's mouth (lit all night, orange whatever the people), or an electric
 *  window (lit while someone is inside, and steady). */
export type LightKind = 'window' | 'flame' | 'forge' | 'electric';
const KINDS: readonly LightKind[] = ['window', 'flame', 'forge', 'electric'];

/** [x, y, w, h] of a light's middle and size in the piece's px, then its kind (`KINDS`' index; none: a window). */
type Raw = readonly [number, number, number, number, number?];

const RAW: Readonly<Record<string, readonly Raw[]>> = {
  'settlers/chapel': [[68, 130, 5, 10], [139, 187, 7, 18], [172, 173, 7, 18], [203, 157, 7, 18], [70, 165, 12, 10]],
  'settlers/cottage': [[89, 101, 12, 15]],
  'settlers/longhouse': [[39, 126, 9, 15], [131, 170, 12, 15], [206, 130, 10, 13]],
  'settlers/tavern': [[70, 79, 10, 13], [141, 107, 7, 11], [88, 158, 9, 9], [156, 146, 8, 8], [121, 160, 6, 7]],
  'settlers/workshop': [[175, 150, 10, 12], [84, 152, 14, 16, 2]],
  'dwarves/ale_hall': [[20, 94, 6, 14], [62, 112, 6, 12], [80, 117, 6, 10], [125, 127, 6, 12], [146, 132, 10, 16, 1], [68, 168, 8, 14]],
  'dwarves/cottage': [[145, 123, 6, 10], [170, 142, 6, 10], [81, 163, 8, 14], [100, 163, 8, 14], [65, 157, 5, 12]],
  'dwarves/forge': [[132, 200, 18, 22, 2], [100, 189, 5, 14], [160, 184, 4, 14], [37, 190, 8, 10, 1]],
  'dwarves/granary': [[24, 93, 6, 12]],
  'dwarves/great_hall': [[32, 168, 8, 14], [58, 195, 10, 10, 1], [147, 235, 10, 10, 1], [203, 203, 8, 16], [235, 196, 8, 16]],
  'dwarves/mine_entrance': [[120, 178, 8, 12, 1], [210, 145, 8, 12, 1]],
  'dwarves/shrine': [[30, 149, 12, 10, 1], [103, 160, 12, 10, 1]],
  'dwarves/watchtower': [[55, 109, 6, 14], [110, 112, 6, 14], [24, 166, 10, 10, 1], [144, 166, 10, 10, 1], [59, 189, 6, 10]],
  'knights/barracks': [[129, 106, 6, 10], [178, 83, 6, 10], [223, 62, 6, 10], [70, 167, 8, 12], [126, 146, 8, 14], [161, 136, 8, 14], [189, 120, 8, 14], [222, 108, 8, 12]],
  'knights/chapel': [[32, 217, 8, 24], [56, 225, 8, 22], [78, 236, 8, 20], [111, 139, 6, 14], [136, 138, 6, 14], [111, 239, 5, 16]],
  'knights/cottage': [[158, 82, 8, 12], [69, 106, 6, 8], [118, 127, 6, 10], [144, 128, 6, 10], [179, 110, 6, 10]],
  'knights/gatehouse': [[62, 158, 6, 10, 1], [166, 183, 6, 10, 1], [29, 156, 4, 8], [202, 188, 4, 8], [243, 105, 4, 8]],
  'knights/granary': [[42, 78, 6, 10], [82, 83, 6, 10]],
  'knights/longhouse': [[98, 139, 8, 14], [192, 137, 12, 14], [146, 140, 8, 12], [33, 113, 8, 14]],
  'knights/tavern': [[171, 79, 8, 12], [202, 78, 8, 12], [111, 97, 8, 14], [45, 109, 8, 12], [68, 120, 8, 12], [102, 127, 8, 14], [129, 138, 8, 14], [162, 140, 6, 10], [200, 124, 6, 10], [81, 190, 14, 18]],
  'knights/watchtower': [[60, 122, 4, 10], [105, 158, 4, 10]],
  'knights/workshop': [[94, 152, 22, 22, 2]],
  'liches/chapel': [[98, 108, 6, 16], [122, 108, 6, 16], [72, 226, 16, 40], [155, 233, 12, 36], [26, 170, 5, 14], [186, 236, 5, 14], [128, 267, 5, 14]],
  'liches/cottage': [[63, 131, 6, 12], [160, 135, 6, 12], [66, 177, 8, 18], [100, 172, 6, 12], [121, 172, 6, 12], [158, 168, 6, 12]],
  'liches/gatehouse': [[25, 179, 8, 14, 1], [196, 231, 8, 14, 1], [238, 150, 8, 22], [202, 154, 5, 14]],
  'liches/granary': [[104, 133, 6, 14], [121, 121, 5, 12]],
  'liches/longhouse': [[112, 158, 6, 12], [160, 131, 6, 12], [51, 211, 14, 24], [49, 167, 5, 10]],
  'liches/mausoleum': [[113, 117, 6, 10], [118, 162, 10, 30], [92, 160, 6, 16]],
  'liches/tavern': [[99, 138, 6, 12], [112, 143, 6, 12], [134, 156, 6, 12], [146, 163, 6, 12], [78, 80, 5, 8], [145, 115, 5, 8], [178, 202, 6, 12], [186, 202, 6, 12], [208, 144, 5, 10], [31, 166, 8, 14, 1], [68, 186, 8, 14, 1], [108, 207, 6, 12, 1]],
  'liches/watchtower': [[50, 170, 8, 22], [43, 104, 5, 6], [84, 112, 5, 6]],
  'liches/workshop': [[51, 135, 8, 14], [61, 203, 10, 16], [159, 124, 10, 14, 2]],
  'bloodcourt/chapel': [[76, 170, 26, 26], [35, 226, 6, 24], [105, 245, 6, 22], [134, 249, 8, 26], [168, 214, 10, 40], [198, 206, 10, 40], [134, 206, 5, 10], [114, 133, 4, 10]],
  'bloodcourt/cottage': [[108, 101, 6, 14], [161, 99, 5, 12], [37, 144, 8, 22], [55, 147, 5, 12], [78, 151, 5, 12], [141, 156, 5, 10], [161, 147, 8, 22]],
  'bloodcourt/crypt': [[56, 154, 6, 10, 1], [140, 181, 6, 10, 1], [100, 148, 12, 26], [217, 160, 12, 26]],
  'bloodcourt/gatehouse': [[38, 93, 6, 10], [65, 94, 5, 10, 1], [63, 132, 4, 8], [81, 134, 4, 8], [185, 142, 6, 12], [212, 146, 6, 12], [212, 177, 4, 8]],
  'bloodcourt/granary': [[25, 134, 4, 12], [91, 156, 4, 10]],
  'bloodcourt/longhouse': [[45, 154, 8, 30], [63, 165, 8, 26], [111, 165, 8, 22], [155, 147, 8, 26], [187, 133, 6, 20], [206, 124, 4, 10], [93, 176, 5, 12], [127, 161, 5, 10]],
  'bloodcourt/tavern': [[81, 101, 6, 12], [139, 117, 6, 14], [110, 136, 6, 14], [139, 151, 6, 14], [80, 136, 5, 12], [168, 158, 6, 12], [209, 140, 6, 14], [96, 185, 6, 12], [135, 203, 8, 16], [168, 197, 6, 16]],
  'bloodcourt/watchtower': [[60, 115, 24, 10, 1], [77, 149, 4, 10]],
  'bloodcourt/workshop': [[103, 104, 6, 14], [102, 158, 16, 20, 2]],
  'buildings/drone_hub': [[137, 57, 5, 8, 3]],
  'buildings/harbour': [[172, 45, 5, 8, 1]],
  'buildings/mission_control': [[52, 151, 18, 22, 3], [87, 157, 18, 24, 3], [143, 157, 20, 28, 3], [182, 162, 18, 28, 3]],
};

export interface PictureLight {
  x: number;
  y: number;
  w: number;
  h: number;
  kind: LightKind;
}

const keyOf = (kit: string, piece: string, shared: boolean): string => (shared ? `buildings/${piece}` : `${kit}/${piece}`);
const made = new Map<string, PictureLight[]>();
/** The lights in a kit's piece (a shared piece's are under `buildings/`), or none. */
export function lightsIn(kit: string, piece: string, shared: boolean): readonly PictureLight[] {
  const key = keyOf(kit, piece, shared);
  let had = made.get(key);
  if (!had) {
    had = (RAW[key] ?? []).map(([x, y, w, h, k]) => ({ x, y, w, h, kind: KINDS[k ?? 0] }));
    made.set(key, had);
  }
  return had;
}
/** Whether a piece's lights were placed by hand (else the old guess stands in). */
export const placed = (kit: string, piece: string, shared: boolean): boolean => keyOf(kit, piece, shared) in RAW;
/** Every piece with lights placed (for the tests). */
export const PLACED: readonly string[] = Object.keys(RAW);

/** The colour a light glows: a people's own (the necropolis's ghost-green, the Blood Court's red) for windows and
 *  flames, a forge always orange, electric light a cool white. */
export function lightTint(kit: string, kind: LightKind): number {
  if (kind === 'forge') return 0xff8a30;
  if (kind === 'electric') return 0xdcecff;
  if (kit === 'liches') return kind === 'flame' ? 0x60ffc8 : 0x80ffd8;
  if (kit === 'bloodcourt') return kind === 'flame' ? 0xff6030 : 0xff7048;
  return kind === 'flame' ? 0xffa040 : 0xffc870;
}

/** The flicker kind (map/flicker.ts) a light wavers with. */
export const flickerKind = (kind: LightKind): string => (kind === 'flame' ? 'brazier' : kind === 'forge' ? 'forge' : kind === 'electric' ? 'electric lamp' : 'candle');

/** Until this hour a tavern or a shop keeps its lights on of an evening, whoever the sim says is inside. */
export const VENUE_OPEN_UNTIL = 23;

/** Is a light lit after dark? Flames and forges burn all night; a window shows while someone is inside, and a venue's
 *  (a tavern, a shop) of an evening until `VENUE_OPEN_UNTIL`. */
export function isLit(kind: LightKind, inside: boolean, venue: boolean, hour: number): boolean {
  if (kind === 'flame' || kind === 'forge') return true;
  return inside || (venue && hour >= 12 && hour < VENUE_OPEN_UNTIL);
}

/** Where a light in a piece lies on the screen: the piece drawn anchored at the middle of its bottom edge at (sx, sy),
 *  `k` its scale, mirrored if `flip`, its picture `texW` by `texH` px (a shared piece's soil cut off below). */
export function lightAt(l: PictureLight, texW: number, texH: number, k: number, flip: boolean, sx: number, sy: number): { x: number; y: number; w: number; h: number } {
  return { x: sx + (l.x - texW / 2) * k * (flip ? -1 : 1), y: sy + (l.y - texH) * k, w: l.w * k, h: l.h * k };
}
