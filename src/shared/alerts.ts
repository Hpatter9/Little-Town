// Phone alerts through ntfy (DESIGN §10). The game no longer runs while it is closed, so nothing is booked ahead for a
// time away any more: what is left is the panel's test alert, the settings' cleaning, and dropping any alert an older
// version booked (`cancelAlerts`).

import { DEFAULT_ALERTS, validServer, validTopic, type AlertSettings } from './ipc';
const TIMEOUT_MS = 5_000;

function url(a: AlertSettings): string {
  return `${a.server}/${encodeURIComponent(a.topic)}`;
}

async function post(a: AlertSettings, title: string, body: string, at?: number): Promise<string | null> {
  const q = new URLSearchParams({ title, tags: 'house' });
  if (at) q.set('at', String(Math.round(at / 1000)));
  const res = await fetch(`${url(a)}?${q}`, { method: 'POST', body, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`ntfy answered ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return json.id ?? null;
}

/** Send one alert now (the panel's test button). */
export async function testAlert(a: AlertSettings): Promise<string> {
  if (!a.topic) return 'Set a topic first.';
  try {
    await post(a, 'Chronos Settlement', 'Test alert: phone alerts are working.');
    return `Sent to ${a.topic}. Check the ntfy app.`;
  } catch (err) {
    return `Could not send: ${(err as Error).message}`;
  }
}

/** The player is back: ask the server to drop alerts still waiting (best effort; not every server can). */
export async function cancelAlerts(a: AlertSettings, ids: string[]): Promise<void> {
  for (const id of ids) {
    try {
      await fetch(`${url(a)}/${encodeURIComponent(id)}`, { method: 'DELETE', signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch {
      /* the alert will just arrive */
    }
  }
}

/** Alert settings as stored or sent (anything odd falls back to the defaults; no topic, no alerts). */
export function cleanAlerts(a: unknown): AlertSettings {
  const x = (a && typeof a === 'object' ? a : {}) as Partial<AlertSettings>;
  const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d);
  const topic = typeof x.topic === 'string' && validTopic(x.topic.trim()) ? x.topic.trim() : '';
  const server = typeof x.server === 'string' && validServer(x.server.trim()) ? x.server.trim().replace(/\/$/, '') : DEFAULT_ALERTS.server;
  const lead = typeof x.leadMinutes === 'number' && Number.isFinite(x.leadMinutes) ? Math.max(0, Math.min(120, Math.round(x.leadMinutes))) : DEFAULT_ALERTS.leadMinutes;
  return {
    enabled: bool(x.enabled, false) && topic !== '',
    server,
    topic,
    leadMinutes: lead,
    raids: bool(x.raids, DEFAULT_ALERTS.raids),
    deaths: bool(x.deaths, DEFAULT_ALERTS.deaths),
    expeditions: bool(x.expeditions, DEFAULT_ALERTS.expeditions),
    choices: bool(x.choices, DEFAULT_ALERTS.choices),
    hero: bool(x.hero, DEFAULT_ALERTS.hero),
    delves: bool(x.delves, DEFAULT_ALERTS.delves),
    war: bool(x.war, true),
  };
}
