import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, shell, Tray, type Display, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { PANEL_HEIGHT, PANEL_WIDTH, STRIP_HEIGHT, TICKER_HEIGHT } from '../shared/constants';
import { IPC, PANEL_IDS, type PanelId, type StripMode, type StripState } from '../shared/ipc';
import { BUILDING_BY_ID } from '../shared/data/buildings';
import { parseCommand } from '../shared/sim/commands';
import type { Snapshot } from '../shared/sim/snapshot';
import { newGame, type NewGameOptions } from '../shared/sim/state';
import { TICKS_PER_HOUR } from '../shared/sim/time';
import { BIOMES } from '../shared/data/biomes';
import { cleanNewGameOptions } from '../shared/data/founding';
import { fullscreenAppOnMonitorOf, hwndAddress } from './fullscreen';
import { GameLoop } from '../shared/gameLoop';
import { loadSave, savesDir, writeSave } from './saves';
import { cancelAlerts, scheduleAlerts, testAlert } from '../shared/alerts';
import { cleanAlerts, loadSettings, saveSettings, type Settings } from './settings';
import { trayIconPng } from './trayIcon';

const FULLSCREEN_POLL_MS = 1000;
const AUTOSAVE_MS = 60_000;
const DEBUG_SPEEDS = [1, 10, 60, 600];

let game: GameLoop;
let strip: BrowserWindow | null = null;
let panel: BrowserWindow | null = null;
let panelReady = false;
let tray: Tray | null = null;
let settings: Settings;
let seed = seedFromArgs() ?? randomSeed();
let openPanel: PanelId | null = null;
let hiddenByFullscreen = false;
let hiddenFromTray = false;
let hiddenByLock = false;
let quitting = false;

// The game used to be called Little Town. Only its name changed: saves and settings stay in the old folder, so
// an existing town carries straight on. (Set before anything reads userData.)
app.setPath('userData', path.join(app.getPath('appData'), 'Little Town'));

if (!app.requestSingleInstanceLock()) app.quit();

function seedFromArgs(): string | null {
  const arg = process.argv.find((a) => a.startsWith('--seed='));
  return arg ? arg.slice('--seed='.length) : null;
}

function randomSeed(): string {
  return Math.floor(Math.random() * 0xffffffff).toString(36);
}

const alive = (w: BrowserWindow | null): w is BrowserWindow => !!w && !w.isDestroyed();
const isHidden = () => hiddenByFullscreen || hiddenFromTray || hiddenByLock;

function state(): StripState {
  return { mode: settings.mode, hidden: isHidden(), panel: openPanel, music: settings.music };
}

function broadcast(): void {
  for (const w of [strip, panel]) {
    if (alive(w) && !w.webContents.isLoading()) w.webContents.send(IPC.state, state());
  }
}

/** Sim snapshots go only to windows that are showing. */
function sendSnapshot(snap: Snapshot): void {
  for (const w of [strip, panel]) {
    if (alive(w) && w.isVisible() && !w.webContents.isLoading()) w.webContents.send(IPC.snapshot, snap);
  }
}

/** Start over on a new world. The old town is kept as the newest backup (unless it was an ironman town, or had
 *  only just begun, like the starter town waiting behind the New town panel on a first run). */
function newSeed(opts: NewGameOptions = {}): void {
  const keepOld = game.state.tick >= TICKS_PER_HOUR;
  if (keepOld) writeSave(game.state);
  seed = randomSeed();
  game.reset(newGame(seed, opts));
  writeSave(game.state, keepOld);
  restartStrip();
  rebuildTray();
}


/** Save now (unless time away is still being simulated: that save would lose the rest of it). */
const save = () => {
  if (!game.catchingUp) writeSave(game.state);
};

/* ------------------------------------------------------------ placement */

function targetDisplay(): Display {
  return screen.getAllDisplays().find((d) => d.id === settings.displayId) ?? screen.getPrimaryDisplay();
}

/** Height of what the strip draws. The window itself stays STRIP_HEIGHT tall in both modes: Windows won't
 *  size a window below ~38 DIP, and the transparent rest of it is click-through anyway. */
function visibleHeight(): number {
  return settings.mode === 'full' ? STRIP_HEIGHT : TICKER_HEIGHT;
}

function place(): void {
  const wa = targetDisplay().workArea; // excludes the taskbar
  if (alive(strip)) strip.setBounds({ x: wa.x, y: wa.y + wa.height - STRIP_HEIGHT, width: wa.width, height: STRIP_HEIGHT });
  if (alive(panel)) {
    const h = visibleHeight();
    const ph = Math.min(PANEL_HEIGHT, wa.height - h - 8);
    panel.setBounds({ x: wa.x + wa.width - PANEL_WIDTH - 8, y: wa.y + wa.height - h - ph - 6, width: PANEL_WIDTH, height: ph });
  }
}

/* ------------------------------------------------------------ strip window */

function loadStrip(): void {
  strip?.loadFile(path.join(__dirname, 'renderer/index.html'));
}

/** A new town (or a reload) gets a fresh strip window rather than reloading the page in the old one: on
 *  Windows a reloaded click-through window can stop getting mouse moves, which left the whole strip dead. */
function restartStrip(): void {
  const old = strip;
  strip = null;
  if (alive(old)) old.destroy();
  createStrip();
}

function createStrip(): void {
  const w = new BrowserWindow({
    width: 800,
    height: STRIP_HEIGHT,
    transparent: true,
    frame: false,
    thickFrame: false, // no invisible resize border around the window
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: true,
    focusable: false,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
      autoplayPolicy: 'no-user-gesture-required', // the music toggle lives in the tray
    },
  });
  strip = w;
  w.setAlwaysOnTop(true, 'screen-saver');
  w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  // Click-through by default. `forward` still delivers mouse moves so the renderer can hit-test.
  w.setIgnoreMouseEvents(true, { forward: true });
  place();
  loadStrip();
  w.once('ready-to-show', () => {
    if (!isHidden() && !w.isDestroyed()) w.showInactive();
  });
  // Back to click-through before the page's own script runs (the renderer starts out believing it is), so
  // the two can't disagree about it.
  w.webContents.on('did-start-loading', () => {
    if (!w.isDestroyed()) w.setIgnoreMouseEvents(true, { forward: true });
  });
  w.webContents.on('did-finish-load', () => broadcast());
  w.on('closed', () => {
    if (strip === w) strip = null; // (a replaced window closes after its successor exists)
  });
}

/* ------------------------------------------------------------ pop-up panel window */

function createPanel(): BrowserWindow {
  const w = new BrowserWindow({
    width: PANEL_WIDTH,
    height: PANEL_HEIGHT,
    frame: false,
    thickFrame: false, // no invisible resize border around the window
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    show: false,
    backgroundColor: '#211811',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  w.setAlwaysOnTop(true, 'screen-saver');
  panelReady = false;
  w.loadFile(path.join(__dirname, 'renderer/panel.html'));
  // (isLoading() is still true inside did-finish-load, so readiness is tracked separately)
  w.webContents.on('did-finish-load', () => {
    panelReady = true;
    syncPanel();
  });
  // Closing from outside (e.g. Alt+F4) just hides it, like the close button.
  w.on('close', (e) => {
    if (quitting) return;
    e.preventDefault();
    setPanel(null);
  });
  w.on('closed', () => {
    panel = null;
  });
  return w;
}

/** Show or hide the panel window to match `openPanel` and visibility. */
function syncPanel(): void {
  if (!openPanel || isHidden()) {
    if (alive(panel) && panel.isVisible()) panel.hide();
    return;
  }
  if (!alive(panel)) panel = createPanel();
  place();
  if (panelReady && !panel.isVisible()) panel.show();
}

function setPanel(id: PanelId | null): void {
  openPanel = id;
  syncPanel();
  broadcast();
}

/* ------------------------------------------------------------ mode and visibility */

function setMode(mode: StripMode): void {
  if (mode === settings.mode) return;
  settings.mode = mode;
  saveSettings(settings);
  broadcast();
  place(); // the panel sits just above whatever the strip shows
  rebuildTray();
}

function setMusic(on: boolean): void {
  settings.music = on;
  saveSettings(settings);
  broadcast();
  rebuildTray();
}

function applyVisibility(): void {
  if (alive(strip)) {
    if (isHidden()) strip.hide();
    else if (!strip.isVisible()) strip.showInactive();
  }
  syncPanel();
  broadcast();
  rebuildTray();
}

function pollFullscreen(): void {
  if (!alive(strip)) return;
  const own = [strip, panel].filter(alive).map((w) => hwndAddress(w.getNativeWindowHandle()));
  const fs = fullscreenAppOnMonitorOf(strip.getNativeWindowHandle(), own);
  if (fs !== hiddenByFullscreen) {
    hiddenByFullscreen = fs;
    applyVisibility();
  }
}

/* ------------------------------------------------------------ ipc */

ipcMain.on(IPC.setInteractive, (e, on: unknown) => {
  if (!alive(strip) || e.sender !== strip.webContents) return;
  if (on) strip.setIgnoreMouseEvents(false);
  else strip.setIgnoreMouseEvents(true, { forward: true });
});
ipcMain.on(IPC.setMode, (_e, mode: unknown) => {
  if (mode === 'full' || mode === 'minimal') setMode(mode);
});
ipcMain.on(IPC.setMusic, (_e, on: unknown) => setMusic(on === true));
ipcMain.on(IPC.togglePanel, (_e, id: unknown) => {
  if (!PANEL_IDS.includes(id as PanelId)) return;
  setPanel(openPanel === id ? null : (id as PanelId));
});
ipcMain.on(IPC.openPanel, (_e, id: unknown) => {
  if (PANEL_IDS.includes(id as PanelId)) setPanel(id as PanelId);
});
ipcMain.on(IPC.closePanel, () => setPanel(null));
ipcMain.handle(IPC.getState, () => state());
ipcMain.on(IPC.command, (_e, raw: unknown) => {
  const c = parseCommand(raw);
  if (c) game.command(c);
});
ipcMain.handle(IPC.getSnapshot, () => game.snapshot());
ipcMain.handle(IPC.getJournal, () => game.journal());
ipcMain.handle(IPC.getAlerts, () => settings.alerts);
ipcMain.handle(IPC.setAlerts, (_e, a: unknown) => {
  settings.alerts = cleanAlerts(a);
  saveSettings(settings);
  return settings.alerts;
});
ipcMain.handle(IPC.testAlert, () => testAlert(settings.alerts));
ipcMain.on(IPC.newGame, (e, raw: unknown) => {
  // only from the New town panel (which warns that a living town is set aside)
  const opts = cleanNewGameOptions(raw);
  if (!opts || !alive(panel) || e.sender !== panel.webContents || openPanel !== 'newgame') return;
  setPanel(null);
  newSeed(opts);
});
ipcMain.on(IPC.startPlacement, (_e, defId: unknown) => {
  if (typeof defId !== 'string' || !BUILDING_BY_ID[defId]) return;
  setPanel(null); // get the panel out of the way so the strip can be clicked
  if (settings.mode !== 'full') setMode('full');
  if (alive(strip)) strip.webContents.send(IPC.placement, defId);
});

/* ------------------------------------------------------------ tray (quitting and window options live here: the strip has no hotkeys) */

function rebuildTray(): void {
  if (!tray) return;
  tray.setToolTip(`Chronos Settlement (seed ${seed})` + (hiddenByFullscreen ? ' - hidden while a fullscreen app runs' : ''));
  const displays: MenuItemConstructorOptions[] = screen.getAllDisplays().map((d, i) => ({
    label: `Display ${i + 1} (${d.size.width}x${d.size.height}${d.id === screen.getPrimaryDisplay().id ? ', primary' : ''})`,
    type: 'radio',
    checked: d.id === targetDisplay().id,
    click: () => {
      settings.displayId = d.id;
      saveSettings(settings);
      place();
    },
  }));
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: `Seed: ${seed}`, enabled: false },
      { label: 'New game…', click: () => setPanel('newgame') },
      { type: 'separator' },
      { label: 'Slim ticker', type: 'checkbox', checked: settings.mode === 'minimal', click: (mi) => setMode(mi.checked ? 'minimal' : 'full') },
      { label: 'Hide strip', type: 'checkbox', checked: hiddenFromTray, click: (mi) => { hiddenFromTray = mi.checked; applyVisibility(); } },
      { label: 'Show on', submenu: displays },
      { label: 'Music', type: 'checkbox', checked: settings.music, click: (mi) => setMusic(mi.checked) },
      { label: 'Phone alerts…', click: () => setPanel('alerts') },
      { type: 'separator' },
      {
        label: 'Debug',
        submenu: [
          ...DEBUG_SPEEDS.map((s): MenuItemConstructorOptions => ({
            label: `Game speed ${s}x`,
            type: 'radio',
            checked: game.speed === s,
            click: () => { game.speed = s; },
          })),
          { type: 'separator' },
          {
            label: 'Unlock all buildings',
            type: 'checkbox',
            checked: game.snapshot().unlockAll,
            click: (mi) => game.command({ type: 'cheatUnlockAll', on: mi.checked }),
          },
          { type: 'separator' },
          { label: 'Open saves folder', click: () => void shell.openPath(savesDir()) },
          { label: 'Reload strip', click: () => restartStrip() },
          { label: 'Open DevTools', click: () => strip?.webContents.openDevTools({ mode: 'detach' }) },
        ],
      },
      { type: 'separator' },
      { label: 'Quit', click: () => app.quit() },
    ]),
  );
}

/* ------------------------------------------------------------ lifecycle */

app.whenReady().then(() => {
  settings = loadSettings();
  // back again: alerts scheduled for the time away are no longer needed
  if (settings.scheduledAlerts.length) {
    void cancelAlerts(settings.alerts, settings.scheduledAlerts);
    settings.scheduledAlerts = [];
    saveSettings(settings);
  }
  startGame();
  game.start();
  setInterval(save, AUTOSAVE_MS);
  createStrip();
  // a first run: make the founder and pick how to begin (a starter town waits behind)
  if (firstRun) setPanel('newgame');
  tray = new Tray(nativeImage.createFromBuffer(trayIconPng()));
  tray.on('click', () => {
    if (hiddenFromTray) {
      hiddenFromTray = false;
      applyVisibility();
    }
  });
  rebuildTray();
  const onDisplaysChanged = () => {
    place();
    rebuildTray();
  };
  screen.on('display-metrics-changed', onDisplaysChanged);
  screen.on('display-added', onDisplaysChanged);
  screen.on('display-removed', onDisplaysChanged);
  setInterval(pollFullscreen, FULLSCREEN_POLL_MS);
  // Nobody can see the strip while the PC is locked, so stop drawing it.
  powerMonitor.on('lock-screen', () => { hiddenByLock = true; applyVisibility(); save(); });
  powerMonitor.on('unlock-screen', () => { hiddenByLock = false; applyVisibility(); });
  // (on resume the loop notices the gap in the clock and catches up)
  powerMonitor.on('suspend', save);
  powerMonitor.on('shutdown', save);
});

/**
 * Load the saved town and simulate the time since it was saved, or start a new one. `--seed=` always
 * starts a new town (the old save becomes a backup), in the forest unless --biome= says otherwise. (A first
 * town is founded in the forest; the tray's New game… offers the other biomes and ironman.)
 */
let firstRun = false;
function startGame(): void {
  const forced = seedFromArgs();
  const saved = forced ? null : loadSave();
  firstRun = !saved && !forced;
  if (saved) {
    seed = saved.state.seed;
    game = new GameLoop(saved.state, sendSnapshot);
    // (caught up a slice at a time; saved once it's done)
    game.catchUp(Date.now() - saved.savedAt, () => writeSave(game.state));
  } else {
    const arg = process.argv.find((a) => a.startsWith('--biome='))?.slice('--biome='.length);
    const biome = BIOMES.find((b) => b === arg);
    game = new GameLoop(newGame(seed, { biome }), sendSnapshot);
  }
  if (!game.catchingUp) writeSave(game.state, !!forced);
}

let alertsScheduled = false;
app.on('before-quit', (e) => {
  quitting = true;
  if (!game) return;
  save();
  // phone alerts for the time away: hold the quit until they're scheduled (or give up after a while)
  if (!settings.alerts.enabled || alertsScheduled) return;
  e.preventDefault();
  alertsScheduled = true;
  const giveUp = new Promise<string[]>((resolve) => setTimeout(() => resolve([]), 10_000));
  void Promise.race([scheduleAlerts(settings.alerts, game.state), giveUp])
    .catch(() => [] as string[])
    .then((ids) => {
      settings.scheduledAlerts = ids;
      saveSettings(settings);
      app.quit();
    });
});
app.on('window-all-closed', () => app.quit());
