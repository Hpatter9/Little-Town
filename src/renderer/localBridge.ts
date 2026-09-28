// Stand-in for the preload bridge when the strip is opened in a plain browser (for previewing the renderer).
// Runs its own copy of the sim; mode and panel changes apply locally; there is no click-through or panel window.

import { DEFAULT_ALERTS, type AlertSettings, type Bridge, type StripState } from '../shared/ipc';
import { Sim } from '../shared/sim/sim';
import { catchUp } from '../shared/sim/offline';
import { journalView, snapshot, type Snapshot } from '../shared/sim/snapshot';
import { newGame } from '../shared/sim/state';
import { customSheetUrl } from './art/customIcons';
import { BIOMES, type Biome } from '../shared/data/biomes';
import { TICK_MS } from '../shared/sim/time';

/** On the phone (web) version the strip and the panel are frames of one page, which owns the game: they use
 *  its bridge. (Null anywhere else.) */
export function hostBridge(): Bridge | null {
  try {
    return window.parent !== window ? (window.parent.bridge ?? null) : null;
  } catch {
    return null; // a parent from another origin
  }
}

export function localBridge(): Bridge {
  const state: StripState = { mode: 'full', hidden: false, panel: null, music: false };
  const stateListeners = new Set<(s: StripState) => void>();
  const emit = () => stateListeners.forEach((f) => f({ ...state }));

  const seed = new URLSearchParams(location.search).get('seed') ?? 'campfire';
  const speed = Number(new URLSearchParams(location.search).get('speed') ?? 1);
  const biome = (new URLSearchParams(location.search).get('biome') ?? 'forest') as Biome;
  const sim = new Sim(newGame(seed, { biome: BIOMES.includes(biome) ? biome : 'forest' }));
  // For poking at the preview from the browser console (never used in the app). __away(ms) pretends the
  // game was closed for that long.
  Object.assign(window, { __sim: sim, __away: (ms: number) => catchUp(sim, ms), __iconSheet: customSheetUrl });
  let alerts: AlertSettings = { ...DEFAULT_ALERTS };
  const snapListeners = new Set<(s: Snapshot) => void>();
  const placeListeners = new Set<(defId: string) => void>();
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    if (sim.advance((now - last) * speed, 600 * speed) > 0) snapListeners.forEach((f) => f(snapshot(sim.state)));
    last = now;
  }, TICK_MS);

  return {
    setInteractive: () => {},
    setMode: (mode) => {
      state.mode = mode;
      emit();
    },
    setMusic: (on) => {
      state.music = on;
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
    startPlacement: (defId) => placeListeners.forEach((f) => f(defId)),
    onPlacement: (cb) => {
      placeListeners.add(cb);
      return () => placeListeners.delete(cb);
    },
    command: (c) => sim.command(c),
    newGame: (opts) => {
      location.search = `?seed=${Math.floor(Math.random() * 1e9).toString(36)}&biome=${opts.biome ?? 'forest'}`;
    },
    getSnapshot: async () => snapshot(sim.state),
    onSnapshot: (cb) => {
      snapListeners.add(cb);
      return () => snapListeners.delete(cb);
    },
    getJournal: async () => journalView(sim.state),
    // (the preview never sends anything anywhere)
    getAlerts: async () => ({ ...alerts }),
    setAlerts: async (a) => (alerts = { ...a }),
    testAlert: async () => 'Alerts are only sent from the desktop app.',
  };
}
