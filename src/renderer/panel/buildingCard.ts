// The building card (the owner-approved UI overhaul): the building's own picture at the top with its state over it (under
// construction, damaged, on fire, a stage of the seat), the name and what it is for, the people who work or live there as
// small portraits, what it is making with a progress ring, and what it still needs. The phone's selected-thing card draws
// it under a building's title (mobile/mobile.ts); the page gives it the town's pictures (`BuildingArt`) because the strip
// holds the sheets, and this card holds no game state of its own.

import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { ITEM_BY_ID } from '../../shared/data/items';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { OPERATORS } from '../../shared/data/operators';
import { SKILL_NAMES } from '../../shared/data/skills';
import type { Snapshot } from '../../shared/sim/snapshot';
import { poolSize } from '../../shared/sim/state';
import { el } from './dom';
import { addCardStyles } from './cardsStyles';

/** The town's pictures, as the strip draws them. */
export interface BuildingArt {
  building(def: string): HTMLCanvasElement | null;
  person(id: number): HTMLCanvasElement | null;
}

/** What changes the card: it is drawn again when this changes (the page keeps the last one). */
export function buildingCardKey(s: Snapshot, id: number): string {
  const b = s.buildings.find((q) => q.id === id);
  if (!b) return '';
  const orders = s.crafting.filter((o) => o.station === id).map((o) => [o.item, o.count, o.made, Math.floor(o.progress * 20), o.waiting, o.crafter]);
  const living = s.people.filter((p) => p.bedId === id).map((p) => p.id);
  return JSON.stringify([b.status, Math.floor(b.progress * 50), Math.round(b.hp ?? -1), b.fire !== undefined, b.operator, orders, living, poolSize(b.store), Math.floor(poolSize(b.delivered)), b.crop && [b.crop.stage, Math.floor(b.crop.growth * 20)], b.herd?.head]);
}

const portrait = (art: BuildingArt, p: { id: number; name: string }, note: string): HTMLElement => {
  const box = el('div', 'pc-rel');
  const c = art.person(p.id);
  if (c) {
    const copy = document.createElement('canvas');
    copy.width = copy.height = 40;
    const g = copy.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    // (the head and shoulders of the standing figure)
    g.drawImage(c, c.width * 0.2, c.height * 0.04, c.width * 0.6, c.height * 0.55, 0, 0, 40, 40);
    box.append(copy);
  }
  box.append(el('span', '', p.name), el('small', '', note));
  return box;
};

/** The card for building `id`, or null when it is gone. */
export function buildingCard(s: Snapshot, id: number, art: BuildingArt): HTMLElement | null {
  const b = s.buildings.find((q) => q.id === id);
  const def = b && BUILDING_BY_ID[b.def];
  if (!b || !def) return null;
  addCardStyles();
  const sheet = el('div', 'bc-sheet');

  // the picture, with its state over it
  const top = el('div', 'bc-top');
  const pic = art.building(b.def);
  if (pic) {
    const copy = document.createElement('canvas');
    copy.width = pic.width;
    copy.height = pic.height;
    copy.getContext('2d')!.drawImage(pic, 0, 0);
    top.append(copy);
  }
  const state = el('div', 'bc-state');
  const done = b.status === 'done';
  if (!done) state.append(el('span', 'pc-chip warn', b.progress > 0 ? `Under construction ${Math.floor(b.progress * 100)}%` : 'Waiting for materials'));
  if (b.fire !== undefined) state.append(el('span', 'pc-chip warn', `On fire ${Math.floor(b.fire * 100)}%`));
  if (done && def.hp && (b.hp ?? def.hp) < def.hp) state.append(el('span', 'pc-chip warn', `Damaged ${Math.round(b.hp ?? def.hp)}/${def.hp}`));
  if (done && b.scorched !== undefined) state.append(el('span', 'pc-chip', 'Scorched'));
  top.append(state);
  sheet.append(top, el('div', 'bc-name', b.homeName ? `${b.homeName} (${def.name})` : def.name), el('div', 'pc-text', def.purpose));

  // who works or lives there
  const people = el('div', 'bc-people');
  const role = OPERATORS[b.def];
  const op = b.operator != null ? s.people.find((p) => p.id === b.operator) : undefined;
  if (op) people.append(portrait(art, op, role ? `${role.title} · ${SKILL_NAMES[role.skill]} ${op.skills[role.skill].level}` : 'works here'));
  const crafters = new Set<string>();
  for (const o of s.crafting) if (o.station === id && o.crafter) crafters.add(o.crafter);
  for (const n of crafters) {
    const p = s.people.find((q) => q.name === n);
    if (p && p.id !== b.operator) people.append(portrait(art, p, 'crafting'));
  }
  const living = s.people.filter((p) => p.bedId === id);
  for (const p of living) people.append(portrait(art, p, 'lives here'));
  if (people.children.length) sheet.append(el('div', 'pc-sec', def.housing ? `Home · ${living.length}/${def.housing} beds` : 'People'), people);

  // what it is making
  const orders = s.crafting.filter((o) => o.station === id);
  for (const o of orders) {
    const row = el('div', 'bc-making');
    const ring = el('div', 'bc-ring');
    ring.style.setProperty('--p', String(Math.round(o.progress * 100)));
    ring.dataset.pct = `${Math.round(o.progress * 100)}%`;
    const what = el('div');
    what.append(el('b', '', `${ITEM_BY_ID[o.item]?.name ?? o.item}${o.count > 1 ? ` (${o.made}/${o.count})` : ''}`), el('div', '', o.waiting ? `Waiting: ${o.waiting}` : o.crafter ? `${o.crafter} is at it` : 'Nobody on it yet'));
    row.append(ring, what);
    sheet.append(row);
  }
  if (done && b.crop) {
    const row = el('div', 'bc-making');
    const ring = el('div', 'bc-ring');
    ring.style.setProperty('--p', String(Math.round(b.crop.growth * 100)));
    ring.dataset.pct = `${Math.round(b.crop.growth * 100)}%`;
    row.append(ring, el('div', '', b.crop.stage === 'ripe' ? 'Ripe, ready to harvest' : b.crop.stage === 'growing' ? 'Growing' : 'Fallow'));
    sheet.append(row);
  }
  if (done && b.herd) sheet.append(el('div', 'bc-making', `${b.herd.head} head${b.herd.hungry ? ', going hungry' : ''}`));

  // what it needs
  const needs: [string, boolean][] = [];
  if (!done) {
    for (const [m, n] of Object.entries(def.cost) as [Material, number][]) {
      const have = Math.floor(b.delivered[m] ?? 0);
      needs.push([`${MATERIAL_NAMES[m]} ${have}/${n}`, have >= n]);
    }
    if (b.overgrown) needs.push(['The ground cleared first', false]);
  } else {
    if (role && !op) needs.push([`A ${role.title.toLowerCase()}`, false]);
    if (def.housing && !living.length) needs.push(['Someone to live here', false]);
    if (def.storage) needs.push([`Stored ${poolSize(b.store)}/${def.storage}`, poolSize(b.store) < def.storage]);
    for (const o of orders) for (const [m, n] of Object.entries(o.needed) as [Material, number][]) if (n > 0) needs.push([`${n} ${MATERIAL_NAMES[m].toLowerCase()} for ${ITEM_BY_ID[o.item]?.name ?? o.item}`, false]);
  }
  if (needs.length) {
    sheet.append(el('div', 'pc-sec', 'Needs'));
    const row = el('div', 'pc-chips');
    for (const [text, ok] of needs) row.append(el('span', `bc-need${ok ? ' ok' : ''}`, text));
    sheet.append(row);
  }
  return sheet;
}
