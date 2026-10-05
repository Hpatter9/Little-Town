// Buildings seen from the top-down map's angle, for everything no pack has a picture of: a roof plane seen from
// above (foreshortened, lit at the ridge, shaded toward the eaves) with the front wall below it on the footprint's
// bottom edge, the way the Craftpix top-down houses are drawn. One builder with a few shapes (a pitched house, a big
// hall, a flat modern block, a round tower, a dome, a wall, a pad) and the materials of the era the building belongs
// to (thatch and wattle, tile and timber, slate and brick, concrete, metal), with a topper or two by its id (chimney,
// stacks, sails, a dish, a barrel, a rocket); then each origin's materials swapped in (originStyles.ts `reclad`).

import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { eraOfResearch } from '../../shared/data/research';
import { ERAS, type Era } from '../../shared/data/eras';
import { reclad, type Style } from './originStyles';
import { mixHex as mix, paint, type Painter, type PixelArt, type Tone } from './pixelArt';

/** The eaves' overhang past the footprint, each side (px). */
export const EAVE = 4;
/** How far the ridge stands above the footprint's top edge (px): the roof's height, seen at this angle. */
export const LIFT = 12;
/** The lit window colour (pixelArt.ts LAMPS: it glows at night). */
export const WINDOW = '#f0d890';

export type Shape = 'house' | 'hall' | 'flat' | 'tower' | 'dome' | 'wall' | 'pad' | 'works';

/** The materials of an era: roof (light, dark), wall (light, dark), trim. The usual colours: originStyles.ts swaps
 *  them for each origin's. */
export interface Mats {
  roof: [string, string];
  wall: [string, string];
  trim: string;
  /** How the roof is covered: thatch bands, tile courses, slate courses, flat panels. */
  cover: 'thatch' | 'tile' | 'slate' | 'panel';
}
export const MATS: Record<Era, Mats> = {
  neolithic: { roof: ['#b89a58', '#8a7040'], wall: ['#d8c8a8', '#77502f'], trim: '#5a3a22', cover: 'thatch' },
  medieval: { roof: ['#a4543a', '#6a3424'], wall: ['#d8c8a8', '#e8dcc0'], trim: '#5a3a22', cover: 'tile' },
  industrial: { roof: ['#6a6e78', '#454a54'], wall: ['#a4543a', '#6a3424'], trim: '#3b2616', cover: 'slate' },
  modern: { roof: ['#9a9a94', '#74746e'], wall: ['#b4b4ae', '#8c8c86'], trim: '#5a5a56', cover: 'panel' },
  space: { roof: ['#8a96a4', '#5a6470'], wall: ['#b8c4d0', '#6a7684'], trim: '#3a4450', cover: 'panel' },
};

/** What shape each building takes (the rest are houses: a pitched roof over a wall). */
const SHAPES: Record<string, Shape> = {
  elder_lodge: 'hall',
  town_hall: 'hall',
  trophy_hall: 'hall',
  university: 'hall',
  cinema: 'hall',
  emporium: 'hall',
  barracks: 'hall',
  lookout: 'tower',
  watchtower: 'tower',
  guard_tower: 'tower',
  radio_tower: 'tower',
  gun_turret: 'tower',
  laser_turret: 'tower',
  gun_nest: 'tower',
  drone_hub: 'tower',
  windmill: 'tower',
  habitat_dome: 'dome',
  fusion_reactor: 'dome',
  shield_generator: 'dome',
  ai_core: 'dome',
  cryo_pod: 'dome',
  clone_vat: 'dome',
  brick_wall: 'wall',
  brick_gate: 'wall',
  concrete_gate: 'wall',
  force_gate: 'wall',
  concrete_wall: 'wall',
  force_wall: 'wall',
  palisade_wall: 'wall',
  stone_wall: 'wall',
  launch_site: 'pad',
  spike_trap: 'pad',
  // the defence pieces (data/defenses.ts): traps on the ground, engines and posts as towers
  pit_trap: 'pad',
  caltrops: 'pad',
  land_mine: 'pad',
  flame_turret: 'tower',
  mortar_pit: 'pad',
  bramble_snare: 'pad',
  wolf_trap: 'pad',
  tide_pool_trap: 'pad',
  glamour_ring: 'pad',
  boiling_oil: 'tower',
  ballista: 'tower',
  catapult: 'tower',
  cannon: 'tower',
  tesla_coil: 'tower',
  militia_post: 'tower',
  bone_spire: 'tower',
  gargoyle_perch: 'tower',
  sentry_bot: 'tower',
  rune_bolt_thrower: 'tower',
  arrow_wagon: 'tower',
  acid_sprayer: 'tower',
  crossbow_bastion: 'tower',
  factory: 'works',
  steelworks: 'works',
  alloy_foundry: 'works',
  cement_works: 'works',
  power_station: 'works',
  refinery: 'works',
  garage: 'flat',
  apartments: 'flat',
  trauma_center: 'flat',
  hospital: 'flat',
  hydroponics_bay: 'flat',
  electronics_plant: 'flat',
  chip_fab: 'flat',
  battery_plant: 'flat',
  robot_workshop: 'flat',
  mission_control: 'flat',
};

/** Engines and posts stand on a low mount, not a tall tower. */
const ENGINES = new Set(['ballista', 'catapult', 'cannon', 'boiling_oil', 'acid_sprayer', 'sentry_bot', 'arrow_wagon', 'tesla_coil', 'flame_turret', 'rune_bolt_thrower']);

/** Whether an era is `at` or later. */
export const since = (era: Era, at: Era) => ERAS.indexOf(era) >= ERAS.indexOf(at);

const cache = new Map<string, PixelArt>();

/** The top-down picture of a building `w` cells wide and `d` deep, in a look. Its bottom edge is the footprint's. */
export function topDownArt(defId: string, w: number, d: number, tone: Tone, toneKey: string, style = 'town'): PixelArt {
  const key = `${defId}|${w}|${d}|${toneKey}|${style}`;
  let art = cache.get(key);
  if (art) return art;
  const def = BUILDING_BY_ID[defId];
  const era = eraOfResearch(def?.research);
  const shape = SHAPES[defId] ?? (def?.housing && since(era, 'modern') ? 'flat' : 'house');
  // (the merfolk's homes before the modern age are stilt huts of reed and sea-green boards, their own colours)
  const stilt = style === 'merfolk' && shape === 'house' && !!def?.housing;
  const mats = MATS[era];
  const W = w * TILE + EAVE * 2;
  const D = d * TILE;
  const tall = shape === 'tower' ? (ENGINES.has(defId) ? 16 : 44) : shape === 'dome' ? 10 : shape === 'pad' ? 0 : LIFT;
  const H = D + tall;
  const smoke: { x: number; y: number }[] = [];
  art = paint(W, H, tone, (p) => {
    const g: G = { p, smoke, defId, w, d, W, H, D, mats, era, shape, seed: hashOf(defId) };
    switch (shape) {
      case 'wall':
        drawWall(g);
        break;
      case 'pad':
        drawPad(g);
        break;
      case 'tower':
        drawTower(g);
        break;
      case 'dome':
        drawDome(g);
        break;
      case 'flat':
        drawFlat(g);
        break;
      case 'works':
        drawWorks(g);
        break;
      case 'hall':
        drawHouse(g, true);
        break;
      default:
        if (stilt) drawStilt(g);
        else drawHouse(g, false);
    }
    if (stilt) return;
    topper(g);
    const st = style === 'nomads_city' ? 'nomads' : style;
    if (st !== 'town' && st !== 'settlers') reclad(p, st as Style);
  });
  if (smoke.length) art.smoke = smoke;
  cache.set(key, art);
  return art;
}

export interface G {
  p: Painter;
  /** Where smoke rises from (chimneys, stacks), filled in as they're drawn. */
  smoke: { x: number; y: number }[];
  defId: string;
  w: number;
  d: number;
  W: number;
  H: number;
  D: number;
  mats: Mats;
  era: Era;
  shape: Shape;
  seed: number;
}

const hashOf = (s: string) => {
  let h = 7;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
};
const rnd = (seed: number, i: number) => ((Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453) % 1 + 1) % 1;

/* ------------------------------------------------------------ pieces */

/** A roof plane from the ridge (y0, inset `inset` each side) down to the eaves (y1, the full width), covered in the
 *  era's way: bands of thatch, courses of tile or slate, or metal panels; lit at the ridge, shaded at the eaves. */
export function roofPlane(g: G, x0: number, x1: number, y0: number, y1: number, inset: number, hip = true): void {
  const { p, mats } = g;
  const [light, dark] = mats.roof;
  const rows = y1 - y0;
  for (let y = y0; y < y1; y++) {
    const t = (y - y0) / Math.max(1, rows);
    const ins = hip ? inset * (1 - t) : 0;
    const shade = mix(light, dark, 0.15 + 0.6 * t);
    p.rect(x0 + ins, y, x1 - x0 - 2 * ins, 1, shade);
    const course = mats.cover === 'thatch' ? 5 : mats.cover === 'panel' ? 8 : 4;
    if ((y - y0) % course === course - 1 && mats.cover !== 'panel') {
      // (each course's shadowed foot, and the one below's lit edge)
      p.frect(x0 + ins, y + 0.5, x1 - x0 - 2 * ins, 0.5, mix(dark, '#000000', 0.25));
      if (mats.cover !== 'thatch') for (let sx = x0 + ins + ((y - y0) % 8 < 4 ? 1 : 3); sx < x1 - ins - 1; sx += 4) p.frect(sx, y - 1.5, 0.5, 1.5, mix(dark, '#000000', 0.3));
      else for (let sx = x0 + ins + 0.5; sx < x1 - ins - 1; sx += 2) p.frect(sx, y + 1, 0.5, 0.5, (sx * 7) % 3 < 1 ? mix(light, '#ffffff', 0.25) : dark);
    }
    if (mats.cover === 'panel' && (y - y0) % 8 === 0) p.frect(x0 + ins, y, x1 - x0 - 2 * ins, 0.5, mix(light, '#ffffff', 0.2));
  }
  if (mats.cover === 'panel') for (let sx = x0 + 10; sx < x1 - 4; sx += 12) p.frect(sx, y0 + 2, 0.5, rows - 3, mix(dark, '#000000', 0.25));
  // the ridge, lit
  p.frect(x0 + inset, y0, x1 - x0 - 2 * inset, 1, mix(light, '#ffffff', 0.3));
  if (hip) {
    // the hips: a line from each ridge end down to the eaves' corners
    p.fline(x0 + inset, y0, x0, y1 - 0.5, mix(light, '#ffffff', 0.15));
    p.fline(x1 - inset, y0, x1 - 0.5, y1 - 0.5, mix(dark, '#000000', 0.3));
  }
  // the eaves' edge and its shadow on the wall below
  p.frect(x0, y1 - 0.5, x1 - x0, 0.5, mix(dark, '#000000', 0.4));
  p.frect(x0 + 1, y1, x1 - x0 - 2, 1.5, 'rgba(0,0,0,0.28)');
}

/** The front wall from y0 to the bottom: plaster, timber, brick or panels by era, with a door and windows. */
export function frontWall(g: G, x0: number, x1: number, y0: number, y1: number, door = true, windows = true): void {
  const { p, mats, era } = g;
  const [light, dark] = mats.wall;
  const h = y1 - y0;
  p.rect(x0, y0, x1 - x0, h, light);
  if (era === 'neolithic') {
    // wattle and daub: a lattice of withies on the plaster, timber posts
    for (let y = y0 + 2; y < y1 - 1; y += 3) p.frect(x0, y, x1 - x0, 0.5, mix(dark, light, 0.5));
    for (let x = x0; x < x1; x += 8) p.rect(x, y0, 1, h, dark);
  } else if (era === 'medieval') {
    // half-timbering: a sill beam, posts and a brace or two
    p.rect(x0, y0, x1 - x0, 1, mats.trim);
    p.rect(x0, y1 - 2, x1 - x0, 2, mats.trim);
    for (let x = x0; x < x1 - 1; x += 16) p.rect(x, y0, 1, h, mats.trim);
    p.rect(x1 - 1, y0, 1, h, mats.trim);
    if (h > 12 && x1 - x0 >= 32) {
      p.fline(x0 + 1, y0 + 2, x0 + 14, y1 - 3, mats.trim);
      p.fline(x1 - 2, y0 + 2, x1 - 15, y1 - 3, mats.trim);
    }
  } else if (era === 'industrial') {
    // brick courses
    for (let y = y0; y < y1; y += 3) {
      p.frect(x0, y + 2.5, x1 - x0, 0.5, dark);
      for (let x = x0 + ((y - y0) % 6 ? 3 : 0); x < x1; x += 6) p.frect(x, y, 0.5, 2.5, dark);
    }
  } else {
    // panels and a plinth
    p.rect(x0, y1 - 3, x1 - x0, 3, dark);
    for (let x = x0; x < x1; x += 12) p.frect(x, y0, 0.5, h - 3, dark);
    if (era === 'space') for (let x = x0 + 3; x < x1 - 2; x += 12) p.frect(x, y1 - 2, 2, 0.5, '#80e0ff');
  }
  // the right-hand edge in shadow, the left lit
  p.frect(x1 - 1, y0, 1, h, mix(dark, '#000000', 0.25));
  p.frect(x0, y0, 0.5, h, mix(light, '#ffffff', 0.2));
  const mid = Math.round((x0 + x1) / 2);
  if (door && h >= 10) {
    const dw = era === 'neolithic' ? 6 : 8;
    const dh = Math.min(h - 2, 12);
    p.rect(mid - dw / 2, y1 - dh, dw, dh, mats.trim);
    p.rect(mid - dw / 2 + 1, y1 - dh + 1, dw - 2, dh - 1, mix(mats.trim, '#000000', 0.45));
    if (since(era, 'medieval')) p.fpx(mid + dw / 2 - 2, y1 - dh / 2, '#d8b050'); // the handle
  }
  if (windows && h >= 10) {
    const ww = era === 'neolithic' ? 4 : 6;
    const wy = y0 + Math.max(2, Math.round(h * 0.25));
    const wh = Math.min(6, h - 8);
    for (const x of [x0 + 5, x1 - 5 - ww]) {
      if (door && Math.abs(x + ww / 2 - mid) < 8) continue;
      p.rect(x, wy, ww, wh, WINDOW);
      p.frect(x, wy, ww, 0.5, mix(WINDOW, '#000000', 0.3));
      if (ww >= 6) p.frect(x + ww / 2, wy, 0.5, wh, mats.trim);
    }
    // a third in the middle of a wide wall
    if (x1 - x0 > 60 && !door) p.rect(mid - ww / 2, wy, ww, wh, WINDOW);
  }
}

/* ------------------------------------------------------------ shapes */

/** A pitched roof over a wall (a hall: taller walls, a wider ridge and a front gable with a big door). */
function drawHouse(g: G, hall: boolean): void {
  const { p, W, H, D, mats, w } = g;
  const wallH = hall ? Math.min(36, Math.round(D * 0.45)) : Math.min(26, Math.round(D * 0.4));
  const roofTop = 0;
  const roofBottom = H - wallH;
  roofPlane(g, 0, W, roofTop, roofBottom, Math.min(10, Math.round(W * 0.12)), true);
  frontWall(g, EAVE, W - EAVE, roofBottom, H, true, true);
  if (hall) {
    // a front gable over the door, and columns either side
    const mid = W / 2;
    const gw = Math.min(40, Math.round(W * 0.45));
    const gh = Math.round(gw * 0.4);
    const [light, dark] = mats.roof;
    const gtop = roofBottom - gh;
    // (its face: the wall's colour, a window in it; its own two slopes meeting at the ridge)
    for (let y = 0; y <= gh; y++) {
      const half = (y / gh) * (gw / 2);
      p.rect(mid - half, gtop + y, half * 2, 1, mats.wall[0]);
    }
    p.rect(mid - 3, roofBottom - gh / 2 - 1, 6, 5, WINDOW);
    for (let y = 0; y <= gh; y++) {
      const half = (y / gh) * (gw / 2);
      p.frect(mid - half - 1.5, gtop + y, 2, 1, mix(light, '#ffffff', 0.15));
      p.frect(mid + half - 0.5, gtop + y, 2, 1, dark);
    }
    p.frect(mid - gw / 2 - 1, roofBottom - 0.5, gw + 2, 1, mix(dark, '#000000', 0.3));
    for (const x of [mid - gw / 2 + 2, mid + gw / 2 - 4]) {
      p.rect(x, roofBottom + 3, 2, H - roofBottom - 3, mix(mats.wall[0], '#ffffff', 0.15));
      p.frect(x + 1.5, roofBottom + 3, 0.5, H - roofBottom - 3, mix(mats.wall[1], '#000000', 0.2));
    }
  }
  // a chimney on homes and halls of the medieval and industrial eras
  if ((g.era === 'medieval' || g.era === 'industrial') && w >= 2) {
    const cx = W - EAVE - 10 - (g.seed % 7);
    p.rect(cx, 2, 4, 9, g.era === 'industrial' ? '#6a3424' : '#73726b');
    p.rect(cx - 1, 1, 6, 2, '#5a5a56');
    g.smoke.push({ x: cx + 2, y: 1 });
  }
}

/** A merfolk home: a round reed roof seen from above, its thatch raked out from the crown and fringed at the eaves,
 *  over a short wall of sea-green boards with a round-topped door and a lit porthole, on a plank deck raised on stilts
 *  (it may stand in the shallows); a net hung to dry and a string of shells. */
function drawStilt(g: G): void {
  const { p, W, H, seed } = g;
  const REED: [string, string] = ['#c8b070', '#8a7440'];
  const BOARD: [string, string] = ['#4a8a84', '#2e605c'];
  const POST = '#5a4632';
  const deckBottom = H - 8;
  const deckTop = deckBottom - 4;
  const wallTop = deckTop - Math.min(22, Math.round(g.D * 0.36));
  const x0 = EAVE + 2;
  const x1 = W - EAVE - 2;
  // the stilts, their feet darkened where the water or ground takes them
  for (let x = x0 + 2; x < x1 - 2; x += Math.max(8, Math.round((x1 - x0 - 6) / 4))) {
    p.rect(x, deckBottom, 2, H - deckBottom, POST);
    p.frect(x + 1.5, deckBottom, 0.5, H - deckBottom, mix(POST, '#000000', 0.35));
    p.frect(x - 0.5, H - 1.5, 3, 1.5, 'rgba(0,0,0,0.3)');
  }
  p.frect(x0 + 2, deckBottom + 2, x1 - x0 - 4, 0.5, mix(POST, '#000000', 0.2)); // a cross brace
  // the deck: planks running across, lit along the front edge
  p.rect(x0 - 2, deckTop, x1 - x0 + 4, deckBottom - deckTop, '#7a6448');
  for (let x = x0 + 1; x < x1 + 2; x += 3) p.frect(x, deckTop, 0.5, deckBottom - deckTop, '#5a4632');
  p.frect(x0 - 2, deckBottom - 0.5, x1 - x0 + 4, 0.5, mix('#7a6448', '#ffffff', 0.25));
  // the wall: boards, a round-topped door, a porthole
  p.rect(x0, wallTop, x1 - x0, deckTop - wallTop, BOARD[0]);
  for (let x = x0 + 2; x < x1; x += 3) p.frect(x, wallTop, 0.5, deckTop - wallTop, BOARD[1]);
  const mid = Math.round(W / 2);
  p.rect(mid - 3, wallTop + 3, 6, deckTop - wallTop - 3, '#1a2a2a');
  p.disc(mid, wallTop + 3, 3, '#1a2a2a');
  if (x1 - x0 >= 30) {
    const wx = x1 - 8;
    p.disc(wx, wallTop + 5, 2.5, '#2e4a48');
    p.disc(wx, wallTop + 5, 1.5, WINDOW);
  }
  // the roof: a dome of reed from the crown down to the eaves, wider than the wall
  const cx = W / 2;
  const top = 1;
  const bottom = wallTop + 2;
  const rx = W / 2 - 1;
  for (let y = top; y < bottom; y++) {
    const t = (y - top) / Math.max(1, bottom - top);
    const half = rx * Math.sqrt(Math.min(1, 0.15 + t * 1.1));
    p.frect(cx - half, y, half * 2, 1, mix(REED[0], REED[1], 0.1 + 0.55 * t));
  }
  // the thatch laid in rings, each course's foot shadowed and a few reeds lit along it; a handful of rakes from the crown
  for (let y = top + 5; y < bottom - 1; y += 4) {
    const tt = (y - top) / Math.max(1, bottom - top);
    const half = rx * Math.sqrt(Math.min(1, 0.15 + tt * 1.1));
    p.frect(cx - half + 1, y + 0.5, half * 2 - 2, 0.5, mix(REED[1], '#000000', 0.2));
    for (let x = cx - half + 1 + (y % 3); x < cx + half - 1; x += 3) p.frect(x, y - 1, 0.5, 1, x < cx ? mix(REED[0], '#ffffff', 0.25) : REED[1]);
  }
  for (let i = 0; i < 7; i++) {
    const a = Math.PI * (0.12 + (0.76 * i) / 6);
    p.fline(cx, top + 2, cx - Math.cos(a) * (rx - 3), top + 2 + Math.sin(a) * (bottom - top - 4), mix(REED[1], '#000000', 0.08));
  }
  // the fringe at the eaves, ragged, and its shadow on the boards
  for (let x = cx - rx + 1; x < cx + rx - 1; x += 2) p.frect(x, bottom - 1, 1, 1 + (Math.floor(x * 7 + seed) % 3) * 0.5, REED[1]);
  p.frect(x0, bottom + 0.5, x1 - x0, 1.5, 'rgba(0,0,0,0.28)');
  // the crown: a knot of reed bound with cord
  p.disc(cx, top + 2, 2.5, REED[1]);
  p.frect(cx - 2, top + 2, 4, 0.5, '#6a3a2a');
  // a net hung to dry on the left, a string of shells on the right
  for (let y = wallTop + 2; y < deckTop - 1; y += 2) p.frect(x0 + 2, y, 6, 0.5, '#d8ccb0');
  for (let x = x0 + 2; x <= x0 + 8; x += 2) p.frect(x, wallTop + 2, 0.5, deckTop - wallTop - 3, '#d8ccb0');
  for (let i = 0; i < 4; i++) p.disc(x1 - 3 - i * 3, deckTop - 2 - (i % 2), 1, i % 2 ? '#f0d8d0' : '#e8b8a8');
}

/** A flat-roofed block: a parapet round a flat plane with vents and a skylight; glass and panels below. */
function drawFlat(g: G): void {
  const { p, W, H, D, mats } = g;
  const wallH = Math.min(30, Math.round(D * 0.42));
  const top = 2;
  const bottom = H - wallH;
  const [light, dark] = mats.roof;
  p.rect(0, top, W, bottom - top, mix(light, dark, 0.35));
  p.rect(0, top, W, 2, light);
  p.rect(0, top, 2, bottom - top, light);
  p.rect(W - 2, top, 2, bottom - top, dark);
  p.rect(0, bottom - 2, W, 2, dark);
  // vents, a skylight, a tank
  for (let i = 0; i < Math.max(1, g.w - 1); i++) {
    const x = 8 + i * 16 + (rnd(g.seed, i) * 6) | 0;
    const y = top + 6 + ((rnd(g.seed, i + 9) * (bottom - top - 16)) | 0);
    if (i % 3 === 2) p.rect(x, y, 10, 6, '#7ea6c4');
    else {
      p.rect(x, y, 5, 5, dark);
      p.rect(x + 1, y + 1, 3, 3, mix(dark, '#000000', 0.4));
    }
  }
  p.frect(1, bottom, W - 2, 1.5, 'rgba(0,0,0,0.28)');
  frontWall(g, EAVE, W - EAVE, bottom, H, true, true);
  // modern fronts are mostly glass: a band of windows
  if (g.era !== 'neolithic' && g.era !== 'medieval') {
    const wy = bottom + 4;
    for (let x = EAVE + 4; x < W - EAVE - 10; x += 9) if (Math.abs(x + 3 - W / 2) > 7) p.rect(x, wy, 6, Math.min(8, wallH - 12), WINDOW);
  }
  void mats;
}

/** A works: a sawtooth roof (the lit glazing facing one way) and tall stacks, over a brick or panel wall. */
function drawWorks(g: G): void {
  const { p, W, H, D, mats } = g;
  const wallH = Math.min(30, Math.round(D * 0.4));
  const bottom = H - wallH;
  const [light, dark] = mats.roof;
  const teeth = Math.max(2, Math.round(W / 24));
  const tw = W / teeth;
  for (let i = 0; i < teeth; i++) {
    const x = i * tw;
    for (let y = 3; y < bottom; y++) {
      const t = (y - 3) / (bottom - 3);
      p.rect(x, y, tw * 0.3, 1, mix('#9ec6e0', '#5a86a8', t)); // the glazing
      p.rect(x + tw * 0.3, y, tw * 0.7, 1, mix(light, dark, 0.2 + 0.6 * t));
    }
    p.frect(x + tw * 0.3, 3, 0.5, bottom - 3, mix(dark, '#000000', 0.4));
  }
  p.frect(0, 2.5, W, 0.5, mix(light, '#ffffff', 0.3));
  p.frect(1, bottom, W - 2, 1.5, 'rgba(0,0,0,0.28)');
  frontWall(g, EAVE, W - EAVE, bottom, H, true, false);
  // the stacks
  for (let i = 0; i < Math.max(1, g.w - 2); i++) {
    const x = W - EAVE - 8 - i * 14;
    p.rect(x, 0, 5, 14, g.era === 'industrial' ? '#6a3424' : '#5a6470');
    p.rect(x - 1, 0, 7, 2, '#3a3a3a');
    p.frect(x + 4, 0, 1, 14, mix('#6a3424', '#000000', 0.3));
    g.smoke.push({ x: x + 2.5, y: 0 });
  }
}

/** A round tower: a platform seen from above on a tall drum, with battlements, a roof or a turret top by kind. */
function drawTower(g: G): void {
  const { p, W, H, mats, defId } = g;
  const cx = W / 2;
  const rx = Math.min(W / 2 - 1, 14 + g.w * 4);
  const ry = Math.round(rx * 0.5);
  const topY = ry + 4;
  const stone = defId === 'lookout' || defId === 'watchtower' ? mats.wall : ['#8d8c84', '#73726b'] as [string, string];
  const wood = defId === 'lookout' || defId === 'watchtower';
  // the drum
  for (let x = Math.round(cx - rx); x < cx + rx; x++) {
    const t = (x - (cx - rx)) / (2 * rx);
    const shade = mix(mix(stone[0], '#ffffff', 0.15), stone[1], Math.abs(t - 0.3) * 1.4);
    p.rect(x, topY, 1, H - topY - ry, shade);
  }
  // the foot's curve
  p.ellipse(cx, H - ry, rx, ry, mix(stone[1], '#000000', 0.2));
  if (wood) for (let y = topY + 4; y < H - ry; y += 5) p.frect(cx - rx, y, 2 * rx, 0.5, mix(stone[1], '#000000', 0.3));
  else for (let y = topY + 3; y < H - ry; y += 4) p.frect(cx - rx, y + 0.5, 2 * rx, 0.5, mix(stone[1], '#000000', 0.25));
  // the platform (seen from above) and what's on it
  p.ellipse(cx, topY, rx, ry, mix(stone[0], '#ffffff', 0.08));
  p.ellipse(cx, topY, rx - 2, ry - 1, mix(stone[0], '#000000', 0.15));
  if (defId === 'radio_tower') {
    p.rect(cx - 1, 0, 2, topY, '#9a9a94');
    for (let y = 2; y < topY; y += 5) p.frect(cx - 4, y, 8, 0.5, '#9a9a94');
    p.px(cx, 0, '#ff4040');
  } else if (defId === 'gun_turret' || defId === 'laser_turret' || defId === 'gun_nest') {
    p.ellipse(cx, topY - 1, rx * 0.6, ry * 0.6, '#5a6068');
    p.rect(cx - 1, topY - ry - 6, 3, ry + 6, defId === 'laser_turret' ? '#80e0ff' : '#3a3a3a');
  } else if (defId === 'drone_hub') {
    p.ellipse(cx, topY - 1, rx * 0.7, ry * 0.7, '#80e0ff');
    p.ellipse(cx, topY - 1, rx * 0.4, ry * 0.4, '#3a4450');
  } else if (defId === 'ballista' || defId === 'rune_bolt_thrower' || defId === 'crossbow_bastion') {
    // a crossbow on a mount: the bow across, the stock along
    p.rect(cx - 1, topY - 10, 3, 12, '#5a3a22');
    p.rect(cx - 9, topY - 7, 19, 2, defId === 'rune_bolt_thrower' ? '#8a8694' : '#8a7040');
    p.fline(cx - 9, topY - 6.5, cx, topY - 1, '#d8c8a8');
    p.fline(cx + 10, topY - 6.5, cx, topY - 1, '#d8c8a8');
    if (defId === 'rune_bolt_thrower') for (let y = topY + 4; y < H - ry - 2; y += 6) p.fpx(cx, y, '#7ae8f0');
  } else if (defId === 'catapult') {
    // the arm, cocked back, a stone in its cup
    p.rect(cx - 8, topY - 3, 16, 3, '#5a3a22');
    p.fline(cx - 6, topY - 3, cx + 7, topY - 14, '#8a7040');
    p.disc(cx + 7, topY - 15, 2.5, '#7d7e7a');
  } else if (defId === 'cannon') {
    p.rect(cx - 2, topY - 12, 5, 12, '#3a3a3a');
    p.rect(cx - 3, topY - 13, 7, 2, '#5a5a5a');
    p.ellipse(cx, topY - 1, 5, 3, '#5a3a22');
  } else if (defId === 'tesla_coil') {
    p.rect(cx - 1, topY - 14, 3, 14, '#b87333');
    p.disc(cx, topY - 16, 4, '#9a9a94');
    for (const dx of [-5, 5]) p.fline(cx, topY - 16, cx + dx, topY - 22, '#7ae8f0');
  } else if (defId === 'flame_turret') {
    // a tank with a nozzle, and a pilot flame
    p.ellipse(cx - 3, topY - 3, 5, 3, '#8a3a2a');
    p.rect(cx + 1, topY - 4, 9, 2, '#3a3a3a');
    p.fpx(cx + 10, topY - 3.5, '#ffb347');
  } else if (defId === 'sentry_bot') {
    p.ellipse(cx, topY - 2, rx * 0.6, ry * 0.6, '#5a6470');
    p.rect(cx - 6, topY - 4, 12, 2, '#3a3a3a');
    p.fpx(cx, topY - 3, '#ff4040');
  } else if (defId === 'boiling_oil' || defId === 'acid_sprayer') {
    p.ellipse(cx, topY - 3, 6, 4, defId === 'acid_sprayer' ? '#3f6a2a' : '#3a3a3a');
    p.ellipse(cx, topY - 5, 5, 2, defId === 'acid_sprayer' ? '#7ad040' : '#8a6a20');
    p.rect(cx - 8, topY - 10, 16, 1, '#5a3a22');
  } else if (defId === 'gargoyle_perch') {
    p.rect(cx - 3, topY - 10, 6, 8, '#5c5d5a');
    for (const dx of [-7, 4]) p.rect(cx + dx, topY - 11, 3, 6, '#4a4a50');
    p.fpx(cx - 1, topY - 8, '#e0506a');
    p.fpx(cx + 1, topY - 8, '#e0506a');
  } else if (defId === 'bone_spire') {
    for (let y = 0; y < 16; y++) p.rect(cx - 2 + Math.floor(y / 8), topY - 16 + y, 4 - Math.floor(y / 8) * 2, 1, y % 3 ? '#e8e0d0' : '#b8b0a0');
    p.fpx(cx, topY - 17, '#7cff9a');
  } else if (defId === 'militia_post' || defId === 'arrow_wagon') {
    // a thatched roof on posts, and a rack of bows
    const [light, dark] = mats.roof;
    p.ellipse(cx, topY - 6, rx * 0.8, ry * 0.8, dark);
    p.ellipse(cx - 1, topY - 7, rx * 0.6, ry * 0.6, light);
    if (defId === 'arrow_wagon') for (const dx of [-rx + 2, rx - 4]) p.ellipse(cx + dx, H - ry + 1, 3, 3, '#3a2616');
  } else if (defId === 'windmill') {
    // a cap and the sails, seen edge-on from above: a cross over the tower
    p.ellipse(cx, topY - 2, rx * 0.7, ry * 0.7, mats.roof[1]);
    const arm = rx + 12;
    for (const [dx, dy] of [[1, 0.35], [-1, -0.35], [0.5, -0.7], [-0.5, 0.7]]) {
      // (each blade: a spar with a slatted sail along one side)
      for (let t = 0.15; t <= 1; t += 0.05) {
        const x = cx + dx * arm * t;
        const y = topY - 2 + dy * arm * t;
        p.frect(x - 0.5, y - 0.5, 1, 1, '#8a7040');
        if (t > 0.3) p.frect(x + dy * 2 - 1, y - dx * 2 - 1, 2.5, 2.5, Math.round(t * 20) % 2 ? '#e8dcc0' : '#d8c8a8');
      }
    }
    p.disc(cx, topY - 2, 2, '#5a3a22');
  } else {
    // battlements round the rim (a wooden rail on the lookouts)
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) {
      const x = cx + Math.cos(a) * (rx - 1);
      const y = topY + Math.sin(a) * (ry - 1);
      if (wood) p.frect(x, y - 3, 1, 3, mats.trim);
      else p.rect(x - 1, y - 2, 3, 3, stone[0]);
    }
    if (wood) {
      // a little thatched roof on posts
      const [light, dark] = mats.roof;
      p.ellipse(cx, topY - 6, rx * 0.8, ry * 0.8, dark);
      p.ellipse(cx - 1, topY - 7, rx * 0.6, ry * 0.6, light);
    }
  }
  p.frect(cx - rx, H - ry, 2 * rx, 1.5, 'rgba(0,0,0,0.25)');
}

/** A dome seen from above: a round shaded plane with a highlight, on a low ring wall. */
function drawDome(g: G): void {
  const { p, W, H, D, defId } = g;
  const cx = W / 2;
  const rx = W / 2 - 1;
  const ry = Math.min(D / 2 + 4, rx * 0.8);
  const cy = H - D / 2 - 2;
  const glass = defId === 'habitat_dome' || defId === 'hydroponics_bay' || defId === 'cryo_pod' || defId === 'clone_vat';
  const base = glass ? '#7ea6c4' : defId === 'fusion_reactor' ? '#6a7684' : defId === 'shield_generator' ? '#80c0e0' : '#5a6470';
  // the ring wall
  p.ellipse(cx, cy + 3, rx, ry, mix(base, '#000000', 0.45));
  for (let i = 0; i < 6; i++) {
    const t = i / 6;
    p.ellipse(cx - t * 2, cy - t * 1.5, rx * (1 - t * 0.9), ry * (1 - t * 0.9), mix(mix(base, '#000000', 0.3), mix(base, '#ffffff', 0.35), t));
  }
  // ribs
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) p.fline(cx, cy, cx + Math.cos(a) * rx * 0.95, cy + Math.sin(a) * ry * 0.95, mix(base, '#000000', 0.25));
  if (glass) p.ellipse(cx - rx * 0.35, cy - ry * 0.35, rx * 0.18, ry * 0.18, '#dcebf6');
  if (defId === 'fusion_reactor' || defId === 'ai_core') p.ellipse(cx, cy, rx * 0.2, ry * 0.2, defId === 'ai_core' ? '#80e0ff' : '#ffb347');
  if (defId === 'shield_generator') for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) p.disc(cx + Math.cos(a) * rx * 0.7, cy + Math.sin(a) * ry * 0.7, 1.5, '#80e0ff');
  p.frect(cx - rx * 0.8, cy + ry + 2, rx * 1.6, 1.5, 'rgba(0,0,0,0.25)');
}

/** A wall segment: its walk seen from above and its face below, in brick, concrete or light. */
function drawWall(g: G): void {
  const { p, W, H, D, defId } = g;
  const face = defId === 'brick_wall' ? ['#a4543a', '#6a3424'] : defId === 'force_wall' ? ['#80e0ff', '#3a6a8a'] : defId === 'palisade_wall' ? ['#8a7040', '#5a3a22'] : ['#9a9a94', '#74746e'];
  const walkH = Math.round(D * 0.4);
  const top = H - D - 4;
  if (defId === 'force_wall') {
    for (let y = top; y < H; y++) p.rect(EAVE, y, W - 2 * EAVE, 1, mix(face[0], face[1], ((y - top) % 6) / 6));
    p.rect(EAVE, H - 3, W - 2 * EAVE, 3, '#3a4450');
    return;
  }
  p.rect(EAVE, top, W - 2 * EAVE, walkH, mix(face[0], '#ffffff', 0.1));
  // battlements along the back of the walk
  for (let x = EAVE; x < W - EAVE; x += 6) p.rect(x, top - 3, 3, 4, face[0]);
  p.rect(EAVE, top + walkH, W - 2 * EAVE, H - top - walkH, face[0]);
  if (defId === 'brick_wall') for (let y = top + walkH; y < H; y += 3) {
    p.frect(EAVE, y + 2.5, W - 2 * EAVE, 0.5, face[1]);
    for (let x = EAVE + ((y - top) % 6 ? 3 : 0); x < W - EAVE; x += 6) p.frect(x, y, 0.5, 2.5, face[1]);
  } else if (defId === 'palisade_wall') for (let x = EAVE; x < W - EAVE; x += 3) p.frect(x, top + walkH, 0.5, H - top - walkH, face[1]);
  else for (let y = top + walkH + 5; y < H; y += 6) p.frect(EAVE, y, W - 2 * EAVE, 0.5, face[1]);
  p.frect(EAVE, top + walkH, W - 2 * EAVE, 1, 'rgba(0,0,0,0.3)');
  p.rect(EAVE, H - 1, W - 2 * EAVE, 1, mix(face[1], '#000000', 0.3));
}

/** Something flat on the ground: the launch pad with its rocket, the spike trap's spikes. */
function drawPad(g: G): void {
  const { p, W, H, D, defId } = g;
  if (drawTrap(g)) return;
  if (defId === 'spike_trap') {
    p.rect(2, H - D + 2, W - 4, D - 4, '#5a4a3a');
    for (let x = 4; x < W - 4; x += 5) for (let y = H - D + 4; y < H - 3; y += 6) {
      p.frect(x, y, 1, 3, '#c8c8c0');
      p.fpx(x, y - 0.5, '#f0f0ec');
    }
    return;
  }
  // the pad: a concrete plate with a painted ring, and the rocket standing on it with its gantry
  p.rect(0, H - D, W, D, '#9a9a94');
  p.rect(1, H - D + 1, W - 2, D - 2, '#8c8c86');
  const cx = W / 2;
  const cy = H - D / 2;
  p.ellipse(cx, cy, W * 0.35, D * 0.35, '#b4b4ae');
  p.ellipse(cx, cy, W * 0.3, D * 0.3, '#8c8c86');
  p.ellipse(cx, cy, W * 0.08, D * 0.08, '#3a3a3a');
  // the rocket standing on the pad (its shadow across it), and the gantry beside it
  const rh = Math.min(H - 4, 44);
  const foot = cy + 4;
  p.ellipse(cx + 10, foot, 14, 3, 'rgba(0,0,0,0.3)');
  p.rect(cx - 4, foot - rh + 8, 8, rh - 8, '#e8e8e4');
  p.rect(cx + 2, foot - rh + 8, 2, rh - 8, '#b4b4ae');
  p.rect(cx - 4, foot - rh + 14, 8, 3, '#c84040');
  for (let y = 0; y < 8; y++) p.rect(cx - (y / 2), foot - rh + y, y, 1, '#c84040'); // the nose
  for (const sx of [-1, 1]) for (let y = 0; y < 8; y++) p.rect(cx + sx * 4 + (sx > 0 ? 0 : -y / 2), foot - 8 + y, y / 2 + 1, 1, '#c84040'); // the fins
  p.rect(cx - 3, foot - 2, 6, 3, '#3a3a3a'); // the engine bell
  p.rect(cx + 9, foot - rh + 4, 3, rh - 4, '#6a6e78');
  for (let y = foot - rh + 6; y < foot; y += 6) p.frect(cx + 4, y, 6, 0.5, '#9a9a94');
  p.frect(cx + 9, foot - rh + 4, 3, 0.5, '#9a9a94');
}

/** The traps (data/defenses.ts), each its own thing on the ground: a covered pit, strewn caltrops, a buried mine, a
 *  mortar in its sandbagged pit, brambles, iron jaws, a tide pool, a ring of toadstools. True when one was drawn. */
function drawTrap(g: G): boolean {
  const { p, W, H, D, defId } = g;
  const x0 = 2;
  const y0 = H - D + 2;
  const w = W - 4;
  const h = D - 4;
  const cx = W / 2;
  const cy = H - D / 2;
  switch (defId) {
    case 'pit_trap':
      p.rect(x0, y0, w, h, '#6a5a44');
      p.ellipse(cx, cy, w * 0.38, h * 0.3, '#2a2016');
      for (let x = x0 + 2; x < x0 + w - 2; x += 4) p.frect(x, cy - 1, 3, 0.5, '#b89a58'); // (sticks laid over it)
      return true;
    case 'caltrops':
      for (let i = 0; i < 9; i++) {
        const x = x0 + 3 + ((i * 7) % (w - 6));
        const y = y0 + 3 + ((i * 11) % (h - 6));
        p.fline(x - 2, y + 2, x + 2, y - 2, '#4a4a50');
        p.fline(x - 2, y - 2, x + 2, y + 2, '#6a6a70');
        p.fpx(x, y - 3, '#9a9aa0');
      }
      return true;
    case 'land_mine':
      p.ellipse(cx, cy, 6, 4, '#5a4a3a');
      p.ellipse(cx, cy - 1, 5, 3, '#3a3a3a');
      p.fpx(cx, cy - 3, '#c84040');
      return true;
    case 'mortar_pit':
      p.ellipse(cx, cy, w * 0.45, h * 0.4, '#8a7a5a'); // (the sandbags)
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 5) p.ellipse(cx + Math.cos(a) * w * 0.4, cy + Math.sin(a) * h * 0.35, 3, 2, '#a89868');
      p.ellipse(cx, cy, 4, 3, '#3a3a3a');
      p.rect(cx - 1, cy - 9, 3, 9, '#5a6068');
      return true;
    case 'bramble_snare':
      for (let i = 0; i < 6; i++) p.fline(x0 + (i * 5) % w, y0 + h, x0 + ((i * 5 + 7) % w), y0 + 2 + (i % 3) * 3, '#3f6a2a');
      for (let i = 0; i < 7; i++) p.fpx(x0 + 2 + ((i * 9) % (w - 4)), y0 + 2 + ((i * 5) % (h - 4)), '#c0392b');
      return true;
    case 'wolf_trap':
      p.ellipse(cx, cy, 7, 4, '#6a6a70');
      p.ellipse(cx, cy, 5, 2.5, '#4a4a50');
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) p.fpx(cx + Math.cos(a) * 6, cy + Math.sin(a) * 3.5, '#c8c8c0');
      p.rect(cx + 6, cy, 6, 1, '#3a3a3a'); // (the chain)
      return true;
    case 'tide_pool_trap':
      p.ellipse(cx, cy, w * 0.42, h * 0.36, '#7d7e7a');
      p.ellipse(cx, cy, w * 0.34, h * 0.28, '#2a6a9a');
      p.ellipse(cx - 2, cy - 1, w * 0.16, h * 0.1, '#5aa0c8');
      return true;
    case 'glamour_ring':
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        const x = cx + Math.cos(a) * w * 0.36;
        const y = cy + Math.sin(a) * h * 0.3;
        p.rect(x - 1, y - 2, 2, 3, '#e8dcc0');
        p.ellipse(x, y - 2, 2.5, 1.5, '#c0392b');
        p.fpx(x, y - 3, '#fff5e0');
      }
      p.fpx(cx, cy, '#f8b0ff');
      return true;
  }
  return false;
}

/** A topper or two by the building's id, on top of its shape. */
function topper(g: G): void {
  const { p, W, defId } = g;
  if (defId === 'gunsmith') {
    // a long barrel over the door and a signboard
    p.rect(W / 2 - 8, g.H - 22, 16, 2, '#3a3a3a');
    p.rect(W / 2 - 5, g.H - 20, 10, 6, '#d8c8a8');
  } else if (defId === 'cinema') {
    p.rect(EAVE + 4, g.H - 30, W - 2 * EAVE - 8, 6, '#ffb347');
    p.rect(EAVE + 6, g.H - 29, W - 2 * EAVE - 12, 4, '#f8e8a0');
  } else if (defId === 'trauma_center' || defId === 'hospital') {
    p.rect(W / 2 - 1, 6, 3, 9, '#e04040');
    p.rect(W / 2 - 4, 9, 9, 3, '#e04040');
  } else if (defId === 'university' || defId === 'town_hall') {
    // a little cupola on the ridge
    p.rect(W / 2 - 3, 0, 6, 6, g.mats.wall[0]);
    p.rect(W / 2 - 4, 0, 8, 1, g.mats.roof[1]);
    p.px(W / 2, -0, '#d8b050');
  } else if (defId === 'trophy_hall') {
    for (const x of [W / 2 - 12, W / 2 + 10]) p.rect(x, 2, 2, 8, '#d8b050');
  } else if (defId === 'elder_lodge') {
    // antlers over the door
    for (const s of [-1, 1]) {
      p.fline(W / 2 + s * 2, g.H - 24, W / 2 + s * 8, g.H - 30, '#e8dcc0');
      p.fline(W / 2 + s * 5, g.H - 27, W / 2 + s * 7, g.H - 32, '#e8dcc0');
    }
  }
}
