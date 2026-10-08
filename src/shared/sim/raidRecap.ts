// What a raid came to, for the recap card after it (the owner's ask: a fight recap for the tower-defence raids, as the
// parties' fights have their victory screen). While the raid is on, each townsperson's blows are tallied on the raid
// (`Raid.tally`: harm dealt, raiders felled, harm taken; the town's towers and traps as one, `TOWERS`); as it turns
// active, who was in town and at what level is noted (`Raid.roll`); `raidRecap` (from `endRaid`) puts it together on
// `s.raidRecap`, and the snapshot carries it for `RECAP_HOURS`.

import { levelOf, xpToLevel } from '../data/levels';
import { legWound } from './raiderWounds';
import type { Stock } from '../data/materials';
import type { GameState, Person, Raid, Raider } from './state';

/** The tally's key for the town's towers and traps. */
export const TOWERS = -1;
/** How long (game hours) the recap stays to be seen again from the feed. */
export const RECAP_HOURS = 6;

export interface RaidTally {
  dealt: number;
  kills: number;
  taken: number;
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
  towers: RaidTally | null;
  /** Raiders lamed by a leg wound, and of them those run down as they fled, and those taken alive (sim/raiderWounds.ts). */
  lamed: number;
  /** Lamed, and got away all the same. */
  limped: number;
  runDown: number;
  takenAlive: number;
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

/** Credit `who` (a person's id, or `TOWERS`) with the harm done since `was` and the raiders it felled. */
export function credit(s: GameState, who: number, was: [Raider, number, boolean][]): void {
  const r = s.raid;
  if (!r) return;
  let dealt = 0;
  let kills = 0;
  for (const [rd, hp, down] of was) {
    if (rd.hp < hp) legWound(s, rd, hp - rd.hp); // (a blow may find a leg: sim/raiderWounds.ts)
    if (rd.hp < hp) dealt += hp - rd.hp;
    if (rd.down && !down) kills++;
  }
  if (!dealt && !kills) return;
  const t = tallyOf(r, who);
  t.dealt += dealt;
  t.kills += kills;
  if (kills && who !== TOWERS) {
    const p = s.people.find((q) => q.id === who);
    if (p) p.felled = (p.felled ?? 0) + kills;
  }
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
  const worth = (x: RecapRow) => x.dealt + x.kills * 25;
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
  recap.story = tellRaid(recap, { side: r.side, fromSea: !!a.fromSea, bossDown: !!a.bossDown, sneak: r.kind.startsWith('prowl_') });
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
  const where = o.sneak ? 'in by night, where nothing stood to stop them' : o.fromSea ? 'up out of the sea' : o.side < 0 ? 'out of the west' : 'out of the east';
  const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  out.push(`${cap(who)} came ${where}: ${c.came === 1 ? 'one alone' : `${c.came} of them`}${c.waves > 1 ? `, in ${c.waves} waves` : ''}.`);
  if (c.boss) out.push(o.bossDown ? `${c.boss} led them, and fell.` : `${c.boss} led them, and lived to boast of it.`);
  const best = c.rows.find((x) => x.id === c.best);
  if (best) out.push(best.kills ? `${best.name} fought hardest, felling ${best.kills === 1 ? 'one' : best.kills} and dealing ${best.dealt} harm.` : `${best.name} fought hardest, dealing ${best.dealt} harm.`);
  const stalwart = [...c.rows].filter((x) => x !== best && !x.fell && x.taken > 0).sort((a, b) => b.taken - a.taken)[0];
  if (stalwart && stalwart.taken >= 20) out.push(`${stalwart.name} took the worst of it, ${stalwart.taken} harm, and kept their feet.`);
  if (c.runDown) {
    const all = c.takenAlive === c.runDown;
    out.push(`${c.runDown === 1 ? 'One, lamed in the fight, was' : `${c.runDown}, lamed in the fight, were`} run down as ${c.runDown === 1 ? 'it' : 'they'} limped away${c.takenAlive ? (all ? ` and taken alive` : `; ${c.takenAlive} taken alive`) : ''}.`);
  } else if (c.limped) out.push(`${c.limped === 1 ? 'One limped' : `${c.limped} limped`} away hurt.`);
  const fell = c.rows.filter((x) => x.fell && !x.died).map((x) => x.name);
  if (fell.length) out.push(`${names(fell)} ${fell.length === 1 ? 'was' : 'were'} struck down, but ${fell.length === 1 ? 'lives' : 'live'} yet.`);
  const died = c.rows.filter((x) => x.died).map((x) => x.name);
  if (died.length) out.push(`${names(died)} died defending the town.`);
  if (c.towers?.kills) out.push(`The towers and traps brought down ${c.towers.kills === 1 ? 'one' : c.towers.kills}.`);
  else if (c.towers?.dealt) out.push('The towers and traps did their part.');
  if (!c.rows.length) out.push('Nobody stood against them.');
  const stolen = stockWords(c.stolen);
  if (c.outcome === 'pillaged') out.push(`They got away with ${stolen || 'what they came for'}.`);
  else if (c.killed >= c.came) out.push(c.came === 1 ? 'It never got away.' : 'Not one of them got away.');
  else out.push(`${c.killed ? 'The rest' : 'They'} broke and fled${c.through ? `, ${c.through} of them through the town` : ''}.`);
  // (those run down and taken were told above)
  const more = c.prisoners - c.takenAlive;
  if (more > 0) out.push(`${more === 1 ? `One${c.takenAlive ? ' more' : ''} was` : `${more}${c.takenAlive ? ' more' : ''} were`} taken alive.`);
  return out;
}
