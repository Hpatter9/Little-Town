// The town's council of war: the town answers the realm for itself (the player sets only its direction). Its answers
// lean on the direction (Defence stands by its friends and holds its walls; Growth and Trade keep out of wars and buy
// peace; Knowledge finds the diplomatic answer), on the town's alignment (the good answer a just call gladly, the
// wicked break their word for gain), on how it stands with each power and how strong it is beside them, and on its
// people's ways (data/war.ts `WAR_WAYS`). Every envoy's question carries the council's pick as its recommended answer
// (taken if nobody answers, as the choice events' are), and in the plotting seasons the council acts: it buys peace,
// seeks treaties, brokers peace between friends, breaks a treaty, or plans the town's own war party.

import { GIFT_COINS, GIFT_WARMTH, TREATY_NEEDS } from '../../data/factions';
import {
  ARMS_COINS, BREAK_RICH_FOLK, BREAK_STRONGER, BROKER_CHANCE, CALL_GAP_DAYS, CAMPAIGN_COIN, EVIL_AT, FIGHTERS_LEAST, GOOD_AT, JOIN_AT, NOMAD_RAID_CHANCE, NOMAD_RAID_WEAKER,
  PEACE_GIFT_EVERY_DAYS, PEACE_TREASURY, PROUD_BOWS, TALKED_DOWN, WAR_WAYS, YIELD_AT, type WarWays,
} from '../../data/war';
import { FACTION_BY_ID } from '../../data/factions';
import { alignPush, alignScore, orderPush } from '../alignment';
import { declareWar, realm, realmCommand, townMight } from '../factions';
import { isChild } from '../social';
import { directionOf } from '../planner';
import { earn, type Faction, type GameState } from '../state';
import { TICKS_PER_DAY } from '../time';
import { townCampaign } from './campaigns';
import { warLog, warNews, warOf, warRng, warSeason } from './state';

const nameOf = (id: string) => FACTION_BY_ID[id]?.name ?? id;
export const waysOf = (s: GameState): WarWays => WAR_WAYS[s.origin ?? 'settlers'] ?? WAR_WAYS.default;
const standing = (f: Faction) => f.stance !== 'destroyed';
const friendly = (f: Faction) => f.stance === 'alliance' || f.stance === 'vassal' || f.stance === 'trade';
/** The grown-ups the town could field (the founder and the guards stay home; who is fit to march is reckoned when
 *  the party sets out, sim/war/campaigns.ts `sendParty`). */
export const fighters = (s: GameState) => s.people.filter((p) => !isChild(p) && p.id !== s.mainId && !p.guard && p.away === null && !p.downed).length;
/** Wicked enough to break its word for gain (the orcs need only be strong). */
const wicked = (s: GameState) => alignScore(s) <= EVIL_AT;

export interface Advice {
  option: number;
  why: string;
}

/** How much the town wants to answer a call to march with `ally` on `foe`, and why (the reasons, best first). */
export function callScore(s: GameState, ally: Faction, foe: Faction): { score: number; why: string[] } {
  const ways = waysOf(s);
  const might = townMight(s);
  const dir = directionOf(s);
  const why: string[] = [];
  let score = ways.join;
  if (ways.join >= 3) why.push('the warband never turns down a fight');
  if (ally.stance === 'alliance') {
    score += 3;
    why.push(`the town is sworn to ${nameOf(ally.id)}`);
  } else if (ally.stance === 'trade') score += 1;
  if (ally.attitude >= 50) score += 1;
  // a just cause: the foe makes war on the town, hates it, or is a warmonger
  let just = 0;
  if (foe.stance === 'war') {
    just += 3;
    why.push(`${nameOf(foe.id)} are at war with the town already`);
  }
  if (foe.attitude <= -30) just += 1;
  if (foe.temper === 'warlike' || foe.temper === 'treacherous') {
    just += 1;
    if (just < 3) why.push(`${nameOf(foe.id)} are ${foe.temper === 'warlike' ? 'warmongers' : 'oathbreakers'}`);
  }
  if (ways.just) {
    if (just >= 3) score += just * 2;
    else {
      score -= 3;
      why.push('the cause is not a just one');
    }
  } else score += just;
  if (alignScore(s) >= GOOD_AT && just >= 3) score += 1;
  // the profit in it
  if (foe.troops < ally.troops) {
    score += 1;
    why.push('the war looks winnable');
  }
  if (wicked(s)) {
    score += 1;
    why.push('there is plunder to be had');
  }
  // the direction
  if (dir === 'defense') {
    score += 1;
    why.push('the town stands by its friends');
  } else if (dir === 'growth') {
    score -= 2;
    why.push('the council would sooner build than bleed');
  } else if (dir === 'trade') {
    score -= dir === 'trade' && foe.troops < ally.troops ? 1 : 2;
    why.push('war is bad for trade');
  } else if (dir === 'knowledge') score -= 1;
  // friends on both sides, and the town's own strength
  if (friendly(foe)) {
    score -= 4;
    why.unshift(`${nameOf(foe.id)} are the town's friends too`);
  } else if (foe.stance === 'peace') score -= 1;
  if (fighters(s) < FIGHTERS_LEAST) {
    score -= 10;
    why.unshift('the town has too few fit to fight');
  } else if (foe.troops * 0.3 > might * 1.2) {
    score -= 2;
    why.push(`${nameOf(foe.id)} are too strong for the town`);
  }
  if (warOf(s).occupation) {
    score -= 10;
    why.unshift('the town is not its own master');
  }
  return { score, why };
}

/** The council's answer to a call to arms: march (0), send coin (1) or stay out (2). */
export function adviseCall(s: GameState, ally: Faction, foe: Faction): Advice {
  const { score, why } = callScore(s, ally, foe);
  if (score >= JOIN_AT) return { option: 0, why: `The council would march: ${why.filter((w) => !/too|not|sooner|bad|friends/.test(w)).slice(0, 2).join(', ') || 'it is a war worth joining'}.` };
  const dir = directionOf(s);
  if ((s.coins ?? 0) >= CAMPAIGN_COIN * 2 && (ally.stance === 'alliance' || dir === 'trade' || dir === 'growth')) return { option: 1, why: `The council would send coin, not blood: ${why[0] ?? 'the town keeps out of wars'}.` };
  return { option: 2, why: `The council would stay out of it: ${why.find((w) => /too|not|sooner|bad|friends/.test(w)) ?? 'it is not the town\'s war'}.` };
}

/** A demand for tribute: pay (0), refuse (1), or refuse and go to war (2). */
export function adviseDemand(s: GameState, f: Faction, coins: number): Advice {
  const ways = waysOf(s);
  const might = Math.max(1, townMight(s));
  const ratio = f.troops / might;
  const dir = directionOf(s);
  const purse = s.coins ?? 0;
  if (ways.proud && ratio < PROUD_BOWS) {
    if (ratio < 1 && ways.oath === 'strong') return { option: 2, why: 'The council would answer with steel: the town pays nobody, least of all the weaker.' };
    return { option: 1, why: 'The council would refuse: the town pays nobody.' };
  }
  if (purse >= coins && (ratio >= 1.4 || ((dir === 'growth' || dir === 'trade') && ratio >= 0.9))) return { option: 0, why: ratio >= 1.4 ? `The council would pay: ${nameOf(f.id)} are much the stronger, and coin is cheaper than lives.` : 'The council would pay: peace is worth more to the town than the coins.' };
  if (ratio < 0.7 && (wicked(s) || ways.oath === 'strong')) return { option: 2, why: `The council would answer with war: ${nameOf(f.id)} are the weaker, and rich.` };
  return { option: 1, why: purse < coins ? 'The council would refuse: the treasury cannot pay.' : 'The council would refuse: the town can stand on its own.' };
}

/** A demand's sum, talked down by a town of Knowledge (its scholars find a precedent for a smaller one). */
export const demandCoins = (s: GameState, coins: number): number => (directionOf(s) === 'knowledge' ? Math.round(coins * TALKED_DOWN) : coins);

/** A siege's demand to yield: stand (0) or open the gates (1). */
export function adviseYield(s: GameState, f: Faction, size: number): Advice {
  const ways = waysOf(s);
  const ratio = size / Math.max(1, townMight(s));
  const dir = directionOf(s);
  const at = YIELD_AT * (dir === 'defense' ? 1.4 : dir === 'growth' || dir === 'trade' ? 0.8 : 1);
  if (ways.proud) return { option: 0, why: 'The council would stand: the town would rather fall than kneel.' };
  if ((warOf(s).sieges?.lost ?? 0) >= 1 && ratio >= at * 0.8) return { option: 1, why: 'The council would yield: one more siege lost and the town is finished.' };
  if (ratio >= at) return { option: 1, why: `The council would yield: ${size} under ${nameOf(f.id)}'s banners against the town's ${Math.round(townMight(s))} is no fight. A garrison can be thrown out later.` };
  return { option: 0, why: 'The council would stand the siege: the walls and the town\'s fighters can hold.' };
}

/** The council's pick for the realm's other envoys (sim/factions.ts `envoy`), or null to leave their own default. */
export function adviseEnvoy(s: GameState, f: Faction, about: string, coins: number): Advice | null {
  const good = alignScore(s);
  const ways = waysOf(s);
  const might = Math.max(1, townMight(s));
  const dir = directionOf(s);
  switch (about) {
    case 'greet':
      if ((dir === 'knowledge' || dir === 'trade') && (s.coins ?? 0) >= GIFT_COINS * 3) return { option: 0, why: 'The council would feast them: friends in the realm are worth the coin.' };
      return { option: 1, why: 'The council would hear them out.' };
    case 'demand':
      return adviseDemand(s, f, coins);
    case 'peace':
      if (f.stance === 'war' && (ways.oath === 'strong' || good <= EVIL_AT) && f.troops < might * 0.6) return { option: 1, why: 'The council would fight on: they are beaten, and the town smells plunder.' };
      return { option: 0, why: 'The council would make peace.' };
    case 'trade':
      return { option: 0, why: 'The council would open the roads: coin both ways.' };
    case 'alliance':
      if ((good >= GOOD_AT || ways.just) && f.temper === 'treacherous') return { option: 1, why: 'The council would decline: they are not to be trusted.' };
      if (dir === 'growth' && f.stance !== 'trade') return { option: 1, why: 'The council would decline: an alliance draws a town into other folk\'s wars.' };
      return { option: 0, why: 'The council would swear the alliance: their troops beside the town\'s.' };
    case 'marriage':
      return { option: 0, why: 'The council would agree: kin are slow to make war on kin.' };
    case 'surrender':
      if (good >= GOOD_AT && !ways.proud) return { option: 1, why: 'The council would make peace: mercy, not chains.' };
      return { option: 0, why: 'The council would take their fealty: tribute every day.' };
    case 'conquered':
      if (good <= EVIL_AT || ways.oath === 'strong') return { option: 1, why: 'The council would raze it: no enemy left to rise again.' };
      return { option: 0, why: 'The council would make them a vassal.' };
    default:
      return null;
  }
}

/* ------------------------------------------------------------ the council's own doings */

/** Each morning of the realm (sim/war/war.ts): by the season, the council acts on its own. */
export function councilDaily(s: GameState): void {
  const w = warOf(s);
  const season = warSeason(s);
  const fs = realm(s).filter((f) => f.known && standing(f));
  const dir = directionOf(s);
  const might = townMight(s);
  const ways = waysOf(s);
  const rng = warRng(s, 'council');
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  if (w.occupation) return; // (the occupier speaks for the town)
  // Growth and Trade buy peace: gifts to whoever is at war with the town, then peace when they'll take it
  if ((dir === 'growth' || dir === 'trade') && !ways.proud) {
    for (const f of fs.filter((x) => x.stance === 'war')) {
      const gifted = (w.gifted ??= {});
      if ((s.coins ?? 0) >= GIFT_COINS * PEACE_TREASURY && day - (gifted[f.id] ?? -99) >= PEACE_GIFT_EVERY_DAYS && !Object.values(gifted).includes(day)) {
        gifted[f.id] = day; // (one gift a day, to one power)
        realmCommand(s, f.id, 'gift', rng);
        warLog(s, `The council sent gifts to ${nameOf(f.id)}, to buy an end to the war.`);
      }
      if (f.attitude >= TREATY_NEEDS.peace - (f.troops < might ? 25 : 0) && realmCommand(s, f.id, 'peace', rng).ok) warLog(s, `The council bought peace with ${nameOf(f.id)}.`);
    }
  }
  // Knowledge (and Defence, for alliances) seeks treaties where the goodwill is there, one a day
  if (dir === 'knowledge' || dir === 'defense') {
    const next = fs.find((f) => (dir === 'knowledge' && (f.stance === 'neutral' || f.stance === 'war') && f.attitude >= TREATY_NEEDS.peace + 5) || (dir === 'knowledge' && f.stance === 'peace' && f.attitude >= TREATY_NEEDS.trade) || (f.stance === 'trade' && f.attitude >= TREATY_NEEDS.alliance && !(f.temper === 'treacherous' && alignScore(s) >= GOOD_AT)));
    if (next) {
      const op = next.stance === 'trade' ? 'alliance' : next.stance === 'peace' ? 'trade' : 'peace';
      if (realmCommand(s, next.id, op, rng).ok) warLog(s, `The council's envoys won ${op === 'alliance' ? 'an alliance' : op === 'trade' ? 'a trade treaty' : 'peace'} with ${nameOf(next.id)}.`);
    }
  }
  // Knowledge brokers peace between two of the town's friends at war with each other (winter)
  if (dir === 'knowledge' && season === 'hold') {
    const feud = (s.feuds ?? []).find((x) => [x.a, x.b].every((id) => fs.some((f) => f.id === id && ['peace', 'trade', 'alliance', 'vassal'].includes(f.stance))));
    if (feud && rng.chance(BROKER_CHANCE)) {
      s.feuds = (s.feuds ?? []).filter((x) => x !== feud);
      for (const f of fs) if (f.id === feud.a || f.id === feud.b) f.attitude = Math.min(100, f.attitude + GIFT_WARMTH / 2);
      warNews(s, `The town's envoys brokered peace between ${nameOf(feud.a)} and ${nameOf(feud.b)}. Both think the better of it.`);
    }
  }
  // the wicked (and the warband) break their word when they are strong and the other is rich (winter's plotting)
  if (season === 'hold' && ways.oath !== 'never' && (ways.oath === 'strong' || wicked(s)) && dir !== 'growth' && dir !== 'trade') {
    const mark = fs.find((f) => ['peace', 'trade', 'neutral'].includes(f.stance) && f.troops * BREAK_STRONGER < might && (f.folk ?? 0) >= BREAK_RICH_FOLK);
    if (mark && rng.chance(0.25)) {
      const treaty = mark.stance !== 'neutral';
      declareWar(s, mark, true);
      if (treaty) {
        alignPush(s, -4, 'A treaty broken for gain');
        orderPush(s, -3, 'A treaty broken for gain');
      }
      warNews(s, `The council has ${treaty ? 'torn up the treaty with' : 'turned on'} ${nameOf(mark.id)}: they are weak and rich, and the town is strong. Come spring, it will take the war to them.`);
    }
  }
  // the marching season: the town takes the war to a weaker power it is at war with (the wicked and the warband)
  if (season === 'march' && (ways.oath === 'strong' || wicked(s)) && fighters(s) >= FIGHTERS_LEAST && s.tick - (w.lastCall ?? -1e12) >= CALL_GAP_DAYS * TICKS_PER_DAY) {
    const foe = fs.find((f) => f.stance === 'war' && f.troops * 0.3 < might);
    if (foe && !w.campaigns.some((c) => c.by === 'town' && !c.done)) townCampaign(s, foe, false);
  }
  // the nomads ride out on harvest raids of their own (autumn)
  if (season === 'harvest' && ways.harvestRaids && fighters(s) >= FIGHTERS_LEAST && !w.campaigns.some((c) => c.by === 'town' && !c.done) && rng.chance(NOMAD_RAID_CHANCE)) {
    const prey = fs.find((f) => (f.stance === 'war' || (f.stance === 'neutral' && f.attitude < 10)) && f.troops * 0.3 < might * NOMAD_RAID_WEAKER);
    if (prey) {
      w.nomadRaid = s.tick;
      townCampaign(s, prey, true);
    }
  }
  // the machines sell arms to both sides of every war they can reach, once a marching season
  if (ways.arms && season === 'march' && w.armsSold !== seasonIndex(s)) {
    const wars = (s.feuds ?? []).filter((x) => fs.some((f) => f.id === x.a) && fs.some((f) => f.id === x.b)).length;
    if (wars) {
      w.armsSold = seasonIndex(s);
      const coins = ARMS_COINS * wars;
      s.coins = (s.coins ?? 0) + coins;
      earn(s, 'realm', coins);
      warNews(s, `The colony sold arms to both sides of ${wars === 1 ? 'the war' : `${wars} wars`} in the realm: ${coins} coins.`, false);
    }
  }
}
const seasonIndex = (s: GameState) => Math.floor(s.tick / (TICKS_PER_DAY * 10));

/** A line for each power the town knows: what the council would do about it, for the War tab. */
export function councilLine(s: GameState, f: Faction): string {
  const dir = directionOf(s);
  const ways = waysOf(s);
  if (f.stance === 'destroyed') return 'Fallen.';
  if (warOf(s).occupation?.by === f.id) return 'Holds the town: the resistance grows.';
  if (f.stance === 'war') {
    if ((dir === 'growth' || dir === 'trade') && !ways.proud) return 'At war: the council sends gifts and seeks peace.';
    if (ways.oath === 'strong' || wicked(s)) return f.troops * 0.3 < townMight(s) ? 'At war: the town will take the war to them.' : 'At war: the town holds its walls.';
    return dir === 'knowledge' ? 'At war: the council\'s envoys look for terms.' : 'At war: the town holds its walls and waits.';
  }
  const foes = (s.feuds ?? []).filter((x) => x.a === f.id || x.b === f.id).map((x) => (x.a === f.id ? x.b : x.a));
  const foe = foes.map((id) => realm(s).find((x) => x.id === id)).find((x): x is Faction => !!x && x.known);
  if (foe && (f.stance === 'alliance' || f.attitude >= 25)) {
    const a = adviseCall(s, f, foe);
    return a.option === 0 ? `Would march with them against ${nameOf(foe.id)}.` : a.option === 1 ? `Would send coin, not fighters, against ${nameOf(foe.id)}.` : `Would keep out of their war with ${nameOf(foe.id)}.`;
  }
  if (f.stance === 'vassal') return 'Our vassal: tribute each day.';
  if (f.troops > townMight(s) * 1.4 && !ways.proud && (dir === 'growth' || dir === 'trade')) return 'Stronger than the town: the council would pay what they ask.';
  if ((ways.oath === 'strong' || wicked(s)) && ['peace', 'trade', 'neutral'].includes(f.stance) && f.troops * BREAK_STRONGER < townMight(s) && (f.folk ?? 0) >= BREAK_RICH_FOLK) return 'Weak and rich: the council eyes their land.';
  return f.stance === 'alliance' ? 'Sworn friends.' : f.stance === 'trade' ? 'Trading partners.' : f.stance === 'peace' ? 'At peace.' : 'No treaty: watched.';
}
