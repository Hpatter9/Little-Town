// A venue's window (the shop, or the tavern): the inside seen at an angle (drawn in code, like the town's
// buildings, with the townsfolk and strangers as their own side-on sprites), with the keeper behind the counter or bar, the furnishings the town has set out, and strangers browsing
// or sitting over their food; and beside or below it, who's in and what they came for, what the venue has to offer,
// what's been asked for, and what's happened lately. It only shows: the town runs its venues itself.

import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { qualityOf } from '../../shared/data/quality';
import { APPEAL_HALVES_WAIT, TRAVELLER_EVERY } from '../../shared/data/shop';
import type { Look } from '../../shared/data/people';
import type { ShopView, Snapshot } from '../../shared/sim/snapshot';
import { CENTRE_X, FEET_Y, FRAME_COUNT, FRAME_SIZE, loadLpc, lookKey, lpcCanvas } from '../art/lpc/lpcCompose';
import { materialIcon } from '../art/materialIcons';
import { el } from './dom';

type VenueId = 'shop' | 'tavern';

/** Changes whenever something the text shows changes (the picture animates on its own). */
export const shopKey = (s: Snapshot, venue: VenueId = 'shop') => {
  const v = s[venue];
  return JSON.stringify(v && [s.coins, s.wageBill, v.def, v.progress !== null && Math.floor(v.progress * 20), v.pieces, v.appeal, v.renown, v.extensions, v.tiers, v.keeperName, v.customers, v.passing, v.forSale, v.wants, v.log, v.nextHours !== null && Math.ceil(v.nextHours), v.making, v.waiting, v.asked, v.menu, v.gear]);
};

/** In the picture's own pixels (it's scaled up to fit): a floor cell's width and its depth (a row, foreshortened),
 *  the side walls' thickness, the back wall's height, and the sill across the front. */
const CELL = 16;
const DEPTH = 12;
const WALL = 6;
const BACK = 40;
const SILL = 6;
/** A tavern's guest rooms, drawn as a storey over the common room. */
const UPSTAIRS_H = 32;
/** The characters' size in the room, and where the top of a head is in a character's frame. */
const SCALE = 0.5;
const HEAD_Y = 16;

let latest: ShopView | null = null;
let canvas: HTMLCanvasElement | null = null;
let running = false;

/** A chip in its quality's colour ("Rare Spear ×2 · 14c"). */
function qualityChip(text: string, q: number): HTMLElement {
  const c = el('span', 'chip', text);
  c.style.color = qualityOf(q).color;
  c.title = qualityOf(q).name;
  return c;
}

export function renderShop(s: Snapshot, venue: VenueId = 'shop'): HTMLElement[] {
  const v = s[venue];
  latest = v;
  const tavern = venue === 'tavern';
  if (!v)
    return [
      el(
        'p',
        'empty',
        tavern
          ? 'The town has no tavern yet. Once it learns Hospitality (after Barter) it builds a Fireside Inn, and travellers stop for a meal and a drink.'
          : 'The town has no shop yet. Once it learns Barter it builds a Trading Post, and travellers start stopping by.',
      ),
    ];
  const out: HTMLElement[] = [];
  const place = tavern ? 'tavern' : 'shop';
  const floorWord = tavern ? 'Comfort' : 'Appeal';

  const head = el('div', 'panel-head');
  head.append(el('span', 'shop-coins', `● ${s.coins} coins`), el('span', '', tavern ? `Comfort ${v.appeal} · Renown ${v.renown}` : `Attractiveness ${v.attractiveness}`));
  out.push(head);

  canvas ??= el('canvas', 'shop-floor');
  const w = v.cols * CELL + WALL * 2;
  const h = (v.rooms ? UPSTAIRS_H : 0) + BACK + v.rows * DEPTH + SILL;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const frame = el('div', 'shop-frame');
  frame.append(canvas);
  startDrawing();
  // (on a wide screen the picture sits beside the rest; see .shop-layout)
  const info: HTMLElement[] = [];
  const layout = el('div', 'shop-layout');
  const side = el('div', 'shop-info');
  layout.append(frame, side);
  out.push(layout);

  // is it open?
  const status =
    v.progress !== null
      ? `Being built: ${Math.floor(v.progress * 100)}%. The furnishings wait in the stores meanwhile.`
      : v.keeperName
        ? `${v.keeperName} keeps the ${place}.`
        : `Closed: nobody free to keep it.`;
  info.push(el('div', 'hint shop-status', status));
  const every = ((TRAVELLER_EVERY[0] + TRAVELLER_EVERY[1]) / 2 / (1 + v.attractiveness / APPEAL_HALVES_WAIT)).toFixed(1);
  info.push(
    el(
      'div',
      'hint',
      (tavern
        ? `Comfort ${v.appeal}: guests used to more walk out, and the better-off need more. Renown ${v.renown} brings them more often.`
        : `Attractiveness ${v.attractiveness}: the furnishings' appeal (${v.appeal}) and the shop's renown (${v.renown}).`) +
        ` Someone comes about every ${every} hours` +
        (v.nextHours !== null ? ` (the next in about ${Math.max(1, Math.ceil(v.nextHours))}h)` : '') +
        '.',
    ),
  );

  // who's in, and what they came for
  info.push(el('h2', '', tavern ? 'Guests' : 'In the shop'));
  if (!v.customers.length) info.push(el('p', 'empty', v.passing ? `${v.passing} on the road, coming or going.` : 'Nobody just now.'));
  for (const c of v.customers) {
    const row = el('div', 'shop-guest');
    row.append(el('span', 'shop-guest-name', `${c.name}, a ${c.kind}`), el('span', 'shop-guest-want', `${c.asleep ? 'asleep in bed' : `after ${c.wants}`}${c.temper ? ` · ${c.temper}` : ''}${c.req !== null ? ` · used to comfort ${c.req}` : ''}${c.bed && !c.asleep ? ' · staying the night' : ''}`));
    info.push(row);
  }

  if (tavern) {
    info.push(el('h2', '', 'Menu'));
    const menu = el('div', 'shop-pieces');
    for (const d of v.menu) {
      if (d.needs) menu.append(el('span', 'chip dim', `${d.name} (${d.needs})`));
      else menu.append(qualityChip(`${d.name} ${d.have} · ${d.price}c`, d.have ? d.best : 1));
    }
    info.push(menu, el('div', 'hint', 'Hearty food, drinks and sweets. The town cooks what guests ask for most; a skilled cook makes finer dishes, which fetch more.'));
    info.push(el('h2', '', 'Rooms'));
    info.push(
      el(
        'div',
        'hint',
        v.beds
          ? `${v.rooms} rooms upstairs, ${v.beds} with a bed, ${v.lodgers} taken tonight. Guests who come in the evening may stay the night and pay for the bed (a finer bed fetches more), leaving in the morning.`
          : `${v.rooms} rooms upstairs, none with a bed yet: guests who come in the evening have nowhere to stay the night. The town makes a bed once they ask.`,
      ),
    );
  } else {
    // who it draws, and what each wants
    info.push(el('h2', '', 'Customers'));
    for (const t of v.tiers) {
      const row = el('div', t.drawn ? 'shop-tier' : 'shop-tier locked');
      const top = el('div', 'shop-tier-top');
      top.append(el('span', 'shop-tier-name', `${'★'.repeat(t.tier - 1) || '·'} ${t.plural}`), el('span', 'shop-tier-from', t.drawn ? 'coming' : `at attractiveness ${t.from}`));
      row.append(top);
      if (t.tier > 1 || t.wares.some((w) => w.have)) {
        const wares = el('div', 'shop-pieces');
        for (const w of t.wares) wares.append(el('span', w.needs ? 'chip dim' : 'chip', w.needs ? `${w.name} (${w.needs})` : `${w.name} ${w.have} · ${w.price}c`));
        row.append(wares);
      }
      if (t.tier > 1 && t.drawn && !t.wares.some((w) => w.have)) row.append(el('div', 'hint', `None in stock: ${t.plural.toLowerCase()} leave disappointed, and the shop's renown falls.`));
      info.push(row);
    }
    info.push(el('h2', '', 'Gear in stock'));
    if (!v.gear.length) info.push(el('p', 'empty', 'None spare.'));
    else {
      const gear = el('div', 'shop-pieces');
      for (const g of v.gear) gear.append(qualityChip(`${g.q !== 1 ? qualityOf(g.q).name + ' ' : ''}${g.name}${g.n > 1 ? ` ×${g.n}` : ''} · ${g.price}c`, g.q));
      info.push(gear);
    }
    info.push(el('div', 'hint', `Travellers buy it, and so do the townsfolk, with their wages (${s.wageBill} coins a day in all), for a little less.`));
    info.push(el('h2', '', 'Spare to sell'));
    info.push(stockRow(v.forSale, 'Nothing spare: the town needs everything it has.'));
    info.push(el('h2', '', 'Wants to buy'));
    const wants: Stock = {};
    for (const w of v.wants) wants[w.m] = w.n;
    info.push(stockRow(wants, 'Nothing: the town has what it needs.'));
    const must = v.wants.filter((w) => w.essential).map((w) => MATERIAL_NAMES[w.m].toLowerCase());
    if (must.length) info.push(el('div', 'hint', `It can't get ${must.join(' or ')} any other way: it buys it whatever it costs.`));
  }

  if (v.asked.length) {
    info.push(el('h2', '', 'Asked for, and not found'));
    const asked = el('div', 'shop-pieces');
    for (const a of v.asked) asked.append(el('span', 'chip', `${a.what}${a.times > 1 ? ` ×${a.times}` : ''}`));
    info.push(asked, el('div', 'hint', 'The town makes what it can of this, from what it has spare.'));
  }

  info.push(el('h2', '', `Furnishings (${v.pieces.length})`));
  if (!v.pieces.length) info.push(el('p', 'empty', 'Bare floor so far.'));
  const pieces = el('div', 'shop-pieces');
  for (const p of v.pieces) {
    const name = `${p.q !== 1 ? qualityOf(p.q).name + ' ' : ''}${p.name}${p.level > 1 ? ' ' + '★'.repeat(p.level - 1) : ''}`;
    pieces.append(qualityChip(`${name} +${Math.round(p.appeal * qualityOf(p.q).mult * (1 + (p.level - 1) / 2))}`, p.q));
  }
  if (v.pieces.length) info.push(pieces);
  const levelled = v.pieces.filter((p) => p.level > 1).length;
  if (v.making) info.push(el('div', 'hint', `Being made for it: ${v.making}.`));
  if (v.waiting.length) info.push(el('div', 'hint', `Made, waiting to be set out: ${v.waiting.join(', ')}.`));
  if (levelled) info.push(el('div', 'hint', `${levelled} improved with coins (★ a second tier, ★★ polished and trimmed in brass).`));
  info.push(el('div', 'hint', `${floorWord} counts each piece's quality. Floor ${v.cols}×${v.rows}` + (v.extensions ? `, extended ${v.extensions} of ${v.maxExtensions} times` : '') + (v.nextExtension !== null ? `. The town extends it (${v.nextExtension} coins) once it's crowded and it has coins to spare.` : '.')));
  if (v.grows) info.push(el('div', 'hint', `It grows into a ${v.grows.name}${v.grows.research ? ` once the town learns ${v.grows.research}` : ''}, with room for more.`));

  info.push(el('h2', '', 'Lately'));
  if (!v.log.length) info.push(el('p', 'empty', tavern ? 'No guests yet.' : 'No travellers yet.'));
  for (const l of [...v.log].reverse()) {
    const row = el('div', 'shop-log');
    row.append(el('span', 'shop-when', l.when.replace(/ · \w+ · /, ' · ')), el('span', '', l.text));
    info.push(row);
  }
  side.append(...info);
  return out;
}

function stockRow(st: Stock, none: string): HTMLElement {
  const entries = (Object.entries(st) as [Material, number][]).filter(([, n]) => n > 0);
  if (!entries.length) return el('p', 'empty', none);
  const row = el('div', 'shop-pieces');
  for (const [m, n] of entries) {
    const c = el('span', 'chip');
    const icon = materialIcon(m, 12);
    if (icon) c.append(icon);
    c.append(`${MATERIAL_NAMES[m]} ${n}`);
    row.append(c);
  }
  return row;
}

/* ------------------------------------------------------------ the picture */

// Seen at an angle, like a stage with its front wall taken away: the back wall stands up at the top with its windows
// (and anything hung on it), the floor runs down towards us in rows, and each piece stands up off the floor as a
// box with a lit top and a front face. So the people in it are their ordinary side-on sprites, the same as in the
// town, walking about among the furniture: whatever's nearer (lower on the floor) is drawn over what's behind.

/** Travellers browsing, moving from piece to piece: x in the picture's pixels, y where their feet are. */
interface Walker {
  id: number;
  look: Look;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
  /** facing left (the sprites face right) */
  left: boolean;
}
const walkers = new Map<number, Walker>();

/** The characters, and the frames composed so far (the townsfolk's own look, side-on). */
let lpcReady: Promise<void> | null = null;
let lpcLoaded = false;
const frames = new Map<string, HTMLCanvasElement>();
function frameOf(look: Look, frame: number): HTMLCanvasElement {
  const key = `${lookKey(look)}|${frame}`;
  let c = frames.get(key);
  if (!c) {
    if (frames.size > 400) frames.clear();
    c = lpcCanvas(look, 'walk', frame);
    frames.set(key, c);
  }
  return c;
}

function startDrawing(): void {
  lpcReady ??= loadLpc().then(
    () => void (lpcLoaded = true),
    () => undefined,
  );
  if (running) return;
  running = true;
  let last = performance.now();
  const frame = (now: number) => {
    // (it stops when the window closes or moves on to another tab, and starts again when the shop's shown)
    if (!canvas?.isConnected || !latest) {
      running = false;
      return;
    }
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    draw(canvas, latest, now / 1000, dt);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** Colours for goods on the shelves: the town's goods for sale where it has them. */
const GOODS: Partial<Record<Material, string>> = {
  wood: '#8a5a30', stone: '#8b8680', flint: '#5a5a64', fiber: '#aab35c', hide: '#a88258', bone: '#e8e0cc', clay: '#b0704a', herbs: '#5a9443',
  vegetables: '#6a9a3a', fruit: '#d0402a',
  meat: '#a8423a', berries: '#8a2a4a', grain: '#d8c060', dried_meat: '#7a3a2a', rations: '#c8a060', sling_stones: '#6b6763', iron_ore: '#7a5a4a',
  iron: '#9aa0a8', lumber: '#c08a50', bricks: '#a4543a', leather: '#7c4c2c', cloth: '#d8c8a8', flour: '#f0e8d8', bread: '#d0903a', arrows: '#8a6a4a',
  coal: '#2a2a2a', steel: '#b0b8c0', glass: '#a8d8e8', shot: '#50505a', oil: '#1a1a20', fuel: '#d0a020', plastic: '#e05a8a', concrete: '#a0a09a',
  electronics: '#3a8a4a', cartridges: '#c8a040', rare_minerals: '#8a5ad8', alloys: '#c0c8e0', circuits: '#2a7a3a', power_cells: '#4ad8e8',
};
const FALLBACK_GOODS = ['#d8a050', '#8a4a30', '#c8b8a0', '#5a5a64', '#6f9a45'];

type Room = { floor: string; seam: string; wall: string; wallLight: string; wallDark: string; build: 'logs' | 'plaster' | 'brick' | 'stone' };
const ROOMS: Record<string, Room> = {
  trading_post: { floor: '#8a6a44', seam: '#7a5c3a', wall: '#6a4628', wallLight: '#86603a', wallDark: '#3b2616', build: 'logs' },
  general_store: { floor: '#a0703e', seam: '#83582e', wall: '#d8c8a8', wallLight: '#efe2c6', wallDark: '#8a7a60', build: 'plaster' },
  emporium: { floor: '#c8bca0', seam: '#a89c80', wall: '#a4543a', wallLight: '#bc6a48', wallDark: '#6a3424', build: 'brick' },
  fireside_inn: { floor: '#6e5236', seam: '#5e452c', wall: '#6b6763', wallLight: '#8b8680', wallDark: '#3b3836', build: 'stone' },
  tavern: { floor: '#7a4e2a', seam: '#5e3a1e', wall: '#a4543a', wallLight: '#bc6a48', wallDark: '#5a2e1e', build: 'brick' },
};

/** How tall each piece stands off the floor (pixels), by item, then by kind. */
const TALL: Record<string, number> = {
  log_table: 9, oak_table: 10, stone_hearth: 26, brick_hearth: 28, barrels: 14, upright_piano: 24, clay_urns: 12, herb_planter: 7,
  iron_lantern: 22, shelf: 30, table: 11, stand: 15, counter: 15,
};
/** Hung on the back wall rather than stood on the floor. */
const ON_WALL = new Set(['tapestry', 'neon_sign']);
const PAL_WOOD = '#8a5a30';

function draw(c: HTMLCanvasElement, v: ShopView, t: number, dt: number): void {
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const pal = ROOMS[v.def] ?? ROOMS.trading_post;
  const W = c.width;
  const up = v.rooms ? UPSTAIRS_H : 0;
  const H = c.height - up;
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const oval = (cx: number, cy: number, rx: number, ry: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(Math.round(cx), Math.round(cy), rx, ry, 0, 0, Math.PI * 2);
    g.fill();
  };
  const cellX = (x: number) => WALL + x * CELL;
  /** The floor's y at a row's back edge (rows run from the back wall towards us). */
  const rowY = (y: number) => BACK + y * DEPTH;
  const floorBottom = rowY(v.rows);
  /** A box standing on the floor: its footprint's back edge at y0, d deep, h tall: a lit top and a front face. */
  const box = (x: number, y0: number, w: number, d: number, h: number, top: string, front: string, edge = 'rgba(0,0,0,0.35)') => {
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(Math.round(x + 1), Math.round(y0 + d - 1), Math.round(w), 2); // (its shadow on the floor)
    rect(x, y0 - h, w, d, top);
    rect(x, y0 + d - h, w, h, front);
    rect(x, y0 + d - h, w, 1, edge);
    rect(x, y0 - h, w, 1, 'rgba(255,255,255,0.18)');
  };

  // (a tavern's guest rooms are a storey above; the common room is drawn below them)
  const sleepers = new Map<string, Look>();
  g.save();
  g.translate(0, up);
  // the back wall, built of the venue's own stuff
  rect(0, 0, W, H, pal.wallDark);
  rect(0, 0, W, BACK, pal.wall);
  for (let y = 0; y < BACK; y += pal.build === 'logs' ? 5 : 4) {
    if (pal.build === 'logs') {
      rect(0, y, W, 1, pal.wallLight);
      rect(0, y + 4, W, 1, pal.wallDark);
    } else if (pal.build === 'brick' || pal.build === 'stone') {
      rect(0, y + 3, W, 1, pal.wallDark);
      const step = pal.build === 'brick' ? 8 : 11;
      for (let x = ((y / 4) % 2) * (step / 2); x < W; x += step) rect(x, y, 1, 3, pal.wallDark);
      for (let x = ((y * 3) % 7) + 2; x < W; x += 13) rect(x, y + 1, 3, 1, pal.wallLight);
    } else {
      for (let x = (y * 5) % 9; x < W; x += 9) rect(x, y + 1, 1, 1, pal.wallDark);
    }
  }
  if (pal.build === 'plaster') for (let x = WALL; x < W; x += 24) rect(x, 0, 2, BACK, '#8a6a44'); // (timber framing)
  // windows, with the sky out there
  for (let x = 1; x < v.cols - 3; x += 3) {
    const wx = cellX(x) + 2;
    rect(wx - 1, 7, CELL - 2, 17, pal.wallDark);
    rect(wx, 8, CELL - 4, 15, v.night ? '#1e2a48' : '#86b9e0');
    rect(wx, 8, CELL - 4, 5, v.night ? '#2a3a5e' : '#a8d0ec');
    if (v.night) rect(wx + 2 + (x % 3), 10 + (x % 4), 1, 1, '#e8e8f0'); // (a star)
    rect(wx + (CELL - 4) / 2 - 1, 8, 1, 15, pal.wallDark);
    rect(wx, 15, CELL - 4, 1, pal.wallDark);
    rect(wx - 2, 23, CELL, 2, pal.wallLight); // the sill
  }
  rect(0, BACK - 3, W, 3, pal.wallDark); // skirting
  // what's hung on the wall
  for (const p of v.pieces) if (ON_WALL.has(p.item)) hang(p);
  if (v.venue === 'tavern')
    for (let k = 0; k < v.keeper.w; k++) {
      // casks racked against the back wall, behind the barkeep
      const x = cellX(v.keeper.x + k) + 2;
      rect(x, BACK - 12, 12, 10, '#5a3a22');
      rect(x + 1, BACK - 11, 10, 8, '#8a5a30');
      rect(x + 3, BACK - 11, 1, 8, '#3a3a40');
      rect(x + 8, BACK - 11, 1, 8, '#3a3a40');
      oval(x + 6, BACK - 7, 2, 2, '#3b2616');
    }

  // the floor
  for (let y = 0; y < v.rows; y++) {
    const py = rowY(y);
    if (v.def === 'emporium') for (let x = 0; x < v.cols; x++) rect(cellX(x), py, CELL, DEPTH, (x + y) % 2 ? pal.floor : pal.seam);
    else {
      rect(0, py, W, DEPTH, pal.floor);
      for (let k = 0; k < DEPTH; k += 4) rect(0, py + k, W, 1, pal.seam); // boards, running across
      for (let k = 0; k < DEPTH; k += 4) rect(((y * 37 + k * 11) % W) | 0, py + k, 1, 4, pal.seam);
      if (v.def === 'trading_post' || v.def === 'fireside_inn')
        for (let x = 0; x < v.cols; x++) rect(cellX(x) + ((x * 5 + y * 3) % 11), py + ((x * 3 + y * 7) % (DEPTH - 1)), 3, 1, '#b89a58'); // straw
    }
  }
  // the side walls, seen end-on
  rect(0, 0, WALL, H, pal.wall);
  rect(W - WALL, 0, WALL, H, pal.wall);
  rect(WALL - 1, 0, 1, H, pal.wallDark);
  rect(W - WALL, 0, 1, H, pal.wallDark);
  // the front: a low sill with the doorway in it
  const doorX = cellX(v.door);
  rect(0, floorBottom, W, H - floorBottom, pal.wall);
  rect(0, floorBottom, W, 1, pal.wallLight);
  rect(doorX + 1, floorBottom, CELL - 2, H - floorBottom, '#8a3a2a'); // the doormat on the threshold
  rect(doorX + 1, floorBottom, CELL - 2, 1, '#a84a3a');

  // rugs lie flat, under everything else
  for (const p of v.pieces) if (p.y >= 0 && (p.kind === 'rug' || p.item.endsWith('_rug') || p.item === 'woven_mat')) rug(p);

  // everything standing, back to front, with the people among it
  const layers: { y: number; paint: () => void }[] = [];
  const cy = rowY(v.counter.y);
  layers.push({ y: rowY(v.counter.y + 1), paint: () => counter(cellX(v.counter.x), cy, v.counter.w * CELL) });
  if (v.keeperLook) {
    const look = v.keeperLook;
    layers.push({ y: rowY(v.keeper.y + 1) - 2, paint: () => person(cellX(v.keeper.x) + CELL, rowY(v.keeper.y + 1) - 2, look, false, false, t, 1) });
  }
  for (const p of v.pieces) {
    if (p.y < 0 || ON_WALL.has(p.item) || p.kind === 'rug' || p.item.endsWith('_rug') || p.item === 'woven_mat') continue;
    layers.push({ y: rowY(p.y + p.h), paint: () => piece(p) });
  }

  // travellers browsing
  const here = new Set(v.customers.map((q) => q.id));
  for (const id of walkers.keys()) if (!here.has(id)) walkers.delete(id);
  const spots = browseSpots(v);
  for (const q of v.customers) {
    let wk = walkers.get(q.id);
    if (!wk) {
      const x0 = doorX + CELL / 2;
      wk = { id: q.id, look: q.look, x: x0, y: floorBottom + 4, tx: x0, ty: floorBottom - 2, wait: 0, left: false };
      walkers.set(q.id, wk);
    }
    const dx = wk.tx - wk.x;
    const dy = wk.ty - wk.y;
    const d = Math.hypot(dx, dy * 1.5);
    const moving = d > 0.5;
    if (moving) {
      const k = Math.min(1, (16 * dt) / d);
      wk.x += dx * k;
      wk.y += dy * k;
      if (Math.abs(dx) > 0.3) wk.left = dx < 0;
    } else if ((wk.wait -= dt) <= 0) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      wk.tx = s.x;
      wk.ty = s.y;
      wk.wait = v.venue === 'tavern' ? 6 + Math.random() * 8 : 1.5 + Math.random() * 3;
    } else if (v.venue === 'tavern') {
      // (seated, they turn to the table)
      const table = v.pieces.find((p) => p.kind === 'table' && Math.abs(wk!.y - rowY(p.y + p.h / 2) - 3) < 3);
      if (table) wk.left = wk.x > cellX(table.x + table.w / 2);
    }
    const w = wk;
    if (q.asleep && q.bed) {
      // (in bed: drawn with it, under the covers)
      // (they're upstairs: when they come down in the morning, it's by the stairs at the back)
      w.x = cellX(0) + 4;
      w.y = rowY(0) + 3;
      w.tx = w.x;
      w.ty = w.y;
      sleepers.set(`${q.bed.x},${q.bed.y}`, q.look);
      continue;
    }
    layers.push({ y: w.y, paint: () => person(w.x, w.y, w.look, moving, w.left, t + q.id, q.tier) });
  }
  layers.sort((a, b) => a.y - b.y);
  for (const l of layers) l.paint();

  // (a soft glow from each hearth, over the floor in front of it)
  for (const p of v.pieces)
    if (p.item.endsWith('_hearth')) {
      const x = cellX(p.x) + (p.w * CELL) / 2;
      const y = rowY(p.y + p.h);
      const glow = g.createRadialGradient(x, y, 2, x, y, CELL * 2);
      glow.addColorStop(0, `rgba(255, 150, 60, ${0.2 + 0.06 * Math.sin(t * 7)})`);
      glow.addColorStop(1, 'rgba(255, 150, 60, 0)');
      g.fillStyle = glow;
      g.fillRect(x - CELL * 2, y - CELL * 2, CELL * 4, CELL * 3);
    }
  g.restore();
  if (up) upstairs();

  /** The guest rooms, a storey over the common room: plastered rooms side by side, each with a window, and a bed if
   *  the town has made one for it (with its guest asleep in it, of a night). */
  function upstairs(): void {
    const rooms = v.rooms;
    const rw = (W - WALL * 2) / rooms;
    const night = v.night;
    rect(0, 0, W, up, pal.wallDark);
    rect(WALL, 2, W - WALL * 2, up - 7, '#d8c8a8');
    for (let y = 4; y < up - 7; y += 5) for (let x = WALL + ((y * 3) % 7); x < W - WALL; x += 9) rect(x, y, 1, 1, '#c8b898'); // (plaster)
    rect(WALL, up - 5, W - WALL * 2, 3, pal.floor); // the floorboards
    rect(WALL, up - 5, W - WALL * 2, 1, pal.seam);
    rect(0, up - 2, W, 2, pal.wallDark); // the beam between the storeys
    rect(0, 0, W, 2, pal.wallDark);
    for (let i = 0; i < rooms; i++) {
      const x0 = WALL + i * rw;
      if (i > 0) rect(x0 - 1, 2, 2, up - 4, pal.wallDark); // the partition
      // a little window (the moon out there, of a night)
      const wx = x0 + rw - 9;
      rect(wx - 1, 5, 7, 8, pal.wallDark);
      rect(wx, 6, 5, 6, night ? '#2a3a5a' : '#86b9e0');
      rect(wx + 2, 6, 1, 6, pal.wallDark);
      const bed = v.pieces.find((p) => p.y === -1 && p.x === i);
      const yb = up - 5;
      if (!bed) {
        // (empty: a stool, waiting for a bed)
        rect(x0 + 5, yb - 4, 5, 1, PAL_WOOD);
        rect(x0 + 5, yb - 3, 1, 3, PAL_WOOD);
        rect(x0 + 9, yb - 3, 1, 3, PAL_WOOD);
        continue;
      }
      const feather = bed.item === 'feather_bed';
      const straw = bed.item === 'straw_pallet';
      const frame = straw ? '#b89a58' : feather ? '#6a3a22' : '#8a5a30';
      const cover = straw ? '#a88258' : feather ? '#8a2a3a' : '#7c5c3c';
      const bx = x0 + 3;
      const bl = Math.min(rw - 13, 22);
      const top = straw ? yb - 3 : yb - 5;
      if (feather) {
        for (const px of [bx, bx + bl - 1]) rect(px, yb - 18, 1, 18, '#4a2a18'); // posts
        rect(bx, yb - 19, bl, 2, '#8a2a3a'); // the canopy
        rect(bx, yb - 17, bl, 1, '#c8a050');
      }
      if (!straw) {
        rect(bx, top - 5, 2, yb - top + 5, frame); // headboard
        rect(bx, yb - 2, 1, 2, '#3b2616'); // legs
        rect(bx + bl - 1, yb - 2, 1, 2, '#3b2616');
      }
      rect(bx, top, bl, straw ? 3 : 3, frame);
      rect(bx + 2, top - 3, 5, 3, '#e8e0cc'); // the pillow
      rect(bx + 7, top - 2, bl - 8, 2, cover); // the blanket
      rect(bx + 7, top - 2, bl - 8, 1, 'rgba(255,255,255,0.2)');
      if ((bed.level ?? 1) > 1) rect(bx, top, bl, 1, (bed.level ?? 1) > 2 ? '#f0c848' : '#b08a3a');
      const sleeper = sleepers.get(`${i},-1`);
      if (sleeper) {
        // someone asleep: their head on the pillow, the covers over them, and a z or two drifting up
        oval(bx + 5, top - 4, 3, 2.5, sleeper.skin);
        rect(bx + 3, top - 7, 5, 2, sleeper.hairColor);
        rect(bx + 3, top - 5, 1, 2, sleeper.hairColor);
        rect(bx + 9, top - 4, bl - 11, 2, cover);
        const k = (t * 0.6 + i * 0.37) % 1;
        g.globalAlpha = 1 - k;
        g.fillStyle = '#f0f0f8';
        g.font = 'bold 7px monospace';
        g.fillText('z', Math.round(bx + 7 + k * 4), Math.round(top - 8 - k * 8));
        g.globalAlpha = 1;
        // (a candle left burning)
        g.fillStyle = `rgba(255, 200, 90, ${0.18 + 0.05 * Math.sin(t * 6 + i)})`;
        g.fillRect(Math.round(x0 + 2), 3, Math.round(rw - 4), up - 8);
      }
    }
  }

  function counter(x: number, y0: number, w: number): void {
    const h = TALL.counter;
    box(x, y0, w, DEPTH - 2, h, '#8a5a30', '#5a3a22');
    for (let k = x + 3; k < x + w - 2; k += 6) rect(k, y0 + DEPTH - 2 - h + 3, 1, h - 4, '#4a2e1a'); // panels
    const top = y0 - h;
    if (v.venue === 'tavern') {
      for (const dx of [4, 12, 21]) {
        if (dx + 3 > w) continue;
        rect(x + dx, top - 3, 3, 5, '#c8a050'); // tankards
        rect(x + dx, top - 4, 3, 1, '#f0f0e0');
        rect(x + dx + 3, top - 2, 1, 2, '#a8803a');
      }
    } else {
      oval(x + 6, top + 4, 2, 1, '#e8c040');
      oval(x + 9, top + 3, 2, 1, '#f0d060');
      rect(x + w - 10, top - 3, 7, 1, '#c0c8d0'); // scales
      rect(x + w - 7, top - 3, 1, 6, '#8a94a0');
      rect(x + w - 11, top - 2, 3, 1, '#c0c8d0');
      rect(x + w - 5, top - 2, 3, 1, '#c0c8d0');
    }
  }

  function hang(p: ShopView['pieces'][number]): void {
    const x = cellX(p.x) + (p.w * CELL) / 2;
    if (p.item === 'tapestry') {
      rect(x - 7, 4, 14, 1, '#5a3a22');
      rect(x - 6, 5, 12, 22, '#6a1a2a');
      rect(x - 5, 6, 10, 20, '#8a2a3a');
      rect(x - 3, 11, 6, 7, '#c8a050');
      rect(x - 1, 13, 2, 3, '#8a2a3a');
      for (let k = -5; k < 6; k += 2) rect(x + k, 27, 1, 2, '#c8a050'); // fringe
    } else {
      const on = Math.sin(t * 3) > -0.8;
      rect(x - 8, 10, 16, 8, '#2a2a30');
      rect(x - 6, 13, 12, 2, on ? '#ff5ab8' : '#6a2a50');
      if (on) {
        g.fillStyle = 'rgba(255, 90, 184, 0.18)';
        g.fillRect(Math.round(x - 11), 7, 22, 14);
      }
    }
    trim(p, x - 7, 5, 14, 1);
  }

  function rug(p: ShopView['pieces'][number]): void {
    const x = cellX(p.x);
    const y = rowY(p.y);
    const w = p.w * CELL;
    const d = p.h * DEPTH;
    if (p.item === 'hide_rug') {
      oval(x + w / 2, y + d / 2, w / 2 - 2, d / 2 - 1, '#a88258');
      oval(x + w / 2, y + d / 2, w / 2 - 5, d / 2 - 3, '#b8926a');
    } else if (p.item === 'wool_rug') {
      rect(x + 1, y + 1, w - 2, d - 2, '#8a2a3a');
      rect(x + 3, y + 2, w - 6, d - 4, '#c8a050');
      rect(x + 5, y + 3, w - 10, d - 6, '#8a2a3a');
    } else {
      rect(x + 1, y + 1, w - 2, d - 2, '#b89a58');
      for (let k = x + 3; k < x + w - 3; k += 3) rect(k, y + 1, 1, d - 2, '#8a7040');
    }
    if (p.level > 1) rect(x + 2, y + 1, w - 4, 1, p.level > 2 ? '#f0c848' : '#b08a3a');
  }

  /** Brass trim along an improved piece's top edge (gold and a glint for the third tier). */
  function trim(p: ShopView['pieces'][number], x: number, y: number, w: number, h: number): void {
    if (p.level <= 1) return;
    const col = p.level > 2 ? '#f0c848' : '#b08a3a';
    rect(x, y, w, 1, col);
    rect(x, y, 1, h, col);
    rect(x + w - 1, y, 1, h, col);
    if (p.level > 2 && Math.sin(t * 2 + p.x) > 0.9) rect(x + 1 + ((t * 20) % Math.max(1, w - 3)), y, 2, 1, '#fff8d0');
  }

  function piece(p: ShopView['pieces'][number]): void {
    const goods = Object.keys(v.forSale).map((m) => GOODS[m as Material] ?? '#c8a060');
    // (a town with only a kind or two to sell still stocks its shelves with odds and ends)
    const shelf = goods.length >= 3 ? goods : [...goods, ...FALLBACK_GOODS];
    const good = (i: number) => shelf[(i + p.x * 3 + p.y) % shelf.length];
    const x = cellX(p.x);
    const y0 = rowY(p.y);
    const w = p.w * CELL;
    const d = p.h * DEPTH;
    const h = TALL[p.item] ?? TALL[p.kind] ?? 10;
    switch (p.item) {
      case 'log_table':
      case 'oak_table': {
        const top = p.item === 'oak_table' ? '#a8703a' : '#8a5a30';
        box(x + 1, y0, w - 2, 3, 5, '#6a4428', '#4a2e1a'); // the bench (or chairs) behind
        box(x + 3, y0 + 2, w - 6, d - 5, h, top, '#5a3a22');
        rect(x + 4, y0 + d - 3, 2, 1, '#2a1a10'); // legs
        rect(x + w - 6, y0 + d - 3, 2, 1, '#2a1a10');
        for (let k = y0 + 3 - h; k < y0 + d - 4 - h; k += 3) rect(x + 4, k, w - 8, 1, '#77502f');
        rect(x + 8, y0 - h + 1, 3, 4, '#c8a050'); // a tankard, a plate
        oval(x + w - 9, y0 + 4 - h, 3, 1, '#e8e0cc');
        box(x + 1, y0 + d - 3, w - 2, 3, 5, '#6a4428', '#4a2e1a'); // and in front
        trim(p, x + 3, y0 + 2 - h, w - 6, 2);
        return;
      }
      case 'stone_hearth':
      case 'brick_hearth': {
        const stone = p.item === 'brick_hearth' ? '#a4543a' : '#6b6763';
        box(x + 1, y0, w - 2, d - 2, h, p.item === 'brick_hearth' ? '#bc6a48' : '#8b8680', stone);
        const fy = y0 + d - 2 - h;
        for (let k = fy + 3; k < fy + h; k += 4) rect(x + 1, k, w - 2, 1, 'rgba(0,0,0,0.25)');
        rect(x + 5, fy + h - 12, w - 10, 11, '#2a1a10');
        const flick = Math.sin(t * 9 + p.x) > 0 ? 1 : 0;
        rect(x + 7, fy + h - 7 - flick, w - 14, 6 + flick, '#e8702a');
        rect(x + 9, fy + h - 5, w - 18, 4, '#ffd060');
        rect(x + 3, fy + h - 13, w - 6, 2, '#5a3a22'); // the mantel
        trim(p, x + 1, y0 - h, w - 2, 3);
        return;
      }
      case 'barrels':
        for (const [bx, by] of [
          [x + 1, y0 + 1],
          [x + 7, y0 + d - 4],
        ]) {
          rect(bx, by - h + 2, 9, h - 1, '#8a5a30');
          rect(bx, by - h + 5, 9, 1, '#3a3a40');
          rect(bx, by - 3, 9, 1, '#3a3a40');
          rect(bx + 1, by - h + 2, 1, h - 1, '#a87a48');
          oval(bx + 4.5, by - h + 2, 4.5, 2, '#5a3a22');
          oval(bx + 4.5, by - h + 2, 3.5, 1, '#77502f');
        }
        return;
      case 'upright_piano':
        box(x + 1, y0, w - 2, 4, h, '#3a2a1c', '#2a1a10');
        box(x + 2, y0 + 4, w - 4, 3, 11, '#f0ece0', '#2a1a10'); // the keyboard
        for (let k = x + 3; k < x + w - 3; k += 3) rect(k, y0 - 4, 1, 2, '#1a1a1a');
        trim(p, x + 1, y0 - h, w - 2, 3);
        return;
      case 'clay_urns':
        for (const [ux, uy, s] of [
          [x + 5, y0 + 3, 1],
          [x + 11, y0 + d - 2, 0.8],
        ]) {
          oval(ux, uy - 5 * s, 4 * s, 5 * s, '#b0704a');
          oval(ux - 1, uy - 6 * s, 1.5 * s, 3 * s, '#c88a5a');
          rect(ux - 2 * s, uy - 11 * s, 4 * s, 2, '#80502f');
        }
        return;
      case 'herb_planter':
        box(x + 2, y0 + 1, w - 4, d - 3, h, '#5c3f27', '#80502f');
        for (let k = 0; k < 5; k++) oval(x + 4 + k * ((w - 8) / 4), y0 - h - 2 - (k % 2) * 2, 2.5, 3, k % 2 ? '#5a9443' : '#3e7234');
        oval(x + w / 2, y0 - h - 5, 2, 2, '#7fb456');
        return;
      case 'iron_lantern': {
        const lx = x + w / 2;
        const base = y0 + d - 2;
        const glow = 0.22 + 0.1 * Math.sin(t * 5);
        g.fillStyle = `rgba(255, 200, 90, ${glow})`;
        g.beginPath();
        g.arc(lx, base - h + 3, 9, 0, Math.PI * 2);
        g.fill();
        rect(lx - 3, base - 1, 6, 2, '#2a2a30');
        rect(lx, base - h + 6, 1, h - 6, '#3a3a40');
        rect(lx - 2, base - h, 5, 6, '#3a3a40');
        rect(lx - 1, base - h + 1, 3, 4, '#f0c060');
        return;
      }
    }
    switch (p.kind) {
      case 'shelf': {
        const glass = p.item === 'glass_cabinet';
        const wood = p.item === 'plank_shelf' ? '#77502f' : '#5a3a22';
        const dd = Math.min(d - 2, 6);
        box(x + 1, y0, w - 2, dd, h, wood, wood);
        const fy = y0 + dd - h; // (the front face's top, for a shallow shelf)
        rect(x + 2, fy + 2, w - 4, h - 3, glass ? '#8cc4d8' : '#3b2616');
        for (let row = 0; row < 3; row++) {
          const sy = fy + 2 + row * 9;
          rect(x + 2, sy + 8, w - 4, 1, wood); // the board
          const n = Math.floor((w - 6) / 3);
          for (let i = 0; i < n; i++) {
            if ((i + row) % 4 === 3 && p.level < 2) continue; // (gaps, until it's better stocked)
            const tall = 3 + ((i + row) % 3);
            rect(x + 3 + i * 3, sy + 8 - tall, 2, tall, good(i + row * 2));
          }
        }
        if (glass) {
          rect(x + 2, fy + 2, w - 4, 1, '#e0f4fa');
          rect(x + 3, fy + 3, 1, h - 6, 'rgba(255,255,255,0.35)');
        }
        trim(p, x + 1, fy, w - 2, h);
        return;
      }
      case 'table': {
        const cloth = p.item === 'display_table';
        box(x + 2, y0 + 1, w - 4, d - 3, h, cloth ? '#a83a4a' : '#8a5a30', cloth ? '#8a2a3a' : '#5a3a22');
        if (cloth) for (let k = x + 4; k < x + w - 4; k += 4) rect(k, y0 + d - 2 - h + 2, 1, h - 2, '#6a1a2a'); // folds
        else {
          rect(x + 3, y0 + d - 3, 2, 1, '#2a1a10');
          rect(x + w - 5, y0 + d - 3, 2, 1, '#2a1a10');
        }
        const n = Math.max(2, Math.floor((w - 8) / 6));
        for (let i = 0; i < n * 2; i++) {
          const gx = x + 5 + (i % n) * 6;
          const gy = y0 + 1 - h + Math.floor(i / n) * Math.max(3, d - 8);
          rect(gx, gy, 4, 3, good(i + 1));
          rect(gx, gy, 4, 1, 'rgba(255,255,255,0.25)');
        }
        trim(p, x + 2, y0 + 1 - h, w - 4, 2);
        return;
      }
      case 'stand':
        box(x + 3, y0 + 2, w - 6, d - 4, h, '#a87a48', '#8a5a30');
        for (let k = y0 + d - 2 - h + 3; k < y0 + d - 2; k += 4) rect(x + 3, k, w - 6, 1, '#5a3a22'); // slats
        rect(x + 5, y0 - h - 2, 4, 4, good(2));
        rect(x + w - 9, y0 - h - 1, 3, 3, good(3));
        trim(p, x + 3, y0 + 2 - h, w - 6, 2);
        return;
      default:
        box(x + 3, y0 + 1, w - 6, d - 3, h, '#a87a48', '#8a5a30');
    }
  }

  /** Someone side-on (their own look, as in the town), feet at (x, y); walking, or standing. */
  function person(x: number, y: number, look: Look, walking: boolean, left: boolean, phase: number, tier = 1): void {
    oval(x, y, 5, 1.5, 'rgba(0,0,0,0.28)');
    const top = y - (FEET_Y - HEAD_Y) * SCALE; // (the top of the head)
    if (lpcLoaded) {
      const f = walking ? 1 + (Math.floor(phase * 10) % (FRAME_COUNT.walk - 1)) : 0;
      const s = FRAME_SIZE * SCALE;
      g.save();
      g.translate(Math.round(x), Math.round(y));
      if (left) g.scale(-1, 1);
      g.drawImage(frameOf(look, f), -CENTRE_X * SCALE, -FEET_Y * SCALE, s, s);
      g.restore();
    } else {
      // (until the characters have loaded: a simple figure)
      rect(x - 3, top + 7, 6, y - top - 9, look.outfit);
      rect(x - 2, y - 3, 1, 3, '#3b2616');
      rect(x + 1, y - 3, 1, 3, '#3b2616');
      oval(x, top + 4, 3, 3.5, look.skin);
      rect(x - 3, top, 6, 3, look.hairColor);
    }
    // merchants wear a feathered cap, nobles a gold circlet, magnates a top hat
    const hx = Math.round(x) + (left ? 1 : -1);
    if (tier === 2) {
      rect(hx - 4, top, 8, 2, '#3a6ab0');
      rect(hx - 3, top - 1, 6, 1, '#3a6ab0');
      rect(hx + (left ? -4 : 3), top - 4, 1, 4, '#e8e0cc');
    } else if (tier === 3) {
      rect(hx - 3, top + 1, 6, 1, '#f0c848');
      rect(hx - 2, top, 1, 1, '#f0c848');
      rect(hx + 1, top, 1, 1, '#f0c848');
      rect(hx, top, 1, 1, '#e05a8a');
    } else if (tier === 4) {
      rect(hx - 4, top + 1, 8, 1, '#141418');
      rect(hx - 3, top - 5, 6, 6, '#141418');
      rect(hx - 3, top - 1, 6, 1, '#8a2a3a');
    }
  }
}

/** Where a browser stands (their feet): in front of each piece, and at the counter. */
function browseSpots(v: ShopView): { x: number; y: number }[] {
  const rowY = (y: number) => BACK + y * DEPTH;
  const bottom = rowY(v.rows) - 2;
  const atCounter = [0.5, 1.5].map((k) => ({ x: WALL + (v.counter.x + k) * CELL, y: Math.min(bottom, rowY(v.counter.y + 1) + 4) }));
  // tavern guests sit at the tables (on the benches either end), or stand at the bar
  if (v.venue === 'tavern') {
    const seats = v.pieces
      .filter((p) => p.kind === 'table')
      .flatMap((p) => [
        { x: WALL + p.x * CELL + 2, y: rowY(p.y + p.h / 2) + 3 },
        { x: WALL + (p.x + p.w) * CELL - 2, y: rowY(p.y + p.h / 2) + 3 },
      ]);
    return [...seats, ...atCounter];
  }
  const spots = v.pieces
    .filter((p) => p.kind !== 'rug' && !ON_WALL.has(p.item))
    .map((p) => ({ x: WALL + (p.x + p.w / 2) * CELL, y: Math.min(bottom, rowY(p.y + p.h) + 4) }));
  return [...spots, atCounter[0]];
}
