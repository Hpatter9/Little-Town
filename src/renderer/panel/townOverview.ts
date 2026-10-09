// The Town menu's own pieces (the menus' redo, the owner's ask): the overview's tiles, each a tap through to where its
// story goes on (the people, the stores, the money, what's being built, the studies, the workshops, the trips), and the
// buildings standing in town grouped by what they're for, each card opening on its owner, who lives or works there and
// how it's doing, with a way to see it on the map.

import { BUILDING_BY_ID, type BuildingDef } from '../../shared/data/buildings';
import { CROPS, sectionsDone, sectionsOf } from '../../shared/data/crops';
import { ERA_NAMES } from '../../shared/data/eras';
import { HERDS } from '../../shared/data/livestock';
import { OPERATORS } from '../../shared/data/operators';
import { FOOD_VALUE } from '../../shared/data/people';
import { TOPIC_BY_ID } from '../../shared/data/research';
import { STATIONS } from '../../shared/data/items';
import type { Material } from '../../shared/data/materials';
import type { Bridge, PanelId } from '../../shared/ipc';
import type { Snapshot } from '../../shared/sim/snapshot';
import type { Building } from '../../shared/sim/state';
import { button, el } from './dom';
import { expandable, facts, type More } from './details';
import { selectTab } from './subtabs';

/** Go to a menu's tab: this menu redrawn, or another opened at it. */
export function goTo(bridge: Bridge | undefined, here: PanelId, panel: PanelId, tab: string, rerender: () => void): void {
  selectTab(panel, tab);
  if (panel === here) rerender();
  else bridge?.openPanel(panel);
}

/** Look at a building or someone on the map (the phone's strip, beside the menus), closing the menu to show it. */
export function showOnMap(bridge: Bridge | undefined, what: { building?: number; person?: number; village?: number }): boolean {
  try {
    for (const f of Array.from(window.parent.document.querySelectorAll('iframe'))) {
      const w = f.contentWindow as (Window & { __showOnMap?: (x: { person?: number; building?: number; village?: number }) => boolean }) | null;
      if (w?.__showOnMap) {
        bridge?.closePanel();
        return w.__showOnMap(what);
      }
    }
  } catch {
    /* (the desktop's menu is a window of its own: no map beside it) */
  }
  return false;
}
/** Whether there's a map beside the menu to show things on (the phone page). */
export const mapBeside = (): boolean => {
  try {
    return window.parent !== window && Array.from(window.parent.document.querySelectorAll('iframe')).some((f) => !!(f.contentWindow as { __showOnMap?: unknown } | null)?.__showOnMap);
  } catch {
    return false;
  }
};

/** Days of food in store for those who eat. */
export function foodDays(s: Snapshot): number {
  const eaters = s.people.filter((p) => !p.tireless && p.away === null).length;
  const food = (Object.entries(FOOD_VALUE) as [Material, number][]).reduce((n, [m, v]) => n + (s.stock[m] ?? 0) * v, 0);
  return eaters ? food / eaters : Infinity;
}

/** The overview: the town at a glance, a tile each, every one a way in. */
export function glance(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  const c = s.calendar;
  const grid = el('div', 'glance');
  const tile = (label: string, value: string, sub: string, to: [PanelId, string] | (() => void) | null, warn = false) => {
    const t = el(to ? 'button' : 'div', `glance-tile${warn ? ' warn' : ''}`);
    t.append(el('span', 'glance-label', label), el('span', 'glance-value', value));
    if (sub) t.append(el('span', 'glance-sub', sub));
    if (typeof to === 'function') t.addEventListener('click', to);
    else if (to) t.addEventListener('click', () => goTo(bridge, 'build', to[0], to[1], rerender));
    grid.append(t);
  };
  const away = s.people.filter((p) => p.away !== null).length;
  const morale = s.people.length ? Math.round(s.people.reduce((n, p) => n + p.morale, 0) / s.people.length) : 0;
  const days = foodDays(s);
  if (s.raid) tile('Raid!', s.raid.name, s.raid.phase === 'warning' ? `at the gate in ${Math.max(1, Math.ceil(s.raid.secondsToArrival / 60))} min` : 'fighting now', null, true);
  tile('People', `${s.housing.people}`, `${s.housing.beds} beds${away ? ` · ${away} away` : ''}${s.visitor ? ' · one at the gate' : ''}`, ['townsfolk', 'People']);
  tile('Food', days === Infinity ? 'No need' : `${days < 10 ? days.toFixed(1) : Math.round(days)} days`, 'in store for those who eat', ['build', 'Stores'], days < 2);
  tile('Spirits', `${morale}`, morale >= 60 ? 'content' : morale >= 35 ? 'getting by' : 'unhappy', ['townsfolk', 'People'], morale < 35);
  tile('Treasury', `${s.coins ?? 0}`, 'coins', ['build', 'Treasury']);
  // (the Court's blood: sim/vampires.ts)
  const blood = s.heritage?.blood;
  if (blood) tile('Blood', `${blood.store}`, blood.farms ? `${blood.prisoners}/${blood.cells} in the farm's cells` : `about +${blood.nightly} each dusk`, ['build', 'Our ways'], blood.store < 5);
  // (the horde's fury: sim/warpath.ts)
  const horde = s.heritage?.horde;
  if (horde) tile('Fury', `${horde.fury}`, horde.waaagh !== null ? 'WAAAGH!' : horde.out ? `raiding ${horde.out.target}` : horde.name, ['build', 'Our ways'], horde.fury >= 70);
  tile('Stores', `${s.storageUsed}/${s.storageCapacity}`, 'stored', ['build', 'Stores'], s.storageUsed >= s.storageCapacity * 0.9);
  const site = s.buildings.filter((b) => b.status === 'blueprint');
  tile('Building', site.length ? `${site.length}` : 'Nothing', site.length ? site.slice(0, 2).map((b) => BUILDING_BY_ID[b.def]?.name ?? b.def).join(', ') : 'right now', ['build', 'Buildings']);
  const r = s.research;
  const topic = r.queue[0] ? TOPIC_BY_ID[r.queue[0]] : undefined;
  tile('Studying', topic ? topic.name : 'Nothing', topic ? `${Math.floor((r.progress[topic.id] ?? 0) * 100)}% · ${r.queue.length} queued` : 'for now', ['research', 'Studying']);
  tile('Workshops', `${s.crafting.length}`, `of ${s.craftSlots} orders`, ['trade', 'Workshops']);
  tile('Trips', `${s.expeditions.length}`, s.expeditions.length ? 'parties out' : 'nobody away', ['expeditions', s.expeditions.length ? 'Parties' : 'Places']);
  if (s.shop || s.tavern || s.stores.length) tile('Shops', `${[s.shop, s.tavern, ...s.stores].filter(Boolean).length}`, 'open for trade', ['trade', 'Shops']);
  if (s.faith.on) {
    const worst = [...s.faith.gods].sort((a, b) => a.favour - b.favour)[0];
    if (worst) tile('Gods', worst.mood === 'wrathful' ? 'Wrathful' : worst.favour < 0 ? 'Uneasy' : 'At peace', worst.favour < 0 ? `${worst.name} is ${worst.mood}` : 'all four content', ['build', 'Faith'], worst.mood === 'wrathful');
  }
  if (s.calamity) tile('The Calamity', s.calamity.beaten ? 'Beaten' : s.calamity.stageName, s.calamity.beaten ? s.calamity.name : `${s.calamity.name} · dread ${Math.round(s.calamity.dread)}`, ['expeditions', 'Places'], !s.calamity.beaten && s.calamity.stage >= 4);
  // (the Deep under the town: a tap goes down into its deepest level, sim/deep.ts)
  if (s.deep) {
    const d = s.deep;
    const last = d.levels[d.levels.length - 1];
    tile('The Deep', `Level ${last.depth}`, `${last.name} · ${d.miners ? `${d.miners} digging` : 'nobody digging'}`, () => {
      bridge?.command({ type: 'watchDeep', depth: last.depth });
      bridge?.closePanel();
    }, d.stir >= 0.75);
  }
  // (other worlds through a portal: a tap looks through into each, sim/portals.ts)
  for (const pt of s.portals)
    tile(pt.name, pt.calm ? 'Quiet' : `${pt.explored} of ${pt.sites}`, pt.calm ? 'its heart broken' : pt.next ? `next: ${pt.next}` : 'explored', () => {
      bridge?.command({ type: 'watchPortal', realm: pt.realm });
      bridge?.closePanel();
    }, pt.stir >= 0.75);
  tile('Age', ERA_NAMES[s.era], `Year ${c.year}, ${c.season} day ${c.dayOfSeason}`, ['research', 'Tech tree']);
  return [el('h2', '', 'At a glance'), grid, el('div', 'hint', 'Tap a tile to go to it.')];
}

/** What a building is for, to group the town's: in the order they're listed. */
const KINDS: [string, (d: BuildingDef) => boolean][] = [
  ['The seat', (d) => !!d.seat],
  ['Homes', (d) => !!d.housing],
  ['Shops and inns', (d) => !!d.floor],
  ['Fields', (d) => !!CROPS[d.id]],
  ['Pens', (d) => !!HERDS[d.id]],
  ['Workshops', (d) => (STATIONS as readonly string[]).includes(d.id)],
  ['Defences', (d) => !!d.hp || !!d.defense || !!d.cells],
  ['Stores', (d) => !!d.storage],
  ['Everything else', () => true],
];

/** The buildings standing in town, grouped, each card opening on who owns it, who's in it, and how it's doing. */
export function inTown(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const standing = s.buildings.filter((b) => b.status === 'done' && BUILDING_BY_ID[b.def]);
  const out: HTMLElement[] = [el('h2', '', `In town: ${standing.length} buildings`)];
  if (!standing.length) return [...out, el('p', 'empty', 'Nothing stands yet.')];
  const groups = new Map<string, Building[]>();
  for (const b of standing) {
    const name = KINDS.find(([, is]) => is(BUILDING_BY_ID[b.def]))![0];
    (groups.get(name) ?? groups.set(name, []).get(name)!).push(b);
  }
  const map = mapBeside();
  for (const [name] of KINDS) {
    const bs = groups.get(name);
    if (!bs) continue;
    out.push(el('div', 'subhead', `${name} · ${bs.length}`));
    const grid = el('div', 'cards');
    for (const b of bs) {
      const def = BUILDING_BY_ID[b.def];
      const c = el('div', 'card');
      const top = el('div', 'card-top');
      top.append(el('span', 'card-name', def.name), el('span', 'card-size', statusOf(b, s)));
      c.append(top);
      const owner = b.owner !== undefined ? s.people.find((p) => p.id === b.owner)?.name : undefined;
      c.append(el('div', 'purpose', owner ? `Owned by ${owner}` : "The town's own"));
      if (map) c.append(button('Show on the map', () => showOnMap(bridge, { building: b.id }), { cls: 'place small quiet' }));
      grid.append(expandable(c, `bld:${b.id}`, () => buildingMore(b, s)));
    }
    out.push(grid);
  }
  return out;
}

/** A building's state in a word or two, on its card. */
function statusOf(b: Building, s: Snapshot): string {
  const def = BUILDING_BY_ID[b.def];
  if (b.fire !== undefined) return 'On fire!';
  if (def.housing) {
    const n = s.people.filter((p) => p.bedId === b.id).length;
    return `${n}/${def.housing} beds`;
  }
  if (CROPS[b.def]) {
    const c = b.crop;
    if (!c || c.stage === 'fallow') return c && c.work > 0 ? 'Being sown' : 'Fallow';
    if (c.stage === 'ripe') return c.work > 0 ? 'Being reaped' : 'Ripe';
    return `Growing ${Math.floor(c.growth * 100)}%`;
  }
  if (HERDS[b.def]) return `${b.herd?.head ?? 0} ${HERDS[b.def].plural}`;
  if (def.hp) return `${Math.round(b.hp ?? def.hp)}/${def.hp}`;
  if (def.storage) return `holds ${def.storage}`;
  return '';
}

/** A building's card, opened: what it's for, its keeper, who lives there, its herd or crop, what it holds. */
function buildingMore(b: Building, s: Snapshot): More[] {
  const def = BUILDING_BY_ID[b.def];
  const name = (id: number | undefined) => (id === undefined ? undefined : s.people.find((p) => p.id === id)?.name);
  const rows: [string, string][] = [];
  const role = OPERATORS[b.def];
  if (role) rows.push([role.title, name(b.operator ?? undefined) ?? 'nobody yet']);
  if (def.housing) {
    const living = s.people.filter((p) => p.bedId === b.id);
    rows.push(['Home of', living.length ? living.map((p) => p.name + (b.owner !== undefined && p.id !== b.owner ? ' (renting)' : '')).join(', ') : 'nobody']);
  }
  if (CROPS[b.def] && b.crop && b.crop.stage !== 'growing' && b.crop.work > 0) rows.push([b.crop.stage === 'ripe' ? 'Reaped' : 'Sown', `${sectionsDone(b.crop.work, def.width)} of ${sectionsOf(def.width)} sections`]);
  if (CROPS[b.def] && b.crop?.soil !== undefined) rows.push(['Soil', b.crop.soil >= 1 ? 'rich' : b.crop.soil >= 0.75 ? 'good' : b.crop.soil >= 0.5 ? 'tiring' : 'worn out']);
  if (def.storage) {
    const n = Object.values(b.store).reduce((a, k) => a + (k ?? 0), 0);
    rows.push(['Holds', `${n} of ${def.storage}`]);
  }
  if (def.cells) rows.push(['Cells', `${def.cells}`]);
  const ward = s.nursing.find((w) => w.building === b.id);
  if (ward) rows.push(['Sickbeds', `${ward.people.length} of ${ward.beds}${ward.people.length ? `: ${ward.people.map((id) => name(id)).filter(Boolean).join(', ')}` : ''}`]);
  return [def.purpose, rows.length ? facts(rows) : null];
}
