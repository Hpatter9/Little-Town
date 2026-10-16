// The New Town screen's choices as tiles (the owner's ask): each choice is a symbol with its name beneath, in a grid;
// tapping one opens a description sheet (from the bottom on the phone, at the side when it's held sideways) with a scene
// that stands for the choice, the text, and Choose / Close. The scenes are slices of the parallax backdrops in
// art/backdrops (their layers stacked far to near, as the fights use them) with the people's own figures standing in them.

import type { IconSheet } from '../../shared/data/items';
import type { OriginId } from '../../shared/data/origins';
import type { Biome, Difficulty } from '../../shared/data/biomes';
import manifest from '../art/backdrops.json';
import { iconSheet } from '../art/icons';
import { button, el } from './dom';

/* ------------------------------------------------------------ which scene and symbol stand for what */

/** A backdrop (art/backdrops/<id>.webp) for each people, land, scenario and danger. */
export const ORIGIN_SCENE: Record<OriginId, string> = {
  settlers: 'summer_1',
  lich: 'battle_graves',
  druid: 'forest_1',
  vampire: 'moon_3',
  werewolf: 'moon_2',
  robot: 'industrial_day',
  dwarves: 'crystal_2',
  merfolk: 'underwater_1',
  nomads: 'oasis_1',
  fae: 'forest_5',
  alchemists: 'steampunk_3',
  knights: 'battle_hall',
  orcs: 'wasteland_3',
};
export const BIOME_SCENE: Record<Biome, string> = {
  forest: 'forest_4',
  desert: 'oasis_3',
  tundra: 'snowfield_1',
  coast: 'ocean_3',
  swamp: 'abandoned_3',
  jungle: 'battle_jungle',
  highlands: 'peaks_2',
  ashlands: 'meadows_4',
  steppe: 'summer_2',
  taiga: 'winter_1',
};
export const DANGER_SCENE: Record<Difficulty, string> = { easy: 'summer_4', normal: 'skies_2', hard: 'skies_4' };
export const SCENARIO_SCENE = 'summer_2';

type Glyph = [IconSheet, number, number];
/** A DawnLike cell (sheet, column, row) for each symbol. */
export const ORIGIN_GLYPH: Record<OriginId, Glyph> = {
  settlers: ['Tool', 1, 1],
  lich: ['Amulet', 1, 0],
  druid: ['Food', 4, 0],
  vampire: ['Potion', 0, 0],
  werewolf: ['Flesh', 1, 3],
  robot: ['Tool', 3, 0],
  dwarves: ['ShortWep', 1, 3],
  merfolk: ['Light', 2, 0],
  nomads: ['Light', 3, 0],
  fae: ['Wand', 2, 0],
  alchemists: ['Potion', 2, 0],
  knights: ['Shield', 1, 0],
  orcs: ['MedWep', 1, 1],
};
export const SCENARIO_GLYPH: Record<string, Glyph> = {
  lone: ['Food', 7, 2],
  band: ['Shield', 4, 0],
  tribe: ['Music', 0, 2],
  supplied: ['Chest0', 0, 0],
};
export const DANGER_GLYPH: Record<Difficulty, Glyph> = { easy: ['Shield', 1, 0], normal: ['MedWep', 0, 0], hard: ['ShortWep', 0, 4] };

/* ------------------------------------------------------------ pieces */

/** A backdrop as stacked layers (far to near), filling its box at 16:9. */
export function scene(id: string): HTMLElement {
  const box = el('div', 'nt-scene');
  const n = (manifest as Record<string, { layers: number }>)[id]?.layers ?? 1;
  for (let i = 0; i < n; i++) {
    const l = el('div', 'nt-layer');
    l.style.backgroundImage = `url(backdrops/${id}.webp)`;
    l.style.backgroundSize = `100% ${n * 100}%`;
    l.style.backgroundPosition = `0 ${n > 1 ? (i / (n - 1)) * 100 : 0}%`;
    box.append(l);
  }
  return box;
}

/** A scene with figures (canvases or other elements) standing along its foot, left to right. */
export function sceneWith(id: string, figures: HTMLElement[]): HTMLElement {
  const s = scene(id);
  const row = el('div', 'nt-figures');
  for (const f of figures) {
    f.classList.add('nt-figure');
    row.append(f);
  }
  s.append(row);
  return s;
}

/** A symbol: a DawnLike cell on a dark badge. */
export function glyphSymbol([sheet, x, y]: Glyph): HTMLElement {
  const g = iconSheet(sheet);
  const size = g.cell * 3;
  const sym = el('span', 'nt-sym');
  const ic = el('span', 'nt-glyph');
  Object.assign(ic.style, {
    width: `${size}px`,
    height: `${size}px`,
    backgroundImage: `url(${g.url})`,
    backgroundSize: `${g.cols * size}px auto`,
    backgroundPosition: `-${x * size}px -${y * size}px`,
  });
  sym.append(ic);
  return sym;
}
/** A symbol made of a round slice of a backdrop (the lands). */
export const sceneSymbol = (id: string): HTMLElement => {
  const sym = el('span', 'nt-sym land');
  sym.append(scene(id));
  return sym;
};
/** A symbol that is a figure (the founders). */
export const figureSymbol = (fig: HTMLElement): HTMLElement => {
  const sym = el('span', 'nt-sym figure');
  sym.append(fig);
  return sym;
};

/* ------------------------------------------------------------ the grid and the sheet */

export interface Tile {
  id: string;
  name: string;
  symbol: () => HTMLElement;
  /** What the sheet shows: made when it opens. */
  scene: () => HTMLElement;
  /** The sheet's text, a line a paragraph. */
  lines: () => string[];
}

let open: HTMLElement | null = null;
export const closeSheet = (): void => {
  open?.remove();
  open = null;
};

function openSheet(t: Tile, chosen: boolean, choose: () => void): void {
  closeSheet();
  const back = el('div', 'nt-back');
  const sheet = el('div', 'nt-sheet');
  const body = el('div', 'nt-sheet-body');
  body.append(t.scene(), el('h3', 'nt-sheet-name', t.name), ...t.lines().map((l) => el('p', 'nt-sheet-text', l)));
  const nav = el('div', 'row nt-sheet-nav');
  nav.append(
    button('Close', closeSheet, { cls: 'place quiet' }),
    button(chosen ? 'Chosen ✓' : 'Choose', () => (choose(), closeSheet()), { cls: 'place next nt-choose' }),
  );
  sheet.append(body, nav);
  back.append(sheet);
  back.addEventListener('click', (e) => {
    if (e.target === back) closeSheet();
  });
  open = back;
  document.body.append(back);
}

/** A grid of tiles, the chosen one framed; a tap opens its sheet, and Choose there calls `onChoose`. */
export function tileGrid(tiles: Tile[], chosen: string, onChoose: (id: string) => void): HTMLElement {
  const grid = el('div', 'nt-grid');
  for (const t of tiles) {
    const on = t.id === chosen;
    const b = el('button', `nt-tile${on ? ' on' : ''}`);
    b.append(t.symbol(), el('span', 'nt-name', t.name));
    b.addEventListener('click', () => openSheet(t, on, () => onChoose(t.id)));
    grid.append(b);
  }
  return grid;
}
