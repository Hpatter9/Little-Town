// Crafting panel: the craft queue, the spare items in town, and every recipe by station.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { eraReached } from '../../shared/data/eras';
import { ITEM_BY_ID, ITEMS, SLOT_NAMES, STATIONS, type ItemDef } from '../../shared/data/items';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { CraftOrderView, Snapshot } from '../../shared/sim/snapshot';
import { craftSeconds } from '../../shared/sim/crafting';
import { itemIcon } from '../art/icons';
import { materialIcon, stockIcon } from '../art/materialIcons';
import { FOOD_VALUE } from '../../shared/data/people';
import { duration, el } from './dom';
import { hiddenNote, HidePrefs } from './hide';
import { topicKnown } from './secrets';
import { expandable, itemDetails, materialDetails, pickable, pickedIn } from './details';

/** Changes whenever something this panel shows changes (progress to the whole percent). */
export const craftingKey = (s: Snapshot) =>
  JSON.stringify([
    hide.key,
    s.era,
    s.craftSlots,
    s.stock,
    s.items,
    s.unlockAll,
    s.research.done,
    s.research.revealed,
    s.crafting.map((o) => [o.id, o.count, Math.floor(o.progress * 100), o.waiting, o.crafter, o.needed]),
    s.buildings.filter((b) => b.status === 'done').map((b) => b.def),
    s.people.map((p) => p.gear),
  ]);

/** The Town's Stores: how full the stores are, and everything in them (and worn), with a tab for each kind. */
export function renderStores(s: Snapshot, rerender: () => void = () => {}): HTMLElement[] {
  const worn = new Map<string, number>();
  for (const p of s.people) for (const id of Object.values(p.gear)) worn.set(id!, (worn.get(id!) ?? 0) + 1);
  const fill = el('div', 'bar');
  const f = el('div', s.storageUsed >= s.storageCapacity * 0.9 ? 'bar-fill low' : 'bar-fill');
  f.style.width = `${Math.round(Math.min(1, s.storageUsed / Math.max(1, s.storageCapacity)) * 100)}%`;
  fill.append(f);
  const room = el('div', 'panel-head');
  room.append(el('span', '', `Stored ${s.storageUsed} of ${s.storageCapacity}`), el('span', '', s.storageUsed >= s.storageCapacity * 0.9 ? 'Nearly full: the town builds more storage' : ''));
  return [el('h2', '', 'Stores'), room, fill, ...inventory(s, worn, rerender)];
}

/** The Market's Workshops: what's on order at the stations, and every recipe the town knows (it orders them itself). */
export function renderWorkshops(s: Snapshot, rerender: () => void = () => {}): HTMLElement[] {
  const out: HTMLElement[] = [];
  out.push(el('h2', '', 'Orders'));
  const full = s.crafting.length >= s.craftSlots;
  const head = el('div', 'panel-head');
  head.append(el('span', full ? 'short' : '', `${s.crafting.length} of ${s.craftSlots} orders`), el('span', '', 'Three at each station'));
  out.push(head);
  if (s.crafting.length) {
    const q = el('div', 'queue');
    for (const o of s.crafting) q.append(orderRow(o));
    out.push(q);
  } else {
    out.push(el('div', 'hint', 'Nothing on order. The town makes tools, weapons, medicine and materials as it needs them.'));
  }
  const worn = new Map<string, number>();
  for (const p of s.people) for (const id of Object.values(p.gear)) worn.set(id!, (worn.get(id!) ?? 0) + 1);

  const built = new Set(s.buildings.filter((b) => b.status === 'done').map((b) => b.def));
  out.push(
    el('h2', '', 'Recipes'),
    hide.row(
      [
        ['have', 'Already have', 'Hide the things the town already has one of (in store or worn)'],
        ['locked', "Can't make yet", 'Hide the recipes still waiting on research or on their workshop'],
        ['weapons', 'Weapons', 'Hide the weapons'],
        ['armour', 'Armour', 'Hide the armour, shields, rings and amulets'],
      ],
      rerender,
    ),
  );
  const have = (d: ItemDef) => !d.makes && ((s.items[d.id] ?? 0) > 0 || worn.has(d.id));
  const canMake = (d: ItemDef) => (s.unlockAll || d.research.every((r) => s.research.done.includes(r))) && built.has(d.station);
  let hidden = 0;
  for (const station of STATIONS) {
    // recipes from eras the town hasn't reached stay hidden
    const known = ITEMS.filter((d) => !d.relic && d.station === station && (s.unlockAll || d.research.every((r) => eraReached(s.era, TOPIC_BY_ID[r]?.era) && topicKnown(s, r))));
    const defs = known.filter((d) => !(hide.has('have') && have(d)) && !(hide.has('locked') && !canMake(d)) && !(hide.has('weapons') && d.slot === 'weapon') && !(hide.has('armour') && !!d.weight));
    hidden += known.length - defs.length;
    if (!defs.length) continue;
    const name = BUILDING_BY_ID[station]?.name ?? station;
    out.push(el('h2', '', built.has(station) ? name : `${name} (not built)`));
    const grid = el('div', 'cards');
    for (const def of defs) grid.append(recipeCard(def, s, built.has(station)));
    out.push(grid);
  }
  out.push(...hiddenNote(hidden));
  return out;
}

/* ------------------------------------------------------------ the inventory */

type InvTab = 'all' | 'weapons' | 'armour' | 'tools' | 'materials' | 'food' | 'furniture' | 'wares' | 'medicine';
const INV_TABS: [InvTab, string][] = [
  ['all', 'All'],
  ['weapons', 'Weapons'],
  ['armour', 'Armour'],
  ['tools', 'Tools'],
  ['materials', 'Materials'],
  ['food', 'Food'],
  ['furniture', 'Furniture'],
  ['wares', 'For sale'],
  ['medicine', 'Medicine'],
];
const INV_KEY = 'littletown.invTab';
let invTab: InvTab = (() => {
  try {
    const v = localStorage.getItem(INV_KEY) as InvTab | null;
    return v && INV_TABS.some(([k]) => k === v) ? v : 'all';
  } catch {
    return 'all';
  }
})();
/** Which tab an item belongs under. */
function itemKind(def: ItemDef): InvTab {
  if (def.slot === 'weapon') return 'weapons';
  if (def.weight || def.slot === 'body' || def.slot === 'head' || def.slot === 'offhand' || def.slot === 'charm') return 'armour';
  if (def.slot === 'tool') return 'tools';
  if (def.furnish) return 'furniture';
  if (def.ware || def.fare) return 'wares';
  if (def.id === 'bandage' || def.id === 'poultice' || def.id === 'antibiotics' || def.id === 'medkit') return 'medicine';
  return 'materials';
}
const materialKind = (m: Material): InvTab => (FOOD_VALUE[m] ? 'food' : 'materials');

function inventory(s: Snapshot, worn: Map<string, number>, rerender: () => void): HTMLElement[] {
  const tabs = el('div', 'row inv-tabs');
  const items = [...new Set([...Object.keys(s.items).filter((id) => s.items[id] > 0), ...worn.keys()])].filter((id) => ITEM_BY_ID[id]);
  const materials = (Object.keys(s.stock) as Material[]).filter((m) => (s.stock[m] ?? 0) > 0);
  const count = (tab: InvTab) => (tab === 'all' ? items.length + materials.length : items.filter((id) => itemKind(ITEM_BY_ID[id]) === tab).length + materials.filter((m) => materialKind(m) === tab).length);
  for (const [k, name] of INV_TABS) {
    const n = count(k);
    if (!n && k !== 'all') continue;
    const b = el('button', `inv-tab${invTab === k ? ' on' : ''}`, `${name} ${n}`);
    b.addEventListener('click', () => {
      invTab = k;
      try {
        localStorage.setItem(INV_KEY, k);
      } catch {}
      rerender();
    });
    tabs.append(b);
  }
  const inv = el('div', 'inventory');
  for (const m of materials) {
    if (invTab !== 'all' && materialKind(m) !== invTab) continue;
    const chip = el('div', 'inv-item');
    const icon = stockIcon(m, 16);
    if (icon) chip.append(icon);
    chip.append(el('span', '', `${MATERIAL_NAMES[m]} ×${s.stock[m]}`));
    inv.append(pickable(chip, 'inv', `m:${m}`));
  }
  for (const id of items) {
    const def = ITEM_BY_ID[id];
    if (invTab !== 'all' && itemKind(def) !== invTab) continue;
    const chip = el('div', 'inv-item');
    const n = s.items[id] ?? 0;
    const w = worn.get(id) ?? 0;
    chip.append(itemIcon(def, 2), el('span', '', `${def.name} ${n ? `×${n}` : ''}${w ? `${n ? ' · ' : ''}${w} worn` : ''}`));
    chip.title = def.description;
    inv.append(pickable(chip, 'inv', `i:${id}`));
  }
  if (!inv.childElementCount) inv.append(el('span', 'hint', 'Nothing here yet.'));
  // (tap anything in store: its details under the list)
  const pick = pickedIn('inv');
  const out: HTMLElement[] = [tabs, inv];
  if (pick) {
    const c = el('div', 'card picked-card');
    const id = pick.slice(2);
    if (pick.startsWith('m:') && MATERIAL_NAMES[id as Material]) {
      const m = id as Material;
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', MATERIAL_NAMES[m]), el('span', 'card-size', `×${s.stock[m] ?? 0}`));
      c.append(top);
      for (const x of materialDetails(m, s)) if (x) c.append(typeof x === 'string' ? el('div', 'more-line', x) : x);
      out.push(c);
    } else if (ITEM_BY_ID[id]) {
      const d = ITEM_BY_ID[id];
      const top = el('div', 'card-top recipe-top');
      const name = el('span', 'card-name');
      name.append(itemIcon(d, 2), el('span', '', d.name));
      top.append(name, el('span', 'card-size', `×${s.items[id] ?? 0}`));
      c.append(top, el('div', 'purpose', d.description));
      for (const x of itemDetails(d, s)) if (x) c.append(typeof x === 'string' ? el('div', 'more-line', x) : x);
      out.push(c);
    }
  } else if (inv.childElementCount) out.push(el('div', 'hint', 'Tap anything in store for what it is, where it comes from and what it goes into.'));
  return out;
}

/** What to hide in the list of recipes (kept across visits, per phone). */
const hide = new HidePrefs('littletown.craftHide', ['have', 'locked', 'weapons', 'armour'] as const);

function orderRow(o: CraftOrderView): HTMLElement {
  const def = ITEM_BY_ID[o.item];
  const row = el('div', 'order');
  const info = el('div', 'order-info');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', `${def.name}${o.count > 1 ? ` ×${o.count}` : ''}`), el('span', 'card-size', o.crafter ? `${o.crafter} is on it` : ''));
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.round(o.progress * 100)}%`;
  bar.append(fill);
  info.append(top, bar);
  if (o.waiting) info.append(el('div', 'lock short', o.waiting));
  row.append(itemIcon(def, 2), info);
  return row;
}

function recipeCard(def: ItemDef, s: Snapshot, stationBuilt: boolean): HTMLElement {
  const unlocked = s.unlockAll || def.research.every((r) => s.research.done.includes(r));
  const c = el('div', unlocked ? 'card' : 'card locked');
  const top = el('div', 'card-top recipe-top');
  const name = el('span', 'card-name');
  name.append(itemIcon(def, 2), el('span', '', def.name));
  const kind = def.slot ? SLOT_NAMES[def.slot] : def.makes ? 'Stores' : 'Town';
  top.append(name, el('span', 'card-size', `${kind} · ~${duration(craftSeconds(def, s.era))} of work`));
  const cost = el('div', 'cost');
  for (const [m, n] of Object.entries(def.cost) as [Material, number][]) {
    const chip = el('span', (s.stock[m] ?? 0) >= n ? 'chip' : 'chip short', `${MATERIAL_NAMES[m]} ${n}`);
    const icon = materialIcon(m);
    if (icon) chip.prepend(icon);
    cost.append(chip);
  }
  for (const [id, n] of Object.entries(def.items ?? {})) cost.append(el('span', (s.items[id] ?? 0) >= n ? 'chip' : 'chip short', `${ITEM_BY_ID[id].name} ${n}`));
  c.append(top, cost, el('div', 'purpose', def.description));
  if (!unlocked) {
    const need = def.research.filter((r) => !s.research.done.includes(r)).map((r) => TOPIC_BY_ID[r]?.name ?? r);
    c.append(el('div', 'lock', `Needs research: ${need.join(', ')}`));
    return expandable(c, `recipe:${def.id}`, () => itemDetails(def, s));
  }
  // (the town decides what to make now: this shows what's on order)
  const order = s.crafting.find((o) => o.item === def.id);
  const row = el('div', 'row');
  row.append(el('span', 'lock', order ? `On order: ${order.count}` : 'Made when the town needs it'));
  if (!stationBuilt) row.append(el('span', 'lock short', `Build a ${BUILDING_BY_ID[def.station]?.name ?? def.station} first`));
  c.append(row);
  return expandable(c, `recipe:${def.id}`, () => itemDetails(def, s));
}
