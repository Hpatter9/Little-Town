// Channel names and the API the preload script exposes to the renderers (strip and panel).

import type { Command } from './sim/commands';
import type { JournalEntryView, Snapshot } from './sim/snapshot';
import type { NewGameOptions } from './sim/state';

export type StripMode = 'full' | 'minimal';

/** 'alerts' and 'newgame' are opened from the tray (or the game-over card), and 'shop' and 'tavern' (their bird's-eye
 *  views) by tapping them in town, not from the dock. */
export type PanelId = 'build' | 'research' | 'expeditions' | 'townsfolk' | 'crafting' | 'trade' | 'journal' | 'alerts' | 'newgame' | 'shop' | 'tavern';
export const PANEL_IDS: readonly PanelId[] = ['build', 'research', 'expeditions', 'townsfolk', 'crafting', 'trade', 'journal', 'alerts', 'newgame', 'shop', 'tavern'];

export const PANELS: readonly { id: PanelId; label: string }[] = [
  { id: 'build', label: 'Plan' }, // (the town's plan: it builds for itself)
  { id: 'research', label: 'Research' },
  { id: 'expeditions', label: 'Expeditions' },
  { id: 'townsfolk', label: 'Townsfolk' },
  { id: 'crafting', label: 'Crafting' },
  { id: 'trade', label: 'Trade' },
  { id: 'journal', label: 'Journal' },
];

/** Phone alerts through ntfy (DESIGN §10). Off until the player sets their own topic. */
export interface AlertSettings {
  enabled: boolean;
  /** ntfy server (https), e.g. https://ntfy.sh */
  server: string;
  /** The player's topic name (anyone who knows it can read it, so it should be hard to guess). */
  topic: string;
  /** Warning before a raid hits, in real minutes. */
  leadMinutes: number;
  raids: boolean;
  deaths: boolean;
  expeditions: boolean;
  choices: boolean;
  /** The hero's big moments (the townsperson the player follows). */
  hero: boolean;
}

export const DEFAULT_ALERTS: AlertSettings = { enabled: false, server: 'https://ntfy.sh', topic: '', leadMinutes: 10, raids: true, deaths: true, expeditions: false, choices: false, hero: true };

/** A valid ntfy topic name. */
export const validTopic = (t: string) => /^[A-Za-z0-9_-]{1,64}$/.test(t);
export const validServer = (u: string) => /^https:\/\/[A-Za-z0-9.-]+(:\d+)?\/?$/.test(u);

/** Window-level state owned by the main process, broadcast to every renderer. */
export interface StripState {
  mode: StripMode;
  /** Hidden by a fullscreen app or from the tray. Renderers stop drawing while hidden. */
  hidden: boolean;
  /** The open pop-up panel, if any. */
  panel: PanelId | null;
  /** Background music on (off by default). */
  music: boolean;
}

export const IPC = {
  setInteractive: 'strip:set-interactive',
  setMode: 'strip:set-mode',
  setMusic: 'strip:set-music',
  togglePanel: 'panel:toggle',
  openPanel: 'panel:open',
  closePanel: 'panel:close',
  getState: 'strip:get-state',
  state: 'strip:state',
  startPlacement: 'build:start-placement',
  placement: 'build:placement',
  command: 'game:command',
  newGame: 'game:new',
  getSnapshot: 'game:get-snapshot',
  snapshot: 'game:snapshot',
  getJournal: 'game:get-journal',
  getAlerts: 'alerts:get',
  setAlerts: 'alerts:set',
  testAlert: 'alerts:test',
} as const;

export interface Bridge {
  /** Strip only. true = the strip captures the mouse; false = clicks pass through to the desktop. */
  setInteractive(on: boolean): void;
  setMode(mode: StripMode): void;
  setMusic(on: boolean): void;
  /** Open a panel, or close it if it is already open. */
  togglePanel(id: PanelId): void;
  /** Open a panel (leaves it open if it already is). */
  openPanel(id: PanelId): void;
  closePanel(): void;
  getState(): Promise<StripState>;
  /** Subscribe to state changes. Returns an unsubscribe function. */
  onState(cb: (s: StripState) => void): () => void;

  /** From the Build panel: close the panel and start placing a building on the strip. */
  startPlacement(defId: string): void;
  /** Strip: a placement was requested. */
  onPlacement(cb: (defId: string) => void): () => void;

  /** Start over with a new world, as chosen in the New town panel. */
  newGame(opts: NewGameOptions): void;

  /** Send a player action to the sim. */
  command(c: Command): void;
  getSnapshot(): Promise<Snapshot>;
  /** Subscribe to sim snapshots (sent every tick while visible). Returns an unsubscribe function. */
  onSnapshot(cb: (s: Snapshot) => void): () => void;
  /** The whole Town Journal, oldest first. */
  getJournal(): Promise<JournalEntryView[]>;

  /** Phone alert settings; a test sends one alert right away and says how it went. */
  getAlerts(): Promise<AlertSettings>;
  setAlerts(a: AlertSettings): Promise<AlertSettings>;
  testAlert(): Promise<string>;

  /** Phone only (the page around the strip): the strip says what's selected, for the card at the top of the
   *  screen (null clears it); the card's buttons come back as action ids. */
  inspect?(info: InspectInfo | null): void;
  onInspect?(cb: (info: InspectInfo | null) => void): () => void;
  inspectAction?(id: string): void;
  onInspectAction?(cb: (id: string) => void): () => void;
  /** Phone only: two fingers pinching the town, to zoom it in and out (spread: how far apart the fingers are, in the
   *  strip's own pixels; the page knows the zoom, so it can tell how far apart they are on the screen). */
  pinch?(phase: 'start' | 'move' | 'end', spread: number): void;
  onPinch?(cb: (phase: 'start' | 'move' | 'end', spread: number) => void): () => void;
}

/** What the phone's top card shows about the selected thing. */
export interface InspectInfo {
  title: string;
  lines: string[];
  actions: { id: string; label: string; danger?: boolean; primary?: boolean }[];
}
