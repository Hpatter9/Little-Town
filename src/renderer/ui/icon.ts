// One icon set (the owner's ask: every stat shown with its icon), from the sheets already in the game: DawnLike's item
// sheets (art/icons.ts) and its GUI sheet (ui/art/gui0.png: hearts, the small stat marks and the speech-bubble marks).
// `icon(name)` gives a pixelated span for a stat by its name ("food", "coins", "spirits"...), or null for an unknown one;
// `statIcon(label)` finds one from a menu's label ("Treasury", "Raid!").

import type { IconSheet } from '../../shared/data/items';
import { iconSheet } from '../art/icons';
import guiUrl from './art/gui0.png';

interface Cell {
  sheet: IconSheet | 'Gui';
  x: number;
  y: number;
}

/** The stats and their marks (16px cells). */
export const STAT_ICONS: Record<string, Cell> = {
  people: { sheet: 'Hat', x: 0, y: 1 },
  beds: { sheet: 'Gui', x: 10, y: 4 },
  food: { sheet: 'Food', x: 1, y: 4 },
  spirits: { sheet: 'Gui', x: 0, y: 1 },
  coins: { sheet: 'Money', x: 0, y: 0 },
  stores: { sheet: 'Chest0', x: 0, y: 1 },
  building: { sheet: 'ShortWep', x: 0, y: 3 },
  studying: { sheet: 'Book', x: 0, y: 0 },
  workshops: { sheet: 'Tool', x: 1, y: 1 },
  quests: { sheet: 'Scroll', x: 2, y: 5 },
  shops: { sheet: 'Chest0', x: 0, y: 0 },
  gods: { sheet: 'Amulet', x: 0, y: 0 },
  age: { sheet: 'Book', x: 0, y: 7 },
  raid: { sheet: 'ShortWep', x: 0, y: 0 },
  blood: { sheet: 'Potion', x: 0, y: 0 },
  skull: { sheet: 'Gui', x: 11, y: 3 },
  deep: { sheet: 'ShortWep', x: 0, y: 3 },
  day: { sheet: 'Gui', x: 5, y: 5 },
  night: { sheet: 'Light', x: 3, y: 0 },
  health: { sheet: 'Gui', x: 0, y: 5 },
  attack: { sheet: 'Gui', x: 2, y: 5 },
  defence: { sheet: 'Gui', x: 3, y: 5 },
  mana: { sheet: 'Gui', x: 4, y: 5 },
  speed: { sheet: 'Gui', x: 12, y: 4 },
  xp: { sheet: 'Gui', x: 1, y: 6 },
  loss: { sheet: 'Gui', x: 0, y: 6 },
  turn: { sheet: 'Gui', x: 11, y: 4 },
  good: { sheet: 'Gui', x: 12, y: 2 },
  evil: { sheet: 'Gui', x: 13, y: 2 },
  yes: { sheet: 'Gui', x: 10, y: 2 },
  no: { sheet: 'Gui', x: 11, y: 2 },
  news: { sheet: 'Gui', x: 13, y: 4 },
};

/** A menu's label to its stat ("Treasury" -> coins). */
const LABELS: Record<string, string> = {
  'raid!': 'raid', people: 'people', food: 'food', spirits: 'spirits', treasury: 'coins', stores: 'stores', building: 'building',
  studying: 'studying', workshops: 'workshops', quests: 'quests', shops: 'shops', gods: 'gods', age: 'age', blood: 'blood',
  fury: 'skull', 'the enemy': 'skull', 'the deep': 'deep', beds: 'beds', coins: 'coins', health: 'health', hp: 'health',
};

export const statOf = (label: string): string | null => LABELS[label.trim().toLowerCase()] ?? null;

/** A stat's mark, `size` px square (16 is the art's own; whole steps stay sharp). */
export function icon(name: string, size = 16): HTMLElement | null {
  const c = STAT_ICONS[name];
  if (!c) return null;
  const sheet = c.sheet === 'Gui' ? { url: guiUrl, cols: 16, rows: 19 } : { ...iconSheet(c.sheet), rows: 0 };
  const e = document.createElement('span');
  e.className = `ui-icon ui-icon-${name}`;
  const k = size / 16;
  const img = new Image();
  // (the sheet's height for the background's size: known for the GUI sheet, read off the item sheet once it's in)
  const place = (cols: number, rows: number) => {
    e.style.backgroundSize = `${cols * 16 * k}px ${rows * 16 * k}px`;
  };
  Object.assign(e.style, {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${sheet.url})`,
    backgroundPosition: `-${c.x * size}px -${c.y * size}px`,
  });
  if (sheet.rows) place(sheet.cols, sheet.rows);
  else {
    img.onload = () => place(Math.round(img.naturalWidth / 16), Math.round(img.naturalHeight / 16));
    img.src = sheet.url;
  }
  e.setAttribute('aria-hidden', 'true');
  return e;
}

/** A stat's mark by its menu label, or null. */
export const statIcon = (label: string, size = 16): HTMLElement | null => {
  const s = statOf(label);
  return s ? icon(s, size) : null;
};
