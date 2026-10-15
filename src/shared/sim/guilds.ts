// Guilds and squads (data/guilds.ts has the numbers and the words). `s.guilds` (`Guild`, in sim/guildPerks.ts). Each
// day at `GUILD_HOUR` (`guildsHourly`, from sim.ts; off with the autopilot, so the tests' plainGame never sees one):
// the guilds keep their ranks (the dead and the gone dropped, a new leader when the old one is lost, newcomers who fit
// taken in, an empty guild disbanded) and do their day's work (the rangers' haul, the merchants' dues); then, no
// oftener than `GUILD_GAP_DAYS`, the town looks for a role it lacks (`lacking`: the one wanted most, by `needOf`, that
// enough people fit) and fills it: one of the town founds a guild for it, or the council votes on one
// (`COUNCIL_SHARE` of the time while it sits: sim/politics.ts). The town names it (`guildName`) in its people's way,
// and the founding is told in the event box. Its perks are read through sim/guildPerks.ts.

import {
  COUNCIL_SHARE, ELITE_LEVEL, ELITE_MOST, ELITE_PEOPLE, GUILD_FROM_DAY, GUILD_GAP_DAYS, GUILD_HOUR, GUILD_PEOPLE, GUILD_PER_PEOPLE, GUILD_ROLE_DEFS, GUILD_ROLES, MEMBERS_LEAST, MEMBERS_MOST,
  MERCHANT_DUES, MERCHANT_PER_SOCIAL, NEED_AT, ORIGIN_WORDS, RANGER_HIDE, RANGER_MEAT, type GuildRole,
} from '../data/guilds';
import { levelOf } from '../data/levels';
import { COUNCIL_PEOPLE } from '../data/politics';
import { hashSeed, Rng } from '../rng';
import { depositNear } from './buildings';
import type { Guild } from './guildPerks';
import { blocOf } from './politics';
import { isChild } from './social';
import { campXY, earn, type GameState, type Person } from './state';
import { tellStory } from './telling';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';

export type { Guild } from './guildPerks';

const LOG_KEPT = 6;
const day = (s: GameState) => Math.floor(s.tick / TICKS_PER_DAY) + 1;
const grownAtHome = (s: GameState) => s.people.filter((p) => p.away === null && !isChild(p));

/** How fit someone is for a role (their best level at its skills); 0 if they don't fit it at all. */
export function fitFor(p: Person, role: GuildRole): number {
  const def = GUILD_ROLE_DEFS[role];
  if (isChild(p)) return 0;
  if (role === 'elite' && levelOf(p) < ELITE_LEVEL) return 0;
  const best = Math.max(...def.skills.map((k) => p.skills[k]?.level ?? 0));
  return best >= def.least ? best + (role === 'elite' ? levelOf(p) / 4 : 0) : 0;
}

/** Those at home who fit a role and are free to join (the elite squad may call on another guild's people). */
function candidates(s: GameState, role: GuildRole): Person[] {
  return grownAtHome(s)
    .filter((p) => fitFor(p, role) > 0 && (role === 'elite' || !s.guilds?.some((g) => g.members.includes(p.id))))
    .sort((a, b) => fitFor(b, role) - fitFor(a, role) || a.id - b.id);
}

const raidedLately = (s: GameState) => !!s.raidRecap && s.tick - s.raidRecap.tick < 10 * TICKS_PER_DAY;

/** How badly the town wants a role filled. */
export function needOf(s: GameState, role: GuildRole): number {
  const grown = grownAtHome(s);
  const lost = (s.fallen ?? []).filter((f) => f.day >= day(s) - 10).length;
  switch (role) {
    case 'wardens':
      return (raidedLately(s) ? 3 : 0) + Math.min(3, lost) + (s.people.some((p) => p.guard) ? 0 : 1) + (grown.length >= 8 ? 1 : 0);
    case 'menders':
      return s.people.reduce((n, p) => n + (p.wounds?.length ? 1 : 0) + (p.sick ? 2 : 0) + (p.downed ? 2 : 0), 0);
    case 'rangers':
      return (s.places ?? []).filter((q) => q.found !== null && q.state === 'waiting' && q.foes).length + (s.roamers?.length ?? 0) * 2 + 1;
    case 'crafters':
      return Math.floor(s.crafting.length / 2) + 1;
    case 'merchants':
      return s.buildings.filter((b) => b.status === 'done' && b.shop).length * 2;
    case 'scholars':
      return s.research.queue.length + 1;
    case 'elite':
      return grown.length >= ELITE_PEOPLE && raidedLately(s) ? 4 + Math.min(4, lost) : 0;
  }
}

/** The role the town lacks most that enough people fit, if any is wanted badly enough. */
export function lacking(s: GameState): GuildRole | null {
  let best: GuildRole | null = null;
  let most = NEED_AT - 1;
  for (const role of GUILD_ROLES) {
    if (s.guilds?.some((g) => g.role === role)) continue;
    if (candidates(s, role).length < MEMBERS_LEAST) continue;
    const n = needOf(s, role);
    if (n > most) {
      most = n;
      best = role;
    }
  }
  return best;
}

/** The town names a guild: its people's words for it, never one it has already. */
export function guildName(s: GameState, role: GuildRole, rng: Rng): string {
  const words = ORIGIN_WORDS[s.origin ?? 'settlers'];
  const adjs = role === 'elite' ? words.elite : words.plain;
  const nouns = GUILD_ROLE_DEFS[role].nouns;
  const taken = new Set((s.guilds ?? []).map((g) => g.name));
  let name = '';
  for (let i = 0; i < 12; i++) {
    const adj = adjs[rng.int(0, adjs.length - 1)];
    const noun = nouns[rng.int(0, nouns.length - 1)];
    name = s.townName && rng.chance(0.25) ? `The ${noun} of ${s.townName}` : `The ${adj} ${noun}`;
    if (!taken.has(name)) return name;
  }
  return `${name} ${taken.size + 1}`;
}

function note(g: Guild, text: string): void {
  g.log.unshift(text);
  if (g.log.length > LOG_KEPT) g.log.length = LOG_KEPT;
}

/* ------------------------------------------------------------ the hour */

export function guildsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || s.autopilot === false || s.gameOver) return;
  if (calendar(s.tick).hour !== GUILD_HOUR) return;
  const rng = new Rng(hashSeed(`${s.seed}:guilds:${s.tick}`));
  keepRanks(s);
  guildWork(s);
  const grown = grownAtHome(s);
  if (day(s) < GUILD_FROM_DAY || grown.length < GUILD_PEOPLE) return;
  if (s.lastGuild !== undefined && s.tick - s.lastGuild < GUILD_GAP_DAYS * TICKS_PER_DAY - TICKS_PER_HOUR) return;
  if ((s.guilds?.length ?? 0) >= Math.floor(grown.length / GUILD_PER_PEOPLE)) return;
  const role = lacking(s);
  if (role) foundGuild(s, role, rng);
}

/** Each guild keeps its ranks: the dead and the gone dropped, a leader found, those who fit taken in. */
function keepRanks(s: GameState): void {
  if (!s.guilds?.length) return;
  const here = new Set(s.people.map((p) => p.id));
  for (const g of [...s.guilds]) {
    g.members = g.members.filter((id) => here.has(id));
    if (!g.members.length) {
      s.guilds = s.guilds.filter((x) => x !== g);
      tellStory(s, `${g.name} is no more`, `The last of ${g.name} is gone, and nobody is left to carry on ${GUILD_ROLE_DEFS[g.role].role}. Their banner comes down. If the town needs it again, someone will start it afresh.`, 'empty hall candle grief');
      continue;
    }
    if (!g.members.includes(g.leader)) {
      const next = g.members.map((id) => s.people.find((p) => p.id === id)!).sort((a, b) => fitFor(b, g.role) - fitFor(a, g.role) || a.id - b.id)[0];
      g.leader = next.id;
      note(g, `Day ${day(s)}: ${next.name} takes up the leadership.`);
    }
    const most = g.role === 'elite' ? ELITE_MOST : MEMBERS_MOST;
    for (const p of candidates(s, g.role)) {
      if (g.members.length >= most) break;
      if (g.members.includes(p.id)) continue;
      join(s, g, p);
      note(g, `Day ${day(s)}: ${p.name} joins.`);
    }
  }
}

/** Someone joins a guild (out of any other: the elite squad's call comes first). */
function join(s: GameState, g: Guild, p: Person): void {
  for (const o of s.guilds ?? []) {
    if (o === g || !o.members.includes(p.id)) continue;
    o.members = o.members.filter((id) => id !== p.id);
    if (o.leader === p.id && o.members.length) o.leader = o.members[0];
  }
  if (!g.members.includes(p.id)) g.members.push(p.id);
}

/** The guilds' day: the rangers bring home what they hunted, the merchants pay in their dues. */
function guildWork(s: GameState): void {
  for (const g of s.guilds ?? []) {
    const home = g.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p && p.away === null && !p.downed);
    if (!home.length) continue;
    if (g.role === 'rangers') {
      const meat = Math.round(home.length * RANGER_MEAT);
      const hide = Math.floor(home.length * RANGER_HIDE);
      depositNear(s, campXY(s), { meat, hide });
      note(g, `Day ${day(s)}: brought home ${meat} meat${hide ? ` and ${hide} hide` : ''}.`);
    } else if (g.role === 'merchants') {
      const leader = s.people.find((p) => p.id === g.leader);
      const coins = home.length * MERCHANT_DUES + Math.floor((leader?.skills.social.level ?? 0) * MERCHANT_PER_SOCIAL);
      s.coins = (s.coins ?? 0) + coins;
      earn(s, 'trade', coins);
      note(g, `Day ${day(s)}: paid ${coins} coins into the treasury.`);
    }
  }
}

/** The town fills a role it lacks: someone starts a guild for it, or the council votes on one. */
export function foundGuild(s: GameState, role: GuildRole, rng: Rng, how?: 'person' | 'council'): Guild | null {
  const def = GUILD_ROLE_DEFS[role];
  const fit = candidates(s, role);
  if (fit.length < MEMBERS_LEAST) return null;
  s.lastGuild = s.tick;
  const grown = grownAtHome(s);
  const byCouncil = how ? how === 'council' : grown.length >= COUNCIL_PEOPLE && !!s.politics && rng.chance(COUNCIL_SHARE);
  let votes: { for: number; against: number } | undefined;
  if (byCouncil) {
    votes = { for: 0, against: 0 };
    for (const p of grown) {
      const bloc = blocOf(s, p);
      if (!bloc) continue;
      if (bloc === def.bloc || fitFor(p, role) > 0 || (p.morale >= 55 && rng.chance(0.5))) votes.for++;
      else votes.against++;
    }
    if (votes.for <= votes.against) {
      tellStory(s, `The council votes down a guild for ${def.role}`, `The council sat late over whether the town should have a guild for ${def.role}. ${votes.for} were for it and ${votes.against} against, and it fell. The talk will come round again.`, 'town hall crowd council vote', { quiet: false });
      return null;
    }
  }
  const leader = fit[0];
  const g: Guild = { id: Math.max(0, ...(s.guilds ?? []).map((x) => x.id)) + 1, role, name: guildName(s, role, rng), leader: leader.id, members: [], founded: s.tick, by: byCouncil ? 'council' : 'person', founder: byCouncil ? undefined : leader.id, votes, log: [] };
  (s.guilds ??= []).push(g);
  for (const p of fit.slice(0, role === 'elite' ? ELITE_MOST : MEMBERS_MOST)) join(s, g, p);
  const names = g.members.filter((id) => id !== leader.id).map((id) => s.people.find((p) => p.id === id)!.name);
  const with_ = names.length ? `${names.slice(0, -1).join(', ')}${names.length > 1 ? ' and ' : ''}${names[names.length - 1]}` : 'nobody yet';
  note(g, `Day ${day(s)}: founded${byCouncil ? ' by the council\'s vote' : ` by ${leader.name}`}.`);
  const story = byCouncil
    ? `The town has been short of ${def.role}, and the council put it to a vote: ${votes!.for} for, ${votes!.against} against. It carries. They ask ${leader.name}, the best of them at it, to lead, and ${with_} stand with them. Round the fire that night the town settles on a name: ${g.name}.\n\n${def.perk}`
    : role === 'elite'
      ? `${leader.name} has seen the raids come and the dead carried home, and has had enough of it. Quietly, they pick the hardest fighters the town has (${with_}) and train them apart from the rest, for the worst of the fighting. The town talks of nothing else, and by morning everyone is calling them ${g.name}.\n\n${def.perk}`
      : `${leader.name} has seen what the town lacks: ${def.role}. Nobody asked them to, but they gather those who are good at it (${with_}) and set to it together. The town gives them a name before they've chosen one: ${g.name}.\n\n${def.perk}`;
  tellStory(s, `A new ${role === 'elite' ? 'squad' : 'guild'}: ${g.name}`, story, def.words, { who: leader.id });
  return g;
}

/* ------------------------------------------------------------ the menu */

export interface GuildView {
  id: number;
  name: string;
  role: GuildRole;
  what: string;
  perk: string;
  leader: { id: number; name: string } | null;
  members: { id: number; name: string; lead: boolean; level: number }[];
  founded: number;
  by: string;
  log: string[];
}

export function guildsView(s: GameState): GuildView[] {
  return (s.guilds ?? []).map((g) => {
    const ms = g.members.map((id) => s.people.find((p) => p.id === id)).filter((p): p is Person => !!p);
    const leader = ms.find((p) => p.id === g.leader);
    return {
      id: g.id,
      name: g.name,
      role: g.role,
      what: GUILD_ROLE_DEFS[g.role].role,
      perk: GUILD_ROLE_DEFS[g.role].perk,
      leader: leader ? { id: leader.id, name: leader.name } : null,
      members: ms.map((p) => ({ id: p.id, name: p.name, lead: p.id === g.leader, level: levelOf(p) })),
      founded: Math.floor(g.founded / TICKS_PER_DAY) + 1,
      by: g.by === 'council' ? `voted in by the council${g.votes ? ` (${g.votes.for} to ${g.votes.against})` : ''}` : `founded by ${s.people.find((p) => p.id === g.founder)?.name ?? 'one long gone'}`,
      log: g.log,
    };
  });
}
