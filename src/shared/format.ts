// Small text formatting shared by the sim's notices and the renderer (no sim imports: the renderer bundles it).

import { TOPIC_BY_ID } from './data/research';
import type { ExpeditionView, ResearchView } from './sim/snapshot';

/** How far through its whole trip an expedition is, 0..1 (out, work and back as equal thirds). */
export function tripProgress(e: Pick<ExpeditionView, 'phase' | 'phaseProgress'>): number {
  return Math.min(1, (e.phase === 'out' ? 0 : e.phase === 'work' ? 1 : 2) / 3 + e.phaseProgress / 3);
}

/** The Expeditions button's fill: the party due home soonest, and how far through its trip it is; null when
 *  nobody is out. */
export function expeditionFill(exps: readonly ExpeditionView[]): { pct: number; title: string } | null {
  const e = [...exps].sort((a, b) => a.secondsLeft - b.secondsLeft)[0];
  if (!e) return null;
  const pct = Math.floor(tripProgress(e) * 100);
  const more = exps.length > 1 ? ` (+${exps.length - 1} more out)` : '';
  return { pct, title: `Expedition to ${e.destName}: ${pct}%${more}` };
}

/** The topic being researched (the head of the queue) and how far along it is, for the Research button's
 *  fill; null when nothing is queued. */
export function researchFill(r: ResearchView): { pct: number; title: string } | null {
  const id = r.queue[0];
  if (!id) return null;
  const pct = Math.floor((r.progress[id] ?? 0) * 100);
  return { pct, title: `Researching ${TOPIC_BY_ID[id]?.name ?? id}: ${pct}%` };
}

/** "1h 20m" / "45m": a span of game minutes (how long someone bleeding has left). */
export function bleedLeft(minutes: number | null): string {
  if (minutes == null) return '';
  const h = Math.floor(minutes / 60);
  return h ? `${h}h ${minutes % 60}m` : `${minutes}m`;
}
