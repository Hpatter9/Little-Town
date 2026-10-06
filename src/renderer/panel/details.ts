// Tap for more (the owner's ask: "I should be able to click on the quests for more information. This rule should apply to
// almost everything"). Any card in a menu can be made `expandable`: a tap opens it to show more underneath (facts in
// two columns, longer text, lists), a second tap closes it. Which cards are open is kept for the session, by a key the
// caller gives, and is part of the panel's redraw key (panel.ts), so an open card stays open as the snapshot moves on.
// Buttons, inputs and links inside a card keep working as before: a tap on them never opens or closes it.

import { BUILDING_BY_ID, BUILDINGS } from '../../shared/data/buildings';
import { DESTINATIONS } from '../../shared/data/expeditions';
import { FOOD_VALUE } from '../../shared/data/people';
import { TERRAIN } from '../../shared/data/terrain';
import { WORTH } from '../../shared/data/trade';
import { CLASS_DEFS } from '../../shared/data/classes';
import { ENEMIES } from '../../shared/data/enemies';
import { ITEMS, SLOT_NAMES, type ItemDef } from '../../shared/data/items';
import { TOPIC_BY_ID } from '../../shared/data/research';
import { FAMILIES } from '../../shared/data/weapons';
import { WEIGHT_NAMES } from '../../shared/data/armour';
import type { Snapshot } from '../../shared/sim/snapshot';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { plusMult, qualityMult } from '../../shared/data/quality';
import { quirkWords } from '../../shared/data/weapons';
import { el } from './dom';

const open = new Set<string>();
const picked = new Map<string, string>();
let redraw: () => void = () => {};

/** The panel's redraw (panel.ts sets it), called when a card opens or closes. */
export function setDetailsRedraw(fn: () => void): void {
  redraw = fn;
}
/** Which cards are open (for the panel's redraw key). */
export const detailsKey = (): string => [...open].sort().join(',') + '|' + [...picked].map(([g, id]) => `${g}=${id}`).join(',');
/** Whether a card is open. */
export const isOpen = (key: string): boolean => open.has(key);

/** What can go under a card: a line of text, an element, or nothing (left out). */
export type More = HTMLElement | string | null | undefined | false;

/** Make a card open on a tap to show `more()` underneath (worked out only when open), and close on another. */
export function expandable(card: HTMLElement, key: string, more: () => More[]): HTMLElement {
  const shown = open.has(key);
  card.classList.add('expandable');
  card.classList.toggle('open', shown);
  card.setAttribute('aria-expanded', String(shown));
  if (shown) {
    const box = el('div', 'card-more');
    for (const m of more()) if (m) box.append(typeof m === 'string' ? el('div', 'more-line', m) : m);
    card.append(box);
  }
  card.append(el('div', 'more-hint', shown ? '▴ Less' : '▾ More'));
  card.addEventListener('click', (ev) => {
    if ((ev.target as HTMLElement).closest('button, a, input, select, textarea, label, .no-expand')) return;
    if (open.has(key)) open.delete(key);
    else open.add(key);
    redraw();
  });
  return card;
}

/** Facts in two columns: a label and its value a row (rows with no value are left out). */
export function facts(rows: [string, string | number | null | undefined | false][]): HTMLElement {
  const box = el('div', 'facts');
  for (const [k, v] of rows) {
    if (v === null || v === undefined || v === false || v === '') continue;
    box.append(el('span', 'fact-key', k), el('span', 'fact-val', String(v)));
  }
  return box;
}

/** A small heading inside an open card. */
export const subhead = (text: string): HTMLElement => el('div', 'more-head', text);

/** A list of lines under a small heading (nothing when the list is empty). */
export function list(head: string, lines: string[]): HTMLElement | null {
  if (!lines.length) return null;
  const box = el('div', 'more-list');
  box.append(subhead(head));
  const ul = el('ul');
  for (const l of lines) ul.append(el('li', '', l));
  box.append(ul);
  return box;
}

/** A foe, as the details show it: "2 × Wolf (30 health, 3–6 a blow, ranged)". */
export function foeLine(kind: string, n = 1): string {
  const e = ENEMIES[kind];
  if (!e) return `${n > 1 ? `${n} × ` : ''}${kind}`;
  const bits = [`${e.hp} health`, `${e.damage[0]}–${e.damage[1]} a blow`];
  if (e.ranged) bits.push('shoots');
  if (e.armor) bits.push(`armour ${Math.round(e.armor * 100)}%`);
  if (e.boss) bits.push('boss');
  return `${n > 1 ? `${n} × ` : ''}${e.name} (${bits.join(', ')})`;
}
/** A group of foes ({kind: count}) as one line. */
export const groupLine = (g: Record<string, number>): string =>
  Object.entries(g)
    .map(([k, n]) => foeLine(k, n))
    .join(' + ');

/** Materials and amounts, as words: "4 wood, 2 stone". */
export const stockLine = (st: Partial<Record<Material, number>>): string =>
  (Object.entries(st) as [Material, number][])
    .filter(([, n]) => n)
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m]?.toLowerCase() ?? m}`)
    .join(', ');

/** What a piece of gear does, line by line, at its grade and +N (`qn`, data/quality.ts). */
export function itemStats(def: ItemDef, qn?: number): string[] {
  const fx = def.effects;
  const k = qualityMult(qn) * plusMult(qn);
  const pct = (v: number) => `${Math.round(v * k * 100)}%`;
  const out: string[] = [];
  if (fx.damage) out.push(`Damage +${(fx.damage * k).toFixed(1)}${fx.ranged ? ' (from range)' : ''}`);
  if (fx.accuracy) out.push(`Aim +${pct(fx.accuracy)}`);
  if (def.slot === 'weapon') out.push(`Range ${fx.range ?? (fx.ranged ? 4 : fx.reach ? 2.2 : 1.2)} cells${fx.ranged ? '' : fx.range && fx.range > 1.5 ? ' (a long reach)' : ''}`);
  if (fx.armor) out.push(`Armour ${pct(fx.armor)}`);
  if (fx.block) out.push(`Block ${pct(fx.block)}`);
  if (fx.dodge) out.push(`Dodge ${pct(fx.dodge)}`);
  if (fx.power) out.push(`Spell power +${pct(fx.power)}`);
  if (fx.carry) out.push(`Carries +${Math.round(fx.carry * k)}`);
  if (fx.morale) out.push(`Morale +${Math.round(fx.morale * k)}`);
  if (fx.construct) out.push(`Builds ${Math.round((fx.construct - 1) * 100)}% faster`);
  for (const [work, v] of Object.entries(fx.gather ?? {})) if (v) out.push(`${work[0].toUpperCase()}${work.slice(1)} ${Math.round((v - 1) * 100)}% faster`);
  if (fx.ammo) out.push(`Shoots ${MATERIAL_NAMES[fx.ammo].toLowerCase()}`);
  if (fx.speed !== undefined && def.slot !== 'weapon' && fx.speed > 1) out.push(`Slows the arm ${Math.round((fx.speed - 1) * 100)}%`);
  for (const w of quirkWords(fx)) out.push(w[0].toUpperCase() + w.slice(1));
  return out;
}

/** One picked thing in a group of small chips (an inventory, a list of foes): tapping a chip picks it (its details
 *  shown in a card under the group), tapping it again lets it go. */
export const pickedIn = (group: string): string | undefined => picked.get(group);
export function pickable(chip: HTMLElement, group: string, id: string): HTMLElement {
  chip.classList.add('pickable');
  chip.classList.toggle('on', picked.get(group) === id);
  chip.addEventListener('click', () => {
    if (picked.get(group) === id) picked.delete(group);
    else picked.set(group, id);
    redraw();
  });
  return chip;
}

/** An item's details: what it does, what it is and costs, where it's made, what it takes, who wears one and what
 *  it goes into. */
export function itemDetails(def: ItemDef, s: Snapshot): More[] {
  const wearers = s.people.filter((p) => Object.values(p.gear).includes(def.id)).map((p) => p.name);
  const usedIn = ITEMS.filter((i) => i.items?.[def.id]).map((i) => i.name);
  const callings = def.family
    ? Object.values(CLASS_DEFS)
        .filter((c) => c.weapons.includes(def.family as never))
        .map((c) => c.stages[0])
    : def.weight
      ? Object.values(CLASS_DEFS)
          .filter((c) => c.armour.includes(def.weight as never))
          .map((c) => c.stages[0])
      : [];
  const stats = def.slot ? itemStats(def) : [];
  return [
    stats.length ? list('What it does', stats) : null,
    facts([
      ['Kind', def.slot ? SLOT_NAMES[def.slot] : def.makes ? 'made into the stores' : def.furnish ? 'a furnishing' : def.ware ? 'a ware, to sell' : def.fare ? 'fare, for the tavern' : 'for the town'],
      ['Family', def.family ? `${FAMILIES[def.family].name}, tier ${def.tier ?? 1}` : null],
      ['Weight', def.weight ? (WEIGHT_NAMES[def.weight] ?? def.weight) : null],
      ['Makes', def.makes ? stockLine(def.makes) : null],
      ['Made at', def.unique || def.relic ? 'never made: found, or won' : (BUILDING_BY_ID[def.station]?.name ?? def.station)],
      ['Takes', !def.unique && !def.relic ? [stockLine(def.cost), ...Object.entries(def.items ?? {}).map(([id, n]) => `${n} ${ITEMS.find((i) => i.id === id)?.name ?? id}`)].filter(Boolean).join(', ') : null],
      ['Research', def.research.filter((r) => !r.startsWith('__')).map((r) => TOPIC_BY_ID[r]?.name ?? r).join(', ')],
      ['Sells for', def.ware ? `${def.ware.price} coins (customers of tier ${def.ware.tier} and up)` : def.fare ? `${def.fare.price} coins` : null],
      ['In a venue', def.furnish ? `${def.furnish.w} × ${def.furnish.h} cells, ${def.furnish.appeal} appeal` : null],
      ['In the stores', s.items[def.id] ? String(s.items[def.id]) : null],
      ['Worn by', wearers.length ? wearers.join(', ') : null],
      ['Goes into', usedIn.length ? usedIn.join(', ') : null],
    ]),
    callings.length ? `Callings that use it: ${callings.join(', ')}.` : null,
  ];
}

/** A material's details: what it's worth and feeds, where it comes from (the land, the workshops, the road) and what
 *  it goes into. */
export function materialDetails(m: Material, s: Snapshot): More[] {
  const land = Object.values(TERRAIN)
    .filter((t) => t.pool[m])
    .map((t) => t.name);
  const made = ITEMS.filter((i) => i.makes?.[m]).map((i) => `${i.name} (at the ${BUILDING_BY_ID[i.station]?.name ?? i.station})`);
  const road = DESTINATIONS.filter((d) => d.loot[m] || d.guaranteed?.[m]).map((d) => d.name);
  const builds = BUILDINGS.filter((b) => b.cost[m] && !b.never).map((b) => b.name);
  const crafts = ITEMS.filter((i) => i.cost[m] && !i.unique && !i.relic).map((i) => i.name);
  const few = (xs: string[], n = 10) => (xs.length > n ? `${xs.slice(0, n).join(', ')} and ${xs.length - n} more` : xs.join(', '));
  return [
    facts([
      ['In store', String(s.stock[m] ?? 0)],
      ['Worth', WORTH[m] ? `${WORTH[m]} coin${WORTH[m] === 1 ? '' : 's'} a unit` : null],
      ['Food', FOOD_VALUE[m] ? `feeds ${FOOD_VALUE[m]} a unit` : null],
      ['From the land', land.length ? land.join(', ') : null],
      ['Made by', made.length ? few(made, 6) : null],
      ['Brought home from', road.length ? few(road, 6) : null],
      ['Builds', builds.length ? few(builds) : null],
      ['Goes into', crafts.length ? few(crafts) : null],
    ]),
  ];
}
