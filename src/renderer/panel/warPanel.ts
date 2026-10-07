// The War menu (the conquest: sim/conquest/*): the map of provinces (a canvas: the lands, each realm's colour over
// the provinces it holds, capitals, garrisons and the town's armies; tap a province for its card), the armies (raised
// round a squad at home, marched by order to any province along the friendly way, garrisons left and picked up,
// recalled, dismissed), the barracks (recruits, the war chest and stores, troops trained by kind, the batches
// training) and the squads (a hero and nine places, each a troop kind they may lead), and the realms' standing.

import type { Bridge } from '../../shared/ipc';
import { CELL_CODES, type WorldCell } from '../../shared/data/conquest';
import { ARMY_SQUADS, GARRISON_HOLDS, ROW_OF, SQUAD_SLOTS, TROOP_BY_ID } from '../../shared/data/troops';
import { ownerAt, type ArmyView, type ProvinceView, type SquadView, type WarView } from '../../shared/sim/conquest/warView';
import type { Snapshot } from '../../shared/sim/snapshot';
import { button, el } from './dom';
import { selectTab } from './subtabs';

/** The province tapped on the map, and the army picked to march (tap a province, then March). */
let selected: number | null = null;
let picked: number | null = null;

/** What the menu's redraw hangs on (panel.ts). */
export function warKey(s: Snapshot): string {
  const w = s.war;
  if (!w) return 'none';
  return [
    w.provinces.map((p) => `${p.holder ?? '-'}${p.garrison}${p.armies.join('.')}${p.bare ? 'b' : ''}`).join(''),
    w.recruits, w.chest, w.goods.map((g) => `${g.material}${g.n}`).join(','), w.troops.map((t) => `${t.n}${t.can ? 1 : 0}`).join(','),
    w.training.map((t) => `${t.troop}${t.n}${t.hoursLeft}`).join(','), w.squads.map((q) => `${q.id}${q.slots.join('')}${q.strength}${q.army}${q.free ? 1 : 0}`).join(';'),
    w.heroes.map((h) => h.id).join(','), w.armies.map((a) => `${a.id}${a.at}${a.going}${a.hours}${a.squads.join('.')}${a.train.map((t) => t.troop + t.n).join('.')}`).join(';'),
    selected, picked,
  ].join('|');
}

const LAND_COLOUR: Record<WorldCell, string> = {
  water: '#2a4f78', mountain: '#6e6a66', forest: '#3f7a3a', desert: '#d2b26a', tundra: '#cfd8dd', coast: '#8fbf7a', swamp: '#4f6a3c',
  jungle: '#2f6b2f', highlands: '#8a9a6a', ashlands: '#5a4a48', steppe: '#b8b06a', taiga: '#3c6a4c',
};
/** Each realm's colour on the map: the town gold, the rest by their place. */
const REALM_COLOURS = ['#ffd24a', '#d04a4a', '#4a7ad0', '#8a4ad0', '#d08a2a', '#2ab0a0', '#d04a9a', '#7aa02a', '#a05a3a', '#4ab0d0', '#b0b0b0', '#6a6ad0'];
export const realmColour = (w: WarView, id: string | null) => (id === null ? null : REALM_COLOURS[Math.max(0, w.realms.findIndex((r) => r.id === id)) % REALM_COLOURS.length]);

export function renderWar(s: Snapshot, bridge: Bridge | undefined, redraw: () => void): HTMLElement[] {
  const w = s.war;
  if (!w) return [el('h2', '', 'War map'), el('p', 'empty', 'This town was founded before the conquest: found a new one to take the field.')];
  if (selected !== null && selected >= w.provinces.length) selected = null;
  if (picked !== null && !w.armies.some((a) => a.id === picked)) picked = null;
  const cmd = (c: object) => bridge?.command(c as never);
  const out: HTMLElement[] = [];
  // ---- the map
  out.push(el('h2', '', 'War map'));
  const own = w.realms[0];
  out.push(el('div', 'hint', `${own.provinces} of ${w.provinces.length} provinces are the town's. Win the game by holding them all, by conquest or alliance. Tap a province for its card${picked !== null ? `; ${w.armies.find((a) => a.id === picked)?.name} is picked: tap where it should march` : ''}.`));
  out.push(mapCanvas(w, redraw));
  const legend = el('div', 'war-legend');
  for (const r of w.realms) {
    const chip = el('span', 'war-realm');
    const dot = el('i', 'war-dot');
    dot.style.background = realmColour(w, r.id)!;
    chip.append(dot, document.createTextNode(`${r.name} ${r.provinces}`));
    legend.append(chip);
  }
  out.push(legend);
  if (selected !== null) out.push(provinceCard(w, w.provinces[selected], cmd, redraw));
  // ---- armies
  out.push(el('h2', '', 'Armies'));
  out.push(el('div', 'hint', `An army is a general's squad and up to ${ARMY_SQUADS - 1} more, raised at ${w.provinces[w.home].name}. Every march is your order: pick an army, tap a province on the map, and it goes the shortest way through free or friendly land, taking free provinces as it comes to them. A province left without ${GARRISON_HOLDS} soldiers or an army may rise against the town.`));
  const cards = el('div', 'cards wide realm');
  for (const a of w.armies) cards.append(armyCard(w, a, cmd, redraw));
  out.push(cards);
  out.push(raiseRow(w, cmd));
  // ---- barracks
  out.push(el('h2', '', 'Barracks'));
  out.push(el('div', 'war-stat', `Recruits ${w.recruits} · war chest ${w.chest} coins · upkeep ${w.upkeep} a day${w.goods.length ? ` · war stores: ${w.goods.map((g) => `${g.n} ${g.material.replace(/_/g, ' ')}`).join(', ')}` : ''}`));
  out.push(el('div', 'hint', 'Recruits come each day from the provinces held, and train in a batch (half the time with a barracks). Coins and makings are taken from the war chest and stores first, then the town\'s. Troops are nameless; the heroes who lead them are not.'));
  for (const b of w.training) out.push(el('div', 'war-stat', `Training ${b.n} ${b.name.toLowerCase()}: ${b.hoursLeft} h`));
  const troops = el('div', 'cards wide');
  for (const t of w.troops) {
    const card = el('div', `card war-troop ${t.can ? '' : 'dim'}`);
    card.append(el('div', 'realm-name', `${t.name} · ${t.n}`));
    card.append(el('div', 'realm-sub', `${t.kind}${t.ranged && t.kind !== 'ranged' ? ', ranged' : ''} · hp ${t.hp}, blow ${t.attack}, guard ${t.defence} · worth ${t.worth} · ${t.cost}`));
    card.append(el('div', 'hint', t.text));
    const acts = el('div', 'realm-acts');
    if (t.can) {
      acts.append(button('Train 1', () => cmd({ type: 'conquest', op: 'train', troop: t.id, n: 1 }), { cls: 'place quiet', disabled: w.recruits < 1 }));
      acts.append(button('Train 3', () => cmd({ type: 'conquest', op: 'train', troop: t.id, n: 3 }), { cls: 'place quiet', disabled: w.recruits < 3 }));
    } else acts.append(el('span', 'hint', `Needs ${t.why}`));
    card.append(acts);
    troops.append(card);
  }
  out.push(troops);
  // ---- squads
  out.push(el('h2', '', 'Squads'));
  out.push(el('div', 'hint', 'A hero and the troops in formation round them: the front row, the middle and the back. A hero\'s level and gear carry the squad, and their command makes every troop fight harder; the strongest lead the most.'));
  const sq = el('div', 'cards wide realm');
  for (const q of w.squads) sq.append(squadCard(w, q, cmd));
  out.push(sq);
  if (w.heroes.length) {
    const row = el('div', 'realm-acts');
    const sel = el('select', 'war-select');
    for (const h of w.heroes) sel.append(new Option(`${h.name} (worth ${h.strength}, leads ${h.lead})`, String(h.id)));
    row.append(sel, button('Form a squad', () => cmd({ type: 'conquest', op: 'form', hero: Number(sel.value) }), { cls: 'place go' }));
    out.push(row);
  }
  // ---- realms
  out.push(el('h2', '', 'Realms'));
  const realms = el('div', 'cards wide');
  for (const r of w.realms) {
    const card = el('div', 'card');
    const name = el('div', 'realm-name');
    const dot = el('i', 'war-dot');
    dot.style.background = realmColour(w, r.id)!;
    name.append(dot, document.createTextNode(` ${r.name}`));
    card.append(name, el('div', 'realm-sub', `${r.provinces} province${r.provinces === 1 ? '' : 's'} · capital ${w.provinces[r.capital].name}`));
    realms.append(card);
  }
  out.push(realms);
  return out;
}

/* ------------------------------------------------------------ the map */

function mapCanvas(w: WarView, redraw: () => void): HTMLElement {
  const box = el('div', 'war-map');
  const width = Math.max(280, (document.getElementById('body')?.clientWidth ?? 360) - 28);
  const cell = Math.max(2, Math.floor(width / w.side));
  const canvas = el('canvas');
  canvas.width = w.side * cell;
  canvas.height = w.side * cell;
  canvas.style.width = `${w.side * cell}px`;
  canvas.style.height = `${w.side * cell}px`;
  const ctx = canvas.getContext('2d')!;
  const codes = '0123456789ab';
  const ownerOf = new Int16Array(w.side * w.side);
  for (let i = 0; i < ownerOf.length; i++) ownerOf[i] = ownerAt(w, i);
  // the ground, and the holder's colour over it
  for (let y = 0; y < w.side; y++)
    for (let x = 0; x < w.side; x++) {
      const i = y * w.side + x;
      const land = CELL_CODES[codes.indexOf(w.cells[i])] ?? 'water';
      ctx.fillStyle = LAND_COLOUR[land];
      ctx.fillRect(x * cell, y * cell, cell, cell);
      const o = ownerOf[i];
      if (o < 0) continue;
      const col = realmColour(w, w.provinces[o].holder);
      if (col) {
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = col;
        ctx.fillRect(x * cell, y * cell, cell, cell);
        ctx.globalAlpha = 1;
      }
    }
  // borders between provinces, the chosen one's bright
  const edge = (i: number, x: number, y: number, dx: number, dy: number) => {
    const nx = x + dx;
    const ny = y + dy;
    const j = ny * w.side + nx;
    const o = ownerOf[i];
    const n = nx < 0 || ny < 0 || nx >= w.side || ny >= w.side ? -1 : ownerOf[j];
    if (o === n) return;
    const chosen = o === selected || n === selected;
    ctx.fillStyle = chosen ? '#ffffff' : 'rgba(0,0,0,0.45)';
    const t = chosen ? 2 : 1;
    if (dx) ctx.fillRect(dx > 0 ? (x + 1) * cell - t : x * cell, y * cell, t, cell);
    else ctx.fillRect(x * cell, dy > 0 ? (y + 1) * cell - t : y * cell, cell, t);
  };
  for (let y = 0; y < w.side; y++)
    for (let x = 0; x < w.side; x++) {
      const i = y * w.side + x;
      if (ownerOf[i] < 0) continue;
      edge(i, x, y, 1, 0);
      edge(i, x, y, -1, 0);
      edge(i, x, y, 0, 1);
      edge(i, x, y, 0, -1);
    }
  // the marks: capitals, garrisons, lairs, armies and their way
  const at = (p: ProvinceView) => [p.x * cell + cell / 2, p.y * cell + cell / 2] as const;
  ctx.lineWidth = 1;
  for (const p of w.provinces) {
    const [x, y] = at(p);
    if (p.capitalOf) {
      ctx.fillStyle = realmColour(w, p.capitalOf) ?? '#fff';
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.rect(x - 4, y - 4, 8, 8);
      ctx.fill();
      ctx.stroke();
    } else if (p.landmark === 'Lair' && !p.holder) {
      ctx.fillStyle = '#300';
      ctx.font = `${Math.max(8, cell * 2.2)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('☠', x, y);
    } else {
      ctx.fillStyle = p.holder ? '#111' : 'rgba(0,0,0,0.5)';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    if (p.garrison) {
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.rect(x + 4, y - 7, 5, 6);
      ctx.fill();
      ctx.stroke();
    }
    if (p.bare) {
      ctx.fillStyle = '#ff5a3a';
      ctx.beginPath();
      ctx.arc(x - 6, y - 6, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const a of w.armies) {
    const from = w.provinces[a.at];
    const to = a.going === null ? null : w.provinces[a.going];
    let [x, y] = at(from);
    if (to) {
      const [tx, ty] = at(to);
      ctx.strokeStyle = '#fff';
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tx, ty);
      let [px, py] = [tx, ty];
      for (const q of a.path) {
        const [qx, qy] = at(w.provinces[q]);
        ctx.lineTo(qx, qy);
        [px, py] = [qx, qy];
      }
      void px;
      void py;
      ctx.stroke();
      ctx.setLineDash([]);
      x = (x + tx) / 2;
      y = (y + ty) / 2;
    }
    ctx.font = `${Math.max(10, cell * 2.6)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = a.id === picked ? '#fff' : '#000';
    ctx.strokeText('⚔', x, y);
    ctx.fillStyle = '#ffd24a';
    ctx.fillText('⚔', x, y);
    ctx.lineWidth = 1;
  }
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = Math.floor(((ev.clientX - r.left) / r.width) * w.side);
    const y = Math.floor(((ev.clientY - r.top) / r.height) * w.side);
    if (x < 0 || y < 0 || x >= w.side || y >= w.side) return;
    const o = ownerOf[y * w.side + x];
    selected = o < 0 ? null : o;
    redraw();
  });
  box.append(canvas);
  return box;
}
/* ------------------------------------------------------------ cards */

function provinceCard(w: WarView, p: ProvinceView, cmd: (c: object) => void, redraw: () => void): HTMLElement {
  const card = el('div', 'card war-province');
  const head = el('div', 'realm-head');
  const name = el('div', 'realm-name');
  const dot = el('i', 'war-dot');
  dot.style.background = realmColour(w, p.holder) ?? 'transparent';
  dot.style.borderColor = p.holder ? 'transparent' : '#888';
  name.append(dot, document.createTextNode(` ${p.name}`));
  head.append(name, el('span', 'realm-stance', p.holderName));
  card.append(head);
  card.append(el('div', 'realm-sub', `${p.land} · ${p.tier}${p.capitalOf ? ' (a capital)' : ''} · ${p.fort}${p.landmark ? ` · ${p.landmark}` : ''}${p.coast ? ' · on the sea' : ''}`));
  card.append(el('div', 'realm-sub', `Yields ${p.yields.coins} coins, ${p.yields.recruits} recruits and ${p.yields.amount} ${p.yields.material.replace(/_/g, ' ')} a day to its holder`));
  if (p.landmark === 'Lair' && !p.holder) card.append(el('div', 'hint', 'Something dens here: it must be cleared before the province is held (the battle comes with the next step).'));
  if (p.holder === 'town') card.append(el('div', `realm-sub ${p.bare ? 'war-bare' : ''}`, p.garrison ? `Garrison of ${p.garrison}` : p.bare ? '⚠ No garrison: it may rise against the town' : p.id === w.home ? 'The town itself' : 'No garrison yet (new conquests keep quiet a few days)'));
  for (const id of p.armies) {
    const a = w.armies.find((x) => x.id === id);
    if (a) card.append(el('div', 'realm-sub', `⚔ ${a.name}${a.going === p.id ? `, arriving in ${a.hours} h` : ''}`));
  }
  const acts = el('div', 'realm-acts');
  if (picked !== null) {
    const a = w.armies.find((x) => x.id === picked)!;
    acts.append(button(`March ${a.name} here`, () => {
      cmd({ type: 'conquest', op: 'march', army: a.id, province: p.id });
      picked = null;
      redraw();
    }, { cls: 'place go', disabled: a.at === p.id && a.going === null }));
    acts.append(button('Cancel', () => {
      picked = null;
      redraw();
    }, { cls: 'place quiet' }));
  } else if (w.armies.length) acts.append(el('span', 'hint', 'To march here, pick an army under Armies.'));
  card.append(acts);
  return card;
}

function armyCard(w: WarView, a: ArmyView, cmd: (c: object) => void, redraw: () => void): HTMLElement {
  const card = el('div', `card realm-card ${a.id === picked ? 'good' : ''}`);
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', a.name), el('span', 'realm-stance', a.home ? 'At home' : a.going === null ? `At ${w.provinces[a.at].name}` : `Marching on ${w.provinces[a.going].name} · ${a.hours} h`));
  card.append(head);
  if (a.path.length) card.append(el('div', 'realm-sub', `Then on to ${w.provinces[a.path[a.path.length - 1]].name}`));
  card.append(el('div', 'realm-sub', `General ${a.generalName} · strength ${a.strength} · ${a.soldiers} soldier${a.soldiers === 1 ? '' : 's'}${a.train.length ? ` · train: ${a.train.map((t) => `${t.n} ${t.name.toLowerCase()}`).join(', ')}` : ''}`));
  const list = el('div', 'war-squads');
  for (const id of a.squads) {
    const q = w.squads.find((x) => x.id === id);
    if (!q) continue;
    const row = el('div', 'war-row');
    row.append(el('span', '', `${q.name} (${q.strength})`));
    if (a.home && id !== a.general) row.append(button('Drop', () => cmd({ type: 'conquest', op: 'drop', army: a.id, squad: id }), { cls: 'place quiet' }));
    list.append(row);
  }
  card.append(list);
  const acts = el('div', 'realm-acts');
  acts.append(button(a.id === picked ? 'Picked: tap the map' : 'Pick to march', () => {
    picked = a.id === picked ? null : a.id;
    selectTab('war', 'Map');
    redraw();
  }, { cls: a.id === picked ? 'place go' : 'place quiet' }));
  if (!a.home) acts.append(button('Recall home', () => cmd({ type: 'conquest', op: 'recall', army: a.id }), { cls: 'place quiet' }));
  const here = w.provinces[a.at];
  if (a.going === null && here.holder === 'town' && a.train.length) acts.append(button(`Leave ${GARRISON_HOLDS} as garrison`, () => cmd({ type: 'conquest', op: 'garrison', army: a.id, n: GARRISON_HOLDS }), { cls: 'place quiet' }));
  if (a.going === null && here.garrison) acts.append(button('Pick up the garrison', () => cmd({ type: 'conquest', op: 'pickup', army: a.id }), { cls: 'place quiet' }));
  if (a.home) {
    const free = w.squads.filter((q) => q.free && q.army === null);
    if (free.length && a.squads.length < ARMY_SQUADS) {
      const sel = el('select', 'war-select');
      for (const q of free) sel.append(new Option(`${q.name} (${q.strength})`, String(q.id)));
      acts.append(sel, button('Add squad', () => cmd({ type: 'conquest', op: 'add', army: a.id, squad: Number(sel.value) }), { cls: 'place quiet' }));
    }
    const spare = w.troops.filter((t) => t.n > 0);
    if (spare.length) {
      const sel = el('select', 'war-select');
      for (const t of spare) sel.append(new Option(`${t.name} (${t.n})`, t.id));
      acts.append(sel, button('Load 3 into the train', () => cmd({ type: 'conquest', op: 'load', army: a.id, troop: sel.value, n: 3 }), { cls: 'place quiet', title: 'Spare troops to leave as garrisons' }));
    }
    acts.append(button('Dismiss', () => cmd({ type: 'conquest', op: 'dismiss', army: a.id }), { cls: 'place quiet danger' }));
  }
  card.append(acts);
  return card;
}

function raiseRow(w: WarView, cmd: (c: object) => void): HTMLElement {
  const row = el('div', 'realm-acts');
  const free = w.squads.filter((q) => q.free && q.army === null);
  if (!free.length) {
    row.append(el('span', 'hint', w.squads.length ? 'Every squad is in an army, or its hero is away.' : 'Form a squad first (under Barracks).'));
    return row;
  }
  const sel = el('select', 'war-select');
  for (const q of free) sel.append(new Option(`${q.name} (${q.strength})`, String(q.id)));
  row.append(sel, button('Raise an army', () => cmd({ type: 'conquest', op: 'raise', squad: Number(sel.value) }), { cls: 'place go' }));
  return row;
}

function squadCard(w: WarView, q: SquadView, cmd: (c: object) => void): HTMLElement {
  const card = el('div', 'card realm-card');
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', q.name), el('span', 'realm-stance', q.army !== null ? w.armies.find((a) => a.id === q.army)?.name ?? 'In an army' : q.free ? 'Free' : q.why ?? ''));
  card.append(head);
  card.append(el('div', 'realm-sub', `${q.heroName}: worth ${q.heroStrength}, command ×${q.command}, leads ${q.lead} · ${q.size} troops · strength ${q.strength}`));
  const grid = el('div', 'formation');
  const afield = q.army !== null && !w.armies.find((a) => a.id === q.army)?.home;
  for (let i = 0; i < SQUAD_SLOTS; i++) {
    const sel = el('select', `war-select slot row${ROW_OF(i)}`);
    sel.append(new Option('—', ''));
    for (const id of q.leads) {
      const t = TROOP_BY_ID[id];
      const n = w.troops.find((x) => x.id === id)?.n ?? 0;
      const o = new Option(`${t.name} (${n})`, id);
      if (q.slots[i] !== id && n < 1) o.disabled = true;
      sel.append(o);
    }
    sel.value = q.slots[i] ?? '';
    sel.disabled = afield;
    sel.addEventListener('change', () => cmd({ type: 'conquest', op: 'slot', squad: q.id, slot: i, troop: sel.value || null }));
    grid.append(sel);
  }
  card.append(el('div', 'hint', 'Front row · middle · back'), grid);
  const acts = el('div', 'realm-acts');
  if (q.army === null) acts.append(button('Disband', () => cmd({ type: 'conquest', op: 'disband', squad: q.id }), { cls: 'place quiet danger' }));
  card.append(acts);
  return card;
}
