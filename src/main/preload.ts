import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import { IPC, type Bridge } from '../shared/ipc';

function subscribe<T>(channel: string, cb: (v: T) => void): () => void {
  const listener = (_e: IpcRendererEvent, v: T) => cb(v);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
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
  onSnapshot: (cb) => subscribe(IPC.snapshot, cb),
  getJournal: () => ipcRenderer.invoke(IPC.getJournal),
  getAlerts: () => ipcRenderer.invoke(IPC.getAlerts),
  setAlerts: (a) => ipcRenderer.invoke(IPC.setAlerts, a),
  testAlert: () => ipcRenderer.invoke(IPC.testAlert),
};

contextBridge.exposeInMainWorld('bridge', bridge);
