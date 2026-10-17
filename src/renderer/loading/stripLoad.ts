// The strip's half of the loading screen (the screen itself is the phone page's: mobile/loading.ts). As soon as the
// town's first snapshot is in, the pictures its first view draws are warmed (loading/loadPlan.ts, through
// art/loadImage.ts), while the strip is still setting itself up; the map then draws under the screen, finding them
// ready. Once the map has drawn and nothing it asked for is still on its way, the strip says it is ready, and the
// screen fades into a town already in its pack pictures. The rest of a late town (past the first view) is warmed after,
// a few at a time.

import type { PersonView, Snapshot } from '../../shared/sim/snapshot';
import { biomeById } from '../../shared/data/biomes';
import { imageTally, warmImage } from '../art/loadImage';
import { groundDetailUrls } from '../art/groundDetail';
import { fieldTileUrls } from '../art/fieldTiles';
import { roadTileUrls } from '../art/roadTiles';
import { hkLayers, hkLoading, hkUrl, hkWhoOf } from '../art/hkFolk';
import { packUrls } from '../map/packBuildings';
import { loadPlan, type Look, type LookTables, type PlanItem } from './loadPlan';

/** What the strip tells the page's loading screen (mobile/loading.ts reads it as `__loading.strip`). */
export interface StripReport {
  /** Pictures asked for, and arrived. */
  wanted: number;
  done: number;
  /** What the nearest picture still on its way is of. */
  look: Look | null;
  /** The first view is drawn in its own pictures. */
  ready: boolean;
}

/** After the map has drawn, how long the strip waits on its own stragglers before saying it's ready anyway (ms). */
const STRAGGLER_MS = 2500;
/** Frames drawn after everything is in, so the last pictures are on the screen before it shows. */
const SETTLE_FRAMES = 2;
/** The later pictures: this many at a time, a pause between. */
const TAIL_BATCH = 4;
const TAIL_PAUSE_MS = 120;

/** The pictures the strip draws each thing from. */
export const STRIP_LOOKS: LookTables<PersonView> = {
  ground: (biome, season) => {
    const def = biomeById(biome);
    const sets = [...def.props, ...(season === 'winter' && !def.dry ? ['winter'] : [])];
    return [...groundDetailUrls(), ...fieldTileUrls(), ...roadTileUrls(), ...sets.map((s) => `props/${s}.png`), 'scenery/scenery.png'];
  },
  building: (def, style) => packUrls(def, style),
  person: (p) => hkLayers(hkWhoOf(p), { fighting: false, activity: p.activity }).map(hkUrl),
};

type LoadingWin = Window & { __loading?: { strip(r: StripReport): void } };

export interface StripLoad {
  /** The map has drawn the town (call once a frame has gone out with it). */
  drawn(): void;
}

export function startStripLoad(first: Snapshot): StripLoad {
  const { first: firstSet, later } = loadPlan(first, STRIP_LOOKS);
  const pending = new Set<PlanItem>(firstSet);
  for (const it of firstSet)
    warmImage(it.url).then(
      () => pending.delete(it),
      () => pending.delete(it),
    );
  let drawnAt = 0;
  /** When each step came (wall clock, ms), for measuring: `__stripLoad.times`. */
  const times: Record<string, number> = { planned: Date.now() };
  let settle = 0;
  let ready = false;
  const host = (): LoadingWin['__loading'] => {
    try {
      return (window.parent as LoadingWin).__loading ?? (window as LoadingWin).__loading;
    } catch {
      return undefined;
    }
  };
  const tail = () => {
    const batch = later.splice(0, TAIL_BATCH);
    if (!batch.length) return;
    Promise.allSettled(batch.map((it) => warmImage(it.url))).then(() => setTimeout(tail, TAIL_PAUSE_MS));
  };
  const report = () => {
    const t = imageTally();
    const nearest = [...pending].reduce<PlanItem | null>((a, b) => (!a || b.far < a.far ? b : a), null);
    if (!ready && drawnAt) {
      const quiet = !pending.size && t.done >= t.asked && hkLoading() === 0;
      if (quiet || performance.now() - drawnAt > STRAGGLER_MS) settle++;
      if (quiet) times.quiet ??= Date.now();
      if (settle > SETTLE_FRAMES) {
        ready = true;
        times.ready = Date.now();
        setTimeout(tail, 600); // (the rest after the town is shown)
      }
    }
    const r: StripReport = { wanted: t.asked, done: t.done, look: nearest?.look ?? null, ready };
    Object.assign(window, { __stripLoad: { ...r, times, first: firstSet.length, later: later.length } }); // (for measuring)
    host()?.strip(r);
    if (!ready) requestAnimationFrame(report);
  };
  requestAnimationFrame(report);
  return {
    drawn: () => {
      drawnAt ||= performance.now();
      times.drawn ??= Date.now();
    },
  };
}
