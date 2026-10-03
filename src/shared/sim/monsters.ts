// Monster townsfolk and the Hunter's Guild (DESIGN §7, §10). Werewolves maul someone on full-moon nights;
// vampires feed on a sleeper every couple of days. While monsters live in town the Guild's hostility grows,
// and past a point hunters come for one of them: give them up, try to hide them, or fight. Each monster's
// standing order is the answer when nobody's there to choose.

import {
  BITE_DAMAGE,
  FEED_HOURS,
  GUILD_BITE,
  THIRST_BITES,
  FULL_MOON_DAYS,
  GUILD_DECAY_DAY,
  GUILD_PER_MONSTER_DAY,
  GUILD_THRESHOLD,
  HIDE_BASE,
  HIDE_PER_SOCIAL,
  MAUL_DAMAGE,
  PACK_HUNT_MEAT,
  THIRST_HP_PER_HOUR,
  type MonsterKind,
  type StandingOrder,
} from '../data/monsters';
import { RAID_KIND_BY_ID } from '../data/raids';
import { BUILDING_BY_ID } from '../data/buildings';
import { drinkBlood, tithed } from './vampires';
import { GUILD_THRESHOLD as GUILD_CALL, TITHE_MORALE } from '../data/monsters';
import type { Rng } from '../rng';
import { grieve } from './social';
import { depositNear } from './buildings';
import { maxHp, notify, type GameState, type Person } from './state';
import { calendar, TICKS_PER_HOUR } from './time';

const inTown = (s: GameState) => s.people.filter((p) => p.away === null);
export const monsters = (s: GameState) => s.people.filter((p) => p.monster);

/** Make a newcomer a monster. */
export function becomeMonster(s: GameState, p: Person, kind: MonsterKind): void {
  p.monster = kind;
  p.order = 'hide';
  p.lastFed = s.tick;
  p.hp = maxHp(p);
}

/** The moon's phase on a day's night, 0..FULL_MOON_DAYS-1 through the cycle; the last is the full moon. */
export const moonPhaseOf = (day: number) => (((day - 1) % FULL_MOON_DAYS) + FULL_MOON_DAYS) % FULL_MOON_DAYS;
export const FULL_MOON_PHASE = FULL_MOON_DAYS - 1;

/** Whose night it is: the small hours belong to the evening before (so the moon keeps its phase all night). */
export function nightDay(tick: number): number {
  const c = calendar(tick);
  return c.hour < 12 ? c.day - 1 : c.day;
}

/** Full moon tonight? */
export const fullMoon = (s: GameState) => moonPhaseOf(calendar(s.tick).day) === FULL_MOON_PHASE;

/** The founder is a werewolf, at home (hidden: the Moon Rite). */
export const packLeader = (s: GameState) => s.people.some((p) => p.id === s.mainId && p.monster === 'werewolf' && p.away === null);

/** A wolf pack comes to a werewolf founder's town: two of every three run with their own kind now (never the
 *  alpha: it comes to challenge them). */
export function runWithThePack(s: GameState, raiders: { kind: string; ally?: boolean }[]): void {
  if (!packLeader(s)) return;
  let joined = 0;
  raiders.forEach((r, i) => {
    if (r.kind === 'wolf' && i % 3 !== 2) {
      r.ally = true;
      joined++;
    }
  });
  if (joined) notify(s, `The wolves catch the founder's scent: ${joined === 1 ? 'one of the pack runs' : `${joined} of the pack run`} with the town now.`, true);
}

/** Once an hour: moonlit rampages, feeding, and the Guild's mood. */
export function updateMonsters(s: GameState, rng: Rng, startGuildRaid: (target: Person) => void): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const hour = calendar(s.tick).hour;
  let packHunted = false;
  for (const m of monsters(s)) {
    if (m.away !== null || m.downed) continue;
    // (monsters prey only on the living)
    const victims = inTown(s).filter((p) => p !== m && !p.downed && !p.monster);
    // a werewolf on the full moon: mauls someone living, or (with none left) the pack goes hunting
    if (m.monster === 'werewolf' && hour === 23 && fullMoon(s)) {
      if (victims.length) {
        const v = rng.pick(victims);
        v.hp = Math.max(1, v.hp - MAUL_DAMAGE);
        notify(s, `Under the full moon, ${m.name} went feral and mauled ${v.name}!`, true);
      } else {
        depositNear(s, m.x, { meat: PACK_HUNT_MEAT });
        packHunted = true;
      }
    }
    // a vampire, hungry, in the small hours: a sleeper, a prisoner, or nobody (and then they thirst)
    if (m.monster === 'vampire' && hour === 2 && s.tick - (m.lastFed ?? 0) >= FEED_HOURS * TICKS_PER_HOUR) {
      // the quiet ways first (the owner's ask: a hidden vampire has ways to feed): the town's tithe, a prisoner, a
      // beast of the pens, a stranger lodging at the tavern; townsfolk last, and that stirs the town and the Guild
      const pen = s.buildings.find((b) => b.status === 'done' && (b.herd?.head ?? 0) >= 2);
      const lodger = (s.travellers ?? []).find((t) => t.bed);
      const sleepers = victims.filter((p) => p.activity === 'sleep');
      if (drinkBlood(s)) {
        m.lastFed = s.tick;
      } else if (tithed(s)) {
        m.lastFed = s.tick;
      } else if (s.prisoners.length) {
        m.lastFed = s.tick;
        notify(s, `${m.name} fed on a prisoner in the night.`);
      } else if (pen) {
        m.lastFed = s.tick;
        if (rng.chance(0.3)) pen.herd!.head--;
        notify(s, `A beast in the ${BUILDING_BY_ID[pen.def].name} was found drained in the morning.`);
      } else if (lodger) {
        m.lastFed = s.tick;
        lodger.purse = Math.round(lodger.purse * 0.5);
        notify(s, `${lodger.name} left the tavern pale and shaken, and told nobody why.`);
      } else if (victims.length) {
        const v = rng.pick(sleepers.length ? sleepers : victims);
        v.hp = Math.max(1, v.hp - BITE_DAMAGE);
        m.lastFed = s.tick;
        s.guild = Math.min(100, (s.guild ?? 0) + GUILD_BITE);
        s.bites = (s.bites ?? 0) + 1;
        notify(s, `${v.name} woke pale and weak. Something fed on them in the night.`, true);
        if (s.bites >= THIRST_BITES && !s.prompts.some((q) => q.kind === 'thirst')) askThirst(s, m);
      }
    }
    // with no blood to be had, a vampire weakens
    if (m.monster === 'vampire' && s.tick - (m.lastFed ?? s.tick) > FEED_HOURS * 1.5 * TICKS_PER_HOUR) m.hp = Math.max(1, m.hp - THIRST_HP_PER_HOUR);
  }
  if (packHunted) notify(s, 'Under the full moon the pack ran down game in the hills and brought back meat.');
  // the Guild, once a day
  if (hour !== 12) return;
  // (a pack is no business of the Guild's: the Moon Pack's werewolves don't count)
  const n = monsters(s).filter((m) => !(m.monster === 'werewolf' && s.origin === 'werewolf')).length;
  s.guild = Math.max(0, Math.min(100, (s.guild ?? 0) + (n ? n * GUILD_PER_MONSTER_DAY : -GUILD_DECAY_DAY)));
  if (n && (s.guild ?? 0) >= GUILD_THRESHOLD && !s.raid) {
    const target = rng.pick(monsters(s).filter((m) => m.away === null));
    if (target) startGuildRaid(target);
  }
}

/** The Guild's demand, as prompt options (the default follows the monster's standing order). */
export function guildOptions(target: Person): { options: string[]; defaultOption: number } {
  const options = [`Give up ${target.name}`, 'Hide them', 'Fight'];
  const order: StandingOrder = target.order ?? 'hide';
  return { options, defaultOption: order === 'give_up' ? 0 : order === 'hide' ? 1 : 2 };
}

/** Answer the Guild. Returns true if the hunters leave (the raid is called off). */
export function answerGuild(s: GameState, label: string, rng: Rng): boolean {
  const target = s.people.find((p) => p.id === s.guildTarget);
  if (!target) return true;
  if (label.startsWith('Give up')) {
    s.people = s.people.filter((p) => p !== target);
    grieve(s, target);
    s.guild = Math.max(0, (s.guild ?? 0) - 40);
    notify(s, `${target.name} was handed over to the Hunter's Guild.`, true);
    return true;
  }
  if (label.startsWith('Hide')) {
    const social = Math.max(1, ...inTown(s).map((p) => p.skills.social.level));
    if (rng.chance(HIDE_BASE + social * HIDE_PER_SOCIAL)) {
      s.guild = Math.max(0, (s.guild ?? 0) - 15);
      notify(s, `The hunters searched the town and found nothing. ${target.name} stays hidden.`, true);
      return true;
    }
    notify(s, `The hunters found ${target.name}! They attack.`, true);
    return false;
  }
  return false; // fight
}

/** After a Guild raid the hunters beat back: they'll be angrier next time. */
export function guildDefeated(s: GameState): void {
  s.guild = Math.min(100, (s.guild ?? 0) + 20);
  s.guildTarget = null;
  notify(s, "The Guild's hunters were driven off. They will come back in greater numbers.", true);
}

export const HUNTERS = RAID_KIND_BY_ID.hunters;

/* ------------------------------------------------------------ a thirst in the dark */

export const THIRST_OPTIONS = ['Keep a blood tithe', 'Call the Hunter\'s Guild', 'Say nothing'];

/** After enough bites the town speaks of it: a prompt. The default follows the vampire's standing order (one in
 *  hiding would rather the town kept a tithe than called the hunters). */
function askThirst(s: GameState, m: Person): void {
  s.prompts.push({
    id: s.nextId++,
    kind: 'thirst',
    expedition: null,
    title: 'A thirst in the dark',
    text: 'Someone wakes pale and weak most mornings, and the town whispers of a vampire. A blood tithe (everyone gives a little, in turn) would keep it fed and the biting would stop; the Hunter\'s Guild would come hunting; or say nothing, and let it feed as it will.',
    options: THIRST_OPTIONS,
    defaultOption: m.order === 'fight' ? 2 : 0,
    expiresTick: s.tick + 12 * TICKS_PER_HOUR,
  });
}

/** The town's answer: a tithe (its vampires fed cleanly from now on, a little morale off everyone), the Guild called
 *  (the hunters come at the next noon), or nothing said (the bites go on, and the town speaks of it again later). */
export function answerThirst(s: GameState, label: string): void {
  s.bites = 0;
  if (label === THIRST_OPTIONS[0]) {
    s.tithe = true;
    for (const p of s.people) if (!p.monster) p.morale = Math.max(0, p.morale + TITHE_MORALE);
    notify(s, 'The town keeps a blood tithe: a little from each, in turn, and nobody wakes pale again.', true);
  } else if (label === THIRST_OPTIONS[1]) {
    s.guild = Math.max(s.guild ?? 0, GUILD_CALL);
    notify(s, 'Word is sent to the Hunter\'s Guild. Hunters are coming.', true);
  } else notify(s, 'Nothing is said. The pale mornings go on.');
}
