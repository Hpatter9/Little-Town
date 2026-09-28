// The shop's window: a bird's-eye view of the inside (drawn in code, like the town's buildings), with the shopkeeper
// behind the counter, the furnishings the town has set out, and travellers browsing, and below it what the shop sells
// and buys and what it has done lately. It only shows: the town runs the shop itself.

import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { APPEAL_HALVES_WAIT, TRAVELLER_EVERY } from '../../shared/data/shop';
import type { Look } from '../../shared/data/people';
import type { ShopView, Snapshot } from '../../shared/sim/snapshot';
import { materialIcon } from '../art/materialIcons';
import { el } from './dom';

/** Changes whenever something the text shows changes (the picture animates on its own). */
export const shopKey = (s: Snapshot) => {
  const v = s.shop;
  return JSON.stringify(v && [s.coins, v.def, v.progress !== null && Math.floor(v.progress * 20), v.pieces, v.appeal, v.renown, v.extensions, v.tiers, v.keeperName, v.customers.map((c) => c.id), v.passing, v.forSale, v.wants, v.log, v.nextHours !== null && Math.ceil(v.nextHours), v.making, v.waiting]);
};

/** Pixels per floor cell, and the thickness of the walls, in the picture's own pixels (it's scaled up to fit). */
const CELL = 16;
const WALL = 8;

let latest: ShopView | null = null;
let canvas: HTMLCanvasElement | null = null;
let running = false;

export function renderShop(s: Snapshot): HTMLElement[] {
  const v = s.shop;
  latest = v;
  if (!v) return [el('p', 'empty', 'The town has no shop yet. Once it learns Barter it builds a Trading Post, and travellers start stopping by.')];
  const out: HTMLElement[] = [];

  const head = el('div', 'panel-head');
  head.append(el('span', 'shop-coins', `● ${s.coins} coins`), el('span', '', `Attractiveness ${v.attractiveness}`));
  out.push(head);

  canvas ??= el('canvas', 'shop-floor');
  const w = v.cols * CELL + WALL * 2;
  const h = v.rows * CELL + WALL * 2;
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
        ? `${v.keeperName} keeps the shop.` + (v.customers.length ? ` Browsing: ${v.customers.map((c) => `${c.name} the ${c.kind}`).join(', ')}.` : '')
        : 'Closed: nobody free to keep it.';
  info.push(el('div', 'hint shop-status', status));
  const every = ((TRAVELLER_EVERY[0] + TRAVELLER_EVERY[1]) / 2 / (1 + v.attractiveness / APPEAL_HALVES_WAIT)).toFixed(1);
  info.push(el('div', 'hint', `Attractiveness ${v.attractiveness}: the furnishings' appeal (${v.appeal}) and the shop's renown (${v.renown}). Someone stops about every ${every} hours` + (v.nextHours !== null ? ` (the next in about ${Math.max(1, Math.ceil(v.nextHours))}h)` : '') + '.'));

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

  info.push(el('h2', '', 'For sale'));
  info.push(stockRow(v.forSale, 'Nothing spare: the town needs everything it has.'));
  info.push(el('h2', '', 'Wants to buy'));
  const wants: Stock = {};
  for (const w of v.wants) wants[w.m] = w.n;
  info.push(stockRow(wants, 'Nothing: the town has what it needs.'));
  const must = v.wants.filter((w) => w.essential).map((w) => MATERIAL_NAMES[w.m].toLowerCase());
  if (must.length) info.push(el('div', 'hint', `It can't get ${must.join(' or ')} any other way: it buys it whatever it costs.`));

  info.push(el('h2', '', `Furnishings (${v.pieces.length})`));
  if (!v.pieces.length) info.push(el('p', 'empty', 'Bare floor so far.'));
  const counts = new Map<string, { n: number; appeal: number }>();
  for (const p of v.pieces) {
    const name = p.name + (p.level > 1 ? ' ' + '★'.repeat(p.level - 1) : '');
    counts.set(name, { n: (counts.get(name)?.n ?? 0) + 1, appeal: Math.round(p.appeal * (1 + (p.level - 1) / 2)) });
  }
  const pieces = el('div', 'shop-pieces');
  for (const [name, { n, appeal }] of counts) pieces.append(el('span', 'chip', `${name}${n > 1 ? ` ×${n}` : ''} +${appeal}`));
  const levelled = v.pieces.filter((p) => p.level > 1).length;
  if (counts.size) info.push(pieces);
  if (v.making) info.push(el('div', 'hint', `Being made for it: ${v.making}.`));
  if (v.waiting.length) info.push(el('div', 'hint', `Made, waiting to be set out: ${v.waiting.join(', ')}.`));
  if (levelled) info.push(el('div', 'hint', `${levelled} improved with coins (★ a second tier, ★★ polished and trimmed in brass).`));
  info.push(el('div', 'hint', `Floor ${v.cols}×${v.rows}` + (v.extensions ? `, extended ${v.extensions} of ${v.maxExtensions} times` : '') + (v.nextExtension !== null ? `. The town extends it (${v.nextExtension} coins) once it's crowded and it has the coins to spare.` : '.')));
  if (v.grows) info.push(el('div', 'hint', `It grows into a ${v.grows.name}${v.grows.research ? ` once the town learns ${v.grows.research}` : ''}, with room for more.`));

  info.push(el('h2', '', 'Lately'));
  if (!v.log.length) info.push(el('p', 'empty', 'No travellers yet.'));
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

/** Travellers browsing, moving from piece to piece (the picture's own pixels). */
interface Walker {
  id: number;
  look: Look;
  x: number;
  y: number;
  tx: number;
  ty: number;
  wait: number;
}
const walkers = new Map<number, Walker>();

function startDrawing(): void {
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
  meat: '#a8423a', berries: '#8a2a4a', grain: '#d8c060', dried_meat: '#7a3a2a', rations: '#c8a060', sling_stones: '#6b6763', iron_ore: '#7a5a4a',
  iron: '#9aa0a8', lumber: '#c08a50', bricks: '#a4543a', leather: '#7c4c2c', cloth: '#d8c8a8', flour: '#f0e8d8', bread: '#d0903a', arrows: '#8a6a4a',
  coal: '#2a2a2a', steel: '#b0b8c0', glass: '#a8d8e8', shot: '#50505a', oil: '#1a1a20', fuel: '#d0a020', plastic: '#e05a8a', concrete: '#a0a09a',
  electronics: '#3a8a4a', cartridges: '#c8a040', rare_minerals: '#8a5ad8', alloys: '#c0c8e0', circuits: '#2a7a3a', power_cells: '#4ad8e8',
};
const FALLBACK_GOODS = ['#d8a050', '#8a4a30', '#c8b8a0', '#5a5a64', '#6f9a45'];

type Floor = { floor: string; seam: string; wall: string; wallLight: string; wallDark: string };
const FLOORS: Record<string, Floor> = {
  trading_post: { floor: '#8a6a44', seam: '#7a5c3a', wall: '#5a3a22', wallLight: '#77502f', wallDark: '#3b2616' },
  general_store: { floor: '#a0703e', seam: '#83582e', wall: '#d8c8a8', wallLight: '#efe2c6', wallDark: '#3b2616' },
  emporium: { floor: '#c8bca0', seam: '#a89c80', wall: '#a4543a', wallLight: '#bc6a48', wallDark: '#6a3424' },
};

function draw(c: HTMLCanvasElement, v: ShopView, t: number, dt: number): void {
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const pal = FLOORS[v.def] ?? FLOORS.trading_post;
  const W = c.width;
  const H = c.height;
  const rect = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };
  const disc = (cx: number, cy: number, r: number, col: string) => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(Math.round(cx), Math.round(cy), r, 0, Math.PI * 2);
    g.fill();
  };
  const cellX = (x: number) => WALL + x * CELL;
  const cellY = (y: number) => WALL + y * CELL;

  // floor
  rect(0, 0, W, H, pal.wallDark);
  for (let y = 0; y < v.rows; y++)
    for (let x = 0; x < v.cols; x++) {
      const px = cellX(x);
      const py = cellY(y);
      if (v.def === 'emporium') rect(px, py, CELL, CELL, (x + y) % 2 ? pal.floor : pal.seam);
      else if (v.def === 'general_store') {
        rect(px, py, CELL, CELL, pal.floor);
        for (let k = 0; k < CELL; k += 4) rect(px, py + k, CELL, 1, pal.seam);
        rect(px + ((y * 7) % CELL), py, 1, CELL, pal.seam);
      } else {
        rect(px, py, CELL, CELL, pal.floor);
        rect(px + ((x * 5 + y * 3) % 13), py + ((x * 3 + y * 7) % 11), 3, 1, '#b89a58'); // straw
      }
    }
  // walls, a window or two along the back, and the door in the front
  rect(0, 0, W, WALL, pal.wall);
  rect(0, WALL - 2, W, 2, pal.wallDark);
  rect(0, H - WALL, W, WALL, pal.wall);
  rect(0, H - WALL, W, 1, pal.wallLight);
  rect(0, 0, WALL, H, pal.wall);
  rect(W - WALL, 0, WALL, H, pal.wall);
  for (let x = 1; x < v.cols - 3; x += 3) {
    rect(cellX(x) + 3, 1, CELL - 6, WALL - 3, '#86b9e0');
    rect(cellX(x) + CELL / 2 - 1, 1, 1, WALL - 3, pal.wallDark);
  }
  const doorX = cellX(v.door);
  rect(doorX + 2, H - WALL, CELL - 4, WALL, '#3a2a1c');
  rect(doorX + 3, H - WALL - 4, CELL - 6, 4, '#8a3a2a'); // doormat

  // rugs lie under everything else
  for (const p of v.pieces) if (p.kind === 'rug') drawPiece(p);

  // the counter, the shopkeeper behind it, and the takings
  const cx = cellX(v.counter.x);
  const cy = cellY(v.counter.y);
  if (v.keeperLook) person(cellX(v.keeper.x) + CELL, cellY(v.keeper.y) + CELL / 2 + 2, v.keeperLook, 1, t);
  rect(cx, cy + 2, v.counter.w * CELL, CELL - 4, '#5a3a22');
  rect(cx, cy + 2, v.counter.w * CELL, 3, '#8a5a30');
  disc(cx + 6, cy + 8, 2, '#e8c040');
  disc(cx + 9, cy + 7, 2, '#f0d060');
  rect(cx + v.counter.w * CELL - 10, cy + 5, 6, 1, '#c0c8d0'); // scales
  rect(cx + v.counter.w * CELL - 7, cy + 5, 1, 5, '#8a94a0');

  for (const p of v.pieces) if (p.kind !== 'rug') drawPiece(p);

  // travellers browsing
  const here = new Set(v.customers.map((q) => q.id));
  for (const id of walkers.keys()) if (!here.has(id)) walkers.delete(id);
  const spots = browseSpots(v);
  for (const q of v.customers) {
    let wk = walkers.get(q.id);
    if (!wk) {
      wk = { id: q.id, look: q.look, x: doorX + CELL / 2, y: H - WALL - 2, tx: doorX + CELL / 2, ty: H - WALL - 2, wait: 0 };
      walkers.set(q.id, wk);
    }
    const dx = wk.tx - wk.x;
    const dy = wk.ty - wk.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const k = Math.min(1, (14 * dt) / d);
      wk.x += dx * k;
      wk.y += dy * k;
    } else if ((wk.wait -= dt) <= 0) {
      const s = spots[Math.floor(Math.random() * spots.length)];
      wk.tx = s.x;
      wk.ty = s.y;
      wk.wait = 1.5 + Math.random() * 3;
    }
    person(wk.x, wk.y, wk.look, d > 0.5 ? (dy < 0 ? -1 : 1) : 0, t + q.id, q.tier);
  }

  function drawPiece(p: ShopView['pieces'][number]): void {
    const x = cellX(p.x);
    const y = cellY(p.y);
    const w = p.w * CELL;
    const h = p.h * CELL;
    drawBody(p, x, y, w, h);
    // improved pieces: brass trim for a second tier, gold and a glint for the third
    if (p.level > 1 && p.kind !== 'rug') {
      const trim = p.level > 2 ? '#f0c848' : '#b08a3a';
      rect(x + 1, y + 1, w - 2, 1, trim);
      rect(x + 1, y + 1, 1, h - 3, trim);
      rect(x + w - 2, y + 1, 1, h - 3, trim);
      if (p.level > 2 && Math.sin(t * 2 + p.x) > 0.9) rect(x + 2 + ((t * 20) % (w - 4)), y + 1, 2, 1, '#fff8d0');
    } else if (p.level > 1) rect(x + 1, y + 2, w - 2, 1, p.level > 2 ? '#f0c848' : '#b08a3a'); // (a rug's border)
  }

  function drawBody(p: ShopView['pieces'][number], x: number, y: number, w: number, h: number): void {
    const goods = Object.keys(v.forSale).map((m) => GOODS[m as Material] ?? '#c8a060');
    // (a town with only a kind or two to sell still stocks its shelves with odds and ends)
    const shelf = goods.length >= 3 ? goods : [...goods, ...FALLBACK_GOODS];
    const good = (i: number) => shelf[(i + p.x * 3 + p.y) % shelf.length];
    switch (p.item) {
      case 'woven_mat':
        rect(x + 1, y + 3, w - 2, h - 6, '#b89a58');
        for (let k = x + 3; k < x + w - 3; k += 3) rect(k, y + 3, 1, h - 6, '#8a7040');
        return;
      case 'wool_rug':
        rect(x + 1, y + 2, w - 2, h - 4, '#8a2a3a');
        rect(x + 3, y + 4, w - 6, h - 8, '#c8a050');
        rect(x + 5, y + 6, w - 10, h - 12, '#8a2a3a');
        return;
      case 'clay_urns':
        disc(x + 5, y + 6, 4, '#80502f');
        disc(x + 5, y + 6, 3, '#b0704a');
        disc(x + 11, y + 10, 3, '#80502f');
        disc(x + 11, y + 10, 2, '#c88a5a');
        return;
      case 'herb_planter':
        disc(x + 8, y + 8, 6, '#80502f');
        disc(x + 8, y + 8, 5, '#3e7234');
        disc(x + 6, y + 6, 2, '#5a9443');
        disc(x + 10, y + 9, 2, '#7fb456');
        return;
      case 'iron_lantern': {
        const glow = 0.25 + 0.1 * Math.sin(t * 5);
        g.fillStyle = `rgba(255, 200, 90, ${glow})`;
        g.beginPath();
        g.arc(x + 8, y + 8, 9, 0, Math.PI * 2);
        g.fill();
        rect(x + 5, y + 5, 6, 6, '#3a3a40');
        rect(x + 6, y + 6, 4, 4, '#f0c060');
        return;
      }
      case 'neon_sign': {
        const on = Math.sin(t * 3) > -0.8;
        rect(x + 2, y + 5, 12, 6, '#2a2a30');
        rect(x + 3, y + 7, 10, 2, on ? '#ff5ab8' : '#6a2a50');
        return;
      }
    }
    switch (p.kind) {
      case 'shelf': {
        const glass = p.item === 'glass_cabinet';
        const frame = p.item === 'plank_shelf' ? '#77502f' : '#5a3a22';
        rect(x + 1, y + 1, w - 2, h - 3, frame);
        rect(x + 2, y + 2, w - 4, h - 5, glass ? '#a8d8e8' : '#3b2616');
        for (let i = 0; i < (w - 6) / 3; i++) rect(x + 3 + i * 3, y + 3 + (i % 2) * 4, 2, 3, good(i));
        // (a second tier: more goods packed in between)
        if (p.level > 1) for (let i = 0; i < (w - 6) / 3; i++) rect(x + 4 + i * 3, y + 5 - (i % 2) * 2, 1, 2, good(i + 3));
        if (glass) rect(x + 2, y + 2, w - 4, 1, '#e0f4fa');
        rect(x + 1, y + h - 3, w - 2, 1, '#2a1a10'); // shadow
        return;
      }
      case 'table': {
        const cloth = p.item === 'display_table';
        rect(x + 1, y + 2, w - 2, h - 3, '#2a1a10'); // shadow
        rect(x + 1, y + 1, w - 2, h - 4, cloth ? '#8a2a3a' : '#8a5a30');
        if (cloth) rect(x + 3, y + 3, w - 6, h - 8, '#a83a4a');
        else for (let k = y + 4; k < y + h - 4; k += 4) rect(x + 2, k, w - 4, 1, '#77502f');
        for (let i = 0; i < 6; i++) rect(x + 5 + (i % 3) * 8, y + 6 + Math.floor(i / 3) * 10, 4, 4, good(i + 1));
        return;
      }
      case 'stand':
        rect(x + 2, y + 2, w - 4, h - 4, '#8a5a30');
        rect(x + 2, y + 2, w - 4, 1, '#a87a48');
        rect(x + 3, y + 7, w - 6, 1, '#5a3a22');
        rect(x + 5, y + 4, 3, 3, good(2));
        rect(x + 9, y + 9, 3, 3, good(3));
        return;
      default:
        disc(x + 8, y + 8, 5, '#8a5a30');
    }
  }

  /** A person from above: shoulders in their clothes, head, hair. `walk` swings them as they go. */
  function person(x: number, y: number, look: Look, walk: number, phase: number, tier = 1): void {
    const bob = walk ? Math.round(Math.sin(phase * 10)) : 0;
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.beginPath();
    g.ellipse(Math.round(x), Math.round(y + 4), 5, 2, 0, 0, Math.PI * 2);
    g.fill();
    rect(x - 5, y - 3 + bob, 10, 6, look.outfit);
    rect(x - 5, y - 3 + bob, 10, 1, 'rgba(255,255,255,0.18)');
    disc(x, y - 1 + bob, 3, look.skin);
    disc(x, y - 2 + bob, 3, look.hairColor);
    // merchants wear a feathered cap, nobles a gold circlet, magnates a top hat
    if (tier === 2) {
      disc(x, y - 2 + bob, 3, '#3a6ab0');
      rect(x + 2, y - 5 + bob, 1, 3, '#e8e0cc');
    } else if (tier === 3) {
      rect(x - 3, y - 3 + bob, 6, 1, '#f0c848');
      rect(x - 1, y - 4 + bob, 1, 1, '#f0c848');
      rect(x + 1, y - 4 + bob, 1, 1, '#e05a8a');
    } else if (tier === 4) {
      disc(x, y - 2 + bob, 4, '#141418');
      disc(x, y - 2 + bob, 2, '#2a2a30');
    }
  }
}

/** Where a browser stands: in front of each piece, and at the counter. */
function browseSpots(v: ShopView): { x: number; y: number }[] {
  const spots = v.pieces
    .filter((p) => p.kind !== 'rug')
    .map((p) => ({ x: WALL + (p.x + p.w / 2) * CELL, y: WALL + Math.min(v.rows - 0.5, p.y + p.h + 0.4) * CELL }));
  spots.push({ x: WALL + (v.counter.x + 1) * CELL, y: WALL + (v.counter.y + 1.5) * CELL });
  return spots;
}
