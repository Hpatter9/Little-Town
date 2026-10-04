// Expedition Board: parties that are out, and where you can send one next.

import { eraReached } from '../../shared/data/eras';
import { DESTINATIONS, EXPEDITION_TYPE_NAMES, MAX_EXPEDITIONS, MAX_PARTY, ROLES, STANCES, type Destination, type Role, type Stance } from '../../shared/data/expeditions';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../../shared/data/materials';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import type { DestinationView, ExpeditionView, Snapshot } from '../../shared/sim/snapshot';
import { bleedLeft, tripProgress } from '../../shared/format';
import { button, duration, el } from './dom';
import { WorldMapView } from './worldMapView';
import { ITEM_BY_ID } from '../../shared/data/items';
import { ENEMIES } from '../../shared/data/enemies';
import { UNIQUE_FROM, UNIQUES } from '../../shared/data/uniques';
import { packDestination, RIVAL_PACK_BY_ID } from '../../shared/data/pack';
import { FULL_MOON_PHASE } from '../../shared/sim/monsters';

/** Each kind of room, as the card names it. */
const ROOM_NAMES: Record<string, string> = { rival: 'rival delvers', fight: 'a fight', trap: 'a trap', treasure: 'treasure', shrine: 'a shrine', puzzle: 'a puzzle door', camp: 'a rest camp', fork: 'a fork', boss: 'the boss' };

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
    s.trips,
    s.coins,
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
    s.regions,
    s.quests.map((q) => [q.id, Math.ceil(q.hoursLeft / 24)]),
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
  // (and so do places in regions the scouts haven't mapped, and the scouting trips to regions they have)
  const shown = DESTINATIONS.filter((d) => (s.unlockAll || eraReached(s.era, d.era)) && !s.destinations.find((v) => v.id === d.id)?.hidden);
  worldMap.update(
    shown.map((d) => ({ id: d.id, name: d.name, unlocked: !!s.destinations.find((v) => v.id === d.id)?.unlocked })),
    mapPick,
    s.expeditions,
    s.regions,
  );
  out.push(worldMap.el, el('div', 'hint map-hint', 'Tap a place on the map, or a destination below, to mark it.'));
  // parties form themselves: who would set out next, and why not
  out.push(el('h2', '', 'Parties'));
  out.push(el('div', 'purpose', s.trips.forming));
  out.push(el('div', 'hint', `${s.trips.adventurers} adventurer${s.trips.adventurers === 1 ? '' : 's'} in town · ${s.trips.fit} fit to go · ${s.trips.room} more may be away · treasury ${s.coins ?? 0} coins. Adventurers choose where to go, and a bounty draws them to a place. Forbid a place to keep them from it.`));
  for (const e of s.expeditions) {
    const card = activeCard(e, s, bridge);
    card.addEventListener('click', () => pick(e.dest));
    out.push(card);
  }
  // the places found on the town's own land that want a party (sim/places.ts)
  const nearby = s.places.filter((p) => p.dest).map((p) => p.dest!);
  if (nearby.length) {
    out.push(el('h2', '', 'On the town\'s land'));
    const near = el('div', 'cards wide');
    for (const d of nearby) {
      const card = destinationCard(d, s.destinations.find((v) => v.id === d.id)!, s, bridge);
      card.dataset.dest = d.id;
      near.append(card);
    }
    out.push(near);
  }
  // the Moon Pack: its renown, the moon, the rival packs' lairs a war party can break (sim/pack.ts)
  if (s.pack) {
    const k = s.pack;
    const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
    out.push(el('h2', '', 'The pack'));
    const nights = FULL_MOON_PHASE - k.moon;
    out.push(el('div', 'hint', `Renown ${k.renown} · ${k.hunts} hunt${k.hunts === 1 ? '' : 's'} run · ${k.grounds} hunting ground${k.grounds === 1 ? '' : 's'} · the moon is ${nights === 0 ? 'full tonight: the pack hunts' : `full in ${nights} night${nights === 1 ? '' : 's'}`}.`));
    out.push(el('div', 'hint', k.beast === 'slain' ? 'The Pale Behemoth has fallen to the pack.' : k.beast === 'due' ? 'The Pale Behemoth is abroad: the next hunt may meet it.' : 'The Pale Behemoth will show itself once the pack\'s renown reaches 10. Break every rival pack and bring it down to win the Great Hunt.'));
    const lairs = el('div', 'cards wide');
    for (const r of k.packs) {
      if (r.broken) {
        out.push(el('div', 'hint', `${cap(r.name)}: broken. Their hills are the pack's hunting ground.`));
        continue;
      }
      const d = packDestination(RIVAL_PACK_BY_ID[r.id]);
      const v = s.destinations.find((q) => q.id === d.id);
      if (!v) continue;
      const card = destinationCard(d, v, s, bridge);
      card.dataset.dest = d.id;
      lairs.append(card);
    }
    if (lairs.childElementCount) out.push(lairs);
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
  out.push(...questList(s));
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
  if (e.leader || e.bounty) c.append(el('div', 'purpose', `${e.leader ? `Led by ${e.leader}` : ''}${e.leader && e.bounty ? ' · ' : ''}${e.bounty ? `after a bounty of ${e.bounty} coins` : ''}`));
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
  if (e.delve) {
    const kind = e.delve.kind ? ROOM_NAMES[e.delve.kind] ?? e.delve.kind : null;
    c.append(el('div', 'purpose', e.delve.cleared ? 'Cleared! Heading home with the hoard.' : e.delve.room ? `Room ${e.delve.room} of ${e.delve.rooms}${kind ? ` (${kind})` : ''} · ${e.delve.torches} torch${e.delve.torches === 1 ? '' : 'es'} left` : `${e.delve.torches} torches packed for ${e.delve.rooms} rooms`));
    if (e.delve.twist) c.append(el('div', 'lock short', `${e.delve.twist}: ${e.delve.twistText}`));
    const last = e.delve.log.at(-1);
    if (last) c.append(el('div', 'lock short', last));
  }
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
  c.append(el('div', 'lock', `Threats: ${d.threats} · Suggested party: ${d.recommendedParty}${d.coins ? ` · Purse: ${d.coins} coins${(s.coins ?? 0) < d.coins ? ` (the town has ${s.coins ?? 0})` : ''}` : ''}`));
  if (!v.unlocked) {
    // (a cleared dungeon lies quiet a while; else it's waiting on research)
    if (v.quietHours) c.append(el('div', 'lock short', `Cleared: it lies quiet now, and wakes again in about ${Math.ceil(v.quietHours / 24)} day${v.quietHours > 24 ? 's' : ''}.`));
    else c.append(el('div', 'lock short', `Needs research: ${TOPIC_BY_ID[d.research!]?.name ?? d.research}`));
    return c;
  }
  return tripControls(c, d, v, s, bridge);
}

/** Parties form themselves (sim/parties.ts): the player may forbid a place, or have the treasury post a bounty on it. */
function tripControls(c: HTMLElement, d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  if (v.cleared) c.append(el('div', 'purpose', `Cleared ${v.cleared} time${v.cleared === 1 ? '' : 's'}: it wakes deeper each time.`));
  for (const q of s.quests.filter((q) => q.dungeon === d.id)) c.append(el('div', 'lock', `Quest: ${q.title} (${Math.ceil(q.hoursLeft / 24)} days left)`));
  const going = s.expeditions.find((e) => e.dest === d.id);
  if (v.vetoed) c.append(el('div', 'lock short', 'Forbidden: no party will go here.'));
  else if (going) c.append(el('div', 'purpose', `A party is there now${going.leader ? `, led by ${going.leader}` : ''}.`));
  if (v.bounty) c.append(el('div', 'purpose', `Bounty: ${v.bounty} coins from the treasury, paid to the party that does the job.`));
  const step = s.trips.bountyStep;
  const row = el('div', 'row stakes');
  row.append(
    button(v.vetoed ? 'Allow' : 'Forbid', () => bridge?.command({ type: 'veto', dest: d.id, on: !v.vetoed }), {
      cls: v.vetoed ? 'place' : 'place quiet',
      title: v.vetoed ? 'Let parties choose this place again.' : 'No party will choose this place (a bounty on it is taken back).',
    }),
    button(v.bounty ? `Raise bounty +${step}` : `Post bounty ${step}`, () => bridge?.command({ type: 'bounty', dest: d.id, post: true }), {
      disabled: v.vetoed || (s.coins ?? 0) < step,
      title: `The treasury sets ${step} coins aside for the party that does the job here. The adventurers go after the biggest bounty they can take on.`,
    }),
  );
  if (v.bounty) row.append(button('Withdraw', () => bridge?.command({ type: 'bounty', dest: d.id, post: false }), { cls: 'place quiet', title: 'The coins go back to the treasury.' }));
  c.append(row);
  return c;
}

/** The quests open, each for a dungeon: clear it while it's open, and the reward comes home with the party. */
function questList(s: Snapshot): HTMLElement[] {
  if (!s.quests.length) return [];
  const out: HTMLElement[] = [el('h2', '', 'Quests')];
  const grid = el('div', 'cards wide');
  for (const q of s.quests) {
    const c = el('div', 'card quest');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', q.title), el('span', 'card-size', `${Math.ceil(q.hoursLeft / 24)} days left`));
    c.append(top, el('div', 'purpose', q.text), el('div', 'lock short', 'Clear the dungeon while the quest is open; the reward comes home with the party.'));
    c.addEventListener('click', () => pick(q.dungeon));
    grid.append(c);
  }
  out.push(grid);
  return out;
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
