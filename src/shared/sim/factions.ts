// The realm (data/factions.ts): the powers round the town and how it stands with each. They're met one at a time, by
// an envoy; each day their troops grow and their goodwill drifts toward their temper, warmed by treaties and gifts.
// Envoys come asking (a greeting, tribute, peace, trade, an alliance, a marriage, a surrender), and the player answers
// in the event box; the player can also send gifts, propose treaties, declare war, demand submission and free a vassal
// from the Realm. A power at war musters a war host with days of warning (sim/raids.ts `startRaid` with `host`: up to
// HOST_MOST, siege engines, its lord at the head, the town's allies beside the town), and a stronghold may be stormed
// in an assault: the whole town in one long fight, wave after wave, the lord last; stormed, it is plundered, some of
// its folk come over, and it is made a vassal or razed. A dungeon can be stormed the same way.

import { DESTINATION_BY_ID, type Destination } from '../data/expeditions';
import { DUNGEONS, DUNGEON_BY_ID } from '../data/dungeons';
import { ENEMIES } from '../data/enemies';
import { eventPicture } from '../data/eventScenes';
import {
  ALLY_TROOPS, ASSAULT_MOST, ASSAULT_WAVES_MOST, ASSAULT_WAVE_TROOPS, ATTITUDE_DRIFT, BETRAY_CHANCE, DEMAND_BASE, DEMAND_PER_TROOPS, ENVOY_GAP_DAYS, ENVOY_HOURS,
  FACTION_BY_ID, FACTION_COUNT, FIRST_MEET_DAY, pickRivals, GIFT_COINS, GIFT_WARMTH, GREEDY_GIFT, HOST_CHANCE, HOST_GAP_DAYS, HOST_LEAST, HOST_MOST, HOST_SHARE,
  HOST_WARNING_HOURS, MARRIAGE_WARMTH, MEET_EVERY_DAYS, OATHBREAKER, PLUNDER_GOODS, PLUNDER_PER_TROOP, REBEL_CHANCE, RECRUITS, SIEGE_EVERY, STANCE_NAME, TEMPER_NAME,
  TEMPER_REST, TRADE_COINS, TREATY_NEEDS, TREATY_WARMTH, TRIBUTE_MOST, TRIBUTE_PER_TROOPS, TROOPS_MOST, TROOPS_PER_DAY, TROOPS_START, WAR_AT, FOLK_GROWTH, FOLK_GROWTH_BY, FOLK_HOST_LOST, FOLK_MOST, FOLK_START, FOLK_STORMED, townTier,
  type RealmStance, type Temper,
} from '../data/factions';
import { levelOf } from '../data/levels';
/** A vassal's levy for an assault: this share of its troops, at most this many. */
const LEVY_SHARE = 0.25;
const LEVY_MOST = 6;
/** A demand is paid unanswered when the treasury holds this many times it. */
const DEMAND_EASY = 2;
import { RAID_KIND_BY_ID } from '../data/raids';
import { hashSeed, Rng } from '../rng';
import { weddingFeast } from './ceremonies';
import { assignBeds } from './townsfolk';
import { startRaid } from './raids';
import { seaTown } from './sea';
import { isChild } from './social';
import { makeStranger, strangerLook } from './strangers';
import { addStock, campXY, earn, edgeXY, makePerson, notify, setOutcome, townFull, type Faction, type GameState, type Prompt, type Raid, type Raider } from './state';
import { calendar, paceDay, TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';

/* ------------------------------------------------------------ the powers */

/** The town's realm: seeded from the world's seed the first time it's asked for (never the town's own people). */
export function realm(s: GameState): Faction[] {
  if (s.factions) {
    // (an older town's powers are given their towns: a size by their strength)
    for (const f of s.factions) if (f.folk === undefined) f.folk = f.stance === 'destroyed' ? 0 : Math.round(FOLK_START[0] + f.troops * 0.6);
    return s.factions;
  }
  const rng = new Rng(hashSeed(`${s.seed}:realm`));
  const own = s.origin ?? 'settlers';
  // (a conquest's world names its realms: the same draws as pickRivals made for it; else the four powers of old)
  const picked = pickRivals(rng, own, (s.conquest?.realmIds.length ?? FACTION_COUNT) - 1);
  const tempers: Temper[] = ['warlike', 'greedy', 'honourable', 'treacherous'];
  s.factions = picked.map((d) => {
    const temper = rng.chance(0.7) ? d.temper : tempers[rng.int(0, tempers.length - 1)];
    return { id: d.id, known: false, troops: rng.int(TROOPS_START[0], TROOPS_START[1]), folk: rng.int(FOLK_START[0], FOLK_START[1]), attitude: TEMPER_REST[temper], stance: 'neutral' as RealmStance, temper, since: 0 };
  });
  return s.factions;
}

/** Each dawn of the realm the powers' towns grow (known or not), quicker at peace with the town, slower at war. */
export function growTowns(fs: Faction[]): void {
  for (const f of fs) {
    if (f.stance === 'destroyed') {
      f.folk = 0;
      continue;
    }
    const folk = f.folk ?? FOLK_START[0];
    f.folk = Math.min(FOLK_MOST, folk + Math.max(1, Math.round(folk * FOLK_GROWTH * (FOLK_GROWTH_BY[f.stance] ?? 1))));
  }
}

export const defOf = (f: Faction) => FACTION_BY_ID[f.id];
export const factionOf = (s: GameState, id: string) => realm(s).find((f) => f.id === id);
const lordName = (f: Faction) => ENEMIES[defOf(f).lord]?.name ?? 'their lord';
const standing = (f: Faction) => f.stance !== 'destroyed';

/** How strong the town is in the field: its grown-ups, the seasoned counting for more (about one a head at level 1,
 *  two at level 10). The powers weigh their troops against it. */
export function townMight(s: GameState): number {
  return s.people.filter((p) => !isChild(p) && !p.downed).reduce((t, p) => t + 1 + levelOf(p) / 10, 0);
}

function setStance(s: GameState, f: Faction, stance: RealmStance): void {
  f.stance = stance;
  f.since = s.tick;
  if (stance !== 'war') f.host = undefined;
}
const clamp = (n: number) => Math.max(-100, Math.min(100, Math.round(n)));
const warm = (f: Faction, n: number) => (f.attitude = clamp(f.attitude + n));

/** Every power that isn't this one thinks less of a town that breaks its word. */
function oathbroken(s: GameState, f: Faction): void {
  for (const o of realm(s)) if (o !== f && o.known && standing(o)) warm(o, -OATHBREAKER);
}

/** Declare war (the town or the power). */
export function declareWar(s: GameState, f: Faction, byTown: boolean): void {
  if (f.stance === 'war' || !standing(f)) return;
  const treaty = ['peace', 'trade', 'alliance', 'vassal'].includes(f.stance);
  setStance(s, f, 'war');
  f.married = false;
  warm(f, -30);
  if (byTown && treaty) oathbroken(s, f);
  notify(s, byTown ? `${defOf(f).name}: the town has declared war on them.` : `${defOf(f).name} ${treaty ? 'have broken faith and' : 'have'} declared war on the town!`, true);
}

/* ------------------------------------------------------------ each hour, each day */

/** Each hour: a host that's due marches; at the morning's hour, the day's turn of the realm. */
export function factionsHourly(s: GameState, rng: Rng): void {
  if (s.autopilot === false || s.gameOver || s.tick % TICKS_PER_HOUR !== 0) return;
  realm(s);
  for (const f of realm(s)) if (f.host && s.tick >= f.host.at && !s.raid) launchHost(s, f, rng);
  if (calendar(s.tick).hour === 9) factionsDaily(s, rng);
}

/** The realm's day: powers met, troops grown, goodwill drifted, tribute and trade paid, wars declared, hosts mustered,
 *  betrayals and rebellions, and an envoy now and then. */
export function factionsDaily(s: GameState, rng: Rng): void {
  const day = Math.floor(paceDay(s.tick));
  const might = townMight(s);
  const fs = realm(s);
  growTowns(fs);
  // a new power is met (its envoy at the gate)
  const known = fs.filter((f) => f.known).length;
  const next = fs.find((f) => !f.known);
  if (next && day >= FIRST_MEET_DAY + known * MEET_EVERY_DAYS && !envoyWaiting(s)) {
    next.known = true;
    envoy(s, next, 'greet');
    return;
  }
  for (const f of fs) {
    if (!f.known || !standing(f)) continue;
    f.troops = Math.min(TROOPS_MOST, f.troops + TROOPS_PER_DAY * (f.stance === 'vassal' ? 0.5 : 1));
    // goodwill drifts to the temper's rest, warmed by treaties and a marriage
    const rest = TEMPER_REST[f.temper];
    warm(f, Math.sign(rest - f.attitude) * Math.min(ATTITUDE_DRIFT, Math.abs(rest - f.attitude)) + (TREATY_WARMTH[f.stance] ?? 0) + (f.married ? MARRIAGE_WARMTH : 0));
    if (f.stance === 'trade' || f.stance === 'alliance') pay(s, TRADE_COINS, `Trade with ${defOf(f).name}`);
    if (f.stance === 'vassal') {
      pay(s, Math.min(TRIBUTE_MOST, Math.max(2, Math.round(f.troops * TRIBUTE_PER_TROOPS))), `Tribute from ${defOf(f).name}`);
      // a vassal with its strength back and no love left rises
      if (f.troops > might * 1.5 && f.attitude < -20 && rng.chance(REBEL_CHANCE)) {
        notify(s, `${defOf(f).name} have thrown off the town's yoke!`, true);
        declareWar(s, f, false);
      }
      continue;
    }
    // with no treaty, a power that hates the town goes to war
    if (f.stance === 'neutral' && f.attitude <= WAR_AT) declareWar(s, f, false);
    // the treacherous break their word when they feel strong
    else if (['peace', 'trade', 'alliance'].includes(f.stance) && f.temper === 'treacherous' && f.troops > might * 1.3 && rng.chance(BETRAY_CHANCE)) {
      declareWar(s, f, false);
      musterHost(s, f, HOST_WARNING_HOURS / 3);
      continue;
    }
    // at war: a host is mustered now and then
    if (f.stance === 'war' && !f.host && f.troops >= HOST_LEAST && s.tick - (f.lastHost ?? -1e12) >= HOST_GAP_DAYS * TICKS_PER_DAY && day >= FIRST_MEET_DAY + 2 && rng.chance(HOST_CHANCE * (f.temper === 'warlike' ? 1.4 : 1) * ((s.feuds ?? []).some((x) => x.a === f.id || x.b === f.id) ? 0.5 : 1))) musterHost(s, f);
  }
  // one envoy a day at most, from a power with something to say
  if (envoyWaiting(s)) return;
  for (const f of [...fs].sort(() => rng.next() - 0.5)) {
    if (!f.known || !standing(f) || s.tick - (f.lastEnvoy ?? -1e12) < ENVOY_GAP_DAYS * TICKS_PER_DAY) continue;
    const about = envoyAbout(s, f, might, rng);
    if (about) {
      envoy(s, f, about);
      return;
    }
  }
}

/** What a power's envoy would come about now, if anything. */
function envoyAbout(s: GameState, f: Faction, might: number, rng: Rng): string | null {
  const strong = f.troops > might * 1.2;
  const days = (s.tick - f.since) / TICKS_PER_DAY;
  switch (f.stance) {
    case 'war':
      // beaten and outmatched, they kneel; worn by a long war, they ask for peace
      if ((f.beaten ?? 0) >= 2 && f.troops < might * 0.6) return 'surrender';
      if ((days >= 5 || f.troops < might * 0.8) && f.temper !== 'warlike' && rng.chance(0.35)) return 'peace';
      return null;
    case 'neutral':
      if (strong && (f.temper === 'greedy' || f.temper === 'warlike') && rng.chance(0.5)) return 'demand';
      if (f.attitude >= TREATY_NEEDS.peace + 10 && rng.chance(0.5)) return 'peace';
      return null;
    case 'peace':
      if (strong && f.temper === 'greedy' && rng.chance(0.25)) return 'demand';
      if (f.attitude >= TREATY_NEEDS.trade && rng.chance(0.5)) return 'trade';
      if (f.attitude >= 30 && !f.married && rng.chance(0.25)) return 'marriage';
      return null;
    case 'trade':
      if (f.attitude >= TREATY_NEEDS.alliance && rng.chance(0.5)) return 'alliance';
      if (f.attitude >= 30 && !f.married && rng.chance(0.3)) return 'marriage';
      return null;
    case 'alliance':
      if (!f.married && f.attitude >= 30 && rng.chance(0.3)) return 'marriage';
      return null;
    default:
      return null;
  }
}

/** Coins into the treasury from the realm. */
function pay(s: GameState, n: number, why: string): void {
  if (n <= 0) return;
  s.coins = (s.coins ?? 0) + n;
  earn(s, 'realm', n);
  void why;
}

/* ------------------------------------------------------------ envoys */

const envoyWaiting = (s: GameState) => s.prompts.some((p) => p.kind === 'envoy');

/** What each envoy says and offers (the first option the bold one, the default chosen if nobody answers). */
function envoyText(s: GameState, f: Faction, about: string, coins: number): { title: string; text: string; options: string[]; def: number } {
  const d = defOf(f);
  const lord = lordName(f);
  switch (about) {
    case 'greet':
      return {
        title: `Envoys of ${d.name}`,
        text: `Riders under a strange banner have come to the gate: envoys of ${d.name}, who hold ${d.stronghold}, sent by ${lord}. They are ${TEMPER_NAME[f.temper].toLowerCase()} folk, by the look of them, and some ${f.troops > townMight(s) ? 'more' : 'fewer'} in arms than the town. How are they received?`,
        options: [`Feast them, with gifts (${GIFT_COINS} coins)`, 'Hear them out', 'Send them packing'],
        def: 1,
      };
    case 'demand':
      return {
        title: `${lord} demands tribute`,
        text: `${lord} of ${d.name} sends word: the town will pay ${coins} coins, as a token of respect, or learn what disrespect costs. Behind the envoy, ${Math.round(f.troops)} under arms.`,
        options: [`Pay the ${coins} coins`, 'Refuse', 'Refuse, and declare war'],
        def: 1,
      };
    case 'peace':
      return {
        title: `${d.name} offer peace`,
        text: f.stance === 'war' ? `${lord} is tired of this war, or says so: the envoy brings a branch and an offer to lay down arms.` : `The envoy of ${d.name} proposes a treaty of peace between ${lord}'s people and the town: no raids, no war.`,
        options: ['Make peace', f.stance === 'war' ? 'Fight on' : 'Decline'],
        def: 0,
      };
    case 'trade':
      return { title: `${d.name} offer trade`, text: `${lord} proposes that the roads between ${d.stronghold} and the town be kept open to merchants: coin both ways, and goodwill.`, options: ['Open the roads', 'Decline'], def: 0 };
    case 'alliance':
      return { title: `${d.name} offer an alliance`, text: `${lord} offers to stand with the town: their troops at the town's side when a host comes, and the town's word to do the same.`, options: ['Swear the alliance', 'Decline'], def: 0 };
    case 'marriage':
      return {
        title: `A match from ${d.name}`,
        text: `${lord} proposes a marriage between the houses: one of their own, of good blood, to come and live in the town and wed. Kin are slow to make war on kin.`,
        options: ['Agree to the match', 'Decline politely'],
        def: 0,
      };
    case 'surrender':
      return {
        title: `${d.name} sue for mercy`,
        text: `Broken in the field, ${lord} sends their seal and asks for terms: they will kneel, and pay, if the town will let them stand.`,
        options: ['Accept their fealty (a vassal)', 'Make peace', 'No quarter: fight on'],
        def: 0,
      };
    case 'conquered':
      return {
        title: `${d.stronghold} has fallen`,
        text: `${d.stronghold} is the town's. Its people wait to hear what will become of them: kept as a vassal, paying tribute each day (and maybe rising one day), or the stronghold pulled down and ${d.name} scattered for good.`,
        options: ['Make them our vassal', 'Raze it: no more ' + d.name],
        def: 0,
      };
    default:
      return { title: d.name, text: '', options: ['Very well'], def: 0 };
  }
}

/** An envoy at the gate: a question in the event box. */
export function envoy(s: GameState, f: Faction, about: string): Prompt | null {
  if (envoyWaiting(s)) return null;
  const d = defOf(f);
  const coins = about === 'demand' ? Math.round(DEMAND_BASE + f.troops * DEMAND_PER_TROOPS) : 0;
  const t = envoyText(s, f, about, coins);
  const cal = calendar(s.tick);
  const now = { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) } as const;
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'envoy',
    envoy: { faction: f.id, about, coins },
    expedition: null,
    title: t.title,
    text: t.text,
    story: `${t.text} (${d.name}: ${STANCE_NAME[f.stance].toLowerCase()}, ${moodWord(f.attitude)}.)`,
    picture: eventPicture(`envoy:${f.id}:${about}`, `${d.stronghold} ${d.name} envoy ${about === 'demand' || about === 'conquered' ? 'war' : 'court'}`, now),
    options: t.options,
    // (left unanswered, a demand the treasury can easily meet is paid: refusing invites war)
    defaultOption: about === 'demand' && (s.coins ?? 0) >= coins * DEMAND_EASY ? 0 : t.def,
    expiresTick: s.tick + ENVOY_HOURS * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  f.lastEnvoy = s.tick;
  rideIn(s, f);
  notify(s, `${t.title}.`, true);
  return prompt;
}

/** The envoy's rider (seen on the map): rides in from the edge of the land on the power's side to the fire, waits
 *  there while the question is open, then rides out. A look of their people, mounted. */
function rideIn(s: GameState, f: Faction): void {
  const d = defOf(f);
  const side: -1 | 1 = hashSeed(f.id) % 2 ? 1 : -1;
  const at = edgeXY(s, side);
  const p = makePerson(new Rng(hashSeed(`${s.seed}:envoy:${f.id}:${s.tick}`)), ENVOY_ID, 'gatherer', at, []);
  if (d.origin) strangerLook(p, d.origin);
  s.envoyRider = { id: ENVOY_ID, faction: f.id, name: `Envoy of ${d.name.replace(/^The /, 'the ')}`, look: p.look, x: at.x, y: at.y, dir: side < 0 ? 1 : -1, leaving: false };
}
/** The rider's id (never a townsperson's), and their pace (px a tick). */
export const ENVOY_ID = -7777;
const RIDE_PACE = 1.6;

/** Each tick: the envoy's rider on their way in, waiting, or on their way out. */
export function envoyTick(s: GameState): void {
  const r = s.envoyRider;
  if (!r) return;
  if (!r.leaving && !envoyWaiting(s)) r.leaving = true;
  const camp = campXY(s);
  const side: -1 | 1 = r.x < camp.x ? -1 : 1;
  const to = r.leaving ? edgeXY(s, side) : { x: camp.x + side * 44, y: camp.y + 28 };
  const dx = to.x - r.x;
  const dy = to.y - r.y;
  const d = Math.hypot(dx, dy);
  if (d <= RIDE_PACE) {
    r.x = to.x;
    r.y = to.y;
    if (r.leaving) s.envoyRider = undefined;
    else r.dir = side < 0 ? 1 : -1; // (waiting, facing the fire)
    return;
  }
  r.x += (dx / d) * RIDE_PACE;
  r.y += (dy / d) * RIDE_PACE;
  r.dir = dx >= 0 ? 1 : -1;
}

/** The town's answer to an envoy (the player's, or the default when nobody answers). */
export function answerEnvoy(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  const e = prompt.envoy;
  const f = e && factionOf(s, e.faction);
  if (!e || !f) return;
  const d = defOf(f);
  let said = '';
  switch (e.about) {
    case 'greet':
      if (option === 0) {
        const paid = Math.min(GIFT_COINS, s.coins ?? 0);
        spend(s, paid);
        warm(f, paid >= GIFT_COINS ? 18 : 8);
        said = `The envoys feasted and went home with gifts. ${d.name} think well of the town.`;
      } else if (option === 1) {
        warm(f, 4);
        said = `The envoys were heard, and went home with the town's greetings.`;
      } else {
        warm(f, -20);
        said = `The envoys were sent off. ${d.name} will remember it.`;
      }
      break;
    case 'demand': {
      const coins = e.coins ?? 0;
      if (option === 0 && (s.coins ?? 0) >= coins) {
        spend(s, coins);
        warm(f, 12);
        said = `The town paid ${coins} coins. ${lordName(f)} is satisfied, for now.`;
      } else if (option === 2) {
        declareWar(s, f, true);
        said = `The town refused, and is at war with ${d.name}.`;
      } else {
        warm(f, -25);
        if (f.temper === 'warlike' || f.attitude <= WAR_AT) declareWar(s, f, false);
        said = option === 0 ? `The treasury couldn't pay. ${d.name} take it as an insult.` : `The town refused. ${d.name} take it badly.`;
        if (f.stance === 'war') said += ` It is war.`;
      }
      break;
    }
    case 'peace':
      if (option === 0) {
        setStance(s, f, 'peace');
        warm(f, 15);
        said = `Peace with ${d.name}.`;
      } else {
        warm(f, -10);
        said = f.stance === 'war' ? `The war with ${d.name} goes on.` : `No treaty with ${d.name}.`;
      }
      break;
    case 'trade':
    case 'alliance':
      if (option === 0) {
        setStance(s, f, e.about as RealmStance);
        warm(f, 10);
        said = e.about === 'trade' ? `The roads to ${d.stronghold} are open: trade with ${d.name}.` : `The town and ${d.name} are allies: their troops will stand with the town.`;
      } else {
        warm(f, -8);
        said = `The town declined. ${d.name} are cooler toward it.`;
      }
      break;
    case 'marriage':
      if (option === 0) said = marry(s, f, rng);
      else {
        warm(f, -12);
        said = `The match was declined. ${lordName(f)} is offended.`;
      }
      break;
    case 'surrender':
      if (option === 0) {
        setStance(s, f, 'vassal');
        f.attitude = clamp(Math.max(f.attitude, -10));
        said = `${d.name} kneel: a vassal of the town, paying tribute each day.`;
      } else if (option === 1) {
        setStance(s, f, 'peace');
        warm(f, 25);
        said = `The town made peace with ${d.name}, on generous terms.`;
      } else said = `No quarter. The war with ${d.name} goes on.`;
      break;
    case 'conquered':
      if (option === 0) {
        setStance(s, f, 'vassal');
        f.attitude = clamp(Math.min(f.attitude, -20));
        said = `${d.name} are the town's vassal, and pay tribute each day.`;
      } else {
        raze(s, f);
        said = `${d.stronghold} was pulled down stone from stone. ${d.name} are no more.`;
      }
      break;
  }
  if (said) {
    notify(s, said, true);
    setOutcome(s, prompt.title, prompt.options[option] ?? null, said);
  }
}

function spend(s: GameState, n: number): void {
  if (n <= 0) return;
  s.coins = (s.coins ?? 0) - n;
  earn(s, 'realm', -n);
}

/** A match between the houses: one of theirs comes to wed one of the town's (with a bed free and room in town). */
function marry(s: GameState, f: Faction, rng: Rng): string {
  const d = defOf(f);
  f.married = true;
  warm(f, 25);
  const single = s.people.filter((p) => !isChild(p) && p.away === null && p.partner == null && !p.monster).sort((a, b) => (a.id === s.mainId ? -1 : 0) - (b.id === s.mainId ? -1 : 0) || levelOf(b) - levelOf(a))[0];
  if (townFull(s) || !single) return `The houses are joined in word: ${d.name} count the town as kin.`;
  const at = { x: single.x + 20, y: single.y };
  const p = makePerson(rng, s.nextId++, 'gatherer', at, s.people.map((o) => o.name));
  if (d.origin) {
    p.origin = d.origin;
    makeStranger(s, p, d.origin);
  }
  s.people.push(p);
  p.partner = single.id;
  single.partner = p.id;
  p.married = single.married = true;
  assignBeds(s);
  weddingFeast(s, single, p);
  return `${p.name} of ${d.name} came to the town and wed ${single.name}. The houses are kin.`;
}

/** A power destroyed: its stronghold razed, its hosts gone. */
function raze(s: GameState, f: Faction): void {
  setStance(s, f, 'destroyed');
  f.folk = 0;
  f.troops = 0;
  f.host = undefined;
}

/* ------------------------------------------------------------ the town's own diplomacy (the Realm) */

export type RealmOp = 'gift' | 'peace' | 'trade' | 'alliance' | 'war' | 'demand' | 'free' | 'marry';
export interface RealmCheck {
  ok: boolean;
  reason?: string;
}

/** What the Realm's buttons do: whether a proposal is taken depends on their goodwill (and, for submission, on how
 *  the town's might weighs against their troops). */
export function realmCommand(s: GameState, id: string, op: RealmOp, rng: Rng): RealmCheck {
  const f = factionOf(s, id);
  if (!f || !f.known) return { ok: false, reason: 'No such power' };
  if (!standing(f)) return { ok: false, reason: `${defOf(f).name} are no more` };
  const d = defOf(f);
  const say = (text: string, ok = true) => {
    notify(s, text, true);
    return ok ? { ok: true } : { ok: false, reason: text };
  };
  switch (op) {
    case 'gift': {
      if ((s.coins ?? 0) < GIFT_COINS) return { ok: false, reason: `The treasury hasn't ${GIFT_COINS} coins` };
      spend(s, GIFT_COINS);
      warm(f, GIFT_WARMTH * (f.temper === 'greedy' ? GREEDY_GIFT : 1));
      return say(`Gifts sent to ${d.name}. They think better of the town.`);
    }
    case 'peace':
    case 'trade':
    case 'alliance': {
      const from: Record<string, RealmStance[]> = { peace: ['war', 'neutral'], trade: ['peace'], alliance: ['trade'] };
      if (!from[op].includes(f.stance)) return { ok: false, reason: `Not while ${STANCE_NAME[f.stance].toLowerCase()}` };
      // (a power at war that's losing listens sooner)
      const need = TREATY_NEEDS[op] - (op === 'peace' && f.stance === 'war' && f.troops < townMight(s) ? 25 : 0);
      if (f.attitude < need) {
        warm(f, -4);
        return say(`${d.name} turned the town's offer down.`, false);
      }
      setStance(s, f, op);
      warm(f, 5);
      return say(op === 'peace' ? `Peace with ${d.name}.` : op === 'trade' ? `A trade treaty with ${d.name}.` : `An alliance with ${d.name}.`);
    }
    case 'war':
      declareWar(s, f, true);
      return { ok: true };
    case 'demand': {
      // they bend the knee only to a town much stronger than they are
      if (f.troops > townMight(s) * 0.7) {
        warm(f, -20);
        if (f.stance !== 'war' && f.attitude <= WAR_AT) declareWar(s, f, false);
        return say(`${d.name} laughed at the town's demand.`, false);
      }
      setStance(s, f, 'vassal');
      warm(f, -15);
      return say(`${d.name} bend the knee: a vassal of the town.`);
    }
    case 'free':
      if (f.stance !== 'vassal') return { ok: false, reason: 'They are not the town\'s vassal' };
      setStance(s, f, 'peace');
      warm(f, 30);
      return say(`${d.name} are freed from their oath, and grateful.`);
    case 'marry':
      if (f.married) return { ok: false, reason: 'The houses are already joined' };
      if (!['peace', 'trade', 'alliance'].includes(f.stance)) return { ok: false, reason: 'Only with a power at peace' };
      if (f.attitude < 20) {
        warm(f, -5);
        return say(`${lordName(f)} won't hear of a match.`, false);
      }
      return say(marry(s, f, rng));
  }
}

/* ------------------------------------------------------------ war hosts */

/** A host is mustered: it comes in `hours` (the town is warned). */
export function musterHost(s: GameState, f: Faction, hours = HOST_WARNING_HOURS): void {
  const size = Math.max(6, Math.min(HOST_MOST, Math.round(f.troops * HOST_SHARE)));
  f.host = { at: s.tick + Math.round(hours * TICKS_PER_HOUR), size };
  notify(s, `${defOf(f).name} have mustered a war host of ${size}, ${lordName(f)} at its head! It will reach the town in ${Math.round(hours)} hours.`, true);
}

/** The host reaches the town: a raid of up to HOST_MOST, siege engines among them from the Medieval age, its lord at
 *  the head, and the town's allies on its side. */
export function launchHost(s: GameState, f: Faction, rng: Rng): Raid | null {
  const h = f.host;
  if (!h) return null;
  f.host = undefined;
  f.lastHost = s.tick;
  const d = defOf(f);
  const kind = RAID_KIND_BY_ID[d.raid];
  if (!kind) return null;
  const r = startRaid(s, kind, h.size * 20, rng, undefined, { ...hostMakeup(s, f, h.size), host: f.id });
  notify(s, `The war host of ${d.name} is here: ${r.raiders.filter((rd) => !rd.ally).length} strong!`, true);
  return r;
}

/** What a host's raid is: its raiders (`most`), siege engines and its lord (raids.ts reads these). */
export function hostMakeup(s: GameState, f: Faction, size: number): { most: number; siege: number; leader: string } {
  const siege = s.era === 'neolithic' ? 0 : Math.floor(size / SIEGE_EVERY);
  return { most: size, siege, leader: defOf(f).lord };
}

/** The levies that march with the town's assault: its allies send `ALLY_TROOPS` of theirs, its vassals a share of
 *  theirs (`LEVY_SHARE`, up to `LEVY_MOST`), never the power being stormed. Returns the troop kinds and who sent them. */
export function leviesFor(s: GameState, target: string, rng: Rng): { kind: string; from: string }[] {
  const out: { kind: string; from: string }[] = [];
  for (const f of realm(s)) {
    if (f.id === target || !f.known || (f.stance !== 'alliance' && f.stance !== 'vassal')) continue;
    const kind = RAID_KIND_BY_ID[defOf(f).raid];
    const ids = Object.keys(kind?.enemies ?? {});
    if (!ids.length) continue;
    const n = f.stance === 'vassal' ? Math.min(LEVY_MOST, Math.max(1, Math.round(f.troops * LEVY_SHARE))) : rng.int(ALLY_TROOPS[0], ALLY_TROOPS[1]);
    for (let i = 0; i < n; i++) out.push({ kind: ids[rng.int(0, ids.length - 1)], from: f.id });
  }
  return out;
}

/** The town's allies send some of their troops to stand with it (a host comes, or any raid now and then). */
export function alliesFor(s: GameState, r: Raid, rng: Rng, make: (kind: string) => Raider): number {
  let sent = 0;
  for (const f of realm(s)) {
    if (f.stance !== 'alliance' || f.id === r.host) continue;
    if (!r.host && !rng.chance(0.3)) continue;
    const kind = RAID_KIND_BY_ID[defOf(f).raid];
    if (!kind) continue;
    const ids = Object.keys(kind.enemies);
    const n = rng.int(ALLY_TROOPS[0], ALLY_TROOPS[1]);
    for (let i = 0; i < n; i++) r.raiders.push(make(ids[rng.int(0, ids.length - 1)]));
    sent += n;
    notify(s, `${defOf(f).name} send ${n} of their own to stand with the town!`, true);
  }
  return sent;
}

/** A host's raid is over: the power counts its dead; broken (its lord down, or most of the host), it's weaker and
 *  may sue for peace or kneel. */
export function hostOver(s: GameState, r: Raid): void {
  const f = r.host ? factionOf(s, r.host) : undefined;
  if (!f) return;
  const foes = r.raiders.filter((rd) => !rd.ally);
  const fell = foes.filter((rd) => rd.down).length;
  const lord = foes.find((rd) => rd.kind === defOf(f).lord);
  f.troops = Math.max(0, f.troops - fell);
  const broken = (lord && lord.down) || fell >= foes.length * 0.6;
  if (broken) {
    f.beaten = (f.beaten ?? 0) + 1;
    f.folk = Math.round((f.folk ?? FOLK_START[0]) * FOLK_HOST_LOST); // (the fallen were their own)
    f.lastEnvoy = undefined; // (an envoy may come at once)
    notify(s, `The war host of ${defOf(f).name} is broken${lord?.down ? `, and ${lordName(f)} carried from the field` : ''}. They have ${Math.round(f.troops)} left under arms.`, true);
  } else {
    warm(f, -5);
    notify(s, `The war host of ${defOf(f).name} pulls back, ${fell} fewer. They will come again.`, true);
  }
}

/** How likely a rival's ordinary raid is (raids.ts): only from a power the town has no peace with. */
export function rivalRaidOdds(s: GameState, kindId: string): number {
  if (!s.factions) return 1;
  const f = s.factions.find((x) => defOf(x).raid === kindId);
  if (!f) return 1;
  if (!f.known) return 0.5;
  return f.stance === 'war' ? 2 : f.stance === 'neutral' ? 1 : 0;
}

/* ------------------------------------------------------------ assaults */

export const ASSAULT_PREFIX = 'assault:';
export const isAssaultDest = (id: string) => id.startsWith(ASSAULT_PREFIX);
const targetOf = (id: string) => id.slice(ASSAULT_PREFIX.length);

/** What can be stormed: a stronghold of a power at war, and any dungeon on the board. */
export function assaultTargets(s: GameState, dungeonOpen: (id: string) => boolean): string[] {
  const out: string[] = [];
  for (const f of realm(s)) if (f.known && f.stance === 'war') out.push(ASSAULT_PREFIX + f.id);
  for (const d of DUNGEONS) if (dungeonOpen(d.id)) out.push(`${ASSAULT_PREFIX}dungeon:${d.id}`);
  return out;
}

/** The waves an assault meets, the lord's (or the dungeon's boss's) last. */
export function assaultWaves(s: GameState, target: string, rng: Rng): Record<string, number>[] {
  if (target.startsWith('dungeon:')) {
    const dg = DUNGEON_BY_ID[target.slice(8)];
    if (!dg) return [];
    const waves: Record<string, number>[] = [];
    const n = Math.min(ASSAULT_WAVES_MOST - 1, Math.max(3, Math.round(dg.rooms / 2)));
    for (let i = 0; i < n; i++) {
      const g: Record<string, number> = {};
      // (deeper waves are thicker: two groups, then three)
      for (let k = 0; k < 2 + Math.floor(i / 2); k++) for (const [id, c] of Object.entries(dg.foes[rng.int(0, dg.foes.length - 1)])) g[id] = (g[id] ?? 0) + c;
      waves.push(g);
    }
    waves.push({ ...dg.bosses[rng.int(0, dg.bosses.length - 1)] });
    return waves;
  }
  const f = factionOf(s, target);
  if (!f) return [];
  const kind = RAID_KIND_BY_ID[defOf(f).raid];
  const ids = Object.keys(kind?.enemies ?? {});
  if (!ids.length) return [{ [defOf(f).lord]: 1 }];
  const waves: Record<string, number>[] = [];
  const n = Math.min(ASSAULT_WAVES_MOST - 1, Math.max(2, Math.ceil(f.troops / ASSAULT_WAVE_TROOPS)));
  const each = Math.max(3, Math.min(8, Math.round(f.troops / n / 2)));
  for (let i = 0; i < n; i++) {
    const g: Record<string, number> = {};
    for (let k = 0; k < each; k++) {
      const id = ids[rng.int(0, ids.length - 1)];
      g[id] = (g[id] ?? 0) + 1;
    }
    waves.push(g);
  }
  // the lord's guard and the lord
  const guard: Record<string, number> = { [defOf(f).lord]: 1 };
  for (let k = 0; k < 3; k++) guard[ids[k % ids.length]] = (guard[ids[k % ids.length]] ?? 0) + 1;
  waves.push(guard);
  return waves;
}

/** An assault as a place on the Expedition Board (and in the muster). */
export function assaultDestination(s: GameState, id: string): Destination | undefined {
  if (!isAssaultDest(id)) return undefined;
  const target = targetOf(id);
  if (target.startsWith('dungeon:')) {
    const dg = DUNGEON_BY_ID[target.slice(8)];
    const base = dg && DESTINATION_BY_ID[dg.id];
    if (!dg || !base) return undefined;
    return {
      ...base,
      id,
      name: `Storm ${dg.name}`,
      type: 'clear',
      workSeconds: 20,
      encounters: { arrival: 1, ambush: 0, groups: [{ enemies: dg.foes[0], weight: 1 }] },
      recommendedParty: ASSAULT_MOST,
      threats: `Everything in ${dg.name}, wave after wave, and ${dg.threat} at the last`,
      description: `The whole town goes down into ${dg.name} at once: one long fight, wave after wave, to the bottom.`,
    };
  }
  const f = factionOf(s, target);
  if (!f) return undefined;
  const d = defOf(f);
  return {
    id,
    name: `Storm ${d.stronghold}`,
    type: 'clear',
    outSeconds: 300,
    workSeconds: 20,
    secondsPerUnit: 8,
    loot: { iron: 3, cloth: 2, [d.goods]: 3 } as Destination['loot'],
    threats: `${d.name}'s ${Math.round(f.troops)} under arms, wave after wave, and ${lordName(f)} at the last`,
    encounters: { arrival: 1, ambush: 0, groups: [{ enemies: { [d.lord]: 1 }, weight: 1 }] },
    recommendedParty: ASSAULT_MOST,
    scenery: 'woods',
    description: `Take the war to ${d.name}: the whole town marches on ${d.stronghold}, one long fight to the walls and through them.`,
  };
}

/** The assault's plan, made as the party leaves (sim/expeditions.ts sendExpedition). */
export function planAssault(s: GameState, dest: string, rng: Rng): { target: string; waves: Record<string, number>[]; wave: number; total: number } | undefined {
  if (!isAssaultDest(dest)) return undefined;
  const target = targetOf(dest);
  const waves = assaultWaves(s, target, rng);
  return waves.length ? { target, waves, wave: 0, total: waves.length } : undefined;
}

/** The assault's end. Won: plunder (coins to the treasury, goods to the party's packs), recruits, and for a power a
 *  question (vassal or razed); lost or pulled back: the power is emboldened and its next host comes sooner. */
export function assaultOver(s: GameState, target: string, won: boolean, loot: Record<string, number>, rng: Rng): string {
  if (target.startsWith('dungeon:')) {
    const dg = DUNGEON_BY_ID[target.slice(8)];
    if (!dg) return '';
    if (!won) return `The assault on ${dg.name} failed.`;
    for (const [m, n] of Object.entries(dg.hoard)) addStock(loot as never, m as never, n ?? 0);
    (s.delved ??= {})[dg.id] = (s.delved[dg.id] ?? 0) + 1;
    return `${dg.name} was stormed to the bottom, and its hoard is the town's.`;
  }
  const f = factionOf(s, target);
  if (!f) return '';
  const d = defOf(f);
  if (!won) {
    warm(f, -10);
    f.troops = Math.min(TROOPS_MOST, f.troops + 5);
    if (f.stance === 'war' && !f.host) musterHost(s, f, HOST_WARNING_HOURS);
    return `The assault on ${d.stronghold} failed. ${d.name} are emboldened.`;
  }
  const coins = Math.round(f.troops * PLUNDER_PER_TROOP + 40);
  pay(s, coins, `Plunder from ${d.stronghold}`);
  addStock(loot as never, d.goods as never, PLUNDER_GOODS);
  f.stormed = (f.stormed ?? 0) + 1;
  f.folk = Math.round((f.folk ?? FOLK_START[0]) * FOLK_STORMED);
  f.troops = Math.max(0, Math.round(f.troops * 0.2));
  // some of its people come over to the town
  const n = townFull(s) ? 0 : rng.int(RECRUITS[0], RECRUITS[1]);
  const joined: string[] = [];
  for (let i = 0; i < n; i++) {
    const p = makePerson(rng, s.nextId++, 'gatherer', { x: 0, y: 0 }, s.people.map((o) => o.name));
    if (d.origin) {
      p.origin = d.origin;
      makeStranger(s, p, d.origin);
    }
    p.x = s.people[0]?.x ?? 0;
    p.y = s.people[0]?.y ?? 0;
    s.people.push(p);
    joined.push(p.name);
  }
  if (joined.length) assignBeds(s);
  envoy(s, f, 'conquered');
  return `${d.stronghold} was stormed! ${coins} coins of plunder for the treasury${joined.length ? `, and ${joined.join(' and ')} came over to the town` : ''}.`;
}

/* ------------------------------------------------------------ the view */

export interface FactionView {
  id: string;
  name: string;
  known: boolean;
  lord: string;
  stronghold: string;
  temper: string;
  stance: RealmStance;
  stanceName: string;
  attitude: number;
  mood: string;
  troops: number;
  /** Its own town: how many live there, and what it's called by its size (a camp to a capital), tier 0 to 4. */
  folk: number;
  size: string;
  tier: number;
  married: boolean;
  /** A host on its way: in how many hours, and how many. */
  host: { hours: number; size: number } | null;
  beaten: number;
  stormed: number;
  /** What the town may do now (the Realm's buttons). */
  can: RealmOp[];
  /** An assault on its stronghold, when at war. */
  assault: string | null;
}

export function moodWord(a: number): string {
  return a >= 60 ? 'devoted' : a >= 30 ? 'warm' : a >= 5 ? 'cordial' : a > -20 ? 'wary' : a > -50 ? 'hostile' : 'hateful';
}

export interface RealmView {
  factions: FactionView[];
  might: number;
  /** Dungeons the whole town could storm (assault destinations, with their names and what waits there). */
  dungeons: { dest: string; name: string; threats: string }[];
}

export function realmView(s: GameState, dungeonOpen: (id: string) => boolean): RealmView {
  const might = Math.round(townMight(s));
  const factions = realm(s).map((f): FactionView => {
    const d = defOf(f);
    const can: RealmOp[] = [];
    if (f.known && standing(f)) {
      can.push('gift');
      if (f.stance === 'war' || f.stance === 'neutral') can.push('peace');
      if (f.stance === 'peace') can.push('trade');
      if (f.stance === 'trade') can.push('alliance');
      if (['peace', 'trade', 'alliance'].includes(f.stance) && !f.married) can.push('marry');
      if (f.stance !== 'vassal') can.push('demand');
      if (f.stance === 'vassal') can.push('free');
      if (f.stance !== 'war') can.push('war');
    }
    return {
      id: f.id,
      name: f.known ? d.name : 'A power not yet met',
      known: f.known,
      lord: f.known ? lordName(f) : '?',
      stronghold: f.known ? d.stronghold : '?',
      temper: TEMPER_NAME[f.temper],
      stance: f.stance,
      stanceName: STANCE_NAME[f.stance],
      attitude: f.attitude,
      mood: moodWord(f.attitude),
      troops: Math.round(f.troops),
      folk: f.folk ?? 0,
      size: f.stance === 'destroyed' ? 'ruin' : townTier(f.folk ?? 0).name,
      tier: townTier(f.folk ?? 0).tier,
      married: !!f.married,
      host: f.host ? { hours: Math.max(0, Math.round((f.host.at - s.tick) / TICKS_PER_HOUR)), size: f.host.size } : null,
      beaten: f.beaten ?? 0,
      stormed: f.stormed ?? 0,
      can,
      assault: f.known && f.stance === 'war' ? ASSAULT_PREFIX + f.id : null,
    };
  });
  const dungeons = assaultTargets(s, dungeonOpen)
    .filter((id) => id.includes('dungeon:'))
    .map((dest) => {
      const d = assaultDestination(s, dest)!;
      return { dest, name: d.name, threats: d.threats };
    });
  return { factions, might, dungeons };
}
