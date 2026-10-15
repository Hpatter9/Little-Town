// The seasons of war with the realm (data/war.ts; the owner's ask, the old conquest reworked for a town that runs
// itself): the hour's and the morning's turn, called from sim.ts (with the autopilot on), and the envoys' questions
// the war adds (a call to arms, a demand to yield) with the council's recommended answer for every envoy. The parts:
// state.ts (`s.war`), map.ts (provinces changing hands, powers falling, rising powers' seats), strikes.ts (the wars
// between the powers, by the season; deserters), campaigns.ts (the town called to arms; its own war parties),
// siege.ts (sieges, the occupation, the resistance, liberation), council.ts (the town's own answers), memory.ts (the
// war dead, widows and orphans, memorials, the chronicle), view.ts (the War tab).

import { FACTION_BY_ID } from '../../data/factions';
import { SEASON_LINE } from '../../data/war';
import { checkConquestWin, rivalsDaily, rivalsTick } from '../conquest/rivals';
import { holdings } from '../conquest/conquest';
import { realm } from '../factions';
import type { Faction, GameState, Prompt } from '../state';
import { calendar, TICKS_PER_HOUR } from '../time';
import { adviseCampaign, answerCampaign, campaignEnvoyText, campaignsHourly } from './campaigns';
import { adviseEnvoy, councilDaily, demandCoins, type Advice } from './council';
import { claimSeat, warMap } from './map';
import { adviseYieldNow, answerYield, occupationDaily, siegeHourly, yieldEnvoyText } from './siege';
import { desertersHourly } from './strikes';
import { warLog, warOf, warSeason } from './state';

/** The hour of the war's morning (after the realm's, sim/factions.ts, and the world's, sim/worldLife.ts). */
export const WAR_HOUR = 11;

/** Every tick (sim.ts, with the conquest's map on: data/conquest.ts `CONQUEST`): armies arriving on the map; each hour
 *  the campaigns, a siege's demand and deserters; each morning the borders, the seats, the occupation and the council. */
export function warHourly(s: GameState): void {
  if (s.autopilot === false || s.gameOver) return;
  const m = warMap(s);
  if (m) rivalsTick(s, m.c);
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  campaignsHourly(s);
  siegeHourly(s);
  desertersHourly(s);
  if (calendar(s.tick).hour !== WAR_HOUR || !m) return;
  const w = warOf(s);
  const season = warSeason(s);
  if (w.season !== season) {
    if (w.season !== undefined && realm(s).some((f) => f.known)) warLog(s, SEASON_LINE[season]);
    w.season = season;
  }
  // powers met that hold no land raise their banners (a rising power, the old house)
  for (const f of realm(s)) if (f.known && f.stance !== 'destroyed' && !holdings(m.c, f.id).length && (FACTION_BY_ID[f.id]?.rising || FACTION_BY_ID[f.id]?.kin)) claimSeat(s, f);
  rivalsDaily(s, m.c, m.w);
  checkConquestWin(s, m.c, m.w);
  occupationDaily(s);
  councilDaily(s);
}

/* ------------------------------------------------------------ the envoys (hooks from sim/factions.ts) */

/** What the war's envoys say (a call to arms, a demand to yield), or null for the realm's own. */
export function warEnvoyText(s: GameState, f: Faction, about: string): { title: string; text: string; options: string[]; def: number } | null {
  if (about === 'campaign') return campaignEnvoyText(s, f, pendingCall(s, f));
  if (about === 'yield') return yieldEnvoyText(s, f);
  return null;
}
/** The campaign a friend's envoy has just come to call the town to. */
const pendingCall = (s: GameState, f: Faction) => s.war?.campaigns.find((c) => c.by === f.id && c.call?.asked === s.tick && c.call.answer === null);

/** The town's answer to a war's envoy: true when it was one. */
export function answerWarEnvoy(s: GameState, prompt: Prompt, option: number): boolean {
  const about = prompt.envoy?.about;
  if (about === 'campaign') answerCampaign(s, prompt, option);
  else if (about === 'yield') answerYield(s, prompt, option);
  else return false;
  return true;
}

/** The council's recommended answer to an envoy (with the autopilot on: the town answers for itself). */
export function warAdvice(s: GameState, f: Faction, about: string, coins: number): Advice | null {
  if (s.autopilot === false) return null;
  if (about === 'campaign') return adviseCampaign(s, f, pendingCall(s, f)?.id);
  if (about === 'yield') return adviseYieldNow(s, f);
  return adviseEnvoy(s, f, about, coins);
}

/** A demand's sum as the town hears it (a town of Knowledge talks it down). */
export const warDemand = (s: GameState, coins: number): number => (s.autopilot === false ? coins : demandCoins(s, coins));
