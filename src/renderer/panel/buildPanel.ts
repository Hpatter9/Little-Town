// The Town menu (the old Build tab, the panel id 'build'), in four tabs (subtabs.ts): Overview (the town at a glance, the
// powers, the days ahead), Buildings (what's going up, what stands, a book of every building), Stores (the stores
// themselves, craftingPanel.ts renderStores, and the treasury) and More (the levers, then faith, villages, council, the
// people's ways and magic, each once the town has it).

import { amount } from '../../shared/format';
import { calendarKey, renderCalendar } from './calendarStrip';
import { faithKey, faithSection } from './faithPanel';
import { villagesSection } from './villagesPanel';
import { politicsSection } from './politicsPanel';
import { heritageKey, heritageSection } from './heritagePanel';
import { magicSection } from './magicPanel';
import { TOWN_SIZES } from '../../shared/sim/state';
import { TAX, TAX_RATES } from '../../shared/data/economy';
import { BUILDING_BY_ID, BUILDINGS, type BuildingDef } from '../../shared/data/buildings';
import { CREATURE_PEN } from '../../shared/data/creature';
import { CROPS } from '../../shared/data/crops';
import { eraReached } from '../../shared/data/eras';
import { MATERIAL_NAMES, type Material, type Stock } from '../../shared/data/materials';
import { eraOfResearch, TOPIC_BY_ID } from '../../shared/data/research';
import { PINS_MOST, SLOT_WAIT } from '../../shared/sim/pins';
import { isRingPiece, WALL_KINDS } from '../../shared/sim/ringWall';
import { BUILD_TABS, tabOf, whyOf, type BuildTab } from './buildKinds';
import { DRAW_PATH, type Bridge } from '../../shared/ipc';
import type { Command } from '../../shared/sim/commands';
import { DIRECTION_DEFS, DIRECTIONS } from '../../shared/sim/planner';
import { isUnlocked } from '../../shared/sim/buildings';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { thumb } from './structure';
import { foodDays, glance, inTown } from './townOverview';
import { dashboard, dashboardKey } from './dashboard';
import { storesKey } from './craftingPanel';
import { topicKnown } from './secrets';
import { expandable, facts, list, type More } from './details';
import { UPGRADES } from '../../shared/data/buildings';
import { OPERATORS } from '../../shared/data/operators';
import { ITEMS } from '../../shared/data/items';
import { ERA_NAMES } from '../../shared/data/eras';
import { depthOf } from '../../shared/sim/buildings';
import { SKILL_NAMES } from '../../shared/data/skills';
import { topicName } from '../../shared/data/originResearch';

/** The treasury's table as it is drawn (whole coins), not the day's raw sums. */
const ledgerKey = (s: Snapshot) => s.ledger && Object.values(s.ledger).map((n) => Math.round(Number(n) || 0));

/** What of the stores the open tab shows: the overview's food days (to the digit drawn), the stores themselves and the
 *  buildings' cost chips every count, and the other tabs none (a haul changes the stock ten times a minute). */
export const townStockKey = (s: Snapshot, tab: string) =>
  tab === 'Stores' ? storesKey(s) : tab === 'Buildings' ? costChipsKey(s) : tab === '' || tab === 'Overview' ? foodDaysShown(s) + '|' + s.crafting.length + '|' + s.craftSlots : '';

/** The Buildings tab shows the stock only as cost chips ("short" or not): a material's count past the dearest building's cost
 *  changes nothing on the page. */
const DEAREST: Partial<Record<Material, number>> = {};
for (const b of BUILDINGS) for (const [m, n] of Object.entries(b.cost)) DEAREST[m as Material] = Math.max(DEAREST[m as Material] ?? 0, n ?? 0);
const costChipsKey = (s: Snapshot) => (Object.keys(DEAREST) as Material[]).map((m) => Math.min(s.stock[m] ?? 0, DEAREST[m]!)).join(',');

const foodDaysShown = (s: Snapshot) => {
  const d = foodDays(s);
  return d === Infinity ? 'inf' : d < 10 ? d.toFixed(1) : String(Math.round(d));
};

/** Changes whenever something this panel shows changes. `tab` is the sub-tab the page is drawn on (subtabs.ts `shownTab`), or
 *  null when that isn't known yet: the parts only one tab draws are left out of the others' keys, so a power's hourly
 *  countdown or a knight's vow doesn't rebuild the Treasury under a finger. */
export const buildKey = (s: Snapshot, tab: string | null = null) => {
  const on = (names: readonly string[], part: () => unknown): unknown => (tab === null || names.includes(tab) ? part() : 0);
  const heritageTiles = () => [s.heritage?.blood && [s.heritage.blood.store, s.heritage.blood.farms, s.heritage.blood.prisoners, s.heritage.blood.cells, s.heritage.blood.nightly], s.heritage?.horde && [s.heritage.horde.fury, s.heritage.horde.waaagh, s.heritage.horde.out?.target, s.heritage.horde.name]];
  return JSON.stringify([
    tab,
    chipTab, // (the Build list's own chips: a tap on one has to redraw)
    s.theme,
    on(['Overview'], () => [s.powers.map((p) => [p.id, Math.ceil(p.readyHours), Math.ceil(p.activeHours), p.held, p.affordable]), s.powerLog[0], s.nomad && [s.nomad.site, s.nomad.settled, Math.ceil((s.nomad.nextMoveDays ?? 0) * 24)], s.lichOffer, heritageTiles()]),
    on(['Overview'], () => [dashboardKey(s), s.why?.research, s.why?.craft]),
    on(['Overview'], () => calendarKey(s)),
    on(['Overview', 'Stores'], () => s.coins),
    on(['Stores'], () => ledgerKey(s)),
    s.guards.n, s.guards.watch, !!s.shop, !!s.tavern, s.era, s.research.revealed, s.buildSlots, s.unlockAll, s.research.done, s.storageCapacity, s.housing, s.direction, s.plan, !!s.creature,
    Math.round(s.align.score / 2), Math.round(s.align.order / 2), s.align.title, s.align.pact, s.align.swings[0],
    on(['More'], () => s.villages.map((v) => [v.pop, v.loyalty, v.rebel, v.beset, v.helpers, v.cartOut, v.road, v.goods, v.news[0], v.canGift])),
    s.politics && [s.politics.tax, on(['More'], () => [s.politics!.blocs.map((b) => [b.sat, b.members.length, b.wants, b.striking]), s.politics!.laws.map((l) => l.on), s.politics!.log[0], s.politics!.crimes, s.politics!.strike, s.politics!.edictWait])],
    s.buildings.map((b) => [b.def, b.status, on(['Buildings'], () => Math.floor(b.progress * 20))]),
    on(['More'], () => heritageKey(s)),
    on(['Overview', 'More'], () => faithKey(s)),
    s.skipRaids,
    s.pins.map((p) => [p.def, p.building, Math.floor(p.progress * 20), p.why]),
    s.recommend && [s.recommend.def ?? s.recommend.kind, s.recommend.why],
    s.ringOrdered, s.ringState,
  ]);
};

export function renderBuild(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  // the town at a glance first (townOverview.ts): every tile a way in
  const out: HTMLElement[] = [...dashboard(s, bridge, rerender), ...glance(s, bridge, rerender)];

  // a choice only the player can make: binding the founder's soul (once Lichcraft is learned)
  if (s.lichOffer) {
    out.push(el('h2', '', 'Lichcraft'));
    out.push(el('div', 'hint', "The founder could be bound into a phylactery: they won't truly die while it stands, and the dead may answer to them. The town, and the whole game, will never look the same."));
    // (there's no going back: asked twice)
    out.push(button('Become a lich…', () => confirm('Bind the founder\'s soul into a phylactery? There is no going back.') && bridge?.command({ type: 'becomeLich' }), { cls: 'place' }));
  }

  // the origin's powers: the town calls on them itself, when the moment's right (all but one the player holds back, to
  // cast themselves: from here, or the button by the clock in a raid)
  if (s.powers.length) {
    out.push(el('h2', '', `${s.origin.name}: powers`));
    out.push(el('div', 'hint', 'The town casts its powers itself. Hold one back to cast it yourself: in a raid, a button by the clock casts it.'));
    for (const p of s.powers) {
      const row = el('div', 'queue-row');
      const state = p.activeHours > 0 ? `in effect, ${Math.ceil(p.activeHours)}h left` : p.readyHours > 0 ? `ready in ${Math.ceil(p.readyHours)}h` : 'ready';
      row.append(el('span', 'queue-name', `${p.name}${p.held ? ' (yours)' : ''}`), el('span', 'queue-time', state));
      row.append(button(p.held ? 'Let the town cast it' : 'Hold back', () => bridge?.command({ type: 'holdPower', power: p.held ? null : p.id }), { cls: `place small${p.held ? ' on' : ' quiet'}` }));
      if (p.held) row.append(button('Cast now', () => bridge?.command({ type: 'castHeld' }), { cls: 'place small', disabled: p.readyHours > 0 || !p.affordable }));
      row.title = p.description;
      out.push(row, el('div', 'hint', p.description));
    }
    if (s.powerLog.length) out.push(el('div', 'hint', `Lately: ${s.powerLog.slice(0, 3).join(' · ')}`));
  }

  // a nomad tribe's seasonal round
  if (s.nomad) {
    out.push(el('h2', '', 'The seasonal round'));
    const n = s.nomad;
    const where = n.site === 'home' ? 'the home ground' : 'the summer pasture';
    const next = n.nextMoveDays !== null ? ` Breaks camp for ${n.site === 'home' ? 'the summer pasture' : 'the home ground'} in ${n.nextMoveDays < 1 ? `${Math.max(1, Math.round(n.nextMoveDays * 24))}h` : `${Math.round(n.nextMoveDays * 10) / 10} days`}.` : '';
    out.push(
      el(
        'div',
        'hint',
        n.settled
          ? 'Settled: the home ground is a caravan city now, and the tribe travels no more.'
          : `Camped at ${where}.${next} Summer and autumn on the pasture, winter and spring at home; the tents go on the wagons, and the great works stay on the home ground. The tribe settles for good in the Industrial age.`,
      ),
    );
  }

  // the coming days the town knows of (panel/calendarStrip.ts)
  out.push(...renderCalendar(s));

  // where the town puts its effort
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
  // (what it's building, studying and making, and why, is on the overview's cards: dashboard.ts)

  // how raids are fought: down the trail (tower defence) or on a tactics board (sim/tactics.ts; a trial)
  out.push(el('h2', '', 'Raid battles'));
  const styles = el('div', 'row directions');
  for (const [style, name] of [['trail', 'Trail (tower defence)'], ['tactics', 'Tactics board']] as const)
    styles.append(button(name, () => bridge?.command({ type: 'battleStyle', style }), { cls: `place small${s.battleStyle === style ? ' on' : ' quiet'}` }));
  out.push(styles, el('div', 'hint', s.battleStyle === 'tactics' ? 'Raids are fought turn by turn on a board cut from the land round the gate: height, facing and the turn order count. From the next raid.' : 'Raids come down winding trails past the towers to the gate. From the next raid.'));
  const skips = el('div', 'row directions');
  for (const [on, name] of [[false, 'Watch the raids'], [true, 'Skip to the recap']] as const)
    skips.append(button(name, () => bridge?.command({ type: 'skipRaids', on }), { cls: `place small${s.skipRaids === on ? ' on' : ' quiet'}` }));
  out.push(skips, el('div', 'hint', s.skipRaids ? 'Every raid is fought out by the town at once, and you see the recap when it is over.' : 'Raids are fought on screen; a battle\'s Skip button fights it out at once.'));

  // promotions and stat points: put to the player, or the townsfolk's own call (sim/classes.ts, sim/attributes.ts)
  out.push(el('h2', '', 'Promotions and stats'));
  const asks = el('div', 'row directions');
  for (const [what, on, name] of [['evolve', s.evolveAsk, 'Promotions: ask me'], ['evolve', !s.evolveAsk, 'Promotions: they choose'], ['stats', s.statsAsk, 'Stat points: I assign'], ['stats', !s.statsAsk, 'Stat points: auto']] as const)
    asks.append(button(name, () => bridge?.command(what === 'evolve' ? { type: 'setAsk', evolve: name.includes('ask') } : { type: 'setAsk', stats: name.includes('assign') }), { cls: `place small${on ? ' on' : ' quiet'}` }));
  out.push(asks, el('div', 'hint', `${s.evolveAsk ? 'At each stage (levels 12, 30 and 55) a townsperson\'s two roads are put to you; unanswered a day, they choose for themselves.' : 'Townsfolk take whichever road suits their skills, and you hear of it.'} ${s.statsAsk ? 'Each level brings two stat points to place on their Character tab; left two days, they place them their own way.' : 'Stat points are placed as their calling grows.'}`));

  // how big the player wants the town: a handful to know by name, or as many as come
  out.push(el('h2', '', 'Town size'));
  const sizes = el('div', 'row directions');
  for (const n of [...TOWN_SIZES, null]) {
    sizes.append(
      button(n === null ? 'No limit' : `${n}`, () => bridge?.command({ type: 'setTownSize', size: n }), {
        cls: `place small${s.townSize === n ? ' on' : ' quiet'}`,
        title: n === null ? 'Anyone who comes may stay, if you let them' : `Nobody joins or is born once the town holds ${n}`,
      }),
    );
  }
  out.push(
    sizes,
    el(
      'div',
      'hint',
      s.townSize === null
        ? `${s.people.length} people. No limit: the town grows as far as newcomers and children take it.`
        : `${s.people.length} of ${s.townSize}. Once the town holds ${s.townSize}, nobody more joins and no child is born; it grows again only to fill a place left empty.${s.townSize < 20 ? ' A small town draws smaller raids.' : ''}`,
    ),
  );


  // the town's money: travellers bring it in at the shop and the tavern, and it goes on wages, crafters and the venues
  {
    out.push(el('h2', '', `Treasury: ${s.coins} coins`));
    out.push(el('div', 'hint', 'The town\'s purse. The townsfolk keep their own. The treasury pays for public works, study and the guards.'));
    // the tax lever
    const taxes = el('div', 'row directions');
    for (const r of TAX_RATES)
      taxes.append(button(TAX[r].name, () => bridge?.command({ type: 'setTax', rate: r }), { cls: `place small${s.tax === r ? ' on' : ' quiet'}`, title: TAX[r].text }));
    out.push(el('h2', '', 'Tax'), taxes, el('div', 'hint', TAX[s.tax].text));
    out.push(el('h2', '', `Guards: ${s.guards.n} of ${s.guards.wanted}`));
    out.push(el('div', 'hint', s.guards.n ? `${s.guards.names.join(', ')}: ${s.guards.wage} coins a day each, on watch by turns, first to the wall when raiders come.` : s.guards.wanted ? `The treasury hires a guard (${s.guards.wage} coins a day) when it can pay one.` : 'A town this size keeps no guards; one is hired for every six grown-ups, one more on Defence or after a raid.'));
    out.push(el('div', 'hint', s.guards.watch));
    const l = s.ledger;
    if (!l) out.push(el('div', 'hint', 'Travellers passing through fund the town: they buy at the shop and eat and drink at the tavern. A day\'s takings show here from tomorrow.'));
    else {
      const LINES: [keyof NonNullable<typeof l>, string][] = [
        ['shop', 'Travellers at the shop'],
        ['tavern', 'Travellers at the tavern'],
        ['townsfolk', 'The townsfolk (gear, evenings out)'],
        ['meals', 'The townsfolk\'s meals from the stores'],
        ['wages', 'Pay for work (loads brought in, building, study, keeping shop)'],
        ['crafters', 'Crafters, for what they made'],
        ['venues', 'Rooms and improvements'],
        ['goods', 'Goods bought from travellers'],
        ['events', 'Choices the town made (events)'],
        ['rent', 'Rent, and land sold'],
        ['tax', 'Tax'],
        ['guards', 'The guards\' wages'],
        ['bounties', 'Bounties posted (and taken back)'],
        ['realm', 'The realm: gifts, tribute, trade and plunder'],
        ['trade', 'The trade house: wagons, loans and debts'],
        ['ranch', 'The ranch: beasts sold'],
        ['arena', 'The arena: the gate, purses and the treasury\'s bets'],
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

  out.push(...faithSection(s));
  out.push(...villagesSection(s, bridge));
  out.push(...politicsSection(s, bridge));
  out.push(...heritageSection(s));
  out.push(...magicSection(s));

  out.push(...buildMenu(s, bridge, rerender));
  // what stands in town, each tappable (townOverview.ts)
  out.push(...inTown(s, bridge));
  return out;
}

/** The category tab open in the build menu (kept for the session; part of the panel's redraw key). */
let tab: BuildTab = BUILD_TABS[0];
/** The chip the Build list is on (kept for `buildKey`, which hides `tab` behind a parameter of its own). */
let chipTab: BuildTab = tab;

/** One row of the build menu: what to show and what Build does. */
interface Row {
  key: string;
  icon: string | null;
  name: string;
  cost: Stock;
  ordered: boolean;
  /** Orders already at their most: the row can't take another. */
  full?: boolean;
  /** How many the town has of it, going up and queued ("2 built · 1 queued"), or nothing for none. */
  count?: string;
  /** What the row's Build button orders (none for a row with `act`). */
  order?: Command;
  /** A row that starts something on the map in place of an order (Draw a path), with its button's word. */
  act?: { label: string; go: (bridge: Bridge | undefined) => void };
  more: () => More[];
}

/** The build menu (the Buildings tab): what's under way, what the town recommends, then the buildings by category. */
function buildMenu(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Build')];
  out.push(...underway(s, bridge));
  const r = s.recommend;
  if (r) {
    const def = r.def ? BUILDING_BY_ID[r.def] : undefined;
    const ordered = r.def ? s.pins.some((p) => p.def === r.def) : s.ringOrdered;
    const c = el('div', 'card recommend');
    const top = el('div', 'card-top');
    if (r.def) top.append(thumb(r.def, 36, s));
    top.append(el('span', 'card-name', r.name));
    c.append(el('div', 'panel-head', 'Recommended'), top, el('div', 'hint', `${r.why}.`));
    const cost = def ?? BUILDING_BY_ID[WALL_KINDS[0]];
    c.append(costLine(s, cost.cost));
    c.append(button(ordered ? 'Ordered' : 'Build', () => bridge?.command(r.def ? { type: 'pinBuilding', def: r.def, on: true } : { type: 'orderRing' }), { cls: 'place build-btn', disabled: ordered || (!!r.def && s.pins.length >= PINS_MOST) }));
    out.push(c);
  }
  const rows = buildRows(s);
  const tabs = BUILD_TABS.filter((t) => rows.some((r) => r.tab === t));
  if (!tabs.includes(tab) && tabs.length) tab = chipTab = tabs[0];
  const bar = el('div', 'row directions');
  for (const t of tabs) bar.append(button(t, () => { tab = chipTab = t; rerender(); }, { cls: `place small${t === tab ? ' on' : ' quiet'}` }));
  out.push(bar);
  const list = el('div', 'brows');
  for (const row of rows.filter((r) => r.tab === tab)) list.append(buildRow(row, s, bridge));
  out.push(list);
  return out;
}

/** Every row the menu can show, each in its category: what the town has learned to build, then the wall and the streets. */
function buildRows(s: Snapshot): (Row & { tab: BuildTab })[] {
  const have = { unlockAll: s.unlockAll, done: s.research.done, era: s.era, origin: s.origin.id };
  const rows: (Row & { tab: BuildTab })[] = [];
  const known = (b: BuildingDef) => isUnlocked(have, b) && (s.unlockAll || !b.research || (eraReached(s.era, TOPIC_BY_ID[b.research]?.era) && topicKnown(s, b.research)));
  for (const b of BUILDINGS) {
    if (b.never || isRingPiece(b.id) || b.seat || (b.hp && b.width === 1 && !b.defense)) continue;
    if (!known(b)) continue;
    if (b.id === CREATURE_PEN && !s.creature) continue; // (the God creature's pen: shown once the creature is the town's)
    rows.push({ tab: tabOf(b), key: `bld:${b.id}`, icon: b.id, name: b.name, cost: b.cost, ordered: false, full: s.pins.length >= PINS_MOST, count: countOf(s, b.id), order: { type: 'pinBuilding', def: b.id, on: true }, more: () => [el('div', 'more-line', b.purpose), el('div', 'more-line', `Why: ${whyOf(b)}`), ...buildingDetails(b, s)] });
  }
  const wall = s.ringState === 'none' ? 'Raise the palisade' : s.ringState === 'building' ? 'Finish the ring wall' : 'Widen or upgrade the wall';
  // (the wall only once the palisade is studied: before, the order was taken and nothing came of it)
  if (s.ringState !== 'none' || known(BUILDING_BY_ID[WALL_KINDS[0]]))
    rows.push({ tab: 'Defence', key: 'bld:ring', icon: WALL_KINDS[0], name: wall, cost: BUILDING_BY_ID[WALL_KINDS[0]].cost, ordered: s.ringOrdered, order: { type: 'orderRing' }, more: () => ['A wall round the town with gates where the roads cross: raiders have to break it. The town picks the line and works it until it stands. Worth widening once the space inside is mostly built on.'] });
  rows.push(
    { tab: 'Town', key: 'bld:path', icon: null, name: 'Draw a path', cost: {}, ordered: false, act: { label: 'Draw', go: (b) => b?.startPlacement(DRAW_PATH) }, more: () => ['Press where it starts and drag to where it ends: its blueprint shows as you go, and it is laid when you lift your finger. Drag from a path to lift it. The builders pave it as they pave the streets, a bridge over a river taking wood. New buildings are put beside a path where they can be. The town lays no path of its own.'] },
  );
  return rows;
}

/** How many of a building the town has (the owner's ask): standing, going up, and ordered but not yet begun. */
export function countOf(s: Pick<Snapshot, 'buildings' | 'pins'>, def: string): string {
  const built = s.buildings.filter((b) => b.def === def && b.status === 'done').length;
  const up = s.buildings.filter((b) => b.def === def && b.status !== 'done').length;
  const queued = s.pins.filter((p) => p.def === def && !p.building).length;
  return [built && `${built} built`, up && `${up} going up`, queued && `${queued} queued`].filter(Boolean).join(' · ');
}

/** What a cost needs, in words: nothing short gives the cost itself ("Wood 20 · Stone 5"). */
function costLine(s: Snapshot, cost: Stock): HTMLElement {
  const entries = (Object.entries(cost) as [Material, number][]).filter(([, n]) => n);
  const short = entries.filter(([m, n]) => (s.stock[m] ?? 0) < n);
  if (!entries.length) return el('div', 'brow-cost', 'No materials');
  if (short.length) return el('div', 'brow-cost short', `needs ${short.map(([m, n]) => `${amount(n - (s.stock[m] ?? 0))} ${MATERIAL_NAMES[m].toLowerCase()}`).join(', ')}`);
  return el('div', 'brow-cost', entries.map(([m, n]) => `${MATERIAL_NAMES[m]} ${n}`).join(' · '));
}

/** A compact row: icon, name, cost, Build. Tap it for the details. */
function buildRow(row: Row, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const afford = (Object.entries(row.cost) as [Material, number][]).every(([m, n]) => (s.stock[m] ?? 0) >= n);
  const c = el('div', `brow${afford ? '' : ' short'}`);
  const main = el('div', 'brow-main');
  main.append(row.icon ? thumb(row.icon, 28, s) : el('span', 'thumb-gap'));
  const text = el('div', 'brow-text');
  text.append(el('div', 'card-name', row.name), costLine(s, row.cost));
  if (row.count) text.append(el('div', 'brow-count', row.count));
  main.append(text, row.act ? button(row.act.label, () => row.act!.go(bridge), { cls: 'place small' }) : button(row.ordered ? 'Ordered' : 'Build', () => row.order && bridge?.command(row.order), { cls: 'place small', disabled: row.ordered || !!row.full }));
  c.append(main);
  return expandable(c, row.key, row.more);
}

/** What's under way: one small strip for the orders and sites, each with its progress and a cancel. The orders come in
 *  the order they were given, numbered: the next free building slot goes to the first that can be built. */
function underway(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const sites = s.buildings.filter((b) => b.status === 'blueprint');
  const taken = new Set<number>();
  const out: HTMLElement[] = [];
  if (s.pins.length) {
    const waiting = s.pins.filter((p) => !p.building).length;
    out.push(el('div', 'hint queue-head', `Your orders: ${s.pins.length} of ${PINS_MOST}${waiting ? `, ${waiting} waiting their turn` : ''}. Built in this order as building slots (${s.buildSlots}) free up.`));
  }
  const row = (def: string, status: string, progress: number | null, cancel: () => void, n?: number) => {
    const r = el('div', 'queue-row strip');
    r.append(thumb(def, 22, s), el('span', 'queue-name', `${n ? `${n}. ` : ''}${BUILDING_BY_ID[def]?.name ?? def}`), el('span', 'queue-time', status), button('Cancel', cancel, { cls: 'place small' }));
    // (an order still in line has no site yet: no bar, so a long queue stays short)
    if (progress === null) return r;
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(progress * 100)}%`;
    bar.append(fill);
    r.append(bar);
    return r;
  };
  let first = true;
  s.pins.forEach((p, k) => {
    const site = p.building ? (sites.find((b) => b.id === p.site) ?? sites.find((b) => b.def === p.def && !taken.has(b.id))) : undefined;
    if (site) taken.add(site.id);
    const status = site ? siteStatus(site) : p.why && p.why !== SLOT_WAIT ? `waiting: ${p.why}` : first ? 'next up' : 'in line';
    if (!site) first = false;
    out.push(row(p.def, status, site ? site.progress : null, () => {
      bridge?.command({ type: 'pinBuilding', def: p.def, on: false, ...(p.id !== null ? { id: p.id } : {}) });
      if (site) bridge?.command({ type: 'demolish', building: site.id });
    }, k + 1));
  });
  for (const b of sites) if (!taken.has(b.id)) out.push(row(b.def, siteStatus(b), b.progress, () => bridge?.command({ type: 'demolish', building: b.id })));
  return out;
}

function siteStatus(b: Snapshot['buildings'][number]): string {
  const def = BUILDING_BY_ID[b.def];
  const need = (Object.entries(def.cost) as [Material, number][]).filter(([m, n]) => (b.delivered[m] ?? 0) < n);
  return b.progress > 0 ? `${Math.floor(b.progress * 100)}% built` : need.length ? `waiting on ${need.map(([m, n]) => `${MATERIAL_NAMES[m].toLowerCase()} ${Math.floor(b.delivered[m] ?? 0)}/${n}`).join(', ')}` : 'ready to build';
}

/** A building's details (tap its card): its size and age, what it gives the town, what it fights with, the job it
 *  makes, what's made in it, what it grows, and what it becomes. */
function buildingDetails(def: BuildingDef, s: Snapshot): More[] {
  const from = Object.entries(UPGRADES).filter(([, to]) => to === def.id).map(([f]) => BUILDING_BY_ID[f]?.name).filter(Boolean);
  const next = UPGRADES[def.id] ? BUILDING_BY_ID[UPGRADES[def.id]] : undefined;
  const job = OPERATORS[def.id];
  const d = def.defense;
  const crop = CROPS[def.id];
  const made = ITEMS.filter((i) => (i.station as string) === def.id && !i.unique && !i.relic).map((i) => i.name);
  const quirks = d ? [d.splash && 'bursts over those beside', d.slow && `slows ${Math.round(d.slow * 100)}%`, d.burn && 'sets alight', d.chain && `leaps to ${d.chain} more`, d.night && 'deadlier at night', d.rout && 'may rout'].filter(Boolean) : [];
  const standing = s.buildings.filter((b) => b.def === def.id);
  return [
    facts([
      ['Size', `${def.width} × ${depthOf(def)} cells`],
      ['Age', ERA_NAMES[eraOfResearch(def.research)]],
      ['Research', def.research ? (topicName(def.research, s.origin.id)) : 'none'],
      ['Beds', def.housing],
      ['Storage', def.storage],
      ['Morale', def.morale ? `+${def.morale[0]} (${def.morale[1]})` : null],
      ['Health', def.hp],
      ['Healing', def.healing ? `heals the hurt ${def.healing}× as fast` : null],
      ['Raid warning', def.warningMinutes ? `${def.warningMinutes >= 60 ? `${def.warningMinutes / 60} hours` : `${def.warningMinutes} minutes`} ahead` : null],
      ['Draws wanderers', def.arrivals ? `+${Math.round(def.arrivals * 100)}% chance an hour` : null],
      ['Horses', def.stalls ? `stalls for ${def.stalls}` : null],
      ['A venue', def.floor ? `${def.floor.venue === 'tavern' ? 'a tavern' : 'a shop'}${def.floor.line ? ` (${def.floor.line})` : ''}, a floor of ${def.floor.cols} × ${def.floor.rows}, appeal ${def.floor.appeal}` : null],
      ['Defence', d ? `${d.damage[0]}–${d.damage[1]} a hit, every ${d.interval} s, reach ${Math.round((d.range / 32) * 10) / 10} cells, aim ${Math.round(d.accuracy * 100)}%` : null],
      ['Its quirks', quirks.length ? quirks.join(', ') : null],
      ['Job', job ? `${job.title} (${SKILL_NAMES[job.skill]}): ${job.effect.toLowerCase()}` : null],
      ['Built by the shore', def.shore ? 'yes: it must touch water' : null],
      ['Rebuilt from', from.length ? from.join(' or ') : null],
      ['Opens studies', def.seat ? `of the ${ERA_NAMES[def.era ?? 'neolithic']} age: until the seat stands at this stage, that age's research waits` : null],
      ['Grows into', next ? `${next.name}${next.research ? ` (once ${topicName(next.research, s.origin.id)} is learned)` : ''}` : null],
      ['In town', standing.length ? `${standing.filter((b) => b.status === 'done').length} standing${standing.some((b) => b.status !== 'done') ? `, ${standing.filter((b) => b.status !== 'done').length} going up` : ''}` : null],
    ]),
    crop ? facts([['Grows', `${MATERIAL_NAMES[crop.material]}, about ${crop.yield} a harvest`], ['Ripens in', `${crop.growHours} hours in spring and summer${crop.hardy ? ' (and autumn)' : ''}`], ['Indoors', crop.indoor ? 'yes: no seasons, no weather' : null]]) : null,
    list('Made here', made.slice(0, 16).concat(made.length > 16 ? [`and ${made.length - 16} more`] : [])),
  ];
}
