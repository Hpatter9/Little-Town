// The Quests tab (the panel's id is still 'expeditions'; the owner's ask: the old Trips menu reworked). Its sub-tabs
// (subtabs.ts): Out now (tiles at a glance, the parties out, boats, the Calamity), Quests (accepted, offered, sagas,
// the log), Places (the world map, the land's places, the pack's lairs, the destinations; each card one button, the
// rest in its details), Companies (the bonded parties, sim/companies.ts), Realm and Treasures.

import { AIRSHIP_BY_KIND } from '../../shared/data/skies';
import { renderRealm } from './realmPanel';
import { renderMuster } from './musterPanel';
import { acceptedQuests, questBoard, questLog } from './questBoardPanel';
import { goTo } from './townOverview';
import { BOAT_BY_KIND } from '../../shared/data/boats';
import { eraReached } from '../../shared/data/eras';
import { DESTINATIONS, EXPEDITION_TYPE_NAMES, MAX_EXPEDITIONS, ROLES, type Destination, type Role } from '../../shared/data/expeditions';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../../shared/data/materials';
import type { Bridge } from '../../shared/ipc';
import type { DestinationView, ExpeditionView, Snapshot } from '../../shared/sim/snapshot';
import { bleedLeft, tripProgress } from '../../shared/format';
import { button, duration, el } from './dom';
import { WorldMapView } from './worldMapView';
import { ITEM_BY_ID } from '../../shared/data/items';
import { ENEMIES } from '../../shared/data/enemies';
import { SAGA, UNIQUE_FROM, UNIQUES } from '../../shared/data/uniques';
import { packDestination, RIVAL_PACK_BY_ID } from '../../shared/data/pack';
import { FULL_MOON_PHASE } from '../../shared/sim/monsters';
import { ERA_NAMES } from '../../shared/data/eras';
import { DUNGEON_BY_ID } from '../../shared/data/dungeons';
import { REGION_BY_ID } from '../../shared/data/regions';
import { CLASS_DEFS } from '../../shared/data/classes';
import { expandable, facts, groupLine, itemStats, list, stockLine, type More } from './details';
import { topicName } from '../../shared/data/originResearch';

/** Each kind of room, as the card names it. */
const ROOM_NAMES: Record<string, string> = { rival: 'rival delvers', fight: 'a fight', trap: 'a trap', treasure: 'treasure', shrine: 'a shrine', puzzle: 'a puzzle door', camp: 'a rest camp', fork: 'a fork', boss: 'the boss' };

/** The destination picked on the world map (or by tapping its card): flagged, with the route out to it. */
let mapPick: string | null = null;
let rerenderBoard: () => void = () => {};
// picked on the map: flag it, and bring its card into view (once the board has redrawn)
const MARCH_MARK = { feud: '⚑', trade: '🐫', host: '⚔', envoy: '✉', wagon: '🛒' } as const;
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
    s.quests.map((q) => [q.id, q.accepted, q.hoursLeft]),
    s.hunts.hunts.map((h) => [h.id, h.accepted, h.hoursLeft]),
    s.hunts.forge.map((f) => [f.made, f.ready, f.holder]),
    s.questLog.length,
    s.sagas.open.map((g) => [g.run, g.now, g.log.length, g.dest]),
    s.sagas.done.length,
    s.fleet,
    s.airships.map((a) => [a.id, a.hull, a.away]),
    s.muster,
    s.realm,
    s.companies.map((c) => [c.id, c.trips, c.ended, c.out, c.members.length, c.members.filter((m) => m.alive).length]),
    s.greatEnemy && [s.greatEnemy.stage, Math.floor(s.greatEnemy.plan), s.greatEnemy.siegeIn, s.greatEnemy.omen, s.greatEnemy.log.length, s.greatEnemy.lieutenants.map((l) => l.slain), s.greatEnemy.seatOpen],
  ]);

const listStock = (st: Stock) =>
  MATERIALS.filter((m) => (st[m] ?? 0) > 0)
    .map((m) => `${MATERIAL_NAMES[m]} ${st[m]}`)
    .join(', ');

export function renderExpeditions(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement[] {
  rerenderBoard = rerender;
  const out: HTMLElement[] = [];
  // (a party the player is raising: its sheet over everything, musterPanel.ts)
  if (s.muster) out.push(renderMuster(s.muster, s, bridge));

  /* ---- Out now: the quests at a glance, the parties out, the boats, the Calamity */
  out.push(glanceRow(s, bridge, rerender));
  out.push(el('div', 'purpose next-party', `Next: ${s.trips.forming}`));
  if (!s.expeditions.length) out.push(el('div', 'empty', 'No party is out. Adventurers set out of a morning when somewhere calls them; accept a quest or post a bounty to steer them.'));
  for (const e of s.expeditions) out.push(expandable(activeCard(e, s, bridge), `trip:${e.id}`, () => activeDetails(e, s, bridge)));
  // the town's boats (sim/boats.ts): at home fishing, or out with a party
  if (s.fleet.length) {
    out.push(el('h2', '', 'Boats'));
    for (const b of s.fleet) out.push(el('div', 'hint', `The ${b.name} (${BOAT_BY_KIND[b.kind].name.toLowerCase()}, hull ${b.hull}/${b.max}): ${b.away === null ? (b.hull < b.max / 2 ? 'mending at the boatyard' : 'at home, fishing') : `sailed for ${b.away}`}`));
  }
  // the town's airships (sim/skies.ts): moored at the mast, or carrying a party
  if (s.airships.length) {
    out.push(el('h2', '', 'Airships'));
    for (const a of s.airships) out.push(el('div', 'hint', `The ${a.name} (${AIRSHIP_BY_KIND[a.kind].name.toLowerCase()}, hull ${a.hull}/${a.max}): ${a.away === null ? (a.hull < a.max / 2 ? 'mending at the mast' : 'moored at the mast, ready to fly') : `flying for ${a.away}`}`));
  }
  // the Great Enemy (sim/greatEnemy.ts): its stage, its plan's progress, its lieutenants, its seat, and the Calamity it
  // sends ahead of itself (sim/calamity.ts: one story, one card)
  if (s.greatEnemy && s.greatEnemy.stage !== 'dormant') out.push(...greatEnemySection(s, bridge));

  /* ---- Quests: those accepted first, then the offers, the sagas, the log (questBoardPanel.ts) */
  out.push(...acceptedQuests(s, bridge));
  out.push(...questBoard(s, bridge));
  out.push(...sagaList(s, bridge));
  out.push(...questLog(s));

  /* ---- Places: the map, then what's on the town's own land, the pack's lairs, the world's places */
  out.push(el('h2', '', 'Places'));
  // destinations from eras the town hasn't reached stay off the board (and off the map)
  // (and so do places in regions the scouts haven't mapped, and the scouting trips to regions they have)
  const shown = DESTINATIONS.filter((d) => (s.unlockAll || eraReached(s.era, d.era)) && !s.destinations.find((v) => v.id === d.id)?.hidden);
  worldMap.update(
    shown.map((d) => ({ id: d.id, name: d.name, unlocked: !!s.destinations.find((v) => v.id === d.id)?.unlocked })),
    mapPick,
    s.expeditions,
    s.regions,
    s.realm.factions.filter((f) => f.known).map((f) => ({ id: f.id, name: f.name, stronghold: f.stronghold, stance: f.stance, stanceName: f.stanceName, assault: f.assault, folk: f.folk, size: f.size, tier: f.tier })),
    s.world,
    s.greatEnemy && s.greatEnemy.stage !== 'dormant' ? s.greatEnemy : null,
  );
  out.push(worldMap.el, el('div', 'hint map-hint', 'Tap a place on the map to find its card. Tap a card for more: the foes, the loot, a bounty, or forbidding it.'));
  // the realm on the move (sim/worldLife.ts): hosts, caravans and envoys on the roads, and the powers' feuds
  if (s.world.marches.length || s.world.feuds.length)
    out.push(el('div', 'hint world-news', [...s.world.feuds.map((f) => `⚔ ${f.a} and ${f.b} are at war.`), ...s.world.marches.map((m) => `${MARCH_MARK[m.kind]} ${m.label}`)].join(' ')));
  // the places found on the town's own land that want a party (sim/places.ts)
  const nearby = s.places.filter((p) => p.dest).map((p) => p.dest!);
  if (nearby.length) {
    out.push(el('h2', '', "On the town's land"));
    const near = el('div', 'cards wide');
    for (const d of nearby) near.append(destinationCard(d, s.destinations.find((v) => v.id === d.id)!, s, bridge));
    out.push(near);
  }
  // the Moon Pack: its renown, the moon, the rival packs' lairs a war party can break (sim/pack.ts)
  if (s.pack) out.push(...packSection(s, bridge));
  const open = shown.filter((d) => s.destinations.find((v) => v.id === d.id)?.unlocked);
  const locked = shown.filter((d) => !s.destinations.find((v) => v.id === d.id)?.unlocked);
  out.push(el('h2', '', 'Destinations'));
  const grid = el('div', 'cards wide');
  for (const d of open) grid.append(destinationCard(d, s.destinations.find((v) => v.id === d.id)!, s, bridge));
  out.push(grid);
  if (locked.length) {
    out.push(el('h2', '', 'Not yet reachable'));
    const box = el('div', 'locked-list');
    for (const d of locked) {
      const v = s.destinations.find((q) => q.id === d.id)!;
      const r = el('div', 'locked-row');
      r.dataset.dest = d.id;
      r.append(el('span', 'locked-name', d.name), el('span', 'locked-why', v.quietHours ? `cleared: wakes in ${Math.ceil(v.quietHours / 24)} d` : d.research ? `needs ${topicName(d.research, s.origin.id)}` : 'not yet'));
      box.append(r);
    }
    out.push(box);
  }

  /* ---- Companies: the bonded parties (sim/companies.ts), and who would set out */
  out.push(...companiesSection(s));

  /* ---- Realm and Treasures */
  out.push(...renderRealm(s, bridge));
  out.push(...guildForge(s));
  out.push(...treasures(s));
  return out;
}

/** The tiles along the top: parties out, quests, companies, each a way to its tab. */
function glanceRow(s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement {
  const grid = el('div', 'glance quests-glance');
  const tile = (label: string, value: string, sub: string, tab: string | null, warn = false) => {
    const t = el(tab ? 'button' : 'div', `glance-tile${warn ? ' warn' : ''}`);
    t.append(el('span', 'glance-label', label), el('span', 'glance-value', value));
    if (sub) t.append(el('span', 'glance-sub', sub));
    if (tab) t.addEventListener('click', () => goTo(bridge, 'expeditions', 'expeditions', tab, rerender));
    grid.append(t);
  };
  const fighting = s.expeditions.some((e) => e.battle);
  tile('Out now', `${s.expeditions.length}/${MAX_EXPEDITIONS}`, fighting ? 'a party is fighting!' : s.expeditions.length ? 'parties on the road' : 'all at home', null, fighting);
  const accepted = s.quests.filter((q) => q.accepted).length + s.hunts.hunts.filter((h) => h.accepted).length;
  const offered = s.quests.filter((q) => !q.accepted).length + s.hunts.hunts.filter((h) => !h.accepted).length;
  const urgent = [...s.quests, ...s.hunts.hunts].some((q) => q.accepted && q.hoursLeft < 24);
  tile('Quests', `${accepted}`, `accepted${offered ? ` · ${offered} offered` : ''}${s.sagas.open.length ? ` · ${s.sagas.open.length} saga` : ''}`, 'Quests', urgent);
  const companies = s.companies.filter((c) => c.ended === null).length;
  tile('Companies', `${companies}`, `${s.trips.adventurers} adventurer${s.trips.adventurers === 1 ? '' : 's'} · ${s.trips.fit} fit`, 'Companies');
  return grid;
}

/** A party out: where they're going and how far along, who leads, and Watch (Recall is in its details). */
function activeCard(e: ExpeditionView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const c = el('div', `card arrival${e.battle ? ' fighting' : ''}`);
  c.dataset.dest = e.dest;
  const phase = e.battle ? 'Fighting!' : e.waiting ? 'Waiting on you' : e.phase === 'out' ? 'Heading out' : e.phase === 'work' ? (e.delve ? 'Down in the dark' : 'At the site') : e.recalled ? 'Recalled' : 'Heading home';
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', e.destName), el('span', 'card-size', phase));
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.round(tripProgress(e) * 100)}%`;
  bar.append(fill);
  const lead = e.leader ?? e.members[0]?.name;
  const others = e.members.length - 1;
  const company = s.companies.find((k) => k.ended === null && e.members.filter((m) => k.members.some((x) => x.id === m.id)).length >= 2);
  const down = e.members.filter((m) => s.people.find((p) => p.id === m.id)?.downed).length;
  c.append(top, bar, el('div', 'purpose', `${company ? `${company.name}: ` : ''}${lead}${others ? ` and ${others} other${others > 1 ? 's' : ''}` : ''} · home in ${duration(e.secondsLeft)}${down ? ` · ${down} down` : ''}${e.bounty ? ` · bounty ${e.bounty}` : ''}`));
  if (e.delve) c.append(el('div', 'lock short', e.delve.cleared ? 'Cleared! Bringing the hoard home.' : e.delve.room ? `Room ${e.delve.room} of ${e.delve.rooms}${e.delve.kind ? ` (${ROOM_NAMES[e.delve.kind] ?? e.delve.kind})` : ''} · ${e.delve.torches} torch${e.delve.torches === 1 ? '' : 'es'} left` : `${e.delve.torches} torches for ${e.delve.rooms} rooms`));
  if (e.wrecked) c.append(el('div', 'lock short', 'Wrecked: swimming for home.'));
  if (e.crashed) c.append(el('div', 'lock short', 'Their airship came down: walking home.'));
  // (watch them: the town view gives way to the party on the road and their fights, as in the old games)
  const row = el('div', 'row stakes');
  row.append(
    button(e.battle ? 'Watch the fight' : 'Watch', () => {
      bridge?.command({ type: 'watch', expedition: e.id });
      bridge?.closePanel();
    }, { cls: 'place go', title: 'Follow the party on the road and watch their fights.' }),
  );
  c.append(row);
  return c;
}

function destinationCard(d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const c = el('div', v.unlocked ? 'card dest' : 'card dest locked');
  c.dataset.dest = d.id;
  if (d.id === mapPick) c.classList.add('chosen');
  c.addEventListener('click', () => pick(d.id));
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', d.name), el('span', 'card-size', `${EXPEDITION_TYPE_NAMES[d.type]} · ~${duration(v.tripSeconds)}`));
  c.append(top);
  // what matters at a glance: the danger, and anything about it now (a party there, a bounty, a quest, forbidden)
  const going = s.expeditions.find((e) => e.dest === d.id);
  const chips = el('div', 'dest-chips');
  const chip = (text: string, cls = '') => chips.append(el('span', `dest-chip ${cls}`, text));
  chip(d.threats ? `⚔ ${d.threats}` : 'Peaceful', d.threats ? 'threat' : '');
  if (going) chip(`Party there${going.leader ? `: ${going.leader}` : ''}`, 'ok');
  if (v.bounty) chip(`Bounty ${v.bounty}`, 'gold');
  if (s.quests.some((q) => q.dungeon === d.id)) chip('Quest', 'gold');
  if (v.vetoed) chip('Forbidden', 'bad');
  if (!v.scouted) chip('Unexplored');
  if (v.cleared) chip(`Cleared ×${v.cleared}`);
  if (d.coins) chip(`Purse ${d.coins}`, (s.coins ?? 0) < d.coins ? 'bad' : '');
  c.append(chips);
  if (!v.unlocked) {
    c.append(el('div', 'lock short', v.quietHours ? `Cleared: it lies quiet, and wakes again in about ${Math.ceil(v.quietHours / 24)} day${v.quietHours > 24 ? 's' : ''}.` : d.research ? `Needs research: ${topicName(d.research, s.origin.id)}` : 'Not reachable yet.'));
    return expandable(c, `dest:${d.id}`, () => destDetails(d, v, s));
  }
  if (v.boat && !going && v.byBoat && v.boat.startsWith('Needs') && !v.airship) c.append(el('div', 'lock short', v.boat));
  if (v.airship && !going && v.bySky && v.airship.startsWith('Needs')) c.append(el('div', 'lock short', v.airship));
  // one thing to do from the card: send a party (the rest, forbidding and bounties, are in its details)
  if (!going && !v.vetoed) {
    const row = el('div', 'row stakes');
    row.append(button('Send a party…', () => bridge?.command({ type: 'muster', op: 'raise', dest: d.id }), { cls: 'place go', disabled: !!s.muster || s.expeditions.length >= MAX_EXPEDITIONS, title: 'Choose who goes, how boldly, and what they take' }));
    c.append(row);
  }
  return expandable(c, `dest:${d.id}`, () => [tripControls(d, v, s, bridge), ...destDetails(d, v, s)]);
}

/* ------------------------------------------------------------ the details (tap a card: details.ts) */

const pct = (v: number) => `${Math.round(v * 100)}%`;

/** A place on the board: how far, what's found there, who may be met and how likely, and for a dungeon its rooms,
 *  bosses and hoard. */
function destDetails(d: Destination, v: DestinationView, s: Snapshot): More[] {
  const dg = DUNGEON_BY_ID[d.id];
  const groups = d.encounters?.groups ?? [];
  const weight = groups.reduce((n, g) => n + g.weight, 0) || 1;
  const loot = (Object.entries(d.loot) as [Material, number][]).map(([m, odds]) => `${MATERIAL_NAMES[m]}${v.scouted ? ` (${pct(odds)})` : ' (?)'}`);
  const going = s.expeditions.find((e) => e.dest === d.id);
  return [
    facts([
      ['Kind', EXPEDITION_TYPE_NAMES[d.type]],
      ['Age', ERA_NAMES[d.era ?? 'neolithic']],
      ['Round trip', `about ${duration(v.tripSeconds)}`],
      ['Each way', duration(d.outSeconds)],
      ['Work there', duration(d.workSeconds)],
      ['Region', dg ? REGION_BY_ID[dg.region]?.name : null],
      ['Rooms', dg ? `${dg.rooms} before the boss's` : null],
      ['Research', d.research ? (topicName(d.research, s.origin.id)) : null],
      ['Purse', d.coins ? `${d.coins} coins from the treasury` : null],
      ['By boat', d.byBoat ? 'only a boat (or an airship) reaches it' : null],
      ['By air', d.bySky ? 'only an airship reaches it' : null],
      ['Party', `${d.recommendedParty} suggested`],
      ['A fight there', d.encounters ? pct(d.encounters.arrival) : null],
      ['Ambush going home', d.encounters ? pct(d.encounters.ambush) : null],
      ['Bounty', v.bounty ? `${v.bounty} coins` : null],
      ['Now', going ? `a party is there${going.leader ? `, led by ${going.leader}` : ''}` : v.vetoed ? 'forbidden' : null],
    ]),
    list('Who may be met', groups.map((g) => `${groupLine(g.enemies as Record<string, number>)} · ${pct(g.weight / weight)}`)),
    dg ? list('Deeper down', dg.foes.map((g) => groupLine(g))) : null,
    dg ? list('Who may wait at the bottom', dg.bosses.map((g) => groupLine(g))) : null,
    list(v.scouted ? 'What is found there (odds a load)' : 'What may be found (not scouted yet)', loot),
    d.guaranteed ? `Always brought back: ${stockLine(d.guaranteed)}.` : null,
    dg ? `The hoard at the bottom: ${stockLine(dg.hoard)}.` : null,
    ...s.quests.filter((q) => q.dungeon === d.id).map((q) => `Quest: ${q.title}. ${q.reward}`),
  ];
}

/** A saga under way: what it's about, where it stands, and the whole story so far. */
function sagaDetails(g: Snapshot['sagas']['open'][number]): More[] {
  return [g.blurb, facts([['Began', `day ${g.began}`], ['Now', g.now]]), list('The story so far', g.story)];
}

/** A party out: each member's health, calling and level, what they've found and packed, and a delve's log. */
function activeDetails(e: ExpeditionView, s: Snapshot, bridge: Bridge | undefined): More[] {
  const lines = e.members.map((m) => {
    const p = s.people.find((q) => q.id === m.id);
    if (!p) return m.name;
    const state = p.downed ? (p.downed === 'bleeding' ? `bleeding out (${bleedLeft(p.bleedMinutes)})` : 'down') : `${Math.round(p.hp)}/${p.maxHp} health`;
    return `${p.name}: ${p.cls ? `${p.clsName}, level ${p.level}` : `level ${p.level}`} · ${ROLES[(e.roles[m.id] ?? 'fighter') as Role].name} · ${state}${p.gear.weapon ? ` · ${ITEM_BY_ID[p.gear.weapon]?.name ?? ''}` : ''}`;
  });
  return [
    facts([
      ['Home in', duration(e.secondsLeft)],
      ['Leader', e.leader],
      ['Stakes', e.stakes ? (e.stakes === 'risky' ? 'risky: bold, more fights, bigger packs' : 'safe: careful, fewer fights') : null],
      ['Carrying', `${e.lootSize} of ${e.carry}`],
      ['Boat', e.boat ? `the ${e.boat.name}, hull ${e.boat.hull}/${e.boat.max}` : null],
      ['Airship', e.airship ? `the ${e.airship.name}, hull ${e.airship.hull}/${e.airship.max}` : null],
    ]),
    list('The party', lines),
    e.lootSize ? `Found so far: ${listStock(e.loot)}.` : null,
    `Packed food: ${listStock(e.supplies) || 'none'}.`,
    e.delve?.twist ? `${e.delve.twist}: ${e.delve.twistText}` : null,
    e.delve ? list('Down in the dark', e.delve.log) : null,
    e.battle ? list('In the fight', e.battle.map((f) => `${f.side === 'enemy' ? '⚔ ' : ''}${f.name}: ${f.down ? 'down' : `${f.hp}/${f.maxHp}`}`)) : null,
    e.phase !== 'back' && !e.battle ? button('Recall them', () => bridge?.command({ type: 'recallExpedition', expedition: e.id }), { cls: 'place quiet', title: 'Turn them around. They still have to walk back.' }) : null,
  ];
}

/** A unique or forged piece: what it does, at its best. */
function pieceDetails(id: string): More[] {
  const d = ITEM_BY_ID[id];
  if (!d) return [];
  const from = (UNIQUE_FROM[id] ?? []).map((b) => ENEMIES[b]?.name).filter(Boolean);
  const wielders = Object.values(CLASS_DEFS)
    .filter((c) => d.family && c.weapons.includes(d.family as never))
    .map((c) => c.stages[0]);
  return [
    list('What it does', itemStats(d)),
    facts([
      ['Slot', d.slot],
      ['Tier', d.tier],
      ['Dropped by', from.length ? from.join(' or ') : null],
    ]),
    wielders.length ? `Callings that wield it: ${wielders.join(', ')}.` : null,
  ];
}

/** In a place's details: forbid it, or have the treasury post a bounty on it (sim/parties.ts). */
function tripControls(d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const box = el('div', 'dest-controls');
  if (v.boat) box.append(el('div', 'lock short', v.boat));
  if (v.airship) box.append(el('div', 'lock short', v.airship));
  const step = s.trips.bountyStep;
  const row = el('div', 'row stakes');
  row.append(
    button(v.bounty ? `Raise bounty +${step}` : `Post bounty ${step}`, () => bridge?.command({ type: 'bounty', dest: d.id, post: true }), {
      disabled: v.vetoed || (s.coins ?? 0) < step,
      title: `The treasury sets ${step} coins aside for the party that does the job here. The adventurers go after the biggest bounty they can take on.`,
    }),
  );
  if (v.bounty) row.append(button('Withdraw', () => bridge?.command({ type: 'bounty', dest: d.id, post: false }), { cls: 'place quiet', title: 'The coins go back to the treasury.' }));
  row.append(
    button(v.vetoed ? 'Allow' : 'Forbid', () => bridge?.command({ type: 'veto', dest: d.id, on: !v.vetoed }), {
      cls: v.vetoed ? 'place' : 'place quiet',
      title: v.vetoed ? 'Let parties choose this place again.' : 'No party will choose this place (a bounty on it is taken back).',
    }),
  );
  box.append(row, el('div', 'hint', `${d.description}`));
  return box;
}

/** The Moon Pack: its renown, the moon, and the rival packs' lairs a war party can break (sim/pack.ts). */
function packSection(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const k = s.pack!;
  const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
  const out: HTMLElement[] = [el('h2', '', 'The pack')];
  const nights = FULL_MOON_PHASE - k.moon;
  out.push(el('div', 'hint', `Renown ${k.renown} · ${k.hunts} hunt${k.hunts === 1 ? '' : 's'} run · ${k.grounds} hunting ground${k.grounds === 1 ? '' : 's'} · the moon is ${nights === 0 ? 'full tonight: the pack hunts' : `full in ${nights} night${nights === 1 ? '' : 's'}`}.`));
  out.push(el('div', 'hint', k.beast === 'slain' ? 'The Pale Behemoth has fallen to the pack.' : k.beast === 'due' ? 'The Pale Behemoth is abroad: the next hunt may meet it.' : "The Pale Behemoth will show itself once the pack's renown reaches 10. Break every rival pack and bring it down to win the Great Hunt."));
  const lairs = el('div', 'cards wide');
  for (const r of k.packs) {
    if (r.broken) {
      out.push(el('div', 'hint', `${cap(r.name)}: broken. Their hills are the pack's hunting ground.`));
      continue;
    }
    const d = packDestination(RIVAL_PACK_BY_ID[r.id]);
    const v = s.destinations.find((q) => q.id === d.id);
    if (v) lairs.append(destinationCard(d, v, s, bridge));
  }
  if (lairs.childElementCount) out.push(lairs);
  return out;
}

/** The bonded parties (sim/companies.ts): each with its members, trips and deeds; and who would set out next. */
function companiesSection(s: Snapshot): HTMLElement[] {
  const out: HTMLElement[] = [el('h2', '', 'Companies')];
  out.push(el('div', 'hint', `${s.trips.adventurers} adventurer${s.trips.adventurers === 1 ? '' : 's'} in town · ${s.trips.fit} fit to go · ${s.trips.room} more may be away. Friends go out together; when the same few go out and come home together twice, they name themselves and go out together again.`));
  if (!s.companies.length) {
    out.push(el('div', 'empty', 'No company yet.'));
    return out;
  }
  const grid = el('div', 'cards wide');
  for (const k of s.companies) {
    const c = el('div', `card company${k.ended !== null ? ' ended' : ''}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', k.name), el('span', 'card-size', k.ended !== null ? `broken up, day ${k.ended}` : k.out ? `out at ${k.out}` : 'at home'));
    const who = el('div', 'company-who');
    for (const m of k.members) who.append(el('span', `company-member${m.alive ? '' : ' dead'}`, m.alive ? m.name : `✝ ${m.name}`));
    c.append(top, who, el('div', 'purpose', `${k.trips} trip${k.trips === 1 ? '' : 's'} together · ${k.wins} done well${k.deeds.length ? ` · last: ${k.deeds.at(-1)!.replace(/^Day \d+: /, '')}` : ''}`));
    grid.append(
      expandable(c, `company:${k.id}`, () => [
        facts([
          ['Formed', `day ${k.formed}`],
          ['Trips', k.trips],
          ['Done well', k.wins],
          ['Now', k.ended !== null ? `broken up on day ${k.ended}` : k.out ? `out at ${k.out}` : 'at home'],
        ]),
        list('Its members', k.members.map((m) => `${m.alive ? '' : '✝ '}${m.name}${m.calling ? `, ${m.calling}` : ''}${m.level ? ` (level ${m.level})` : ''}`)),
        list('Its deeds', [...k.deeds].reverse()),
      ]),
    );
  }
  out.push(grid);
  return out;
}

/** The Monster Hunters' Guild: the hunts on its board (stars, purse, parts), and its forge's one-of-a-kind gear. */
/** "Raise a party…" on a quest's, a hunt's or a saga's card (the owner's complaint: the Quests tab had no way to send
 *  one): the same muster as the places' cards, for the place the quest is at. */
function raiseFor(dest: string, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const row = el('div', 'row stakes');
  const going = s.expeditions.some((e) => e.dest === dest);
  const v = s.destinations.find((x) => x.id === dest);
  row.append(button(going ? 'A party is on its way' : 'Send a party…', () => bridge?.command({ type: 'muster', op: 'raise', dest }), {
    cls: 'place go',
    disabled: going || !!s.muster || s.expeditions.length >= MAX_EXPEDITIONS || (v ? !v.unlocked : false),
    title: 'Choose who goes, how boldly, and what they take',
  }));
  return row;
}

/** The guild's forge: the one-of-a-kind gear made from the hunts' parts (the hunts themselves are on the quest board). */
function guildForge(s: Snapshot): HTMLElement[] {
  const g = s.hunts;
  const out: HTMLElement[] = [];
  if (!g.guild) {
    out.push(el('h2', '', 'Guild forge'), el('div', 'hint', "Once the town learns Monster Lore it raises a Monster Hunters' Guild. The guild posts hunts on the quest board, one to five stars, with a purse to match; the hunters bring home the monsters' parts, and the guild forges them into gear there is only one of."));
    return out;
  }
  out.push(el('h2', '', `Guild forge${g.won ? ` · ${g.won} hunts won` : ''}`));
  const forge = el('div', 'cards wide');
  for (const f of g.forge) {
    const c = el('div', `card unique${f.made ? '' : ' unmade'}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', f.name), el('span', 'card-size', f.made ? (f.holder ? `Carried by ${f.holder}` : 'Forged') : f.ready ? 'Ready to forge' : 'Not yet'));
    c.append(top, el('div', 'purpose', ITEM_BY_ID[f.id]?.description ?? ''));
    if (!f.made) c.append(el('div', 'lock short', `Wants ${f.makings}`));
    forge.append(expandable(c, `forge:${f.id}`, () => [...pieceDetails(f.id), f.made ? null : `The guild forges it once ${f.makings} are in the stores.`]));
  }
  out.push(forge);
  return out;
}

const OUTCOME: Record<string, string> = { triumph: 'Triumph', bittersweet: 'Bittersweet', ruin: 'Ruin' };

/** The sagas: the stories under way (where each stands, its last lines, its place on the board) and those ended. */
function sagaList(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const { open, done } = s.sagas;
  const out: HTMLElement[] = [el('h2', '', 'Sagas')];
  if (!open.length && !done.length) {
    out.push(el('div', 'hint', 'Now and then a story finds the town: a burnt cart on the road, a bell under the sea, a crown in the dirt. The town takes it up itself, two at a time; the parties go where the story needs them.'));
    return out;
  }
  const grid = el('div', 'cards wide');
  for (const g of open) {
    const c = el('div', 'card quest saga');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', g.title), el('span', 'card-size', 'Under way'));
    c.append(top, el('div', 'purpose', g.now));
    for (const line of g.log.slice(-2)) c.append(el('div', 'lock short', line));
    if (g.dest) {
      const dest = g.dest;
      c.append(raiseFor(dest, s, bridge));
      c.addEventListener('click', () => pick(dest));
    }
    grid.append(expandable(c, `saga:${g.run}`, () => sagaDetails(g)));
  }
  for (const g of done.slice(-6).reverse()) {
    const c = el('div', `card quest saga ${g.outcome}`);
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', g.title), el('span', 'card-size', `${OUTCOME[g.outcome]}, day ${g.day}`));
    c.append(top);
    if (g.hero) c.append(el('div', 'lock short', `Its hero: ${g.hero}`));
    grid.append(expandable(c, `sagadone:${g.title}:${g.day}`, () => [g.blurb, facts([['Ended', `day ${g.day}`], ['How', OUTCOME[g.outcome]], ['Its hero', g.hero]])]));
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
    else if (UNIQUE_FROM[u.id]?.includes(SAGA)) c.append(el('div', 'lock short', 'The prize of a saga'));
    grid.append(expandable(c, `unique:${u.id}`, () => pieceDetails(u.id)));
  }
  out.push(grid);
  const left = UNIQUES.length - s.uniques.length;
  if (left) out.push(el('div', 'hint', `${left} more are still out there, carried by bosses, or waiting at the end of a quest.`));
  return out;
}

/** The Great Enemy's card: its name and stage, its plan's progress toward the last siege, what comes next, its
 *  lieutenants and the powers fallen to it, the story so far, and its places to strike at (sim/greatEnemy.ts). */
function greatEnemySection(s: Snapshot, bridge?: Bridge): HTMLElement[] {
  const g = s.greatEnemy!;
  const out: HTMLElement[] = [el('h2', '', 'The Great Enemy')];
  const card = el('div', `card enemy-card ${g.stage}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', g.name), el('span', 'card-size', g.stageName));
  card.append(top);
  const done = g.stage === 'peace' || g.stage === 'fallen';
  if (!done) {
    const bar = el('div', 'dread');
    const fill = el('div', 'dread-fill');
    fill.style.width = `${Math.min(100, (g.plan / 52) * 100)}%`;
    bar.append(fill);
    card.append(bar);
  }
  card.append(el('div', 'purpose', done ? g.next : `${g.seatKnown ? `In ${g.seat}. ` : ''}${g.next}${g.pace > 1.05 ? ' Its outposts left standing hasten it.' : g.pace < 0.95 ? ' The town\'s learning and faith slow it.' : ''}`));
  if (g.siegeIn !== null) card.append(el('div', 'purpose dread-warn', `The last siege comes in ${g.siegeIn} hour${g.siegeIn === 1 ? '' : 's'}.`));
  if (g.omen && !done) card.append(el('div', 'hint', `The latest omen: ${g.omen}`));
  if (g.stage !== 'omens' && g.stage !== 'dormant') card.append(el('div', 'hint', `Its lieutenants: ${g.lieutenants.map((l) => (l.slain ? `${l.name} (slain)` : `${l.name} at ${l.outpost.replace(/^The /, 'the ')}`)).join('; ')}.`));
  if (g.thralls.length) card.append(el('div', 'hint', `Fallen to it: ${g.thralls.join(', ')}.`));
  const c = s.calamity && !done ? s.calamity : null;
  if (c) {
    const bits = [`${c.nests} nest${c.nests === 1 ? '' : 's'} known on the land`, `${c.wards} ward stone${c.wards === 1 ? '' : 's'}`];
    if (c.cultists) bits.push('a cult hides in the town');
    card.append(el('div', 'hint', `Its Calamity, ${c.name}: ${c.stageName.toLowerCase()}. ${bits.join(' · ')}. ${c.dest ? `${c.heart}, its forward seat, can be struck at: a blow there sets its plan back.` : 'Every nest burned out and every ward stone slows it.'}`));
  }
  out.push(
    expandable(card, 'enemy', () => [
      facts([
        ['Its goal', g.goal],
        ['How it fights', g.way],
        ['Its seat', g.seatKnown ? `${g.seat}${g.seatOpen ? ': open to an expedition' : ''}` : 'Not yet found'],
        ['Pace', `${g.pace}× ${g.pace === 1 ? '' : g.pace > 1 ? '(hastened)' : '(slowed)'}`],
        ['Its Calamity', c ? `${c.name}: ${c.stageName}` : null],
        ['Its forward seat', c && c.heartAt ? (c.heartOpen ? `${c.heart}${c.keeper ? `, held by ${c.keeper}` : ''}: open to a party` : `${c.heart}: gathering itself again`) : null],
        ['Blight', c && c.scar ? `${Math.round(c.scar)} cells round ${c.heart}` : null],
        ['Sieges lost', g.lost ? `${g.lost} of 2` : null],
        ['The town\'s title', g.title],
        ['Slain by', g.slayer],
        ['Old enemy', g.vengeance ? `It broke ${g.vengeance}'s town` : null],
      ]),
      list('The story so far', g.log.map((l) => `Day ${l.day}: ${l.text}.`)),
      list('The arc', ['Omens: signs, dreams, travellers lost, a stranger\'s warning.', 'Omens also bring its Calamity, waking far off; the Calamity spreads after the stirring (its forward seat can be struck at; a cult takes root).', 'Stirring: its blight creeps in, its agents, marked raids, powers fall, its lieutenants take outposts.', 'The march: its lieutenants lead hosts; it demands tribute.', 'The last siege: it comes itself. Strike it down for a lasting peace; lose twice and the town falls.']),
    ]),
  );
  const cards = el('div', 'cards wide');
  for (const d of g.dests) {
    const v = s.destinations.find((x) => x.id === d.id);
    if (!v) continue;
    const dc = destinationCard(d, v, s, bridge);
    dc.dataset.dest = d.id;
    cards.append(dc);
  }
  const heart = c?.dest ? s.destinations.find((v) => v.id === 'calamity:heart') : undefined;
  if (c?.dest && heart) {
    const hc = destinationCard(c.dest, heart, s, bridge);
    hc.dataset.dest = c.dest.id;
    cards.append(hc);
  }
  if (cards.childElementCount) out.push(cards);
  return out;
}

