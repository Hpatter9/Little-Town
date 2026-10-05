// A venue's window (the shop, or the tavern): the inside seen at an angle (drawn in code, like the town's
// buildings, with the townsfolk and strangers as their own side-on sprites), with the keeper behind the counter or bar, the furnishings the town has set out, and strangers browsing
// or sitting over their food; and beside or below it, who's in and what they came for, what the venue has to offer,
// what's been asked for, and what's happened lately. It only shows: the town runs its venues itself.

import { hkDraw, hkLayers, hkWhoById, hkWhoOfLook } from '../art/hkFolk';
import { inTabs } from './subtabs';
import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { pieceLabel, qualityOf } from '../../shared/data/quality';
import { APPEAL_HALVES_WAIT, TRAVELLER_EVERY } from '../../shared/data/shop';
import type { Look } from '../../shared/data/people';
import type { ShopView, Snapshot } from '../../shared/sim/snapshot';
import { STORE_PANELS, type StorePanelId } from '../../shared/ipc';
import { LINES } from '../../shared/data/stores';
import { DECOR_LEVELS, DECOR_STYLES } from '../../shared/data/decor';
import { ITEM_BY_ID } from '../../shared/data/items';
import { iconSpot } from '../art/icons';
import { materialIconSpot } from '../art/materialIcons';
import { CENTRE_X, FEET_Y, FRAME_COUNT, FRAME_SIZE, loadLpc, lookKey, lpcCanvas } from '../art/lpc/lpcCompose';
import { materialIcon } from '../art/materialIcons';
import { el } from './dom';
import { loadImage } from '../art/loadImage';
import workshopUrl from '../art/interior/workshop.png';
import forgeUrl from '../art/interior/forge.png';

/** The windows this panel draws: the shop, the tavern, and each specialty shop (`store_<line>`). */
type VenueId = 'shop' | 'tavern' | StorePanelId;
export const isVenuePanel = (id: string | null): id is VenueId => id === 'shop' || id === 'tavern' || (STORE_PANELS as readonly string[]).includes(id ?? '');
/** The view a window shows (null until the venue is built). */
export function venueView(s: Snapshot | null, id: VenueId): ShopView | null {
  if (!s) return null;
  if (id === 'shop' || id === 'tavern') return s[id];
  return s.stores.find((v) => v.line === id.slice('store_'.length)) ?? null;
}

/** Changes whenever something the text shows changes (the picture animates on its own). */
export const shopKey = (s: Snapshot, id: VenueId = 'shop') => {
  const v = venueView(s, id);
  return JSON.stringify(v && [s.coins, s.wageBill, v.def, v.progress !== null && Math.floor(v.progress * 20), v.pieces, v.appeal, v.renown, v.extensions, v.tiers, v.keeperName, v.customers, v.passing, v.forSale, v.wants, v.log, v.nextHours !== null && Math.ceil(v.nextHours), v.making, v.waiting, v.asked, v.menu, v.gear, v.stock, v.stockMats, v.decor, v.ownerName, v.worth, v.takings]);
};

/** In the picture's own pixels (it's scaled up to fit): a floor cell's width and its depth (a row, foreshortened),
 *  the side walls' thickness, the back wall's height, and the sill across the front. */
const CELL = 16;
const DEPTH = 12;
const WALL = 6;
const BACK = 40;
const SILL = 6;
/** A tavern's guest rooms: a wing beside the common room, each room this wide and three rows deep, off a hallway
 *  that runs along their front from a doorway in the common room's side wall. */
const ROOM_W = 30;
const ROOM_D = DEPTH * 3;
const wingWidth = (v: ShopView) => (v.rooms ? v.rooms * ROOM_W + WALL : 0);

/** The icon sheets, for the stock on show (fetched as they're first wanted). */
const icons = new Map<string, HTMLImageElement | null>();
function iconImage(url: string): HTMLImageElement | null {
  const im = icons.get(url);
  if (im !== undefined) return im;
  icons.set(url, null);
  loadImage(url).then((i) => icons.set(url, i), () => undefined);
  return null;
}
/** Lighten a hex colour a little (for a painted wall's lit edge). */
function lighter(hex: string, k = 1.18): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.min(255, Math.round(v * k)).toString(16).padStart(2, '0');
  return `#${c(n >> 16)}${c((n >> 8) & 255)}${c(n & 255)}`;
}
/** The specialty shops' rooms (their colours in data/stores.ts). */
const STORE_BUILD: Record<string, Room['build']> = { furniture: 'plaster', weapons: 'stone', armour: 'stone', medicine: 'plaster' };
function storeRoom(line: keyof typeof LINES): Room {
  const l = LINES[line];
  return { floor: l.floor[0], seam: l.floor[1], wall: l.wall, wallLight: lighter(l.wall), wallDark: l.wallTrim, build: STORE_BUILD[line] };
}
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

export function renderShop(s: Snapshot, id: VenueId = 'shop', redraw: () => void = () => {}): HTMLElement[] {
  const v = venueView(s, id);
  latest = v;
  const tavern = id === 'tavern';
  if (!v)
    return [
      el(
        'p',
        'empty',
        tavern
          ? 'The town has no tavern yet. Once it learns Hospitality (after Barter) it builds a Fireside Inn, and travellers stop for a meal and a drink.'
          : id === 'shop'
            ? 'The town has no shop yet. Once it learns Barter it builds a Trading Post, and travellers start stopping by.'
            : 'The town has not built this shop yet.',
      ),
    ];
  const out: HTMLElement[] = [];
  const place = tavern ? 'tavern' : 'shop';
  const floorWord = tavern ? 'Comfort' : 'Appeal';

  const head = el('div', 'panel-head');
  head.append(el('span', 'shop-coins', `● ${s.coins} coins`), el('span', '', tavern ? `Comfort ${v.appeal} · Renown ${v.renown}` : `Attractiveness ${v.attractiveness}`));
  out.push(head);

  canvas ??= el('canvas', 'shop-floor');
  const w = v.cols * CELL + WALL * 2 + wingWidth(v);
  const h = BACK + v.rows * DEPTH + SILL;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const frame = el('div', 'shop-frame');
  bubbleLayer ??= el('div', 'shop-bubbles');
  frame.append(canvas, bubbleLayer);
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
        ? `${v.keeperName} keeps the ${place}${v.ownerName && v.ownerName !== v.keeperName ? ` for ${v.ownerName}` : ''}.`
        : `Closed: nobody free to keep it.`;
  info.push(el('div', 'hint shop-status', status));
  info.push(el('div', 'hint', `${v.ownerName ? `Owned by ${v.ownerName}` : 'The town\'s own'}: worth about ${v.worth} coins${v.takings ? ` (it took ${v.takings} yesterday)` : ''}. Its takings go to ${v.ownerName ?? 'the treasury'}${v.ownerName ? ', who pays for its upkeep' : ''}.`));
  const every = ((TRAVELLER_EVERY[0] + TRAVELLER_EVERY[1]) / 2 / (1 + v.attractiveness / APPEAL_HALVES_WAIT)).toFixed(1);
  info.push(
    el(
      'div',
      'hint',
      (tavern
        ? `Comfort ${v.appeal}: guests used to more walk out, and the better-off need more. Renown ${v.renown}${v.trophies ? ` and the Trophy Hall's ${v.trophies}` : ''} bring${v.trophies ? '' : 's'} them more often.`
        : `Attractiveness ${v.attractiveness}: the furnishings' appeal (${v.appeal}), the shop's renown (${v.renown})${v.trophies ? ` and the Trophy Hall's treasures (${v.trophies})` : ''}.`) +
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
          ? `${v.rooms} rooms down the hall, ${v.beds} with a bed, ${v.lodgers} taken tonight. Guests who come in the evening may stay the night and pay for the bed (a finer bed fetches more), leaving in the morning.`
          : `${v.rooms} rooms down the hall, none with a bed yet: guests who come in the evening have nowhere to stay the night. The town makes a bed once they ask.`,
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
    info.push(el('h2', '', v.line ? 'On the shelves' : 'Gear in stock'));
    if (v.line && v.stock.length) {
      const row = el('div', 'shop-pieces');
      for (const p of v.stock) row.append(qualityChip(`${pieceLabel(ITEM_BY_ID[p.item]?.name ?? p.item, p.q)}${p.n > 1 ? ` ×${p.n}` : ''}`, p.q));
      info.push(row);
    } else if (!v.gear.length) info.push(el('p', 'empty', v.line ? `Nothing of its line in stock: the town makes ${LINES[v.line].banner.toLowerCase()} for it from what it has spare.` : 'None spare.'));
    else {
      const gear = el('div', 'shop-pieces');
      for (const g of v.gear) gear.append(qualityChip(`${pieceLabel(g.name, g.q)}${g.n > 1 ? ` ×${g.n}` : ''} · ${g.price}c`, g.q));
      info.push(gear);
    }
    info.push(el('div', 'hint', `Travellers buy it, and so do the townsfolk, with what they earn (about ${s.wageBill} coins a day in all), for a little less.`));
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
  info.push(el('h2', '', 'Décor'));
  if (!v.decor) info.push(el('div', 'hint', 'Plain as built. Once it has a keeper, they decide how the place will be dressed, and the town pays for it step by step.'));
  else {
    const d = v.decor;
    const steps = el('div', 'shop-pieces');
    DECOR_LEVELS.forEach((l, i) => steps.append(el('span', i < d.level ? 'chip' : 'chip dim', l.name)));
    info.push(
      el('div', 'hint', `${d.by ? `${d.by}'s` : 'The keeper\'s'} direction: ${d.name}, ${d.line}.` + (d.next ? ` Next: ${d.next.name.toLowerCase()} (${d.next.price} coins), once the town has coins to spare.` : ' Finished: as fine as it gets.')),
      steps,
    );
  }
  if (v.grows) info.push(el('div', 'hint', `It grows into a ${v.grows.name}${v.grows.research ? ` once the town learns ${v.grows.research}` : ''}, with room for more.`));

  info.push(el('h2', '', 'Lately'));
  if (!v.log.length) info.push(el('p', 'empty', tavern ? 'No guests yet.' : 'No travellers yet.'));
  for (const l of [...v.log].reverse()) {
    const row = el('div', 'shop-log');
    row.append(el('span', 'shop-when', l.when.replace(/ · \w+ · /, ' · ')), el('span', '', l.text));
    info.push(row);
  }
  // (in tabs, like every menu: who's in now, the trade, the room itself)
  side.append(...inTabs(id, info, redraw, 'venue'));
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
  /** When they reached the counter (the window's clock), for the order of the bubbles. */
  atCounter?: number;
}

/** A speech bubble over the picture, in its pixels (the head it's over): HTML laid over the canvas so the words
 *  are sharp at any size. */
interface Bubble {
  key: string;
  x: number;
  y: number;
  text: string;
  tone: 'ask' | 'sold' | 'order' | 'no';
}
let bubbleLayer: HTMLElement | null = null;
/** Seconds a customer's question stays up at the counter before the keeper answers. */
const ASK_SECONDS = 3.2;
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

/** Furnishings drawn from Craftpix's Glassblower's Workshop (a three-quarter interior on the same 16px grid): where
 *  each picture is in the sheet (x, y, w, h), and which pieces use them (laid side by side across the footprint).
 *  The rest are painted in code, as are all of them until the sheet has loaded. */
const WORKSHOP: Record<string, [number, number, number, number]> = {
  counter_shop: [15, 4, 163, 25], counter_bar: [15, 44, 163, 17],
  cabinet_l: [2, 70, 36, 58], cabinet_r: [58, 70, 36, 58],
  shelf_a: [12, 131, 36, 53], shelf_b: [64, 131, 36, 53], shelf_c: [118, 131, 36, 53], shelf_d: [166, 131, 36, 53],
  planter: [178, 313, 25, 35], crates: [68, 321, 36, 50],
  rug: [8, 331, 52, 43], table_pair: [8, 397, 53, 30],
  table_wares: [182, 402, 22, 28], wares_pair: [70, 393, 53, 30], table: [164, 467, 24, 24], cloth_table: [129, 477, 29, 30],
  urn: [40, 566, 14, 19], urn2: [103, 567, 18, 17], flowers: [7, 567, 17, 18],
};
const SPRITE_OF: Record<string, string[]> = {
  plank_shelf: ['shelf_b', 'shelf_d'], oak_shelves: ['shelf_a', 'shelf_c'], glass_cabinet: ['cabinet_l', 'cabinet_r'],
  trestle_table: ['wares_pair'], display_table: ['table_wares', 'cloth_table'], log_table: ['table', 'table'], oak_table: ['table_pair'],
  clay_urns: ['urn', 'urn2'], herb_planter: ['planter'], crate_stand: ['crates'], wool_rug: ['rug'],
};
/** The forge, for the brick hearth: 6 frames of its fire, 64 apart; the furnace's box in each. */
const FORGE = { x: 8, y: 14, w: 45, h: 78, step: 64, frames: 6 };
let workshop: HTMLImageElement | null = null;
let forge: HTMLImageElement | null = null;
let workshopAsked = false;
function loadWorkshop(): void {
  if (workshopAsked) return;
  workshopAsked = true;
  loadImage(workshopUrl).then((im) => (workshop = im), () => undefined);
  loadImage(forgeUrl).then((im) => (forge = im), () => undefined);
}

/** How tall each piece stands off the floor (pixels), by item, then by kind. */
const TALL: Record<string, number> = {
  log_table: 9, oak_table: 10, stone_hearth: 26, brick_hearth: 28, barrels: 14, upright_piano: 24, clay_urns: 12, herb_planter: 7,
  iron_lantern: 22, shelf: 30, table: 11, stand: 15, counter: 15,
};
/** Hung on the back wall rather than stood on the floor. */
const ON_WALL = new Set(['tapestry', 'neon_sign']);
const PAL_WOOD = '#8a5a30';

function draw(c: HTMLCanvasElement, v: ShopView, t: number, dt: number): void {
  loadWorkshop();
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  let pal: Room = v.line ? storeRoom(v.line) : (ROOMS[v.def] ?? ROOMS.trading_post);
  // (the keeper's décor: painted walls from the first level, data/decor.ts)
  const style = v.decor ? DECOR_STYLES[v.decor.style] : null;
  const decor = v.decor?.level ?? 0;
  if (style && decor >= 1) pal = { ...pal, wall: style.wall, wallLight: lighter(style.wall), wallDark: style.wallTrim, build: pal.build === 'logs' ? 'plaster' : pal.build };
  const W = c.width;
  /** The common room's width (the guest wing, if any, is beside it). */
  const WR = v.cols * CELL + WALL * 2;
  const up = 0;
  const H = c.height;
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
  decorWall();
  // what's hung on the wall
  for (const p of v.pieces) if (ON_WALL.has(p.item)) hang(p);
  display();
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
  rect(WR - WALL, 0, WALL, H, pal.wall);
  rect(WALL - 1, 0, 1, H, pal.wallDark);
  rect(WR - WALL, 0, 1, H, pal.wallDark);
  // the front: a low sill with the doorway in it
  const doorX = cellX(v.door);
  rect(0, floorBottom, W, H - floorBottom, pal.wall);
  rect(0, floorBottom, W, 1, pal.wallLight);
  rect(doorX + 1, floorBottom, CELL - 2, H - floorBottom, '#8a3a2a'); // the doormat on the threshold
  rect(doorX + 1, floorBottom, CELL - 2, 1, '#a84a3a');

  // rugs lie flat, under everything else (the décor's runner and rug first)
  decorFloor();
  for (const p of v.pieces) if (p.y >= 0 && (p.kind === 'rug' || p.item.endsWith('_rug') || p.item === 'woven_mat')) rug(p);

  // everything standing, back to front, with the people among it
  const layers: { y: number; paint: () => void }[] = [];
  const cy = rowY(v.counter.y);
  layers.push({ y: rowY(v.counter.y + 1), paint: () => counter(cellX(v.counter.x), cy, v.counter.w * CELL) });
  if (v.keeperLook) {
    const look = v.keeperLook;
    layers.push({ y: rowY(v.keeper.y + 1) - 2, paint: () => person(cellX(v.keeper.x) + CELL, rowY(v.keeper.y + 1) - 2, look, false, false, t, 1, v.keeperId ?? 7, true) });
  }
  for (const p of v.pieces) {
    if (p.y < 0 || ON_WALL.has(p.item) || p.kind === 'rug' || p.item.endsWith('_rug') || p.item === 'woven_mat') continue;
    layers.push({ y: rowY(p.y + p.h), paint: () => piece(p) });
  }

  // travellers: at a shop they look round the pieces first, then go up to the counter and ask (the keeper answers),
  // then make for the door; tavern guests sit and stand about as before
  const here = new Set(v.customers.map((q) => q.id));
  for (const id of walkers.keys()) if (!here.has(id)) walkers.delete(id);
  const spots = browseSpots(v);
  const shopFloor = v.venue !== 'tavern';
  const pieceSpots = shopFloor && spots.length > 1 ? spots.slice(0, -1) : spots;
  const headAbove = (y: number) => y - (FEET_Y - HEAD_Y) * SCALE - 1;
  const bubbles: Bubble[] = [];
  for (const q of v.customers) {
    let wk = walkers.get(q.id);
    if (!wk) {
      const x0 = doorX + CELL / 2;
      wk = { id: q.id, look: q.look, x: x0, y: floorBottom + 4, tx: x0, ty: floorBottom - 2, wait: 0, left: false };
      walkers.set(q.id, wk);
    }
    // (where the shop's customer is bound: the counter, or the door; else they look round)
    if (shopFloor && q.stage === 'counter') {
      wk.tx = WALL + (v.counter.x + 0.5 + (q.id % 2)) * CELL;
      wk.ty = Math.min(floorBottom - 2, rowY(v.counter.y + 1) + 4);
    } else if (shopFloor && q.stage === 'done') {
      wk.tx = doorX + CELL / 2;
      wk.ty = floorBottom - 2;
    }
    if (q.stage !== 'counter') wk.atCounter = undefined;
    const bound = shopFloor && (q.stage === 'counter' || q.stage === 'done');
    const dx = wk.tx - wk.x;
    const dy = wk.ty - wk.y;
    const d = Math.hypot(dx, dy * 1.5);
    const moving = d > 0.5;
    if (moving) {
      const k = Math.min(1, (16 * dt) / d);
      wk.x += dx * k;
      wk.y += dy * k;
      if (Math.abs(dx) > 0.3) wk.left = dx < 0;
    } else if (bound) {
      // (at the counter, facing it; the question, then the keeper's answer)
      if (q.stage === 'counter' && q.talk) {
        wk.atCounter ??= t;
        wk.left = false;
        const said = t - wk.atCounter;
        const w0 = wk;
        if (said < ASK_SECONDS) bubbles.push({ key: `${q.id}a`, x: w0.x, y: headAbove(w0.y), text: q.talk.ask, tone: 'ask' });
        else if (v.keeperLook) bubbles.push({ key: `${q.id}k`, x: cellX(v.keeper.x) + CELL, y: headAbove(rowY(v.keeper.y + 1) - 2), text: q.talk.answer, tone: q.talk.outcome });
        else bubbles.push({ key: `${q.id}k`, x: cellX(v.counter.x) + (v.counter.w * CELL) / 2, y: rowY(v.counter.y) - 4, text: q.talk.answer, tone: q.talk.outcome });
      }
    } else if ((wk.wait -= dt) <= 0) {
      const pool = shopFloor ? pieceSpots : spots;
      const s = pool[Math.floor(Math.random() * pool.length)];
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
      // (they're in their room: when they come out in the morning, it's through the hallway door)
      w.x = WR - WALL - 6;
      w.y = floorBottom - 6;
      w.tx = w.x;
      w.ty = w.y;
      sleepers.set(`${q.bed.x},${q.bed.y}`, q.look);
      continue;
    }
    layers.push({ y: w.y, paint: () => person(w.x, w.y, w.look, moving, w.left, t + q.id, q.tier, q.id) });
  }
  layers.sort((a, b) => a.y - b.y);
  for (const l of layers) l.paint();
  placeBubbles(c, bubbles);

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
  if (v.rooms) wing();

  /** The guest wing: a hallway from a doorway in the common room's side wall, with the rooms off it, each with its
   *  own door, a window, and a bed if the town has made one (and its guest asleep in it, of a night). */
  function wing(): void {
    const x0 = WR;
    const rooms = v.rooms;
    const xEnd = x0 + rooms * ROOM_W;
    const front = BACK + ROOM_D; // the rooms' front wall
    const hallTop = front + 5;
    const night = v.night;
    // the back wall carries on across the wing, and the hallway's floor runs in through the doorway
    rect(x0 - WALL, 0, xEnd - x0 + WALL * 2, BACK, pal.wall);
    for (let y = 2; y < BACK - 4; y += 5) for (let x = x0 + ((y * 3) % 7); x < xEnd; x += 9) rect(x, y, 1, 1, pal.wallDark);
    rect(x0 - WALL, BACK - 3, xEnd - x0 + WALL, 3, pal.wallDark);
    rect(x0, BACK, xEnd - x0, ROOM_D, pal.floor);
    rect(x0 - WALL, hallTop, xEnd - x0 + WALL, floorBottom - hallTop, pal.floor);
    for (let y = BACK; y < floorBottom; y += 4) rect(x0 - WALL, y, xEnd - x0 + WALL, 1, pal.seam);
    rect(x0 - WALL - 1, hallTop - 9, WALL + 2, 3, pal.wallDark); // the doorway's lintel
    rect(x0 - WALL - 1, hallTop - 6, 1, floorBottom - hallTop + 6, pal.wallDark);
    rect(x0, hallTop - 6, 1, floorBottom - hallTop + 6, pal.wallDark);
    // (the décor's runner down the hall)
    if (style && decor >= 2) {
      const mid = Math.round((hallTop + floorBottom) / 2);
      rect(x0 - WALL + 1, mid - 4, xEnd - x0 + WALL - 2, 8, style.rug[0]);
      rect(x0 - WALL + 1, mid - 4, xEnd - x0 + WALL - 2, 1, style.rug[1]);
      rect(x0 - WALL + 1, mid + 3, xEnd - x0 + WALL - 2, 1, style.rug[1]);
    }
    for (let i = 0; i < rooms; i++) {
      const rx = x0 + i * ROOM_W;
      if (i > 0) rect(rx - 1, 0, 2, front + 5, pal.wallDark); // the partition, ceiling to doorframe
      // the window at the back
      const wx = rx + ROOM_W / 2 - 3;
      rect(wx - 1, 7, 8, 11, pal.wallDark);
      rect(wx, 8, 6, 9, night ? '#1e2a48' : '#86b9e0');
      rect(wx + 3, 8, 1, 9, pal.wallDark);
      rect(wx - 2, 18, 10, 2, pal.wallLight);
      // the room's front wall, with its door onto the hall (standing open)
      rect(rx, front, ROOM_W, 5, pal.wallDark);
      rect(rx, front, ROOM_W, 1, pal.wallLight);
      const dx = rx + ROOM_W / 2 - 5;
      rect(dx, front, 10, 5, pal.floor);
      rect(dx - 1, front - 12, 1, 17, '#5a3a22');
      rect(dx + 10, front - 12, 1, 17, '#5a3a22');
      rect(dx - 1, front - 13, 12, 1, '#5a3a22');
      rect(dx + 10, front - 11, 3, 15, '#6a4428'); // the door leaf, swung into the hall
      rect(dx + 11, front - 5, 1, 1, '#c8a050');
      if (style && decor >= 4) {
        // a lamp by each door
        rect(dx + 14, front - 11, 2, 2, '#3a3a40');
        rect(dx + 14, front - 13, 2, 2, style.lamp);
        g.fillStyle = `rgba(255, 200, 90, ${(night ? 0.22 : 0.08) + 0.04 * Math.sin(t * 5 + i)})`;
        g.fillRect(Math.round(dx + 9), Math.round(front - 18), 12, 12);
      }
      const bed = v.pieces.find((p) => p.y === -1 && p.x === i);
      const yb = front - 4; // where the bed's foot stands
      if (!bed) {
        // (empty: a stool and a candle, waiting for a bed)
        rect(rx + 5, yb - 4, 5, 1, PAL_WOOD);
        rect(rx + 5, yb - 3, 1, 3, PAL_WOOD);
        rect(rx + 9, yb - 3, 1, 3, PAL_WOOD);
        rect(rx + 7, yb - 6, 1, 2, '#f0e8c0');
        continue;
      }
      const feather = bed.item === 'feather_bed';
      const straw = bed.item === 'straw_pallet';
      const frame = straw ? '#b89a58' : feather ? '#6a3a22' : '#8a5a30';
      const cover = straw ? '#a88258' : feather ? '#8a2a3a' : '#7c5c3c';
      const bx = rx + 3;
      const bl = ROOM_W - 9;
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
      rect(bx, top, bl, 3, frame);
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
        g.fillRect(Math.round(rx + 2), BACK + 2, ROOM_W - 4, ROOM_D - 4);
      }
    }
    // the wing's far wall, and the sill across its front
    rect(xEnd, 0, WALL, H, pal.wall);
    rect(xEnd, 0, 1, H, pal.wallDark);
    rect(x0 - WALL, floorBottom, xEnd - x0 + WALL * 2, H - floorBottom, pal.wall);
    rect(x0 - WALL, floorBottom, xEnd - x0 + WALL * 2, 1, pal.wallLight);
  }

  /** An item's (or a material's) picture, `size` square, at (x, y); a plain block until its sheet has loaded. */
  function drawIcon(spot: { url: string; sx: number; sy: number; whole: boolean; hue?: number } | null, x: number, y: number, size: number, fallback = '#c8a060'): void {
    const im = spot && iconImage(spot.url);
    if (!im) return rect(x + 2, y + 2, size - 4, size - 4, fallback);
    if (spot!.hue) g.filter = `hue-rotate(${spot!.hue}deg) saturate(1.15)`;
    if (spot!.whole) g.drawImage(im, Math.round(x), Math.round(y), size, size);
    else g.drawImage(im, spot!.sx, spot!.sy, 16, 16, Math.round(x), Math.round(y), size, size);
    g.filter = 'none';
  }

  /** The stock on show: a fixture along the back wall, dressed for what the shop sells (data/stores.ts), with each
   *  piece in stock on it (its icon): a pegboard of weapons, armour on stands, the apothecary's shelves of jars and
   *  bundled herbs, the furniture maker's long table, the general store's crates of goods and shelf of wares. */
  function display(): void {
    if (v.venue !== 'shop') return;
    const x = cellX(0) + 2;
    const w = Math.max(24, cellX(v.counter.x) - 6 - x);
    const slot = 12;
    const n = Math.floor((w - 4) / slot);
    const items = v.stock.slice(0, n).map((p) => ({ spot: ITEM_BY_ID[p.item] ? iconSpot(ITEM_BY_ID[p.item]) : null, q: p.q }));
    const mats = v.stockMats.map((m) => ({ spot: materialIconSpot(m.m), q: 1 }));
    const wood = '#5a3a22';
    const base = BACK - 4;
    switch (v.line) {
      case 'weapons': {
        rect(x, base - 16, w, 15, '#3a2a20'); // the pegboard
        for (let k = 0; k < w; k += 4) rect(x + k, base - 14, 1, 1, '#1a1210');
        rect(x, base - 1, w, 2, wood);
        items.forEach((it, i) => drawIcon(it.spot, x + 3 + i * slot, base - 14, 10, '#9aa0a8'));
        break;
      }
      case 'armour': {
        rect(x, base - 1, w, 2, wood);
        items.forEach((it, i) => {
          const sx = x + 3 + i * slot;
          rect(sx + 4, base - 6, 2, 6, wood); // the stand
          rect(sx + 1, base - 7, 8, 1, wood);
          drawIcon(it.spot, sx, base - 17, 10, '#8a94a0');
        });
        break;
      }
      case 'medicine': {
        rect(x, base - 12, w, 1, wood); // two shelves
        rect(x, base - 1, w, 2, wood);
        items.forEach((it, i) => drawIcon(it.spot, x + 3 + (i % n) * slot, i < n ? base - 22 : base - 11, 10, '#5a9443'));
        for (let k = 0; k < 3; k++) {
          const hx = cellX(v.counter.x) + 2 + k * 6; // herbs hung by the counter
          rect(hx + 1, 2, 1, 6, '#c8b890');
          oval(hx + 1.5, 10, 2, 3, k % 2 ? '#5a9443' : '#3e7234');
        }
        break;
      }
      case 'furniture': {
        rect(x, base - 8, w, 8, '#8a5a30'); // the long table, with a cloth
        rect(x, base - 8, w, 1, '#a8703a');
        rect(x + 1, base - 7, w - 2, 3, '#a83a4a');
        items.forEach((it, i) => drawIcon(it.spot, x + 2 + i * slot, base - 18, 10, '#a87a48'));
        break;
      }
      default: {
        // the general store: crates of goods along the floor's back edge, a shelf of wares and gear above
        rect(x, base - 14, w, 1, wood);
        items.forEach((it, i) => drawIcon(it.spot, x + 3 + i * slot, base - 24, 10, '#d8a050'));
        mats.slice(0, n).forEach((m, i) => {
          const cx = x + 1 + i * slot;
          rect(cx, base - 9, 11, 10, '#8a6a44');
          rect(cx, base - 9, 11, 1, '#a88258');
          rect(cx + 1, base - 8, 9, 1, '#3b2616');
          drawIcon(m.spot, cx + 1, base - 11, 9, '#c8a060');
        });
      }
    }
  }

  /** The keeper's décor on the walls: hangings at the windows and a tapestry by the counter (level 3), sconces lit
   *  after dark (4), trim along the skirting and the cornice (5). */
  function decorWall(): void {
    if (!style) return;
    if (decor >= 3) {
      for (let x = 1; x < v.cols - 3; x += 3) {
        const wx = cellX(x) + 2;
        rect(wx - 4, 5, CELL + 4, 2, style.hanging); // the pelmet
        rect(wx - 3, 7, 3, 18, style.hanging);
        rect(wx + CELL - 4, 7, 3, 18, style.hanging);
      }
      const hx = cellX(v.counter.x) + 2;
      rect(hx - 1, 4, 14, 1, style.wallTrim);
      rect(hx, 5, 12, 20, style.hanging);
      rect(hx + 2, 8, 8, 14, style.rug[1]);
      rect(hx + 4, 11, 4, 8, style.hanging);
    }
    if (decor >= 4)
      for (let x = 3; x < v.cols - 2; x += 3) {
        const sx = cellX(x) + 8;
        rect(sx - 1, 15, 3, 2, '#3a3a40');
        rect(sx, 11, 1, 4, '#3a3a40');
        rect(sx - 1, 9, 3, 3, style.lamp);
        g.fillStyle = `rgba(255, 210, 120, ${(v.night ? 0.22 : 0.07) + 0.04 * Math.sin(t * 5 + x)})`;
        g.beginPath();
        g.arc(sx, 11, 9, 0, Math.PI * 2);
        g.fill();
      }
    if (decor >= 5) {
      rect(0, BACK - 3, W, 1, style.trim);
      rect(WALL, 0, WR - WALL * 2, 1, style.trim);
      rect(WALL, 2, WR - WALL * 2, 1, style.trim);
    }
  }

  /** The décor on the floor (level 2): a runner from the door to the counter, and a rug before it. */
  function decorFloor(): void {
    if (!style || decor < 2) return;
    const cy = rowY(v.counter.y + 1);
    const dx = cellX(v.door);
    rect(dx + 3, cy + 2, CELL - 6, floorBottom - cy - 2, style.rug[0]);
    rect(dx + 3, cy + 2, 1, floorBottom - cy - 2, style.rug[1]);
    rect(dx + CELL - 4, cy + 2, 1, floorBottom - cy - 2, style.rug[1]);
    const x0 = Math.min(dx, cellX(v.counter.x));
    const x1 = Math.max(dx + CELL, cellX(v.counter.x + v.counter.w));
    rect(x0 + 2, cy + 2, x1 - x0 - 4, DEPTH - 3, style.rug[0]);
    rect(x0 + 2, cy + 2, x1 - x0 - 4, 1, style.rug[1]);
    rect(x0 + 2, cy + DEPTH - 2, x1 - x0 - 4, 1, style.rug[1]);
    for (let k = x0 + 5; k < x1 - 5; k += 6) rect(k, cy + DEPTH / 2, 2, 1, style.rug[1]);
  }

  function counter(x: number, y0: number, w: number): void {
    const h = TALL.counter;
    if (workshop) {
      // (the long counter from the pack: its two ends, and the middle repeated to fit; the shop's has jars on it)
      const [sx, sy, sw, sh] = WORKSHOP[v.venue === 'tavern' ? 'counter_bar' : 'counter_shop'];
      const top = y0 + DEPTH - 2 - sh;
      const cap = 12;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(Math.round(x + 1), Math.round(y0 + DEPTH - 3), Math.round(w), 2);
      g.drawImage(workshop, sx, sy, cap, sh, Math.round(x), Math.round(top), cap, sh);
      for (let k = cap; k < w - cap; k += sw - cap * 2) {
        const run = Math.min(sw - cap * 2, w - cap - k);
        g.drawImage(workshop, sx + cap, sy, run, sh, Math.round(x + k), Math.round(top), run, sh);
      }
      g.drawImage(workshop, sx + sw - cap, sy, cap, sh, Math.round(x + w - cap), Math.round(top), cap, sh);
      if (v.venue === 'tavern')
        for (const dx of [6, 15, 25]) {
          if (dx + 3 > w - 4) continue;
          rect(x + dx, top - 2, 3, 5, '#c8a050'); // tankards
          rect(x + dx, top - 3, 3, 1, '#f0f0e0');
        }
      return;
    }
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
    if (sprites(p, x, y, w, d, true)) return;
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

  /** Draw a piece from the workshop sheet, if it has pictures there: side by side across its footprint, each shrunk to
   *  fit, standing on the front edge (or, `flat`, laid over the footprint). False to paint it instead. */
  function sprites(p: ShopView['pieces'][number], x: number, y0: number, w: number, d: number, flat: boolean): boolean {
    const names = SPRITE_OF[p.item];
    if (!workshop || !names) return false;
    if (flat) {
      const [sx, sy, sw, sh] = WORKSHOP[names[0]];
      g.drawImage(workshop, sx, sy, sw, sh, Math.round(x + 1), Math.round(y0), Math.round(w - 2), Math.round(d));
      if (p.level > 1) rect(x + 2, y0 + 1, w - 4, 1, p.level > 2 ? '#f0c848' : '#b08a3a');
      return true;
    }
    const slot = w / names.length;
    const base = y0 + d - 1;
    let top = base;
    g.fillStyle = 'rgba(0,0,0,0.22)';
    g.fillRect(Math.round(x + 2), Math.round(base - 1), Math.round(w - 3), 2);
    names.forEach((n, i) => {
      const [sx, sy, sw, sh] = WORKSHOP[n];
      const k = Math.min(1, (slot - 1) / sw);
      const dw = sw * k;
      const dh = sh * k;
      top = Math.min(top, base - dh);
      g.drawImage(workshop!, sx, sy, sw, sh, Math.round(x + i * slot + (slot - dw) / 2), Math.round(base - dh), Math.round(dw), Math.round(dh));
    });
    trim(p, x + 1, top, w - 2, 2);
    return true;
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
    if (p.item === 'brick_hearth' && forge) {
      // (a furnace from the pack, its fire flickering)
      const f = Math.floor(t * 8 + p.x) % FORGE.frames;
      const k = Math.min(1, (w - 2) / FORGE.w);
      const fw = FORGE.w * k;
      const fh = FORGE.h * k;
      g.fillStyle = 'rgba(0,0,0,0.22)';
      g.fillRect(Math.round(x + 2), Math.round(y0 + d - 3), Math.round(w - 2), 2);
      g.drawImage(forge, FORGE.x + f * FORGE.step, FORGE.y, FORGE.w, FORGE.h, Math.round(x + (w - fw) / 2), Math.round(y0 + d - fh), Math.round(fw), Math.round(fh));
      trim(p, x + (w - fw) / 2, y0 + d - fh, fw, 2);
      return;
    }
    if (sprites(p, x, y0, w, d, false)) return;
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
  function person(x: number, y: number, look: Look, walking: boolean, left: boolean, phase: number, tier = 1, id = 0, keeper = false): void {
    oval(x, y, 5, 1.5, 'rgba(0,0,0,0.28)');
    // (standing, they breathe and shift their weight, like everyone on the map: nobody is frozen)
    if (!walking) y -= Math.sin(phase * 1.1) > 0.55 ? 1 : 0;
    const fidget = !walking && (phase * 1000) % 4300 < 160 ? 1 : 0;
    const top = y - (FEET_Y - HEAD_Y) * SCALE; // (the top of the head)
    // (in the Himeko Sutori pack's dress, as the map draws everyone: art/hkFolk.ts; the old look while it loads)
    // (the keeper, a townsperson, as the map dresses them, facing the room; a stranger in travelling clothes)
    const keys = hkLayers(keeper ? hkWhoById(id, look) : hkWhoOfLook(id, look, { traveller: true }), { fighting: false, activity: 'idle' });
    const col = walking ? [1, 0, 2, 0][Math.floor(phase * 6) % 4] : 0;
    if (hkDraw(g, keys, col, keeper ? 0 : left ? 1 : 2, Math.round(x), Math.round(y), (FEET_Y - HEAD_Y) * SCALE + 2)) {
      // (drawn: the hats below still mark a customer's standing)
    } else if (lpcLoaded) {
      const f = walking ? 1 + (Math.floor(phase * 10) % (FRAME_COUNT.walk - 1)) : fidget;
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

/** Lay the speech bubbles over the canvas where it's shown (it's scaled to fit, and letterboxed when short of room). */
function placeBubbles(c: HTMLCanvasElement, list: Bubble[]): void {
  const layer = bubbleLayer;
  if (!layer || !layer.parentElement) return;
  const keep = new Set(list.map((b) => b.key));
  for (const e of [...layer.children] as HTMLElement[]) if (!keep.has(e.dataset.key ?? '')) e.remove();
  if (!list.length) return;
  const box = c.getBoundingClientRect();
  const host = layer.parentElement.getBoundingClientRect();
  const k = Math.min(box.width / c.width, box.height / c.height);
  if (!k) return;
  const ox = box.left - host.left + (box.width - c.width * k) / 2;
  const oy = box.top - host.top + (box.height - c.height * k) / 2;
  for (const b of list) {
    let e = [...layer.children].find((x) => (x as HTMLElement).dataset.key === b.key) as HTMLElement | undefined;
    if (!e) {
      e = el('div', `shop-bubble ${b.tone}`, b.text);
      e.dataset.key = b.key;
      layer.append(e);
    } else if (e.textContent !== b.text) e.textContent = b.text;
    e.style.left = `${Math.round(ox + b.x * k)}px`;
    e.style.top = `${Math.round(oy + b.y * k)}px`;
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
