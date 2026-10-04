// The ground's detail from the packs, drawn into the map's chunks (map/groundArt.ts): the Path and Road pack's
// ground patches (five colour bands of lighter spots, each a flat colour: the plain ground under them is that colour
// darkened a little, so the spots read as the pack meant them), the Fields pack's grass tufts, flowers and small
// stones scattered over the grass, and the Undead pack's water ripples (its green lines, recoloured to the water's
// light) over the water. Until the images load, the ground is painted plain.

import { loadImage } from './loadImage';
import groundGrass from './roads/ground_grass.png';
import ripplesUrl from './water/ripples.png';
import tuft1 from './fields/tuft1.png';
import tuft2 from './fields/tuft2.png';
import tuft3 from './fields/tuft3.png';
import tuft4 from './fields/tuft4.png';
import tuft5 from './fields/tuft5.png';
import tuft6 from './fields/tuft6.png';
import flower1 from './fields/flower1.png';
import flower2 from './fields/flower2.png';
import flower3 from './fields/flower3.png';
import flower4 from './fields/flower4.png';
import flower5 from './fields/flower5.png';
import flower6 from './fields/flower6.png';
import flower7 from './fields/flower7.png';
import flower8 from './fields/flower8.png';
import flower9 from './fields/flower9.png';
import flower10 from './fields/flower10.png';
import flower11 from './fields/flower11.png';
import flower12 from './fields/flower12.png';
import pebble1 from './fields/pebble1.png';
import pebble2 from './fields/pebble2.png';
import pebble3 from './fields/pebble3.png';
import pebble4 from './fields/pebble4.png';
import pebble5 from './fields/pebble5.png';
import pebble6 from './fields/pebble6.png';

const TUFTS = [tuft1, tuft2, tuft3, tuft4, tuft5, tuft6];
const FLOWERS = [flower1, flower2, flower3, flower4, flower5, flower6, flower7, flower8, flower9, flower10, flower11, flower12];
const PEBBLES = [pebble1, pebble2, pebble3, pebble4, pebble5, pebble6];
const ALL = [groundGrass, ripplesUrl, ...TUFTS, ...FLOWERS, ...PEBBLES];

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;
export function loadGroundDetail(): Promise<void> {
  if (!loading) loading = Promise.all(ALL.map((u) => loadImage(u).then((im) => images.set(u, im), () => undefined))).then(() => undefined);
  return loading;
}
export const groundDetailReady = () => images.size === ALL.length;

/** The pack's patch bands: each a flat colour, the left and right halves of the sheet two colours a band. */
export type Patch = 'grass' | 'meadow' | 'teal' | 'leaf' | 'olive' | 'soil' | 'loam' | 'chalk' | 'sand' | 'peat';
/** Each patch kind's band and side, and its colour (the sheet's flat fill). */
const BANDS: Record<Patch, { band: number; side: 'l' | 'r'; colour: string }> = {
  grass: { band: 0, side: 'l', colour: '#a0b35a' },
  meadow: { band: 1, side: 'l', colour: '#7aad55' },
  teal: { band: 2, side: 'l', colour: '#60aaa2' },
  leaf: { band: 3, side: 'l', colour: '#489461' },
  olive: { band: 4, side: 'l', colour: '#90a347' },
  soil: { band: 0, side: 'r', colour: '#b47c43' },
  loam: { band: 1, side: 'r', colour: '#967e5d' },
  chalk: { band: 2, side: 'r', colour: '#ececdb' },
  sand: { band: 3, side: 'r', colour: '#c5b997' },
  peat: { band: 4, side: 'r', colour: '#7c7538' },
};
/** The shapes in a band (x, y within the band, w, h) that stand alone as patches: the round blobs (left side in the first band; the rest sit 16px further right; right side the same in every band). The sheet's
 *  other shapes are edge pieces (a square with a hole, an arch, a fringe with a straight side): laid loose they read
 *  as squares on the ground, so they're left out. */
const LEFT: [number, number, number, number][] = [[19, 3, 43, 43]];
const RIGHT: [number, number, number, number][] = [[154, 10, 29, 29]];
const BAND_H = 96;
const BAND_Y0 = 16;

/** A patch kind's flat colour, and the plain ground that goes under it (the same, a little darker). */
export const patchColour = (p: Patch) => BANDS[p].colour;
export function groundUnder(p: Patch, darken = 0.14): string {
  const c = BANDS[p].colour;
  const v = (i: number) => Math.round(parseInt(c.slice(i, i + 2), 16) * (1 - darken));
  return `rgb(${v(1)}, ${v(3)}, ${v(5)})`;
}

/** Draw one of a kind's patches (`n` picks which) with its top-left at (x, y), at `scale`, kept inside a canvas of
 *  `room` px (so a chunk's edge never cuts one off straight). Null until the sheet has loaded. */
export function drawPatch(g: CanvasRenderingContext2D, kind: Patch, n: number, x: number, y: number, scale = 1, room = Infinity): { w: number; h: number } | null {
  const im = images.get(groundGrass);
  if (!im) return null;
  const b = BANDS[kind];
  const shapes = b.side === 'l' ? LEFT : RIGHT;
  const s = shapes[((n % shapes.length) + shapes.length) % shapes.length];
  const sx = s[0] + (b.side === 'l' && b.band ? 16 : 0);
  const sy = BAND_Y0 + b.band * BAND_H + s[1];
  const w = Math.max(4, Math.round(s[2] * scale));
  const h = Math.max(4, Math.round(s[3] * scale));
  const dx = Math.max(0, Math.min(x, room - w));
  const dy = Math.max(0, Math.min(y, room - h));
  g.drawImage(im, sx, sy, s[2], s[3], dx, dy, w, h);
  return { w, h };
}

/** The Fields pack's small things on the grass: a tuft, a flower or a pebble (`n` picks which), its middle at (x, y). */
export function drawTuft(g: CanvasRenderingContext2D, kind: 'tuft' | 'flower' | 'pebble', n: number, x: number, y: number): boolean {
  const list = kind === 'tuft' ? TUFTS : kind === 'flower' ? FLOWERS : PEBBLES;
  const im = images.get(list[((n % list.length) + list.length) % list.length]);
  if (!im) return false;
  g.drawImage(im, Math.round(x - im.naturalWidth / 2), Math.round(y - im.naturalHeight / 2));
  return true;
}

/** The ripple shapes on the cropped sheet (x, y, w, h): the three that fit a cell or two. */
const RIPPLES: [number, number, number, number][] = [
  [522, 8, 69, 15],
  [624, 10, 47, 11],
  [395, 7, 102, 17],
];
const tinted = new Map<string, HTMLCanvasElement>();
/** A ripple (`n` picks which) in `colour`, its left end at (x, y), kept within `maxW` px (longer ones are skipped). */
export function drawRipple(g: CanvasRenderingContext2D, n: number, x: number, y: number, colour: string, maxW: number): boolean {
  const im = images.get(ripplesUrl);
  if (!im) return false;
  const r = RIPPLES[((n % RIPPLES.length) + RIPPLES.length) % RIPPLES.length];
  if (r[2] > maxW) return false;
  let c = tinted.get(colour);
  if (!c) {
    c = document.createElement('canvas');
    c.width = im.naturalWidth;
    c.height = im.naturalHeight;
    const t = c.getContext('2d')!;
    t.drawImage(im, 0, 0);
    t.globalCompositeOperation = 'source-in';
    t.fillStyle = colour;
    t.fillRect(0, 0, c.width, c.height);
    tinted.set(colour, c);
  }
  g.drawImage(c, r[0], r[1], r[2], r[3], x, y, r[2], r[3]);
  return true;
}
