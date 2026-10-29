// The founder leads delves (the owner's ask; docs/notes/founder-delves.md). The town's own parties go into a dungeon
// only under an adventurer and only at `DARE` (1.15) times its worst boss (sim/parties.ts `dares`), so a young town
// never delves. The founder answers to nobody's bar: from the founder's Orders or a dungeon's card on the Expeditions
// tab, "Lead a delve" raises a party (sim/muster.ts) with the founder at its head and whoever is willing behind them,
// for any dungeon on the board, at any time. The player sees the danger first (`delveRisk`: the likeliest and the
// worst who may wait at the bottom against the party's strength, and who takes the town if the founder falls) and
// decides. Down in the dark the founder is asked at a fork and before the boss's room (`askFounder`), and the game
// waits for the answer (sim/founderQuests.ts `holdForFounder`), as on the road. The trip ends in the one summary card
// (sim/muster.ts `debrief`).

import { the, The } from '../data/expeditions';
import { DUNGEON_BY_ID, DUNGEONS } from '../data/dungeons';
import { ENEMIES } from '../data/enemies';
import { natureOf } from '../data/natures';
import { eventPicture } from '../data/eventScenes';
import type { Delve } from './delves';
import { bossName } from './delves';
import { destinationOf, destinationUnlocked, type SendCheck } from './expeditions';
import { holdForFounder } from './founderQuests';
import { heirOf } from './health';
import { askable, willing } from './muster';
import { fitToGo, mostFor, recruit } from './parties';
import { matchupOf, powerLine, powerOfGroup, powerOfParty, type Matchup } from './power';
import { maxHp, notify, type Expedition, type GameState, type Person, type Prompt } from './state';
import { calendarOf } from './time';

/** How a party stands against the worst at the bottom, by the power levels' matchup (sim/power.ts `matchupOf`, the
 *  scale every offer and the muster sheet show). */
export const DELVE_RISK: Record<Matchup, { tone: DelveTone; word: string }> = {
  Easy: { tone: 'fair', word: 'Within your strength' },
  Even: { tone: 'risky', word: 'Even at worst' },
  Risky: { tone: 'grim', word: 'Risky' },
  Deadly: { tone: 'deadly', word: 'Deadly' },
};
export type DelveTone = 'fair' | 'risky' | 'grim' | 'deadly';

/** One of who may wait at the bottom: the boss's name, the boss and its guard in words, and their power (sim/power.ts
 *  `powerOfGroup`). */
export interface BossOdds {
  name: string;
  group: string;
  power: number;
}

export interface DelveRisk {
  dest: string;
  place: string;
  /** The party's power (sim/power.ts `powerOfParty`). */
  strength: number;
  /** The likeliest boss (the middle one by danger: each is as likely as the next), and the worst. */
  likely: BossOdds;
  worst: BossOdds;
  /** Against the worst. */
  tone: DelveTone;
  word: string;
  /** The plain line: "Your party 41 against the likeliest at the bottom, the Goblin King and 1 redcap (90), and at
   *  worst the Rat King and 2 giant rats (150)." */
  line: string;
  /** If the founder goes: who takes the town if they fall, or that the town ends with them. */
  heirLine: string | null;
}

/** A foe's name mid-sentence: "The Rat King" as "the Rat King", "Gnasher, the Goblin King" as it is. */
const foe = (name: string) => name.replace(/^The /, 'the ');

/** A dungeon's possible bosses, mildest first. */
export function bossesOf(destId: string): BossOdds[] {
  const d = DUNGEON_BY_ID[destId];
  if (!d) return [];
  return d.bosses
    .map((g) => {
      const ids = Object.keys(g);
      const head = ids.find((id) => ENEMIES[id]?.boss) ?? ids[0];
      const guard = ids.filter((id) => id !== head).map((id) => `${g[id]} ${(ENEMIES[id]?.name ?? id).toLowerCase()}${g[id] > 1 ? 's' : ''}`);
      const name = ENEMIES[head]?.name ?? 'something terrible';
      return { name, group: guard.length ? `${foe(name)} and ${guard.join(', ')}` : foe(name), power: Math.round(powerOfGroup(g)) };
    })
    .sort((a, b) => a.power - b.power || a.name.localeCompare(b.name));
}

/** The words for the founder's fall: who takes up the town, or that it ends. */
export function heirLineFor(s: GameState, founder: Person): string {
  const heir = heirOf(s, founder);
  return heir ? `If ${founder.name} falls down there, ${heir.name} takes up the town.` : `${founder.name} has no heir: if they fall down there, the town ends with them.`;
}

/** The danger of a dungeon for this party. */
export function delveRisk(s: GameState, destId: string, party: Person[]): DelveRisk | null {
  const d = DUNGEON_BY_ID[destId];
  const bosses = bossesOf(destId);
  if (!d || !bosses.length) return null;
  const strength = Math.round(powerOfParty(party));
  const likely = bosses[Math.floor((bosses.length - 1) / 2)];
  const worst = bosses[bosses.length - 1];
  const band = DELVE_RISK[matchupOf(strength, worst.power)];
  const founder = party.find((p) => p.id === s.mainId);
  const beyond = bosses.filter((b) => b.power > strength).length;
  const line =
    `Your party ${strength} against ${likely === worst ? '' : `the likeliest at the bottom, ${likely.group} (${likely.power}), and at worst `}${worst.group} (${worst.power}).` +
    (beyond === 0 ? '' : beyond === bosses.length ? ' Every one of them is stronger than you.' : ` ${beyond} of the ${bosses.length} who may wait there ${beyond > 1 ? 'are' : 'is'} stronger than you.`);
  return { dest: destId, place: d.name, strength, likely, worst, tone: band.tone, word: band.word, line, heirLine: founder ? heirLineFor(s, founder) : null };
}

/** Who would go with the founder now: the founder at the head and whoever is willing, picked as a party is (sim/muster.ts
 *  `raiseParty`, without raising it). For the risk shown before the player decides. */
export function founderPartyFor(s: GameState, destId: string): Person[] {
  const f = s.people.find((p) => p.id === s.mainId);
  const d = destinationOf(s, destId);
  if (!f || !d) return [];
  const base = { dest: destId, members: [f.id], agreed: [] as number[] };
  const pool = askable(s).filter((p) => p.id !== f.id && fitToGo(s, p) && !p.guard && willing(s, base, p) === null);
  const size = Math.max(1, Math.min(mostFor(s, d), Math.max(d.recommendedParty, 3)));
  return recruit(s, f, d, [f, ...pool], size);
}

/** The dungeons on the board the founder could lead a delve into (found, reached, not lying quiet). */
export const knownDungeons = (s: GameState): string[] => DUNGEONS.filter((d) => {
  const dest = destinationOf(s, d.id);
  return !!dest && destinationUnlocked(s, dest);
}).map((d) => d.id);

/** Raise a party for a place with the founder at its head and whoever is willing behind them: the party
 *  `founderPartyFor` shows on the Orders list. Not sent: the muster sheet is the player's to look over. */
export function raiseFounderParty(s: GameState, dest: string): SendCheck {
  const f = s.people.find((p) => p.id === s.mainId);
  if (!f || !askable(s).includes(f)) return { ok: false, reason: `${f?.name ?? 'The founder'} can't go just now` };
  if (s.muster) return { ok: false, reason: 'A party is already being raised' };
  const d = destinationOf(s, dest);
  if (!d || !destinationUnlocked(s, d)) return { ok: false, reason: 'Not on the board' };
  // (the founder's own nature sets how boldly they go, as a leader's does)
  const stakes = ['bold', 'restless', 'proud'].includes(natureOf(f).id) ? 'risky' : 'safe';
  s.muster = { dest, leader: f.id, members: founderPartyFor(s, dest).map((p) => p.id), stakes, rations: 'normal', torches: 0, horses: true, refused: {}, agreed: [] };
  return { ok: true };
}

/* ------------------------------------------------------------ the founder's choices down in the dark */

/** The founder's questions in a delve: at a fork, and at the door of the boss's room. */
export type DelveAsk = 'delve_fork' | 'delve_boss';

const DELVE_ASKS: Record<DelveAsk, { title: string; options: [string, string] }> = {
  delve_fork: { title: 'The way splits', options: ['Take the darker way', 'Take the safer way'] },
  delve_boss: { title: 'The last door', options: ['Go down and face it', 'Turn back with what we have'] },
};

/** Is this a delve the founder is on, with the autopilot on (the founder's questions are a new rule)? */
export const founderDelving = (s: GameState, e: Expedition): boolean => s.autopilot !== false && e.members.includes(s.mainId);

/** Put a question to the founder in the delve; the delve and the game wait for the answer. */
export function askFounder(s: GameState, e: Expedition, v: Delve, ask: DelveAsk): void {
  const d = DUNGEON_BY_ID[e.dest];
  if (!d) return;
  const founder = s.people.find((p) => p.id === s.mainId)!;
  const party = e.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
  const up = party.filter((p) => !p.downed);
  const health = Math.round((party.reduce((n, p) => n + Math.max(0, p.hp), 0) / Math.max(1, party.reduce((n, p) => n + maxHp(p), 0))) * 100);
  const state = `${up.length} of ${party.length} on their feet, at ${health}% of their health, ${v.torches} torch${v.torches === 1 ? '' : 'es'} left.`;
  const boss = bossesOf(e.dest).find((b) => b.name === bossName(v));
  const text =
    ask === 'delve_fork'
      ? `Deep in ${the(d.name)} the way splits. One passage drops into the dark, and something glints down there: more to find, and every fight after it harder. The other climbs toward a dry ledge where they could rest. ${state}`
      : `${The(d.name)}'s last door. Behind it, ${foe(bossName(v))} waits${boss ? ` (${powerLine(powerOfParty(up), boss.power)})` : ''}. ${state} ${heirLineFor(s, founder)}`;
  const cal = calendarOf(s);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'road',
    road: ask,
    expedition: e.id,
    title: DELVE_ASKS[ask].title,
    text,
    story: `${founder.name}'s party, down in ${the(d.name)}. ${text}`,
    picture: eventPicture(`delve:${ask}:${d.id}`, `${DELVE_ASKS[ask].title} dungeon ${d.type} dark`, { hour: cal.hour, season: cal.season, weather: 'clear', biome: s.biome ?? 'forest', era: s.era, sea: false }),
    who: founder.id,
    options: [...DELVE_ASKS[ask].options],
    defaultOption: e.stakes === 'risky' ? 0 : 1,
    expiresTick: Number.MAX_SAFE_INTEGER,
  };
  holdForFounder(s, e, prompt);
  s.prompts.push(prompt);
  e.prompt = prompt.id;
  notify(s, `${DELVE_ASKS[ask].title}: ${founder.name} must choose, down in ${the(d.name)}.`, true);
}

/** The founder's answer (sim/muster.ts `answerCrossroads` passes these on). */
export function answerDelveAsk(s: GameState, prompt: Prompt, option: number): string | null {
  const ask = prompt.road as DelveAsk;
  if (!(ask in DELVE_ASKS)) return null;
  const e = s.expeditions.find((q) => q.id === prompt.expedition);
  const v = e?.delve;
  if (!e || !v) return null;
  e.prompt = null;
  if (ask === 'delve_fork') {
    const next = v.at + 1 < v.rooms.length - 1 ? v.at + 1 : -1;
    if (option === 0) {
      v.deeper = true;
      if (next >= 0) v.rooms[next] = 'treasure';
      return 'They take the darker path, toward the glint of gold.';
    }
    if (next >= 0) v.rooms[next] = 'camp';
    return 'They take the safer path, up to the dry ledge.';
  }
  if (option === 1) {
    v.turnBack = true;
    return `They leave ${foe(bossName(v))} to the dark and turn for home with what they found.`;
  }
  return `They open the last door.`;
}
