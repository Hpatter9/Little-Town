// Town plan (the Build tab): the town builds for itself now. At the top, where it's putting its effort (the one thing
// the player sets), what it's building and what it decided next and why; below, every building it knows, for reference.

import { ADJACENT_TILES, BUILDING_BY_ID, BUILDINGS, LAYER_NAMES, NEAR_SOURCE, NEAR_SOURCE_BONUS, RIVER_GROWTH, TAVERN_MARKET_MORALE, type BuildLayer, type BuildingDef } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { eraReached } from '../../shared/data/eras';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import { DIRECTION_DEFS, DIRECTIONS } from '../../shared/sim/planner';
import { blueprintCount, isUnlocked } from '../../shared/sim/buildings';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, duration, el } from './dom';
import { materialIcon } from '../art/materialIcons';
import { BUILD_MULTIPLIER } from '../../shared/sim/state';
import { topicKnown } from './secrets';

/** Changes whenever something this panel shows changes. */
export const buildKey = (s: Snapshot) =>
  JSON.stringify([s.coins, s.ledger, !!s.shop, !!s.tavern, s.era, s.research.revealed, s.buildSlots, s.stock, s.unlockAll, s.research.done, s.storageCapacity, s.direction, s.plan, s.buildings.map((b) => [b.def, b.status, Math.floor(b.progress * 20)])]);

export function renderBuild(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const used = blueprintCount(s);
  const head = el('div', 'panel-head');
  head.append(el('span', '', `Building ${used}/${s.buildSlots} at once`), el('span', '', `● ${s.coins} coins · Stored ${s.storageUsed}/${s.storageCapacity}`));
  const out: HTMLElement[] = [head];

  // the one thing the player decides: where the town puts its effort
  out.push(el('h2', '', 'Direction'));
  const dirs = el('div', 'row directions');
  for (const d of DIRECTIONS) {
    dirs.append(
      button(DIRECTION_DEFS[d].name, () => bridge?.command({ type: 'setDirection', direction: d }), {
        cls: `place small${s.direction === d ? ' on' : ' quiet'}`,
        title: DIRECTION_DEFS[d].description,
      }),
    );
  }
  out.push(dirs, el('div', 'hint', DIRECTION_DEFS[s.direction].description));

  // the town's money: travellers bring it in at the shop and the tavern, and it goes on wages, crafters and the venues
  if (s.shop || s.tavern || s.coins) {
    out.push(el('h2', '', `Coins: ${s.coins}`));
    const l = s.ledger;
    if (!l) out.push(el('div', 'hint', 'Travellers passing through fund the town: they buy at the shop and eat and drink at the tavern. A day\'s takings show here from tomorrow.'));
    else {
      const LINES: [keyof NonNullable<typeof l>, string][] = [
        ['shop', 'Travellers at the shop'],
        ['tavern', 'Travellers at the tavern'],
        ['townsfolk', 'The townsfolk (gear, evenings out)'],
        ['wages', 'Wages'],
        ['crafters', 'Crafters, for what they made'],
        ['venues', 'Rooms and improvements'],
        ['goods', 'Goods bought from travellers'],
      ];
      const t = el('table', 'grid ledger');
      let net = 0;
      for (const [k, name] of LINES) {
        const n = Math.round(l[k] ?? 0);
        if (!n) continue;
        net += n;
        const tr = el('tr');
        tr.append(el('td', 'grid-name', name), el('td', n > 0 ? 'ledger-in' : 'ledger-out', `${n > 0 ? '+' : ''}${n}`));
        t.append(tr);
      }
      const tr = el('tr');
      tr.append(el('td', 'grid-name', 'Yesterday, all told'), el('td', net >= 0 ? 'ledger-in' : 'ledger-out', `${net >= 0 ? '+' : ''}${net}`));
      t.append(tr);
      out.push(t);
    }
  }

  // what it's doing about it
  out.push(el('h2', '', 'Being built'));
  const building = s.buildings.filter((b) => b.status === 'blueprint');
  if (!building.length) out.push(el('p', 'empty', 'Nothing right now.'));
  for (const b of building) {
    const def = BUILDING_BY_ID[b.def];
    const need = (Object.entries(def.cost) as [Material, number][]).filter(([m, n]) => (b.delivered[m] ?? 0) < n);
    const row = el('div', 'queue-row');
    row.append(
      el('span', 'queue-name', def.name),
      el('span', 'queue-time', b.progress > 0 ? `${Math.floor(b.progress * 100)}% built` : need.length ? `waiting on ${need.map(([m, n]) => `${MATERIAL_NAMES[m].toLowerCase()} ${b.delivered[m] ?? 0}/${n}`).join(', ')}` : 'ready to build'),
    );
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(b.progress * 100)}%`;
    bar.append(fill);
    row.append(bar);
    out.push(row);
  }
  const plan = s.plan;
  if (plan?.build) out.push(el('div', 'hint', `Last decided: a ${BUILDING_BY_ID[plan.build.def]?.name ?? plan.build.def}, because ${plan.build.why}.`));
  for (const w of plan?.waiting ?? []) out.push(el('div', 'hint', w));
  if (plan?.gathering.length) out.push(el('div', 'hint', `Gathering for: ${plan.gathering.join(', ').toLowerCase()}.`));

  // everything it knows how to build (for reference: it decides for itself)
  for (const layer of ['fore', 'mid', 'back'] as BuildLayer[]) {
    out.push(el('h2', '', LAYER_NAMES[layer]));
    const grid = el('div', 'cards');
    // buildings from eras the town hasn't reached stay hidden
    const shown = BUILDINGS.filter((b) => b.layer === layer && (s.unlockAll || !b.research || (eraReached(s.era, TOPIC_BY_ID[b.research]?.era) && topicKnown(s, b.research))));
    for (const def of shown) grid.append(card(def, s));
    out.push(grid);
  }
  return out;
}

function card(def: BuildingDef, s: Snapshot): HTMLElement {

  const unlocked = isUnlocked({ unlockAll: s.unlockAll, done: s.research.done }, def);
  const c = el('div', unlocked ? 'card' : 'card locked');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', def.name), el('span', 'card-size', `${def.width} wide · ~${duration(def.buildSeconds * BUILD_MULTIPLIER[s.era])} of work`));
  const cost = el('div', 'cost');
  for (const [m, n] of Object.entries(def.cost) as [Material, number][]) {
    const chip = el('span', (s.stock[m] ?? 0) >= n ? 'chip' : 'chip short', `${MATERIAL_NAMES[m]} ${n}`);
    const icon = materialIcon(m);
    if (icon) chip.prepend(icon);
    cost.append(chip);
  }
  c.append(top, cost, el('div', 'purpose', def.purpose));
  const tip = placementTip(def);
  if (tip) c.append(el('div', 'hint', tip));
  if (!unlocked) c.append(el('div', 'lock', `Needs research: ${TOPIC_BY_ID[def.research!]?.name ?? def.research}`));
  else {
    const n = s.buildings.filter((b) => b.def === def.id && b.status === 'done').length;
    c.append(el('div', 'lock', n ? `In town: ${n}` : 'None yet'));
  }
  return c;
}

/** Where it does best (adjacency bonuses), if anywhere in particular. */
function placementTip(def: BuildingDef): string | null {
  const sources = NEAR_SOURCE[def.id];
  if (sources) return `Works ${Math.round((NEAR_SOURCE_BONUS - 1) * 100)}% faster within ${ADJACENT_TILES} tiles of a ${sources.map((id) => BUILDING_BY_ID[id].name).join(' or ')}.`;
  if (def.id === 'tavern') return `Livelier (+${TAVERN_MARKET_MORALE} morale) within ${ADJACENT_TILES} tiles of a Market Stall.`;
  if (CROPS[def.id] && !CROPS[def.id].indoor) return `Grows ${Math.round((RIVER_GROWTH - 1) * 100)}% faster beside a river.`;
  return null;
}
