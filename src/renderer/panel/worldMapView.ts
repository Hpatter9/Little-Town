// The world map at the top of the Expedition Board. It shows home, every destination the town can reach (a dot to
// tap), the one picked (a flag, and the route out to it), and each party that's out, moving along its route as it
// goes and comes back. It's one element kept between renders, so the map image doesn't reload each time.

import { MAP_HOME, MAP_SIZE, MAP_SPOTS } from '../../shared/data/worldMap';
import type { ExpeditionView } from '../../shared/sim/snapshot';
import { tripProgress } from '../../shared/format';
import { el } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
const pct = (v: number) => `${(v / MAP_SIZE) * 100}%`;

export interface MapDestination {
  id: string;
  name: string;
  unlocked: boolean;
}

export class WorldMapView {
  readonly el = el('div', 'world-map');
  private readonly svg = document.createElementNS(SVG, 'svg');
  private readonly marks = el('div', 'map-marks');
  private key = '';

  constructor(private readonly onPick: (id: string) => void) {
    this.svg.setAttribute('viewBox', `0 0 ${MAP_SIZE} ${MAP_SIZE}`);
    this.svg.setAttribute('class', 'map-svg');
    this.el.append(this.svg, this.marks);
  }

  update(dests: MapDestination[], picked: string | null, parties: ExpeditionView[]): void {
    const key = JSON.stringify([dests, picked, parties.map((e) => [e.id, e.dest, Math.round(tripProgress(e) * 200), e.phase])]);
    if (key === this.key) return;
    this.key = key;
    this.svg.replaceChildren();
    this.marks.replaceChildren();

    // routes: to the picked destination, and each party's
    const route = (to: { x: number; y: number }, cls: string) => {
      const line = document.createElementNS(SVG, 'line');
      line.setAttribute('x1', String(MAP_HOME.x));
      line.setAttribute('y1', String(MAP_HOME.y));
      line.setAttribute('x2', String(to.x));
      line.setAttribute('y2', String(to.y));
      line.setAttribute('class', cls);
      this.svg.append(line);
    };
    for (const e of parties) if (MAP_SPOTS[e.dest]) route(MAP_SPOTS[e.dest], 'map-route party');
    const pickedSpot = picked ? MAP_SPOTS[picked] : undefined;
    if (pickedSpot) route(pickedSpot, 'map-route picked');

    // a dot for every destination on the board (tap one to pick it)
    for (const d of dests) {
      const at = MAP_SPOTS[d.id];
      if (!at) continue;
      const dot = el('button', `map-dot${d.unlocked ? '' : ' locked'}${d.id === picked ? ' on' : ''}`);
      dot.title = d.name;
      dot.setAttribute('aria-label', d.name);
      place(dot, at);
      dot.addEventListener('click', () => this.onPick(d.id));
      this.marks.append(dot);
    }

    const home = el('div', 'map-home');
    place(home, MAP_HOME);
    this.marks.append(home, label('Home', MAP_HOME, 'home'));

    // the picked destination: a flag and its name
    const pickedDest = dests.find((d) => d.id === picked);
    if (pickedSpot && pickedDest) {
      const flag = el('div', 'map-flag');
      place(flag, pickedSpot);
      this.marks.append(flag, label(pickedDest.name, pickedSpot, 'picked'));
    }

    // parties out: part way along the route (out, at the site while they work, then back)
    for (const e of parties) {
      const to = MAP_SPOTS[e.dest];
      if (!to) continue;
      const t = e.phase === 'out' ? e.phaseProgress : e.phase === 'work' ? 1 : 1 - e.phaseProgress;
      const at = { x: MAP_HOME.x + (to.x - MAP_HOME.x) * t, y: MAP_HOME.y + (to.y - MAP_HOME.y) * t };
      const p = el('div', `map-party${e.battle ? ' fighting' : ''}`, String(e.members.length));
      p.title = `${e.destName}: ${e.members.map((m) => m.name).join(', ')}`;
      place(p, at);
      this.marks.append(p);
    }
  }
}

function place(node: HTMLElement, at: { x: number; y: number }): void {
  node.style.left = pct(at.x);
  node.style.top = pct(at.y);
}

/** A name under a marker, kept inside the map near its edges. */
function label(text: string, at: { x: number; y: number }, cls: string): HTMLElement {
  const l = el('div', `map-label ${cls}`, text);
  place(l, at);
  if (at.x < 110) l.classList.add('left');
  else if (at.x > MAP_SIZE - 110) l.classList.add('right');
  if (at.y > MAP_SIZE - 60) l.classList.add('above');
  return l;
}
