// Expedition Board: parties that are out, and where you can send one next.

import { eraReached } from '../../shared/data/eras';
import { HORSE_CARRY, HORSE_HP } from '../../shared/data/trade';
import { DESTINATIONS, EXPEDITION_TYPE_NAMES, MAX_EXPEDITIONS, MAX_PARTY, ROLES, STANCES, TRUCK_CARRY, TRUCK_FUEL, type Destination, type Role, type Stance } from '../../shared/data/expeditions';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../../shared/data/materials';
import { FOOD_VALUE } from '../../shared/data/people';
import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Bridge } from '../../shared/ipc';
import type { DestinationView, ExpeditionView, PersonView, Snapshot } from '../../shared/sim/snapshot';
import { bleedLeft, tripProgress } from '../../shared/format';
import { button, duration, el } from './dom';
import { WorldMapView } from './worldMapView';

/** Who's picked for each destination's party, their roles, and the stance (kept while the panel re-renders). */
const picked = new Map<string, number[]>();
const pickedRoles = new Map<string, Record<number, Role>>();
const pickedStance = new Map<string, Stance>();
const pickedHorses = new Map<string, number>();
const pickedTruck = new Map<string, boolean>();

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
    [...picked],
    [...pickedRoles],
    [...pickedHorses],
    [...pickedTruck],
    s.items.truck,
    s.stock.fuel,
    s.horses,
    [...pickedStance],
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
    const card = destinationCard(d, s.destinations.find((v) => v.id === d.id)!, s, bridge, rerender);
    card.dataset.dest = d.id;
    if (d.id === mapPick) card.classList.add('chosen');
    card.addEventListener('click', () => pick(d.id));
    grid.append(card);
  }
  out.push(grid);
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
  c.append(top, el('div', 'lock', `${who.join(' | ')} · ${STANCES[e.stance as Stance].name}${e.truck ? ' · by truck' : ''}`));
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
  if (e.phase !== 'back' && !e.battle) c.append(button('Recall', () => bridge?.command({ type: 'recallExpedition', expedition: e.id }), { cls: 'place quiet', title: 'Turn them around. They still have to walk back.' }));
  return c;
}

function destinationCard(d: Destination, v: DestinationView, s: Snapshot, bridge: Bridge | undefined, rerender: () => void): HTMLElement {
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

  // Party picker: who goes, in what role
  const home = s.people.filter((p) => p.away === null);
  const party = (picked.get(d.id) ?? []).filter((id) => home.some((p) => p.id === id && !p.downed));
  picked.set(d.id, party);
  const roles = pickedRoles.get(d.id) ?? {};
  pickedRoles.set(d.id, roles);
  const list = el('div', 'party');
  for (const p of home) {
    const row = el('div', 'pick-row');
    const label = el('label', 'pick');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = party.includes(p.id);
    box.disabled = !!p.downed || (!box.checked && party.length >= MAX_PARTY);
    box.addEventListener('change', () => {
      const now = picked.get(d.id) ?? [];
      picked.set(d.id, box.checked ? [...now, p.id] : now.filter((id) => id !== p.id));
      rerender();
    });
    const hurt = p.downed ? ' · too hurt to go' : p.hp < p.maxHp ? ` · HP ${Math.round(p.hp)}/${p.maxHp}` : '';
    label.append(box, document.createTextNode(` ${p.name} (${skillNote(d, p)}${hurt})`));
    row.append(label);
    if (box.checked) {
      const sel = el('select');
      for (const [id, r] of Object.entries(ROLES) as [Role, (typeof ROLES)[Role]][]) {
        const o = el('option', '', r.name);
        o.value = id;
        o.title = r.description;
        o.selected = (roles[p.id] ?? 'fighter') === id;
        sel.append(o);
      }
      sel.addEventListener('change', () => {
        roles[p.id] = sel.value as Role;
        rerender();
      });
      row.append(sel);
    }
    list.append(row);
  }
  if (!home.length) list.append(el('span', 'lock', 'Everyone is away.'));
  c.append(list);

  const stance = pickedStance.get(d.id) ?? 'balanced';
  const stanceRow = el('div', 'row stance');
  for (const [id, st] of Object.entries(STANCES) as [Stance, (typeof STANCES)[Stance]][]) {
    const b = button(st.name, () => {
      pickedStance.set(d.id, id);
      rerender();
    }, { cls: id === stance ? 'place small on' : 'place small quiet', title: `${st.description} Falls back below ${Math.round(st.retreatAt * 100)}% health.` });
    stanceRow.append(b);
  }
  c.append(stanceRow);

  // horses: fit ones at home can go along (a horse each carries more and walks faster)
  const fit = s.horses.filter((h) => !h.away && h.hp >= HORSE_HP / 2).length;
  const horses = Math.min(pickedHorses.get(d.id) ?? 0, fit);
  if (fit) {
    const row = el('div', 'row');
    row.append(
      el('span', 'lock', `Horses: ${horses} of ${fit}`),
      button('−', () => (pickedHorses.set(d.id, Math.max(0, horses - 1)), rerender()), { cls: 'place small quiet', disabled: horses === 0 }),
      button('+', () => (pickedHorses.set(d.id, Math.min(fit, horses + 1)), rerender()), { cls: 'place small quiet', disabled: horses >= fit, title: `Each carries ${HORSE_CARRY}; one each speeds the walk` }),
    );
    c.append(row);
  }

  // a truck (Modern): carries a lot and drives there and back far faster, on fuel
  const trucks = s.items.truck ?? 0;
  const fuel = s.stock.fuel ?? 0;
  const truck = !!pickedTruck.get(d.id) && trucks > 0 && fuel >= TRUCK_FUEL;
  if (trucks > 0) {
    const row = el('div', 'row');
    const label = el('label', 'pick');
    const box = el('input');
    box.type = 'checkbox';
    box.checked = truck;
    box.disabled = fuel < TRUCK_FUEL;
    box.addEventListener('change', () => (pickedTruck.set(d.id, box.checked), rerender()));
    label.append(box, document.createTextNode(fuel < TRUCK_FUEL ? ` Take a truck (needs ${TRUCK_FUEL} fuel, ${fuel} stored)` : ` Take a truck (carries ${TRUCK_CARRY}, burns ${TRUCK_FUEL} fuel)`));
    row.append(label);
    c.append(row);
  }

  const foodHave = (Object.keys(FOOD_VALUE) as Material[]).reduce((n, m) => n + (s.stock[m] ?? 0) * FOOD_VALUE[m]!, 0);
  const foodNeed = v.foodPerMember * party.length;
  if (party.length) {
    const berries = Math.max(1, Math.ceil(foodNeed / FOOD_VALUE.berries!));
    c.append(
      el(
        'div',
        foodHave >= foodNeed ? 'lock' : 'lock short',
        foodHave >= foodNeed ? `Packs about ${berries} ${berries === 1 ? "berry's" : "berries'"} worth of food` : 'Not enough food in storage: they will go hungry on the road',
      ),
    );
  }
  const full = s.expeditions.length >= MAX_EXPEDITIONS;
  c.append(
    button(full ? 'Too many out' : 'Send', () => {
      bridge?.command({ type: 'sendExpedition', dest: d.id, members: party, roles: { ...roles }, stance, horses, truck });
      picked.set(d.id, []);
      pickedHorses.set(d.id, 0);
      pickedTruck.set(d.id, false);
    }, { disabled: full || party.length === 0, title: party.length ? `Send ${party.length} to the ${d.name}` : 'Pick who goes' }),
  );
  return c;
}

/** The skill that matters for a destination, for the picker. */
function skillNote(d: Destination, p: PersonView): string {
  if (d.type === 'gather') return `Gathering ${p.skills.gathering.level}`;
  const best = Math.max(p.skills.melee.level, p.skills.ranged.level);
  return `Fighting ${best}`;
}
