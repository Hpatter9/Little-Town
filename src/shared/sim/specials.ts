// Special newcomers and their secrets (data/specials.ts; the owner's ask). A wanderer may be one of them: they come to
// the gate under a cover story, and once taken in their secret runs its course. Each evening the town's suspicions come
// to a head: a townsperson with the skill to see through them may (`spot`), or they give themselves away (`slip`).
// Found out, the town is asked what to do (a prompt of kind `secret`, shown full screen like an event). Left hidden, the
// secret strikes on its own when it's due: the champion's hunter comes, the pilgrim's fever spreads, the cursed knight's
// ill luck sets a fire, bounty hunters come for the highwayman, the saboteur cuts the gate's bar and springs the traps
// on the night before his clan rides in (a guard on watch may catch him at it), the exile's power breaks loose, the
// crown's riders take their heir home. Everything here draws on its own seeded stream, so it never shifts the town's.

import { CATCH_BASE, CATCH_PER_LEVEL, CURSE_DAILY, CURSE_PRICE, HEIR_REWARD, BOUNTY, SPECIALS, SPECIAL_IDS, SPECIAL_ODDS, SPOT_BASE, SPOT_HOUR, SPOT_MOST, SPOT_PER_LEVEL, SURGE_DAILY, THEFT_A_DAY, type SpecialDef, type SpecialId } from '../data/specials';
import { RAID_KIND_BY_ID, type RaidKind } from '../data/raids';
import { ENEMIES } from '../data/enemies';
import { BUILDING_BY_ID } from '../data/buildings';
import { TOPIC_BY_ID, TOPICS } from '../data/research';
import { xpToNext, type Skill } from '../data/skills';
import { stageOf } from '../data/levels';
import { isSeat } from '../data/seats';
import type { ClassId } from '../data/classes';
import { hashSeed, mixSeed, Rng } from '../rng';
import { earn, notify, tireless, type GameState, type Person, type Raid } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { raidBudget, raidKindsFor, scheduleNextRaid, startRaid } from './raids';
import { rulesOf } from '../data/origins';
import { isChild } from './social';
import { sicken } from './doom';
import { setFire } from './fire';
import { minorWound } from './injuries';
import { canQueue } from './research';
import { assignBeds, gainSkill } from './townsfolk';
import { take } from './events';

const def = (p: Person): SpecialDef => SPECIALS[p.secret!.id];
const named = (text: string, p: Person) => text.replace(/\{name\}/g, p.name);
const grownUps = (s: GameState) => s.people.filter((q) => q.away === null && !q.downed && !isChild(q));
const hours = (h: number) => Math.round(h * TICKS_PER_HOUR);
const streamOf = (s: GameState, p: Person, salt: number) => Rng.from(hashSeed(s.seed), p.id, s.tick, salt);
const mark = (s: GameState, value: number, h: number, text: string) => (s.marks ??= []).push({ lever: 'morale', value, until: s.tick + hours(h), text });

/* ------------------------------------------------------------ at the gate */

/** Whether this event's turn brings a secret stranger to the gate (1 in `SPECIAL_ODDS`; by the seed and the hour, so
 *  no draw from the town's stream). */
export const strangerTurn = (s: GameState) => mixSeed(hashSeed(s.seed), s.tick, 0x5ec2e7) % SPECIAL_ODDS === 0;

/** Which special a newcomer is: one the town hasn't met (each comes once; secrets may overlap). Never to a town of the
 *  dead or of machines (whose newcomers are remade), and the fever never to one who can't sicken. */
export function specialFor(s: GameState, p: Person): SpecialId | null {
  if (p.monster) return null;
  const kin = rulesOf(s).kin;
  if (kin && kin !== 'werewolf') return null;
  const left = SPECIAL_IDS.filter((id) => !(s.specialsSeen ?? []).includes(id) && !(id === 'plague' && tireless(p)));
  return left.length ? left[mixSeed(hashSeed(s.seed), p.id, 0x5ec2e7) % left.length] : null;
}

const SKILLS: Record<SpecialId, Partial<Record<Skill, number>>> = {
  veiled: { melee: 24, ranged: 10 },
  plague: { medicine: 2, gathering: 4 },
  cursed: { melee: 18, construction: 4 },
  outlaw: { social: 14, ranged: 9, gathering: 6 },
  saboteur: { gathering: 7, ranged: 8, melee: 6 },
  archmage: { research: 24, medicine: 6 },
  heir: { social: 9, research: 5 },
};
const LEVEL: Record<SpecialId, number> = { veiled: 36, plague: 2, cursed: 20, outlaw: 9, saboteur: 6, archmage: 32, heir: 1 };
const CALLING: Partial<Record<SpecialId, ClassId[]>> = { veiled: ['knight', 'samurai', 'warrior'], cursed: ['knight'], outlaw: ['assassin'], archmage: ['mage'] };

/** Make a wanderer the special they are: their skills, level and calling, and the secret they carry. */
export function makeSpecial(s: GameState, p: Person, id: SpecialId): void {
  const d = SPECIALS[id];
  p.type = d.type;
  for (const [k, n] of Object.entries(SKILLS[id]) as [Skill, number][]) p.skills[k].level = Math.max(p.skills[k].level, n);
  p.level = Math.max(p.level ?? 1, LEVEL[id]);
  const calls = CALLING[id];
  if (calls) p.cls = calls[p.id % calls.length];
  p.stageSeen = stageOf(p); // (nothing to announce: they came this way)
  p.secret = { id };
  (s.specialsSeen ??= []).push(id);
}

/** How the gate sees them. */
export const coverOf = (p: Person) => `a wanderer, ${def(p).cover}`;

/** Taken in: the secret's clock starts. */
export function secretJoined(s: GameState, p: Person): void {
  const sec = p.secret;
  if (!sec || sec.joined !== undefined) return;
  const [lo, hi] = def(p).due;
  sec.joined = s.tick;
  sec.due = s.tick + hours(lo + (mixSeed(hashSeed(s.seed), p.id, 0xd0e) % (hi - lo + 1)));
}

/** A saboteur's work undone, until: the towers and traps stand silent (rivals.ts turretsDown). */
export const sabotaged = (s: GameState) => (s.sabotage ?? 0) > s.tick;

/* ------------------------------------------------------------ hour by hour */

export function specialsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const hour = calendar(s.tick).hour;
  for (const p of [...s.people]) {
    const sec = p.secret;
    if (!sec || sec.settled || sec.joined === undefined || p.away !== null) continue;
    const rng = streamOf(s, p, 0x51);
    ongoing(s, p, rng, hour);
    if (!s.people.includes(p) || sec.settled) continue;
    if (!sec.struck && sec.due !== undefined && s.tick >= sec.due && strike(s, p, rng, hour)) continue;
    if (sec.found || hour !== SPOT_HOUR) continue;
    const need = def(p).spot;
    const spotter = grownUps(s)
      .filter((q) => q !== p)
      .sort((a, b) => b.skills[need.skill].level - a.skills[need.skill].level)[0];
    const lvl = spotter?.skills[need.skill].level ?? 0;
    if (spotter && lvl >= need.level && rng.chance(Math.min(SPOT_MOST, SPOT_BASE + (lvl - need.level) * SPOT_PER_LEVEL))) reveal(s, p, `${spotter.name} ${need.how}.`);
    else if (rng.chance(def(p).slip)) reveal(s, p, named(def(p).slipText, p));
  }
}

/** What a secret does while it runs: the curse's ill luck, the highwayman's light fingers, the exile's surges, and a
 *  champion who can't help fighting like one. */
function ongoing(s: GameState, p: Person, rng: Rng, hour: number): void {
  const sec = p.secret!;
  const id = sec.id;
  // (the cursed knight kept on: the ill luck goes on, half as often)
  if (id === 'cursed' && hour === 6 && (!sec.found || sec.choice === 1) && rng.chance(CURSE_DAILY * (sec.found ? 0.5 : 1))) {
    const others = grownUps(s).filter((q) => q !== p);
    const roll = rng.next();
    if (roll < 0.45 && others.length) {
      const hurt = rng.pick(others);
      hurt.hp = Math.max(1, hurt.hp - 12);
      minorWound(s, hurt, 12, rng);
      notify(s, `A beam fell where ${hurt.name} was working.${sec.found ? ` ${p.name}'s curse.` : ' Bad luck, people say.'}`, true);
    } else if (roll < 0.8) {
      const n = take(s, 'food', 0.06);
      if (n) notify(s, `${n} food spoiled overnight in the stores, for no reason anyone can find.`, true);
    } else notify(s, `Every tool in the sawpit snapped at once. Nobody was near them.`, true);
    mark(s, -3, 12, 'Ill luck dogs the town');
  }
  // (the highwayman's light fingers, while nobody knows)
  if (id === 'outlaw' && hour === 3 && !sec.found && (s.coins ?? 0) > 0) {
    const n = Math.min(s.coins ?? 0, rng.int(THEFT_A_DAY[0], THEFT_A_DAY[1]));
    s.coins = (s.coins ?? 0) - n;
    earn(s, 'events', -n);
    sec.stolen = (sec.stolen ?? 0) + n;
    if (n) notify(s, `The treasury came up ${n} coins short this morning.`);
  }
  // (the exile's power, untamed)
  if (id === 'archmage' && hour === 14 && !sec.found && rng.chance(SURGE_DAILY)) {
    if (rng.chance(0.5)) {
      const topic = s.research.queue[0];
      const t = topic ? TOPIC_BY_ID[topic] : undefined;
      if (t) s.research.progress[topic] = Math.min(0.99, (s.research.progress[topic] ?? 0) + 0.25);
      notify(s, `The candles in ${p.name}'s window burned blue all afternoon${t ? `, and the scholars woke with ${t.name} clear in their heads` : ''}.`, true);
    } else {
      const can = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && !isSeat(b.def));
      if (can.length) setFire(s, rng.pick(can), true);
      notify(s, 'A ball of blue fire rolled out of a clear sky and into a roof.', true);
    }
    if (rng.chance(0.5)) reveal(s, p, named(def(p).slipText, p));
  }
  // (a champion in a fight fights like one)
  if (id === 'veiled' && !sec.found && s.raid?.phase === 'active' && rng.chance(0.4))
    reveal(s, p, `In the raid ${p.name} cut through the raiders like a scythe through barley, and the townsfolk who saw it will never forget it. Nobody fights like that who was not trained for it all their life.`);
}

/** The secret's day comes. False if it waits (for a raid to end, or for the night). */
function strike(s: GameState, p: Person, rng: Rng, hour: number): boolean {
  const sec = p.secret!;
  // (found out, and the town not yet asked what it will do: the secret waits on the answer)
  if (sec.found && sec.choice === undefined && s.prompts.some((q) => q.kind === 'secret' && q.who === p.id)) return false;
  switch (sec.id) {
    case 'veiled': {
      if (s.raid) return false;
      const raid = menRaid(s, rng, 1.25, `The hunter has come for ${p.name}!`, `${p.name}'s old enemy is coming, with everyone who still follows them.`);
      const boss = HUNTER[s.era] ?? 'black_knight';
      const first = raid.raiders[0];
      raid.raiders.push({ ...first, id: s.nextId++, kind: boss, hp: ENEMIES[boss].hp, maxHp: ENEMIES[boss].hp, goal: 'harm', x: first.x + raid.side * 30, carrying: {} });
      notify(s, `${ENEMIES[boss].name} leads them. They have come for ${p.name}.`, true);
      sec.struck = true;
      if (!sec.found) reveal(s, p, `${ENEMIES[boss].name} has come to the town at the head of an army, and calls one name: ${p.name}.`);
      else sec.settled = true;
      return true;
    }
    case 'plague': {
      if (sec.found) return (sec.settled = true);
      sicken(s, p, rng);
      const pool = grownUps(s).filter((q) => q !== p);
      const n = Math.min(pool.length, 2 + rng.int(0, 1));
      const sick: string[] = [];
      for (let i = 0; i < n; i++) {
        const q = pool.splice(Math.floor(rng.next() * pool.length), 1)[0];
        sicken(s, q, rng);
        sick.push(q.name);
      }
      sec.struck = true;
      reveal(s, p, `${p.name} is burning with fever, and so ${sick.length === 1 ? 'is' : 'are'} ${sick.join(' and ') || 'nobody else, yet'}. The healer knows this sickness: it came in with them.`);
      return true;
    }
    case 'cursed': {
      if (sec.found) return (sec.settled = true);
      const can = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && !isSeat(b.def));
      const b = can.length ? rng.pick(can) : undefined;
      if (b) setFire(s, b, true);
      sec.struck = true;
      reveal(s, p, `Fire broke out in the ${b ? (BUILDING_BY_ID[b.def]?.name.toLowerCase() ?? 'roof') : 'yard'} in the dead of night, from nothing, and the black knight ${p.name} stood watching it with their head bowed. They told the town then.`);
      return true;
    }
    case 'outlaw': {
      if (s.raid) return false;
      if (sec.found && sec.choice !== 1) return (sec.settled = true);
      menRaid(s, rng, 0.85, 'Bounty hunters!', `Hard men with crossbows and a wanted poster: they want Red Jack, and they will take the town apart to find them.`);
      sec.struck = true;
      if (!sec.found) reveal(s, p, `Bounty hunters rode up to the gate with a wanted poster nailed to a pole: RED JACK, THE HIGHWAYMAN. The face was ${p.name}'s.`);
      else sec.settled = true;
      return true;
    }
    case 'saboteur': {
      // (he waits for the dead of night, and for the town to be quiet)
      if (s.raid || hour < 1 || hour > 4) return false;
      if (sec.found) {
        // (locked up or turned: the town knew; see answerSecret)
        sec.settled = true;
        return true;
      }
      const watch = grownUps(s).filter((q) => q.guard && q !== p);
      const best = watch.sort((a, b) => fighting(b) - fighting(a))[0];
      if (best && rng.chance(CATCH_BASE + fighting(best) * CATCH_PER_LEVEL)) {
        sec.struck = true;
        reveal(s, p, `${best.name}, on watch at the gate, heard a saw in the dark and found ${p.name} with the gate's bar half cut through and a coil of rope over one shoulder.`);
        // (his clan comes anyway: they are already on the road)
        s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + hours(8));
        return true;
      }
      // the night's work: the gates' bars cut, the traps sprung, the towers' strings slit; then he's gone
      let gates = 0;
      for (const b of s.buildings) if (b.status === 'done' && /gate/.test(b.def) && BUILDING_BY_ID[b.def]?.hp) ((b.hp = 0), gates++);
      s.sabotage = s.tick + hours(14);
      s.people = s.people.filter((q) => q !== p);
      assignBeds(s);
      sec.struck = sec.found = sec.settled = true;
      notify(s, `Before dawn the town woke to find ${gates ? 'the gate standing open, its bar sawn through, ' : ''}the traps sprung and the bowstrings on the towers cut. ${p.name} is gone. They were never a refugee: they were sent.`, true);
      const raid = menRaid(s, rng, 1.2, `${p.name}'s clan is at the gate!`, `They came out of the dark the moment the traps were sprung. There is no time.`);
      raid.arrivesTick = s.tick + Math.round(TICKS_PER_HOUR / 12);
      const prompt = s.prompts.find((q) => q.id === raid.prompt);
      if (prompt) prompt.expiresTick = raid.arrivesTick;
      return true;
    }
    case 'archmage': {
      if (sec.found) return (sec.settled = true);
      const can = s.buildings.filter((b) => b.status === 'done' && b.fire === undefined && b.def !== 'campfire' && !isSeat(b.def));
      for (let i = 0; i < 2 && can.length; i++) setFire(s, can.splice(Math.floor(rng.next() * can.length), 1)[0], true);
      sec.struck = true;
      reveal(s, p, `In the night the sky over ${p.name}'s window split open. Fire fell on two roofs, and the old scholar stood in the street with their hands raised, holding the rest of it back, weeping.`);
      return true;
    }
    case 'heir': {
      if (sec.found && sec.choice !== 1) return (sec.settled = true);
      sec.struck = sec.settled = true;
      if (sec.found && rng.chance(0.5)) {
        notify(s, `The crown's riders came and searched every house. They did not find ${p.name}, hidden under the hay in the barn, and rode on.`, true);
        gain(p, 'social', 2);
        mark(s, 4, 24, `We hid ${p.name} from the crown`);
      } else {
        leave(s, p);
        notify(s, `The crown's riders came, in silver and blue. They found ${p.name}${sec.found ? ' in the barn' : ''}, put them on a white horse, and rode away without a word of thanks.`, true);
        if (sec.found) mark(s, -6, 48, `The riders took ${p.name}`);
      }
      return true;
    }
  }
}

/** The fighting skill a guard brings to the watch. */
const fighting = (p: Person) => Math.max(p.skills.melee.level, p.skills.ranged.level);

/** The era's champion of the hunt. */
const HUNTER: Partial<Record<GameState['era'], string>> = { neolithic: 'black_knight', medieval: 'black_knight', industrial: 'iron_baron', modern: 'warlord', space: 'pirate_king' };

/** A raid of people, of the age's kind, now (out of turn: the next ordinary raid is put back). */
function menRaid(s: GameState, rng: Rng, budget: number, title: string, text: string): Raid {
  const open = raidKindsFor(s.era, 999).map((k) => k.id);
  const id = ['pirates', 'army', 'marauders', 'gang', 'bandits', 'warband', 'rivals'].find((k) => open.includes(k)) ?? 'rivals';
  const kind: RaidKind = RAID_KIND_BY_ID[id];
  const raid = startRaid(s, kind, Math.round(raidBudget(s) * budget), rng);
  const prompt = s.prompts.find((q) => q.id === raid.prompt);
  if (prompt) {
    prompt.title = title;
    prompt.text = `${text} ${prompt.text}`;
  }
  scheduleNextRaid(s, rng);
  return raid;
}

/* ------------------------------------------------------------ found out */

/** The town finds out: the question of what to do (shown full screen, with the picture), unless it's already over. */
function reveal(s: GameState, p: Person, how: string): void {
  const sec = p.secret!;
  const d = def(p);
  sec.found = true;
  const truth = named(d.truth, p);
  const options = d.options.map((o, i) => (sec.id === 'cursed' && i === 0 && (s.coins ?? 0) < CURSE_PRICE ? `${o.replace(/ \(\d+ coins\)/, '')} (the treasury has ${s.coins ?? 0})` : o));
  notify(s, `${d.name}: ${how}`, true);
  s.prompts.push({
    id: s.nextId++,
    kind: 'secret',
    expedition: null,
    title: d.name,
    text: `${how} ${truth}`,
    story: `${how} ${truth} What will the town do?`,
    picture: d.picture,
    who: p.id,
    options,
    defaultOption: sec.id === 'cursed' && (s.coins ?? 0) < CURSE_PRICE ? 1 : 0,
    expiresTick: s.tick + hours(12),
  });
}

const leave = (s: GameState, p: Person) => {
  s.people = s.people.filter((q) => q !== p);
  assignBeds(s);
};
const gain = (p: Person, k: Skill, levels: number) => {
  let xp = 0;
  for (let i = 0; i < levels; i++) xp += xpToNext(p.skills[k].level + i);
  gainSkill(p, k, Math.max(0, xp - p.skills[k].xp));
};
const coins = (s: GameState, n: number) => {
  s.coins = (s.coins ?? 0) + n;
  earn(s, 'events', n);
};

/** The town's answer, once it knows. */
export function answerSecret(s: GameState, who: number | undefined, option: number): void {
  const p = s.people.find((q) => q.id === who);
  const sec = p?.secret;
  if (!p || !sec) return;
  sec.choice = option;
  const rng = streamOf(s, p, 0xa5);
  const say = (text: string) => notify(s, `${def(p).name}: ${text}`, true);
  switch (sec.id) {
    case 'veiled':
      if (option === 0) {
        for (const q of grownUps(s)) if (q !== p) gain(q, 'melee', 1);
        mark(s, 5, 48, `We stand with ${p.name}`);
        say(`the town stands with ${p.name}, and ${p.name} teaches everyone who will learn how to hold a blade (+1 Melee each).${sec.struck ? '' : ' The hunter will come.'}`);
        if (sec.struck) sec.settled = true;
      } else if (option === 1) {
        leave(s, p);
        coins(s, 80);
        sec.settled = true;
        say(`${p.name} bows, leaves a heavy purse on the table (80 coins), and is gone before dawn.${sec.struck ? ' The hunter came anyway.' : ' Their hunter will follow them, not the town.'}`);
      } else {
        leave(s, p);
        s.reputation = Math.max(0, s.reputation - 2);
        mark(s, -6, 48, `We gave ${p.name} to their hunter`);
        sec.settled = true;
        say(`word is sent. ${p.name} does not run. They walk out to meet the hunter alone, and do not come back.`);
      }
      return;
    case 'plague':
      sec.settled = true;
      if (option === 0) {
        sicken(s, p, rng);
        const nurse = grownUps(s).filter((q) => q !== p).sort((a, b) => b.skills.medicine.level - a.skills.medicine.level)[0];
        if (nurse) gain(nurse, 'medicine', 2);
        mark(s, 3, 24, 'We nursed the sick pilgrim');
        say(`${p.name} is kept apart in a hut of their own${nurse ? `, and ${nurse.name} nurses them, learning much (+2 Medicine)` : ''}. The fever burns out of them, and they stay, grateful.`);
      } else if (option === 1) {
        const n = take(s, 'food', 0.05);
        leave(s, p);
        s.reputation += 1;
        say(`${p.name} is sent on with ${n} food and a blessing. Word of the town's kindness travels.`);
      } else {
        leave(s, p);
        mark(s, -4, 24, 'We drove out the sick');
        say(`${p.name}'s blanket and bundle are burned in the yard, and ${p.name} is driven out at spear point. Nobody else falls sick. Nobody feels good about it.`);
      }
      return;
    case 'cursed':
      if (option === 0 && (s.coins ?? 0) >= CURSE_PRICE) {
        coins(s, -CURSE_PRICE);
        p.level = (p.level ?? 1) + 5;
        sec.settled = true;
        mark(s, 4, 24, 'The black oath is broken');
        say(`a priest and three candles and ${CURSE_PRICE} coins: the oath is unsworn at last. ${p.name} weeps, kneels to the town, and is stronger for it (+5 levels).`);
      } else if (option === 2) {
        leave(s, p);
        sec.settled = true;
        say(`${p.name} rides away alone, and the ill luck goes with them.`);
      } else {
        sec.choice = 1;
        say(`${p.name} stays, curse and all. The ill luck will go on, but half as often now the town knows to watch for it, and nobody fights harder for the town than a knight with nothing left to lose.`);
      }
      return;
    case 'outlaw':
      if (option === 0) {
        leave(s, p);
        coins(s, BOUNTY + (sec.stolen ?? 0));
        s.reputation += 1;
        sec.settled = true;
        say(`${p.name} is handed over in chains. The bounty is paid (${BOUNTY} coins), and the ${sec.stolen ?? 0} coins they took are found sewn into their coat.`);
      } else if (option === 1) {
        coins(s, sec.stolen ?? 0);
        gain(p, 'social', 1);
        if (sec.struck) sec.settled = true;
        say(`the town hides Red Jack. They put back every coin they took (${sec.stolen ?? 0}) and swear off the road.${sec.struck ? '' : ' The bounty hunters will come all the same.'}`);
      } else {
        leave(s, p);
        sec.settled = true;
        say(`the gate is left open one night. In the morning ${p.name} is gone, and so are their debts, and the hunters follow their trail, not the town's.`);
      }
      return;
    case 'saboteur':
      if (option === 0) {
        leave(s, p);
        s.prisoners.push({ id: s.nextId++, enemy: 'bandit', name: p.name, conviction: 0, since: s.tick, hungry: false });
        s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + hours(24));
        mark(s, 3, 24, 'The traitor is caught');
        sec.settled = true;
        say(`${p.name} is put in chains. Their clan will come all the same, but the gate is barred, the traps reset, and the guard doubled.`);
      } else if (option === 1) {
        // (he may be lying: one time in four, the sabotage goes ahead later all the same)
        if (rng.chance(0.75)) {
          s.nextRaidTick = Math.max(s.nextRaidTick, s.tick + hours(72));
          sec.settled = true;
        } else {
          sec.found = false;
          sec.struck = false;
          sec.due = s.tick + hours(48);
        }
        say(`${p.name} sends word to the clan: the town is too strong, the walls too high. The clan turns away, for now, and ${p.name} stays on, watched.`);
      } else {
        leave(s, p);
        s.nextRaidTick = Math.min(s.nextRaidTick, s.tick + hours(12));
        sec.settled = true;
        say(`${p.name} is driven out of the gate. Their clan will not wait now: they are coming, and they are angry.`);
      }
      return;
    case 'archmage':
      sec.settled = true;
      if (option === 0) {
        const r = s.research;
        const id = r.queue[0] ?? TOPICS.find((t) => !r.done.includes(t.id) && canQueue(r, t.id, s.era, s.origin).ok)?.id;
        if (id) {
          delete r.progress[id];
          r.queue = r.queue.filter((q) => q !== id);
          r.done.push(id);
        }
        say(`${p.name} is given the old tower and a free hand. The surges stop: the power has somewhere to go.${id ? ` By morning the town knows ${TOPIC_BY_ID[id]?.name ?? id}.` : ''}`);
      } else if (option === 1) {
        p.level = Math.max(1, (p.level ?? 1) - 15);
        say(`${p.name} binds their own power with a silver chain and a word. They are only an old scholar now (15 levels gone), and they sleep through the night for the first time in years.`);
      } else {
        leave(s, p);
        say(`${p.name} leaves at dawn, and as they go every candle in the town gutters and goes out, then lights again.`);
      }
      return;
    case 'heir':
      if (option === 0) {
        leave(s, p);
        coins(s, HEIR_REWARD);
        for (const b of s.buildings) if (b.shop) b.shop.renown = (b.shop.renown ?? 0) + 3;
        sec.settled = true;
        say(`word goes to the crown. Riders in silver and blue come for ${p.name}, and leave a chest behind (${HEIR_REWARD} coins) and the crown's favour: the shops' renown +3.`);
      } else if (option === 1) {
        coins(s, 60);
        if (sec.struck) sec.settled = true;
        say(`the town keeps ${p.name}'s secret. They sell the ring on the cord for the town's sake (60 coins).${sec.struck ? '' : ' The crown\'s riders are still searching the road.'}`);
      } else if (rng.chance(0.5)) {
        gain(p, 'social', 2);
        sec.settled = true;
        say(`${p.name} thinks for a long while, and chooses to stay: "I would rather be useful here than ornamental there."`);
      } else {
        leave(s, p);
        coins(s, 80);
        sec.settled = true;
        say(`${p.name} chooses to go home, and sends back a purse from the palace (80 coins) with a letter for every child in the town.`);
      }
      return;
  }
}

/** What the town knows of someone's secret (once it does), for the Townsfolk page. */
export function secretView(p: Person): { name: string; text: string } | null {
  const sec = p.secret;
  if (!sec?.found) return null;
  return { name: def(p).name, text: named(def(p).truth, p) };
}

/** Their story: the cover while hidden, the truth once known. */
export const specialStory = (p: Person) => (p.secret ? named(p.secret.found ? def(p).truth : def(p).coverStory, p) : null);
