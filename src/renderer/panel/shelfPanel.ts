// The legends shelf (the Chronicle's Shelf tab): every rare thing this town has ever seen, kept like a collection. Each
// kind is a folded section with its count ("3 of 5 mythic lines"); each thing a tile, its picture when seen, a dark
// shape with a "?" while not. Hold a tile for its lore. All read from the snapshot's record (`snapshot.rare`,
// sim/rare.ts); the rare moments themselves are shown as they happen by the phone's reveal cards (mobile/revealCard.ts).

import { DEED_KINDS, DEED_TITLES } from '../../shared/data/deeds';
import { ENEMIES, type EnemyDef } from '../../shared/data/enemies';
import { MYTHIC_CALLINGS, mythicId } from '../../shared/data/mythic';
import { SAGAS } from '../../shared/data/sagas';
import { SPECIAL_IDS, SPECIALS } from '../../shared/data/specials';
import { UNIQUES } from '../../shared/data/uniques';
import { UNDER_DEPTHS } from '../../shared/data/underdark';
import type { RareView } from '../../shared/sim/rare';
import { creatureThumb } from '../art/creatureThumbs';
import { emblemCanvas } from '../art/emblems';
import { itemIcon } from '../art/icons';
import { icon } from '../ui/icon';
import { uniqueLore } from '../mobile/reveals';
import { el } from './dom';
import { foldSections } from './structure';

const EMPTY: RareView = { mythics: [], uniques: [], specials: [], sagas: [], dwellers: [], dragon: null, bosses: [], deeds: [] };
const TILE = 48;
const DRAGONS = ['dragon', 'rimewyrm', 'ashen_wyrm'];

/** The bosses the shelf counts: every foe with a boss's kit, but the dragon and the Underdark's dwellers (shelved on
 *  their own). */
export const SHELF_BOSSES: readonly EnemyDef[] = Object.values(ENEMIES).filter((e) => e.boss && e.kit && !DRAGONS.includes(e.id) && !UNDER_DEPTHS.some((d) => d.dweller === e.id));

/** What the shelf shows, for the Chronicle's redraw key. */
export const shelfKey = (r: RareView | undefined): string => (r ? [r.mythics.length, r.uniques.length, r.specials.length, r.sagas.length, r.dwellers.length, r.dragon?.phase ?? '', r.bosses.length, r.deeds.length].join('.') : '');

interface Tile {
  seen: boolean;
  name: string;
  /** The lore, held: the thing's own when seen, a hint when not. */
  tip: string;
  art: () => HTMLElement | null;
  /** A small line under the name (who, how it ended). */
  sub?: string;
  glow?: 'mythic' | 'unique' | 'dark';
}

export function renderShelf(rare: RareView | undefined): HTMLElement[] {
  const r = rare ?? EMPTY;
  const groups: [string, string, Tile[]][] = [];

  // the mythic callings, by tree
  const roads = new Map(r.mythics.map((m) => [m.road, m]));
  groups.push([
    'Mythic callings',
    'mythic lines',
    MYTHIC_CALLINGS.map((t) => {
      const m = roads.get(mythicId(t.base.id));
      return { seen: !!m, name: t.base.name, sub: m?.who ?? undefined, tip: m ? t.base.lore : 'A calling the old powers give to very few. None here has taken it yet.', art: () => emblemCanvas(mythicId(t.base.id), TILE), glow: 'mythic' };
    }),
  ]);
  // the unique weapons
  const found = new Set(r.uniques);
  groups.push([
    'Unique weapons',
    'found',
    UNIQUES.map((u) => ({ seen: found.has(u.id), name: u.name, tip: found.has(u.id) ? uniqueLore(u.id) : 'One of a kind, somewhere in the world: on a boss, at a quest\'s end, or waiting to be forged.', art: () => itemIcon(u, 3), glow: 'unique' })),
  ]);
  // the legends at the gate (the special newcomers found out)
  const known = new Map(r.specials.map((x) => [x.id, x]));
  groups.push([
    'Secrets at the gate',
    'found out',
    SPECIAL_IDS.map((id) => {
      const k = known.get(id);
      return { seen: !!k, name: SPECIALS[id].name, sub: k?.who ?? undefined, tip: k ? SPECIALS[id].truth.replace(/\{name\}/g, k.who ?? 'The newcomer') : 'Someone who came to the gate as a plain wanderer, and was not.', art: () => icon('people', 32) };
    }),
  ]);
  // the sagas finished
  const ended = new Map(r.sagas.map((g) => [g.id, g]));
  groups.push([
    'Sagas',
    'told to the end',
    SAGAS.map((g) => {
      const d = ended.get(g.id);
      return { seen: !!d, name: g.title, sub: d ? (d.outcome === 'triumph' ? 'a triumph' : d.outcome === 'bittersweet' ? 'bittersweet' : 'ruin') : undefined, tip: d ? `${g.blurb}${d.hero ? ` Its hero: ${d.hero}.` : ''}` : 'A story the town has not lived yet.', art: () => icon('quests', 32), glow: d?.outcome === 'ruin' ? 'dark' : undefined };
    }),
  ]);
  // the dwellers of the Underdark
  const slain = new Set(r.dwellers.map((d) => d.depth));
  groups.push([
    'Dwellers of the Underdark',
    'slain',
    UNDER_DEPTHS.map((d) => ({ seen: slain.has(d.n), name: ENEMIES[d.dweller]?.name ?? d.dweller, sub: d.name, tip: slain.has(d.n) ? `It guarded the way down through ${d.name}. ${d.blurb}` : `Something lives in the deep. ${d.blurb}`, art: () => (ENEMIES[d.dweller] ? creatureThumb(ENEMIES[d.dweller], TILE) : null), glow: 'dark' })),
  ]);
  // the dragon (this land's: one a town)
  const dk = r.dragon?.kind ?? 'dragon';
  const dead = r.dragon?.phase === 'slain';
  groups.push([
    'The Dragon',
    'seen',
    [{ seen: !!r.dragon, name: ENEMIES[dk]?.name ?? 'The Dragon', sub: dead ? 'slain' : r.dragon ? 'sighted' : undefined, tip: r.dragon ? (dead ? 'Slain. Its bones will be shown to children for a hundred years.' : 'It has seen the town.') : 'Most towns only ever hear of one in songs.', art: () => (ENEMIES[dk] ? creatureThumb(ENEMIES[dk], TILE) : null), glow: 'dark' }],
  ]);
  // the legendary deeds (each ladder's top title)
  const won = new Set(r.deeds);
  groups.push([
    'Legendary deeds',
    'won',
    DEED_KINDS.map((k) => {
      const ladder = DEED_TITLES[k];
      const [at, title] = ladder.steps[ladder.steps.length - 1];
      return { seen: won.has(title), name: title, sub: ladder.label, tip: `${ladder.label}: ${at}. ${won.has(title) ? 'Someone in this town has earned it.' : 'Nobody here has come so far yet.'}`, art: () => icon('age', 32) };
    }),
  ]);
  // the bosses slain
  const felled = new Set(r.bosses);
  groups.push([
    'Bosses',
    'slain',
    SHELF_BOSSES.map((e) => ({ seen: felled.has(e.id), name: e.name, tip: felled.has(e.id) ? (e.kit?.roar ?? `${e.name}, slain.`) : 'A great foe the town has not yet brought down.', art: () => creatureThumb(e, TILE) })),
  ]);

  const total = groups.reduce((n, g) => n + g[2].length, 0);
  const seen = groups.reduce((n, g) => n + g[2].filter((t) => t.seen).length, 0);
  const out: HTMLElement[] = [el('div', 'hint', `Every rare thing this town has ever seen: ${seen} of ${total}. Hold a tile for its story.`)];
  for (const [head, word, tiles] of groups) {
    const n = tiles.filter((t) => t.seen).length;
    out.push(el('h2', '', `${head}: ${n} of ${tiles.length} ${word}`));
    const grid = el('div', 'shelf-grid');
    // (the seen first, then the shapes still to find)
    for (const t of [...tiles.filter((x) => x.seen), ...tiles.filter((x) => !x.seen)]) grid.append(tile(t));
    out.push(grid);
  }
  addShelfStyles();
  return foldSections('journal-shelf', out);
}

function tile(t: Tile): HTMLElement {
  const c = el('div', `dash-card shelf-tile${t.seen ? ' seen' : ' unseen'}${t.seen && t.glow ? ` glow-${t.glow}` : ''}`);
  c.dataset.tip = t.seen ? `${t.name}: ${t.tip}` : t.tip;
  const pic = el('div', 'shelf-pic');
  const art = t.art();
  if (art) pic.append(art);
  if (!t.seen) pic.append(el('span', 'shelf-q', '?'));
  c.append(pic, el('div', 'shelf-name', t.seen ? t.name : '???'));
  if (t.seen && t.sub) c.append(el('div', 'shelf-sub', t.sub));
  return c;
}

let styled = false;
function addShelfStyles(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.textContent = `
.shelf-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 6px; }
.shelf-tile { align-items: center; text-align: center; min-height: 0; padding: 6px 4px; cursor: default; }
.shelf-pic { position: relative; display: flex; align-items: center; justify-content: center; width: ${TILE}px; height: ${TILE}px; overflow: hidden; }
.shelf-pic > canvas, .shelf-pic > span:not(.shelf-q), .shelf-pic > div, .shelf-pic > img { image-rendering: pixelated; max-width: ${TILE}px; max-height: ${TILE}px; }
.shelf-tile.unseen .shelf-pic > :not(.shelf-q) { filter: brightness(0) opacity(0.55); }
.shelf-q { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 20px; color: rgba(255, 240, 210, 0.75); }
.shelf-name { font-size: var(--ui-fs-small, 11.5px); line-height: 1.2; overflow-wrap: anywhere; }
.shelf-tile.unseen .shelf-name { opacity: 0.5; }
.shelf-sub { font-size: var(--ui-fs-label, 10.5px); opacity: 0.7; line-height: 1.2; }
.shelf-tile.glow-mythic { box-shadow: 0 0 8px #a070ff; border-color: #a070ff; }
.shelf-tile.glow-unique { box-shadow: 0 0 8px #f0b040; border-color: #f0b040; }
.shelf-tile.glow-dark { box-shadow: 0 0 8px #d04848; border-color: #d04848; }
`;
  document.head.append(st);
}
