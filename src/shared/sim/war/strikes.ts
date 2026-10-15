// The wars between the powers, struck by the season (the feuds are sim/worldLife.ts's: two powers fallen out). In the
// marching seasons a war's host marches on a province of its foe (the War tab's map; on the world map it goes from
// stronghold to stronghold) at most every `STRIKE_GAP_DAYS`, and may call the town to march with it
// (sim/war/campaigns.ts); won, the province is the attacker's, and a power whose last province falls is no more. In
// autumn the hosts ride out to burn each other's harvests instead (no province changes hands); in winter they hold.
// The loser's deserters may come for the town. The rolls are the war's own (sim/war/state.ts `warRng`).

import { FACTION_BY_ID } from '../../data/factions';
import { RAID_KIND_BY_ID } from '../../data/raids';
import { DESERT_AGAINST_TOWN, DESERT_CHANCE, DESERT_GAP_HOURS, DESERT_HOURS, DESERT_MOST, DESERT_SHARE, DESERT_TOWN_LEAST, HARVEST_LOSS, STRIKE_GAP_DAYS } from '../../data/war';
import { raidOf, realm } from '../factions';
import { startRaid } from '../raids';
import { isChild } from '../social';
import type { Faction, GameState } from '../state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import type { March } from '../worldLife';
import { callTown, campaignOf, partyStillOut } from './campaigns';
import { strikeTarget, takeProvince } from './map';
import { pairOf, warNews, warOf, warRng, warSeason, type Campaign } from './state';

const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;
const grownUps = (s: GameState) => s.people.filter((p) => !isChild(p)).length;

/** At the realm's hour (sim/worldLife.ts): each war between powers may strike, by the season. A strike is a march on
 *  the world map (returned for worldLife to keep) and a campaign (`s.war.campaigns`). */
export function planStrikes(s: GameState, fs: Faction[], marchHours: number): March[] {
  const season = warSeason(s);
  if (season === 'hold') return [];
  const w = warOf(s);
  const struck = (w.struck ??= {});
  const out: March[] = [];
  for (const feud of s.feuds ?? []) {
    const pair = pairOf(feud.a, feud.b);
    if (struck[pair] !== undefined && s.tick - struck[pair] < STRIKE_GAP_DAYS * TICKS_PER_DAY) continue;
    const rng = warRng(s, `strike:${pair}`);
    const [from, to] = rng.chance(0.5) ? [feud.a, feud.b] : [feud.b, feud.a];
    const host = fs.find((x) => x.id === from);
    const foe = fs.find((x) => x.id === to);
    if (!host || !foe || host.troops < 4) continue;
    struck[pair] = s.tick;
    const harvest = season === 'harvest';
    const camp: Campaign = { id: w.nextId++, by: from, against: to, harvest, province: harvest ? null : strikeTarget(s, from, to), troops: Math.round(host.troops * 0.4), start: s.tick };
    w.campaigns.push(camp);
    out.push({ kind: 'feud', from, to, start: s.tick, end: s.tick + marchHours * TICKS_PER_HOUR, size: camp.troops, camp: camp.id });
    // (a friend of the town's may call it to march too)
    if (!harvest) callTown(s, camp);
  }
  return out;
}

/** A strike's march has arrived (sim/worldLife.ts): whether it waits on the town (its answer, or its party still on
 *  the way or fighting), or how the town's own fight settled it; null to roll as ever. */
export function strikeWaits(s: GameState, m: March): 'wait' | boolean | null {
  const camp = m.camp !== undefined ? campaignOf(s, m.camp) : undefined;
  if (!camp?.call) return null;
  if (camp.done) return camp.done === 'won';
  if (camp.call.answer === null && s.tick < camp.call.until) return 'wait';
  // (marching, the town's party may not have set out yet: a raid at home, the hurt still mending)
  if (camp.call.answer === 'march' && camp.call.party === undefined && s.tick < camp.call.until) return 'wait';
  if (partyStillOut(s, camp)) return 'wait';
  return null;
}

/** A strike settled: the province changes hands (a harvest raid takes none), the campaign is done, and the loser's
 *  deserters may make for the town. */
export function strikeOver(s: GameState, m: March, won: boolean): void {
  const camp = m.camp !== undefined ? campaignOf(s, m.camp) : undefined;
  if (camp) {
    camp.done ??= won ? 'won' : 'lost';
    if (won && camp.province !== null && !camp.harvest) takeProvince(s, camp.by, camp.province);
  }
  const fs = realm(s);
  const loser = fs.find((f) => f.id === (won ? m.to : m.from));
  if (!loser || loser.stance === 'destroyed') return;
  // (the town marched against the loser: more of them blame it)
  const against = !!camp?.call && camp.call.answer === 'march' && loser.id === camp.against;
  desert(s, loser, against);
}

/** A harvest raid's cost to the loser: its folk and a little of its troops. */
export function harvestLoss(f: Faction): void {
  f.troops = Math.max(0, Math.round(f.troops * (1 - HARVEST_LOSS / 2)));
  if (f.folk) f.folk = Math.max(1, Math.round(f.folk * (1 - HARVEST_LOSS)));
}

/** The loser's deserters: a band may make for the town (arriving `DESERT_HOURS` later), a share of its troops. */
function desert(s: GameState, f: Faction, against: boolean): void {
  if (!f.known || f.stance === 'alliance' || f.stance === 'vassal' || f.troops < 6 || grownUps(s) < DESERT_TOWN_LEAST) return;
  const w = warOf(s);
  const rng = warRng(s, `desert:${f.id}`);
  if (!rng.chance(DESERT_CHANCE * (against ? DESERT_AGAINST_TOWN : 1))) return;
  if ((w.deserters ?? []).length) return;
  const n = Math.max(2, Math.min(DESERT_MOST, Math.floor(grownUps(s) / 2), Math.round(f.troops * DESERT_SHARE)));
  (w.deserters ??= []).push({ from: f.id, at: s.tick + DESERT_HOURS * TICKS_PER_HOUR, n });
}

/** Hourly: deserters that are due come to the gate (a small raid of their power's people, no lord, no engines). */
export function desertersHourly(s: GameState): void {
  const w = s.war;
  if (!w?.deserters?.length || s.raid) return;
  const d = w.deserters[0];
  if (s.tick < d.at) return;
  w.deserters.shift();
  if (w.lastDeserters !== undefined && s.tick - w.lastDeserters < DESERT_GAP_HOURS * TICKS_PER_HOUR) return;
  const f = realm(s).find((x) => x.id === d.from);
  const kind = f && RAID_KIND_BY_ID[raidOf(s, f)];
  if (!f || !kind) return;
  w.lastDeserters = s.tick;
  startRaid(s, kind, d.n * 40, warRng(s, 'deserters'), undefined, { most: d.n, siege: 0, leader: '', host: '' });
  warNews(s, `Deserters from the beaten host of ${nameOf(f.id)} have turned to banditry: ${d.n} of them are coming for the town!`);
}
