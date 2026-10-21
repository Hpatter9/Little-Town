import { app, BrowserWindow, ipcMain, Menu, nativeImage, powerMonitor, screen, shell, Tray, type Display, type MenuItemConstructorOptions } from 'electron';
import path from 'node:path';
import { PANEL_HEIGHT, PANEL_WIDTH, STRIP_HEIGHT, TICKER_HEIGHT } from '../shared/constants';
import { IPC, PANEL_IDS, type PanelId, type StripMode, type StripState } from '../shared/ipc';
import { Worker } from 'node:worker_threads';
import { BUILDING_BY_ID } from '../shared/data/buildings';
import { parseCommand } from '../shared/sim/commands';
import { cleanNewGameOptions } from '../shared/data/founding';
import type { SnapDelta } from '../shared/snapDelta';
import { startSimHost, type FromHost, type ToHost } from '../shared/simHost';
import { fullscreenAppOnMonitorOf, hwndAddress } from './fullscreen';
import { backupNow, loadSaveText, savesDir, writeSaveText } from './saves';
import { keepLegendFile, legendById, readLegendsFile } from './legends';
import { SimClient, type SimPort } from './simClient';
import { cancelAlerts, testAlert } from '../shared/alerts';
import { cleanAlerts, loadSettings, saveSettings, type Settings } from './settings';
import { trayIconPng } from './trayIcon';

const FULLSCREEN_POLL_MS = 1000;
const AUTOSAVE_MS = 60_000;
const DEBUG_SPEEDS = [1, 10, 60, 600];

/** The game, in a thread of its own (main/simThread.ts): the main process only hands its snapshots on. */
let game: SimClient;
/** The debug speed the tray last set (the thread holds the real one). */
let speed = 1;
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

/** Which windows have the whole snapshot to build on (by webContents id): the rest are sent it whole first. A window
 *  that is hidden, reloads or asks again (its own copy lost) is sent it whole when next it shows. */
const synced = new Set<number>();

/** Sim snapshots go only to windows that are showing, as what changed (the renderer puts them back together:
 *  renderer/deltaBridge.ts); a window not yet in step gets the whole one. */
function sendSnapshot(d: SnapDelta): void {
  const whole = game.current;
  if (whole) seed = whole.seed;
  for (const w of [strip, panel]) {
    if (!alive(w)) continue;
    const id = w.webContents.id;
    if (!w.isVisible() || w.webContents.isLoading()) {
      synced.delete(id);
      continue;
    }
    if (synced.has(id)) w.webContents.send(IPC.snapDelta, { d });
    else if (whole) {
      w.webContents.send(IPC.snapDelta, { full: whole });
      synced.add(id);
    }
  }
}

/** Start the game thread (the built simThread.js beside main.js, unpacked from the app's archive). Should the thread
 *  fail before it has said a word, the game runs in this process instead, as it always used to, with what was sent to
 *  the thread sent again. */
function spawnSim(): SimPort {
  const handlers: ((m: FromHost) => void)[] = [];
  const give = (m: FromHost) => handlers.forEach((f) => f(m));
  const sent: ToHost[] = [];
  let heard = false;
  let local: ((m: ToHost) => void) | null = null;
  let worker: Worker | null = null;
  const fallBack = (err: unknown) => {
    console.error('[sim] the game thread failed; the game runs in the main process', err);
    worker = null;
    local = startSimHost((m) => queueMicrotask(() => give(m)));
    for (const m of sent.splice(0)) local(m);
  };
  try {
    worker = new Worker(path.join(__dirname, 'simThread.js').replace(`app.asar${path.sep}`, `app.asar.unpacked${path.sep}`));
    worker.on('message', (m: FromHost) => {
      heard = true;
      sent.length = 0;
      give(m);
    });
    worker.on('error', (err) => (heard ? console.error('[sim] the game thread failed', err) : fallBack(err)));
  } catch (err) {
    fallBack(err);
  }
  return {
    post: (m) => {
      if (local) return local(m);
      if (!heard) sent.push(m);
      worker?.postMessage(m);
    },
    onMessage: (cb) => handlers.push(cb),
    terminate: () => void worker?.terminate(),
  };
}

/** Start over on a new world. The old town is kept as the newest backup (unless it was an ironman town, or had
 *  only just begun, like the starter town waiting behind the New town panel on a first run), the old town becomes a
 *  legend (main/legends.ts), and a descendant of a legend may found the new one. */
async function newSeed(raw: unknown): Promise<void> {
  const heir = legendById(app.getPath('userData'), (raw as { heir?: unknown } | null)?.heir);
  const old = await game.saveText();
  if (old) writeSaveText(old);
  const town = await game.newTown(raw, heir);
  if (!town) return;
  if (town.legend) keepLegendFile(app.getPath('userData'), town.legend);
  writeSaveText(town.text, town.keepOld);
  synced.clear();
  game.restart(spawnSim);
  startSim(town.text);
  restartStrip();
  rebuildTray();
}

/** Save now (the game thread sends the text). */
const save = () => void game.saveText().then((text) => text && writeSaveText(text));

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
  // (the game hears it too: a fight on screen waits while nobody can see it; the alerts are booked only on quitting)
  if (game) game.send(isHidden() ? { t: 'hidden', on: true, book: false } : { t: 'hidden', on: false });
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
  if (c) game.send({ t: 'command', c });
});
ipcMain.handle(IPC.getSnapshot, () => game.whole());
ipcMain.handle(IPC.getJournal, () => game.journal());
ipcMain.handle(IPC.getLegends, () => readLegendsFile(app.getPath('userData')));
// (a window that lost its place in the snapshots asks for the whole one again)
ipcMain.on(IPC.snapResync, (e) => synced.delete(e.sender.id));
ipcMain.handle(IPC.getAlerts, () => settings.alerts);
ipcMain.handle(IPC.setAlerts, (_e, a: unknown) => {
  settings.alerts = cleanAlerts(a);
  saveSettings(settings);
  game.send({ t: 'alerts', a: settings.alerts });
  return settings.alerts;
});
ipcMain.handle(IPC.testAlert, () => testAlert(settings.alerts));
ipcMain.on(IPC.newGame, (e, raw: unknown) => {
  // only from the New town panel (which warns that a living town is set aside)
  const opts = cleanNewGameOptions(raw);
  if (!opts || !alive(panel) || e.sender !== panel.webContents || openPanel !== 'newgame') return;
  setPanel(null);
  void newSeed(raw);
});
ipcMain.on(IPC.startPlacement, (_e, defId: unknown) => {
  if (typeof defId !== 'string' || !BUILDING_BY_ID[defId]) return;
  setPanel(null); // get the panel out of the way so the strip can be clicked
  if (settings.mode !== 'full') setMode('full');
  if (alive(strip)) strip.webContents.send(IPC.placement, defId);
});

/* ------------------------------------------------------------ the strip's own settings (as the phone's ☰ menu) */

/** Run a line in the strip's page (its settings live there, as on the phone). */
function stripDo(js: string): void {
  if (alive(strip) && !strip.webContents.isLoading()) void strip.webContents.executeJavaScript(js, true).catch(() => {});
}

const VOLUME_STEPS = [0, 25, 50, 75, 100];
const VOLUME_KEYS = { music: 'littletown.musicVolume', sfx: 'littletown.sfxVolume' } as const;
/** The tray's music and sound volume submenus: set in the strip, and kept in its storage (renderer/volume.ts). */
function volumeMenu(kind: 'music' | 'sfx'): MenuItemConstructorOptions[] {
  return VOLUME_STEPS.map((v) => ({
    label: `${v}%`,
    click: () => stripDo(`window.__volume && (window.__volume.${kind} = ${v / 100}); try { localStorage.setItem('${VOLUME_KEYS[kind]}', '${v}') } catch {}`),
  }));
}

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
      // (the phone's ☰ menu has these; the strip keeps them in its own storage)
      { label: 'Music volume', submenu: volumeMenu('music') },
      { label: 'Sound effects volume', submenu: volumeMenu('sfx') },
      { label: 'Show minimap', click: () => stripDo('window.__minimap && (window.__minimap.shown = true)') },
      { label: 'Phone alerts…', click: () => setPanel('alerts') },
      { type: 'separator' },
      {
        label: 'Debug',
        submenu: [
          ...DEBUG_SPEEDS.map((s): MenuItemConstructorOptions => ({
            label: `Game speed ${s}x`,
            type: 'radio',
            checked: speed === s,
            click: () => { speed = s; game.send({ t: 'speed', n: s }); },
          })),
          { type: 'separator' },
          {
            label: 'Unlock all buildings',
            type: 'checkbox',
            checked: !!game.current?.unlockAll,
            click: (mi) => game.send({ t: 'command', c: { type: 'cheatUnlockAll', on: mi.checked } }),
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
  // alerts booked by an older version for a time away are no longer needed
  if (settings.scheduledAlerts.length) {
    void cancelAlerts(settings.alerts, settings.scheduledAlerts);
    settings.scheduledAlerts = [];
    saveSettings(settings);
  }
  startGame();
  setInterval(save, AUTOSAVE_MS);
  createStrip();
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
  powerMonitor.on('suspend', save);
  powerMonitor.on('shutdown', save);
});

/**
 * Load the saved town and simulate the time since it was saved (in the game thread), or start a new one. `--seed=`
 * always starts a new town (the old save becomes a backup), in the forest unless --biome= says otherwise. (A first
 * town is founded in the forest; the tray's New game… offers the other biomes and ironman.)
 */
function startGame(): void {
  const forced = seedFromArgs();
  if (forced) backupNow();
  game = new SimClient(spawnSim, {
    snapshot: (d) => sendSnapshot(d),
    save: (text) => {
      if (!quitting) writeSaveText(text);
    },
    started: (fresh) => {
      // a first run: make the founder and pick how to begin (a starter town waits behind)
      if (fresh && !forced) setPanel('newgame');
    },
    booked: () => {},
  });
  startSim(forced ? null : loadSaveText(), forced ?? undefined);
}

/** Hand the game thread its town (a save's text, or none for a new one). */
function startSim(save: string | null, forcedSeed?: string): void {
  const biome = process.argv.find((a) => a.startsWith('--biome='))?.slice('--biome='.length);
  game.send({ t: 'init', save, now: Date.now(), hidden: isHidden(), alerts: settings.alerts, ...(forcedSeed ? { seed: forcedSeed, biome } : {}) });
  if (speed !== 1) game.send({ t: 'speed', n: speed });
}

let quitReady = false;
app.on('before-quit', (e) => {
  quitting = true;
  if (!game || quitReady) return;
  // the last save: hold the quit until the game thread has done it (or give up after a while)
  e.preventDefault();
  quitReady = true;
  void game.hide(false).then(({ text, ids }) => {
    if (text) writeSaveText(text);
    settings.scheduledAlerts = ids;
    saveSettings(settings);
    game.stop();
    app.quit();
  });
});
app.on('window-all-closed', () => app.quit());
