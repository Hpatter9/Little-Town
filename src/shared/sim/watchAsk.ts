// Big fights ask to be watched (the owner's ask: "I want to watch the fights for big battles like raiding the barrow
// crypt"). When a party away meets a fight worth seeing (a boss, the fight at a dungeon, a place to clear or a hunt's
// quarry, a stronghold stormed) and the player isn't already watching it, the fight holds (the trip waits on
// `Expedition.prompt`, as for any question about a party) and the player is asked: watch it (`s.watching`, the fight
// screen) or let it play out. Unanswered, it plays out after `WATCH_ASK_HOURS`. Asked once at the site and once for its
// boss a trip (`Expedition.watchAsked`); never while the town is caught up after time away or looked ahead for the
// phone's alerts (`runtime.quiet`), nor in a town whose autopilot is off (the tests' single mechanics).

import { ENEMIES } from '../data/enemies';
import { the, type Destination } from '../data/expeditions';
import { eventPicture } from '../data/eventScenes';
import { calendar, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { seaTown } from './sea';
import { notify, type Expedition, type GameState, type Prompt } from './state';

/** How long the question waits before the fight plays out on its own (game hours: two real minutes). */
export const WATCH_ASK_HOURS = 2;
/** What has been asked on a trip: at the site, and for its boss. */
const SITE = 1;
const BOSS = 2;

/** Set while the sim runs without the player looking (the catch-up after time away, the alerts' look ahead). */
export const runtime = { quiet: false };

/** Whether a fight is a big one: a boss, or the fight at the place the party set out for. */
export function bigFight(e: Expedition, d: Destination, group: Record<string, number>): boolean {
  if (Object.keys(group).some((id) => ENEMIES[id]?.boss)) return true;
  if (e.phase !== 'work') return false;
  return !!e.assault || !!e.delve || d.type === 'delve' || d.type === 'clear';
}

/** A big fight has begun: ask the player whether to watch it (and hold it till they say). True if asked. */
export function askToWatch(s: GameState, e: Expedition, d: Destination, group: Record<string, number>, foes: string): boolean {
  if (runtime.quiet || s.autopilot === false || s.gameOver) return false;
  if (s.watching === e.id || e.prompt !== null || !bigFight(e, d, group)) return false;
  const boss = Object.keys(group).some((id) => ENEMIES[id]?.boss);
  const bit = boss ? BOSS : SITE;
  if ((e.watchAsked ?? 0) & bit) return false;
  e.watchAsked = (e.watchAsked ?? 0) | bit | (boss ? SITE : 0);
  const cal = calendar(s.tick);
  const where = the(d.name);
  const title = e.assault ? `The storming of ${d.name.replace(/^Storm /, '')}` : boss ? `A great foe at ${where}` : `A battle at ${where}`;
  const lead = s.people.find((p) => p.id === (e.leader ?? e.members[0]));
  const text = `${lead ? `${lead.name}'s party` : 'The party'} ${e.assault ? 'falls on' : 'has met'} ${foes}${e.assault ? '' : ` at ${where}`}. Watch the fight, or let it play out?`;
  const words = e.assault ? 'war battle siege army' : e.delve || d.type === 'delve' ? 'cave crypt dungeon dark' : 'battle beast wild';
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'watch',
    expedition: e.id,
    title,
    text,
    story: `${text} The fight waits on your word.`,
    picture: eventPicture(`watch:${e.dest}`, words, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: lead?.id,
    options: ['Watch the fight', 'Let it play out'],
    defaultOption: 1,
    expiresTick: s.tick + WATCH_ASK_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  e.prompt = prompt.id;
  notify(s, `${title}: the fight waits for you.`, true);
  return true;
}

/** The answer: watch (the fight screen, `s.watching`) or not; either way the fight goes on. */
export function answerWatch(s: GameState, prompt: Prompt, option: number): void {
  const e = s.expeditions.find((q) => q.id === prompt.expedition);
  if (!e) return;
  if (e.prompt === prompt.id) e.prompt = null;
  if (option === 0) s.watching = e.id;
}
