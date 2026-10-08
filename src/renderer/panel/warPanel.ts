// The War menu (the conquest: sim/conquest/*): the map of provinces (a canvas: the lands, each realm's colour over
// the provinces it holds, capitals, garrisons and the town's armies; tap a province for its card), the armies (raised
// round a squad at home, marched by order to any province along the friendly way, garrisons left and picked up,
// recalled, dismissed), the barracks (recruits, the war chest and stores, troops trained by kind, the batches
// training) and the squads (a hero and nine places, each a troop kind they may lead), and the realms' standing.

import type { Bridge } from '../../shared/ipc';
import { ARMY_SQUADS, BOARD_H, BOARD_W, GARRISON_HOLDS, ROW_OF, SQUAD_SLOTS, TROOP_BY_ID } from '../../shared/data/troops';
import { ownerAt, type ArmyView, type BattleView, type ProvinceView, type SquadView, type WarView } from '../../shared/sim/conquest/warView';
import { marchSummary, type MarchRecap } from '../../shared/sim/conquest/marches';
import type { Snapshot } from '../../shared/sim/snapshot';
import { hkWhoOf } from '../art/hkFolk';
import { drawBeast, drawCaptain, drawPack, drawWho, LAIR_MASTER, onWarArt } from '../art/warSprites';
import { button, el } from './dom';
import { selectTab } from './subtabs';
import { devicePixels, freeFigure, paintBoard, paintFormation, previewGround, slotsOf, troopsLine } from './warBoard';

// (previews: a land's battle board as a data URL, `__warGround('swamp', 1, 1, false)`)
(window as unknown as { __warGround?: (land: string, tier: number, fort: number, lair: boolean) => string }).__warGround = (land, tier, fort, lair) => previewGround(land, tier, fort, lair, Math.floor((360 * devicePixels()) / 12)).toDataURL();
import { drawCompass, drawMarks, holdersLayer, originOf, realmColour, terrainCell, worldTerrain } from './warMap';

/** The province tapped on the map, and the army picked to march (tap a province, then March). */
let selected: number | null = null;
let picked: number | null = null;
/** The squad tapped on the battle board (its formation card). */
let pickedSquad: number | null = null;
/** Counts the sprites arriving, so the canvases are painted again as they come (the redraw key carries it). */
let artGen = 0;
let redrawNow: (() => void) | null = null;
let redrawWaiting = false;
onWarArt(() => {
  artGen++;
  if (redrawWaiting) return;
  redrawWaiting = true;
  requestAnimationFrame(() => {
    redrawWaiting = false;
    redrawNow?.();
  });
});

/** What the menu's redraw hangs on (panel.ts). */
export function warKey(s: Snapshot): string {
  const w = s.war;
  if (!w) return 'none';
  return [
    w.provinces.map((p) => `${p.holder ?? '-'}${p.garrison}${p.armies.join('.')}${p.bare ? 'b' : ''}`).join(''),
    w.recruits, w.chest, w.goods.map((g) => `${g.material}${g.n}`).join(','), w.troops.map((t) => `${t.n}${t.can ? 1 : 0}`).join(','),
    w.training.map((t) => `${t.troop}${t.n}${t.hoursLeft}`).join(','), w.squads.map((q) => `${q.id}${q.slots.join('')}${q.strength}${q.army}${q.free ? 1 : 0}`).join(';'),
    w.heroes.map((h) => h.id).join(','), w.rivalArmies.map((a) => `${a.realm}${a.to}${a.hours}`).join(','), w.realms.map((r) => r.stance).join(','), w.armies.map((a) => `${a.id}${a.at}${a.going}${a.hours}${a.squads.join('.')}${a.train.map((t) => t.troop + t.n).join('.')}`).join(';'),
    selected, picked, pickedSquad, artGen, w.battle ? `${w.battle.id}:${w.battle.turn}:${w.battle.done}:${w.battle.tick}` : '', w.recap?.tick ?? '', w.marches[0]?.tick ?? '', w.armies.map((a) => a.march ? `${a.march.fought}${a.march.won}${a.march.taken}` : '').join(','), openMarch, w.captives.map((x) => x.hero).join(','),
  ].join('|');
}


export function renderWar(s: Snapshot, bridge: Bridge | undefined, redraw: () => void): HTMLElement[] {
  const w = s.war;
  if (!w) return [el('h2', '', 'War map'), el('p', 'empty', 'This town was founded before the conquest: found a new one to take the field.')];
  if (selected !== null && selected >= w.provinces.length) selected = null;
  if (picked !== null && !w.armies.some((a) => a.id === picked)) picked = null;
  const cmd = (c: object) => bridge?.command(c as never);
  redrawNow = redraw;
  const out: HTMLElement[] = [];
  // ---- the map
  out.push(el('h2', '', 'War map'));
  const own = w.realms[0];
  out.push(el('div', 'hint', `${own.provinces} of ${w.provinces.length} provinces are the town's. Win the game by holding them all, by conquest or alliance. Tap a province for its card; pinch, or + and −, to zoom in${picked !== null ? `; ${w.armies.find((a) => a.id === picked)?.name} is picked: tap where it should march` : ''}.`));
  if (w.battle) out.push(...battleBoard(w, s, redraw));
  for (const x of w.captives) {
    const row = el('div', 'war-row war-bare');
    row.append(el('span', '', `${x.name} is held captive at ${x.province} by ${x.by}: ransom ${x.ransom} coins`), button('Ransom', () => cmd({ type: 'conquest', op: 'ransom', hero: x.hero }), { cls: 'place quiet', disabled: w.chest + (s.coins ?? 0) < x.ransom }));
    out.push(row);
  }
  out.push(mapCanvas(w, s, redraw));
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
  if (w.recap && !w.battle) out.push(recapCard(w.recap));
  // ---- armies
  out.push(el('h2', '', 'Armies'));
  out.push(el('div', 'hint', `An army is a general's squad and up to ${ARMY_SQUADS - 1} more, raised at ${w.provinces[w.home].name}. Every march is your order: pick an army, tap a province on the map, and it goes the shortest way through free or friendly land, fighting for every province it comes to (free ground has its folk, outlaws or beasts); when the march ends, its report comes. A province left without ${GARRISON_HOLDS} soldiers or an army may rise against the town.`));
  const cards = el('div', 'cards wide realm');
  for (const a of w.armies) cards.append(armyCard(w, a, cmd, redraw));
  out.push(cards);
  out.push(raiseRow(w, cmd));
  if (w.marches.length) {
    out.push(el('h2', '', 'March reports'));
    const reports = el('div', 'cards wide realm');
    for (const [i, r] of w.marches.entries()) reports.append(marchCard(r, i === 0, redraw));
    out.push(reports);
  }
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
  for (const q of w.squads) sq.append(squadCard(w, q, s, cmd));
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
    card.append(name, el('div', 'realm-sub', `${r.provinces} province${r.provinces === 1 ? '' : 's'} · capital ${w.provinces[r.capital].name}${r.id !== 'town' ? ` · ${r.stance === 'war' ? 'at war with the town' : r.stance}` : ''}`));
    for (const ra of w.rivalArmies.filter((x) => x.realm === r.id)) card.append(el('div', 'realm-sub war-bare', `⚔ An army of strength ${ra.strength} marches on ${w.provinces[ra.to].name}: ${ra.hours} h`));
    realms.append(card);
  }
  out.push(realms);
  return out;
}

/* ------------------------------------------------------------ the map */

/** The world map: the terrain and the holdings painted once each (warMap.ts), the marks over them; tap a province.
 *  It zooms (the owner's ask): a pinch, the wheel, or the + and − buttons, up to `ZOOM_MOST`, about the fingers;
 *  zoomed in, a drag pans it (and the page scrolls from beside it). The view is kept across redraws and visits, and
 *  so is the canvas itself, so a redraw in the middle of a gesture (a battle's beat) doesn't break it. */
let mapZoom = 1;
/** The view's top-left corner, as a share of the world's size (0 to 1 - 1 / zoom), so it holds at any width. */
const mapPan = { x: 0, y: 0 };
const ZOOM_MOST = 4;
const ZOOM_STEP = 1.6;
interface MapCanvas {
  canvas: HTMLCanvasElement;
  paint: () => void;
}
let mapEl: MapCanvas | null = null;
/** What the kept canvas paints from: the latest view, snapshot and redraw (set on every render). */
let mapNow: { w: WarView; s: Snapshot; cell: number; redraw: () => void } | null = null;

function mapCanvas(w: WarView, s: Snapshot, redraw: () => void): HTMLElement {
  const box = el('div', 'war-map');
  const cell = terrainCell(w);
  const dpr = devicePixels();
  const size = w.side * cell;
  mapNow = { w, s, cell, redraw };
  if (!mapEl || mapEl.canvas.width !== size) mapEl = makeMapCanvas(size, dpr);
  mapEl.paint();
  box.append(mapEl.canvas);
  // the zoom buttons (the pinch and the wheel do the same)
  const zoom = el('div', 'war-zoom');
  const by = (k: number) => {
    zoomMapAbout(size / 2, size / 2, mapZoom * k);
    mapEl?.paint();
  };
  zoom.append(
    button('−', () => by(1 / ZOOM_STEP), { cls: 'place small quiet', title: 'Zoom out' }),
    button('+', () => by(ZOOM_STEP), { cls: 'place small quiet', title: 'Zoom in' }),
  );
  fitButton = button('⊡', () => {
    mapZoom = 1;
    mapPan.x = mapPan.y = 0;
    mapEl?.paint();
  }, { cls: 'place small quiet', title: 'The whole world' });
  fitButton.style.display = mapZoom > 1.001 ? '' : 'none';
  zoom.append(fitButton);
  box.append(zoom);
  return box;
}
/** The button back to the whole world: shown once zoomed in (kept here so a pinch can show it without a redraw). */
let fitButton: HTMLElement | null = null;

/** Zoom to `z` keeping the world point under (sx, sy) (device px in the view) where it is. */
function zoomMapAbout(sx: number, sy: number, z: number): void {
  if (!mapEl) return;
  const size = mapEl.canvas.width;
  const next = Math.max(1, Math.min(ZOOM_MOST, z));
  const ux = (sx + mapPan.x * size * mapZoom) / mapZoom;
  const uy = (sy + mapPan.y * size * mapZoom) / mapZoom;
  mapZoom = next;
  mapPan.x = (ux * next - sx) / (size * next);
  mapPan.y = (uy * next - sy) / (size * next);
  clampPan();
}
function clampPan(): void {
  const most = 1 - 1 / mapZoom;
  mapPan.x = Math.max(0, Math.min(most, mapPan.x));
  mapPan.y = Math.max(0, Math.min(most, mapPan.y));
  if (mapZoom <= 1.001) mapPan.x = mapPan.y = 0;
}

function makeMapCanvas(size: number, dpr: number): MapCanvas {
  const canvas = el('canvas');
  canvas.width = canvas.height = size;
  canvas.style.width = canvas.style.height = `${size / dpr}px`;
  const g = canvas.getContext('2d')!;
  const paint = () => {
    if (!mapNow) return;
    const { w, s, cell } = mapNow;
    clampPan();
    const world = size * mapZoom;
    const px = Math.round(mapPan.x * world);
    const py = Math.round(mapPan.y * world);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = false;
    g.clearRect(0, 0, size, size);
    g.drawImage(worldTerrain(w), 0, 0, size, size, -px, -py, world, world);
    g.drawImage(holdersLayer(w, cell, selected), 0, 0, size, size, -px, -py, world, world);
    g.save();
    g.translate(-px, -py);
    drawMarks(g, w, cell * mapZoom, { people: s.people, townOrigin: townOriginOf(s), picked, selected, font: panelFont() });
    g.restore();
    drawCompass(g, size - cell * 2.6, cell * 2.6, cell * 1.4, panelFont());
    // (zoomed in, every touch is the map's: a drag pans it; fitted, the page scrolls over it as before)
    canvas.style.touchAction = mapZoom > 1.001 ? 'none' : 'pan-y';
    if (fitButton) fitButton.style.display = mapZoom > 1.001 ? '' : 'none';
  };
  // gestures: a tap picks a province, a drag pans (zoomed in), two fingers pinch, the wheel zooms
  const pointers = new Map<number, { x: number; y: number }>();
  let gesture: { moved: boolean; pinched: boolean; last: { x: number; y: number }; dist: number } | null = null;
  const at = (ev: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((ev.clientX - r.left) / r.width) * size, y: ((ev.clientY - r.top) / r.height) * size };
  };
  const centre = () => {
    const ps = [...pointers.values()];
    return { x: ps.reduce((n, p) => n + p.x, 0) / ps.length, y: ps.reduce((n, p) => n + p.y, 0) / ps.length };
  };
  const spread = () => {
    const ps = [...pointers.values()];
    return ps.length < 2 ? 0 : Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y);
  };
  canvas.addEventListener('pointerdown', (ev) => {
    canvas.setPointerCapture(ev.pointerId);
    pointers.set(ev.pointerId, at(ev));
    gesture = { moved: gesture?.moved ?? false, pinched: (gesture?.pinched ?? false) || pointers.size > 1, last: centre(), dist: spread() };
  });
  canvas.addEventListener('pointermove', (ev) => {
    if (!pointers.has(ev.pointerId) || !gesture) return;
    pointers.set(ev.pointerId, at(ev));
    const c = centre();
    const dx = c.x - gesture.last.x;
    const dy = c.y - gesture.last.y;
    if (Math.hypot(dx, dy) > 6 * dpr) gesture.moved = true;
    if (pointers.size > 1) {
      const d = spread();
      if (gesture.dist > 0 && d > 0) zoomMapAbout(c.x, c.y, mapZoom * (d / gesture.dist));
      gesture.dist = d;
      gesture.pinched = true;
    }
    if (gesture.moved && mapZoom > 1.001) {
      const world = size * mapZoom;
      mapPan.x -= dx / world;
      mapPan.y -= dy / world;
      clampPan();
    }
    gesture.last = c;
    if (gesture.moved || gesture.pinched) paint();
  });
  const lift = (ev: PointerEvent) => {
    if (!pointers.has(ev.pointerId)) return;
    const p = pointers.get(ev.pointerId)!;
    pointers.delete(ev.pointerId);
    const g0 = gesture;
    if (pointers.size) {
      if (g0) {
        g0.last = centre();
        g0.dist = spread();
      }
      return;
    }
    gesture = null;
    if (!g0 || g0.moved || g0.pinched || ev.type === 'pointercancel' || !mapNow) return;
    // a tap: the province under it
    const { w, cell, redraw } = mapNow;
    const world = size * mapZoom;
    const x = Math.floor((p.x + mapPan.x * world) / (cell * mapZoom));
    const y = Math.floor((p.y + mapPan.y * world) / (cell * mapZoom));
    if (x < 0 || y < 0 || x >= w.side || y >= w.side) return;
    const o = ownerAt(w, y * w.side + x);
    selected = o < 0 ? null : o;
    redraw();
  };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);
  canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const r = canvas.getBoundingClientRect();
    const sx = ((ev.clientX - r.left) / r.width) * size;
    const sy = ((ev.clientY - r.top) / r.height) * size;
    zoomMapAbout(sx, sy, mapZoom * (ev.deltaY < 0 ? 1.2 : 1 / 1.2));
    paint();
  }, { passive: false });
  return { canvas, paint };
}
/** The town's people, for the settlements' style and its captains. */
const townOriginOf = (s: Snapshot) => (s.theme === 'town' ? 'settlers' : s.theme);
/** The menus' display font, for the canvases' words. */
function panelFont(): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue('--font-display').trim();
  return v || getComputedStyle(document.body).fontFamily || 'serif';
}

/* ------------------------------------------------------------ the battle board */

/** The battle for a province (warBoard.ts): the field, the squads as figures, the latest events; tap a squad for
 *  its formation. */
function battleBoard(w: WarView, s: Snapshot, redraw: () => void): HTMLElement[] {
  const b = w.battle!;
  const out: HTMLElement[] = [];
  const head = el('div', 'war-stat');
  head.append(el('b', '', b.done === 'won' ? `Victory at ${b.province}!` : b.done === 'lost' ? `Beaten before ${b.province}.` : `The battle for ${b.province}`), document.createTextNode(` · turn ${b.turn}${b.wallsMax ? ` · walls ${Math.round((b.walls / b.wallsMax) * 100)}%` : ''}`));
  out.push(head);
  const box = el('div', 'war-map');
  const width = Math.max(280, (document.getElementById('body')?.clientWidth ?? 360) - 28);
  const dpr = devicePixels();
  const cell = Math.floor((width * dpr) / BOARD_W);
  const canvas = el('canvas');
  canvas.width = BOARD_W * cell;
  canvas.height = BOARD_H * cell;
  canvas.style.width = `${(BOARD_W * cell) / dpr}px`;
  canvas.style.height = `${(BOARD_H * cell) / dpr}px`;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  if (pickedSquad !== null && !b.squads.some((q) => q.id === pickedSquad)) pickedSquad = null;
  const hits = paintBoard(g, b, { cell, people: s.people, townOrigin: townOriginOf(s), font: panelFont(), picked: pickedSquad });
  canvas.addEventListener('click', (ev) => {
    const r = canvas.getBoundingClientRect();
    const x = ((ev.clientX - r.left) / r.width) * BOARD_W;
    const y = ((ev.clientY - r.top) / r.height) * BOARD_H;
    let best: { id: number; d: number } | null = null;
    for (const h of hits) {
      const d = Math.hypot(h.x + 0.5 - x, h.y + 0.5 - y);
      if (d < 0.8 && (!best || d < best.d)) best = { id: h.id, d };
    }
    pickedSquad = best ? (pickedSquad === best.id ? null : best.id) : null;
    redraw();
  });
  box.append(canvas);
  out.push(box);
  const log = el('div', 'war-log');
  for (const e of b.events.slice(-5)) log.append(el('div', `war-event ${e.kind}`, e.text));
  out.push(log);
  const sides = el('div', 'war-legend');
  for (const q of b.squads) {
    const chip = el('span', `war-realm ${q.out ? 'dim' : ''}${q.id === pickedSquad ? ' on' : ''}`);
    const dot = el('i', 'war-dot');
    dot.style.background = q.side === 'town' ? '#ffd24a' : '#d04a4a';
    chip.append(dot, document.createTextNode(`${q.name}${q.hero ? ` (${q.hero} ${Math.round(q.heroShare * 100)}%)` : ''} · ${q.troops.filter((t) => t).length} troops${q.out ? ` · ${q.out}` : ''}`));
    chip.addEventListener('click', () => {
      pickedSquad = pickedSquad === q.id ? null : q.id;
      redraw();
    });
    sides.append(chip);
  }
  out.push(sides);
  const picked = b.squads.find((q) => q.id === pickedSquad);
  if (picked) out.push(formationCard(s, b, picked));
  return out;
}

/** A squad's formation card: the hero and the troops as figures, and what it holds. */
function formationCard(s: Snapshot, b: BattleView, q: BattleView['squads'][number]): HTMLElement {
  const card = el('div', `card realm-card ${q.side === 'town' ? 'good' : 'bad'}`);
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', q.name), el('span', 'realm-stance', q.out ? q.out : q.side === 'town' ? 'The town\'s' : 'The foe\'s'));
  card.append(head);
  card.append(formationCanvas(b.land, q.side, q.hero ?? q.name, q.heroShare, s, b, q));
  card.append(el('div', 'realm-sub', `${q.hero ?? 'No hero'}${q.hero ? ` · ${Math.round(q.heroShare * 100)}% health` : ''} · ${troopsLine(q.troops)}`));
  return card;
}
/** The formation picture, `h` CSS px tall and the panel's width: a battle squad's (with its health) or a barracks squad's. */
function formationCanvas(land: string, side: 'town' | 'foe', heroName: string, heroShare: number | null, s: Snapshot, b: BattleView | null, q: BattleView['squads'][number] | SquadView, h = 132): HTMLCanvasElement {
  const width = Math.max(280, (document.getElementById('body')?.clientWidth ?? 360) - 52);
  const dpr = devicePixels();
  const canvas = el('canvas', 'war-formation');
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${h}px`;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  const slots = 'troops' in q ? q.troops : slotsOf(q);
  const person = 'troops' in q ? q.person : q.hero;
  const hero = () => {
    const p = person === null ? null : s.people.find((x) => x.id === person);
    const facing = 'down' as const;
    const hx = canvas.width * 0.15;
    const feet = canvas.height * 0.86;
    const fig = canvas.height * 0.5;
    if (p) return drawWho(g, hkWhoOf(p), facing, hx, feet, fig);
    if (b && 'troops' in q) {
      if (b.holder === null && !b.lair) return freeFigure(g, q.hero, q.id, facing, hx, feet, fig);
      if (b.holder === null) return q.hero && /master/i.test(q.hero) ? drawPack(g, LAIR_MASTER, facing, hx, feet, fig * 1.15) : drawBeast(g, 'bear', q.id % 2, facing, hx, feet, fig * 0.9);
      return drawCaptain(g, originOf(b.holder, townOriginOf(s)) ?? 'brotherhood', q.id, facing, hx, feet, fig);
    }
    return drawCaptain(g, townOriginOf(s), q.id, facing, hx, feet, fig);
  };
  paintFormation(g, { w: canvas.width, h: canvas.height, land, slots, hero, side, font: panelFont(), heroName, heroShare, seed: 500 + q.id * 7 });
  return canvas;
}
function recapCard(r: NonNullable<WarView['recap']>): HTMLElement {
  const card = el('div', `card realm-card ${r.won ? 'good' : 'bad'}`);
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', `${r.won ? 'Victory' : 'Defeat'} at ${r.province}`), el('span', 'realm-stance', `${r.turns} turns`));
  card.append(head);
  card.append(el('div', 'realm-sub', `${r.felled} of the foe felled · ${r.lost} troops lost`));
  for (const line of r.lines) card.append(el('div', 'realm-sub', line));
  return card;
}
/** The march report open (by its tick): the latest is open until another is tapped. */
let openMarch: number | null = null;
const MARCH_HEAD: Record<MarchRecap['outcome'], string> = { arrived: 'reached its goal', home: 'came home', halted: 'halted', beaten: 'was beaten back', broken: 'broke up' };
function marchCard(r: MarchRecap, latest: boolean, redraw: () => void): HTMLElement {
  const bad = r.outcome === 'beaten' || r.outcome === 'broken';
  const card = el('div', `card realm-card ${bad ? 'bad' : r.taken.length ? 'good' : ''}`);
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', `${r.army} ${MARCH_HEAD[r.outcome]}`), el('span', 'realm-stance', `${r.days} day${r.days === 1 ? '' : 's'}`));
  card.append(head);
  card.append(el('div', 'realm-sub', `${r.from} → ${r.to}`));
  card.append(el('div', 'realm-sub', marchSummary(r)));
  const open = openMarch === null ? latest : openMarch === r.tick;
  if (open) for (const line of r.lines) card.append(el('div', 'realm-sub war-march-line', line));
  else card.append(el('div', 'hint', 'Tap for the whole march'));
  card.addEventListener('click', () => {
    openMarch = open ? -1 : r.tick;
    redraw();
  });
  return card;
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
  if (!p.holder) card.append(el('div', 'hint', p.landmark === 'Lair' ? 'Something dens here: an army must clear it in battle before the province is held.' : p.tierN === 0 ? 'Free ground: outlaws or beasts hold it, and an army must beat them to take it.' : 'Free ground: its folk will stand against an army that comes to take it.'));
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
  if (a.march) card.append(el('div', 'realm-sub war-march-line', `${a.march.fought ? `${a.march.won} of ${a.march.fought} battle${a.march.fought === 1 ? '' : 's'} won${a.march.taken ? `, ${a.march.taken} taken` : ''} · ` : ''}${a.march.last}`));
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

function squadCard(w: WarView, q: SquadView, s: Snapshot, cmd: (c: object) => void): HTMLElement {
  const card = el('div', 'card realm-card');
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', q.name), el('span', 'realm-stance', q.army !== null ? w.armies.find((a) => a.id === q.army)?.name ?? 'In an army' : q.free ? 'Free' : q.why ?? ''));
  card.append(head);
  card.append(formationCanvas(w.provinces[w.home].land, 'town', q.heroName, null, s, null, q, 110));
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
  card.append(el('div', 'hint', 'Front row · middle · back. The hero fills the ranks; change any place.'), grid);
  const acts = el('div', 'realm-acts');
  // (the hero fills the empty places from the trained troops: sim/conquest/squads.ts `fillSquad`)
  const trained = w.troops.some((t) => t.n > 0 && q.leads.includes(t.id));
  if (!afield) acts.append(button('Fill the ranks', () => cmd({ type: 'conquest', op: 'fill', squad: q.id }), { cls: 'place quiet', disabled: q.size >= q.lead || !trained }));
  if (q.army === null) acts.append(button('Disband', () => cmd({ type: 'conquest', op: 'disband', squad: q.id }), { cls: 'place quiet danger' }));
  card.append(acts);
  return card;
}
