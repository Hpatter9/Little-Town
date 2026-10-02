// Expedition Board: parties that are out, and where you can send one next.

import { eraReached } from '../../shared/data/eras';
import { DESTINATIONS, EXPEDITION_TYPE_NAMES, MAX_EXPEDITIONS, MAX_PARTY, ROLES, STANCES, type Destination, type Role, type Stance } from '../../shared/data/expeditions';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../../shared/data/materials';
import { FOOD_VALUE } from '../../shared/data/people';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import type { DestinationView, ExpeditionView, Snapshot } from '../../shared/sim/snapshot';
import { bleedLeft, tripProgress } from '../../shared/format';
import { button, duration, el } from './dom';
import { WorldMapView } from './worldMapView';
import { ITEM_BY_ID } from '../../shared/data/items';
import { ENEMIES } from '../../shared/data/enemies';
import { UNIQUE_FROM, UNIQUES } from '../../shared/data/uniques';

/** The destination picked on the world map (or by tapping its card): flagged, with the route out to it. */
let mapPick: string | null = null;
let rerenderBoard: () => void = () => {};
// picked on the map: flag it, and bring its card into view (once the board has redrawn)
const worldMap = new WorldMapView((id) => {
  mapPick = id;
  rerenderBoard();
  setTimeout(() => document.querySelector<HTMLElement>(`[data-dest="${id}"]`)?.scrollIntoView({ block: 'center' }), 0);
});
const pick = (id: string) => {
  if (mapPick === id) return;
  mapPick = id;
  rerenderBoard();
};

export const expeditionsKey = (s: Snapshot) =>
  JSON.stringify([
    mapPick,
    s.expeditions.map((e) => [e.id, e.phase, Math.floor(e.phaseProgress * 50), e.lootSize, e.recalled, e.waiting, e.battle?.map((f) => [f.hp, f.down])]),
    s.era,
    s.destinations,
    s.people.map((p) => [p.id, p.away, p.skills.gathering.level, p.skills.melee.level, p.skills.ranged.level, Math.round(p.hp), p.downed, p.bleedMinutes]),
    s.stock.berries,
    s.stock.meat,
    s.items.truck,
    s.stock.fuel,
    s.horses,
    s.uniques,
  ]);

const listStock = (st: Stock) =>
  MATERIALS.filter((m) => (st[m] ?? 0) > 0)
    .map((m) => `${MATERIAL_NAMES[m]} ${st[m]}`)
    .join(', ');

export function renderExpeditions(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  rerenderBoard = rerender;
  const out: HTMLElement[] = [];
  const head = el('div', 'panel-head');
  head.append(el('span', '', `Expeditions out ${s.expeditions.length}/${MAX_EXPEDITIONS}`), el('span', '', `Parties of up to ${MAX_PARTY}`));
  out.push(head);
  // destinations from eras the town hasn't reached stay off the board (and off the map)
  const shown = DESTINATIONS.filter((d) => s.unlockAll || eraReached(s.era, d.era));
  worldMap.update(
    shown.map((d) => ({ id: d.id, name: d.name, unlocked: !!s.destinations.find((v) => v.id === d.id)?.unlocked })),
    mapPick,
    s.expeditions,
  );
  out.push(worldMap.el, el('div', 'hint map-hint', 'Tap a place on the map, or a destination below, to mark it.'));
  for (const e of s.expeditions) {
    const card = activeCard(e, s, bridge);
    card.addEventListener('click', () => pick(e.dest));
    out.push(card);
  }
  out.push(el('h2', '', 'Destinations'));
  const grid = el('div', 'cards wide');
  for (const d of shown) {
    const card = destinationCard(d, s.destinations.find((v) => v.id === d.id)!, s, bridge);
    card.dataset.dest = d.id;
    if (d.id === mapPick) card.classList.add('chosen');
    card.addEventListener('click', () => pick(d.id));
    grid.append(card);
  }
  out.push(grid);
  out.push(...treasures(s));
  out.push(el('div', 'hint', 'Fighters stand in front; scouts, medics and porters in back. Parties fall back when hurt past their stance, or when you are badly hurt. The downed bleed out unless a medic tends them.'));
  return out;
}

function activeCard(e: ExpeditionView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const c = el('div', 'card arrival');
  const phase = e.battle
    ? 'Fighting!'
    : e.waiting
      ? 'Waiting for your decision'
      : e.phase === 'out'
        ? 'Heading out'
        : e.phase === 'work'
          ? 'Working the site'
          : e.recalled
            ? 'Recalled, heading home'
            : 'Heading home';
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', e.destName), el('span', 'card-size', `${phase} · home in ${duration(e.secondsLeft)}`));
  const who = e.members.map((m) => {
    const p = s.people.find((q) => q.id === m.id);
    const hp = p ? (p.downed ? (p.downed === 'bleeding' ? ` (bleeding out: ${bleedLeft(p.bleedMinutes)})` : ' (down)') : ` ${Math.round(p.hp)}/${p.maxHp}`) : '';
    return `${m.name} · ${ROLES[(e.roles[m.id] ?? 'fighter') as Role].name}${hp}`;
  });
  c.append(top, el('div', 'lock', `${who.join(' | ')} · ${e.stakes ? (e.stakes === 'risky' ? 'Risky' : 'Safe') : STANCES[e.stance as Stance].name}${e.truck ? ' · by truck' : ''}`));
  if (e.battle) {
    const foes = e.battle.filter((f) => f.side === 'enemy');
    c.append(el('div', 'lock short', `Against: ${foes.map((f) => `${f.name}${f.down ? ' (down)' : ` ${f.hp}/${f.maxHp}`}`).join(', ')}`));
  }
  const whole = tripProgress(e);
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.round(whole * 100)}%`;
  bar.append(fill);
  c.append(bar);
  c.append(el('div', 'purpose', `Loot ${e.lootSize}/${e.carry}${e.lootSize ? ': ' + listStock(e.loot) : ''}`));
  c.append(el('div', 'purpose', `Packed food: ${listStock(e.supplies) || 'none'}`));
  // (watch them: the town view gives way to the party on the road and their fights, as in the old games)
  c.append(
    button(
      'Watch',
      () => {
        bridge?.command({ type: 'watch', expedition: e.id });
        bridge?.closePanel();
      },
      { title: 'Follow the party on the road and watch their fights.' },
    ),
  );
  if (e.phase !== 'back' && !e.battle) c.append(button('Recall', () => bridge?.command({ type: 'recallExpedition', expedition: e.id }), { cls: 'place quiet', title: 'Turn them around. They still have to walk back.' }));
  return c;
}

function destinationCard(d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const c = el('div', v.unlocked ? 'card' : 'card locked');
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', d.name), el('span', 'card-size', `${EXPEDITION_TYPE_NAMES[d.type]} · ~${duration(v.tripSeconds)} round trip`));
  c.append(top, el('div', 'purpose', d.description));
  const loot = Object.keys(d.loot) as Material[];
  const lootText = v.scouted ? loot.map((m) => MATERIAL_NAMES[m]).join(', ') : loot.map((m) => `${MATERIAL_NAMES[m]}?`).join(', ');
  const extra = Object.keys(d.guaranteed ?? {}).map((m) => MATERIAL_NAMES[m as Material]);
  c.append(el('div', 'purpose', `Loot: ${lootText}${extra.length ? ` + ${extra.join(', ')}` : ''}${v.scouted ? '' : ' (not scouted)'}`));
  c.append(el('div', 'lock', `Threats: ${d.threats} · Suggested party: ${d.recommendedParty}`));
  if (!v.unlocked) {
    c.append(el('div', 'lock short', `Needs research: ${TOPIC_BY_ID[d.research!]?.name ?? d.research}`));
    return c;
  }

  // The town plans the party (who goes, their roles, horses, a truck); the player picks only the stakes
  const party = v.party;
  const extras = [v.partyHorses ? `${v.partyHorses} horse${v.partyHorses === 1 ? '' : 's'}` : '', v.partyTruck ? 'a truck' : ''].filter(Boolean);
  c.append(el('div', 'purpose', party.length ? `The town would send ${party.join(', ')}${extras.length ? `, with ${extras.join(' and ')}` : ''}.` : 'Nobody is fit to go (the town keeps half its people at home).'));
  const foodHave = (Object.keys(FOOD_VALUE) as Material[]).reduce((n, m) => n + (s.stock[m] ?? 0) * FOOD_VALUE[m]!, 0);
  if (party.length && foodHave < v.foodPerMember * party.length) c.append(el('div', 'lock short', 'Not enough food in storage: they will go hungry on the road'));
  const full = s.expeditions.length >= MAX_EXPEDITIONS;
  const row = el('div', 'row stakes');
  const send = (stakes: 'safe' | 'risky') => bridge?.command({ type: 'sendParty', dest: d.id, stakes });
  row.append(
    button(full ? 'Too many out' : 'Send: safe', () => send('safe'), { disabled: full || !party.length, title: 'A cautious party: packs light, keeps clear of trouble, and falls back early.' }),
    button(full ? 'Too many out' : 'Send: risky', () => send('risky'), { disabled: full || !party.length, cls: 'place danger', title: 'A bold party: loads up half again as much, and goes looking for trouble.' }),
  );
  c.append(row);
  return c;
}

/** The unique weapons found so far, who carries each, and how many are still out there (with the bosses). */
function treasures(s: Snapshot): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', `Unique weapons ${s.uniques.length}/${UNIQUES.length}`)];
  if (!s.uniques.length) {
    out.push(el('div', 'hint', 'Every boss carries something: a purse of coins, its trophy, and now and then a unique weapon, one of a kind in all the world. Slay them, on the road or at the gate.'));
    return out;
  }
  const grid = el('div', 'cards wide');
  for (const u of s.uniques) {
    const d = ITEM_BY_ID[u.id];
    if (!d) continue;
    const c = el('div', 'card unique');
    const top = el('div', 'card-top');
    const from = (UNIQUE_FROM[u.id] ?? []).map((b) => ENEMIES[b]?.name).filter(Boolean);
    top.append(el('span', 'card-name', d.name), el('span', 'card-size', u.holder ? `Carried by ${u.holder}` : 'In storage'));
    c.append(top, el('div', 'purpose', d.description));
    if (from.length) c.append(el('div', 'lock short', `From ${from.join(' or ')}`));
    grid.append(c);
  }
  out.push(grid);
  const left = UNIQUES.length - s.uniques.length;
  if (left) out.push(el('div', 'hint', `${left} more are still out there, carried by bosses, or waiting at the end of a quest.`));
  return out;
}
