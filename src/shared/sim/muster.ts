// Sending a party yourself (data/muster.ts; the owner's ask). The player raises a party for a place on the board
// (`raiseParty`): the most seasoned adventurer fit to go steps up to lead (anyone fit, if the town has no adventurer),
// and puts a party together the way the town's own parties form (sim/parties.ts `recruit`), from those willing. The
// player may then add and drop people (`addMember`, `dropMember`, `makeLeader`): some say no (`willing`: hurt or worn
// out, an enemy going, a post to keep, or no stomach for a fight), and are talked round with coins from the treasury
// (`persuade`) or ordered along and resent it (`order`). The leader reads the odds aloud (`oddsLine`); the player
// picks careful or bold, the rations and spare torches (`setMuster`), and sends them (`sendMuster`). A commanded party
// asks a question or two on the road (`crossroads`, answered in `answerCrossroads`), and is debriefed at home
// (`debrief`). While a party is being raised the town forms none of its own.

import { the, The, type Destination } from '../data/expeditions';
import { levelOf } from '../data/levels';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { natureOf } from '../data/natures';
import { PURSE_SCALE } from '../data/shop';
import { ENEMY } from '../data/social';
import { eventPicture } from '../data/eventScenes';
import {
  CROSSROADS_HOURS,
  DEBRIEF_HOURS,
  MOST_CROSSROADS,
  MOST_EXTRA_TORCHES,
  ODDS,
  ORDER_HOURS,
  ORDER_MORALE,
  PERSUADE_BASE,
  PERSUADE_PER_DANGER,
  RATIONS,
  RELUCTANT_SHARE,
  type Rations,
} from '../data/muster';
import type { Rng } from '../rng';
import { ambitionOf } from './ambition';
import { startBattle } from './combat';
import { giveCoins } from './economy';
import { destinationOf, destinationUnlocked, partyCarry, planParty, rolesFor, sendExpedition, STAKES, type SendCheck, type Stakes } from './expeditions';
import { dangerOf, fitToGo, mostFor, partRole, recruit, strengthOf } from './parties';
import { seaTown } from './sea';
import { isChild, opinion } from './social';
import { addStock, earn, maxHp, notify, poolSize, setOutcome, type Expedition, type GameState, type Muster, type Person, type Prompt } from './state';
import { calendar, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';
import { BUILDING_BY_ID } from '../data/buildings';

const byId = (s: GameState, id: number) => s.people.find((p) => p.id === id);
const keepsPost = (s: GameState, p: Person) =>
  s.buildings.find((b) => b.operator === p.id && b.status === 'done' && (!!BUILDING_BY_ID[b.def]?.floor || b.def === 'infirmary' || b.def === 'healers_hut'));
/** A small stable hash: who someone is and where to (so a person's answer about a place doesn't flicker). */
const hash = (a: number, b: string) => {
  let h = a * 2654435761;
  for (let i = 0; i < b.length; i++) h = Math.imul(h ^ b.charCodeAt(i), 16777619);
  return ((h >>> 0) % 1000) / 1000;
};

/** Anyone grown and at home who might be asked along (the founder too: they answer to you). */
export const askable = (s: GameState) => s.people.filter((p) => !isChild(p) && p.away === null && !p.downed);

/** Whether someone will go: null if they will, else why not and what would bring them (null: only an order). */
export function willing(s: GameState, m: Pick<Muster, 'members' | 'agreed' | 'dest'>, p: Person): { why: string; price: number | null } | null {
  if (m.agreed.includes(p.id) || p.id === s.mainId) return null;
  const d = destinationOf(s, m.dest);
  const danger = d ? dangerOf(d) : 0;
  const price = Math.max(1, Math.round((PERSUADE_BASE + danger * PERSUADE_PER_DANGER) * PURSE_SCALE[s.era]));
  if (!fitToGo(s, p)) {
    const why = p.sick ? 'is sick' : p.hp < maxHp(p) * 0.75 ? 'is still hurt' : p.needs.rest < 0.5 ? 'is worn out' : p.needs.food < 0.4 ? 'is hungry' : 'has only just come home';
    return { why, price: null };
  }
  if (p.guard) return { why: 'is on the watch', price: null };
  const post = keepsPost(s, p);
  if (post) return { why: `has the ${BUILDING_BY_ID[post.def]?.name ?? 'post'} to keep`, price: null };
  const enemy = m.members.map((id) => byId(s, id)).find((q) => q && opinion(s, p.id, q.id) <= ENEMY);
  if (enemy) return { why: `won't go anywhere with ${enemy.name}`, price };
  const amb = ambitionOf(p);
  if (danger > 0 && amb !== 'adventurer' && amb !== 'guard' && (amb === 'homebody' || hash(p.id, m.dest) < RELUCTANT_SHARE)) return { why: amb === 'homebody' ? 'would rather stay home' : 'has no stomach for a fight', price };
  return null;
}

/** Raise a party for a place: a leader steps up and gathers those willing. */
export function raiseParty(s: GameState, dest: string): SendCheck {
  const d = destinationOf(s, dest);
  if (!d || !destinationUnlocked(s, d)) return { ok: false, reason: 'Not on the board' };
  const home = askable(s);
  const fit = home.filter((p) => fitToGo(s, p));
  if (!fit.length) return { ok: false, reason: 'Nobody is fit to go' };
  const base: Muster = { dest, leader: 0, members: [], stakes: 'safe', rations: 'normal', torches: 0, horses: true, refused: {}, agreed: [] };
  const free = fit.filter((p) => !p.guard && !keepsPost(s, p) && p.id !== s.mainId);
  // the leader: the most seasoned adventurer fit to go; else whoever is most seasoned; the founder last
  const order = (a: Person, b: Person) => levelOf(b) - levelOf(a) || a.id - b.id;
  const leader = free.filter((p) => ambitionOf(p) === 'adventurer').sort(order)[0] ?? free.sort(order)[0] ?? fit.find((p) => p.id === s.mainId) ?? fit[0];
  base.leader = leader.id;
  const pool = free.filter((p) => willing(s, { ...base, members: [leader.id] }, p) === null);
  const size = Math.max(1, Math.min(mostFor(s, d), Math.max(d.recommendedParty, dangerOf(d) ? 3 : 1)));
  base.members = recruit(s, leader, d, pool.includes(leader) ? pool : [leader, ...pool], size).map((p) => p.id);
  base.stakes = ['bold', 'restless', 'proud'].includes(natureOf(leader).id) ? 'risky' : 'safe';
  s.muster = base;
  return { ok: true };
}

/** Ask someone along: they come, or say why not (kept on the muster for the player to answer). */
export function addMember(s: GameState, id: number): SendCheck {
  const m = s.muster;
  const p = byId(s, id);
  const d = m && destinationOf(s, m.dest);
  if (!m || !p || !d) return { ok: false, reason: 'No party being raised' };
  if (m.members.includes(id)) return { ok: true };
  if (isChild(p) || p.away !== null || p.downed) return { ok: false, reason: `${p.name} can't go` };
  if (m.members.length >= mostFor(s, d)) return { ok: false, reason: `The party is full (${mostFor(s, d)})` };
  const no = willing(s, m, p);
  if (no) {
    m.refused[id] = no;
    return { ok: false, reason: `${p.name} ${no.why}` };
  }
  delete m.refused[id];
  m.members.push(id);
  return { ok: true };
}

export function dropMember(s: GameState, id: number): void {
  const m = s.muster;
  if (!m) return;
  delete m.refused[id];
  if (!m.members.includes(id) || m.members.length <= 1) return;
  m.members = m.members.filter((x) => x !== id);
  if (m.leader === id) m.leader = m.members[0];
}

export function makeLeader(s: GameState, id: number): void {
  const m = s.muster;
  if (m?.members.includes(id)) {
    m.leader = id;
    m.members = [id, ...m.members.filter((x) => x !== id)];
  }
}

/** Talk round someone who said no: the price from the treasury into their purse, and they come. */
export function persuade(s: GameState, id: number): SendCheck {
  const m = s.muster;
  const no = m?.refused[id];
  const p = byId(s, id);
  if (!m || !no || !p) return { ok: false, reason: 'Nobody to talk round' };
  if (no.price === null) return { ok: false, reason: `${p.name} can't be talked round: only an order will do` };
  if ((s.coins ?? 0) < no.price) return { ok: false, reason: `The treasury hasn't ${no.price} coins` };
  s.coins = (s.coins ?? 0) - no.price;
  earn(s, 'wages', -no.price);
  giveCoins(s, p, no.price, `Talked into going to ${the(destinationOf(s, m.dest)?.name ?? 'the trip')}`);
  m.agreed.push(id);
  delete m.refused[id];
  return addMember(s, id);
}

/** Order someone along whatever they say: they go, and resent it for a while. */
export function order(s: GameState, id: number): SendCheck {
  const m = s.muster;
  const p = byId(s, id);
  if (!m || !p || !m.refused[id]) return { ok: false, reason: 'Nobody to order' };
  p.sore = { until: s.tick + ORDER_HOURS * TICKS_PER_HOUR, value: ORDER_MORALE, text: 'Sent out against their will' };
  m.agreed.push(id);
  delete m.refused[id];
  return addMember(s, id);
}

/** How boldly they go and what they pack. */
export function setMuster(s: GameState, change: { stakes?: Stakes; rations?: Rations; torches?: number; horses?: boolean }): void {
  const m = s.muster;
  if (!m) return;
  if (change.stakes) m.stakes = change.stakes;
  if (change.rations) m.rations = change.rations;
  if (change.torches !== undefined) m.torches = Math.max(0, Math.min(MOST_EXTRA_TORCHES, Math.round(change.torches)));
  if (change.horses !== undefined) m.horses = change.horses;
}

export function cancelMuster(s: GameState): void {
  s.muster = undefined;
}

/** The leader's read of the odds, in their words. */
export function oddsLine(s: GameState, m: Muster): string {
  const d = destinationOf(s, m.dest);
  const party = m.members.map((id) => byId(s, id)).filter((p): p is Person => !!p);
  const danger = d ? dangerOf(d) * (m.stakes === 'risky' ? 1.25 : 1) : 0;
  if (!danger) return 'Nothing out there to fear but the road.';
  const ratio = strengthOf(party) / danger;
  return ODDS.find(([at]) => ratio >= at)![1];
}

/** Why the leader picked each member (for the roster). */
export function pickReason(s: GameState, m: Muster, p: Person): string {
  if (p.id === m.leader) return ambitionOf(p) === 'adventurer' ? 'leads: an adventurer at heart' : 'leads';
  const leader = byId(s, m.leader);
  const role = partRole(p);
  const why = role === 'tank' || role === 'bruiser' ? 'holds the line' : role === 'healer' || role === 'support' ? 'can mend the hurt' : role === 'shooter' ? 'sharp eyes, shoots from afar' : 'hits hard';
  const close = leader && (p.partner === leader.id ? `, ${leader.name}'s partner` : opinion(s, p.id, leader.id) >= 40 ? `, a friend of ${leader.name}` : '');
  return `${why}${close || ''}${ambitionOf(p) === 'adventurer' ? ', keen to go' : ''}`;
}

/** Send the party being raised. */
export function sendMuster(s: GameState): SendCheck {
  const m = s.muster;
  const d = m && destinationOf(s, m.dest);
  if (!m || !d) return { ok: false, reason: 'No party being raised' };
  const members = m.members.map((id) => byId(s, id)).filter((p): p is Person => !!p && p.away === null && !p.downed);
  if (!members.length) return { ok: false, reason: 'Nobody left to go' };
  const leader = members.find((p) => p.id === m.leader) ?? members[0];
  const ids = [leader.id, ...members.filter((p) => p !== leader).map((p) => p.id)];
  const town = planParty(s, m.dest);
  const r = sendExpedition(s, m.dest, ids, rolesFor(members, d), STAKES[m.stakes].stance, m.horses ? Math.min(town.horses, members.length) : 0, town.truck && m.stakes === 'risky', {
    rations: RATIONS[m.rations].food,
    extraTorches: m.torches,
  });
  if (!r.ok) return r;
  const e = s.expeditions[s.expeditions.length - 1];
  e.stakes = m.stakes;
  e.leader = leader.id;
  e.ordered = true;
  e.rations = m.rations;
  e.start = {
    level: Object.fromEntries(members.map((p) => [p.id, levelOf(p)])),
    wounds: Object.fromEntries(members.map((p) => [p.id, p.wounds?.length ?? 0])),
    names: Object.fromEntries(members.map((p) => [p.id, p.name])),
    tick: s.tick,
  };
  notify(s, `${leader.name} leads the party out for ${the(d.name)}: "${oddsLine(s, m)}"`, true);
  s.muster = undefined;
  return { ok: true };
}

/* ------------------------------------------------------------ on the road */

interface Crossroad {
  id: string;
  leg: 'out' | 'back' | 'any';
  title: string;
  text: (d: Destination, leader: string) => string;
  options: [string, string];
  /** May it come up now? */
  when?: (s: GameState, e: Expedition, d: Destination) => boolean;
  /** The leader's own choice if nobody answers: the bold one on a risky trip. */
  bold: 0 | 1;
  apply: (s: GameState, e: Expedition, d: Destination, members: Person[], option: number, rng: Rng) => string;
}

const leg = (e: Expedition) => (e.phase === 'back' ? 'backTicks' : 'outTicks');
const stretch = (e: Expedition, k: number) => {
  e[leg(e)] = Math.max(e.elapsed + 1, Math.round(e[leg(e)] * k));
};
const foesOf = (d: Destination, rng: Rng) => {
  const g = d.encounters.groups;
  return g.length ? g[rng.int(0, g.length - 1)].enemies : null;
};

const CROSSROADS: readonly Crossroad[] = [
  {
    id: 'storm',
    leg: 'any',
    title: 'The weather turns',
    text: (d, l) => `Black cloud comes down over the road to ${the(d.name)}, and the wind gets up. ${l} looks back at the party: push on through it, or make camp and let it blow over?`,
    options: ['Push on through it', 'Make camp and wait'],
    bold: 0,
    apply: (_s, e, _d, members, o, rng) => {
      if (o === 0) {
        stretch(e, 0.85);
        const hurt = members.filter(() => rng.chance(0.3));
        for (const p of hurt) p.hp = Math.max(1, p.hp - Math.round(maxHp(p) * 0.08));
        return hurt.length ? `They push through and gain time, but ${hurt.map((p) => p.name).join(' and ')} took a soaking and a fall.` : 'They push through and gain time, soaked to the skin.';
      }
      stretch(e, 1.2);
      for (const p of members) p.needs.rest = Math.min(1, p.needs.rest + 0.3);
      return 'They sit out the storm under a rock and go on rested, a little behind.';
    },
  },
  {
    id: 'shortcut',
    leg: 'out',
    title: 'A shorter way',
    text: (d, l) => `An old track leaves the road and cuts across the wild toward ${the(d.name)}: half a day saved, if it goes where it seems to. ${l} wants your word.`,
    options: ['Take the shortcut', 'Keep to the road'],
    bold: 0,
    apply: (_s, e, d, members, o, rng) => {
      if (o === 1) return 'They keep to the road, the long way and the known one.';
      stretch(e, 0.7);
      const foes = foesOf(d, rng);
      if (foes && rng.chance(0.45)) {
        e.battle = startBattle(members, e.roles, foes, rng, e.supplies);
        return 'The shortcut saves time, and runs them straight into trouble.';
      }
      return 'The shortcut holds good. They make up time.';
    },
  },
  {
    id: 'tracks',
    leg: 'out',
    title: 'Fresh tracks',
    when: (_s, _e, d) => d.encounters.groups.length > 0,
    text: (d, l) => `Tracks cross the road on the way to ${the(d.name)}, big and fresh, heading off into the trees. ${l} kneels by them. Follow them for a fight and whatever the beast has hoarded, or leave them be?`,
    options: ['Follow the tracks', 'Leave them be'],
    bold: 0,
    apply: (s, e, d, members, o, rng) => {
      if (o === 1) return 'They step over the tracks and go on quietly.';
      const foes = foesOf(d, rng);
      const m = rng.pick<Material>(['hide', 'meat', 'bone']);
      addStock(e.loot, m, Math.min(rng.int(3, 6), Math.max(0, partyCarry(s, e) - poolSize(e.loot))));
      if (foes) e.battle = startBattle(members, e.roles, foes, rng, e.supplies);
      return `They follow the tracks to a lair: ${MATERIAL_NAMES[m].toLowerCase()} to take, and a fight to have first.`;
    },
  },
  {
    id: 'ruin',
    leg: 'out',
    title: 'Stones in the grass',
    text: (_d, l) => `Off the road, the tumbled walls of something old: a tower, or a shrine. ${l} thinks there may be something worth taking. It would cost time.`,
    options: ['Search the ruin', 'No time for it'],
    bold: 0,
    apply: (s, e, _d, _m, o, rng) => {
      if (o === 1) return 'They leave the old stones to the crows.';
      stretch(e, 1.2);
      if (rng.chance(0.6)) {
        const coins = Math.round(rng.int(6, 20) * PURSE_SCALE[s.era]);
        s.coins = (s.coins ?? 0) + coins;
        earn(s, 'events', coins);
        return `They turn over the stones and find an old purse: ${coins} coins for the treasury.`;
      }
      return 'They search till the light goes and find nothing but nettles.';
    },
  },
  {
    id: 'heavy',
    leg: 'back',
    when: (_s, e) => poolSize(e.loot) >= 6,
    title: 'Heavy packs',
    text: (_d, l) => `The packs are full and the going is slow. ${l} says they could leave the worst of it by the road and be home by dark, or carry it all and risk being caught out.`,
    options: ['Carry it all home', 'Leave some and hurry'],
    bold: 0,
    apply: (_s, e, d, members, o, rng) => {
      if (o === 1) {
        let drop = Math.floor(poolSize(e.loot) * 0.3);
        for (const m of Object.keys(e.loot) as Material[])
          while (drop > 0 && (e.loot[m] ?? 0) > 0) {
            addStock(e.loot, m, -1);
            drop--;
          }
        stretch(e, 0.7);
        return 'They leave a third of it under a stone and step out for home.';
      }
      stretch(e, 1.15);
      const foes = foesOf(d, rng);
      if (foes && rng.chance(0.35)) {
        e.battle = startBattle(members, e.roles, foes, rng, e.supplies);
        return 'They carry it all, slowly, and something comes after them in the dusk.';
      }
      return 'They carry it all, slowly, and nothing troubles them.';
    },
  },
  {
    id: 'traveller',
    leg: 'any',
    title: 'A traveller in the ditch',
    text: (_d, l) => `A traveller lies by the road with a broken leg, waving them down. ${l} glances at the sky and at the packs. Help, or pass by?`,
    options: ['Help them', 'Pass by'],
    bold: 1,
    apply: (s, e, _d, members, o) => {
      if (o === 1) return 'They pass by. Nobody says much for a while.';
      stretch(e, 1.15);
      s.reputation += 1;
      const healer = [...members].sort((a, b) => b.skills.medicine.level - a.skills.medicine.level)[0];
      return `They splint the leg and see the traveller to a farm${healer ? `; ${healer.name} does the splinting` : ''}. Word of it gets about (+1 renown).`;
    },
  },
];

/** A commanded party's turn on the road: a question for the player (at most `MOST_CROSSROADS` a trip). True if asked. */
export function crossroads(s: GameState, e: Expedition, members: Person[], rng: Rng): boolean {
  if (!e.ordered || (e.crossroads ?? 0) >= MOST_CROSSROADS || !members.length) return false;
  const d = destinationOf(s, e.dest);
  if (!d) return false;
  const now = e.phase === 'back' ? 'back' : 'out';
  const open = CROSSROADS.filter((c) => (c.leg === 'any' || c.leg === now) && (!c.when || c.when(s, e, d)));
  if (!open.length) return false;
  const c = open[rng.int(0, open.length - 1)];
  const leader = byId(s, e.leader ?? e.members[0]) ?? members[0];
  const cal = calendar(s.tick);
  const nowScene = { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) } as const;
  const text = c.text(d, leader.name);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'road',
    road: c.id,
    expedition: e.id,
    title: c.title,
    text,
    story: `${The(d.name)} party, ${e.phase === 'back' ? 'on the way home' : 'on the road'}. ${text}`,
    picture: eventPicture(`road:${c.id}:${d.id}`, `${c.title} ${d.scenery ?? ''} road ${d.name}`, nowScene),
    who: leader.id,
    options: [...c.options],
    defaultOption: e.stakes === 'risky' ? c.bold : 1 - c.bold,
    expiresTick: s.tick + CROSSROADS_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  e.prompt = prompt.id;
  e.crossroads = (e.crossroads ?? 0) + 1;
  notify(s, `${c.title}: ${the(d.name)} party asks what to do.`, true);
  return true;
}

/** The answer to a road question (the player's, or the leader's when nobody answered). */
export function answerCrossroads(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  const e = s.expeditions.find((q) => q.id === prompt.expedition);
  const c = CROSSROADS.find((x) => x.id === prompt.road);
  if (!e || !c) return;
  e.prompt = null;
  const d = destinationOf(s, e.dest);
  if (!d) return;
  const members = e.members.map((id) => byId(s, id)).filter((p): p is Person => !!p);
  const said = c.apply(s, e, d, members, option, rng);
  notify(s, `${c.title}: ${said}`, true);
  setOutcome(s, c.title, c.options[option] ?? null, said);
}

/* ------------------------------------------------------------ home again */

const stockText = (st: Partial<Record<Material, number>>) =>
  (Object.entries(st) as [Material, number][])
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${MATERIAL_NAMES[m]?.toLowerCase() ?? m}`)
    .join(', ');

/** A commanded party home: what it cost and what it won, on the full-screen box. */
export function debrief(s: GameState, e: Expedition, d: Destination): void {
  if (!e.ordered || !e.start) return;
  const ids = Object.keys(e.start.names).map(Number);
  const lines: string[] = [];
  const days = (s.tick - e.start.tick) / TICKS_PER_DAY;
  const leaderName = e.start.names[e.leader ?? ids[0]] ?? 'The leader';
  const took = stockText(e.loot);
  lines.push(`${leaderName}'s party is home from ${the(d.name)} after ${days < 1 ? 'less than a day' : days < 1.5 ? 'a day' : `${Math.round(days)} days`}${e.recalled ? ', called back' : ''}.`);
  lines.push(e.wrecked ? 'Their boat went down; what they found went with her.' : took ? `They bring home ${took}.` : 'They come home empty-handed.');
  if (e.cleared) lines.push(`${The(d.name)} is cleared.`);
  for (const id of ids) {
    const p = byId(s, id);
    const name = e.start.names[id];
    if (!p) {
      lines.push(`${name} did not come back.`);
      continue;
    }
    const up = levelOf(p) - (e.start.level[id] ?? levelOf(p));
    const hurt = (p.wounds?.length ?? 0) - (e.start.wounds[id] ?? 0);
    const bits = [up > 0 ? `rose to level ${levelOf(p)}` : '', hurt > 0 ? `came home with ${hurt === 1 ? 'a wound' : `${hurt} wounds`}` : '', p.downed ? 'was carried in' : ''].filter(Boolean);
    if (bits.length) lines.push(`${name} ${bits.join(', and ')}.`);
  }
  if (e.rations === 'plenty') lines.push('Well fed all the way, they come home in good heart.');
  if (e.rations === 'lean') lines.push('The packs ran thin by the end.');
  const leader = byId(s, e.leader ?? ids[0]);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title: `Home from ${the(d.name)}`,
    text: lines[0],
    story: lines.join(' '),
    picture: eventPicture(`debrief:${d.id}`, 'town home square welcome', { hour: calendar(s.tick).hour, season: calendar(s.tick).season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    ...(leader ? { who: leader.id } : {}),
    options: ['Welcome them home'],
    defaultOption: 0,
    expiresTick: s.tick + DEBRIEF_HOURS * TICKS_PER_HOUR,
  };
  if (e.rations === 'plenty') for (const id of ids) {
    const p = byId(s, id);
    if (p) p.morale = Math.min(100, p.morale + 5);
  }
  s.prompts.push(prompt);
}

/* ------------------------------------------------------------ seen */

export interface MusterPerson {
  id: number;
  name: string;
  level: number;
  calling: string | null;
  hp: number;
  maxHp: number;
  /** In the party: why the leader picked them. */
  reason?: string;
  /** Asked and said no: why, and what would bring them (null: only an order). */
  why?: string;
  price?: number | null;
  /** Not asked yet: whether they'd say yes. */
  keen?: boolean;
}
export interface MusterView {
  dest: string;
  place: string;
  type: string;
  leader: number;
  odds: string;
  members: MusterPerson[];
  others: MusterPerson[];
  most: number;
  stakes: Stakes;
  rations: Rations;
  torches: number;
  delve: boolean;
  horses: boolean;
  horsesHome: number;
  treasury: number;
}

/** The party being raised, for the Expeditions tab. */
export function musterView(s: GameState, calling: (p: Person) => string | null): MusterView | null {
  const m = s.muster;
  const d = m && destinationOf(s, m.dest);
  if (!m || !d) return null;
  const view = (p: Person): MusterPerson => ({ id: p.id, name: p.name, level: levelOf(p), calling: calling(p), hp: Math.round(p.hp), maxHp: Math.round(maxHp(p)) });
  const members = m.members.map((id) => byId(s, id)).filter((p): p is Person => !!p).map((p) => ({ ...view(p), reason: pickReason(s, m, p) }));
  const others = askable(s)
    .filter((p) => !m.members.includes(p.id))
    .map((p) => {
      const no = m.refused[p.id];
      return no ? { ...view(p), why: no.why, price: no.price } : { ...view(p), keen: willing(s, m, p) === null };
    })
    .sort((a, b) => Number(!!b.why) - Number(!!a.why) || Number(!!b.keen) - Number(!!a.keen) || b.level - a.level);
  return {
    dest: m.dest,
    place: d.name,
    type: d.type,
    leader: m.leader,
    odds: oddsLine(s, m),
    members,
    others,
    most: mostFor(s, d),
    stakes: m.stakes,
    rations: m.rations,
    torches: m.torches,
    delve: d.type === 'delve',
    horses: m.horses,
    horsesHome: s.horses.length,
    treasury: s.coins ?? 0,
  };
}
