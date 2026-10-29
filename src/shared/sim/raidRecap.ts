// What a raid came to, for the recap card after it (the owner's ask: a fight recap for the tower-defence raids, as the
// parties' fights have their victory screen). While the raid is on, each townsperson's blows are tallied on the raid
// (`Raid.tally`: harm dealt, raiders felled, harm taken; the town's towers and traps as one, `TOWERS`); as it turns
// active, who was in town and at what level is noted (`Raid.roll`); `raidRecap` (from `endRaid`) puts it together on
// `s.raidRecap`, and the snapshot carries it for `RECAP_HOURS`.

import { noteFelled } from './provenance';
import { CREATURE_DEFS } from '../data/creature';
import { ENEMIES } from '../data/enemies';
import { addDeed, tally } from './deeds';
import { levelOf, xpToLevel } from '../data/levels';
import { legWound } from './raiderWounds';
import { watchWon } from './nightWatch';
import type { Stock } from '../data/materials';
import type { GameState, Person, Raid, Raider } from './state';
import { raidCloseCalls } from './closeCalls';

/** The tally's key for the town's towers and traps. */
export const TOWERS = -1;
/** The tally's key for the town's God creature (sim/creature.ts), which fights as an ally, not a person. */
export const CREATURE = -2;
/** How long (game hours) the recap stays to be seen again from the feed. */
export const RECAP_HOURS = 6;

export interface RaidTally {
  dealt: number;
  kills: number;
  taken: number;
  /** The God creature's tally only: the kinds of raider it felled, and how many of each. */
  felled?: Record<string, number>;
  /** The God creature's tally only: its health as it went out to fight (what it lost is its wounds). */
  from?: number;
}

/** The God creature's line in the recap, as a defender's row is: what it felled, the harm it did, its wounds. */
export interface BeastRow {
  /** Its name and kind: "Fenn the Wolf". */
  name: string;
  dealt: number;
  kills: number;
  taken: number;
  /** The raiders it felled, in words: "three orc grunts and a wolf" ('' when none). */
  felled: string;
  /** Beaten down in the fight, or killed. */
  fell: boolean;
  died: boolean;
}

export interface RecapRow {
  id: number;
  name: string;
  dealt: number;
  kills: number;
  taken: number;
  levelFrom: number;
  levelTo: number;
  xp: number;
  /** Struck down in the fight (lying wounded, or dead). */
  fell: boolean;
  died: boolean;
}

export interface RaidRecap {
  tick: number;
  name: string;
  /** Every raider killed or driven off with nothing taken; driven off having taken something; or they got the better of the town. */
  outcome: 'victory' | 'driven' | 'pillaged';
  boss: string | null;
  waves: number;
  came: number;
  killed: number;
  fled: number;
  through: number;
  prisoners: number;
  stolen: Stock;
  spoils: Stock;
  /** Those who fought, the most telling first. */
  rows: RecapRow[];
  /** The best of them (by harm dealt and raiders felled), if anyone fought. */
  best: number | null;
  /** The town's God creature, when it fought (sim/creature.ts). */
  beast?: BeastRow;
  /** It fought better than any townsperson. */
  beastBest?: boolean;
  towers: RaidTally | null;
  /** Raiders lamed by a leg wound, and of them those run down as they fled, and those taken alive (sim/raiderWounds.ts). */
  lamed: number;
  /** Lamed, and got away all the same. */
  limped: number;
  runDown: number;
  takenAlive: number;
  /** The town's choice (sim/raidOdds.ts): they turned back at the sight of the town, or the survivors were spared or hunted. */
  /** Spotted by the night watch, and where (sim/nightWatch.ts). */
  watched?: string;
  mercy?: 'turned' | 'spared' | 'hunted' | 'toll' | 'probe';
  /** What happened, told in a few lines (`tellRaid`). */
  story: string[];
}

const tallyOf = (r: Raid, who: number): RaidTally => ((r.tally ??= {})[who] ??= { dealt: 0, kills: 0, taken: 0 });

/** Note who's in town as the raid turns active, and their level and experience, for what they gained. */
export function noteRoll(s: GameState, r: Raid): void {
  r.roll = s.people.filter((p) => p.away === null && p.type !== 'child').map((p) => ({ id: p.id, name: p.name, level: levelOf(p), xp: p.lvXp ?? 0 }));
}

/** The raiders' health before a blow, to credit what it did (`credit`). */
export const before = (raiders: Raider[]): [Raider, number, boolean][] => raiders.filter((rd) => !rd.ally).map((rd) => [rd, rd.hp, rd.down]);

/** Credit `who` (a person's id, or `TOWERS`) with the harm done since `was` and the raiders it felled. `legs`: a blow
 *  may find a leg (a spell or skill on the board is only counted: false). */
export function credit(s: GameState, who: number, was: [Raider, number, boolean][], legs = true): void {
  const r = s.raid;
  if (!r) return;
  let dealt = 0;
  let kills = 0;
  for (const [rd, hp, down] of was) {
    if (legs && rd.hp < hp) legWound(s, rd, hp - rd.hp); // (a blow may find a leg: sim/raiderWounds.ts)
    if (rd.hp < hp) dealt += hp - rd.hp;
    if (rd.down && !down) kills++;
  }
  if (!dealt && !kills) return;
  const t = tallyOf(r, who);
  t.dealt += dealt;
  t.kills += kills;
  if (kills && who === CREATURE) {
    const f = (t.felled ??= {});
    for (const [rd, , down] of was) if (rd.down && !down) f[rd.kind] = (f[rd.kind] ?? 0) + 1;
  }
  if (kills && who >= 0) {
    const p = s.people.find((q) => q.id === who);
    if (p) p.felled = (p.felled ?? 0) + kills;
    for (const [rd, , down] of was) if (rd.down && !down) tally(p, `slain:${rd.kind}`);
    for (const [rd, , down] of was) if (rd.down && !down && ENEMIES[rd.kind]?.boss) addDeed(p, 'bosses');
    const boss = was.find(([rd, , down]) => rd.down && !down && ENEMIES[rd.kind]?.boss)?.[0];
    noteFelled(s, p, kills, boss ? ENEMIES[boss.kind].name : undefined); // (the unique in hand: sim/provenance.ts)
  }
}

/** The God creature goes out to fight: its health noted, for its wounds in the recap. */
export function beastOut(r: Raid, hp: number): void {
  tallyOf(r, CREATURE).from = hp;
}

/** Credit a blow struck by an ally of the town (`a`): counted only when it is the God creature. Only counted: its
 *  blows never lamed a raider, and still don't. */
export function creditAlly(s: GameState, a: Raider, was: [Raider, number, boolean][]): void {
  if (a.creature) credit(s, CREATURE, was, false);
}

const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const plural = (w: string) => (/(s|x|ch|sh)$/.test(w) ? `${w}es` : /[^aeiou]y$/.test(w) ? `${w.slice(0, -1)}ies` : /(wolf|elf)$/.test(w) ? `${w.slice(0, -1)}ves` : `${w}s`);
const anOf = (w: string) => (/^[aeiou]/i.test(w) ? 'an' : 'a');

/** Raiders felled, told: "three orc grunts and a wolf" (the most first). */
export function felledWords(felled: Record<string, number>): string {
  const parts = Object.entries(felled)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([k, n]) => {
      const w = (ENEMIES[k]?.name ?? k).toLowerCase();
      return n === 1 ? `${anOf(w)} ${w}` : `${NUM_WORDS[n] ?? n} ${plural(w)}`;
    });
  return names(parts);
}

/** The God creature's row, if it fought in the raid (its ally on the raid; its state after `creatureRaidOver`). */
function beastRow(s: GameState, r: Raid): BeastRow | undefined {
  const a = r.raiders.find((rd) => rd.creature);
  const c = s.creature;
  if (!a || !c) return undefined;
  const t = r.tally?.[CREATURE];
  const from = t?.from ?? a.maxHp;
  const died = !!c.dead && c.dead.tick === s.tick;
  const row = {
    name: `${c.name} the ${CREATURE_DEFS[c.kind]?.name ?? 'creature'}`,
    dealt: Math.round(t?.dealt ?? 0),
    kills: t?.kills ?? 0,
    taken: Math.max(0, Math.round(from - (a.down ? 0 : a.hp))),
    felled: felledWords(t?.felled ?? {}),
    fell: died || a.down || a.hp <= 0,
    died,
  };
  // (out to meet them, and never came to blows: no row)
  return row.dealt || row.kills || row.taken || row.fell ? row : undefined;
}

/** A townsperson took harm in the raid. */
export function took(s: GameState, p: Person, hp: number): void {
  if (s.raid && p.hp < hp) tallyOf(s.raid, p.id).taken += hp - p.hp;
}

/** Put the raid's recap together as it ends. */
export function raidRecap(s: GameState, r: Raid, name: string, a: { outcome: RaidRecap['outcome']; boss: string | null; bossDown?: boolean; fromSea?: boolean; killed: number; came: number; prisoners: number; stolen: Stock; spoils: Stock }): RaidRecap {
  const people = new Map(s.people.map((p) => [p.id, p]));
  const tally = r.tally ?? {};
  const rows: RecapRow[] = [];
  for (const q of r.roll ?? []) {
    const p = people.get(q.id);
    const t = tally[q.id];
    const died = !p;
    if (!t && !died) continue;
    const levelTo = p ? levelOf(p) : q.level;
    let xp = p ? (p.lvXp ?? 0) - q.xp : 0;
    for (let l = q.level; l < levelTo; l++) xp += xpToLevel(l);
    rows.push({ id: q.id, name: q.name, dealt: Math.round(t?.dealt ?? 0), kills: t?.kills ?? 0, taken: Math.round(t?.taken ?? 0), levelFrom: q.level, levelTo, xp: Math.max(0, Math.round(xp)), fell: died || !!p?.downed, died });
  }
  // (anyone who came into town in the raid's course and fought: not on the roll)
  for (const [k, t] of Object.entries(tally)) {
    const id = +k;
    if (id === TOWERS || rows.some((x) => x.id === id)) continue;
    const p = people.get(id);
    if (!p) continue;
    rows.push({ id, name: p.name, dealt: Math.round(t.dealt), kills: t.kills, taken: Math.round(t.taken), levelFrom: levelOf(p), levelTo: levelOf(p), xp: 0, fell: !!p.downed, died: false });
  }
  const worth = (x: Pick<RecapRow, 'dealt' | 'kills'>) => x.dealt + x.kills * 25;
  rows.sort((x, y) => worth(y) - worth(x) || y.taken - x.taken);
  const best = rows.find((x) => !x.died && worth(x) > 0) ?? null;
  const b = r.battle;
  const towers = tally[TOWERS];
  const recap: RaidRecap = {
    tick: s.tick,
    name,
    outcome: a.outcome,
    boss: a.boss,
    waves: b?.waves ?? 1,
    came: a.came,
    killed: a.killed,
    fled: Math.max(0, a.came - a.killed - (b?.through ?? 0)),
    through: b?.through ?? 0,
    prisoners: a.prisoners,
    stolen: a.stolen,
    spoils: a.spoils,
    rows,
    best: best?.id ?? null,
    towers: towers ? { dealt: Math.round(towers.dealt), kills: towers.kills, taken: 0 } : null,
    lamed: r.raiders.filter((rd) => !rd.ally && rd.lamed).length,
    limped: r.raiders.filter((rd) => !rd.ally && rd.lamed && !rd.down).length,
    runDown: r.raiders.filter((rd) => !rd.ally && rd.runDown).length,
    takenAlive: r.raiders.filter((rd) => !rd.ally && rd.runDown && rd.taken).length,
    story: [],
  };
  // (the God creature fought beside them: sim/creature.ts)
  const beast = beastRow(s, r);
  if (beast) {
    recap.beast = beast;
    if (worth(beast) > 0 && worth(beast) > (best ? worth(best) : 0)) recap.beastBest = true;
  }
  recap.story = tellRaid(recap, { side: r.side, fromSea: !!a.fromSea, bossDown: !!a.bossDown, sneak: r.kind.startsWith('prowl_') });
  // (the night watch saw them coming in: sim/nightWatch.ts)
  if (r.watched) {
    recap.watched = r.watched;
    recap.story.splice(1, 0, `The night watch spotted them ${r.watched} and raised the alarm.`);
    watchWon(s, r, recap);
  }
  // (who nearly fell, and lived: sim/closeCalls.ts)
  recap.story.splice(Math.max(1, recap.story.length - 1), 0, ...raidCloseCalls(s, r.arrivesTick, rows)); // (before how it ended)
  return recap;
}

const names = (list: string[]) => (list.length < 2 ? list.join('') : `${list.slice(0, -1).join(', ')} and ${list[list.length - 1]}`);
const stockWords = (st: Stock) =>
  Object.entries(st)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([m, n]) => `${n} ${m.replace(/_/g, ' ')}`)
    .join(', ');

/** The raid told in a few lines, from its recap: who came and from where, who led them, who fought hardest and who
 *  bore the worst of it, the fallen and the dead, the towers' part, and how it ended. */
export function tellRaid(c: RaidRecap, o: { side: -1 | 1; fromSea: boolean; bossDown: boolean; sneak?: boolean }): string[] {
  const out: string[] = [];
  const who = /^the /i.test(c.name) ? c.name : `the ${c.name.toLowerCase()}`;
  // (night prowlers slip in where the wall has gaps: sim/prowlers.ts)
  const where = o.sneak ? 'in by night, where nothing stood in their way' : o.fromSea ? 'up from the sea' : o.side < 0 ? 'from the west' : 'from the east';
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  out.push(`${cap(who)} came ${where}. ${c.came === 1 ? 'There was one of them' : `There were ${c.came}`}${c.waves > 1 ? `, in ${c.waves} waves` : ''}.`);
  if (c.boss) out.push(o.bossDown ? `${c.boss} led them, and was killed.` : `${c.boss} led them, and got away.`);
  const best = c.rows.find((x) => x.id === c.best);
  const bt = c.beast;
  const beastDid = bt ? (bt.kills ? `killed ${bt.felled || (bt.kills === 1 ? 'one' : bt.kills)} and did ${bt.dealt} damage` : `did ${bt.dealt} damage`) : '';
  if (bt && c.beastBest) out.push(`${bt.name} fought best. It ${beastDid}.`);
  if (best) {
    const lead = c.beastBest ? `Of the townsfolk, ${best.name} fought best` : `${best.name} fought best`;
    out.push(best.kills ? `${lead}. They killed ${best.kills === 1 ? 'one' : best.kills} and did ${best.dealt} damage.` : `${lead}, and did ${best.dealt} damage.`);
  }
  if (bt && !c.beastBest && (bt.dealt > 0 || bt.kills > 0)) out.push(`${bt.name} fought beside them, and ${beastDid}.`);
  if (bt) {
    if (bt.died) out.push(`${bt.name} was killed in the fight.`);
    else if (bt.fell) out.push(`${bt.name} was beaten down${bt.taken ? `, taking ${bt.taken} damage` : ''}, and limped home.`);
    else if (bt.taken >= 20) out.push(`${bt.name} took ${bt.taken} damage and stayed on its feet.`);
  }
  const stalwart = [...c.rows].filter((x) => x !== best && !x.fell && x.taken > 0).sort((a, b) => b.taken - a.taken)[0];
  if (stalwart && stalwart.taken >= 20) out.push(`${stalwart.name} took ${stalwart.taken} damage and stayed on their feet.`);
  if (c.runDown) {
    const all = c.takenAlive === c.runDown;
    out.push(`${c.runDown === 1 ? 'One raider was' : `${c.runDown} raiders were`} hurt in the leg, caught as ${c.runDown === 1 ? 'it' : 'they'} limped away${c.takenAlive ? (all ? ' and taken prisoner' : `. ${c.takenAlive} taken prisoner`) : ''}.`);
  } else if (c.limped) out.push(`${c.limped === 1 ? 'One raider' : `${c.limped} raiders`} limped away hurt.`);
  const fell = c.rows.filter((x) => x.fell && !x.died).map((x) => x.name);
  if (fell.length) out.push(`${names(fell)} ${fell.length === 1 ? 'was' : 'were'} knocked down, but ${fell.length === 1 ? 'is' : 'are'} alive.`);
  const died = c.rows.filter((x) => x.died).map((x) => x.name);
  if (died.length) out.push(`${names(died)} died defending the town.`);
  if (c.towers?.kills) out.push(`The towers and traps killed ${c.towers.kills === 1 ? 'one' : c.towers.kills}.`);
  else if (c.towers?.dealt) out.push('The towers and traps helped.');
  if (!c.rows.length && !c.beast) out.push('Nobody fought them.');
  const stolen = stockWords(c.stolen);
  if (c.outcome === 'pillaged') out.push(`They escaped with ${stolen || 'what they came for'}.`);
  else if (c.killed >= c.came) out.push(c.came === 1 ? 'It did not escape.' : 'None of them escaped.');
  else out.push(`${c.killed ? 'The rest' : 'They'} ran away${c.through ? `. ${c.through} ran through the town first` : ''}.`);
  // (those run down and taken were told above)
  const more = c.prisoners - c.takenAlive;
  if (more > 0) out.push(`${more === 1 ? `One${c.takenAlive ? ' more was' : ' was'}` : `${more}${c.takenAlive ? ' more were' : ' were'}`} taken prisoner.`);
  return out;
}
