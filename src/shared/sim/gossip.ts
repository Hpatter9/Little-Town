// The town's talk (the owner's ask: townsfolk who stop near each other sometimes talk about what really happened, by
// name). The journal's milestones are read into news (`readNews`: a death, a party home, the dragon, a wedding...),
// the last day and a half's of it carried on the snapshot (`townGossip`), and the map's speech (renderer/map/speech.ts)
// has one person tell it in their nature's voice (`gossipLine`) and whoever stands by answer to fit (`gossipReply`).
// Pure: no state is changed, and the lines are picked by the roll given.

import { BAD_NEWS, OPENERS, REPLIES, SAYINGS, TAKES, type GossipKind } from '../data/gossip';
import type { NatureId } from '../data/natures';
import type { JournalEntry } from './state';
import { TICKS_PER_HOUR } from './time';

/** A piece of news: what kind, who it's about and what (a place, a building, a foe), and the journal entry it's from. */
export interface Gossip {
  id: number;
  kind: GossipKind;
  who?: string;
  what?: string;
}

/** News stays worth talking of this long (game hours), and at most this many pieces are carried. */
export const GOSSIP_HOURS = 36;
export const GOSSIP_MOST = 6;

/** "The Cave to the south-west" → "the Cave to the south-west" (it goes mid-sentence). */
const lower = (s: string) => s.replace(/^The /, 'the ');
const both = (a: string, b: string) => `${a} and ${b}`;
/** Walls, gates and the like go up a piece at a time: not news. */
const DULL_BUILT = /wall|gate|grate|palisade|road|street|campfire|stockpile/i;

/** Each milestone the town talks of: its pattern, and how its kind, who and what are read from the match. */
const READS: [RegExp, (m: RegExpMatchArray) => Omit<Gossip, 'id'> | null][] = [
  [/^(.+?) has (died .+?)\.?$/, (m) => ({ kind: 'death', who: m[1], what: m[2] })],
  [/^(.+?) has lost (their .+?)\.?$/, (m) => ({ kind: 'maimed', who: m[1], what: m[2] })],
  [/^(.+?) and (.+?) were married/, (m) => ({ kind: 'wedding', who: both(m[1], m[2]) })],
  [/^(.+?) and (.+?) are a couple/, (m) => ({ kind: 'couple', who: both(m[1], m[2]) })],
  [/^(.+?) and (.+?) welcomed a child, (.+?)\.?$/, (m) => ({ kind: 'birth', who: both(m[1], m[2]), what: m[3] })],
  [/^(.+?) and (.+?) came to blows/, (m) => ({ kind: 'brawl', who: both(m[1], m[2]) })],
  [/^(.+?) has grown up/, (m) => ({ kind: 'grown', who: m[1] })],
  [/^(.+?) joined the town/, (m) => ({ kind: 'joined', who: m[1] })],
  [/^(.+?) party is back(?: \(recalled\))?:/, (m) => ({ kind: 'back', what: lower(m[1]) })],
  [/^No one came back from (.+?)\.?$/, (m) => ({ kind: 'lost', what: m[1] })],
  [/^(\S+) gathers a party for (.+?)\.?$/, (m) => ({ kind: 'setout', who: m[1], what: lower(m[2]) })],
  [/^(.+?) sweeps low over the town/, (m) => ({ kind: 'dragon', what: m[1] })],
  [/^(.+?) lands on the hill and demands/, (m) => ({ kind: 'dragon', what: m[1] })],
  [/^Finished building: (.+?)\.?$/, (m) => (DULL_BUILT.test(m[1]) ? null : { kind: 'built', what: m[1].toLowerCase() })],
  [/^Research complete: (.+?)\.?$/, (m) => ({ kind: 'learned', what: m[1] })],
  [/^(.+?) is slain!/, (m) => ({ kind: 'slain', what: / the /.test(m[1]) || !m[1].includes(' ') || /^the /i.test(m[1]) ? m[1] : `the ${m[1]}` })],
  [/^Raid by (.+?) is over/, (m) => ({ kind: 'raid', what: lower(m[1]) })],
  [/^The (.+?) is on fire!/, (m) => ({ kind: 'fire', what: m[1] })],
  [/river is rising|water is coming up|flood waters/i, () => ({ kind: 'flood' })],
  [/^(.+?) stole .+? and was caught/, (m) => ({ kind: 'crime', who: m[1] })],
  [/^(.+?) is (?:pardoned|fined|put in the stocks|exiled|hanged)/, (m) => ({ kind: 'trial', who: m[1] })],
  [/^A new age begins: the (.+?) era/, (m) => ({ kind: 'age', what: m[1] })],
  [/^(.+?) was hired as a guard/, (m) => ({ kind: 'guard', who: m[1] })],
  [/^(.+?) saw off the (.+?) on the land/, (m) => ({ kind: 'beasts', who: m[1], what: m[2] })],
  [/bury (?:its|their) dead: (.+?)\.?$/, (m) => ({ kind: 'funeral', what: m[1] })],
  [/blessed the (.+?)\.?$/, (m) => ({ kind: 'blessing', what: m[1] })],
  [/^An omen:/, () => ({ kind: 'omen' })],
];

/** What a milestone is, as news: null when it's nothing anyone would talk of. */
export function readNews(text: string): Omit<Gossip, 'id'> | null {
  // (a mark or two before the words: "✨ Ceres blessed the fields", "🌊 The river is rising")
  const t = text.replace(/^[^\p{L}\p{N}]+/u, '').trim();
  for (const [re, read] of READS) {
    const m = t.match(re);
    if (m) return read(m);
  }
  return null;
}

/** Who led a party home from somewhere: whoever gathered it (the journal's "X gathers a party for Y"), else the first
 *  named setting out for it ("X, Y and Z set out for Y"), looked for before the homecoming. */
function leaderOf(journal: readonly JournalEntry[], before: number, place: string): string | undefined {
  const p = place.toLowerCase();
  for (let i = before - 1; i >= 0 && i >= before - 200; i--) {
    const t = journal[i].text;
    const m = t.match(/^(\S+) gathers a party for (.+?)\.?$/) ?? t.match(/^([A-Z][\w'-]*)\b.*? set out for (.+?)(?: in the [^.]+)?\.$/);
    if (m && m[2].toLowerCase() === p) return m[1];
  }
  return undefined;
}

/** The news worth talking of now, newest first: the milestones of the last `GOSSIP_HOURS`, read into news, one of a
 *  kind about the same thing, at most `GOSSIP_MOST`. */
export function townGossip(journal: readonly JournalEntry[], tick: number): Gossip[] {
  const out: Gossip[] = [];
  const seen = new Set<string>();
  for (let i = journal.length - 1; i >= 0 && out.length < GOSSIP_MOST; i--) {
    const e = journal[i];
    if (tick - e.tick > GOSSIP_HOURS * TICKS_PER_HOUR) break;
    if (!e.key || e.lines) continue;
    const g = readNews(e.text);
    if (!g) continue;
    if (g.kind === 'back' && g.what) g.who = leaderOf(journal, i, g.what);
    const key = `${g.kind}|${g.who ?? ''}|${g.kind === 'dragon' || g.kind === 'built' || g.kind === 'learned' || g.kind === 'fire' ? '' : (g.what ?? '')}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: e.id, ...g });
  }
  return out;
}

const fill = (line: string, g: Omit<Gossip, 'id'>) => line.replace(/\{who\}/g, g.who ?? '').replace(/\{what\}/g, g.what ?? '');
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
/** The lines of a list that the news can fill (none asking for a {who} or {what} it hasn't got). */
const fits = (lines: readonly string[], g: Omit<Gossip, 'id'>) => lines.filter((l) => (!l.includes('{who}') || !!g.who) && (!l.includes('{what}') || !!g.what));
const pick = <T>(list: readonly T[], roll: number): T => list[Math.min(list.length - 1, Math.floor(Math.max(0, roll) * list.length))];

/** The news told plainly (for the diary: "Everyone's talking of it: ..."), or null when no saying fits. */
export function sayingOf(g: Omit<Gossip, 'id'>, roll: number): string | null {
  const lines = fits(SAYINGS[g.kind], g);
  return lines.length ? cap(fill(pick(lines, roll), g)) : null;
}

/** A piece of news as someone of this nature would tell it. */
export function gossipLine(g: Omit<Gossip, 'id'>, nature: NatureId, roll: number): string {
  const opener = pick(OPENERS[nature], (roll * 7.31) % 1);
  const said = sayingOf(g, roll) ?? 'Strange times, eh?';
  return `${opener} ${said}`;
}

/** The answer to a piece of news from someone of this nature: one that fits the news, else their way with good or bad. */
export function gossipReply(g: Omit<Gossip, 'id'>, nature: NatureId, roll: number): string {
  const own = fits(REPLIES[g.kind], g);
  if (own.length && roll < 0.55) return cap(fill(pick(own, roll / 0.55), g));
  const take = TAKES[nature][BAD_NEWS.has(g.kind) ? 'bad' : 'good'];
  return pick(take, (roll * 3.7) % 1);
}

/** Whether a piece of news is bad to hear. */
export const badNews = (g: { kind: GossipKind }) => BAD_NEWS.has(g.kind);
