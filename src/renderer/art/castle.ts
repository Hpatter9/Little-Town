// A castle town's look (sim/castle.ts): its rooms seen in cutaway, one floor on the next, and the keep built round
// them: dark stone, floors of oak, towers at each end with steep slate cones, battlements, spires and red banners
// over the top floor, and plain masonry wherever there's no room yet.
//
// Every room is the same height; what's in it depends on what it is: coffins where people sleep, shelves of books
// where they study, anvils and a forge's glow where they work, a feasting table, cabinets of curiosities, sickbeds
// with bottles of blood, racks of arms, a chapel, humming machines.

import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { paint, type Painter, type PixelArt, type Tone } from './pixelArt';

import { PLINTH, ROOF_H, ROOM_H, TOWER_W } from '../../shared/sim/castle';

export { PLINTH, ROOF_H, ROOM_H, TOWER_W };

const STONE = '#4a3a4a';
const STONE_LIGHT = '#5e4c5e';
const STONE_DARK = '#2e222e';
const WALL = '#2a2030';
const WALL_LINE = '#342838';
const OAK = '#4a2e1c';
const OAK_LIGHT = '#6a4228';
const SLATE = '#2a2232';
const SLATE_DARK = '#1a1420';
const BLOOD = '#a01828';
const BLOOD_LIGHT = '#d03040';
const GOLD = '#d8b050';
const CANDLE = '#f0d080';
const MOON = '#6a7ab8';
const MOON_LIGHT = '#9aa8e0';
const BONE = '#e0d8c0';
const IRON = '#6a6a74';

type Kind = 'bed' | 'study' | 'forge' | 'hall' | 'shop' | 'sick' | 'arms' | 'kitchen' | 'chapel' | 'machine' | 'throne';

const KIND: Record<string, Kind> = {
  scriptorium: 'study', library: 'study', school: 'study', university: 'study', elder_lodge: 'study', ai_core: 'machine',
  tavern: 'hall', fireside_inn: 'hall', town_hall: 'throne',
  trading_post: 'shop', general_store: 'shop', emporium: 'shop', market: 'shop',
  infirmary: 'sick', hospital: 'sick', trauma_center: 'sick', healers_hut: 'sick',
  barracks: 'arms', lookout: 'arms', watchtower: 'arms', guard_tower: 'arms', gunsmith: 'arms', drone_hub: 'arms',
  bakery: 'kitchen',
  phylactery: 'chapel', resurrection_shrine: 'chapel', clone_vat: 'chapel', cryo_pod: 'chapel', storytellers_circle: 'chapel',
  power_station: 'machine', electronics_plant: 'machine', fusion_reactor: 'machine', chip_fab: 'machine', battery_plant: 'machine',
  robot_workshop: 'machine', mission_control: 'machine', shield_generator: 'machine', radio_tower: 'machine', cinema: 'machine',
};
const kindOf = (defId: string): Kind => (BUILDING_BY_ID[defId]?.housing ? 'bed' : (KIND[defId] ?? 'forge'));

/* ------------------------------------------------------------ small furniture */

function gothicWindow(p: Painter, x: number, y: number, w: number, h: number, glass: string, light: string): void {
  p.rect(x - 1, y + w / 2, w + 2, h - w / 2 + 1, STONE_DARK);
  for (let i = 0; i < w / 2; i++) p.rect(x + w / 2 - i - 1, y + i, (i + 1) * 2, 1, glass);
  p.rect(x, y + w / 2, w, h - w / 2, glass);
  p.rect(x + w / 2 - 0.5, y + 2, 1, h - 2, STONE_DARK); // mullion
  p.rect(x, y + h / 2 + 2, w, 1, STONE_DARK);
  p.px(x + 1, y + w / 2 + 1, light);
  p.px(x + 2, y + w / 2 + 2, light);
}

function sconce(p: Painter, x: number, y: number): void {
  p.disc(x, y - 1, 4, '#4a3020'); // (a warm pool of light on the wall)
  p.rect(x - 1, y, 2, 4, IRON);
  p.px(x - 1, y - 2, '#f0a030');
  p.px(x, y - 3, CANDLE);
}

function candelabra(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 12, 1, 12, GOLD);
  p.rect(x - 3, floor - 12, 7, 1, GOLD);
  p.rect(x - 2, floor - 1, 5, 1, GOLD);
  for (const dx of [-3, 0, 3]) {
    p.rect(x + dx, floor - 15, 1, 3, BONE);
    p.px(x + dx, floor - 16, CANDLE);
  }
}

function coffin(p: Painter, x: number, floor: number, open: boolean): void {
  // a coffin on trestles: wide at the shoulders
  p.rect(x + 1, floor - 3, 1, 3, OAK);
  p.rect(x + 12, floor - 3, 1, 3, OAK);
  const top = floor - 8;
  p.rect(x, top, 14, 5, '#3a1e14');
  p.rect(x + 3, top - 1, 7, 1, '#3a1e14');
  p.rect(x, top + 5, 14, 1, '#24120c');
  if (open) {
    p.rect(x + 1, top + 1, 12, 3, BLOOD); // red silk
    p.rect(x + 2, top - 5, 1, 6, '#3a1e14'); // the lid, leant open
  } else {
    p.rect(x + 4, top + 1, 1, 3, GOLD); // a cross on the lid
    p.rect(x + 3, top + 2, 3, 1, GOLD);
  }
}

/** A coffin stood on end against the wall, lid open on red silk. */
function uprightCoffin(p: Painter, x: number, floor: number, open: boolean): void {
  const h = 30;
  const top = floor - h;
  for (let y = 0; y < h; y++) {
    // widest at the shoulders, a third of the way down
    const half = y < h / 3 ? 3 + (y / (h / 3)) * 3 : 6 - ((y - h / 3) / (h * 0.67)) * 2.5;
    p.rect(x + 6 - half, top + y, half * 2, 1, '#3a1e14');
    if (open && y > 1 && y < h - 2) p.rect(x + 6 - half + 1.5, top + y, half * 2 - 3, 1, y % 5 === 0 ? BLOOD_LIGHT : BLOOD);
  }
  if (!open) {
    p.rect(x + 5.5, top + 6, 1, 12, GOLD);
    p.rect(x + 3, top + 9, 6, 1, GOLD);
  } else p.rect(x + 12, top + 2, 2, h - 3, '#3a1e14'); // the lid, swung aside
}

function chandelier(p: Painter, x: number): void {
  p.rect(x, 3, 1, 8, IRON);
  p.rect(x - 8, 11, 17, 2, GOLD);
  p.rect(x - 6, 13, 13, 1, GOLD);
  for (const dx of [-8, -4, 0, 4, 8]) {
    p.rect(x + dx, 8, 1, 3, BONE);
    p.px(x + dx, 7, CANDLE);
  }
}

function portrait(p: Painter, x: number, y: number): void {
  p.rect(x, y, 12, 15, GOLD);
  p.rect(x + 1, y + 1, 10, 13, '#3a1420');
  p.disc(x + 6, y + 6, 2.5, '#e8d8d0'); // a pale face
  p.rect(x + 3, y + 9, 6, 5, '#1a0a10'); // a high black collar
  p.px(x + 5, y + 6, BLOOD_LIGHT);
  p.px(x + 7, y + 6, BLOOD_LIGHT);
}

function cobweb(p: Painter, x: number, dir: 1 | -1): void {
  for (let i = 0; i < 7; i++) {
    p.px(x + dir * i, 3 + i * 0.3, '#8a8090');
    p.px(x + dir * i * 0.3, 3 + i, '#8a8090');
    p.px(x + dir * i * 0.7, 3 + i * 0.7, '#6a6070');
  }
}

function rug(p: Painter, x: number, floor: number, w: number): void {
  p.rect(x, floor - 1, w, 2, BLOOD);
  p.rect(x + 1, floor - 1, w - 2, 1, '#701020');
  for (let k = x + 2; k < x + w - 2; k += 4) p.px(k, floor, GOLD);
}

function bookshelf(p: Painter, x: number, floor: number, w: number): void {
  p.rect(x, floor - 26, w, 26, OAK);
  for (let y = floor - 24; y < floor - 2; y += 6) {
    p.rect(x + 1, y, w - 2, 5, '#1e140e');
    for (let bx = x + 1; bx < x + w - 2; bx += 2) p.rect(bx, y + 1 + ((bx * 7) % 3 === 0 ? 1 : 0), 1, 4 - ((bx * 7) % 3 === 0 ? 1 : 0), ['#6a2030', '#2a4a6a', '#6a5a2a', '#3a5a3a', '#5a3a6a'][(bx + y) % 5]);
  }
}

function desk(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 9, 16, 2, OAK_LIGHT);
  p.rect(x + 1, floor - 7, 1, 7, OAK);
  p.rect(x + 14, floor - 7, 1, 7, OAK);
  p.rect(x + 4, floor - 11, 6, 2, '#e8dcc0'); // an open book
  p.rect(x + 7, floor - 11, 1, 2, '#a89878');
  p.rect(x + 12, floor - 13, 1, 4, BONE); // a candle
  p.px(x + 12, floor - 14, CANDLE);
  p.rect(x + 1, floor - 12, 2, 3, '#d8d0c0'); // a skull
}

function anvil(p: Painter, x: number, floor: number): void {
  p.rect(x + 2, floor - 3, 6, 3, IRON);
  p.rect(x, floor - 7, 11, 4, '#8a8a94');
  p.rect(x + 9, floor - 6, 3, 2, '#8a8a94');
}

function forgeFire(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 18, 14, 18, '#3a2e32');
  p.rect(x + 1, floor - 22, 12, 4, '#3a2e32'); // hood
  p.rect(x + 3, floor - 10, 8, 6, '#1a0e0a');
  p.rect(x + 4, floor - 7, 6, 3, '#f06020');
  p.rect(x + 5, floor - 9, 4, 2, '#f0a030');
  p.px(x + 7, floor - 10, CANDLE);
}

function cask(p: Painter, x: number, floor: number, red: boolean): void {
  p.ellipse(x + 5, floor - 5, 5, 5, OAK);
  p.rect(x, floor - 6, 11, 1, '#2a1a10');
  p.rect(x, floor - 3, 11, 1, '#2a1a10');
  if (red) p.disc(x + 5, floor - 5, 1.5, BLOOD_LIGHT); // the tap
}

function longTable(p: Painter, x: number, floor: number, w: number): void {
  p.rect(x, floor - 9, w, 2, OAK_LIGHT);
  p.rect(x + 1, floor - 7, 1, 7, OAK);
  p.rect(x + w - 2, floor - 7, 1, 7, OAK);
  for (let gx = x + 3; gx < x + w - 3; gx += 6) {
    p.rect(gx, floor - 12, 2, 3, GOLD); // goblets
    p.px(gx, floor - 12, BLOOD_LIGHT);
  }
  p.rect(x + w / 2 - 3, floor - 12, 6, 3, '#8a4a2a'); // a roast
}

function highChair(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 22, 8, 22, BLOOD);
  p.rect(x + 1, floor - 21, 6, 12, '#701020');
  p.rect(x - 1, floor - 24, 10, 2, GOLD);
  p.px(x + 3, floor - 26, GOLD);
  p.px(x + 4, floor - 26, GOLD);
  p.rect(x - 1, floor - 9, 10, 2, '#701020');
}

function cabinet(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 20, 12, 20, OAK);
  p.rect(x + 1, floor - 19, 10, 16, '#1a2a30');
  for (let y = floor - 17; y < floor - 4; y += 5) {
    p.rect(x + 1, y + 3, 10, 1, OAK_LIGHT);
    p.px(x + 3, y + 1, ['#d0c040', '#60c0e0', BLOOD_LIGHT][(y + x) % 3]);
    p.px(x + 7, y + 2, BONE);
  }
}

function sickbed(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 6, 16, 3, '#d8d0c8');
  p.rect(x, floor - 3, 1, 3, IRON);
  p.rect(x + 15, floor - 3, 1, 3, IRON);
  p.rect(x, floor - 9, 2, 6, IRON);
  p.rect(x + 18, floor - 20, 1, 20, IRON); // a stand with a bottle of blood
  p.rect(x + 16, floor - 19, 4, 5, BLOOD);
  p.rect(x + 17, floor - 14, 1, 7, BLOOD);
}

function weaponRack(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 22, 16, 2, OAK);
  p.rect(x, floor - 4, 16, 2, OAK);
  for (let k = 0; k < 4; k++) {
    p.rect(x + 2 + k * 4, floor - 26, 1, 24, k % 2 ? '#8a6a3a' : IRON);
    p.rect(x + 1 + k * 4, floor - 28, 3, 3, '#b8b8c0');
  }
  p.rect(x + 18, floor - 16, 8, 10, '#6a1a24'); // a shield with a bat
  p.rect(x + 20, floor - 12, 4, 2, '#1a1018');
}

function altar(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 8, 18, 8, '#5a4a5a');
  p.rect(x - 1, floor - 9, 20, 2, '#7a6a7a');
  p.rect(x + 8, floor - 20, 2, 11, GOLD); // a cross, upside down
  p.rect(x + 5, floor - 13, 8, 2, GOLD);
  candelabra(p, x - 4, floor);
  candelabra(p, x + 22, floor);
}

function machine(p: Painter, x: number, floor: number): void {
  p.rect(x, floor - 22, 18, 22, '#3a4450');
  p.rect(x + 2, floor - 20, 14, 8, '#1a2a30');
  for (let k = 0; k < 4; k++) p.px(x + 4 + k * 3, floor - 16, ['#40f080', '#ff4040', '#60e0ff', '#f0c040'][k]);
  p.rect(x + 2, floor - 9, 14, 1, '#6a7480');
  p.disc(x + 23, floor - 10, 5, '#5a3a6a'); // a crackling coil
  p.disc(x + 23, floor - 10, 2, '#c080ff');
  p.rect(x + 22, floor - 5, 3, 5, IRON);
}

/* ------------------------------------------------------------ rooms */

const cache = new Map<string, PixelArt>();

/** A room: its back wall, windows, light, and what's in it. */
export function roomArt(defId: string, tone: Tone, toneKey: string): PixelArt {
  const key = `${defId}|${toneKey}`;
  let art = cache.get(key);
  if (art) return art;
  const w = BUILDING_BY_ID[defId].width * TILE;
  const h = ROOM_H;
  art = paint(w, h, tone, (p) => {
    const floor = h - 3;
    // the back wall (dressed stone), the ceiling beams, the oak floor
    p.rect(0, 0, w, h, WALL);
    for (let y = 4; y < floor; y += 6) for (let x = (y / 6) % 2 ? 0 : -5; x < w; x += 10) p.rect(Math.max(0, x), y, 1, 6, WALL_LINE);
    for (let y = 4; y < floor; y += 6) p.rect(0, y, w, 1, WALL_LINE);
    p.rect(0, 0, w, 3, OAK);
    for (let x = 6; x < w; x += 16) p.rect(x, 0, 3, 4, '#3a2214');
    p.rect(0, floor, w, 3, OAK_LIGHT);
    p.rect(0, floor + 2, w, 1, OAK);
    // the side walls of the room (thick stone)
    p.rect(0, 0, 2, h, STONE_DARK);
    p.rect(w - 2, 0, 2, h, STONE_DARK);
    const kind = kindOf(defId);
    // tall windows on the moon (or red glass in the chapel and the hall)
    const red = kind === 'chapel' || kind === 'throne' || kind === 'hall';
    const windows = Math.max(1, Math.floor(w / 48));
    for (let i = 0; i < windows; i++) gothicWindow(p, Math.round(((i + 0.5) * w) / windows) - 4, 8, 8, Math.round(h * 0.5), red ? BLOOD : MOON, red ? BLOOD_LIGHT : MOON_LIGHT);
    if (w >= 64) sconce(p, 8, 20);
    sconce(p, w - 9, 20);
    const cx = w / 2;
    switch (kind) {
      case 'bed': {
        // coffins stood against the wall between the windows, and one laid out on trestles
        const n = Math.max(2, Math.floor((w - 12) / 22));
        for (let i = 0; i < n; i++) {
          const x = 6 + i * ((w - 12) / n);
          if (i % 3 === 1) coffin(p, x, floor, true);
          else uprightCoffin(p, x, floor, i % 2 === 0);
        }
        rug(p, 4, floor, w - 8);
        break;
      }
      case 'study':
        bookshelf(p, 4, floor, Math.min(22, w / 3));
        desk(p, cx - 4, floor);
        if (w >= 96) bookshelf(p, w - 26, floor, 22);
        break;
      case 'forge':
        forgeFire(p, 5, floor);
        anvil(p, cx - 2, floor);
        if (w >= 80) cask(p, w - 16, floor, false);
        p.rect(cx + 14, floor - 16, 1, 6, IRON); // tongs on the wall
        p.rect(cx + 17, floor - 16, 1, 7, IRON);
        break;
      case 'hall':
        longTable(p, 8, floor, w - 30);
        cask(p, w - 18, floor, true);
        candelabra(p, w / 2, floor - 11);
        break;
      case 'throne':
        p.rect(cx - 8, floor - 1, 16, 1, BLOOD); // a carpet
        highChair(p, cx - 4, floor);
        candelabra(p, cx - 16, floor);
        candelabra(p, cx + 16, floor);
        break;
      case 'shop':
        cabinet(p, 5, floor);
        if (w >= 96) cabinet(p, w - 18, floor);
        p.rect(cx - 12, floor - 9, 24, 9, OAK); // a counter
        p.rect(cx - 12, floor - 10, 24, 1, OAK_LIGHT);
        p.rect(cx - 4, floor - 13, 3, 3, GOLD); // coins
        p.rect(cx + 3, floor - 12, 4, 2, '#8ab0c0'); // a curiosity
        break;
      case 'sick':
        sickbed(p, 6, floor);
        if (w >= 96) sickbed(p, w / 2 + 4, floor);
        break;
      case 'arms':
        weaponRack(p, 6, floor);
        break;
      case 'kitchen':
        for (let i = 0; i < Math.floor((w - 20) / 14); i++) cask(p, 6 + i * 14, floor, true);
        p.rect(w - 14, floor - 12, 10, 12, '#3a2e32'); // an oven
        p.rect(w - 12, floor - 7, 6, 4, '#f06020');
        break;
      case 'chapel':
        altar(p, cx - 9, floor);
        break;
      case 'machine':
        machine(p, 6, floor);
        break;
    }
    if (kind !== 'chapel' && kind !== 'throne' && kind !== 'bed' && w >= 64) candelabra(p, w - 20, floor);
    // over it all: a chandelier in the bigger rooms, a portrait of the lord, cobwebs in the corners
    if (w >= 96) chandelier(p, Math.round(w / 2) + 12);
    if (kind === 'hall' || kind === 'throne' || kind === 'study' || kind === 'shop') portrait(p, Math.round(w / 2) - 22, 12);
    cobweb(p, 3, 1);
    if ((w / TILE) % 2) cobweb(p, w - 4, -1);
  });
  cache.set(key, art);
  return art;
}

/* ------------------------------------------------------------ the keep */

function blocks(p: Painter, x0: number, y0: number, w: number, h: number): void {
  p.rect(x0, y0, w, h, STONE);
  for (let y = y0; y < y0 + h; y += 5) {
    p.rect(x0, y, w, 1, STONE_DARK);
    for (let x = x0 + ((y - y0) / 5) % 2 * 4; x < x0 + w; x += 9) {
      p.rect(x, y + 1, 1, 4, STONE_DARK);
      if ((x * 3 + y) % 7 === 0) p.rect(x + 1, y + 1, 7, 1, STONE_LIGHT);
    }
  }
}

function cone(p: Painter, cx: number, base: number, half: number, height: number): void {
  for (let y = 0; y <= height; y++) {
    const hw = Math.max(0.5, (half * y) / height);
    p.rect(cx - hw, base - height + y, hw, 1, SLATE);
    p.rect(cx, base - height + y, hw, 1, SLATE_DARK);
  }
  p.rect(cx - 0.5, base - height - 6, 1, 6, GOLD); // finial
  p.px(cx - 1, base - height - 4, GOLD);
  p.px(cx + 1, base - height - 4, GOLD);
}

function pennon(p: Painter, x: number, top: number, len: number): void {
  p.rect(x, top, 1, 10, IRON);
  for (let i = 0; i < len; i++) p.rect(x + 1, top + 1 + i * 0.35, len - i, 2, i % 3 === 2 ? BLOOD_LIGHT : BLOOD);
}

/** The keep for `floors` floors over the tiles [lo, hi): everything but the rooms (drawn over it). Its left edge is
 *  TOWER_W left of `lo`; its bottom is the ground. */
export function keepArt(lo: number, hi: number, floors: number, tone: Tone, toneKey: string): PixelArt {
  const key = `keep|${lo}|${hi}|${floors}|${toneKey}`;
  let art = cache.get(key);
  if (art) return art;
  const inner = (hi - lo) * TILE;
  const w = inner + TOWER_W * 2;
  const bodyH = floors * ROOM_H + PLINTH;
  const h = bodyH + ROOF_H + 26;
  art = paint(w, h, tone, (p) => {
    const ground = h;
    const top = ground - bodyH;
    // the body: masonry wherever there's no room, a stone course between floors
    blocks(p, TOWER_W, top, inner, bodyH);
    for (let f = 1; f < floors; f++) p.rect(TOWER_W, ground - PLINTH - f * ROOM_H - 2, inner, 3, STONE_LIGHT);
    p.rect(TOWER_W - 2, ground - PLINTH, inner + 4, PLINTH, STONE_DARK);
    // arrow slits and a few lit windows in the bare masonry (behind the rooms: they show only where there are none)
    for (let f = 0; f < floors; f++) {
      const y = ground - PLINTH - (f + 1) * ROOM_H + 10;
      for (let x = TOWER_W + 14; x < TOWER_W + inner - 10; x += 32) {
        p.rect(x, y, 2, 12, '#120c14');
        if ((x + f * 3) % 5 === 0) p.rect(x, y + 4, 2, 5, '#c05030');
      }
    }
    // battlements along the top of the body, and a steep slate roof over the middle
    for (let x = TOWER_W; x < TOWER_W + inner; x += 8) p.rect(x, top - 5, 5, 5, STONE);
    const roofW = Math.min(inner - 24, Math.max(64, inner * 0.6));
    const rx0 = TOWER_W + (inner - roofW) / 2;
    for (let y = 0; y < ROOF_H - 18; y++) {
      const half = (roofW / 2) * ((y + 1) / (ROOF_H - 18));
      p.rect(rx0 + roofW / 2 - half, top - 5 - (ROOF_H - 18) + y, half, 1, SLATE);
      p.rect(rx0 + roofW / 2, top - 5 - (ROOF_H - 18) + y, half, 1, SLATE_DARK);
    }
    p.rect(rx0 + roofW / 2 - 0.5, top - 5 - (ROOF_H - 18) - 10, 1, 10, GOLD); // the spire's needle
    gothicWindow(p, rx0 + roofW / 2 - 4, top - 5 - (ROOF_H - 18) / 2, 8, 12, BLOOD, BLOOD_LIGHT); // a dormer, lit red
    // two lesser spires on the roofline
    for (const sx of [TOWER_W + 18, TOWER_W + inner - 18]) {
      p.rect(sx - 4, top - 14, 8, 9, STONE);
      cone(p, sx, top - 14, 5, 16);
    }
    // the towers: taller than the keep, round-shouldered, with cones, slit windows and pennons
    for (const [tx, side] of [[0, -1], [w - TOWER_W, 1]] as const) {
      const tTop = top - 22;
      blocks(p, tx, tTop, TOWER_W, ground - tTop);
      p.rect(tx, tTop, TOWER_W, 2, STONE_LIGHT);
      for (let x = tx; x < tx + TOWER_W; x += 6) p.rect(x, tTop - 4, 4, 4, STONE);
      // the stairwell, open to view: a dark shaft with stone steps zigzagging up it, a landing at each floor (people
      // and raiders climb here: sim/castle.ts moveOnFloors)
      const sx0 = tx + 4;
      const sw = TOWER_W - 8;
      const shaftTop = ground - PLINTH - floors * ROOM_H + 6;
      p.rect(sx0, shaftTop, sw, ground - PLINTH - shaftTop, '#1a1016');
      p.rect(sx0, shaftTop, 1, ground - PLINTH - shaftTop, STONE_DARK);
      p.rect(sx0 + sw - 1, shaftTop, 1, ground - PLINTH - shaftTop, STONE_DARK);
      for (let f = 0; f < floors; f++) {
        const base = ground - PLINTH - f * ROOM_H;
        p.rect(sx0, base - 2, sw, 2, STONE_LIGHT); // the landing
        const flight = ROOM_H - 6;
        const steps = 8;
        for (let k = 0; k < steps; k++) {
          const leftward = f % 2 === 1;
          const sx = leftward ? sx0 + sw - 3 - ((sw - 4) * k) / (steps - 1) : sx0 + 1 + ((sw - 4) * k) / (steps - 1);
          const sy = base - 4 - (flight * (k + 1)) / steps;
          p.rect(Math.round(sx), Math.round(sy), 3, 2, STONE);
          p.px(Math.round(sx), Math.round(sy), STONE_LIGHT);
        }
        // a torch on each landing
        p.px(side < 0 ? sx0 + sw - 2 : sx0 + 1, base - 12, '#f0a040');
        p.px(side < 0 ? sx0 + sw - 2 : sx0 + 1, base - 13, '#f06030');
      }
      p.rect(sx0, shaftTop - 1, sw, 1, STONE_LIGHT);
      gothicWindow(p, tx + TOWER_W / 2 - 3, tTop + 6, 6, 12, MOON, MOON_LIGHT);
      cone(p, tx + TOWER_W / 2, tTop - 4, TOWER_W / 2 + 2, 30);
      pennon(p, tx + TOWER_W / 2 + (side > 0 ? 0 : -1), tTop - 44, 9);
    }
    // a great door at the foot of each tower (the way in, for townsfolk and raiders alike), and bats about the roof
    for (const tx of [0, w - TOWER_W]) {
      p.rect(tx + TOWER_W / 2 - 5, ground - 16, 10, 16, '#1a0e0a');
      p.rect(tx + TOWER_W / 2 - 5, ground - 16, 10, 1, GOLD);
      p.rect(tx + TOWER_W / 2 - 1, ground - 15, 1, 15, '#3a2418');
    }
    for (const [bx, by] of [[w * 0.35, top - 30], [w * 0.62, top - 38], [w * 0.5, top - 24]]) {
      p.rect(bx, by, 2, 2, '#140c18');
      p.rect(bx - 3, by - 1, 3, 1, '#140c18');
      p.rect(bx + 2, by - 1, 3, 1, '#140c18');
    }
  });
  cache.set(key, art);
  return art;
}
