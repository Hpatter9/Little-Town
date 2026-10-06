// The world map at the top of the Expedition Board. It shows home, every destination the town can reach (a dot to
// tap), the one picked (a flag, and the route out to it), and each party that's out, moving along its route as it
// goes and comes back. It's one element kept between renders, so the map image doesn't reload each time.

import { MAP_HOME, MAP_SIZE, MAP_SPOTS } from '../../shared/data/worldMap';
import { STRONGHOLD_SPOTS } from '../../shared/data/factions';
import { regionScouted, REGIONS } from '../../shared/data/regions';
import type { ExpeditionView, Snapshot } from '../../shared/sim/snapshot';
import { tripProgress } from '../../shared/format';
import { el } from './dom';

const SVG = 'http://www.w3.org/2000/svg';
const pct = (v: number) => `${(v / MAP_SIZE) * 100}%`;

export interface MapDestination {
  id: string;
  name: string;
  unlocked: boolean;
}

/** A power's stronghold on the map (sim/factions.ts `FactionView`). */
export interface MapHold {
  id: string;
  name: string;
  stronghold: string;
  stance: string;
  stanceName: string;
  assault: string | null;
  /** Its own town (sim/factions.ts `growTowns`): how many live there, called by its size, tier 0 (camp) to 4. */
  folk: number;
  size: string;
  tier: number;
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

  update(dests: MapDestination[], picked: string | null, parties: ExpeditionView[], known: string[], holds: MapHold[] = [], world?: Snapshot['world']): void {
    const key = JSON.stringify([dests, picked, parties.map((e) => [e.id, e.dest, Math.round(tripProgress(e) * 200), e.phase]), known, holds, world?.feuds, world?.marches.map((m) => [m.kind, m.label, Math.round(m.t * 100)])]);
    if (key === this.key) return;
    this.key = key;
    this.svg.replaceChildren();
    this.marks.replaceChildren();

    // fog over the regions the scouts haven't mapped (soft-edged, so the land shows faintly through it), named faintly
    for (const r of REGIONS) {
      if (known.includes(r.id)) continue;
      const fog = el('div', 'map-fog');
      place(fog, r);
      fog.style.width = fog.style.height = pct(r.r * 2);
      this.marks.append(fog, label(r.name, { x: r.x, y: r.y + 14 }, 'fogged'));
    }

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
      const dot = el('button', `map-dot${d.unlocked ? '' : ' locked'}${regionScouted(d.id) ? ' scout' : ''}${d.id === picked ? ' on' : ''}`);
      dot.title = d.name;
      dot.setAttribute('aria-label', d.name);
      place(dot, at);
      dot.addEventListener('click', () => this.onPick(d.id));
      this.marks.append(dot);
    }

    // the powers' strongholds (sim/factions.ts), marked by how the town stands with each; one at war can be stormed
    for (const h of holds) {
      const at = STRONGHOLD_SPOTS[h.id];
      if (!at) continue;
      // (a camp a small tent, a village a hut, a town and beyond a tower, larger as it grows)
      const mark = h.stance === 'destroyed' ? '✕' : h.tier === 0 ? '⛺' : h.tier === 1 ? '⌂' : h.tier >= 4 ? '♛' : '♜';
      const m = el('button', `map-hold ${h.stance} tier-${h.tier}`, mark);
      m.title = h.stance === 'destroyed' ? `${h.name}, ${h.stronghold}: razed` : `${h.name}, ${h.stronghold}: a ${h.size} of about ${h.folk}. ${h.stanceName}`;
      m.setAttribute('aria-label', m.title);
      place(m, at);
      if (h.assault) m.addEventListener('click', () => this.onPick(h.assault!));
      const name = h.stronghold.charAt(0).toUpperCase() + h.stronghold.slice(1);
      this.marks.append(m, label(h.stance === 'destroyed' ? name : `${name} · ${h.size}`, { x: at.x, y: at.y + 6 + h.tier }, `hold ${h.stance}`));
    }

    // the realm on the move (sim/worldLife.ts): a feud's crossed swords between two strongholds, hosts and caravans along
    // the roads, a war host coming for the town (its road drawn red), an envoy riding in
    for (const f of world?.feuds ?? []) {
      const m = el('div', 'map-feud', '⚔');
      m.title = `${f.a} and ${f.b} are at war`;
      place(m, f.at);
      this.marks.append(m);
    }
    for (const m of world?.marches ?? []) {
      if (m.kind === 'host' || m.kind === 'feud') {
        const line = document.createElementNS(SVG, 'line');
        line.setAttribute('x1', String(m.from.x));
        line.setAttribute('y1', String(m.from.y));
        line.setAttribute('x2', String(m.to.x));
        line.setAttribute('y2', String(m.to.y));
        line.setAttribute('class', `map-route ${m.kind}`);
        this.svg.append(line);
      }
      const at = { x: m.from.x + (m.to.x - m.from.x) * m.t, y: m.from.y + (m.to.y - m.from.y) * m.t };
      const tok = el('div', `map-march ${m.kind}`, m.kind === 'trade' ? '🐫' : m.kind === 'envoy' ? '✉' : String(m.size));
      tok.title = m.label;
      tok.setAttribute('aria-label', m.label);
      place(tok, at);
      this.marks.append(tok);
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
