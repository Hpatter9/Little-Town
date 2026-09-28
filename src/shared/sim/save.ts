// The save file format: the whole GameState (plain JSON by design) plus when it was written, which is
// how offline time is measured on the next start.

import { autoPriorities, type GameState } from './state';

export const SAVE_FORMAT = 'little-town-save';
export const SAVE_VERSION: GameState['version'] = 15;

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

/**
 * Bring an older save up to date, one version at a time. Each step fills in what that version added with
 * the values a new game would have.
 */
const MIGRATIONS: Record<number, (s: Record<string, any>) => void> = {
  // 9 -> 10: crafting (items, the craft queue, worn gear, the Craft job)
  9: (s) => {
    s.items = {};
    s.crafting = [];
    for (const e of s.expeditions) e.waterskins = 0;
    for (const p of [...s.people, ...(s.visitor ? [s.visitor.person] : [])]) {
      p.gear = {};
      p.priorities.craft = p.autoPriorities ? autoPriorities(p.skills).craft : 2;
    }
  },
  // 10 -> 11: farming (the Farm job; fields start fallow when first looked at)
  10: (s) => {
    for (const p of [...s.people, ...(s.visitor ? [s.visitor.person] : [])]) p.priorities.farm = p.autoPriorities ? autoPriorities(p.skills).farm : 2;
  },
  // 11 -> 12: the Medieval era (captives of bandits)
  11: (s) => {
    s.captives = [];
  },
  // 12 -> 13: relationships and families
  12: (s) => {
    s.relations = {};
    s.celebrationUntil = 0;
  },
  // 13 -> 14: horses and trade caravans
  13: (s) => {
    s.horses = [];
    s.caravan = null;
    s.nextCaravanTick = 0;
  },
  // 14 -> 15: prisoners
  14: (s) => {
    s.prisoners = [];
  },
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
    Array.isArray(s.tiles) &&
    Array.isArray(s.buildings) &&
    Array.isArray(s.people) &&
    Array.isArray(s.journal) &&
    !!s.research;
  return shaped ? { ok: true, save: f as SaveFile } : { ok: false, reason: 'corrupt' };
}
