// Save files in <userData>/saves: town.json is the live save, written atomically (temp file + rename).
// Rolling backups town.bak1.json (newest) .. town.bak5.json are cut from it at most every half hour, and
// always before a new game replaces it. A save that can't be read is set aside, never overwritten.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { parseSave, serialize, type SaveFile } from '../shared/sim/save';
import type { GameState } from '../shared/sim/state';

const BACKUPS = 5;
const BACKUP_EVERY_MS = 30 * 60_000;

export const savesDir = () => path.join(app.getPath('userData'), 'saves');
const dir = savesDir;
const live = () => path.join(dir(), 'town.json');
const backup = (n: number) => path.join(dir(), `town.bak${n}.json`);

/** The live save, or the newest readable backup. Unreadable files are renamed aside so they're kept. */
export function loadSave(): SaveFile | null {
  for (const file of [live(), ...Array.from({ length: BACKUPS }, (_, i) => backup(i + 1))]) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue; // missing
    }
    const r = parseSave(text);
    if (r.ok) {
      if (file !== live()) console.warn(`[saves] live save unreadable; loaded ${path.basename(file)}`);
      return r.save;
    }
    const tag = r.reason === 'old-version' ? `v${r.version ?? 'unknown'}` : 'corrupt';
    setAside(file, tag);
    console.warn(`[saves] ${path.basename(file)} is ${r.reason}; set aside`);
  }
  return null;
}

/** Write the live save. `forceBackup` cuts a backup of the previous save first regardless of age. */
export function writeSave(state: GameState, forceBackup = false): void {
  try {
    fs.mkdirSync(dir(), { recursive: true });
    // (an ironman town has one save only: no backups of it are kept)
    if (fs.existsSync(live()) && !wasIronman() && (forceBackup || backupAge() >= BACKUP_EVERY_MS)) rotateBackups();
    const tmp = live() + '.tmp';
    fs.writeFileSync(tmp, serialize(state, Date.now()));
    fs.renameSync(tmp, live());
  } catch (err) {
    console.error('[saves] could not write the save:', err);
  }
}

/** Whether the save on disk (the one about to be replaced) is an ironman town. */
function wasIronman(): boolean {
  try {
    return /"ironman":\s*true/.test(fs.readFileSync(live(), 'utf8'));
  } catch {
    return false;
  }
}

function backupAge(): number {
  try {
    return Date.now() - fs.statSync(backup(1)).mtimeMs;
  } catch {
    return Infinity;
  }
}

function rotateBackups(): void {
  fs.rmSync(backup(BACKUPS), { force: true });
  for (let n = BACKUPS - 1; n >= 1; n--) if (fs.existsSync(backup(n))) fs.renameSync(backup(n), backup(n + 1));
  fs.copyFileSync(live(), backup(1));
  const now = new Date();
  fs.utimesSync(backup(1), now, now); // (a copy keeps the source's time; the age check wants the copy's)
}

function setAside(file: string, tag: string): void {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  try {
    fs.renameSync(file, file.replace(/\.json$/, `.${tag}-${stamp}.json`));
  } catch {
    /* leave it where it is */
  }
}
