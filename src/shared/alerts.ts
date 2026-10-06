// Phone alerts through ntfy (DESIGN §10). Nothing is sent unless the player turned alerts on and gave
// their own topic. On leaving (the desktop app quitting, the phone page going to the background), the game looks as
// far ahead as the time away can take the town and schedules delayed ntfy messages for what's coming (raiders at the
// gate, with some lead time; optionally deaths, returning expeditions, questions). Coming back, it asks the server to
// drop any still pending, since the player is back.

import { DEFAULT_ALERTS, validServer, validTopic, type AlertSettings } from './ipc';
import { forecast, type ForecastEvent } from './sim/forecast';
export { startForecast, type ForecastJob } from './sim/forecast';
import { awayRealMs, MAX_OFFLINE_MS } from './sim/offline';
import type { GameState } from './sim/state';
import { TICK_MS } from './sim/time';
/** ntfy won't schedule closer than this; alerts due sooner are skipped. */
const MIN_DELAY_MS = 30_000;
const TIMEOUT_MS = 5_000;

const TAGS: Record<ForecastEvent['kind'], string> = { raid: 'crossed_swords', death: 'skull', expedition: 'compass', choice: 'question', event: 'question', hero: 'star', delve: 'dragon_face', war: 'triangular_flag_on_post' };

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

/** Events already looked ahead (startForecast, worked out while the game was open), from the tick they start at. */
export interface Ahead {
  from: number;
  events: ForecastEvent[];
}

/** The forecast an alert plan reads: a whole absence ahead. */
export const AHEAD_TICKS = Math.floor(MAX_OFFLINE_MS / TICK_MS);

/** The alerts worth sending for this forecast, with when each should arrive (wall-clock ms). `ahead` is a forecast
 *  already made (it may be a little old: what's already past is dropped); without it, one is made now. */
export function plan(a: AlertSettings, state: GameState, now: number, ahead?: Ahead): { at: number; event: ForecastEvent }[] {
  if (!a.enabled || !a.topic) return [];
  // (a choice event always: the town pauses for it, and the alert is how you hear it's waiting)
  const want = { raid: a.raids, death: a.deaths, expedition: a.expeditions, choice: a.choices, event: true, hero: a.hero, delve: a.delves, war: a.war !== false };
  const events = ahead ? ahead.events : forecast(state, AHEAD_TICKS);
  // (no further than one absence can take the town, and nothing past the first raid or choice event: the town waits
  // for the player there; sim/raidWait.ts, offline.ts)
  const stop = events.find((e) => e.kind === 'raid' || e.kind === 'event')?.tick ?? Infinity;
  return events
    .filter((e) => want[e.kind] && e.tick <= stop && e.tick >= state.tick)
    .map((event) => {
      const when = now + awayRealMs((event.tick - state.tick) * TICK_MS);
      // (a raid sooner than the lead time: as soon as ntfy allows)
      return { event, when, at: Math.max(now + MIN_DELAY_MS, when - (event.kind === 'raid' ? a.leadMinutes * 60_000 : 0)) };
    })
    .filter((p) => p.when >= now + MIN_DELAY_MS)
    .map(({ event, at }) => ({ event, at }));
}

/** Schedule the alerts for the time away. Returns the ids of the scheduled messages. All are sent at once, as the page
 *  goes to the background (a phone may freeze it a moment later). */
export async function scheduleAlerts(a: AlertSettings, state: GameState, ahead?: Ahead): Promise<string[]> {
  const sent = await Promise.all(
    plan(a, state, Date.now(), ahead).map(({ at, event }) => {
      const lead = event.kind === 'raid' && a.leadMinutes ? ` (in about ${a.leadMinutes} min)` : '';
      return postTagged(a, event, lead, at).catch((err) => {
        console.warn('[alerts] could not schedule:', (err as Error).message);
        return null;
      });
    }),
  );
  return sent.filter((id): id is string => !!id);
}

/** One alert, booked for `at`. Everything rides in the address (ntfy reads title, tags, priority and time from it), so
 *  it's a plain request with no preflight, and `keepalive` lets it finish if the page is frozen or closed meanwhile. */
async function postTagged(a: AlertSettings, e: ForecastEvent, lead: string, at: number): Promise<string | null> {
  const q = new URLSearchParams({ title: `Chronos Settlement: ${e.title}`, tags: TAGS[e.kind], at: String(Math.round(at / 1000)) });
  if (e.kind === 'raid' || e.kind === 'event' || e.kind === 'war') q.set('priority', 'high');
  const res = await fetch(`${url(a)}?${q}`, { method: 'POST', body: `${e.text}${lead}`, keepalive: true, signal: AbortSignal.timeout(TIMEOUT_MS) });
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
