// The Town menu (the old Build tab, the panel id 'build'): the town at a glance and the player's levers (direction, size,
// powers), what's being built and what stands, the stores (craftingPanel.ts renderStores), the treasury, and a book of
// every building it knows. The town builds for itself.

import { calendarKey, renderCalendar } from './calendarStrip';
import { faithKey, faithSection } from './faithPanel';
import { villagesSection } from './villagesPanel';
import { politicsSection } from './politicsPanel';
import { heritageKey, heritageSection } from './heritagePanel';
import { magicSection } from './magicPanel';
import { TOWN_SIZES } from '../../shared/sim/state';
import { TAX, TAX_RATES } from '../../shared/data/economy';
import { BUILDING_BY_ID, BUILDINGS, type BuildingDef } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { eraReached } from '../../shared/data/eras';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { eraOfResearch, TOPIC_BY_ID } from '../../shared/data/research';
import { PINS_MOST } from '../../shared/sim/pins';
import { isRingPiece } from '../../shared/sim/ringWall';
import { BUILD_KINDS, kindOf } from './buildKinds';
import type { Bridge } from '../../shared/ipc';
import { DIRECTION_DEFS, DIRECTIONS } from '../../shared/sim/planner';
import { blueprintCount, isUnlocked } from '../../shared/sim/buildings';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { thumb } from './structure';
import { materialIcon } from '../art/materialIcons';
import { hiddenNote, HidePrefs } from './hide';
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
    hide.key,
    s.theme,
    on(['Overview'], () => [s.powers.map((p) => [p.id, Math.ceil(p.readyHours), Math.ceil(p.activeHours), p.held, p.affordable]), s.powerLog[0], s.nomad && [s.nomad.site, s.nomad.settled, Math.ceil((s.nomad.nextMoveDays ?? 0) * 24)], s.lichOffer, heritageTiles()]),
    on(['Overview'], () => [dashboardKey(s), s.why?.research, s.why?.craft]),
    on(['Overview'], () => calendarKey(s)),
    on(['Overview', 'Treasury'], () => s.coins),
    on(['Treasury'], () => ledgerKey(s)),
    s.guards.n, s.guards.watch, !!s.shop, !!s.tavern, s.era, s.research.revealed, s.buildSlots, s.unlockAll, s.research.done, s.storageCapacity, s.housing, s.direction, s.plan,
    Math.round(s.align.score / 2), Math.round(s.align.order / 2), s.align.title, s.align.pact, s.align.swings[0],
    on(['Villages'], () => s.villages.map((v) => [v.pop, v.loyalty, v.rebel, v.beset, v.helpers, v.cartOut, v.road, v.goods, v.news[0], v.canGift])),
    s.politics && [s.politics.tax, on(['Council'], () => [s.politics!.blocs.map((b) => [b.sat, b.members.length, b.wants, b.striking]), s.politics!.laws.map((l) => l.on), s.politics!.log[0], s.politics!.crimes, s.politics!.strike, s.politics!.edictWait])],
    s.buildings.map((b) => [b.def, b.status, on(['Buildings'], () => Math.floor(b.progress * 20))]),
    on(['Our ways', 'Magic'], () => heritageKey(s)),
    on(['Overview', 'Faith'], () => faithKey(s)),
    s.skipRaids,
    s.pins.map((p) => [p.def, p.building, Math.floor(p.progress * 20), p.why]),
  ]);
};

export function renderBuild(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  const used = blueprintCount(s);
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
  // what the town chose to do, and why (sim/whyLines.ts)
  for (const w of [s.why?.build, s.why?.research, s.why?.craft]) if (w) out.push(el('div', 'why-line', w));

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

  // evolutions and stat points: put to the player, or the town's own call (sim/classes.ts, sim/attributes.ts)
  out.push(el('h2', '', 'Callings and stats'));
  const asks = el('div', 'row directions');
  for (const [what, on, name] of [['evolve', s.evolveAsk, 'Evolutions: ask me'], ['evolve', !s.evolveAsk, 'Evolutions: they choose'], ['stats', s.statsAsk, 'Stat points: I assign'], ['stats', !s.statsAsk, 'Stat points: auto']] as const)
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
    out.push(el('div', 'hint', 'The founder\'s purse. The townsfolk keep their own: they earn by their work, buy land and build, and pay rent and tax. The treasury pays for the public works, the study, and the guards.'));
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

  // what's ordered and under way (the player's orders first, then the town's own), each with a cancel
  out.push(...ordersBlock(s, bridge, used));

  out.push(...faithSection(s));
  out.push(...villagesSection(s, bridge));
  out.push(...politicsSection(s, bridge));
  out.push(...heritageSection(s));
  out.push(...magicSection(s));

  // everything it can build now: tap Build and the town picks the spot (sim/pins.ts, the planner's own placement)
  out.push(
    el('h2', '', 'Build: pick one'),
    el('div', 'hint', 'Tap Build: the town picks the spot and its builders put it up ahead of its own plans.'),
    hide.row([['built', 'Built', 'Hide the buildings the town already has'], ['locked', "Can't build yet", 'Hide the buildings still waiting on research']], rerender),
  );
  let hidden = 0;
  const known = BUILDINGS.filter((b) => !b.never && !isRingPiece(b.id) && !b.seat && !(b.hp && b.width === 1 && !b.defense) && (s.unlockAll || !b.research || (eraReached(s.era, TOPIC_BY_ID[b.research]?.era) && topicKnown(s, b.research))));
  for (const kind of BUILD_KINDS) {
    const all = known.filter((b) => kindOf(b) === kind);
    const shown = all.filter(
      (b) =>
        !(hide.has('built') && s.buildings.some((q) => q.def === b.id && q.status === 'done')) &&
        !(hide.has('locked') && !isUnlocked({ unlockAll: s.unlockAll, done: s.research.done, era: s.era, origin: s.origin.id }, b)),
    );
    hidden += all.length - shown.length;
    if (!shown.length) continue;
    out.push(el('h2', '', `Build: ${kind}`));
    const grid = el('div', 'cards');
    for (const def of shown) grid.append(card(def, s, bridge));
    out.push(grid);
  }
  out.push(...hiddenNote(hidden));
  // what stands in town, each tappable (townOverview.ts)
  out.push(...inTown(s, bridge));
  return out;
}

/** What to hide in the list of buildings (kept across visits, per phone). */
const hide = new HidePrefs('littletown.buildHide', ['built', 'locked'] as const);

/** What's ordered and under way: the player's orders (waiting, or going up), then the town's own sites. Cancel takes an
 *  order back and clears its site. */
function ordersBlock(s: Snapshot, bridge: Bridge | undefined, used: number): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Being built'), el('div', 'hint', `${used} of ${s.buildSlots} building slots in use.`)];
  const sites = s.buildings.filter((b) => b.status === 'blueprint');
  const taken = new Set<number>();
  const row = (def: string, status: string, progress: number, cancel: () => void) => {
    const r = el('div', 'queue-row');
    r.append(thumb(def, 28, s), el('span', 'queue-name', BUILDING_BY_ID[def]?.name ?? def), el('span', 'queue-time', status), button('Cancel', cancel, { cls: 'place small' }));
    const bar = el('div', 'bar');
    const fill = el('div', 'bar-fill');
    fill.style.width = `${Math.floor(progress * 100)}%`;
    bar.append(fill);
    r.append(bar);
    return r;
  };
  for (const p of s.pins) {
    const site = p.building ? sites.find((b) => b.def === p.def && !taken.has(b.id)) : undefined;
    if (site) taken.add(site.id);
    out.push(row(p.def, site ? siteStatus(site) : p.why ? `waiting: ${p.why}` : 'ordered: next up', site?.progress ?? 0, () => {
      bridge?.command({ type: 'pinBuilding', def: p.def, on: false });
      if (site) bridge?.command({ type: 'demolish', building: site.id });
    }));
  }
  for (const b of sites) if (!taken.has(b.id)) out.push(row(b.def, siteStatus(b), b.progress, () => bridge?.command({ type: 'demolish', building: b.id })));
  if (!out.some((e) => e.classList.contains('queue-row'))) out.push(el('p', 'empty', 'Nothing ordered or under way.'));
  return out;
}

function siteStatus(b: Snapshot['buildings'][number]): string {
  const def = BUILDING_BY_ID[b.def];
  const need = (Object.entries(def.cost) as [Material, number][]).filter(([m, n]) => (b.delivered[m] ?? 0) < n);
  return b.progress > 0 ? `${Math.floor(b.progress * 100)}% built` : need.length ? `waiting on ${need.map(([m, n]) => `${MATERIAL_NAMES[m].toLowerCase()} ${b.delivered[m] ?? 0}/${n}`).join(', ')}` : 'ready to build';
}

function card(def: BuildingDef, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const unlocked = isUnlocked({ unlockAll: s.unlockAll, done: s.research.done, era: s.era, origin: s.origin.id }, def);
  const c = el('div', unlocked ? 'card' : 'card locked');
  const top = el('div', 'card-top');
  top.append(thumb(def.id, 36, s), el('span', 'card-name', def.name));
  const cost = el('div', 'cost');
  let canPay = true;
  for (const [m, n] of Object.entries(def.cost) as [Material, number][]) {
    const have = (s.stock[m] ?? 0) >= n;
    canPay = canPay && have;
    const chip = el('span', have ? 'chip' : 'chip short', `${MATERIAL_NAMES[m]} ${n}`);
    const icon = materialIcon(m);
    if (icon) chip.prepend(icon);
    cost.append(chip);
  }
  c.append(top, cost, el('div', 'purpose', def.purpose));
  if (!unlocked) c.append(el('div', 'lock', `Needs research: ${topicName(def.research!, s.origin.id)}`));
  else {
    const n = s.buildings.filter((b) => b.def === def.id && b.status === 'done').length;
    c.append(el('div', 'lock', `${canPay ? 'In the stores now' : 'Not all in the stores yet: the town gathers it'}${n ? ` · ${n} in town` : ''}`));
    const ordered = s.pins.some((p) => p.def === def.id);
    c.append(button(ordered ? 'Ordered' : 'Build', () => bridge?.command({ type: 'pinBuilding', def: def.id, on: true }), { cls: 'place build-btn', disabled: ordered || s.pins.length >= PINS_MOST }));
  }
  return expandable(c, `bld:${def.id}`, () => buildingDetails(def, s));
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
