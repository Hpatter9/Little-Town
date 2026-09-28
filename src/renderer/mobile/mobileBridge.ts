// The phone (web) version's stand-in for the desktop app's main process: it runs the game loop in the page,
// keeps the town in the browser's storage, and catches up on the time the app was closed or in the background.

import { DEFAULT_ALERTS, type Bridge, type InspectInfo, type StripState } from '../../shared/ipc';
import { GameLoop } from '../../shared/gameLoop';
import { parseSave, serialize } from '../../shared/sim/save';
import type { Snapshot } from '../../shared/sim/snapshot';
import { newGame } from '../../shared/sim/state';
import { cleanNewGameOptions } from '../../shared/data/founding';
import { TICKS_PER_HOUR } from '../../shared/sim/time';

const SAVE_KEY = 'littletown.save';
const BACKUP_KEY = 'littletown.backup';
const SETTINGS_KEY = 'littletown.settings';
const AUTOSAVE_MS = 30_000;

/** Browser storage can be missing or full; the game carries on either way. */
function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string): boolean {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error(`[mobile] could not store ${key}`, err);
    return false;
  }
}

const randomSeed = () => Math.floor(Math.random() * 0xffffffff).toString(36);

export function mobileBridge(): Bridge {
  const settings: { music: boolean } = { music: false, ...JSON.parse(read(SETTINGS_KEY) ?? '{}') };
  const state: StripState = { mode: 'full', hidden: document.hidden, panel: null, music: settings.music };
  const stateListeners = new Set<(s: StripState) => void>();
  const emit = () => stateListeners.forEach((f) => f({ ...state }));
  const snapListeners = new Set<(s: Snapshot) => void>();
  const placeListeners = new Set<(defId: string) => void>();

  /** Set once a new town has been written, so nothing saves the old one over it on the way out. */
  let leaving = false;
  const saveNow = () => {
    if (!game.catchingUp && !leaving) write(SAVE_KEY, serialize(game.state, Date.now()));
  };

  const loaded = (() => {
    const text = read(SAVE_KEY);
    if (!text) return null;
    const r = parseSave(text);
    if (r.ok) return r.save;
    write(`${SAVE_KEY}.unreadable`, text); // kept, never overwritten silently
    return null;
  })();
  const game = new GameLoop(loaded?.state ?? newGame(randomSeed()), (snap) => snapListeners.forEach((f) => f(snap)));
  if (loaded) game.catchUp(Date.now() - loaded.savedAt, saveNow);
  else {
    saveNow();
    state.panel = 'newgame'; // a first run: make the founder and pick how to begin (a starter town waits behind)
  }
  game.start();
  setInterval(saveNow, AUTOSAVE_MS);

  // In the background the page is frozen: save on the way out; coming back, the loop sees the gap and catches up.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) saveNow();
    state.hidden = document.hidden;
    emit();
  });
  window.addEventListener('pagehide', saveNow);
  Object.assign(window, { __game: game }); // (for poking at it from a desktop browser's console)

  // the strip's selection, shown in the card at the top of the page (and the card's buttons, back to the strip)
  const inspectListeners = new Set<(info: InspectInfo | null) => void>();
  const actionListeners = new Set<(id: string) => void>();
  const pinchListeners = new Set<(phase: 'start' | 'move' | 'end', ratio: number) => void>();

  return {
    pinch: (phase, ratio) => pinchListeners.forEach((f) => f(phase, ratio)),
    onPinch: (cb) => {
      pinchListeners.add(cb);
      return () => pinchListeners.delete(cb);
    },
    inspect: (info) => inspectListeners.forEach((f) => f(info)),
    onInspect: (cb) => {
      inspectListeners.add(cb);
      return () => inspectListeners.delete(cb);
    },
    inspectAction: (id) => actionListeners.forEach((f) => f(id)),
    onInspectAction: (cb) => {
      actionListeners.add(cb);
      return () => actionListeners.delete(cb);
    },
    setInteractive: () => {},
    setMode: () => {}, // (no slim ticker on the phone)
    setMusic: (on) => {
      state.music = settings.music = on;
      write(SETTINGS_KEY, JSON.stringify(settings));
      emit();
    },
    togglePanel: (id) => {
      state.panel = state.panel === id ? null : id;
      emit();
    },
    openPanel: (id) => {
      state.panel = id;
      emit();
    },
    closePanel: () => {
      state.panel = null;
      emit();
    },
    getState: async () => ({ ...state }),
    onState: (cb) => {
      stateListeners.add(cb);
      return () => stateListeners.delete(cb);
    },
    startPlacement: (defId) => {
      // get the sheet out of the way so the town can be tapped
      state.panel = null;
      emit();
      placeListeners.forEach((f) => f(defId));
    },
    onPlacement: (cb) => {
      placeListeners.add(cb);
      return () => placeListeners.delete(cb);
    },
    newGame: (raw) => {
      const opts = cleanNewGameOptions(raw);
      if (!opts) return;
      // the old town is kept as the one backup (unless it was ironman), then the page starts over on the new one
      const old = read(SAVE_KEY);
      if (old && !game.state.ironman && game.state.tick >= TICKS_PER_HOUR) write(BACKUP_KEY, old); // (a town only just begun isn't kept)
      write(SAVE_KEY, serialize(newGame(randomSeed(), opts), Date.now()));
      leaving = true;
      location.reload();
    },
    command: (c) => game.command(c),
    getSnapshot: async () => game.snapshot(),
    onSnapshot: (cb) => {
      snapListeners.add(cb);
      return () => snapListeners.delete(cb);
    },
    getJournal: async () => game.journal(),
    // Phone alerts are a desktop feature (they're sent when the desktop app quits).
    getAlerts: async () => ({ ...DEFAULT_ALERTS }),
    setAlerts: async (a) => a,
    testAlert: async () => 'Phone alerts come from the desktop app.',
  };
}
