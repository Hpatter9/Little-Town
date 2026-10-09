// The save file format: the whole GameState (plain JSON by design) plus when it was written, which is
// how offline time is measured on the next start.

import type { GameState } from './state';

export const SAVE_FORMAT = 'little-town-save';
export const SAVE_VERSION: GameState['version'] = 17;

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  /** Wall-clock ms (Date.now()) when written. */
  savedAt: number;
  state: GameState;
}

export function serialize(state: GameState, savedAt: number): string {
  // (the land's pools are most of a save written out cell by cell: they go packed, `packPools`)
  const land = { ...state.land, pools: {}, packedPools: packPools(state.land.pools) };
  const file: SaveFile = { format: SAVE_FORMAT, savedAt, state: { ...state, land } as GameState };
  return JSON.stringify(file);
}

/** The pools as one string: the materials named once, then each cell's index and amounts in base 36
 *  ("wood,stone|1a3:0=5,1=2;1a4:0=3;..."), about a third the size of the plain JSON. */
export function packPools(pools: GameState['land']['pools']): string {
  const mats: string[] = [];
  const code = new Map<string, number>();
  const cells: string[] = [];
  for (const [i, pool] of Object.entries(pools)) {
    const parts: string[] = [];
    for (const [m, n] of Object.entries(pool ?? {})) {
      if (n === undefined) continue;
      let c = code.get(m);
      if (c === undefined) {
        c = mats.length;
        code.set(m, c);
        mats.push(m);
      }
      parts.push(`${c.toString(36)}=${Number.isInteger(n) ? n.toString(36) : `~${n}`}`);
    }
    cells.push(`${(+i).toString(36)}:${parts.join(',')}`);
  }
  return `${mats.join(',')}|${cells.join(';')}`;
}
export function unpackPools(text: string): GameState['land']['pools'] {
  const [head, body] = text.split('|');
  const mats = head ? head.split(',') : [];
  const out: Record<number, Record<string, number>> = {};
  if (!body) return out;
  for (const cell of body.split(';')) {
    const [i, list] = cell.split(':');
    const pool: Record<string, number> = {};
    if (list)
      for (const part of list.split(',')) {
        const [c, n] = part.split('=');
        pool[mats[parseInt(c, 36)]] = n.startsWith('~') ? Number(n.slice(1)) : parseInt(n, 36);
      }
    out[parseInt(i, 36)] = pool;
  }
  return out as GameState['land']['pools'];
}

export type ParsedSave = { ok: true; save: SaveFile } | { ok: false; reason: 'corrupt' | 'old-version'; version?: number };

/** Bring an older save up to date, one version at a time (none can be, since the top-down town). */
const MIGRATIONS: Record<number, (s: Record<string, any>) => void> = {
  // (none: the top-down town (version 16) is a new world, and saves from the side-on town can't be carried over; a
  // new town is founded instead)
};

/** Read a save. Corrupt files and saves from a version that can't be migrated are refused (never half-loaded). */
export function parseSave(text: string): ParsedSave {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, reason: 'corrupt' };
  }
  const f = raw as Partial<SaveFile> | null;
  if (!f || f.format !== SAVE_FORMAT || typeof f.savedAt !== 'number' || !f.state || typeof f.state !== 'object') return { ok: false, reason: 'corrupt' };
  const s = f.state as Partial<GameState>;
  const packed = (s.land as { packedPools?: string } | undefined)?.packedPools;
  if (typeof packed === 'string' && s.land) {
    try {
      s.land.pools = unpackPools(packed);
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    delete (s.land as { packedPools?: string }).packedPools;
  }
  const from = s.version as number;
  while (typeof s.version === 'number' && s.version < SAVE_VERSION && MIGRATIONS[s.version]) {
    try {
      MIGRATIONS[s.version](s);
    } catch {
      return { ok: false, reason: 'corrupt' };
    }
    (s as { version: number }).version++;
  }
  if (s.version !== SAVE_VERSION) return { ok: false, reason: 'old-version', version: typeof from === 'number' ? from : undefined };
  const shaped =
    typeof s.seed === 'string' &&
    Number.isInteger(s.tick) &&
    Number.isInteger(s.rngState) &&
    typeof s.land === 'object' && typeof s.land?.cells === 'string' &&
    Array.isArray(s.buildings) &&
    Array.isArray(s.people) &&
    Array.isArray(s.journal) &&
    !!s.research;
  return shaped ? { ok: true, save: f as SaveFile } : { ok: false, reason: 'corrupt' };
}
