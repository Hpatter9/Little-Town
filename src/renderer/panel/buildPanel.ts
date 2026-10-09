// The Town menu (the old Build tab, the panel id 'build'): the town at a glance and the player's levers (direction, size,
// powers), what's being built and what stands, the stores (craftingPanel.ts renderStores), the treasury, and a book of
// every building it knows. The town builds for itself.

import { faithSection } from './faithPanel';
import { villagesSection } from './villagesPanel';
import { politicsSection } from './politicsPanel';
import { BUILD_PACE } from '../../shared/data/economy';
import { buildSkill } from '../../shared/sim/property';
import { TOWN_SIZES } from '../../shared/sim/state';
import { TAX, TAX_RATES } from '../../shared/data/economy';
import { ADJACENT_TILES, BUILDING_BY_ID, BUILDINGS, LAYER_NAMES, NEAR_SOURCE, NEAR_SOURCE_BONUS, RIVER_GROWTH, TAVERN_MARKET_MORALE, type BuildLayer, type BuildingDef } from '../../shared/data/buildings';
import { CROPS } from '../../shared/data/crops';
import { earlier, eraReached } from '../../shared/data/eras';
import { MATERIAL_NAMES, type Material } from '../../shared/data/materials';
import { eraOfResearch, TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import { DIRECTION_DEFS, DIRECTIONS } from '../../shared/sim/planner';
import { blueprintCount, isUnlocked } from '../../shared/sim/buildings';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, duration, el } from './dom';
import { materialIcon } from '../art/materialIcons';
import { BUILD_MULTIPLIER } from '../../shared/sim/state';
import { hiddenNote, HidePrefs } from './hide';
import { glance, inTown } from './townOverview';
import { topicKnown } from './secrets';
import { expandable, facts, list, type More } from './details';
import { UPGRADES } from '../../shared/data/buildings';
import { OPERATORS } from '../../shared/data/operators';
import { ITEMS } from '../../shared/data/items';
import { ERA_NAMES } from '../../shared/data/eras';
import { depthOf } from '../../shared/sim/buildings';
import { SKILL_NAMES } from '../../shared/data/skills';

/** Changes whenever something this panel shows changes. */
export const buildKey = (s: Snapshot) =>
  JSON.stringify([hide.key, s.powers.map((p) => [p.id, Math.ceil(p.readyHours), Math.ceil(p.activeHours), p.held, p.affordable]), s.powerLog[0], s.nomad && [s.nomad.site, s.nomad.settled, Math.ceil((s.nomad.nextMoveDays ?? 0) * 24)], s.lichOffer, s.theme, s.coins, s.ledger, !!s.shop, !!s.tavern, s.era, s.research.revealed, s.buildSlots, s.stock, s.unlockAll, s.research.done, s.storageCapacity, s.housing, s.direction, s.plan, s.villages.map((v) => [v.pop, v.loyalty, v.rebel, v.beset, v.helpers, v.cartOut, v.goods, v.news[0], v.canGift]), s.politics && [s.politics.blocs.map((b) => [b.sat, b.members.length, b.wants, b.striking]), s.politics.laws.map((l) => l.on), s.politics.log[0], s.politics.crimes, s.politics.strike, s.politics.tax], s.buildings.map((b) => [b.def, b.status, Math.floor(b.progress * 20)])]);

export function renderBuild(s: Snapshot, bridge: Bridge | undefined, rerender: () => void = () => {}): HTMLElement[] {
  const used = blueprintCount(s);
  // the town at a glance first (townOverview.ts): every tile a way in
  const out: HTMLElement[] = [...glance(s, bridge, rerender)];

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

  // how raids are fought: down the trail (tower defence) or on a tactics board (sim/tactics.ts; a trial)
  out.push(el('h2', '', 'Raid battles'));
  const styles = el('div', 'row directions');
  for (const [style, name] of [['trail', 'Trail (tower defence)'], ['tactics', 'Tactics board']] as const)
    styles.append(button(name, () => bridge?.command({ type: 'battleStyle', style }), { cls: `place small${s.battleStyle === style ? ' on' : ' quiet'}` }));
  out.push(styles, el('div', 'hint', s.battleStyle === 'tactics' ? 'Raids are fought turn by turn on a board cut from the land round the gate: height, facing and the turn order count. From the next raid.' : 'Raids come down winding trails past the towers to the gate. From the next raid.'));

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
  out.push(el('div', 'hint', `It builds ${s.buildSlots} at once (${used} under way now), and decides for itself what and where.`));
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

  // what stands in town, each tappable (townOverview.ts)
  out.push(...inTown(s, bridge));
  out.push(...faithSection(s));
  out.push(...villagesSection(s, bridge));
  out.push(...politicsSection(s));

  // everything it knows how to build (for reference: it decides for itself)
  out.push(
    el('h2', '', 'Building book'),
    el('div', 'hint', 'Every building the town knows how to make, and what each is for. It builds them itself, as it needs them.'),
    hide.row(
      [
        ['built', 'Built', 'Hide the buildings the town already has'],
        ['locked', "Can't build yet", 'Hide the buildings still waiting on research'],
      ],
      rerender,
    ),
  );
  let hidden = 0;
  for (const layer of ['fore', 'mid', 'back'] as BuildLayer[]) {
    // buildings from eras the town hasn't reached stay hidden
    const known = BUILDINGS.filter((b) => b.layer === layer && !b.never && (s.unlockAll || !b.research || (eraReached(s.era, TOPIC_BY_ID[b.research]?.era) && topicKnown(s, b.research))));
    const shown = known.filter(
      (b) =>
        !(hide.has('built') && s.buildings.some((q) => q.def === b.id && q.status === 'done')) &&
        !(hide.has('locked') && !isUnlocked({ unlockAll: s.unlockAll, done: s.research.done, era: s.era, origin: s.origin.id }, b)),
    );
    hidden += known.length - shown.length;
    if (!shown.length) continue;
    out.push(el('h2', '', LAYER_NAMES[layer]));
    const grid = el('div', 'cards');
    for (const def of shown) grid.append(card(def, s));
    out.push(grid);
  }
  out.push(...hiddenNote(hidden));
  return out;
}

/** What to hide in the list of buildings (kept across visits, per phone). */
const hide = new HidePrefs('littletown.buildHide', ['built', 'locked'] as const);

function card(def: BuildingDef, s: Snapshot): HTMLElement {

  const unlocked = isUnlocked({ unlockAll: s.unlockAll, done: s.research.done, era: s.era, origin: s.origin.id }, def);
  const c = el('div', unlocked ? 'card' : 'card locked');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', def.name), el('span', 'card-size', `${def.width} wide · ~${duration(def.buildSeconds * BUILD_PACE * BUILD_MULTIPLIER[earlier(s.era, eraOfResearch(def.research))])} of work · Construction ${buildSkill(def)}+`));
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
      ['Research', def.research ? (TOPIC_BY_ID[def.research]?.name ?? def.research) : 'none'],
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
      ['Grows into', next ? `${next.name}${next.research ? ` (once ${TOPIC_BY_ID[next.research]?.name ?? next.research} is learned)` : ''}` : null],
      ['In town', standing.length ? `${standing.filter((b) => b.status === 'done').length} standing${standing.some((b) => b.status !== 'done') ? `, ${standing.filter((b) => b.status !== 'done').length} going up` : ''}` : null],
    ]),
    crop ? facts([['Grows', `${MATERIAL_NAMES[crop.material]}, about ${crop.yield} a harvest`], ['Ripens in', `${crop.growHours} hours in spring and summer${crop.hardy ? ' (and autumn)' : ''}`], ['Indoors', crop.indoor ? 'yes: no seasons, no weather' : null]]) : null,
    list('Made here', made.slice(0, 16).concat(made.length > 16 ? [`and ${made.length - 16} more`] : [])),
    'The town decides for itself what to build and where (the Plan tab sets its direction).',
  ];
}

/** Where it does best (adjacency bonuses), if anywhere in particular. */
function placementTip(def: BuildingDef): string | null {
  const sources = NEAR_SOURCE[def.id];
  if (sources) return `Works ${Math.round((NEAR_SOURCE_BONUS - 1) * 100)}% faster within ${ADJACENT_TILES} tiles of a ${sources.map((id) => BUILDING_BY_ID[id].name).join(' or ')}.`;
  if (def.id === 'tavern') return `Livelier (+${TAVERN_MARKET_MORALE} morale) within ${ADJACENT_TILES} tiles of a Market Stall.`;
  if (CROPS[def.id] && !CROPS[def.id].indoor) return `Grows ${Math.round((RIVER_GROWTH - 1) * 100)}% faster beside a river.`;
  return null;
}

