// Campaigns: the town drawn into the realm's wars. A friend of the town's whose host marches on a foe in the marching
// seasons may send its envoy to call the town to arms (`callTown`: a share of the spoils for a levy of its fighters,
// or coin in their place); the council's answer is the recommended one (sim/war/council.ts). Marching, the campaign
// is a destination on the Expedition Board (`assault:campaign:<id>`, fought as an assault is: the foe's troops in
// waves, its captain last, with the ally's own host beside the town's party), and the council raises the party
// itself unless the player sends one first. The town's own war parties (the wicked and the warband taking the war to
// a weaker foe, the nomads' autumn raids) are campaigns too. The town's fight decides the ally's strike; won, the
// spoils come home, the survivors are veterans (a deed: data/deeds.ts `campaigns`), and the province is the ally's
// (or the town's, for its own campaign); lost, the town grieves its dead.

import { FACTION_BY_ID } from '../../data/factions';
import { ENEMIES } from '../../data/enemies';
import { RAID_KIND_BY_ID } from '../../data/raids';
import type { Destination } from '../../data/expeditions';
import type { Material } from '../../data/materials';
import {
  ALLY_HOST, FIGHTERS_LEAST, CALL_GAP_DAYS, CALL_RETRY_HOURS, CALL_COLDEST, CALL_PREFER, CALL_WARMTH, COMMON_FOE_WARMTH, CAMPAIGN_COIN, CAMPAIGN_KEEP_HOME, CAMPAIGN_OPEN_HOURS, CAMPAIGN_WAVE_TROOPS, CAMPAIGN_WAVES_MOST, COIN_WARMTH, GRIEF_MORALE,
  LEVY_LEAST, LEVY_MOST, LEVY_PER, MARCHED_AGAINST, MARCHED_WARMTH, MORALE_HOURS, REFUSED_ALLY_COLD, REFUSED_COLD, SPOILS_FOOD, SPOILS_GOODS, SPOILS_LEAST, SPOILS_PER_TROOP, VICTORY_MORALE,
} from '../../data/war';
import { WAR_AT, ENVOY_HOURS } from '../../data/factions';
import { levelOf } from '../../data/levels';
import { addDeed } from '../deeds';
import { declareWar, envoy, raidOf, realm } from '../factions';
import { destinationOf, rolesFor, sendExpedition } from '../expeditions';
import { mayGo, roomAway } from '../parties';
import { isChild } from '../social';
import { addStock, earn, notify, setOutcome, type Faction, type GameState, type Prompt } from '../state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from '../time';
import { warMap } from './map';
import { warNews, warOf, warSeason, type Campaign } from './state';
import { adviseCall, fighters, waysOf } from './council';

const nameOf = (id: string) => (id === 'town' ? 'the town' : FACTION_BY_ID[id]?.name ?? id);
const factionOf = (s: GameState, id: string) => realm(s).find((f) => f.id === id);

export const CAMPAIGN_TARGET = 'campaign:';
export const campaignDest = (id: number) => `assault:${CAMPAIGN_TARGET}${id}`;
export const isCampaignTarget = (target: string) => target.startsWith(CAMPAIGN_TARGET);
export const campaignOf = (s: GameState, id: number): Campaign | undefined => s.war?.campaigns.find((c) => c.id === id);
export const campaignOfTarget = (s: GameState, target: string) => (isCampaignTarget(target) ? campaignOf(s, Number(target.slice(CAMPAIGN_TARGET.length))) : undefined);
const provinceName = (s: GameState, c: Campaign) => (c.province !== null ? warMap(s)?.w.provinces[c.province]?.name : undefined) ?? FACTION_BY_ID[c.against]?.stronghold ?? 'their land';

/** How many the town is asked to send: one grown-up in `LEVY_PER`, from `LEVY_LEAST` to `LEVY_MOST`. */
export function levyFor(s: GameState): number {
  const grown = s.people.filter((p) => !isChild(p)).length;
  return Math.max(LEVY_LEAST, Math.min(LEVY_MOST, Math.round(grown / LEVY_PER)));
}

/** A friend's host marching on a foe may call the town to arms (one call every `CALL_GAP_DAYS` at most). */
export function callTown(s: GameState, camp: Campaign): boolean {
  const w = warOf(s);
  const ally = factionOf(s, camp.by);
  const foe = factionOf(s, camp.against);
  if (!ally || !foe || !ally.known || !foe.known || s.gameOver || w.occupation || w.siege) return false;
  // (a sworn ally, a warm friend, or a power that shares a foe with the town: the enemy of its enemy)
  const common = foe.stance === 'war' && ally.stance !== 'war' && ally.attitude >= COMMON_FOE_WARMTH;
  // (or any power not at war with the town that it thinks better of than the one it marches on: worth the asking)
  const better = ally.stance !== 'war' && ally.attitude >= CALL_COLDEST && foe.attitude <= ally.attitude - CALL_PREFER;
  if (!(ally.stance === 'alliance' || (['peace', 'trade'].includes(ally.stance) && ally.attitude >= CALL_WARMTH) || common || better)) return false;
  if (foe.stance === 'alliance' || foe.stance === 'vassal') return false;
  if (s.tick - (w.lastCall ?? -1e12) < CALL_GAP_DAYS * TICKS_PER_DAY) return false;
  if (fighters(s) < FIGHTERS_LEAST || s.prompts.some((p) => p.kind === 'envoy')) return false;
  camp.call = { asked: s.tick, answer: null, until: s.tick + (ENVOY_HOURS + CAMPAIGN_OPEN_HOURS) * TICKS_PER_HOUR, levy: levyFor(s) };
  const p = envoy(s, ally, 'campaign');
  if (!p) {
    camp.call = undefined;
    return false;
  }
  p.envoy!.camp = camp.id;
  w.lastCall = s.tick;
  return true;
}

/** The town's own war party on a power (the wicked and the warband in the marching seasons, the nomads' harvest raids):
 *  opened at once, and the council raises the party. */
export function townCampaign(s: GameState, foe: Faction, harvest: boolean): Campaign | null {
  const w = warOf(s);
  if (w.occupation || s.gameOver) return null;
  const province = harvest ? null : townTarget(s, foe.id);
  const camp: Campaign = { id: w.nextId++, by: 'town', against: foe.id, harvest, province, troops: 0, start: s.tick, call: { asked: s.tick, answer: 'march', until: s.tick + CAMPAIGN_OPEN_HOURS * TICKS_PER_HOUR, levy: levyFor(s) } };
  w.campaigns.push(camp);
  w.lastCall = s.tick;
  w.joined = (w.joined ?? 0) + 1;
  warNews(s, harvest ? `The town rides out to raid the harvest of ${nameOf(foe.id)}.` : `The town takes the war to ${nameOf(foe.id)}: its war party marches on ${provinceName(s, camp)}.`);
  sendParty(s, camp);
  return camp;
}

/** The province of a foe's the town's own war party marches on: one beside the town's land, else its nearest. */
function townTarget(s: GameState, foe: string): number | null {
  const m = warMap(s);
  if (!m) return null;
  const theirs = m.c.holder.map((h, i) => (h === foe ? i : -1)).filter((i) => i >= 0);
  if (!theirs.length) return null;
  const others = theirs.filter((i) => m.w.provinces[i].capitalOf === null);
  const pool = others.length ? others : theirs;
  const home = m.w.realms[0]?.capital ?? 0;
  const d = (i: number) => Math.hypot(m.w.provinces[i].x - m.w.provinces[home].x, m.w.provinces[i].y - m.w.provinces[home].y);
  return pool.sort((a, b) => d(a) - d(b) || a - b)[0];
}

/** The campaigns a party may set out on now: called (and not answered with coin) or the town's own, open, not yet
 *  fought, with no party out. */
export function openCampaigns(s: GameState): string[] {
  return (s.war?.campaigns ?? []).filter((c) => c.call && !c.done && c.call.answer !== 'coin' && s.tick < c.call.until && c.call.party === undefined && factionOf(s, c.against)?.stance !== 'destroyed').map((c) => campaignDest(c.id));
}

/** Whether the town's party for a campaign is still out and its fight not yet settled. */
export function partyStillOut(s: GameState, camp: Campaign): boolean {
  if (camp.done || camp.call?.party === undefined) return false;
  return s.expeditions.some((e) => e.id === camp.call!.party);
}

/* ------------------------------------------------------------ the envoy */

/** The call to arms, as an envoy says it. */
export function campaignEnvoyText(s: GameState, f: Faction, camp: Campaign | undefined): { title: string; text: string; options: string[]; def: number } {
  const levy = camp?.call?.levy ?? levyFor(s);
  const where = camp ? provinceName(s, camp) : 'their foes';
  const foe = camp ? nameOf(camp.against) : 'their foes';
  return {
    title: `${f.stance === 'alliance' ? 'Our allies' : nameOf(f.id)} call the town to arms`,
    text: `${nameOf(f.id).replace(/^The /, 'The ')}'s host marches on ${where}, held by ${foe}, and their envoy asks the town to send ${levy} fighters to march beside it, for a share of the spoils. Their lord will remember who came.`,
    options: [`March with them (${levy} fighters)`, `Send ${CAMPAIGN_COIN} coins instead`, 'Stay out of it'],
    def: 2,
  };
}

/** The town's answer to a call to arms. */
export function answerCampaign(s: GameState, prompt: Prompt, option: number): void {
  const f = prompt.envoy && factionOf(s, prompt.envoy.faction);
  const camp = prompt.envoy?.camp !== undefined ? campaignOf(s, prompt.envoy.camp) : undefined;
  if (!f || !camp?.call) return;
  const foe = factionOf(s, camp.against);
  let said: string;
  if (option === 0) {
    camp.call.answer = 'march';
    said = marchedWith(s, camp, f, foe);
    sendParty(s, camp);
  } else if (option === 1 && (s.coins ?? 0) >= CAMPAIGN_COIN) {
    camp.call.answer = 'coin';
    s.coins = (s.coins ?? 0) - CAMPAIGN_COIN;
    earn(s, 'realm', -CAMPAIGN_COIN);
    f.attitude = Math.min(100, f.attitude + COIN_WARMTH);
    said = `The town sent ${CAMPAIGN_COIN} coins to ${nameOf(f.id)}'s war chest, and none of its own.`;
  } else {
    camp.call.answer = 'refuse';
    f.attitude = Math.max(-100, f.attitude - REFUSED_COLD - (f.stance === 'alliance' ? REFUSED_ALLY_COLD : 0));
    said = `The town stays out of ${nameOf(f.id)}'s war.${f.stance === 'alliance' ? ' They called on an oath, and remember it was not kept.' : ''}`;
  }
  notify(s, said, true);
  setOutcome(s, prompt.title, prompt.options[option] ?? null, said);
}

/** The town has chosen to march (by the envoy, or by a party sent): the ally warms, the foe hates it. */
function marchedWith(s: GameState, camp: Campaign, f: Faction, foe: Faction | undefined): string {
  const w = warOf(s);
  w.joined = (w.joined ?? 0) + 1;
  f.attitude = Math.min(100, f.attitude + MARCHED_WARMTH);
  if (foe && foe.stance !== 'war') {
    foe.attitude = Math.max(-100, foe.attitude - MARCHED_AGAINST);
    if (foe.attitude <= WAR_AT || foe.temper === 'warlike') declareWar(s, foe, false);
  }
  // (the warband's fury is spent on it; the Order's honour rises in a just cause)
  if (s.horde) s.horde.fury = Math.max(0, s.horde.fury - 15);
  if (s.order && foe && (foe.stance === 'war' || foe.temper !== 'honourable')) s.order.honour = Math.min(100, s.order.honour + 3);
  return `The town will march with ${nameOf(f.id)} on ${provinceName(s, camp)}.`;
}

/** The council raises the party: the fittest fighters, never the founder, half the grown-ups kept home. */
export function sendParty(s: GameState, camp: Campaign): boolean {
  if (!camp.call || camp.call.party !== undefined || camp.done || s.raid || s.gameOver) return false;
  const dest = campaignDest(camp.id);
  const d = destinationOf(s, dest);
  if (!d) return false;
  const grown = s.people.filter((p) => !isChild(p)).length;
  const room = Math.min(roomAway(s), Math.floor(grown * (1 - CAMPAIGN_KEEP_HOME)));
  const pool = s.people.filter((p) => mayGo(s, p)).sort((a, b) => levelOf(b) - levelOf(a) || a.id - b.id);
  const party = pool.slice(0, Math.max(0, Math.min(room, camp.call.levy)));
  if (!party.length) return false;
  const r = sendExpedition(s, dest, party.map((p) => p.id), rolesFor(party, d), 'bold');
  if (!r.ok) return false;
  noteParty(camp, s.expeditions[s.expeditions.length - 1].id, party.map((p) => p.id));
  notify(s, `${party.map((p) => p.name).join(', ')} march${party.length === 1 ? 'es' : ''} to war: ${d.name}.`, true);
  return true;
}

function noteParty(camp: Campaign, expedition: number, members: number[]): void {
  camp.call!.party = expedition;
  camp.call!.members = members;
}

/** Hourly: the council sends a party it owes (if it couldn't at once), a party the player sent is noted, and calls
 *  left unanswered by the deadline lapse. */
export function campaignsHourly(s: GameState): void {
  const w = s.war;
  if (!w?.campaigns.length) return;
  for (const camp of w.campaigns) {
    // (a strike whose call couldn't be made, another envoy at the gate, tries again while its host is on the road)
    if (!camp.call && !camp.done && !camp.harvest && camp.by !== 'town' && s.tick - camp.start < CALL_RETRY_HOURS * TICKS_PER_HOUR && warSeason(s) === 'march') callTown(s, camp);
    if (!camp.call || camp.done || camp.call.party !== undefined) continue;
    // (a party the player sent from the Board or the muster)
    const e = s.expeditions.find((x) => x.dest === campaignDest(camp.id));
    if (e) {
      if (camp.call.answer !== 'march' && camp.by !== 'town') {
        const f = factionOf(s, camp.by);
        camp.call.answer = 'march';
        if (f) marchedWith(s, camp, f, factionOf(s, camp.against));
      }
      noteParty(camp, e.id, [...e.members]);
      continue;
    }
    if (s.tick >= camp.call.until) {
      // (the town's own war party that never set out is called off; an ally's host marches alone)
      if (camp.by === 'town') camp.done = 'lost';
      continue;
    }
    if (camp.call.answer === 'march' && warSeason(s) !== 'hold') sendParty(s, camp);
  }
  // (settled campaigns are kept a while for the War tab, then dropped)
  // (and one whose march never came to anything, its target gone, after a while)
  w.campaigns = w.campaigns.filter((c) => s.tick - c.start < (c.done ? 4 : 8) * TICKS_PER_DAY || (!c.done && partyStillOut(s, c)));
}

/* ------------------------------------------------------------ the fight (sim/factions.ts's assault, for a campaign) */

/** A campaign as a place on the Board. */
export function campaignDestination(s: GameState, target: string): Destination | undefined {
  const camp = campaignOfTarget(s, target);
  const foe = camp && factionOf(s, camp.against);
  if (!camp || !foe) return undefined;
  const d = FACTION_BY_ID[foe.id];
  const where = provinceName(s, camp);
  const allied = camp.by !== 'town';
  return {
    id: `assault:${target}`,
    name: camp.harvest ? `Raid the fields of ${where}` : allied ? `March with ${nameOf(camp.by).replace(/^The /, 'the ')} on ${where}` : `Take ${where}`,
    type: 'clear',
    outSeconds: 240,
    workSeconds: 20,
    secondsPerUnit: 8,
    loot: (camp.harvest ? { grain: 3, meat: 2 } : { iron: 2, [d?.goods ?? 'cloth']: 3 }) as Destination['loot'],
    threats: `${nameOf(foe.id)}'s troops in ${where}, wave after wave, and their captain at the last`,
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { [captainOf(s, foe)]: 1 }, weight: 1 }] },
    recommendedParty: camp.call?.levy ?? levyFor(s),
    scenery: 'woods',
    description: allied ? `${nameOf(camp.by)} march on ${where}, and the town marches beside them: one long fight in the field, ${nameOf(camp.by)}'s own troops beside the town's.` : `The town's own war party on ${nameOf(foe.id)}'s land: one long fight, and ${camp.harvest ? 'whatever the fields hold' : `${where} for the town`} if it is won.`,
  };
}

/** A power's captain in the field: its toughest troop (by what each costs a raid). */
function captainOf(s: GameState, f: Faction): string {
  const kind = RAID_KIND_BY_ID[raidOf(s, f)];
  const ids = Object.entries(kind?.enemies ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return ids[0]?.[0] ?? FACTION_BY_ID[f.id]?.lord ?? 'bandit_chief';
}

/** The waves a campaign's party meets: the foe's troops in the field, its captain and guard last. */
export function campaignWaves(s: GameState, target: string, rng: { int(a: number, b: number): number }): Record<string, number>[] {
  const camp = campaignOfTarget(s, target);
  const foe = camp && factionOf(s, camp.against);
  if (!camp || !foe) return [];
  const kind = RAID_KIND_BY_ID[raidOf(s, foe)];
  const ids = Object.keys(kind?.enemies ?? {}).filter((id) => ENEMIES[id] && !ENEMIES[id].boss);
  if (!ids.length) return [{ [captainOf(s, foe)]: 1 }];
  const troops = Math.max(4, Math.round(foe.troops * (camp.harvest ? 0.15 : 0.3)));
  const n = Math.min(CAMPAIGN_WAVES_MOST, Math.max(camp.harvest ? 1 : 2, Math.ceil(troops / CAMPAIGN_WAVE_TROOPS)));
  const each = Math.max(3, Math.min(8, Math.round(troops / n / (camp.harvest ? 1.5 : 1.2))));
  const waves: Record<string, number>[] = [];
  for (let i = 0; i < n; i++) {
    const g: Record<string, number> = {};
    for (let k = 0; k < each; k++) {
      const id = ids[rng.int(0, ids.length - 1)];
      g[id] = (g[id] ?? 0) + 1;
    }
    waves.push(g);
  }
  const cap = captainOf(s, foe);
  const guard: Record<string, number> = { [cap]: (camp.harvest ? 1 : 2) };
  for (let k = 0; k < 2; k++) guard[ids[k % ids.length]] = (guard[ids[k % ids.length]] ?? 0) + 1;
  waves.push(guard);
  return waves;
}

/** The ally's own host, fighting beside the town's party (for the town's own campaign: none). */
export function campaignLevies(s: GameState, target: string, rng: { int(a: number, b: number): number }): { kind: string; from: string }[] {
  const camp = campaignOfTarget(s, target);
  const ally = camp && camp.by !== 'town' ? factionOf(s, camp.by) : undefined;
  if (!camp || !ally) return [];
  const kind = RAID_KIND_BY_ID[raidOf(s, ally)];
  const ids = Object.keys(kind?.enemies ?? {}).filter((id) => ENEMIES[id] && !ENEMIES[id].boss);
  if (!ids.length) return [];
  const n = rng.int(ALLY_HOST[0], ALLY_HOST[1]) + Math.floor(ally.troops / 40);
  const out: { kind: string; from: string }[] = [];
  for (let i = 0; i < n; i++) out.push({ kind: ids[rng.int(0, ids.length - 1)], from: ally.id });
  return out;
}

/** The campaign's fight is over (sim/factions.ts `assaultOver`): the strike settled, the spoils, the veterans, the
 *  recap; won by the town's own war party, the province is the town's. */
export function campaignOver(s: GameState, target: string, won: boolean, loot: Record<string, number>): string {
  const camp = campaignOfTarget(s, target);
  if (!camp) return '';
  const w = warOf(s);
  camp.done = won ? 'won' : 'lost';
  const foe = factionOf(s, camp.against);
  const ally = camp.by !== 'town' ? factionOf(s, camp.by) : undefined;
  const where = provinceName(s, camp);
  const members = (camp.call?.members ?? []).map((id) => s.people.find((p) => p.id === id));
  const living = members.filter((p): p is NonNullable<typeof p> => !!p);
  const dead = (camp.call?.members ?? []).length - living.length;
  const lines: string[] = [];
  lines.push(`${living.length + dead} of the town marched${ally ? ` with ${nameOf(ally.id)}` : ''} on ${where}${foe ? `, held by ${nameOf(foe.id)}` : ''}.`);
  if (won) {
    w.won = (w.won ?? 0) + 1;
    const ways = waysOf(s);
    const base = Math.max(SPOILS_LEAST, Math.round((foe?.troops ?? 20) * SPOILS_PER_TROOP));
    const coins = Math.round(base * ways.spoils * (camp.harvest ? 0.5 : ally ? 0.6 : 1));
    s.coins = (s.coins ?? 0) + coins;
    earn(s, 'realm', coins);
    w.spoils = (w.spoils ?? 0) + coins;
    if (camp.harvest) addStock(loot as never, 'grain' as Material, SPOILS_FOOD);
    else addStock(loot as never, (FACTION_BY_ID[camp.against]?.goods ?? 'iron') as Material, SPOILS_GOODS);
    if (foe) foe.troops = Math.max(0, Math.round(foe.troops * (camp.harvest ? 0.92 : 0.8)));
    if (ally) ally.attitude = Math.min(100, ally.attitude + 8);
    // the town's own war party takes the province
    if (!ally && camp.province !== null && !camp.harvest) {
      const m = warMap(s);
      if (m && m.c.holder[camp.province] === camp.against) {
        m.c.holder[camp.province] = 'town';
        lines.push(`${where} is the town's now.`);
      }
    }
    for (const p of living) addDeed(p, 'campaigns');
    lines.push(`They carried the day: ${coins} coins of the spoils for the treasury${camp.harvest ? ', and the carts full of grain' : ''}.`);
    morale(s, VICTORY_MORALE, `The war party came home victorious from ${where}`);
    if (!s.feastDue) s.feastDue = { kind: 'feast', text: `the feast for the victory at ${where}` };
  } else {
    w.lost = (w.lost ?? 0) + 1;
    if (ally) ally.attitude = Math.max(-100, ally.attitude - 2);
    lines.push(`They were beaten in the field${ally ? `, and ${nameOf(ally.id)}'s host with them` : ''}.`);
    if (dead || living.some((p) => p.downed)) morale(s, GRIEF_MORALE, `The war party was beaten at ${where}`);
  }
  if (dead) lines.push(`${dead === 1 ? 'One did not come back' : `${dead} did not come back`}.`);
  w.recap = { tick: s.tick, title: won ? `Victory at ${where}` : `Defeat at ${where}`, lines, won };
  warNews(s, `${w.recap.title}: ${lines.slice(1).join(' ')}`);
  return '';
}

/** The town's spirits, for a while (the choice events' morale marks). */
export function morale(s: GameState, value: number, text: string): void {
  (s.marks ??= []).push({ lever: 'morale', value, until: s.tick + MORALE_HOURS * TICKS_PER_HOUR, text });
}

/** The council's word on a call (for the envoy's recommended answer). */
export function adviseCampaign(s: GameState, f: Faction, campId: number | undefined): { option: number; why: string } | null {
  const camp = campId !== undefined ? campaignOf(s, campId) : undefined;
  const foe = camp && factionOf(s, camp.against);
  return foe ? adviseCall(s, f, foe) : null;
}
