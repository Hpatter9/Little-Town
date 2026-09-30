// App settings (not the game save): strip mode, which display it lives on, and phone alerts.

import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { DEFAULT_ALERTS, type AlertSettings, type StripMode } from '../shared/ipc';
import { cleanAlerts } from '../shared/alerts';

export { cleanAlerts };

export interface Settings {
  mode: StripMode;
  /** Electron display id; null = primary display. */
  displayId: number | null;
  alerts: AlertSettings;
  music: boolean;
  /** ntfy messages scheduled on the last close (cancelled on the next start, where the server allows). */
  scheduledAlerts: string[];
}

const DEFAULTS: Settings = { mode: 'full', displayId: null, alerts: { ...DEFAULT_ALERTS }, music: false, scheduledAlerts: [] };

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) as Partial<Settings>;
    return {
      mode: raw.mode === 'minimal' ? 'minimal' : 'full',
      displayId: typeof raw.displayId === 'number' ? raw.displayId : null,
      alerts: cleanAlerts(raw.alerts),
      music: raw.music === true,
      scheduledAlerts: Array.isArray(raw.scheduledAlerts) ? raw.scheduledAlerts.filter((x) => typeof x === 'string') : [],
    };
  } catch {
    return { ...DEFAULTS, alerts: { ...DEFAULT_ALERTS } };
  }
}

/** Alert settings from untrusted input (the file, or the panel): anything odd falls back to the default. */

export function saveSettings(s: Settings): void {
  try {
    fs.mkdirSync(path.dirname(settingsPath()), { recursive: true });
    fs.writeFileSync(settingsPath(), JSON.stringify(s, null, 2));
  } catch (err) {
    console.error('saving settings failed', err);
  }
}
