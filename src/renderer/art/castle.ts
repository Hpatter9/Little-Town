// A castle town's look (sim/castle.ts), Castlevania-style: the keep is cut open like a doll's house, so every room is
// seen in section, the stone floors between them and the outer walls hatched where the cut runs through them, and empty
// floor space left as dark open chambers under pointed arches. Over it, a broken skyline of gothic towers: round turrets
// of different heights with needle spires, a great tower with a rose window, flying buttresses, corbelled corner
// turrets on the stair towers, gargoyles and bats. The skyline is shaped from the keep's own span, so each town's castle
// is its own, and the same every time it's drawn.
//
// Every room is the same height; what's in it depends on what it is: coffins where people sleep, shelves of books
// where they study, anvils and a forge's glow where they work, a feasting table, cabinets of curiosities, sickbeds
// with bottles of blood, racks of arms, a chapel, humming machines.

import { TILE } from '../../shared/constants';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { paint, type Painter, type PixelArt, type Tone } from './pixelArt';

import { PLINTH, ROOF_H, ROOM_H, TOWER_W } from '../../shared/sim/castle';

export { PLINTH, ROOF_H, ROOM_H, TOWER_W };

/** The keep's picture reaches this far past its towers on each side: the crag it stands on, and its flanking towers. */
export const KEEP_MARGIN_X = 44;

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
const CUT = '#3a2c3c';
const CUT_LINE = '#55445a';
const GLOOM = '#140e18';

/** Stone cut through (the floors between rooms, the outer walls): hatched, as a drawing shows a section. */
function section(p: Painter, x: number, y: number, w: number, h: number): void {
  p.rect(x, y, w, h, CUT);
  for (let k = -h; k < w; k += 3) for (let j = 0; j < h; j++) if (k + j >= 0 && k + j < w) p.px(x + k + j, y + h - 1 - j, CUT_LINE);
  p.rect(x, y, w, 1, STONE_LIGHT); // (the cut edge catches the light)
}

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
    // seen in section: the stone floor above cut through (hatched), the back wall of dressed stone, darker into the
    // corners and up under the ceiling, the oak floor, and the walls between rooms cut through too
    p.rect(0, 0, w, h, WALL);
    for (let y = 6; y < floor; y += 6) for (let x = (y / 6) % 2 ? 0 : -5; x < w; x += 10) p.rect(Math.max(0, x), y, 1, 6, WALL_LINE);
    for (let y = 6; y < floor; y += 6) p.rect(0, y, w, 1, WALL_LINE);
    p.rect(0, 5, w, 4, GLOOM); // (shadow under the ceiling)
    p.rect(0, 9, w, 2, '#1e1624');
    for (let k = 0; k < 6; k++) {
      p.rect(3 + k, 5, 1, floor - 5, k < 3 ? GLOOM : '#1e1624'); // (and into the corners)
      p.rect(w - 4 - k, 5, 1, floor - 5, k < 3 ? GLOOM : '#1e1624');
    }
    section(p, 0, 0, w, 5);
    for (let x = 10; x < w - 6; x += 18) p.rect(x, 5, 3, 3, '#3a2214'); // beam ends under the ceiling
    p.rect(0, floor, w, 3, OAK_LIGHT);
    for (let x = 4; x < w; x += 9) p.rect(x, floor + 1, 1, 2, OAK);
    p.rect(0, floor + 2, w, 1, OAK);
    section(p, 0, 0, 3, h);
    section(p, w - 3, 0, 3, h);
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

/** A painter that draws everything `dx` pixels to the right (the keep laid out from its own edge, inside margins). */
function shifted(p: Painter, dx: number): Painter {
  return {
    rect: (x: number, y: number, w: number, h: number, c: string) => p.rect(x + dx, y, w, h, c),
    px: (x: number, y: number, c: string) => p.px(x + dx, y, c),
    ellipse: (cx: number, cy: number, rx: number, ry: number, c: string) => p.ellipse(cx + dx, cy, rx, ry, c),
    disc: (cx: number, cy: number, r: number, c: string) => p.disc(cx + dx, cy, r, c),
  } as unknown as Painter;
}

/** How far left of the keep's ground floor (its first tile) the keep's picture reaches before its margin: the stair
 *  tower, or the top floor's reach if that's further. */
export const keepLeft = (floors: number, flare: number) => Math.max(TOWER_W, flare * Math.max(0, floors - 1) * TILE);

/** A small seeded random stream: the keep's skyline is drawn the same every time for the same span. */
function seeded(seed: number): () => number {
  let a = seed >>> 0 || 1;
  return () => {
    a = (Math.imul(a, 1664525) + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

/** A round tower: shaded like a cylinder (moonlit on the left), courses of stone, a corbelled ring under its top, a
 *  lancet window or two, and a needle spire. */
function turret(p: Painter, cx: number, base: number, half: number, height: number, spire: number, glass: string, glassLight: string, flag: boolean): void {
  const top = base - height;
  for (let dx = -half; dx < half; dx++) {
    const t = (dx + half) / (2 * half);
    p.rect(cx + dx, top, 1, height, t < 0.18 ? STONE_LIGHT : t > 0.7 ? STONE_DARK : STONE);
  }
  for (let y = top + 4; y < base; y += 5) p.rect(cx - half, y, half * 2, 1, STONE_DARK);
  p.rect(cx - half, top, 1, height, MOON); // (moonlight on its edge)
  // a corbelled ring, and a crown of little merlons
  p.rect(cx - half - 1, top - 3, half * 2 + 2, 3, STONE_LIGHT);
  for (let x = cx - half; x < cx + half; x += 3) p.px(x, top, STONE_DARK);
  if (height > 22) gothicWindow(p, Math.round(cx - 2), top + 7, 4, Math.min(14, height - 12), glass, glassLight);
  if (height > 48) gothicWindow(p, Math.round(cx - 2), top + 26, 4, 10, '#120c14', '#2a1a2a');
  // a steep slate spire, a finial and maybe a pennon
  for (let y = 0; y <= spire; y++) {
    const hw = Math.max(0.5, ((half + 2) * y) / spire);
    p.rect(cx - hw, top - 3 - spire + y, hw, 1, SLATE);
    p.rect(cx, top - 3 - spire + y, hw, 1, SLATE_DARK);
    if (y % 6 === 3) p.rect(cx - hw, top - 3 - spire + y, hw * 2, 1, '#3a3044'); // (slates in courses)
  }
  p.rect(cx - 0.5, top - 3 - spire - 6, 1, 6, GOLD);
  p.px(cx - 1, top - 3 - spire - 4, GOLD);
  p.px(cx + 1, top - 3 - spire - 4, GOLD);
  if (flag) pennon(p, cx, top - 3 - spire - 16, 7);
}

/** A flying buttress: a stone arm leaping from a tower's flank down to the keep's roof. */
function buttress(p: Painter, x0: number, y0: number, x1: number, y1: number): void {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n;
    const y = y0 + ((y1 - y0) * i) / n;
    p.rect(Math.round(x), Math.round(y), 2, 3, STONE);
    p.px(Math.round(x), Math.round(y), STONE_LIGHT);
  }
  p.rect(Math.min(x0, x1) + Math.abs(x1 - x0) / 2, y0 + (y1 - y0) / 2 + 3, 1, 2, STONE_DARK); // (the arch's shadow)
}

/** A gargoyle hunched on a corner, looking out. */
function gargoyle(p: Painter, x: number, y: number, dir: 1 | -1): void {
  p.rect(x, y - 4, 5, 4, STONE_DARK);
  p.rect(x + (dir > 0 ? 4 : -2), y - 6, 3, 3, STONE_DARK); // the head
  p.px(x + (dir > 0 ? 6 : -2), y - 5, BLOOD_LIGHT); // an eye
  p.rect(x + (dir > 0 ? -2 : 4), y - 8, 3, 4, STONE_DARK); // a folded wing
}

/** A great rose window: spokes of stone in a round of red glass. */
function roseWindow(p: Painter, cx: number, cy: number, r: number): void {
  p.disc(cx, cy, r + 1.5, STONE_DARK);
  p.disc(cx, cy, r, BLOOD);
  p.disc(cx, cy, r * 0.45, BLOOD_LIGHT);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    for (let t = 1; t < r; t++) p.px(Math.round(cx + Math.cos(a) * t), Math.round(cy + Math.sin(a) * t), STONE_DARK);
  }
  p.disc(cx, cy, 1.2, GOLD);
}

/** The keep for `floors` floors over the tiles [lo, hi): everything but the rooms (drawn over it). Its left edge is
 *  TOWER_W left of `lo`; its bottom is the ground. Cut open: where there's no room yet, an empty chamber. */
export function keepArt(lo: number, hi: number, floors: number, tone: Tone, toneKey: string, flare = 0): PixelArt {
  const key = `keep3|${lo}|${hi}|${floors}|${flare}|${toneKey}`;
  let art = cache.get(key);
  if (art) return art;
  const inner = (hi - lo) * TILE;
  const M = KEEP_MARGIN_X;
  // (each floor up reaches `flare` tiles further out on each side: the top floor's reach past the ground floor, and
  // the crown spread across the top floor)
  const ext = flare * (floors - 1) * TILE;
  const L = keepLeft(floors, flare);
  const topL = TOWER_W - ext;
  const topW = inner + 2 * ext;
  const w = inner + TOWER_W * 2;
  const bodyH = floors * ROOM_H + PLINTH;
  const h = bodyH + ROOF_H + 26;
  const rnd = seeded(lo * 7919 + hi * 104729);
  art = paint(inner + 2 * L + M * 2, h, tone, (q) => {
    // (everything is laid out from the keep's own left edge; the crag and flanking towers spill into the margins)
    const p = shifted(q, M + L - TOWER_W);
    const ground = h;
    const top = ground - bodyH;
    const crown = top - 6; // (the roof's stone cut through, over the top floor)

    // far behind: the dark shapes of more spires, for depth
    for (let k = 0; k < 4; k++) {
      const fx = topL + topW * (0.15 + 0.23 * k) + rnd() * 20;
      const fh = 30 + rnd() * 40;
      p.rect(fx - 5, crown - fh, 10, fh, '#221a28');
      for (let y = 0; y < 24; y++) p.rect(fx - (6 * y) / 24, crown - fh - 24 + y, (12 * y) / 24, 1, '#1c1622');
    }

    // a great hall's steep roof behind the battlements, with lit dormers and iron cresting
    const hallW = Math.max(56, topW * 0.28);
    const hx = topL + topW * (0.15 + rnd() * 0.5);
    const hallH = Math.min(ROOF_H - 14, hallW * 1.1);
    for (let y = 0; y < hallH; y++) {
      const half = (hallW / 2) * ((y + 1) / hallH);
      p.rect(hx + hallW / 2 - half, crown - hallH + y, half, 1, SLATE);
      p.rect(hx + hallW / 2, crown - hallH + y, half, 1, SLATE_DARK);
      if (y % 5 === 2) p.rect(hx + hallW / 2 - half, crown - hallH + y, half * 2, 1, '#3a3044');
    }
    for (let x = hx + 10; x < hx + hallW - 10; x += 4) p.rect(x, crown - hallH - 3 + Math.abs(x - hx - hallW / 2) * (hallH / (hallW / 2)), 1, 3, IRON);
    for (const d of [-0.22, 0.22]) {
      const dx = hx + hallW / 2 + d * hallW;
      gothicWindow(p, dx - 3, crown - hallH * 0.42, 6, 10, BLOOD, BLOOD_LIGHT);
    }

    // the body, cut open: on every floor an empty chamber (dark, its back wall arched), the stone floors between
    // hatched where the cut runs through them; the rooms are drawn over it where they are
    for (let f = 0; f < floors; f++) {
      const y0 = ground - PLINTH - (f + 1) * ROOM_H;
      const fx0 = TOWER_W - f * flare * TILE;
      const fw = inner + 2 * f * flare * TILE;
      p.rect(fx0, y0, fw, ROOM_H, '#1c1420');
      for (let x = fx0 + 6; x < fx0 + fw - 20; x += 34) {
        // a pointed arch on the back wall, an alcove in shadow
        const aw = 18;
        const ay = y0 + 14;
        for (let i = 0; i < aw / 2; i++) p.rect(x + aw / 2 - i - 1, ay + i * 0.8, (i + 1) * 2, 1, '#2c2230');
        p.rect(x, ay + (aw / 2) * 0.8, aw, ROOM_H - 20 - (aw / 2) * 0.8, '#2c2230');
        p.rect(x + 3, ay + (aw / 2) * 0.8 + 2, aw - 6, ROOM_H - 24 - (aw / 2) * 0.8, '#120c14');
      }
      p.rect(fx0, y0 + ROOM_H - 3, fw, 3, STONE_DARK); // (bare floor)
      section(p, fx0, y0, fw, 5);
      if (f > 0 && flare) {
        // the outer walls cut through, and corbels under the floor where it reaches out past the one below
        section(p, fx0, y0, 3, ROOM_H);
        section(p, fx0 + fw - 3, y0, 3, ROOM_H);
        for (const [cx0, dir] of [[fx0, 1], [fx0 + fw, -1]] as const) {
          for (let k = 0; k < flare * TILE; k += 8) {
            const bx = cx0 + dir * k + (dir < 0 ? -6 : 0);
            for (let j = 0; j < 4; j++) p.rect(bx + (dir > 0 ? j : 0), y0 + ROOM_H + j * 2, 6 - j, 2, j ? STONE_DARK : STONE_LIGHT);
          }
        }
      }
    }
    // the roof over the top floor, cut through, and battlements on it (gaps where towers stand)
    section(p, topL, crown, topW, 7);
    for (let x = topL; x < topL + topW; x += 8) {
      const mh = 4 + ((x * 13) % 3);
      p.rect(x, crown - mh, 5, mh, STONE);
      p.px(x, crown - mh, STONE_LIGHT);
    }
    // little pointed gables along the battlements, each with a slit of light
    for (let x = topL + 20 + rnd() * 20; x < topL + topW - 24; x += 46 + rnd() * 20) {
      for (let y = 0; y < 14; y++) p.rect(x + 9 - (y * 9) / 14, crown - 4 - 14 + y, (y * 18) / 14, 1, y < 2 ? STONE_LIGHT : STONE);
      p.rect(x + 8, crown - 12, 2, 6, '#c05030');
      p.rect(x + 8.5, crown - 22, 1, 4, IRON); // a spike on the gable
    }
    // the plinth
    section(p, TOWER_W - 2, ground - PLINTH, inner + 4, PLINTH);

    // round turrets along the roof, of different heights, some joined to the keep by flying buttresses, and the great
    // tower among them with its rose window
    const greatX = topL + topW * (0.3 + rnd() * 0.4);
    const count = Math.max(3, Math.floor(topW / 70));
    const spots: number[] = [];
    for (let k = 0; k < count; k++) {
      const x = topL + 16 + ((topW - 32) * (k + 0.5)) / count + (rnd() - 0.5) * 30;
      if (Math.abs(x - greatX) > 34) spots.push(x);
    }
    for (const x of spots) {
      const half = 6 + Math.round(rnd() * 6);
      const tall = 24 + Math.round(rnd() * (ROOF_H - 56));
      const spire = Math.round(half * (2.2 + rnd() * 1.6));
      turret(p, x, crown, half, tall, spire, MOON, MOON_LIGHT, rnd() < 0.5);
      if (tall > 40) buttress(p, x + (x < greatX ? half : -half), crown - tall * 0.55, x + (x < greatX ? half + 14 : -half - 14), crown - 2);
    }
    const gHalf = 15;
    const gTall = ROOF_H - 22;
    turret(p, greatX, crown, gHalf, gTall, 30, BLOOD, BLOOD_LIGHT, true);
    roseWindow(p, greatX, crown - gTall + 24, 7);
    for (let y = crown - gTall + 40; y < crown - 8; y += 14) gothicWindow(p, greatX - 3, y, 6, 9, MOON, MOON_LIGHT);
    for (const d of [-1, 1] as const) {
      // pinnacles at the great tower's shoulders
      const px = greatX + d * (gHalf + 1);
      p.rect(px - 1, crown - gTall - 8, 3, 8, STONE);
      for (let y = 0; y < 8; y++) p.rect(px - y / 8, crown - gTall - 16 + y, 1 + (2 * y) / 8, 1, SLATE);
    }

    // the crag the castle stands on, spilling out on either side, and on it a great round flanking tower each side,
    // buttressed to the keep
    for (const side of [-1, 1] as const) {
      const edge = side < 0 ? 0 : w; // (the keep's outer edge on this side)
      const out = edge + side * M;
      const cragH = 26 + Math.round(rnd() * 18);
      for (let x = 0; x < M + 4; x++) {
        const at = edge + side * (x - 4);
        const t = x / (M + 4);
        const top2 = ground - cragH * (1 - t * t) - Math.round(((x * 7) % 5) - 2);
        p.rect(at, top2, 1, ground - top2, x % 3 === 0 ? '#2a2228' : '#332a30');
        if ((x * 11) % 7 === 0) p.rect(at, top2 + 4, 1, 3, '#43383e');
        p.px(at, top2, '#4a4048');
      }
      if (flare) continue; // (a flaring keep's upper floors reach out over where these would stand)
      const fx = out - side * (M / 2 + 2);
      const fBase = ground - cragH + 6;
      const fTall = Math.round(bodyH * (0.45 + rnd() * 0.25));
      turret(p, fx, fBase, 11, fTall, 30 + Math.round(rnd() * 12), MOON, MOON_LIGHT, rnd() < 0.6);
      for (let k = 0; k < 3; k++) gothicWindow(p, fx - 2, fBase - fTall + 30 + k * 22, 4, 9, k === 1 ? '#c05030' : '#120c14', '#2a1a2a');
      buttress(p, fx - side * 11, fBase - fTall * 0.6, edge + side * -2, fBase - fTall * 0.6 + 18);
      buttress(p, fx - side * 11, fBase - fTall * 0.3, edge + side * -2, fBase - fTall * 0.3 + 14);
    }

    // the stair towers at the ends: taller than the keep (one more than the other), open to view so the steps show
    // (people and raiders climb here: sim/castle.ts moveOnFloors), with a corbelled corner turret hanging off each
    for (const [tx, side] of [[0, -1], [w - TOWER_W, 1]] as const) {
      const tTop = top - 26 - Math.round(rnd() * 22);
      blocks(p, tx, tTop, TOWER_W, ground - tTop);
      for (let y = tTop; y < ground; y++) p.px(side < 0 ? tx : tx + TOWER_W - 1, y, side < 0 ? MOON : STONE_DARK);
      p.rect(tx, tTop, TOWER_W, 2, STONE_LIGHT);
      for (let x = tx; x < tx + TOWER_W; x += 6) p.rect(x, tTop - 4, 4, 4, STONE);
      const sx0 = tx + 4;
      const sw = TOWER_W - 8;
      const shaftTop = ground - PLINTH - floors * ROOM_H + 6;
      p.rect(sx0, shaftTop, sw, ground - PLINTH - shaftTop, '#1a1016');
      section(p, sx0 - 1, shaftTop, 1, ground - PLINTH - shaftTop);
      section(p, sx0 + sw, shaftTop, 1, ground - PLINTH - shaftTop);
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
        p.px(side < 0 ? sx0 + sw - 2 : sx0 + 1, base - 12, '#f0a040'); // a torch on each landing
        p.px(side < 0 ? sx0 + sw - 2 : sx0 + 1, base - 13, '#f06030');
      }
      p.rect(sx0, shaftTop - 1, sw, 1, STONE_LIGHT);
      gothicWindow(p, tx + TOWER_W / 2 - 3, tTop + 6, 6, 12, MOON, MOON_LIGHT);
      cone(p, tx + TOWER_W / 2, tTop - 4, TOWER_W / 2 + 2, 34 + Math.round(rnd() * 10));
      pennon(p, tx + TOWER_W / 2 + (side > 0 ? 0 : -1), tTop - 54, 9);
      // the corner turret, hung out over the drop on corbels (on a straight keep; a flaring one has its great corner
      // towers up top instead)
      const bx = side < 0 ? tx + 4 : tx + TOWER_W - 4;
      if (!flare) {
        for (let k = 0; k < 4; k++) p.rect(bx - 4 + k, tTop + 20 + k * 2, 8 - k * 2, 2, STONE_DARK);
        turret(p, bx, tTop + 20, 4, 14, 14, MOON, MOON_LIGHT, false);
      }
      gargoyle(p, side < 0 ? topL + 2 : topL + topW - 7, crown - 1, side < 0 ? -1 : 1);
    }
    // a flaring keep's great corner towers: rising from the ends of its widest floor, the tallest of the skyline
    if (flare) {
      for (const side of [-1, 1] as const) {
        const cx = side < 0 ? topL + 12 : topL + topW - 12;
        turret(p, cx, crown, 12, ROOF_H - 28 - Math.round(rnd() * 12), 34 + Math.round(rnd() * 10), MOON, MOON_LIGHT, true);
        buttress(p, cx - side * 12, crown - 30, cx - side * 26, crown - 2);
      }
    }
    // a great door at the foot of each tower (the way in, for townsfolk and raiders alike): pointed, iron-banded
    for (const tx of [0, w - TOWER_W]) {
      const dx = tx + TOWER_W / 2 - 5;
      for (let i = 0; i < 5; i++) p.rect(dx + 5 - i - 1, ground - 20 + i, (i + 1) * 2, 1, '#1a0e0a');
      p.rect(dx, ground - 15, 10, 15, '#1a0e0a');
      p.rect(dx, ground - 11, 10, 1, IRON);
      p.rect(dx, ground - 5, 10, 1, IRON);
      p.rect(dx + 4.5, ground - 19, 1, 19, '#3a2418');
    }
    // bats about the spires
    for (let k = 0; k < 5; k++) {
      const bx = topL + rnd() * topW;
      const by = crown - 20 - rnd() * (ROOF_H - 10);
      p.rect(bx, by, 2, 2, '#140c18');
      p.rect(bx - 3, by - 1, 3, 1, '#140c18');
      p.rect(bx + 2, by - 1, 3, 1, '#140c18');
    }
  });
  cache.set(key, art);
  return art;
}
