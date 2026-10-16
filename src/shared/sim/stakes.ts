// The stake card (the owner's ask: an expedition is a bet). Before a party the player raises is sent, the card says
// who goes, how the odds stand in words (never numbers), what they seek, what the town risks and how long they'll be
// gone. The odds are worked out, not drawn: the party's strength over the place's danger (sim/parties.ts) gives the
// share of the party expected to come home (`homeShare`), and the words are the bands of that share (`ODDS_WORDS`), so
// a word is only ever said where the share is in its band. Nothing here changes the game: it only reads it.

import type { Destination } from '../data/expeditions';
import { ITEM_BY_ID } from '../data/items';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { RATIONS } from '../data/muster';
import { levelOf } from '../data/levels';
import { foodNeeded } from './expeditions';
import { bountyOn, dangerOf, strengthOf } from './parties';
import { ERA_MULTIPLIER, type GameState, type Muster, type Person } from './state';

/** How much more dangerous a bold trip counts (it goes looking for the fights). */
export const BOLD_DANGER = 1.25;
/** The ratio of strength to danger at which half the party is expected home, and how steeply the share climbs. */
export const HALF_AT = 0.7;
export const STEEPNESS = 3.2;

/** The share of the party expected to come home, from the ratio of its strength to the danger it faces (0..1). */
export function homeShare(ratio: number): number {
  return 1 / (1 + Math.exp(-STEEPNESS * (ratio - HALF_AT)));
}

export type OddsTone = 'safe' | 'fair' | 'grim';
/** The odds in words, by the share expected home: at or above each. */
export const ODDS_WORDS: readonly { at: number; word: string; tone: OddsTone }[] = [
  { at: 0.92, word: 'Sure to come home', tone: 'safe' },
  { at: 0.78, word: 'Likely to return', tone: 'safe' },
  { at: 0.6, word: 'A hard road: some may fall', tone: 'fair' },
  { at: 0.4, word: 'Half may not come home', tone: 'fair' },
  { at: 0.2, word: 'Most may not come home', tone: 'grim' },
  { at: 0, word: 'They go to their deaths', tone: 'grim' },
];

/** The words for a share expected home. */
export const oddsWordFor = (share: number) => ODDS_WORDS.find((w) => share >= w.at)!;

export interface StakeCard {
  /** The odds in words, and how grave they are (for the colour). */
  word: string;
  tone: OddsTone;
  /** What they seek, in plain lines. */
  seeks: string[];
  /** What the town risks: the people and what they carry. */
  risks: string[];
  /** About how long they'll be gone, in game seconds. */
  seconds: number;
  /** The one warning, if there is one: the founder, a favourite or the leader goes. */
  warning: string | null;
}

/** Who the player has pinned as favourites (claude/favourites: `s.favourites`), if the town keeps any. */
export const favouritesOf = (s: GameState): number[] => s.favourites ?? [];

const list = (xs: string[]) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

/** The warning for who goes: the founder, then a favourite, then the leader (always someone leads). */
export function warningFor(s: GameState, party: Person[], leader: Person | undefined): string | null {
  const founder = party.find((p) => p.id === s.mainId);
  if (founder) return `${founder.name} founded the town and goes with them: if they fall, an heir takes the town.`;
  const favs = favouritesOf(s);
  const dear = party.filter((p) => favs.includes(p.id));
  if (dear.length) return `${list(dear.map((p) => p.name))} ${dear.length > 1 ? 'are favourites' : 'is a favourite'} of yours${dear.some((p) => p === leader) ? ', and leads them' : ''}. The road does not know that.`;
  return leader ? `${leader.name} leads them, and the road asks most of a leader.` : null;
}

/** The ratio of a party's strength to the danger it faces, or null where there is nothing out there to fear. */
export function ratioFor(d: Destination, party: Person[], stakes: 'safe' | 'risky'): number | null {
  const danger = dangerOf(d) * (stakes === 'risky' ? BOLD_DANGER : 1);
  return danger ? strengthOf(party) / danger : null;
}

/** The odds for a party at a place: the share expected home and its words. A place with nothing to fight is safe. */
export function oddsFor(d: Destination, party: Person[], stakes: 'safe' | 'risky'): { share: number; word: string; tone: OddsTone } {
  const ratio = ratioFor(d, party, stakes);
  if (ratio === null) return { share: 1, word: 'Nothing to fear but the road', tone: 'safe' };
  const share = homeShare(ratio);
  const w = oddsWordFor(share);
  return { share, word: w.word, tone: w.tone };
}

/** What a place offers: its kind of errand, what turns up there, a bounty or a purse, a quest on it. */
function seeksAt(s: GameState, d: Destination): string[] {
  const out: string[] = [];
  const kind: Partial<Record<Destination['type'], string>> = { clear: 'To break the place up and make the roads quiet', rescue: 'To bring captives home', scout: 'To see what lies there and map it', salvage: 'To pick over the ruins', delve: 'The hoard at the bottom of the dark', hunt: 'Game for the town', legendary: 'Something worth a legend', trade: 'Trade, with coin from the treasury' };
  if (kind[d.type]) out.push(kind[d.type]!);
  const loot = (Object.entries(d.loot) as [Material, number][]).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([m]) => MATERIAL_NAMES[m]?.toLowerCase() ?? m);
  if (loot.length && d.type !== 'trade') out.push(`Likely finds: ${list(loot)}`);
  const bounty = bountyOn(s, d.id);
  if (bounty) out.push(`A bounty of ${bounty} coins stands on it`);
  if (s.quests?.some((q) => q.dungeon === d.id)) out.push('A quest waits on it');
  return out;
}

/** What the town risks: the people going, what they carry on them, the food and any purse. */
function risksOf(s: GameState, d: Destination, party: Person[], m: Muster): string[] {
  const out: string[] = [`${party.length === 1 ? 'One life' : `${party.length} lives`}: ${list(party.map((p) => `${p.name} (level ${levelOf(p)})`))}`];
  const gear = party.flatMap((p) => Object.values(p.gear).filter((id): id is string => !!id));
  if (gear.length) {
    const names = [...new Set(gear.map((id) => ITEM_BY_ID[id]?.name?.toLowerCase()).filter((n): n is string => !!n))].slice(0, 3);
    out.push(`${gear.length} pieces of gear go with them${names.length ? `: ${list(names)}${new Set(gear).size > names.length ? ' and more' : ''}` : ''}, and are lost with whoever falls`);
  }
  const food = Math.ceil(foodNeeded(s, d, party.length) * RATIONS[m.rations].food);
  out.push(`${food} food packed (${RATIONS[m.rations].name.toLowerCase()} rations)`);
  if (d.coins) out.push(`${d.coins} coins from the treasury`);
  return out;
}

/** The stake card for the party being raised. */
export function stakeCard(s: GameState, m: Muster, d: Destination): StakeCard {
  const party = m.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const leader = party.find((p) => p.id === m.leader);
  const odds = oddsFor(d, party, m.stakes);
  return {
    word: odds.word,
    tone: odds.tone,
    seeks: seeksAt(s, d),
    risks: risksOf(s, d, party, m),
    seconds: (d.outSeconds * 2 + d.workSeconds) * ERA_MULTIPLIER[s.era],
    warning: warningFor(s, party, leader),
  };
}
