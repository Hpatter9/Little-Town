// On the fifteenth day the townsfolk vote on a name that fits their home, people and recent history.

import { BIOME_DEFS, type Biome } from '../data/biomes';
import { originOf, type OriginId } from '../data/origins';
import { hashSeed } from '../rng';
import { calendar, TICKS_PER_DAY } from './time';
import { notify, type GameState } from './state';

export const SETTLEMENT_VOTE_DAY = 15;

const PLACE_WORD: Record<Biome, string> = {
  forest: 'Pine', desert: 'Sun', tundra: 'Frost', coast: 'Tide', swamp: 'Reed',
  jungle: 'Canopy', highlands: 'Crag', ashlands: 'Cinder', steppe: 'Wind', taiga: 'Snow',
};

const PEOPLE_WORD: Record<OriginId, string> = {
  settlers: 'Hearth', lich: 'Grave', druid: 'Oak', vampire: 'Crimson', werewolf: 'Moon', robot: 'Iron',
  dwarves: 'Forge', merfolk: 'Coral', nomads: 'Wanderer', fae: 'Glimmer', alchemists: 'Copper', knights: 'Crown', orcs: 'Fang',
};

const PLACE_KIND: Record<OriginId, string> = {
  settlers: 'Haven', lich: 'Necropolis', druid: 'Grove', vampire: 'Court', werewolf: 'Den', robot: 'Foundry',
  dwarves: 'Hold', merfolk: 'Reef', nomads: 'Camp', fae: 'Glen', alchemists: 'Workshop', knights: 'Keep', orcs: 'Hold',
};

function storyOf(s: GameState): { word: string; reason: string } {
  const since = s.tick - SETTLEMENT_VOTE_DAY * TICKS_PER_DAY;
  for (const e of [...s.journal].reverse()) {
    if (e.tick < since) break;
    const text = e.text.toLowerCase();
    if (text.includes('dragon')) return { word: 'Wyrm', reason: 'the dragon that came to their land' };
    if (/raid|raider|bandit/.test(text)) return { word: 'Shield', reason: 'the danger they stood against' };
    if (/wildfire|fire|ember/.test(text)) return { word: 'Ember', reason: 'the fire they endured' };
    if (/flood|river/.test(text)) return { word: 'Ford', reason: 'the waters that shaped their home' };
    if (/storm|tornado|earthquake/.test(text)) return { word: 'Storm', reason: 'the storm that tested them' };
    if (/born|birth|new child/.test(text)) return { word: 'Newleaf', reason: 'the new life among them' };
    if (/research complete|discovered/.test(text)) return { word: 'Lantern', reason: 'what they learned together' };
    if (/finished building|built:|first home/.test(text)) return { word: 'Hearth', reason: 'the first home they raised' };
  }
  return { word: 'Firstlight', reason: 'the new life they are building here' };
}

/** Choose once, with a seeded ballot so a save always reaches the same result. */
export function voteSettlementName(s: GameState): boolean {
  if (s.townName || calendar(s.tick).day < SETTLEMENT_VOTE_DAY) return false;
  const origin = originOf(s);
  const biome = s.biome ?? 'forest';
  const style = origin.rules.castle ? 'Keep' : origin.rules.hold ? 'Hall' : origin.rules.nomadic ? 'Camp' : PLACE_KIND[origin.id];
  const story = storyOf(s);
  const options = [
    { name: `${PLACE_WORD[biome]} ${style}`, basis: `the ${BIOME_DEFS[biome].name.toLowerCase()} where they settled` },
    { name: `${PEOPLE_WORD[origin.id]} ${style}`, basis: "their people's traditions" },
    { name: `${story.word} ${style}`, basis: story.reason },
  ].filter((choice, i, all) => all.findIndex((other) => other.name === choice.name) === i);
  const voters = s.people.filter((p) => p.away === null);
  const votes = options.map(() => 0);
  for (const person of voters) {
    const preference = hashSeed(`${s.seed}:settlement-vote:${person.id}`) % 100;
    const ownOrigin = person.origin ?? origin.id;
    const choice = ownOrigin !== origin.id && preference < 45 ? 2 : preference < 35 ? 0 : preference < 70 ? 1 : 2;
    votes[choice % options.length]++;
  }
  const high = Math.max(...votes);
  const tied = votes.flatMap((count, i) => count === high ? [i] : []);
  const winner = tied[hashSeed(`${s.seed}:settlement-vote-tie`) % tied.length];
  const chosen = options[winner];
  s.townName = chosen.name;
  const tally = votes.map((count, i) => `${options[i].name} ${count}`).join(', ');
  notify(s, `The people vote on a name: ${tally}. ${chosen.name} wins, for ${chosen.basis}.`, true);
  return true;
}
