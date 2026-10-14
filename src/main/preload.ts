import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type Bridge, type SnapMessage } from '../shared/ipc';
import { SnapAssembler } from '../shared/snapDelta';
import type { Snapshot } from '../shared/sim/snapshot';

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, v: T) => cb(v);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

/** The snapshots come as what changed (main/main.ts sendSnapshot). The page puts them back together itself
 *  (renderer/deltaBridge.ts, through `onSnapDelta`); `onSnapshot` here does it in this world, for anything that asks
 *  for whole snapshots without it (each is copied across, so it costs more). */
const assembler = new SnapAssembler();
const wholeListeners = new Set<(s: Snapshot) => void>();
let listening = false;
function onWhole(cb: (s: Snapshot) => void): () => void {
  wholeListeners.add(cb);
  if (!listening) {
    listening = true;
    ipcRenderer.on(IPC.snapDelta, (_e: IpcRendererEvent, m: SnapMessage) => {
      if (!wholeListeners.size) return;
      let s: Snapshot | null = null;
      if (m.full) s = assembler.seed(m.full);
      else if (m.d && assembler.current) s = assembler.apply(m.d);
      else return void ipcRenderer.send(IPC.snapResync); // (a delta with nothing to build on: ask for the whole one)
      for (const f of wholeListeners) f(s);
    });
  }
  return () => wholeListeners.delete(cb);
}

const bridge: Bridge = {
  setInteractive: (on) => ipcRenderer.send(IPC.setInteractive, !!on),
  setMode: (mode) => ipcRenderer.send(IPC.setMode, mode),
  setMusic: (on) => ipcRenderer.send(IPC.setMusic, !!on),
  togglePanel: (id) => ipcRenderer.send(IPC.togglePanel, id),
  openPanel: (id) => ipcRenderer.send(IPC.openPanel, id),
  closePanel: () => ipcRenderer.send(IPC.closePanel),
  getState: () => ipcRenderer.invoke(IPC.getState),
  onState: (cb) => subscribe(IPC.state, cb),
  startPlacement: (defId) => ipcRenderer.send(IPC.startPlacement, defId),
  onPlacement: (cb) => subscribe(IPC.placement, cb),
  command: (c) => ipcRenderer.send(IPC.command, c),
  newGame: (opts) => ipcRenderer.send(IPC.newGame, opts),
  getSnapshot: () => ipcRenderer.invoke(IPC.getSnapshot),
  onSnapshot: (cb) => onWhole(cb),
  onSnapDelta: (cb) => subscribe(IPC.snapDelta, cb),
  snapResync: () => ipcRenderer.send(IPC.snapResync),
  getJournal: () => ipcRenderer.invoke(IPC.getJournal),
  getAlerts: () => ipcRenderer.invoke(IPC.getAlerts),
  setAlerts: (a) => ipcRenderer.invoke(IPC.setAlerts, a),
  testAlert: () => ipcRenderer.invoke(IPC.testAlert),
  getLegends: () => ipcRenderer.invoke(IPC.getLegends),
};

contextBridge.exposeInMainWorld('bridge', bridge);
