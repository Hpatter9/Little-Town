// Crafting panel: the craft queue, the spare items in town, and every recipe by station.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { eraReached } from '../../shared/data/eras';
import { ITEM_BY_ID, ITEMS, SLOT_NAMES, STATIONS, type ItemDef } from '../../shared/data/items';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import type { CraftOrderView, Snapshot } from '../../shared/sim/snapshot';
import { craftSeconds } from '../../shared/sim/crafting';
import { itemIcon } from '../art/icons';
import { materialIcon } from '../art/materialIcons';
import { duration, el } from './dom';
import { hiddenNote, HidePrefs } from './hide';
import { topicKnown } from './secrets';

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

export function renderCrafting(s: Snapshot, _bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  const out: HTMLElement[] = [];
  const full = s.crafting.length >= s.craftSlots;
  const head = el('div', 'panel-head');
  head.append(el('span', full ? 'short' : '', `Craft queue ${s.crafting.length}/${s.craftSlots}`), el('span', '', `Stored ${s.storageUsed}/${s.storageCapacity}`));
  out.push(head);

  if (s.crafting.length) {
    const q = el('div', 'queue');
    for (const o of s.crafting) q.append(orderRow(o));
    out.push(q);
  } else {
    out.push(el('div', 'hint', 'Nothing on order. The town makes tools, weapons, medicine and materials as it needs them.'));
  }

  // what's in town
  const spare = Object.entries(s.items).filter(([, n]) => n > 0);
  const worn = new Map<string, number>();
  for (const p of s.people) for (const id of Object.values(p.gear)) worn.set(id!, (worn.get(id!) ?? 0) + 1);
  if (spare.length || worn.size) {
    out.push(el('h2', '', 'Items'));
    const inv = el('div', 'inventory');
    const ids = [...new Set([...spare.map(([id]) => id), ...worn.keys()])].filter((id) => ITEM_BY_ID[id]);
    for (const id of ids) {
      const def = ITEM_BY_ID[id];
      const chip = el('div', 'inv-item');
      const n = s.items[id] ?? 0;
      const w = worn.get(id) ?? 0;
      chip.append(itemIcon(def, 2), el('span', '', `${def.name} ${n ? `×${n}` : ''}${w ? `${n ? ' · ' : ''}${w} worn` : ''}`));
      chip.title = def.description;
      inv.append(chip);
    }
    out.push(inv);
  }

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
    return c;
  }
  // (the town decides what to make now: this shows what's on order)
  const order = s.crafting.find((o) => o.item === def.id);
  const row = el('div', 'row');
  row.append(el('span', 'lock', order ? `On order: ${order.count}` : 'Made when the town needs it'));
  if (!stationBuilt) row.append(el('span', 'lock short', `Build a ${BUILDING_BY_ID[def.station]?.name ?? def.station} first`));
  c.append(row);
  return c;
}
