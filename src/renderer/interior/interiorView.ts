// Inside a building (sim/interiors.ts, the `lookInside` command, `snapshot.interior`): a cutaway of the room seen from
// above, as the map sees the town. The back wall is the Glassblower pack's stone wall with its windows (art/interior/
// walls.png), the floor its planks (or the dungeon pack's flagstones for a forge, a temple or a hall), and the room is
// furnished by what it is (`layout`, by `kindOf` in map/roomKinds.ts and a few more of our own: a temple, barracks)
// from DawnLike's decor sheet (beds, chairs, tables, shelves, candles, rugs, a throne: art/interior/decor.png) and the
// dungeon packs' clutter, with a furnace (art/interior/forge.png) or a brazier (art/delve/fires.png) burning. Whoever
// is inside is drawn as the map dresses them (art/hkFolk.ts): asleep in their beds under the covers, at the station
// working, at a desk reading, by the hearth or at the table, a child playing about the floor. A bar at the top names
// the room and takes the player out (✕); a window (below upright, on the right sideways) says who's in and at what,
// who lives or works here but is out, and what's being made or studied. Its own full-screen element, no Pixi.

import type { Command } from '../../shared/sim/commands';
import type { InteriorView } from '../../shared/sim/interiors';
import type { PersonView } from '../../shared/sim/snapshot';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { hkDraw, hkLayers, hkPose, hkWhoOf } from '../art/hkFolk';
import { loadImage } from '../art/loadImage';
import { kindOf, type RoomKind } from '../map/roomKinds';
import decorUrl from '../art/interior/decor.png';
import wallsUrl from '../art/interior/walls.png';
import forgeUrl from '../art/interior/forge.png';
import firesUrl from '../art/delve/fires.png';
import stoneUrl from '../art/castle/floor.png';
import barrelUrl from '../art/packs/do_barrel.png';
import crateUrl from '../art/clutter/crate.png';
import crateStackUrl from '../art/clutter/crate_stack.png';
import chestUrl from '../art/clutter/chest.png';
import chestGoldUrl from '../art/clutter/chest_gold.png';
import rackUrl from '../art/clutter/rack1.png';
import rack2Url from '../art/clutter/rack2.png';
import shieldsUrl from '../art/clutter/shields.png';
import potionsUrl from '../art/clutter/potions.png';
import plantsUrl from '../art/clutter/plants.png';
import potsUrl from '../art/clutter/pots3.png';
import jarUrl from '../art/clutter/jar2.png';
import goldUrl from '../art/clutter/gold2.png';
import bookUrl from '../art/clutter/book_open.png';

const T = 16;
/** Wall rows over the floor (the wall picture is 44 px tall: about three tiles). */
const WALL_H = 44;

type Crop = [string, number, number, number, number];
const D = (x: number, y: number, w = 16, h = 16): Crop => [decorUrl, x, y, w, h];
/** DawnLike's decor cells (art/interior/decor.png). */
const BED = D(0, 144);
const CHAIR = D(0, 112);
const CHAIR_UP = D(32, 112);
const ROUND_TABLE = D(16, 112);
const TABLE = D(64, 112);
const THRONE = D(96, 112);
const CANDLE = D(16, 128);
const CANDELABRA = D(48, 128);
const SHELF_BOOKS = D(16, 64);
const SHELF_BOOKS2 = D(80, 64);
const SHELF = D(0, 64);
const CABINET = D(0, 80);
const DESK = D(0, 96);
const DESK2 = D(32, 96);
const LONG_TABLE = D(0, 160, 48, 16);
const CROSS = D(0, 176);
const RUG_RED = D(8, 232, 32, 32);
const RUG_GREY = D(56, 232, 32, 32);
const POT = D(16, 48);
const whole = (url: string): Crop => [url, 0, 0, 0, 0];

type Kind = RoomKind | 'temple' | 'barracks';
/** A thing set in the room: its picture, and where its feet stand (tile units from the floor's top left). */
interface Piece {
  pic: Crop;
  x: number;
  y: number;
  /** Drawn this many tiles wide (its own width when left out). */
  w?: number;
  flip?: boolean;
  /** Lies flat on the floor (a rug): drawn before everything standing. */
  flat?: boolean;
}
/** Where the folk go: beds (the pillow's place), stations and desks (where the worker stands), seats, the hearth,
 *  open floor. */
interface Layout {
  pieces: Piece[];
  beds: { x: number; y: number }[];
  stations: { x: number; y: number }[];
  desks: { x: number; y: number }[];
  seats: { x: number; y: number }[];
  hearth: { x: number; y: number } | null;
  fire: { x: number; y: number; kind: 'forge' | 'brazier' } | null;
  stone: boolean;
}

function kindFor(def: string): Kind {
  if (/temple|cathedral|church|chapel|monaster|abbey|sanctum/.test(def)) return 'temple';
  if (/barrack|guard_?house|drill|armoury|garrison/.test(def)) return 'barracks';
  return kindOf(BUILDING_BY_ID[def]);
}

/** The room's things, by what it is and how big. */
function layout(kind: Kind, cols: number, rows: number, beds: number): Layout {
  const L: Layout = { pieces: [], beds: [], stations: [], desks: [], seats: [], hearth: null, fire: null, stone: false };
  const P = (pic: Crop, x: number, y: number, w?: number, flip?: boolean) => L.pieces.push({ pic, x, y, w, flip, flat: pic === RUG_RED || pic === RUG_GREY });
  const mid = Math.floor(cols / 2);
  const bedRow = (n: number) => {
    // beds head to the wall down the left side, then the right, from the back
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const y = 1.3 + Math.floor(i / 2) * 1.25;
      if (y > rows - 0.2) break;
      const x = left ? 0.15 : cols - 1.15;
      P(BED, x, y);
      L.beds.push({ x: x + 0.5, y });
    }
  };
  switch (kind) {
    case 'home': {
      P(RUG_RED, mid - 1, rows - 1, 2);
      bedRow(Math.max(1, Math.min(beds, Math.floor(rows / 1.6) * 2)));
      P(SHELF, 2.2, 0.9);
      P(CABINET, cols - 3.2, 0.9);
      P(ROUND_TABLE, mid, rows - 1.6);
      P(CHAIR, mid - 1, rows - 1.6);
      P(CHAIR, mid + 1, rows - 1.6, undefined, true);
      L.seats.push({ x: mid - 0.5, y: rows - 1.6 }, { x: mid + 1.5, y: rows - 1.6 });
      L.hearth = { x: mid + 0.5, y: 1.4 };
      L.fire = { x: mid + 0.5, y: 0.9, kind: 'brazier' };
      P(CANDLE, mid - 1.5, 0.9);
      P(POT, mid + 2, 0.9);
      break;
    }
    case 'study': {
      P(RUG_GREY, mid - 1, rows - 1, 2);
      for (let x = 0.3; x < cols - 1; x += 1) P(x % 2 < 1 ? SHELF_BOOKS : SHELF_BOOKS2, x, 0.9);
      for (let i = 0; i < Math.min(3, Math.floor(cols / 3)); i++) {
        const x = 1.2 + i * 3;
        P(i % 2 ? DESK2 : DESK, x, 2.4);
        P(CHAIR_UP, x, 3.2);
        L.desks.push({ x: x + 0.5, y: 3.4 });
      }
      P(CANDELABRA, cols - 1.3, rows - 0.5);
      P(whole(bookUrl), 0.3, rows - 0.5);
      break;
    }
    case 'forge': {
      L.stone = true;
      L.fire = { x: mid, y: 1, kind: 'forge' };
      P(whole(rackUrl), 0.4, 1.1);
      P(whole(rack2Url), cols - 2.2, 1.1);
      P(whole(shieldsUrl), 1.8, 1.1);
      P(whole(barrelUrl), 0.4, rows - 0.6);
      P(whole(crateUrl), cols - 1.4, rows - 0.6);
      P(TABLE, mid + 2, 2.6);
      L.stations.push({ x: mid + 0.5, y: 2.4 }, { x: mid + 2.5, y: 3.4 }, { x: mid - 1.5, y: 3.2 });
      break;
    }
    case 'kitchen': {
      L.fire = { x: 1.4, y: 1, kind: 'forge' };
      P(LONG_TABLE, mid - 1.5, rows - 1.8, 3);
      P(whole(barrelUrl), cols - 1.4, 1.2);
      P(whole(barrelUrl), cols - 2.4, 1.2);
      P(whole(potsUrl), mid, 1.1);
      P(whole(jarUrl), mid + 1.4, 1.1);
      L.stations.push({ x: 2.6, y: 2.2 }, { x: mid + 0.5, y: 2.6 });
      L.seats.push({ x: mid - 1, y: rows - 1.1 }, { x: mid + 1, y: rows - 1.1 }, { x: mid, y: rows - 1.1 });
      L.hearth = { x: 2.6, y: 2.2 };
      break;
    }
    case 'healer': {
      P(SHELF, 0.4, 0.9);
      P(whole(potionsUrl), 1.6, 1.1);
      P(whole(plantsUrl), cols - 1.4, 1.1);
      bedRow(Math.max(2, Math.min(beds || 4, 6)));
      P(DESK, mid, 1.2);
      L.desks.push({ x: mid + 0.5, y: 2.1 });
      L.stations.push({ x: mid + 0.5, y: 2.1 });
      P(CANDLE, mid - 1, 0.9);
      break;
    }
    case 'store':
    case 'mine': {
      for (let x = 0.3; x < cols - 1; x += 1.4) P(whole(x % 2.8 < 1.4 ? crateStackUrl : barrelUrl), x, 1.3);
      P(whole(crateUrl), 0.4, rows - 0.6);
      P(whole(chestUrl), cols - 1.4, rows - 0.6);
      L.stations.push({ x: mid, y: 2.6 });
      L.seats.push({ x: mid + 1.5, y: rows - 1.2 });
      break;
    }
    case 'treasury':
    case 'hall': {
      L.stone = true;
      P(RUG_RED, mid - 1, rows - 0.2, 2);
      P(THRONE, mid - 0.5, 1.4);
      P(whole(chestGoldUrl), 1.2, 1.3);
      P(whole(goldUrl), cols - 2, 1.3);
      P(LONG_TABLE, mid - 1.5, rows - 1.8, 3);
      P(CANDELABRA, 0.4, 1.1);
      P(CANDELABRA, cols - 1.4, 1.1);
      L.stations.push({ x: mid, y: 2.2 });
      L.seats.push({ x: mid - 1, y: rows - 1.1 }, { x: mid + 1, y: rows - 1.1 });
      L.fire = { x: mid + 2.5, y: 1, kind: 'brazier' };
      break;
    }
    case 'temple': {
      L.stone = true;
      P(CROSS, mid - 0.5, 1.4);
      P(CANDELABRA, mid - 2, 1.2);
      P(CANDELABRA, mid + 1, 1.2);
      for (let r = 2.8; r < rows - 0.2; r += 1.3)
        for (const x of [1, 2, cols - 3, cols - 2]) P(CHAIR_UP, x, r);
      L.stations.push({ x: mid, y: 2.2 });
      for (let r = 2.8; r < rows - 0.2; r += 1.3) L.seats.push({ x: 1.5, y: r + 0.2 }, { x: cols - 2.5, y: r + 0.2 });
      break;
    }
    case 'barracks': {
      L.stone = true;
      bedRow(Math.max(2, Math.min(beds || 4, 6)));
      P(whole(rackUrl), mid - 1.5, 1.1);
      P(whole(shieldsUrl), mid + 0.5, 1.1);
      L.stations.push({ x: mid, y: 2.6 });
      L.fire = { x: mid + 2, y: 1, kind: 'brazier' };
      break;
    }
    default: {
      // a workshop: its bench and stools, crates and barrels, a lamp
      P(TABLE, mid - 1, 2.2);
      P(TABLE, mid + 1, 2.2);
      P(whole(crateUrl), 0.4, 1.3);
      P(whole(barrelUrl), cols - 1.4, 1.3);
      P(SHELF, 1.6, 0.9);
      P(CABINET, cols - 2.6, 0.9);
      P(CANDLE, mid, 0.9);
      L.stations.push({ x: mid - 0.5, y: 3 }, { x: mid + 1.5, y: 3 });
      L.seats.push({ x: 1.5, y: rows - 1 });
    }
  }
  return L;
}

const images = new Map<string, HTMLImageElement | null>();
function img(url: string): HTMLImageElement | null {
  if (!images.has(url)) {
    images.set(url, null);
    void loadImage(url).then(
      (im) => images.set(url, im),
      () => images.delete(url),
    );
  }
  return images.get(url) ?? null;
}

const WHAT: Record<string, string> = { bed: 'asleep', station: 'at work', desk: 'reading', hearth: 'by the hearth', table: 'at the table', floor: 'about the room' };

export class InteriorScene {
  private readonly el: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly title: HTMLElement;
  private readonly info: HTMLElement;
  private view: InteriorView | null = null;
  private people = new Map<number, PersonView>();
  private last = '';
  private frame = 0;
  private fontFamily = '';

  constructor(private readonly send: (c: Command) => void) {
    this.el = document.createElement('div');
    this.el.id = 'interior-view';
    this.el.innerHTML = '<canvas></canvas><div class="iv-top"><div class="iv-title"></div><button class="iv-close" title="Back out to the town">✕</button></div><div class="iv-info"></div>';
    this.el.hidden = true;
    document.body.append(this.el);
    this.canvas = this.el.querySelector('canvas')!;
    this.title = this.el.querySelector('.iv-title')!;
    this.info = this.el.querySelector('.iv-info')!;
    this.el.querySelector('.iv-close')!.addEventListener('click', () => this.send({ type: 'lookInside', building: null }));
  }

  get shown(): boolean {
    return !!this.view;
  }

  update(v: InteriorView | null, people: PersonView[]): void {
    const was = !!this.view;
    this.view = v;
    this.el.hidden = !v;
    document.body.classList.toggle('interior-on', !!v);
    if (!v) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      return;
    }
    this.people = new Map(people.map((p) => [p.id, p]));
    if (!was) this.loop();
    const key = `${v.building}|${v.inside.map((p) => `${p.id}:${p.at}:${p.doing}`).join(',')}|${v.out.map((o) => o.name + o.doing).join(',')}|${v.making.map((m) => m.name + Math.round(m.done * 10)).join(',')}|${v.studying}`;
    if (key === this.last) return;
    this.last = key;
    this.title.textContent = v.name;
    this.info.innerHTML = '';
    const row = (label: string, text: string, cls = 'iv-row') => {
      const d = document.createElement('div');
      d.className = cls;
      if (label) {
        const b = document.createElement('b');
        b.textContent = label;
        d.append(b);
      }
      d.append(document.createTextNode(text));
      this.info.append(d);
    };
    if (v.owner) row('Owned by ', v.owner);
    if (v.beds) row('Beds ', `${v.beds}`);
    if (v.making.length) row('Making ', v.making.map((m) => `${m.name} (${Math.round(m.done * 100)}%)`).join(', '));
    if (v.studying) row('Studying ', v.studying);
    if (!v.inside.length) row('', v.night ? 'Dark and quiet: nobody is in.' : 'Nobody is in just now.', 'iv-quiet');
    for (const p of v.inside) row(`${p.name} `, `${p.child ? '(a child) ' : ''}${p.doing || WHAT[p.at] || ''}`);
    if (v.out.length) row('Out ', v.out.map((o) => `${o.name} (${o.doing.toLowerCase()})`).join('; '), 'iv-out');
  }

  private font(): string {
    if (!this.fontFamily) this.fontFamily = getComputedStyle(this.info).fontFamily || 'sans-serif';
    return this.fontFamily;
  }

  private loop(): void {
    const tick = () => {
      if (!this.view) return;
      this.draw(performance.now());
      this.frame = requestAnimationFrame(tick);
    };
    this.frame = requestAnimationFrame(tick);
  }

  private draw(now: number): void {
    const v = this.view!;
    const c = this.canvas;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = Math.round(c.clientWidth * dpr);
    const H = Math.round(c.clientHeight * dpr);
    if (!W || !H) return;
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.fillStyle = '#120e0c';
    g.fillRect(0, 0, W, H);
    // the room's size by the building's, and its fit on the screen (below the bar; above or beside the window)
    const cols = Math.max(7, Math.min(10, v.w * 2 + 2));
    const rows = Math.max(5, Math.min(7, v.d * 2 + 1));
    const kind = kindFor(v.def);
    const L = layout(kind, cols, rows, v.beds);
    const sideways = W > H;
    const top = 56 * dpr;
    const box = sideways ? { x: 8 * dpr, y: top, w: W - 284 * dpr, h: H - top - 8 * dpr } : { x: 8 * dpr, y: top, w: W - 16 * dpr, h: H - top - 210 * dpr };
    const artW = cols * T + 8;
    const artH = WALL_H + rows * T + 6;
    const k = Math.max(1, Math.floor(Math.min(box.w / artW, box.h / artH) * 2) / 2);
    const ox = Math.round(box.x + (box.w - artW * k) / 2 + 4 * k);
    const oy = Math.round(box.y + (box.h - artH * k) / 2);
    const fy = oy + WALL_H * k; // the floor's top
    const tx = (x: number) => ox + x * T * k;
    const ty = (y: number) => fy + y * T * k;
    const blit = (p: Crop, x: number, y: number, w?: number, flip = false) => {
      const im = img(p[0]);
      if (!im) return;
      const sw = p[3] || im.width;
      const sh = p[4] || im.height;
      // (the clutter is cut at the map's scale, twice the decor sheet's: drawn at half)
      const dw = (w ? w * T : p[3] ? sw : sw / 2) * k;
      const dh = (dw / sw) * sh;
      g.save();
      g.translate(Math.round(x), Math.round(y - dh));
      if (flip) {
        g.translate(dw, 0);
        g.scale(-1, 1);
      }
      g.drawImage(im, p[1], p[2], sw, sh, 0, 0, dw, dh);
      g.restore();
    };
    // the floor
    const floorIm = img(L.stone ? stoneUrl : wallsUrl);
    for (let y = 0; y < rows; y++)
      for (let x = 0; x < cols; x++) {
        if (!floorIm) break;
        if (L.stone) g.drawImage(floorIm, (x % 2) * 16, (y % 2) * 16, 16, 16, tx(x), ty(y), T * k, T * k);
        else g.drawImage(floorIm, 144, (y % 2) * 16, 16, 16, tx(x), ty(y), T * k, T * k);
      }
    // the back wall: stone with a window every third tile; a dark line down the sides
    const walls = img(wallsUrl);
    if (walls) for (let x = 0; x < cols; x++) g.drawImage(walls, x % 3 === 1 ? 96 : 48 + (x % 2) * 16, 128, 16, WALL_H, tx(x), oy, T * k, WALL_H * k);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(tx(0), fy, T * k * cols, 6 * k); // the wall's shadow on the floor
    g.fillStyle = '#2a1e18';
    g.fillRect(tx(0) - 4 * k, oy, 4 * k, artH * k - 6 * k);
    g.fillRect(tx(cols), oy, 4 * k, artH * k - 6 * k);
    g.fillRect(tx(0) - 4 * k, ty(rows), (cols * T + 8) * k, 4 * k);
    // the fire (a furnace or a brazier), flickering
    if (L.fire) {
      if (L.fire.kind === 'forge') {
        const im = img(forgeUrl);
        if (im) {
          const f = Math.floor(now / 120) % 6;
          const w = 1.6 * T * k;
          const h = (w / 45) * 78;
          g.drawImage(im, 8 + f * 64, 14, 45, 78, Math.round(tx(L.fire.x) - w / 2), Math.round(ty(L.fire.y + 0.5) - h), w, h);
        }
      } else {
        const im = img(firesUrl);
        if (im) {
          const f = Math.floor(now / 110) % 6;
          const w = 44 * k * 0.6;
          g.drawImage(im, 3 * 44, f * 48, 44, 48, Math.round(tx(L.fire.x) - w / 2), Math.round(ty(L.fire.y + 0.6) - 48 * k * 0.6), w, 48 * k * 0.6);
        }
      }
    }
    // things and folk, back to front
    type Draw = { y: number; fn: () => void };
    const list: Draw[] = L.pieces.map((p) => ({ y: p.flat ? -99 : p.y, fn: () => blit(p.pic, tx(p.x), ty(p.y), p.w, p.flip) }));
    const slots = { bed: [...L.beds], station: [...L.stations], desk: [...L.desks], seat: [...L.seats] };
    // (more folk than places: the open floor, a spot clear of everyone placed so far)
    const used: { x: number; y: number }[] = [];
    const floorSpot = (i: number) => {
      let best = { x: 1.5, y: rows - 1 };
      let far = -1;
      for (let y = 2.2; y < rows - 0.3; y += 0.9)
        for (let x = 1.2; x < cols - 0.8; x += 1.1) {
          const d = Math.min(9, ...used.map((u) => Math.hypot(u.x - x, (u.y - y) * 1.4))) + ((x * 7 + y * 3 + i) % 1) * 0.01;
          if (d > far) {
            far = d;
            best = { x, y };
          }
        }
      return best;
    };
    v.inside.forEach((who, i) => {
      const pv = this.people.get(who.id);
      if (!pv) return;
      const keys = hkLayers(hkWhoOf(pv), { fighting: false, activity: who.at === 'station' ? pv.activity : 'idle' });
      const h = (who.child ? 22 : 30) * k;
      if (who.at === 'bed' && slots.bed.length) {
        const b = slots.bed.shift()!;
        // asleep: the head on the pillow, a blanket over them, a z drifting up
        list.push({
          y: b.y + 0.01,
          fn: () => {
            const x = tx(b.x);
            const y = ty(b.y) - 12 * k;
            g.fillStyle = pv.look.hairColor;
            g.beginPath();
            g.ellipse(x, y - 0.8 * k, 3.2 * k, 2.6 * k, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = pv.look.skin;
            g.beginPath();
            g.ellipse(x, y + 0.6 * k, 2.6 * k, 2.2 * k, 0, 0, Math.PI * 2);
            g.fill();
            g.fillStyle = 'rgba(255,255,255,0.85)';
            g.font = `bold ${7 * k}px ${this.font()}`;
            const z = (now / 900 + i) % 1;
            g.globalAlpha = 1 - z;
            g.fillText('z', x + 4 * k, y - 4 * k - z * 10 * k);
            g.globalAlpha = 1;
          },
        });
        return;
      }
      const spot =
        (who.at === 'station' && (slots.station.shift() ?? slots.desk.shift())) ||
        (who.at === 'desk' && (slots.desk.shift() ?? slots.station.shift())) ||
        ((who.at === 'table' || who.at === 'hearth') && (who.at === 'hearth' && L.hearth ? L.hearth : slots.seat.shift())) ||
        floorSpot(i);
      used.push(spot);
      const working = who.at === 'station';
      const facing = working ? 'up' : who.at === 'desk' ? 'down' : 'down';
      const [col, rowCell] = hkPose({ facing, moving: who.at === 'floor' && who.child, walked: now / 30, working, sinceBlow: 99, sinceHit: 99, down: false, ranged: false, now, reading: who.at === 'desk', playing: who.child, ref: who.id });
      list.push({
        y: spot.y + 0.02,
        fn: () => {
          const x = tx(spot.x);
          const y = ty(spot.y);
          g.fillStyle = 'rgba(0,0,0,0.25)';
          g.beginPath();
          g.ellipse(x, y, 5 * k, 1.6 * k, 0, 0, Math.PI * 2);
          g.fill();
          const bob = !working && Math.sin(now / 700 + who.id) > 0.6 ? k : 0;
          hkDraw(g, keys, col, rowCell, Math.round(x), Math.round(y - bob), h);
        },
      });
    });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.fn();
    // the light: a warm pool by the fire, and the dark of night over the room
    if (L.fire) {
      const fx = tx(L.fire.x);
      const fyy = ty(L.fire.y);
      const r = (3.5 + 0.2 * Math.sin(now / 90)) * T * k;
      const grad = g.createRadialGradient(fx, fyy, 0, fx, fyy, r);
      grad.addColorStop(0, 'rgba(255,170,80,0.28)');
      grad.addColorStop(1, 'rgba(255,170,80,0)');
      g.fillStyle = grad;
      g.fillRect(fx - r, fyy - r, r * 2, r * 2);
    }
    if (v.night) {
      g.fillStyle = 'rgba(10,14,40,0.35)';
      g.fillRect(tx(0) - 4 * k, oy, (cols * T + 8) * k, artH * k);
    }
  }
}
