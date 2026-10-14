// Deeds and the titles they earn (data/deeds.ts). Kept free of heavy imports so anything in the sim can count one.
import { DEED_KINDS, DEED_TITLES, type DeedKind } from '../data/deeds';
import type { GameState, Person } from './state';
import { notify } from './state';

/** Count a deed for someone. */
export function addDeed(p: Person | undefined, kind: DeedKind, n = 1): void {
  if (!p || n <= 0) return;
  const d = (p.deeds ??= {});
  d[kind] = (d[kind] ?? 0) + n;
}

/** The titles their deeds have earned so far, lowest step first. */
export function deedTitles(p: Person): string[] {
  const out: string[] = [];
  for (const k of DEED_KINDS) {
    const n = p.deeds?.[k] ?? 0;
    for (const [at, title] of DEED_TITLES[k].steps) if (n >= at) out.push(title);
  }
  return out;
}

/** Hourly: give anyone their deeds have earned a new title, with the news. */
export function awardDeedTitles(s: GameState): void {
  for (const p of s.people) {
    if (!p.deeds) continue;
    for (const title of deedTitles(p)) {
      if ((p.titles ??= []).includes(title)) continue;
      p.titles.push(title);
      notify(s, `${p.name} is now called ${p.name} ${title}.`, true);
    }
  }
}

/** Their deeds as lines for the People page ("Buildings raised: 6"). */
export function deedLines(p: Person): { label: string; n: number; next: string | null; at: number | null }[] {
  return DEED_KINDS.filter((k) => (p.deeds?.[k] ?? 0) > 0).map((k) => {
    const n = p.deeds![k]!;
    const step = DEED_TITLES[k].steps.find(([at]) => n < at);
    return { label: DEED_TITLES[k].label, n, next: step?.[1] ?? null, at: step?.[0] ?? null };
  });
}
