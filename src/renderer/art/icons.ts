// Item icons from the DawnLike tileset (16px cells; see CREDITS.md), drawn as CSS sprites so the panels
// and the strip's DOM cards can use them without a canvas.

import type { IconSheet, ItemDef } from '../../shared/data/items';
import Ammo from './items/Ammo.png';
import Amulet from './items/Amulet.png';
import Chest1 from './items/Chest1.png';
import Money from './items/Money.png';
import Scroll from './items/Scroll.png';
import Armor from './items/Armor.png';
import Chest0 from './items/Chest0.png';
import Flesh from './items/Flesh.png';
import Food from './items/Food.png';
import Hat from './items/Hat.png';
import Light from './items/Light.png';
import LongWep from './items/LongWep.png';
import MedWep from './items/MedWep.png';
import Potion from './items/Potion.png';
import Reptile0 from './items/Reptile0.png';
import Rock from './items/Rock.png';
import Shield from './items/Shield.png';
import ShortWep from './items/ShortWep.png';
import Tool from './items/Tool.png';
import Magic from './items/Magic.png';
import Wand from './items/Wand.png';
import Ring from './items/Ring.png';
import Plate from './items/plate.png';
import Book from './items/Book.png';
import Music from './items/Music.png';
import { CUSTOM_ORDER, CUSTOM_ROWS, customSheetUrl } from './customIcons';

const CELL = 16;
/** Sheet sizes in cells (all 8 wide). */
const SHEETS: Record<IconSheet, { url: string; rows: number; cols?: number }> = {
  ShortWep: { url: ShortWep, rows: 5 },
  MedWep: { url: MedWep, rows: 2 },
  LongWep: { url: LongWep, rows: 7 },
  Tool: { url: Tool, rows: 3 },
  Rock: { url: Rock, rows: 2 },
  Shield: { url: Shield, rows: 1 },
  Hat: { url: Hat, rows: 4 },
  Armor: { url: Armor, rows: 9 },
  Amulet: { url: Amulet, rows: 3 },
  Light: { url: Light, rows: 1 },
  Potion: { url: Potion, rows: 5 },
  Chest0: { url: Chest0, rows: 3 },
  Food: { url: Food, rows: 6 },
  Flesh: { url: Flesh, rows: 9 },
  Money: { url: Money, rows: 8 },
  Ammo: { url: Ammo, rows: 6 },
  Wand: { url: Wand, rows: 7 },
  Ring: { url: Ring, rows: 6 },
  Scroll: { url: Scroll, rows: 6 },
  Chest1: { url: Chest1, rows: 3 },
  Custom: { url: '', rows: CUSTOM_ROWS },
  Magic: { url: Magic, rows: 5, cols: 9 },
  Book: { url: Book, rows: 9 },
  Music: { url: Music, rows: 6 },
  Plate: { url: Plate, rows: 1, cols: 1 }, // (DungeonItemsLite's dark plate armour, one big cell) // (Magic Items pack: rings, amulets, wands, tomes) // (built in code: see customIcons.ts)
};

/** A sheet's image and its columns, for drawing a cell on a canvas (the class emblems: art/emblems.ts). */
export const iconSheet = (sheet: IconSheet) => ({ url: SHEETS[sheet].url, cols: SHEETS[sheet].cols ?? 8, cell: CELL });

/** DawnLike's author asks that Platino be hidden somewhere in every game that uses the tileset. */
export function platino(): HTMLElement {
  const e = document.createElement('span');
  Object.assign(e.style, {
    display: 'block',
    margin: '14px auto 0',
    width: '16px',
    height: '16px',
    backgroundImage: `url(${Reptile0})`,
    backgroundPosition: '-48px -192px',
    imageRendering: 'pixelated',
    opacity: '0.5',
  });
  e.title = 'Platino';
  return e;
}

/** Where an item's icon is, for drawing on a canvas: the sheet's url and the cell (16px) in it; `whole` for a sheet
 *  that is one big picture. */
export function iconSpot(def: Pick<ItemDef, 'icon' | 'hue'>): { url: string; sx: number; sy: number; whole: boolean; hue?: number } {
  const sheet = SHEETS[def.icon.sheet];
  const custom = def.icon.sheet === 'Custom' ? Math.max(0, CUSTOM_ORDER.indexOf(def.icon.name ?? '')) : -1;
  const cx = custom >= 0 ? custom % 8 : def.icon.x;
  const cy = custom >= 0 ? Math.floor(custom / 8) : def.icon.y;
  return { url: custom >= 0 ? customSheetUrl() : sheet.url, sx: cx * CELL, sy: cy * CELL, whole: (sheet.cols ?? 8) === 1 && sheet.rows === 1, hue: def.hue };
}

/** A pixelated icon element for an item, `scale` times its 16px size. */
export function itemIcon(def: ItemDef, scale = 2): HTMLElement {
  const sheet = SHEETS[def.icon.sheet];
  // code-drawn icons are found by name
  const custom = def.icon.sheet === 'Custom' ? Math.max(0, CUSTOM_ORDER.indexOf(def.icon.name ?? '')) : -1;
  const cx = custom >= 0 ? custom % 8 : def.icon.x;
  const cy = custom >= 0 ? Math.floor(custom / 8) : def.icon.y;
  const e = document.createElement('span');
  e.className = 'item-icon';
  const size = CELL * scale;
  Object.assign(e.style, {
    display: 'inline-block',
    flex: 'none',
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${custom >= 0 ? customSheetUrl() : sheet.url})`,
    backgroundSize: `${(sheet.cols ?? 8) * size}px ${sheet.rows * size}px`,
    backgroundPosition: `-${cx * size}px -${cy * size}px`,
    imageRendering: 'pixelated',
    // (armour sharing an icon is told apart by its colour)
    ...(def.hue ? { filter: `hue-rotate(${def.hue}deg) saturate(1.15)` } : {}),
  });
  e.title = def.name;
  return e;
}
