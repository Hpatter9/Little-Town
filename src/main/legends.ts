// The desktop app's legends of towns gone by (sim/legacy.ts): the phone keeps them in the page's storage
// (renderer/legends.ts); here they're a file beside the saves, <userData>/legends.json (so under %APPDATA%\Little Town,
// with the towns), written whole through a temp file. No Electron here: the folder is passed in, so it can be tested.

import fs from 'node:fs';
import path from 'node:path';
import type { Legend } from '../shared/sim/legacy';

/** How many towns are remembered (as the phone: renderer/legends.ts LEGENDS_MOST). */
export const LEGENDS_MOST = 120;

const file = (dir: string) => path.join(dir, 'legends.json');

export function readLegendsFile(dir: string): Legend[] {
  try {
    const v = JSON.parse(fs.readFileSync(file(dir), 'utf8')) as unknown;
    return Array.isArray(v) ? (v as Legend[]).filter((l) => l && typeof l.id === 'string' && typeof l.founder === 'string') : [];
  } catch {
    return [];
  }
}

export function keepLegendFile(dir: string, l: Legend): void {
  const all = readLegendsFile(dir).filter((x) => x.id !== l.id);
  all.push(l);
  try {
    fs.mkdirSync(dir, { recursive: true });
    const tmp = file(dir) + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(all.slice(-LEGENDS_MOST)));
    fs.renameSync(tmp, file(dir));
  } catch (err) {
    console.error('[legends] could not keep the legend:', err);
  }
}

/** A legend by its id (the heir the New Town panel chose). */
export const legendById = (dir: string, id: unknown): Legend | undefined => (typeof id === 'string' ? readLegendsFile(dir).find((l) => l.id === id) : undefined);
