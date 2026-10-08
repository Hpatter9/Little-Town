// The phone (web) version's stand-in for the desktop app's main process: it runs the game loop in the page,
// keeps the town in the browser's storage, and catches up on the time the app was closed or in the background.

import { spawnBand } from '../../shared/sim/bands';
import type { BandKind } from '../../shared/data/bands';
import { summonDragon } from '../../shared/sim/dragon';
import { startDisaster, type DisasterKind } from '../../shared/sim/disasters';
import { inherit, legendOf } from '../../shared/sim/legacy';
import { keepLegend, readLegends } from '../legends';
import { type AlertSettings, type Bridge, type InspectInfo, type StripState } from '../../shared/ipc';
import { AHEAD_TICKS, cancelAlerts, cleanAlerts, scheduleAlerts, startForecast, testAlert, type Ahead, type ForecastJob } from '../../shared/alerts';
import { GameLoop } from '../../shared/gameLoop';
import { parseSave, serialize } from '../../shared/sim/save';
import type { Snapshot } from '../../shared/sim/snapshot';
import { newGame, type GameState } from '../../shared/sim/state';
import { cleanNewGameOptions } from '../../shared/data/founding';
import { TICKS_PER_HOUR } from '../../shared/sim/time';
import { beginSaga } from '../../shared/sim/sagas';
import { postHunt } from '../../shared/sim/hunts';
import { startRaid } from '../../shared/sim/raids';
import { RAID_KIND_BY_ID } from '../../shared/data/raids';
import { Rng } from '../../shared/rng';

const SAVE_KEY = 'littletown.save';
const BACKUP_KEY = 'littletown.backup';
const SETTINGS_KEY = 'littletown.settings';
const ALERTS_KEY = 'littletown.alerts';
/** ntfy messages booked on the way out (dropped on the way back, where the server allows). */
const SCHEDULED_KEY = 'littletown.scheduledAlerts';
/** The look ahead for phone alerts runs a copy of the town forward on the game's own thread, so it takes a little at a
 *  time: at most `LOOK_SLICE_MS` of work, then `LOOK_PAUSE_MS` of rest (about a tenth of the phone's time; it was 60
 *  ticks a slice every 40 ms, most of a phone's time for a minute or more, and the town stuttered), made again every
 *  `LOOK_AGAIN_MS`. The last finished look stands meanwhile. */
const LOOK_SLICE_MS = 6;
const LOOK_PAUSE_MS = 60;
const LOOK_AGAIN_MS = 5 * 60_000;
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

  // Phone alerts (ntfy): booked for the time away as the page goes to the background, dropped when it comes back.
  let alerts: AlertSettings = cleanAlerts(JSON.parse(read(ALERTS_KEY) ?? '{}'));
  const dropBooked = () => {
    const ids = JSON.parse(read(SCHEDULED_KEY) ?? '[]') as string[];
    if (!ids.length) return;
    write(SCHEDULED_KEY, '[]');
    void cancelAlerts(alerts, ids);
  };
  // Looking a day ahead takes seconds on a phone, and a page sent to the background may be frozen in moments: so it's
  // worked out while the game is open, a little at a time, and kept fresh; leaving, the alerts go straight out.
  let ahead: Ahead | null = null;
  let looking: ForecastJob | null = null;
  const lookAhead = () => {
    if (alerts.enabled && !document.hidden && !game.catchingUp) {
      looking ??= startForecast(game.state, AHEAD_TICKS);
      const until = performance.now() + LOOK_SLICE_MS;
      let finished = false;
      while (!finished && performance.now() < until) finished = looking.run(2);
      if (finished) {
        ahead = looking;
        looking = null;
        return setTimeout(lookAhead, LOOK_AGAIN_MS);
      }
    }
    setTimeout(lookAhead, LOOK_PAUSE_MS);
  };
  setTimeout(lookAhead, 60_000); // (the first look a minute in, once the page has settled)
  const book = () => {
    if (!alerts.enabled || game.catchingUp) return;
    dropBooked();
    // (what's been looked at so far, if the first look isn't finished yet)
    void scheduleAlerts(alerts, game.state, ahead ?? looking ?? undefined).then((ids) => write(SCHEDULED_KEY, JSON.stringify(ids)));
  };
  dropBooked();

  // In the background the page is frozen: save on the way out; coming back, the loop sees the gap and catches up.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      saveNow();
      book();
    } else dropBooked();
    state.hidden = document.hidden;
    emit();
  });
  window.addEventListener('pagehide', saveNow);
  // (for poking at it from a desktop browser's console; `__saga(id)` begins a saga, `__hunt(id)` posts a hunt and `__raid(kind)` starts a raid, for previews)
  Object.assign(window, { __game: game, __saga: (id: string) => beginSaga(stateOf(), id), __hunt: (id: string) => postHunt(stateOf(), new Rng(1), id), __raid: (kind: string, budget = 60) => startRaid(stateOf(), RAID_KIND_BY_ID[kind], budget, new Rng(2)), __disaster: (kind: DisasterKind) => startDisaster(stateOf(), kind), __dragon: (kind?: string) => summonDragon(stateOf(), kind), __band: (kind: BandKind) => spawnBand(stateOf(), new Rng(4), kind) });
  function stateOf(): GameState {
    return (game as unknown as { sim: { state: GameState } }).sim.state;
  }

  // the strip's selection, shown in the card at the top of the page (and the card's buttons, back to the strip)
  const inspectListeners = new Set<(info: InspectInfo | null) => void>();
  const actionListeners = new Set<(id: string) => void>();
  const pinchListeners = new Set<(phase: 'start' | 'move' | 'end', spread: number, mx: number, my: number) => void>();

  return {
    pinch: (phase, spread, mx = 0, my = 0) => pinchListeners.forEach((f) => f(phase, spread, mx, my)),
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
      // the old town becomes a legend, and the new founder may be of its line (or another's: sim/legacy.ts)
      const legend = game.catchingUp ? null : legendOf(game.state, Date.now());
      if (legend) keepLegend(legend);
      const town = newGame(randomSeed(), opts);
      const heir = (raw as { heir?: unknown }).heir;
      const line = typeof heir === 'string' ? readLegends().find((l) => l.id === heir) : undefined;
      if (line) inherit(town, line);
      write(SAVE_KEY, serialize(town, Date.now()));
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
    getAlerts: async () => ({ ...alerts }),
    setAlerts: async (a) => {
      alerts = cleanAlerts(a);
      write(ALERTS_KEY, JSON.stringify(alerts));
      return { ...alerts };
    },
    testAlert: async () => testAlert(alerts),
  };
}
