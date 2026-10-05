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
  const file: SaveFile = { format: SAVE_FORMAT, savedAt, state };
  return JSON.stringify(file);
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
