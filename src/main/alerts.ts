// Phone alerts through ntfy (DESIGN §10). Nothing is sent unless the player turned alerts on and gave
// their own topic. On quit, the game looks a day ahead and schedules delayed ntfy messages for what's
// coming (raids with some lead time; optionally deaths, returning expeditions, questions). On the next
// start it asks the server to drop any still pending, since the player is back.

import type { AlertSettings } from '../shared/ipc';
import { forecast, type ForecastEvent } from '../shared/sim/forecast';
import type { GameState } from '../shared/sim/state';
import { TICK_MS, TICKS_PER_HOUR } from '../shared/sim/time';

/** How far ahead to look, in game hours (a game hour is a real minute: this is a real day). */
const LOOKAHEAD_HOURS = 24 * 60;
/** ntfy won't schedule closer than this; alerts due sooner are skipped. */
const MIN_DELAY_MS = 30_000;
const TIMEOUT_MS = 5_000;

const TAGS: Record<ForecastEvent['kind'], string> = { raid: 'crossed_swords', death: 'skull', expedition: 'compass', choice: 'question' };

function url(a: AlertSettings): string {
  return `${a.server}/${encodeURIComponent(a.topic)}`;
}

async function post(a: AlertSettings, title: string, body: string, at?: number): Promise<string | null> {
  const headers: Record<string, string> = { Title: title, Tags: 'house' };
  if (at) headers.At = String(Math.round(at / 1000));
  const res = await fetch(url(a), { method: 'POST', body, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
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

/** The alerts worth sending for this forecast, with when each should arrive (wall-clock ms). */
export function plan(a: AlertSettings, state: GameState, now: number): { at: number; event: ForecastEvent }[] {
  if (!a.enabled || !a.topic) return [];
  const want = { raid: a.raids, death: a.deaths, expedition: a.expeditions, choice: a.choices };
  return forecast(state, LOOKAHEAD_HOURS * TICKS_PER_HOUR)
    .filter((e) => want[e.kind])
    .map((event) => ({ event, at: now + (event.tick - state.tick) * TICK_MS - (event.kind === 'raid' ? a.leadMinutes * 60_000 : 0) }))
    .filter((p) => p.at >= now + MIN_DELAY_MS);
}

/** Schedule the alerts for the time away. Returns the ids of the scheduled messages. */
export async function scheduleAlerts(a: AlertSettings, state: GameState): Promise<string[]> {
  const ids: string[] = [];
  for (const { at, event } of plan(a, state, Date.now())) {
    try {
      const lead = event.kind === 'raid' && a.leadMinutes ? ` (in about ${a.leadMinutes} min)` : '';
      const id = await postTagged(a, event, lead, at);
      if (id) ids.push(id);
    } catch (err) {
      console.warn('[alerts] could not schedule:', (err as Error).message);
      break;
    }
  }
  return ids;
}

async function postTagged(a: AlertSettings, e: ForecastEvent, lead: string, at: number): Promise<string | null> {
  const headers: Record<string, string> = { Title: `Chronos Settlement: ${e.title}`, Tags: TAGS[e.kind], At: String(Math.round(at / 1000)) };
  if (e.kind === 'raid') headers.Priority = 'high';
  const res = await fetch(url(a), { method: 'POST', body: `${e.text}${lead}`, headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`ntfy answered ${res.status}`);
  const json = (await res.json().catch(() => ({}))) as { id?: string };
  return json.id ?? null;
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
