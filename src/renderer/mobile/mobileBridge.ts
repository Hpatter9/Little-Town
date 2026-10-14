// The phone (web) version's stand-in for the desktop app's main process: it starts the game in a worker of its own
// (shared/simHost.ts, renderer/mobile/simWorker.ts), puts the snapshots back together from what changed
// (shared/snapDelta.ts), and keeps the town in the browser's storage from the save text the game sends.

import { keepLegend, readLegends } from '../legends';
import { type AlertSettings, type Bridge, type InspectInfo, type StripState } from '../../shared/ipc';
import { cancelAlerts, cleanAlerts, testAlert } from '../../shared/alerts';
import type { JournalEntryView, Snapshot } from '../../shared/sim/snapshot';
import { SnapAssembler } from '../../shared/snapDelta';
import type { FromHost, NewTown, ToHost, startSimHost } from '../../shared/simHost';
import { mayBuzz, readVibrate } from '../vibration';

const SAVE_KEY = 'littletown.save';
const BACKUP_KEY = 'littletown.backup';
const SETTINGS_KEY = 'littletown.settings';
const ALERTS_KEY = 'littletown.alerts';
const TIMELAPSE_KEY = 'littletown.timelapse';
/** ntfy messages booked on the way out (dropped on the way back, where the server allows). */
const SCHEDULED_KEY = 'littletown.scheduledAlerts';
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

/** The game, in a worker of its own (simWorker.js, beside the page), or where a browser can't start one, the same
 *  file loaded into the page (`?inpage` forces it, for comparing). Messages sent before it's ready wait. */
function startGame(take: (m: FromHost) => void): (m: ToHost) => void {
  try {
    if (typeof Worker !== 'undefined' && !/[?&]inpage\b/.test(location.search)) {
      const w = new Worker('simWorker.js');
      w.onmessage = (e: MessageEvent<FromHost>) => take(e.data);
      w.onerror = (e) => console.error('[mobile] the sim worker failed', e);
      return (m) => w.postMessage(m);
    }
  } catch (err) {
    console.warn('[mobile] no sim worker; the game runs in the page', err);
  }
  let give: ((m: ToHost) => void) | null = null;
  const waiting: ToHost[] = [];
  const script = document.createElement('script');
  script.src = 'simWorker.js';
  script.onload = () => {
    const host = (window as unknown as { __simHost: typeof startSimHost }).__simHost;
    give = host((m) => queueMicrotask(() => take(m)));
    for (const m of waiting.splice(0)) give(m);
  };
  document.head.append(script);
  return (m) => (give ? give(m) : waiting.push(m));
}

export function mobileBridge(): Bridge {
  try {
    localStorage.removeItem(TIMELAPSE_KEY);
  } catch {}
  const settings: { music: boolean } = { music: false, ...JSON.parse(read(SETTINGS_KEY) ?? '{}') };
  const state: StripState = { mode: 'full', hidden: document.hidden, panel: null, music: settings.music };
  const stateListeners = new Set<(s: StripState) => void>();
  const emit = () => stateListeners.forEach((f) => f({ ...state }));
  const snapListeners = new Set<(s: Snapshot) => void>();
  const placeListeners = new Set<(defId: string) => void>();

  /** Set once a new town has been written, so nothing saves the old one over it on the way out. */
  let leaving = false;
  let alerts: AlertSettings = cleanAlerts(JSON.parse(read(ALERTS_KEY) ?? '{}'));
  const assembler = new SnapAssembler();
  let firstSnap: (s: Snapshot) => void = () => {};
  const first = new Promise<Snapshot>((res) => (firstSnap = res));
  let nextAsk = 1;
  const asked = new Map<number, (v: unknown) => void>();
  const savedText = read(SAVE_KEY);
  const send = startGame((m) => {
    switch (m.t) {
      case 'snap': {
        const snap = assembler.apply(m.d);
        firstSnap(snap);
        snapListeners.forEach((f) => f(snap));
        return;
      }
      case 'save':
        if (!leaving) write(SAVE_KEY, m.text);
        return;
      case 'started':
        if (m.unreadable && savedText) write(`${SAVE_KEY}.unreadable`, savedText); // kept, never overwritten silently
        if (m.fresh) {
          state.panel = 'newgame'; // a first run: make the founder and pick how to begin (a starter town waits behind)
          emit();
        }
        return;
      case 'booked':
        write(SCHEDULED_KEY, JSON.stringify(m.ids));
        return;
      case 'reply':
        asked.get(m.id)?.(m.value);
        asked.delete(m.id);
        return;
    }
  });
  const ask = <T>(m: Record<string, unknown> & { t: 'save' | 'journal' | 'newGame' }): Promise<T> =>
    new Promise<T>((res) => {
      const id = nextAsk++;
      asked.set(id, res as (v: unknown) => void);
      send({ ...m, id } as ToHost);
    });
  const catchingUp = () => !!assembler.current?.catchingUp;
  send({ t: 'init', save: savedText, now: Date.now(), hidden: document.hidden, alerts });

  // Phone alerts (ntfy): booked for the time away as the page goes to the background (the game's side looks ahead
  // while it's open), dropped when it comes back.
  const dropBooked = () => {
    const ids = JSON.parse(read(SCHEDULED_KEY) ?? '[]') as string[];
    if (!ids.length) return;
    write(SCHEDULED_KEY, '[]');
    void cancelAlerts(alerts, ids);
  };
  dropBooked();

  // In the background the page is frozen: the game saves on the way out (and books the alerts); coming back, it sees
  // the gap and catches up.
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) dropBooked();
    send({ t: 'hidden', on: document.hidden });
    state.hidden = document.hidden;
    emit();
  });
  window.addEventListener('pagehide', () => send({ t: 'hidden', on: true }));
  // (for poking at it from a desktop browser's console; `__saga(id)` begins a saga, `__hunt(id)` posts a hunt and
  // `__raid(kind)` starts a raid, for previews; `__game.sim.step(n)` runs the town n ticks on)
  const debug =
    (name: string) =>
    (...args: unknown[]) =>
      send({ t: 'debug', name, args });
  Object.assign(window, {
    __game: { sim: { step: (n = 1) => send({ t: 'step', n }) }, command: (c: Parameters<Bridge['command']>[0]) => send({ t: 'command', c }), snapshot: () => assembler.current },
    ...Object.fromEntries(['saga', 'hunt', 'raid', 'disaster', 'festival', 'dragon', 'band', 'skirmish', 'cutscene'].map((n) => [`__${n}`, debug(n)])),
  });

  // the strip's selection, shown in the card at the top of the page (and the card's buttons, back to the strip)
  const inspectListeners = new Set<(info: InspectInfo | null) => void>();
  const actionListeners = new Set<(id: string) => void>();
  const pinchListeners = new Set<(phase: 'start' | 'move' | 'end', spread: number, mx: number, my: number) => void>();
  /** When the phone last buzzed (renderer/vibration.ts). */
  let lastBuzz = -Infinity;

  return {
    // (the strip asks; the buzz is made here, in the page the player touched: an iframe's own call may be refused)
    vibrate: (pattern) => {
      if (document.hidden || catchingUp() || !readVibrate() || typeof navigator.vibrate !== 'function') return;
      const now = performance.now();
      if (!mayBuzz(lastBuzz, now)) return;
      lastBuzz = now;
      try {
        navigator.vibrate([...pattern]);
      } catch {}
    },
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
      if (leaving) return;
      // the old town is kept as the one backup (unless it was ironman), then the page starts over on the new one; the
      // old town becomes a legend, and the new founder may be of its line (or another's: sim/legacy.ts)
      const heir = (raw as { heir?: unknown }).heir;
      const line = typeof heir === 'string' ? readLegends().find((l) => l.id === heir) : undefined;
      void ask<NewTown | null>({ t: 'newGame', opts: raw, heir: line, now: Date.now() }).then((town) => {
        if (!town) return;
        leaving = true;
        const old = read(SAVE_KEY);
        if (old && town.keepOld) write(BACKUP_KEY, old); // (a town only just begun isn't kept)
        if (town.legend) keepLegend(town.legend);
        write(SAVE_KEY, town.text);
        location.reload();
      });
    },
    command: (c) => send({ t: 'command', c }),
    getSnapshot: () => (assembler.current ? Promise.resolve(assembler.current) : first),
    onSnapshot: (cb) => {
      snapListeners.add(cb);
      return () => snapListeners.delete(cb);
    },
    getJournal: () => ask<JournalEntryView[]>({ t: 'journal' }),
    getAlerts: async () => ({ ...alerts }),
    setAlerts: async (a) => {
      alerts = cleanAlerts(a);
      write(ALERTS_KEY, JSON.stringify(alerts));
      send({ t: 'alerts', a: alerts });
      return { ...alerts };
    },
    testAlert: async () => testAlert(alerts),
  };
}
