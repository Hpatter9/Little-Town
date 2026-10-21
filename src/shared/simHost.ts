// The phone's game, run apart from the page (the owner's ask: the phone smoother): the sim, the autosave's
// writing out and the alerts live here, in a Web Worker (renderer/mobile/simWorker.ts),
// so none of it ever holds up drawing or a tap. The page (renderer/mobile/mobileBridge.ts) keeps what only it can:
// localStorage, the legends and the buzz. Commands come in, snapshots go out as what changed (snapDelta.ts). No DOM:
// where a browser has no workers the page runs this itself, and the tests run it under node.

import type { AlertSettings } from './ipc';
import { GameLoop } from './gameLoop';
import { SnapDiffer, type SnapDelta } from './snapDelta';
import type { Command } from './sim/commands';
import type { JournalEntryView } from './sim/snapshot';
import { parseSave, serialize } from './sim/save';
import { newGame, type GameState, type Roamer } from './sim/state';
import { cleanNewGameOptions } from './data/founding';
import { BIOMES } from './data/biomes';
import { TICKS_PER_HOUR } from './sim/time';
import { inherit, legendOf, type Legend } from './sim/legacy';
import type { EnemyKind } from './data/greatEnemy';
import { startEvent } from './sim/events';
import { EVENT_BY_ID } from './data/events';
import { enemyLegend, forceEnemy, inheritEnemy, type EnemyLegend } from './sim/greatEnemy';
import { queueScene } from './sim/cutscenes';
import { spawnBand } from './sim/bands';
import type { BandKind } from './data/bands';
import { summonDragon } from './sim/dragon';
import { skiesPreview } from './sim/skiesPreview';
import { startDisaster, type DisasterKind } from './sim/disasters';
import { previewFestival } from './sim/festivals';
import { beginSaga } from './sim/sagas';
import { postHunt } from './sim/hunts';
import { startRaid } from './sim/raids';
import { RAID_KIND_BY_ID } from './data/raids';
import { startSkirmish } from './sim/roamers';
import { Rng } from './rng';

const AUTOSAVE_MS = 30_000;
/** The clock is let go after this long held, whatever the page says (a page that failed to load can't hold it). */
const MOST_HELD_MS = 60_000;

/** What the page sends. Those with an `id` are answered with a `reply` of the same id. */
export type ToHost =
  | {
      t: 'init';
      save: string | null;
      now: number;
      hidden: boolean;
      alerts: AlertSettings;
      /** With no save: the new town's seed and land (the desktop app's `--seed=` and `--biome=`). */
      seed?: string;
      biome?: string;
      /** The clock held until the page's loading screen has gone (`hold`, off). */
      held?: boolean;
    }
  /** Hold the clock, or let it run (the phone's loading screen: renderer/mobile/loading.ts). */
  | { t: 'hold'; on: boolean }
  | { t: 'command'; c: Command }
  /** Out of sight. On the phone that means the player has gone, so the game saves (and stands still till it is back);
   *  the desktop strip hidden behind a fullscreen app saves only (`book: false`). */
  | { t: 'hidden'; on: boolean; book?: boolean }
  /** The desktop app's debug speed (1 = real time). */
  | { t: 'speed'; n: number }
  | { t: 'alerts'; a: AlertSettings }
  | { t: 'save'; id: number }
  | { t: 'journal'; id: number }
  | { t: 'newGame'; id: number; opts: unknown; heir?: Legend; now: number }
  /** The town is over (its founder fell with no heir): its legend, and nothing saved after it. */
  | { t: 'legend'; id: number; now: number }
  | { t: 'step'; n: number }
  | { t: 'debug'; name: string; args: unknown[] };

/** What the host sends back. */
export type FromHost =
  | { t: 'snap'; d: SnapDelta }
  | { t: 'save'; text: string }
  | { t: 'started'; fresh: boolean; unreadable: boolean }
  | { t: 'booked'; ids: string[] }
  | { t: 'reply'; id: number; value: unknown };

/** A new town, as the page writes it: the old town's legend, whether the old save is kept as the backup, the new save. */
export interface NewTown {
  legend: Legend | null;
  keepOld: boolean;
  text: string;
}

const randomSeed = () => Math.floor(Math.random() * 0xffffffff).toString(36);

/** Start the game for a page; `post` sends to it. Returns what takes the page's messages. */
export function startSimHost(post: (m: FromHost) => void): (m: ToHost) => void {
  let game: GameLoop | null = null;
  let hidden = false;
  let leaving = false;
  const differ = new SnapDiffer();

  const send = (snap: Parameters<SnapDiffer['diff']>[0]) => {
    // (nothing is drawn while the page is hidden: what changed meanwhile goes with the first snapshot back)
    if (hidden) return;
    post({ t: 'snap', d: differ.diff(snap) });
  };
  const saveText = (): string | null => (game && !leaving ? serialize(game.state, Date.now()) : null);
  const saveNow = () => {
    const text = saveText();
    if (text) post({ t: 'save', text });
  };
  // (the game only runs while it is open, so nothing is booked for a time away: the desktop app still waits on this reply)
  const book = () => post({ t: 'booked', ids: [] });
  const stateOf = (): GameState => game!.state;
  /** For poking at it from a desktop browser's console (previews): `__saga(id)` begins a saga, and so on. */
  const DEBUG: Record<string, (...a: never[]) => unknown> = {
    saga: (id: string) => beginSaga(stateOf(), id),
    hunt: (id: string) => postHunt(stateOf(), new Rng(1), id),
    raid: (kind: string, budget = 60) => startRaid(stateOf(), RAID_KIND_BY_ID[kind], budget, new Rng(2)),
    disaster: (kind: DisasterKind) => startDisaster(stateOf(), kind),
    festival: (now: 'prep' | 'hold' = 'hold') => previewFestival(stateOf(), now),
    dragon: (kind?: string) => summonDragon(stateOf(), kind),
    skies: (what: string) => skiesPreview(stateOf(), what),
    band: (kind: BandKind) => spawnBand(stateOf(), new Rng(4), kind),
    skirmish: (group: Record<string, number> = { wolf: 3 }) => {
      const s = stateOf();
      const p = s.people[0];
      if (!p) return;
      const r: Roamer = {
        id: s.nextId++,
        kind: 'beasts',
        group,
        x: p.x,
        y: p.y,
        homeX: p.x,
        homeY: p.y,
        tx: p.x,
        ty: p.y,
        until: s.tick + 600,
        chasing: null,
        dir: 1,
      };
      (s.roamers ??= []).push(r);
      s.watching = startSkirmish(s, r, p).id;
    },
    align: (score: number, order: number) => { const s = stateOf(); s.align = { ...(s.align ?? { log: [] }), score, order, log: s.align?.log ?? [] }; }, // (for previews: set the town's alignment)
    event: (id: string) => { const s = stateOf(); if (EVENT_BY_ID[id]) startEvent(s, EVENT_BY_ID[id], new Rng(1)); }, // (for previews: put a choice event)
    enemy: (to?: 'omens' | 'stirring' | 'march' | 'siege', kind?: EnemyKind) => forceEnemy(stateOf(), to, kind),
    cutscene: (id: string, vars: Record<string, string> = {}, foes: Record<string, string> = {}) => queueScene(stateOf(), id, { vars, foes }),
  };

  return (m) => {
    switch (m.t) {
      case 'init': {
        hidden = m.hidden;
        let unreadable = false;
        let state: GameState | null = null;
        if (m.save) {
          const r = parseSave(m.save);
          if (r.ok) {
            state = r.save.state;
          } else unreadable = true;
        }
        const fresh = !state;
        const biome = BIOMES.find((b) => b === m.biome);
        game = new GameLoop(state ?? newGame(m.seed ?? randomSeed(), biome ? { biome } : {}), send);
        game.hidden = hidden;
        if (m.held) {
          game.held = true;
          setTimeout(() => game && (game.held = false), MOST_HELD_MS);
        }
        post({ t: 'started', fresh, unreadable });
        if (fresh) saveNow(); // (a saved town resumes exactly where it was left: no time passes for the time it was closed)
        game.start();
        setInterval(saveNow, AUTOSAVE_MS);
        send(game.snapshot());
        return;
      }
      case 'command':
        return game?.command(m.c);
      case 'hidden':
        hidden = m.on;
        if (game) game.hidden = m.on;
        if (m.on) {
          // (the page may be frozen in moments: save first)
          saveNow();
          if (m.book !== false) book();
        } else if (game) send(game.snapshot()); // (what changed while hidden, at once)
        return;
      case 'hold':
        if (game) game.held = m.on;
        return;
      case 'speed':
        if (game && m.n > 0) game.speed = m.n;
        return;
      case 'save':
        return post({ t: 'reply', id: m.id, value: saveText() });
      case 'journal':
        return post({
          t: 'reply',
          id: m.id,
          value: (game?.journal() ?? []) as JournalEntryView[],
        });
      case 'newGame': {
        const opts = cleanNewGameOptions(m.opts);
        if (!opts || !game) return post({ t: 'reply', id: m.id, value: null });
        const old = game.state;
        const legend: (Legend & { enemy?: EnemyLegend }) | null = legendOf(old, m.now);
        // (the Great Enemy goes on the legend: a descendant whose forebears it broke meets it again)
        const foe = legend ? enemyLegend(old) : undefined;
        if (legend && foe) legend.enemy = foe;
        const town = newGame(randomSeed(), opts);
        if (m.heir) inherit(town, m.heir);
        if (m.heir) inheritEnemy(town, (m.heir as Legend & { enemy?: EnemyLegend }).enemy, m.heir.founder);
        leaving = true; // (nothing saves the old town over the new one now)
        const value: NewTown = {
          legend,
          keepOld: !old.ironman && old.tick >= TICKS_PER_HOUR,
          text: serialize(town, m.now),
        };
        return post({ t: 'reply', id: m.id, value });
      }
      case 'legend': {
        if (!game) return post({ t: 'reply', id: m.id, value: null });
        const legend: (Legend & { enemy?: EnemyLegend }) | null = legendOf(game.state, m.now);
        const foe = legend ? enemyLegend(game.state) : undefined;
        if (legend && foe) legend.enemy = foe;
        leaving = true; // (nothing saves the finished town back)
        return post({ t: 'reply', id: m.id, value: legend });
      }
      case 'step':
        if (game) for (let i = 0; i < m.n; i++) (game as unknown as { sim: { step(): void } }).sim.step();
        if (game) send(game.snapshot());
        return;
      case 'debug':
        if (game) DEBUG[m.name]?.(...(m.args as never[]));
        return;
    }
  };
}
