// War comes home. A power at war with the town that is far the stronger may, in the marching seasons, muster its host
// as a siege (bigger, more engines) and send word ahead: yield, and be spared. Yielded, the town is occupied: a
// garrison in it, a tax on its treasury and stores each day, and a resistance that grows (more under Defence, in a good
// town, in a proud people, among wanderers) until the town rises and throws them out (the garrison fought in the
// streets: a raid begun inside the town) or is crushed, its ringleaders hanged. An ally at war with the occupier may
// free the town; after `OCCUPY_DAYS_MOST` the occupier, paid, marches off. Stood and lost (the host not broken and too
// few of it fallen), the town is sacked and occupied; a second siege lost to the realm's powers is the end of it (the
// Great Enemy's rule: data/greatEnemy.ts). Held, the town feasts.

import { BUILDING_BY_ID } from '../../data/buildings';
import { TREASURY_KEEP } from '../../data/economy';
import { FACTION_BY_ID, HOST_MOST } from '../../data/factions';
import { FOOD_VALUE } from '../../data/people';
import type { Material } from '../../data/materials';
import { RAID_KIND_BY_ID } from '../../data/raids';
import {
  ALLY_FREES, GARRISON_MOST, HARVEST_HOSTS, MARCH_HOSTS, MARCH_RAMP_DAYS, MARCH_RAMP_FROM, GARRISON_SHARE, GOOD_AT, GRIEF_MORALE, OCCUPY_DAYS_MOST, OCCUPY_FOOD, OCCUPY_TAX, RESIST_BASE, RESIST_LEAST, RESIST_PER_GARRISON, RISING_HANGED, SACK_BURN, SACK_SLAIN,
  SIEGE_BIGGER, SIEGE_CHANCE, SIEGE_LOST_FELL, SIEGE_STRONG, SIEGES_TO_FALL, VICTORY_MORALE,
} from '../../data/war';
import { alignScore } from '../alignment';
import { storages } from '../buildings';
import { envoy, raidOf, realm, townMight } from '../factions';
import { setFire } from '../fire';
import { killPerson } from '../health';
import { nomadic } from '../nomads';
import { directionOf } from '../planner';
import { startRaid } from '../raids';
import { isChild } from '../social';
import { addStock, campXY, earn, notify, setOutcome, type Faction, type GameState, type Prompt, type Raid } from '../state';
import { paceDay, TICKS_PER_DAY } from '../time';
import { morale } from './campaigns';
import { inWar } from './memory';
import { adviseYield, waysOf } from './council';
import { warNews, warOf, warRng, warSeason } from './state';

const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;
const factionOf = (s: GameState, id: string) => realm(s).find((f) => f.id === id);

/** How likely a power at war is to muster a host now, by the season (the hosts march in spring and summer, ride out
 *  smaller in autumn, hold in winter), and never while it holds the town. */
export function hostOdds(s: GameState, f: Faction): number {
  if (s.autopilot === false) return 1;
  if (s.war?.occupation?.by === f.id) return 0;
  const season = warSeason(s);
  const ramp = Math.max(0, Math.min(1, (paceDay(s.tick) - MARCH_RAMP_FROM) / MARCH_RAMP_DAYS));
  return season === 'march' ? 1 + (MARCH_HOSTS - 1) * ramp : season === 'harvest' ? HARVEST_HOSTS : 0;
}

/** A host just mustered (sim/factions.ts `musterHost`): an autumn host is a harvest raid (half the size, no engines);
 *  a far stronger power's host in the marching seasons may be a siege (bigger, more engines, and a demand to yield).
 *  Returns what it is. */
export function hostMustered(s: GameState, f: Faction): 'siege' | 'harvest' | null {
  if (s.autopilot === false || !f.host) return null;
  const w = warOf(s);
  const season = warSeason(s);
  if (season === 'harvest') {
    f.host.size = Math.max(6, Math.round(f.host.size * 0.5));
    f.host.harvest = true;
    return 'harvest';
  }
  if (season !== 'march' || w.siege || w.occupation || f.lastHost === undefined) return null;
  if (f.troops < townMight(s) * SIEGE_STRONG || !warRng(s, `siege:${f.id}`).chance(SIEGE_CHANCE)) return null;
  f.host.size = Math.min(Math.round(HOST_MOST * SIEGE_BIGGER), Math.round(f.host.size * SIEGE_BIGGER));
  f.host.siege = true;
  w.siege = { by: f.id };
  return 'siege';
}

/** A host's siege engines: none for a harvest raid, half again for a siege. */
export const hostEngines = (host: Faction['host'], engines: number): number => (host?.harvest ? 0 : host?.siege ? Math.ceil(engines * 1.5) : engines);

/** Hourly: a siege's demand to yield is sent ahead of it (once there is no other envoy at the gate). */
export function siegeHourly(s: GameState): void {
  const w = s.war;
  if (!w?.siege || w.siege.asked) return;
  const f = factionOf(s, w.siege.by);
  if (!f?.host || f.stance !== 'war') {
    w.siege = undefined;
    return;
  }
  if (s.prompts.some((p) => p.kind === 'envoy')) return;
  if (envoy(s, f, 'yield')) w.siege.asked = true;
}

/** The demand to yield, as the envoy says it. */
export function yieldEnvoyText(s: GameState, f: Faction): { title: string; text: string; options: string[]; def: number } {
  const lost = s.war?.sieges?.lost ?? 0;
  return {
    title: `${nameOf(f.id)} have come to besiege the town`,
    text: `${nameOf(f.id)}'s siege host, ${f.host?.size ?? 'many'} strong with engines behind it, is on the road. Their herald offers terms: open the gates, take a garrison and pay what is asked, and nobody need die. Refuse, and they will take the town by force.${lost ? ' The town has lost a siege already: another would be the end of it.' : ''}`,
    options: ['Stand the siege', 'Yield: open the gates'],
    def: 0,
  };
}

/** The town's answer to the demand. */
export function answerYield(s: GameState, prompt: Prompt, option: number): void {
  const w = warOf(s);
  const f = prompt.envoy && factionOf(s, prompt.envoy.faction);
  if (!f) return;
  let said: string;
  if (option === 1 && f.host) {
    const size = f.host.size;
    f.host = undefined;
    f.lastHost = s.tick;
    w.siege = undefined;
    occupy(s, f, Math.min(GARRISON_MOST, Math.max(3, Math.round(size * GARRISON_SHARE))));
    said = `The town opened its gates to ${nameOf(f.id)}. Their garrison marches in.`;
  } else {
    if (w.siege) w.siege.yielded = false;
    said = `The town will stand the siege. Every hand to the walls.`;
  }
  notify(s, said, true);
  setOutcome(s, prompt.title, prompt.options[option] ?? null, said);
}

/** The council's word on the demand. */
export const adviseYieldNow = (s: GameState, f: Faction) => adviseYield(s, f, f.host?.size ?? 0);

/** The town is occupied. */
function occupy(s: GameState, f: Faction, garrison: number): void {
  const w = warOf(s);
  f.stance = 'peace';
  f.since = s.tick;
  f.host = undefined;
  w.occupation = { by: f.id, since: s.tick, garrison, resistance: 0, taxed: 0 };
  warNews(s, `${nameOf(f.id)} hold the town: ${garrison} of their soldiers in its streets, and their tax collectors at the treasury.`);
}

/** A host's raid is over (sim/factions.ts `hostOver`): a siege held or lost, a rising won or crushed. */
export function siegeOver(s: GameState, r: Raid, f: Faction, broken: boolean, fell: number, came: number): void {
  const w = s.war;
  if (!w) return;
  if (w.occupation?.rising && w.occupation.by === f.id) return risingOver(s, r, f, broken);
  if (!w.siege || w.siege.by !== f.id) return;
  w.siege = undefined;
  const sieges = (w.sieges ??= { lost: 0, held: 0 });
  if (broken || r.mercy === 'spared' || r.turned || fell >= came * SIEGE_LOST_FELL) {
    sieges.held++;
    best(s, r, 'the Siege-breaker');
    morale(s, VICTORY_MORALE, `The siege of ${nameOf(f.id)} was held`);
    warNews(s, `The siege is broken! ${nameOf(f.id)}'s host draws off from the walls.`);
    return;
  }
  sieges.lost++;
  sack(s, f);
  if (sieges.lost >= SIEGES_TO_FALL) {
    s.gameOver = { tick: s.tick, text: `${nameOf(f.id)} took the town at its second siege. Its walls are thrown down, its people scattered among the realm's powers. Somewhere a descendant remembers.` };
    warNews(s, s.gameOver.text);
    return;
  }
  const standing = r.raiders.filter((rd) => !rd.ally && !rd.down).length;
  occupy(s, f, Math.min(GARRISON_MOST, Math.max(3, Math.round(standing * GARRISON_SHARE))));
  warNews(s, `The siege is lost. ${nameOf(f.id)} have the town, and one more siege lost will be the end of it.`);
}

/** The sack: buildings fired, some of those in the streets cut down. */
function sack(s: GameState, f: Faction): void {
  const g = warRng(s, 'sack');
  const standing = s.buildings.filter((b) => b.status === 'done' && b.def !== 'campfire' && !b.room && !BUILDING_BY_ID[b.def]?.seat);
  for (let k = 0; k < SACK_BURN && standing.length; k++) setFire(s, standing.splice(g.int(0, standing.length - 1), 1)[0], true);
  const caught = s.people.filter((p) => p.away === null && p.id !== s.mainId && !p.undying && !isChild(p));
  const slain = Math.round(caught.length * SACK_SLAIN);
  for (let k = 0; k < slain && caught.length; k++) inWar(nameOf(f.id), 'the sack of the town', () => killPerson(s, caught.splice(g.int(0, caught.length - 1), 1)[0], `cut down in the sack by ${nameOf(f.id)}`));
  morale(s, GRIEF_MORALE, 'The town was sacked');
}

/** The best fighter of a raid (its tally) takes a title. */
function best(s: GameState, r: Raid, title: string): void {
  const top = r.tally ? Object.entries(r.tally).filter(([id]) => Number(id) >= 0).sort((a, b) => b[1].dealt - a[1].dealt || Number(a[0]) - Number(b[0]))[0] : undefined;
  const p = top && s.people.find((q) => q.id === Number(top[0]));
  if (!p || (p.titles ??= []).includes(title)) return;
  p.titles.push(title);
  notify(s, `${p.name} is now called ${p.name} ${title}.`, true);
}

/* ------------------------------------------------------------ the occupation */

/** Each morning of an occupation: the tax, the resistance, and the end of it (a rising, an ally, or time). */
export function occupationDaily(s: GameState): void {
  const w = s.war;
  const occ = w?.occupation;
  if (!w || !occ) return;
  const f = factionOf(s, occ.by);
  if (!f || f.stance === 'destroyed') return liberate(s, f, 'Their masters are no more, and the garrison has melted away.');
  // the tax: a share of the treasury over its keep, and of the food in store
  const coins = Math.floor(Math.max(0, (s.coins ?? 0) - TREASURY_KEEP) * OCCUPY_TAX);
  if (coins > 0) {
    s.coins = (s.coins ?? 0) - coins;
    earn(s, 'realm', -coins);
    occ.taxed += coins;
  }
  let food = 0;
  for (const st of storages(s))
    for (const m of Object.keys(FOOD_VALUE) as Material[]) {
      const n = Math.floor((st.store[m] ?? 0) * OCCUPY_FOOD);
      if (n > 0) {
        addStock(st.store, m, -n);
        food += n;
      }
    }
  f.troops += 1;
  // the resistance grows
  const ways = waysOf(s);
  const grow = Math.max(RESIST_LEAST, RESIST_BASE + (directionOf(s) === 'defense' ? 3 : 0) + (alignScore(s) >= GOOD_AT ? 2 : 0) + (ways.proud ? 4 : 0) + (nomadic(s) ? 6 : 0) - occ.garrison * RESIST_PER_GARRISON);
  occ.resistance = Math.max(0, occ.resistance + grow);
  if (coins || food) warNews(s, `The garrison of ${nameOf(f.id)} took ${coins ? `${coins} coins` : ''}${coins && food ? ' and ' : ''}${food ? `${food} food` : ''} in tax.${occ.resistance >= 60 ? ' The resistance is close to rising.' : ''}`, false);
  const days = (s.tick - occ.since) / TICKS_PER_DAY;
  // an ally at war with them comes to free the town
  const friend = realm(s).find((x) => x.stance === 'alliance' && (s.feuds ?? []).some((d) => (d.a === x.id && d.b === f.id) || (d.b === x.id && d.a === f.id)));
  if (friend && warSeason(s) === 'march' && warRng(s, 'freed').chance(ALLY_FREES)) {
    f.stance = 'war';
    f.since = s.tick;
    return liberate(s, f, `${nameOf(friend.id)}'s host came over the hill and drove the garrison out.`);
  }
  // the rising
  if (occ.resistance >= 100 && !s.raid) {
    const kind = RAID_KIND_BY_ID[raidOf(s, f)];
    if (kind) {
      occ.rising = true;
      warNews(s, `The town rises against the garrison of ${nameOf(f.id)}! ${occ.garrison} of their soldiers are fighting in the streets.`);
      startRaid(s, kind, occ.garrison * 40, warRng(s, 'rising'), campXY(s), { most: occ.garrison, siege: 0, leader: '', host: f.id });
      return;
    }
  }
  if (days >= OCCUPY_DAYS_MOST) liberate(s, f, `Paid, ${nameOf(f.id)} have marched their garrison home. The town is its own again, at peace with them.`);
}

/** The rising's fight is over: the garrison thrown out (liberation), or the rising crushed. */
function risingOver(s: GameState, r: Raid, f: Faction, broken: boolean): void {
  const occ = s.war!.occupation!;
  occ.rising = false;
  if (broken) {
    f.stance = 'war';
    f.since = s.tick;
    best(s, r, 'the Liberator');
    return liberate(s, f, 'The garrison is thrown out of the town!');
  }
  // crushed: the ringleaders hanged, and it begins again
  const g = warRng(s, 'hanged');
  const pool = s.people.filter((p) => p.away === null && p.id !== s.mainId && !p.undying && !isChild(p));
  const hanged: string[] = [];
  for (let k = 0; k < RISING_HANGED && pool.length; k++) {
    const p = pool.splice(g.int(0, pool.length - 1), 1)[0];
    hanged.push(p.name);
    inWar(nameOf(f.id), 'the gallows in the square', () => killPerson(s, p, `hanged by the garrison of ${nameOf(f.id)} after the rising`));
  }
  occ.resistance = 0;
  occ.garrison = Math.min(GARRISON_MOST, occ.garrison + 2);
  morale(s, GRIEF_MORALE, 'The rising was crushed');
  warNews(s, `The rising is crushed.${hanged.length ? ` ${hanged.join(' and ')} ${hanged.length === 1 ? 'was' : 'were'} hanged in the square.` : ''} The garrison doubles its watch.`);
}

/** The town is free again: the feast of liberation. */
function liberate(s: GameState, f: Faction | undefined, how: string): void {
  const w = warOf(s);
  const occ = w.occupation;
  w.occupation = undefined;
  if (!occ) return;
  morale(s, VICTORY_MORALE, 'The town is free');
  if (!s.feastDue) s.feastDue = { kind: 'feast', text: 'the feast of liberation' };
  warNews(s, `${how} After ${Math.max(1, Math.round((s.tick - occ.since) / TICKS_PER_DAY))} days, the town is free${f ? ` of ${nameOf(f.id)}` : ''}.`);
}
