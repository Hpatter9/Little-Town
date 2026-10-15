// The War menu (the seasons of war: sim/war/*), to watch, not to steer: the town picks no targets (its council
// answers the realm by the direction and the town's alignment). The map of provinces (a canvas: the lands, each
// realm's colour over the provinces it holds, capitals, the hosts marching on each other's land and the town's own war
// party; tap a province for its card), the season, the wars between the powers and the campaigns the town is called
// to (a campaign open for a party can be raised from here, as any expedition is), the council's word on each power,
// the home front (a siege coming, the occupation and the resistance, the last campaign's recap, the war dead and those
// they left, the memorials) and the war's news.

import type { Bridge } from '../../shared/ipc';
import { ownerAt, type CampaignView, type ProvinceView, type WarView } from '../../shared/sim/war/view';
import type { Snapshot } from '../../shared/sim/snapshot';
import { onWarArt } from '../art/warSprites';
import { button, el } from './dom';
import { drawCompass, drawMarks, holdersLayer, realmColour, terrainCell, worldTerrain, devicePixels } from './warMap';

/** The province tapped on the map. */
let selected: number | null = null;
const picked: number | null = null;
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
    w.provinces.map((p) => `${p.holder ?? '-'}${p.garrison}`).join(''),
    w.rivalArmies.map((a) => `${a.realm}${a.to}${a.hours}${Math.round(a.t * 20)}`).join(','),
    w.realms.map((r) => `${r.id}${r.stance}${r.provinces}`).join(','),
    w.season.war, w.season.days, w.wars.map((x) => x.a + x.b).join(','),
    w.campaigns.map((c) => `${c.id}${c.state}${c.party.length}${c.dest ? 1 : 0}`).join(','),
    w.council.map((c) => c.line).join('|'), w.siege ? `${w.siege.by}${w.siege.hours}` : '', w.sieges.lost, w.sieges.held,
    w.occupation ? `${w.occupation.days}${w.occupation.resistance}${w.occupation.garrison}` : '', w.recap?.tick ?? '', w.dead.length, w.bereaved.length, w.news[0]?.text ?? '',
    selected, artGen, s.muster ? 1 : 0,
  ].join('|');
}

export function renderWar(s: Snapshot, bridge: Bridge | undefined, redraw: () => void): HTMLElement[] {
  const w = s.war;
  if (!w) return [el('h2', '', 'War map'), el('p', 'empty', 'The realm is quiet.')];
  if (selected !== null && selected >= w.provinces.length) selected = null;
  redrawNow = redraw;
  const out: HTMLElement[] = [];
  // ---- the map
  out.push(el('h2', '', 'War map'));
  out.push(seasonBanner(w));
  out.push(el('div', 'hint', `The realm's borders, moved by its own wars. ${w.realms[0]?.provinces ?? 0} of ${w.provinces.length} provinces are the town's. The town picks no targets: its council answers the realm by the town's direction and its name for good or ill. Tap a province for its card; pinch, or + and −, to zoom in.`));
  out.push(mapCanvas(w, s, redraw));
  const legend = el('div', 'war-legend');
  for (const r of w.realms) {
    if (!r.provinces && r.id !== 'town') continue;
    const chip = el('span', `war-realm${r.stance === 'destroyed' ? ' dim' : ''}`);
    const dot = el('i', 'war-dot');
    dot.style.background = realmColour(w, r.id)!;
    chip.append(dot, document.createTextNode(`${r.name} ${r.provinces}`));
    legend.append(chip);
  }
  out.push(legend);
  if (selected !== null) out.push(provinceCard(w, w.provinces[selected]));
  // ---- the wars
  out.push(el('h2', '', 'Wars of the realm'));
  if (!w.wars.length) out.push(el('div', 'hint', 'No two powers the town knows are at war just now.'));
  for (const x of w.wars) out.push(el('div', 'war-row', `⚔ ${x.a} against ${x.b}${x.days ? ` · ${x.days} day${x.days === 1 ? '' : 's'}` : ''}`));
  for (const f of w.fallen) out.push(el('div', 'war-row war-bare', `✕ ${f.name} fell to ${f.by} on day ${f.day}`));
  out.push(el('h2', '', 'Campaigns'));
  out.push(el('div', 'hint', 'When a friend of the town\'s marches, its envoy may call the town to march beside it for a share of the spoils. The council answers, and raises the party itself; while a campaign is open you may raise a party for it, as for any expedition.'));
  if (!w.campaigns.length) out.push(el('div', 'hint', 'No campaign has called on the town yet.'));
  const cards = el('div', 'cards wide realm');
  for (const c of w.campaigns) cards.append(campaignCard(c, s, bridge));
  out.push(cards);
  out.push(el('div', 'war-stat', `Campaigns joined ${w.tally.joined} · won ${w.tally.won} · lost ${w.tally.lost}${w.tally.spoils ? ` · ${w.tally.spoils} coins of spoils` : ''}`));
  // ---- the council
  out.push(el('h2', '', 'The council of war'));
  out.push(el('div', 'hint', w.ways));
  const council = el('div', 'cards wide');
  for (const c of w.council) {
    const card = el('div', 'card');
    const name = el('div', 'realm-name');
    const dot = el('i', 'war-dot');
    dot.style.background = realmColour(w, c.id) ?? 'transparent';
    name.append(dot, document.createTextNode(` ${c.name}`));
    card.append(name, el('div', 'realm-sub', `${c.stance} · ${c.line}`));
    council.append(card);
  }
  if (!w.council.length) council.append(el('div', 'hint', 'No power has sent an envoy yet.'));
  out.push(council);
  // ---- the home front
  out.push(el('h2', '', 'The home front'));
  if (w.siege) out.push(el('div', 'war-row war-bare', `⚔ A siege host of ${w.siege.size} under ${w.siege.by}: at the walls in ${w.siege.hours} hour${w.siege.hours === 1 ? '' : 's'}.`));
  if (w.occupation) {
    const o = w.occupation;
    const card = el('div', 'card realm-card bad');
    card.append(el('div', 'realm-name', `Occupied by ${o.by}`), el('div', 'realm-sub', `${o.days} day${o.days === 1 ? '' : 's'} · a garrison of ${o.garrison} · ${o.taxed} coins taken in tax`));
    const bar = el('div', 'realm-bar');
    const fill = el('div', 'realm-fill pos');
    fill.style.left = '0';
    fill.style.width = `${o.resistance}%`;
    bar.append(fill);
    const mood = el('div', 'realm-mood');
    mood.append(el('span', 'realm-lbl', `The resistance: ${o.resistance}%`), bar);
    card.append(mood, el('div', 'hint', 'At full strength the town rises and fights the garrison in its streets.'));
    out.push(card);
  }
  out.push(el('div', 'war-stat', `Sieges held ${w.sieges.held} · lost ${w.sieges.lost}${w.sieges.lost ? ' (a second lost is the end of the town)' : ''}`));
  if (w.recap) out.push(recapCard(w.recap));
  if (!w.siege && !w.occupation && !w.recap) out.push(el('div', 'hint', 'The war has not come home yet.'));
  out.push(el('h2', '', 'The war dead'));
  if (!w.dead.length) out.push(el('div', 'hint', 'None of the town has fallen in the realm\'s wars.'));
  for (const d of w.dead) out.push(el('div', 'war-row', `✝ ${d.name}, at ${d.where} (the war with ${d.war}), day ${d.day}`));
  for (const b of w.bereaved) out.push(el('div', 'war-row', `${b.name}: ${b.line}`));
  for (const m of w.memorials) out.push(el('div', 'war-row', `⛫ A memorial stands in the square to the fallen of the war with ${m}.`));
  // ---- the news
  out.push(el('h2', '', 'War news'));
  if (!w.news.length) out.push(el('div', 'hint', 'Nothing yet.'));
  for (const n of w.news) out.push(el('div', 'war-event', `Day ${n.day}: ${n.text}`));
  return out;
}

/** The season of war: what it is for, and the days left of it. */
function seasonBanner(w: WarView): HTMLElement {
  const box = el('div', `war-season ${w.season.war}`);
  box.append(el('b', '', `${w.season.name}: ${w.season.war === 'march' ? 'the hosts march' : w.season.war === 'harvest' ? 'the harvest raids' : 'winter quarters'}`), el('span', '', ` · ${w.season.days} day${w.season.days === 1 ? '' : 's'} left`));
  box.append(el('div', 'hint', w.season.line));
  return box;
}

const CAMPAIGN_STATE: Record<CampaignView['state'], [string, string]> = {
  called: ['Called', 'mid'],
  open: ['Marching soon', 'ok'],
  marching: ['On the march', 'ok'],
  won: ['Won', 'good'],
  lost: ['Lost', 'bad'],
  refused: ['Stayed out', 'mid'],
  coin: ['Sent coin', 'mid'],
  alone: ['Marched alone', 'mid'],
};
function campaignCard(c: CampaignView, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const [label, cls] = CAMPAIGN_STATE[c.state];
  const card = el('div', `card realm-card ${cls}`);
  const head = el('div', 'realm-head');
  head.append(el('div', 'realm-name', c.title), el('span', `realm-stance ${cls}`, label));
  card.append(head);
  card.append(el('div', 'realm-sub', `${c.harvest ? 'A raid on the fields' : `For ${c.where}`}, against ${c.against}${c.party.length ? ` · ${c.party.join(', ')}` : ''}`));
  if (c.dest) {
    const busy = !!s.muster;
    const acts = el('div', 'realm-acts');
    acts.append(button('Raise a party…', () => bridge?.command({ type: 'muster', op: 'raise', dest: c.dest! } as never), { cls: 'place go', disabled: busy, title: busy ? 'A party is already being raised' : 'Pick who marches' }));
    card.append(acts);
  }
  return card;
}

function recapCard(r: NonNullable<WarView['recap']>): HTMLElement {
  const card = el('div', `card realm-card ${r.won ? 'good' : 'bad'}`);
  card.append(el('div', 'realm-name', r.title));
  for (const line of r.lines) card.append(el('div', 'realm-sub', line));
  return card;
}

function provinceCard(w: WarView, p: ProvinceView): HTMLElement {
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
  if (!p.holder) card.append(el('div', 'hint', p.landmark === 'Lair' ? 'Something dens here: a power must clear it before it is held.' : 'Free ground: the first power to march in holds it.'));
  if (p.id === w.home) card.append(el('div', 'realm-sub', p.garrison ? `The town itself, with a garrison of ${p.garrison} in its streets` : 'The town itself'));
  for (const a of w.rivalArmies.filter((x) => x.to === p.id)) card.append(el('div', 'realm-sub war-bare', `⚔ ${a.realm === 'town' ? 'The town\'s war party' : w.realms.find((r) => r.id === a.realm)?.name ?? 'A host'} marching on it${a.kind === 'harvest' ? ' to raid the harvest' : ''}${a.hours ? `: ${a.hours} h` : ''}`));
  return card;
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

