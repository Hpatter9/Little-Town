// The trade empire (the owner's ask: growing rich is a way to survive, beside arms; numbers in data/tradeEmpire.ts).
// Under the Trade direction, a town with a trade house (sim/markets.ts) founds **trading posts** at far markets on the
// world map: a post costs goods, coins and a few people (who go to staff it), and earns a cut of that market's trade
// each season. The town's own **caravans** (and **ships**, where the sea is open) run circuits home, to one or two
// posts and back, carrying what fetches more there and bringing back what is cheap there; the road's danger comes from
// the land between, the war, the guards; a lost caravan is lost: the goods and now and then the drivers. The merchant
// **guilds** offer deals (a monopoly on a good, a charter, a loan) the town takes up on its own, and a broken deal
// costs standing; a rich town draws merchants to settle. **Money buys safety**: tribute turns a raid of people back at
// a price that rises each time, mercenaries are hired for a season (they fight in the raid and eat pay), and a power
// can be paid for its protection. Posts are lost to bandits, to war, or to a power's decree (and the folk with them).
// All of it is the town's own (the autopilot on), on a side stream of the seed; the player sets nothing but the
// direction.

import type { BoatKind } from '../data/boats';
import { eraReached } from '../data/eras';
import { FACTION_BY_ID, STRONGHOLD_SPOTS } from '../data/factions';
import { eventPicture } from '../data/eventScenes';
import { TREASURY_KEEP } from '../data/economy';
import { DISTANCE_PREMIUM, FOOD_KEEP, GOODS_KEEP, MAKES_PRICE, ROBBED_TAKE, WANTS_PRICE } from '../data/markets';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../data/materials';
import { FOOD_VALUE } from '../data/people';
import { RAID_KIND_BY_ID } from '../data/raids';
import { OFFER_SCALE, WORTH } from '../data/trade';
import { MAP_HOME, MAP_SIZE } from '../data/worldMap';
import {
  BROKEN_STANDING,
  CALLED_BONUS,
  CARAVAN_HOUR,
  CARAVAN_LOAD,
  CARAVANS_BASE,
  CARGO_MARGIN,
  CHARTER_DAYS,
  CHARTER_FEE,
  CHARTER_SAFER,
  DEAL_EVERY_DAYS,
  DEALS_MOST,
  DRIVER_DIE,
  DRIVER_PAY,
  DRIVERS,
  EMPIRE_AWAY,
  EMPIRE_HOUR,
  GUILDS,
  HOME_FOLK_LEAST,
  KEPT_STANDING,
  LOAN_DAYS,
  LOAN_INTEREST,
  LOAN_PER_TIER,
  LOAN_WANT_BELOW,
  LOG_MOST,
  LOST_SHARE,
  LOST_SITE_DAYS,
  MERC_BASE,
  MERC_DAYS,
  MERC_FEE,
  MERC_KEEP,
  MERC_WAGE,
  MERCS_MOST,
  MONOPOLY_BONUS,
  MONOPOLY_DAYS,
  MONOPOLY_KEEP,
  MONOPOLY_POSTS,
  MONOPOLY_PRICE,
  MONOPOLY_RESENT,
  MONOPOLY_STOCK,
  MONOPOLY_SHORT_DAYS,
  POST_COINS,
  POST_CUT,
  POST_DECREE,
  POST_FOLK,
  POST_FOLK_DIE,
  POST_GAP_DAYS,
  POST_GOODS,
  POST_LEVEL_MULT,
  POST_LEVELS,
  POST_RAIDED,
  POST_WAR,
  POSTS_BASE,
  POSTS_MOST,
  PROTECT_DAYS,
  PROTECT_FEE,
  PROTECT_GOODWILL,
  PROTECT_KEEP,
  PROTECT_SAFER,
  PROTECT_TRIBUTE,
  RAID_LOOT,
  RAID_LOSES_POST,
  REGION_SITES,
  RICH_CHANCE,
  RICH_COINS,
  RICH_PER_SETTLER,
  ROAD_HOURS_PER_100,
  ROAD_LOST,
  ROBBED_SHARE,
  SAFE_GUARDS,
  SEA_STORM,
  SETTLERS_MOST,
  SHIP_SPEED,
  STANDING_FLOOR,
  TRIBUTE_BASE,
  TRIBUTE_KEEP,
  TRIBUTE_PER_RAIDER,
  TRIBUTE_PRIDE,
  TRIBUTE_RISE,
  TRIBUTE_SHARE,
  WAR_ROADS,
  type DealKind,
  type PostSite,
} from '../data/tradeEmpire';
import { hashSeed, Rng } from '../rng';
import { alignPush, orderPush } from './alignment';
import { depositNear, totalStock } from './buildings';
import { ally } from './classes';
import { shipKind } from './boats';
import { takeFromStorage } from './expeditions';
import { realm } from './factions';
import { killPerson } from './health';
import { minorWound } from './injuries';
import { buyPrice, makesOf, marketOf, sellPrice, tierOf, wantsOf } from './markets';
import { newcomer } from './powers';
import { noteFlow, priceOf } from './prices';
import { townEdgeX } from './raids';
import { seaTown } from './sea';
import { campX, campXY, earn, notify, townFull, type Faction, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from './time';
import { guardsOf } from './treasury';
import { weatherAt } from './weather';

export interface Post {
  id: string;
  site: string;
  name: string;
  x: number;
  y: number;
  founded: number;
  /** The townsfolk who went to staff it. */
  folk: number[];
  level: number;
  /** Everything it has earned, and this season's cuts so far; a caravan has called this season. */
  total: number;
  takings: number;
  called: boolean;
  sea: boolean;
}

export interface Stop {
  post: string;
  at: number;
  /** The cut of the sale there that the post keeps, credited when the caravan gets there. */
  cut: number;
  done?: boolean;
}

export interface EmpireCaravan {
  id: number;
  kind: 'caravan' | 'ship';
  start: number;
  /** The way: home, each stop, home; the tick it reaches each point. */
  path: { x: number; y: number }[];
  times: number[];
  stops: Stop[];
  /** Carried out, brought back, the purse brought back, and what the lot was worth at home when it set out. */
  out: Stock;
  back: Stock;
  purse: number;
  worth: number;
  drivers: number[];
  fate?: { at: number; kind: 'robbed' | 'lost' };
}

export interface Deal {
  id: number;
  kind: DealKind;
  guild: string;
  since: number;
  until: number;
  good?: Material;
  /** A loan: what is owed. A monopoly: days the town was short of the good running. */
  owed?: number;
  short?: number;
}

export interface EmpireState {
  posts: Post[];
  caravans: EmpireCaravan[];
  deals: Deal[];
  /** Standing with the merchant guilds. */
  standing: number;
  lastPost: number;
  lastDeal: number;
  /** Sites lost: the tick. */
  lost: Record<string, number>;
  /** The season being reckoned (a day count over the season's length), the takings it has had and the last one's. */
  season: number;
  seasonTakings: number;
  lastTakings: number;
  /** Tribute paid so far this age (it eases a step each season), and the coins. */
  tributes: number;
  tributePaid: number;
  /** The totals at the last chronicle (sim/empireYear.ts). */
  yearMark?: { made: number; sent: number; lostCaravans: number; lostWorth: number; founded: number; lostPosts: number; tributePaid: number };
  mercs?: { n: number; until: number; inRaid?: number; ids?: number[]; alive?: number };
  protection?: { power: string; until: number };
  handled?: number;
  settled: number;
  /** Lifetime: caravans sent, lost, the worth lost, posts founded and lost, coins made. */
  sent: number;
  lostCaravans: number;
  lostWorth: number;
  founded: number;
  lostPosts: number;
  made: number;
  log: string[];
}

export const empireOf = (s: GameState): EmpireState | undefined => s.empire;
const ensure = (s: GameState): EmpireState =>
  (s.empire ??= { posts: [], caravans: [], deals: [], standing: 0, lastPost: -1e9, lastDeal: -1e9, lost: {}, season: -1, seasonTakings: 0, lastTakings: 0, tributes: 0, tributePaid: 0, settled: 0, sent: 0, lostCaravans: 0, lostWorth: 0, founded: 0, lostPosts: 0, made: 0, log: [] });

const trading = (s: GameState) => s.autopilot !== false && s.direction === 'trade';
const roll = (s: GameState, ...salts: (string | number)[]) => new Rng(hashSeed(`${s.seed}:empire:${s.tick}:${salts.join(':')}`));
const day = (s: GameState) => calendarOf(s).day;
const seasonOf = (s: GameState) => Math.floor((day(s) - 1) / 10);
const nameOf = (m: Material) => MATERIAL_NAMES[m].toLowerCase();
const list = (st: Stock) =>
  (Object.entries(st) as [Material, number][])
    .filter(([, n]) => n > 0)
    .map(([m, n]) => `${n} ${nameOf(m)}`)
    .join(', ') || 'nothing';
const worthOf = (s: GameState, st: Stock) => (Object.entries(st) as [Material, number][]).reduce((t, [m, n]) => t + priceOf(s, m) * n, 0);
const scale = (s: GameState) => OFFER_SCALE[s.era] ?? 1;
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (id: string) => (FACTION_BY_ID[id]?.name ?? id).replace(/^The /, 'the ');

function log(s: GameState, e: EmpireState, text: string, key = false): void {
  e.log.unshift(`Day ${day(s)}: ${text}`);
  if (e.log.length > LOG_MOST) e.log.length = LOG_MOST;
  notify(s, `Trade empire: ${text.charAt(0).toLowerCase()}${text.slice(1)}`, key);
}

/** A tale for the event box: the first post, a post lost, a monopoly, a caravan lost with a fortune (a rare few). */
function tell(s: GameState, title: string, story: string, words: string): void {
  const cal = calendarOf(s);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: story.split('. ')[0] + '.',
    story,
    picture: eventPicture(`empire:${title}`, words, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: s.mainId,
    options: ['So be it'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
}

/* ------------------------------------------------------------ the far markets */

/** Every far market the town could set a post at: the regions' (once mapped) and the powers' (once met, not at war). */
export function sitesOf(s: GameState): PostSite[] {
  const out: PostSite[] = REGION_SITES.filter((r) => (s.regions ?? []).includes(r.region!) && eraReached(s.era, r.era));
  for (const f of realm(s)) {
    const at = STRONGHOLD_SPOTS[f.id];
    const def = FACTION_BY_ID[f.id];
    // (only a power at peace with the town, and warm to it, lets a stranger's post stand; never the bandits)
    if (!at || !def || !f.known || f.id === 'brotherhood' || !['peace', 'trade', 'alliance', 'vassal'].includes(f.stance) || f.attitude < 0) continue;
    out.push({ id: `power:${f.id}`, name: `${mid(f.id).replace(/^./, (c) => c.toUpperCase())} market`, x: at.x, y: at.y, era: 'neolithic', makes: makesOf(f), wants: wantsOf(s, f), base: 26, danger: 0.7 });
  }
  return out;
}
const powerOf = (s: GameState, siteId: string): Faction | undefined => (siteId.startsWith('power:') ? (s.factions ?? []).find((f) => `power:${f.id}` === siteId) : undefined);
const siteFor = (s: GameState, id: string): PostSite | undefined => sitesOf(s).find((q) => q.id === id) ?? (id.startsWith('power:') ? undefined : REGION_SITES.find((q) => q.id === id));
const canSail = (s: GameState) => seaTown(s) || (s.boats?.length ?? 0) > 0;

/** What a unit of a good fetches at a far market, and what it costs there. */
function sellAt(s: GameState, site: PostSite, m: Material): number {
  const f = powerOf(s, site.id);
  if (f) return sellPrice(s, f, m);
  const haggle = s.market ? tierOf(s.market.standing).tier.haggle : 0;
  const k = site.wants.includes(m) ? WANTS_PRICE : site.makes.includes(m) ? MAKES_PRICE : 1;
  return priceOf(s, m) * k * (1 + (DISTANCE_PREMIUM * dist(site, MAP_HOME)) / MAP_SIZE) * (1 + haggle);
}
function buyAt(s: GameState, site: PostSite, m: Material): number {
  const f = powerOf(s, site.id);
  if (f) return buyPrice(s, f, m);
  const haggle = s.market ? tierOf(s.market.standing).tier.haggle : 0;
  return priceOf(s, m) * (site.makes.includes(m) ? MAKES_PRICE : 1.15) * (1 - haggle);
}

const houseLevel = (s: GameState) => (s.market ? tierOf(s.market.standing).level : 0);
const hasDeal = (e: EmpireState, kind: DealKind) => e.deals.some((d) => d.kind === kind);
export const postsAllowed = (s: GameState, e: EmpireState) => Math.min(POSTS_MOST, POSTS_BASE + houseLevel(s) + (hasDeal(e, 'charter') ? 1 : 0));
export const caravansAllowed = (s: GameState) => CARAVANS_BASE + houseLevel(s);
/** The treasury less what is owed the guilds: what the empire may spend. */
const spare = (s: GameState, e: EmpireState) => (s.coins ?? 0) - e.deals.reduce((n, d) => n + (d.kind === 'loan' ? (d.owed ?? 0) : 0), 0);
const adultsHome = (s: GameState) => s.people.filter((p) => p.away === null && p.type !== 'child' && p.id !== s.mainId);
/** Who goes, `n` of `adults`, in `by` order: those with no partner at home first, then whole couples together (a couple
 *  split by the road has no children, and the partner at home is no help to the family loop in sim/social.ts either: two
 *  couples are held back instead of one), and a half couple only to make up the number. */
function sparest(adults: Person[], n: number, by: (a: Person, b: Person) => number): Person[] {
  const mate = (p: Person) => adults.find((q) => q.id === p.partner && q !== p);
  const sorted = [...adults].sort(by);
  const out: Person[] = sorted.filter((p) => !mate(p)).slice(0, n);
  for (const p of sorted) {
    const q = mate(p);
    if (out.length + 2 > n) break;
    if (q && !out.includes(p) && !out.includes(q)) out.push(p, q);
  }
  for (const p of sorted) if (out.length < n && !out.includes(p)) out.push(p);
  return out;
}

/* ------------------------------------------------------------ the posts */

function foundPost(s: GameState, e: EmpireState): void {
  const mk = marketOf(s);
  if (!mk || e.posts.length >= postsAllowed(s, e) || s.tick - e.lastPost < POST_GAP_DAYS * TICKS_PER_DAY) return;
  const adults = adultsHome(s);
  if (adults.length < HOME_FOLK_LEAST + POST_FOLK) return;
  if (spare(s, e) < POST_COINS + TREASURY_KEEP + 30) return;
  const stock = totalStock(s);
  if ((Object.entries(POST_GOODS) as [Material, number][]).some(([m, n]) => (stock[m] ?? 0) < n + 10)) return;
  const here = new Set(e.posts.map((p) => p.site));
  const sites = sitesOf(s)
    .filter((q) => !here.has(q.id) && (!e.lost[q.id] || s.tick - e.lost[q.id] > LOST_SITE_DAYS * TICKS_PER_DAY) && (!q.sea || canSail(s)))
    .map((q) => ({ q, score: q.base / (1 + q.danger * 0.3) / (1 + dist(q, MAP_HOME) / 500) }))
    .sort((a, b) => b.score - a.score || a.q.id.localeCompare(b.q.id));
  const site = sites[0]?.q;
  if (!site) return;
  // the folk who go: the best talkers of those the town can spare
  const folk = sparest(adults.filter((p) => p.hp > 0 && !p.downed), POST_FOLK, (a, b) => b.skills.social.level - a.skills.social.level || a.id - b.id);
  if (folk.length < POST_FOLK) return;
  s.coins = (s.coins ?? 0) - POST_COINS;
  earn(s, 'trade', -POST_COINS);
  for (const [m, n] of Object.entries(POST_GOODS) as [Material, number][]) takeFromStorage(s, m, n);
  for (const p of folk) {
    p.away = EMPIRE_AWAY;
    p.task = null;
  }
  const first = e.founded === 0;
  e.posts.push({ id: `p${s.nextId++}`, site: site.id, name: site.name, x: site.x, y: site.y, founded: s.tick, folk: folk.map((p) => p.id), level: 0, total: 0, takings: 0, called: false, sea: !!site.sea });
  e.lastPost = s.tick;
  e.founded++;
  log(s, e, `A trading post founded at ${site.name}, staffed by ${folk.map((p) => p.name).join(' and ')} (${POST_COINS} coins and ${list(POST_GOODS)}).`, true);
  if (first) tell(s, 'A trading post', `The town has founded its first trading post at ${site.name}. ${folk.map((p) => p.name).join(' and ')} went out with the wagon to staff it, and the town keeps a cut of that market's trade. The caravans will follow the road they cleared. Posts can be lost to bandits, to war, or to a lord's decree, and the folk with them.`, 'market trade road caravan');
}

function levelOf(total: number): number {
  let l = 0;
  for (let i = 0; i < POST_LEVELS.length; i++) if (total >= POST_LEVELS[i]) l = i;
  return l;
}

const monopolyMult = (e: EmpireState) => (hasDeal(e, 'monopoly') ? MONOPOLY_POSTS : 1);

/** The turn of the season: each post pays its season's takings. */
function reckon(s: GameState, e: EmpireState): void {
  let sum = 0;
  for (const p of e.posts) {
    const site = siteFor(s, p.site);
    const income = Math.round((site?.base ?? 16) * (1 + POST_LEVEL_MULT * p.level) * (p.called ? 1 + CALLED_BONUS : 1) * monopolyMult(e)) + Math.round(p.takings);
    p.total += income;
    const was = p.level;
    p.level = levelOf(p.total);
    p.takings = 0;
    p.called = false;
    sum += income;
    if (p.level > was) log(s, e, `${p.name} has grown into a ${['', 'busy', 'great'][p.level] ?? 'great'} market.`);
  }
  if (sum > 0) {
    s.coins = (s.coins ?? 0) + sum;
    earn(s, 'trade', sum);
    e.made += sum;
    log(s, e, `The season's takings from ${e.posts.length} post${e.posts.length > 1 ? 's' : ''}: ${sum} coins.`);
  }
  e.lastTakings = sum;
  e.seasonTakings = 0;
  // tribute eases a step; a rested guild forgives a little
  if (e.tributes > 0) e.tributes--;
  if (e.standing < 0) e.standing = Math.min(0, e.standing + 2);
}

/** A post is lost (to bandits, war or a decree); its folk die or walk home hurt. */
export function losePost(s: GameState, e: EmpireState, post: Post, why: 'bandits' | 'war' | 'decree', rng: Rng): void {
  e.posts.splice(e.posts.indexOf(post), 1);
  e.lost[post.site] = s.tick;
  e.lostPosts++;
  const died: string[] = [];
  const home: string[] = [];
  for (const id of post.folk) {
    const p = s.people.find((q) => q.id === id);
    if (!p || p.away !== EMPIRE_AWAY) continue;
    p.away = null;
    const odds = why === 'decree' ? POST_FOLK_DIE / 3 : POST_FOLK_DIE;
    if (rng.chance(odds)) {
      killPerson(s, p, `lost with the trading post at ${post.name}`);
      died.push(p.name);
    } else {
      const at = campXY(s);
      p.x = at.x;
      p.y = at.y;
      minorWound(s, p, 12, rng);
      home.push(p.name);
    }
  }
  const reason = why === 'bandits' ? 'burnt by bandits' : why === 'war' ? 'seized in the war' : 'closed by decree';
  log(s, e, `The trading post at ${post.name} was ${reason}.${died.length ? ` ${died.join(' and ')} did not come home.` : ''}${home.length ? ` ${home.join(' and ')} walked home.` : ''}`, true);
  tell(s, 'A trading post lost', `The post at ${post.name} is gone: ${reason}. ${died.length ? `${died.join(' and ')} died with it. ` : ''}${home.length ? `${home.join(' and ')} came home with what they could carry. ` : ''}The town will not try that market again for some time.`, 'market ruin fire war');
}

/** Each day, the dangers to the posts. */
function hazards(s: GameState, e: EmpireState): void {
  const guarded = guardsOf(s).length >= 2 || (e.mercs?.n ?? 0) > 0;
  const warring = (s.doom?.kind === 'war' && s.doom.phase === 'active') || (s.factions ?? []).some((f) => f.stance === 'war');
  for (const p of [...e.posts]) {
    const rng = roll(s, 'hazard', p.id);
    const f = powerOf(s, p.site);
    if (p.site.startsWith('power:')) {
      if (!f || f.stance === 'war' || f.stance === 'destroyed') {
        losePost(s, e, p, 'war', rng);
        continue;
      }
      const sour = f.attitude < -15 || (hasDeal(e, 'monopoly') && f.attitude < 0);
      if (e.protection?.power !== f.id && sour && rng.chance(POST_DECREE)) {
        losePost(s, e, p, 'decree', rng);
        continue;
      }
    } else if (warring && rng.chance(POST_WAR)) {
      losePost(s, e, p, 'war', rng);
      continue;
    }
    const site = siteFor(s, p.site);
    const odds = POST_RAIDED * (site?.danger ?? 1) * (guarded ? 0.5 : 1) * (e.protection ? PROTECT_SAFER : 1);
    if (rng.chance(odds)) {
      const loot = Math.round(p.takings * RAID_LOOT);
      p.takings -= loot;
      if (rng.chance(RAID_LOSES_POST)) losePost(s, e, p, 'bandits', rng);
      else log(s, e, `Bandits raided the post at ${p.name}${loot ? ` and took ${loot} coins' worth of the season's cut` : ''}.`);
    }
  }
}

/* ------------------------------------------------------------ the caravans */

const legHours = (from: { x: number; y: number }, to: { x: number; y: number }, ship: boolean) =>
  Math.max(3, Math.round(((dist(from, to) / 100) * ROAD_HOURS_PER_100) * (ship ? SHIP_SPEED : 1)));

interface Plan {
  posts: Post[];
  out: Stock;
  back: Stock;
  purse: number;
  cuts: number[];
  worth: number;
}

/** Trade a circuit on paper: what to carry, what sells at each stop, what is bought there, what comes home. */
function plan(s: GameState, posts: Post[]): Plan | null {
  const sites = posts.map((p) => siteFor(s, p.site));
  if (sites.some((q) => !q)) return null;
  const stock = totalStock(s);
  const room = Math.round(CARAVAN_LOAD * scale(s));
  // what the town can spare that fetches more at some stop, best margin first
  const margin = (m: Material) => Math.max(...sites.map((q) => sellAt(s, q!, m) / priceOf(s, m)));
  const spare = MATERIALS.filter((m) => m !== 'totem' && WORTH[m] && (stock[m] ?? 0) > (FOOD_VALUE[m] ? FOOD_KEEP : GOODS_KEEP) && margin(m) >= CARGO_MARGIN).sort((a, b) => margin(b) - margin(a) || a.localeCompare(b));
  const out: Stock = {};
  let left = room;
  for (const m of spare) {
    if (left <= 0) break;
    const n = Math.min(left, (stock[m] ?? 0) - (FOOD_VALUE[m] ? FOOD_KEEP : GOODS_KEEP), Math.ceil(room / 2));
    if (n > 0) {
      out[m] = n;
      left -= n;
    }
  }
  const worth = worthOf(s, out);
  if (worth < 25) return null;
  // along the road: sell what fetches more here, then buy what is cheap here with most of the purse
  const cargo: Stock = { ...out };
  let purse = 0;
  const cuts: number[] = [];
  const back: Stock = {};
  sites.forEach((q) => {
    let sales = 0;
    for (const m of Object.keys(cargo) as Material[]) {
      const n = cargo[m] ?? 0;
      if (n > 0 && sellAt(s, q!, m) / priceOf(s, m) >= CARGO_MARGIN) {
        sales += n * sellAt(s, q!, m);
        delete cargo[m];
      }
    }
    purse += sales;
    cuts.push(sales * POST_CUT);
    let budget = purse * 0.7;
    const cheap = q!.makes.slice().sort((a, b) => buyAt(s, q!, a) / priceOf(s, a) - buyAt(s, q!, b) / priceOf(s, b));
    let space = room - Object.values(cargo).reduce((n, k) => n + (k ?? 0), 0) - Object.values(back).reduce((n, k) => n + (k ?? 0), 0);
    for (const m of cheap) {
      const p = Math.max(0.5, buyAt(s, q!, m));
      const n = Math.min(Math.floor(budget / p), space, Math.ceil(room / 3));
      if (n > 0) {
        back[m] = (back[m] ?? 0) + n;
        budget -= n * p;
        purse -= n * p;
        space -= n;
      }
    }
  });
  for (const [m, n] of Object.entries(cargo) as [Material, number][]) back[m] = (back[m] ?? 0) + n; // (what didn't sell comes home)
  const gain = purse + worthOf(s, back) - worth;
  if (gain < worth * 0.12) return null;
  return { posts, out, back, purse: Math.round(purse), cuts, worth };
}

/** Danger on a leg of the road: bandits in the land, the war, the sea; less with guards, an ally, a charter or a power's word. */
function legRisk(s: GameState, e: EmpireState, from: { x: number; y: number }, to: PostSite | Post, ship: boolean): number {
  const site = 'site' in to ? siteFor(s, to.site) : to;
  let p = ROAD_LOST * (dist(from, to) / 100) * (site?.danger ?? 1);
  if (ship) p *= SEA_STORM;
  if ((s.doom?.kind === 'war' && s.doom.phase === 'active') || (s.factions ?? []).some((f) => f.stance === 'war')) p *= WAR_ROADS;
  if (guardsOf(s).length >= 2 || (e.mercs?.n ?? 0) > 0 || (s.factions ?? []).some((f) => f.stance === 'alliance')) p *= SAFE_GUARDS;
  if (hasDeal(e, 'charter')) p *= CHARTER_SAFER;
  if (e.protection) p *= PROTECT_SAFER;
  return p;
}

function dispatch(s: GameState, e: EmpireState): void {
  if (!marketOf(s) || e.caravans.length >= caravansAllowed(s)) return;
  const busy = new Set(e.caravans.flatMap((c) => c.stops.map((t) => t.post)));
  const idle = e.posts.filter((p) => !busy.has(p.id));
  if (!idle.length) return;
  const adults = adultsHome(s).filter((p) => p.hp > 0 && !p.downed);
  if (adults.length < HOME_FOLK_LEAST + DRIVERS) return;
  // the best circuit: one post, or two near each other
  const options: Post[][] = idle.map((p) => [p]);
  for (let i = 0; i < idle.length; i++) for (let j = i + 1; j < idle.length; j++) if (dist(idle[i], idle[j]) < 260) options.push([idle[i], idle[j]].sort((a, b) => dist(a, MAP_HOME) - dist(b, MAP_HOME)));
  let best: Plan | null = null;
  let bestScore = -1;
  for (const posts of options) {
    const pl = plan(s, posts);
    if (!pl) continue;
    const hours = posts.reduce((t, p, i) => t + legHours(i ? posts[i - 1] : MAP_HOME, p, p.sea), 0) + legHours(posts[posts.length - 1], MAP_HOME, posts[posts.length - 1].sea);
    const score = (pl.purse + worthOf(s, pl.back) - pl.worth) / hours;
    if (score > bestScore) {
      best = pl;
      bestScore = score;
    }
  }
  if (!best) return;
  launch(s, e, best, adults);
}

function launch(s: GameState, e: EmpireState, pl: Plan, adults: Person[]): void {
  const rng = roll(s, 'caravan');
  const ship = pl.posts.some((p) => p.sea);
  const drivers = sparest(adults, DRIVERS, (a, b) => a.id - b.id);
  for (const [m, n] of Object.entries(pl.out) as [Material, number][]) {
    takeFromStorage(s, m, n);
    noteFlow(s, m, n);
  }
  for (const p of drivers) {
    p.away = EMPIRE_AWAY;
    p.task = null;
  }
  const path = [MAP_HOME, ...pl.posts.map((p) => ({ x: p.x, y: p.y })), MAP_HOME];
  const times = [s.tick];
  let legs = 0;
  for (let i = 1; i < path.length; i++) {
    times.push(times[i - 1] + legHours(path[i - 1], path[i], ship) * TICKS_PER_HOUR);
    legs += legRisk(s, e, path[i - 1], pl.posts[Math.min(i, pl.posts.length) - 1], ship);
  }
  const id = s.nextId++;
  const c: EmpireCaravan = { id, kind: ship ? 'ship' : 'caravan', start: s.tick, path, times, stops: pl.posts.map((p, i) => ({ post: p.id, at: times[i + 1], cut: pl.cuts[i] })), out: pl.out, back: pl.back, purse: pl.purse, worth: pl.worth, drivers: drivers.map((p) => p.id) };
  // the dice are cast now and told as the road is travelled
  const r = rng.next();
  const lost = Math.min(0.5, legs * LOST_SHARE);
  const robbed = Math.min(0.5, legs * ROBBED_SHARE);
  if (r < lost) c.fate = { at: Math.round(times[0] + (times[times.length - 1] - times[0]) * (0.2 + 0.6 * rng.next())), kind: 'lost' };
  else if (r < lost + robbed) c.fate = { at: times[times.length - 1] - 1, kind: 'robbed' };
  e.caravans.push(c);
  e.sent++;
  notify(s, `A ${c.kind} sets out for ${pl.posts.map((p) => p.name).join(' and ')} with ${list(pl.out)}.`);
}

/** Hourly: stops reached, the road's fate, the ones that come home. */
function onTheRoad(s: GameState, e: EmpireState): void {
  for (const c of [...e.caravans]) {
    for (const t of c.stops) {
      if (!t.done && s.tick >= t.at && (!c.fate || c.fate.kind !== 'lost' || s.tick < c.fate.at || t.at <= c.fate.at)) {
        const p = e.posts.find((q) => q.id === t.post);
        t.done = true;
        if (p) {
          p.takings += t.cut;
          p.called = true;
          e.seasonTakings += t.cut;
        }
      }
    }
    if (c.fate?.kind === 'lost' && s.tick >= c.fate.at) {
      lostCaravan(s, e, c);
      continue;
    }
    if (s.tick >= c.times[c.times.length - 1]) comeHome(s, e, c);
  }
}

function lostCaravan(s: GameState, e: EmpireState, c: EmpireCaravan): void {
  e.caravans.splice(e.caravans.indexOf(c), 1);
  const rng = roll(s, 'lost', c.id);
  const died: string[] = [];
  for (const id of c.drivers) {
    const p = s.people.find((q) => q.id === id);
    if (!p || p.away !== EMPIRE_AWAY) continue;
    p.away = null;
    if (rng.chance(DRIVER_DIE)) {
      killPerson(s, p, `lost with a ${c.kind} on the trade road`);
      died.push(p.name);
    } else {
      const at = campXY(s);
      p.x = at.x;
      p.y = at.y;
      minorWound(s, p, 15, rng);
    }
  }
  e.lostCaravans++;
  e.lostWorth += Math.round(c.worth);
  const where = c.stops.map((t) => e.posts.find((q) => q.id === t.post)?.name).filter(Boolean).join(' and ');
  log(s, e, `A ${c.kind} bound for ${where || 'the far markets'} was lost on the road with ${list(c.out)}, worth ${Math.round(c.worth)} coins.${died.length ? ` ${died.join(' and ')} died with it.` : ''}`, true);
  if (c.worth >= 150 * scale(s)) tell(s, 'A caravan lost', `Word comes that the ${c.kind} to ${where || 'the far markets'} will not come home: ${list(c.out)} gone, and ${died.length ? `${died.join(' and ')} with it` : 'the drivers limping back on foot'}. It was a fortune to lose.`, 'caravan road ruin bandit');
}

function comeHome(s: GameState, e: EmpireState, c: EmpireCaravan): void {
  e.caravans.splice(e.caravans.indexOf(c), 1);
  const robbed = c.fate?.kind === 'robbed';
  const back: Stock = { ...c.back };
  let purse = c.purse;
  if (robbed) {
    purse = Math.round(purse * (1 - ROBBED_TAKE));
    for (const m of Object.keys(back) as Material[]) back[m] = Math.floor((back[m] ?? 0) * (1 - ROBBED_TAKE));
  }
  const left = depositNear(s, campX(s), back);
  // (what won't fit is sold off)
  for (const [m, k] of Object.entries(left) as [Material, number][]) {
    purse += Math.round(k * priceOf(s, m) * 0.75);
    back[m] = (back[m] ?? 0) - k;
  }
  const wages = c.drivers.length * DRIVER_PAY;
  const net = purse - wages;
  s.coins = (s.coins ?? 0) + net;
  earn(s, 'trade', net);
  for (const [m, n] of Object.entries(back) as [Material, number][]) noteFlow(s, m, -n);
  for (const id of c.drivers) {
    const p = s.people.find((q) => q.id === id);
    if (p?.away === EMPIRE_AWAY) {
      p.away = null;
      const at = campXY(s);
      p.x = at.x;
      p.y = at.y;
    }
  }
  const got = Math.round(net + worthOf(s, back));
  e.made += Math.max(0, got - Math.round(c.worth));
  const where = c.stops.map((t) => e.posts.find((q) => q.id === t.post)?.name).filter(Boolean).join(' and ');
  log(s, e, `The ${c.kind} from ${where || 'the far markets'} came home${robbed ? ', robbed on the road,' : ''} with ${Math.round(net)} coins${Object.values(back).some((n) => (n ?? 0) > 0) ? ` and ${list(back)}` : ''}: ${got >= c.worth ? `a profit of ${Math.round(got - c.worth)}` : `a loss of ${Math.round(c.worth - got)}`}.`);
  // a market stall's standing grows with the empire's profit too
  if (s.market) s.market.standing = Math.max(0, s.market.standing + Math.round((got - c.worth) * 0.5));
}

/* ------------------------------------------------------------ the guilds' deals */

function offerDeal(s: GameState, e: EmpireState): void {
  const mk = marketOf(s);
  if (!mk || e.deals.length >= DEALS_MOST || !e.posts.length || e.standing < STANDING_FLOOR) return;
  if (s.tick - e.lastDeal < DEAL_EVERY_DAYS * TICKS_PER_DAY) return;
  const rng = roll(s, 'deal');
  const coins = spare(s, e);
  const stock = totalStock(s);
  const kinds: DealKind[] = [];
  // (a loan only to a town that can plausibly pay it back: what it has and a season's takings cover the debt)
  const owing = Math.round(LOAN_PER_TIER * (1 + houseLevel(s)) * (1 + LOAN_INTEREST));
  if (!hasDeal(e, 'loan') && coins < LOAN_WANT_BELOW + TREASURY_KEEP && coins + e.lastTakings >= owing + TREASURY_KEEP) kinds.push('loan', 'loan');
  if (!hasDeal(e, 'charter') && coins >= CHARTER_FEE + TREASURY_KEEP + 80) kinds.push('charter');
  const surplus = MATERIALS.filter((m) => m !== 'totem' && m !== 'wood' && m !== 'stone' && WORTH[m] && !FOOD_VALUE[m] && (stock[m] ?? 0) >= MONOPOLY_STOCK).sort((a, b) => (stock[b] ?? 0) * priceOf(s, b) - (stock[a] ?? 0) * priceOf(s, a) || a.localeCompare(b));
  if (!hasDeal(e, 'monopoly') && surplus.length) kinds.push('monopoly', 'monopoly');
  if (!kinds.length) return;
  const kind = rng.pick(kinds);
  const guild = rng.pick([...GUILDS]);
  const d: Deal = { id: s.nextId++, kind, guild, since: s.tick, until: s.tick + (kind === 'monopoly' ? MONOPOLY_DAYS : kind === 'charter' ? CHARTER_DAYS : LOAN_DAYS) * TICKS_PER_DAY };
  e.lastDeal = s.tick;
  if (kind === 'monopoly') {
    d.good = surplus[0];
    d.short = 0;
    mk.swings.push({ m: d.good, kind: 'boom', mult: MONOPOLY_PRICE, until: d.until, why: `${guild} hold the monopoly` });
    for (const f of s.factions ?? []) if (f.known && f.stance !== 'alliance' && f.stance !== 'destroyed') f.attitude = Math.max(-100, f.attitude - MONOPOLY_RESENT);
    log(s, e, `${guild} grant a monopoly on ${nameOf(d.good)} for ${MONOPOLY_DAYS} days: the price rises and the posts earn more, but the town must keep ${MONOPOLY_KEEP} in store. The other powers resent it.`, true);
    tell(s, 'A monopoly', `${guild} have given the town the sole right to sell ${nameOf(d.good)} in the realm's markets for ${MONOPOLY_DAYS} days. Prices climb and the posts grow fat, but rival merchants and the lords who protect them take it ill, and the guild will want ${MONOPOLY_KEEP} ${nameOf(d.good)} always on hand: break the bargain and the guilds will remember it.`, 'merchant guild contract gold');
  } else if (kind === 'charter') {
    if (coins < CHARTER_FEE + TREASURY_KEEP) return;
    s.coins = (s.coins ?? 0) - CHARTER_FEE;
    earn(s, 'trade', -CHARTER_FEE);
    log(s, e, `${guild} sell the town a charter for ${CHARTER_FEE} coins: one more post allowed and safer roads for ${CHARTER_DAYS} days.`, true);
  } else {
    d.owed = Math.round(LOAN_PER_TIER * (1 + houseLevel(s)) * (1 + LOAN_INTEREST));
    const lent = Math.round(d.owed / (1 + LOAN_INTEREST));
    s.coins = (s.coins ?? 0) + lent;
    earn(s, 'trade', lent);
    log(s, e, `${guild} lend the town ${lent} coins, ${d.owed} to be paid back in ${LOAN_DAYS} days.`, true);
  }
  e.deals.push(d);
}

/** Each day: deals are kept or broken, and run out. */
function dealsDaily(s: GameState, e: EmpireState): void {
  const mk = s.market;
  for (const d of [...e.deals]) {
    const breach = (why: string) => {
      e.standing += BROKEN_STANDING;
      e.deals.splice(e.deals.indexOf(d), 1);
      if (mk && d.good) mk.swings = mk.swings.filter((w) => !(w.m === d.good && w.why.includes(d.guild)));
      log(s, e, `The town broke its bargain with ${d.guild}: ${why}. The guilds' trust falls.`, true);
      // (a broken word shows in the town's alignment too: sim/alignment.ts)
      alignPush(s, -3, 'A broken deal');
      orderPush(s, -2, 'A broken deal');
    };
    if (d.kind === 'monopoly' && d.good) {
      if ((totalStock(s)[d.good] ?? 0) < MONOPOLY_KEEP) d.short = (d.short ?? 0) + 1;
      else d.short = 0;
      if ((d.short ?? 0) >= MONOPOLY_SHORT_DAYS) {
        breach(`there was no ${nameOf(d.good)} to supply`);
        continue;
      }
      if (day(s) % 3 === 0) for (const f of s.factions ?? []) if (f.known && f.stance !== 'alliance' && f.stance !== 'destroyed') f.attitude = Math.max(-100, f.attitude - 1);
    }
    if (d.kind === 'loan' && d.owed && (s.coins ?? 0) >= d.owed + TREASURY_KEEP && s.tick >= d.until - TICKS_PER_DAY) {
      s.coins = (s.coins ?? 0) - d.owed;
      earn(s, 'trade', -d.owed);
      e.deals.splice(e.deals.indexOf(d), 1);
      e.standing += KEPT_STANDING;
      log(s, e, `Paid back ${d.guild}: ${d.owed} coins.`);
      continue;
    }
    if (s.tick < d.until) continue;
    if (d.kind === 'loan') {
      const paid = Math.max(0, Math.min(s.coins ?? 0, d.owed ?? 0));
      s.coins = (s.coins ?? 0) - paid;
      earn(s, 'trade', -paid);
      breach(`${paid} of the ${d.owed} coins owed were all the town could pay`);
      const post = e.posts.slice().sort((a, b) => b.total - a.total)[0];
      if (post) losePost(s, e, post, 'decree', roll(s, 'attach', d.id));
      continue;
    }
    e.deals.splice(e.deals.indexOf(d), 1);
    e.standing += KEPT_STANDING;
    if (d.kind === 'monopoly') {
      s.coins = (s.coins ?? 0) + MONOPOLY_BONUS;
      earn(s, 'trade', MONOPOLY_BONUS);
      log(s, e, `The monopoly on ${d.good ? nameOf(d.good) : 'goods'} ran its course; ${d.guild} paid the town ${MONOPOLY_BONUS} coins and think well of it.`);
    } else log(s, e, `The charter from ${d.guild} has run out.`);
  }
}

/** A rich town draws merchants to settle. */
function richTown(s: GameState, e: EmpireState): void {
  if (!e.posts.length || e.settled >= SETTLERS_MOST || townFull(s)) return;
  if ((s.coins ?? 0) < RICH_COINS + e.settled * RICH_PER_SETTLER) return;
  const rng = roll(s, 'rich');
  if (!rng.chance(RICH_CHANCE)) return;
  const p = newcomer(s, rng, 'wanderer', 'a merchant, drawn by the town\'s wealth and its far markets, has settled here.');
  p.skills.social.level += 4;
  e.settled++;
  log(s, e, `${p.name}, a merchant drawn by the town's wealth, settles here.`);
}

/* ------------------------------------------------------------ money buys safety */

/** The price of turning a raid back, now. */
export function tributeFor(e: EmpireState, raiders: number): number {
  return Math.round((TRIBUTE_BASE + raiders * TRIBUTE_PER_RAIDER) * (1 + TRIBUTE_RISE * e.tributes) * (e.protection ? PROTECT_TRIBUTE : 1));
}

/** Every tick (from sim.ts, after a raid may have started): a new raid is bought off or meets the hired swords; the
 *  mercenaries who fall are counted when it ends. */
export function empireTick(s: GameState): void {
  const e = s.empire;
  if (!e || s.autopilot === false) return;
  const m = e.mercs;
  if (m?.inRaid !== undefined) {
    if (s.raid && s.raid.id === m.inRaid) m.alive = (s.raid.raiders.filter((r) => m.ids?.includes(r.id) && !r.down && !r.gone && r.hp > 0)).length;
    else {
      const fallen = Math.max(0, (m.ids?.length ?? 0) - (m.alive ?? 0));
      m.inRaid = undefined;
      m.ids = undefined;
      if (fallen) {
        m.n = Math.max(0, m.n - fallen);
        log(s, e, `${fallen} hired sword${fallen > 1 ? 's' : ''} fell in the raid.`);
        if (m.n === 0) e.mercs = undefined;
      }
    }
  }
  const r = s.raid;
  if (!r || r.phase !== 'warning' || r.veil || e.handled === r.id) return;
  e.handled = r.id;
  if (trading(s) && payTribute(s, e)) return;
  if (m && m.n > 0 && s.tick < m.until) {
    const ids: number[] = [];
    for (let i = 0; i < m.n; i++) {
      const a = ally(s, i % 3 === 2 ? 'bandit_archer' : 'soldier', townEdgeX(s, r.side), r.side < 0 ? -1 : 1);
      r.raiders.push(a);
      ids.push(a.id);
    }
    m.inRaid = r.id;
    m.ids = ids;
    m.alive = ids.length;
    notify(s, `${m.n} hired swords take their places beside the town.`);
  }
}

function payTribute(s: GameState, e: EmpireState): boolean {
  const r = s.raid!;
  const kind = RAID_KIND_BY_ID[r.kind];
  if (!kind || (kind.steals === undefined && !kind.bribable) || r.host || r.calamity || r.saga || r.kind === 'hunters') return false;
  const coins = spare(s, e);
  const price = tributeFor(e, r.raiders.filter((q) => !q.ally).length);
  if (price > coins * TRIBUTE_SHARE || coins - price < TREASURY_KEEP + TRIBUTE_KEEP) return false;
  if (roll(s, 'pride', r.id).chance(TRIBUTE_PRIDE)) return false; // (the council will not be made to pay)
  s.coins = (s.coins ?? 0) - price;
  earn(s, 'trade', -price);
  e.tributes++;
  e.tributePaid += price;
  if (r.prompt !== null) s.prompts = s.prompts.filter((q) => q.id !== r.prompt);
  s.raid = null;
  log(s, e, `The ${kind.name.toLowerCase()} took ${price} coins in tribute and turned back before they reached the town. They will want more next time.`, true);
  return true;
}

/** At the turn of the season: hire swords, pay a power for its word. */
function safety(s: GameState, e: EmpireState): void {
  if (!trading(s)) return;
  const coins = spare(s, e);
  // hired swords: a season at a time, a fee each
  if (!e.mercs || s.tick >= e.mercs.until) {
    e.mercs = undefined;
    const n = Math.min(MERCS_MOST, MERC_BASE + houseLevel(s) + Math.floor(e.posts.length / 2));
    // (only when the purse covers the whole term: a fee each and their wages)
    if (day(s) >= 4 && coins >= n * (MERC_FEE + MERC_WAGE * MERC_DAYS) + MERC_KEEP + TREASURY_KEEP) {
      s.coins = (s.coins ?? 0) - n * MERC_FEE;
      earn(s, 'trade', -n * MERC_FEE);
      e.mercs = { n, until: s.tick + MERC_DAYS * TICKS_PER_DAY };
      log(s, e, `${n} swords hired for ${MERC_DAYS} days (${n * MERC_FEE} coins, then ${MERC_WAGE} a head a day).`);
    }
  }
  // a power's protection
  if ((!e.protection || s.tick >= e.protection.until) && (e.posts.length || e.tributes)) {
    e.protection = undefined;
    const cost = PROTECT_FEE * (1 + houseLevel(s));
    const pick = (s.factions ?? [])
      .filter((f) => f.known && f.stance !== 'war' && f.stance !== 'destroyed' && f.attitude >= -10)
      .sort((a, b) => b.troops - a.troops || a.id.localeCompare(b.id))[0];
    if (pick && spare(s, e) >= cost + PROTECT_KEEP + TREASURY_KEEP) {
      s.coins = (s.coins ?? 0) - cost;
      earn(s, 'trade', -cost);
      pick.attitude = Math.min(100, pick.attitude + PROTECT_GOODWILL);
      e.protection = { power: pick.id, until: s.tick + PROTECT_DAYS * TICKS_PER_DAY };
      log(s, e, `${(FACTION_BY_ID[pick.id]?.name ?? pick.id)} will keep the roads and the posts for ${PROTECT_DAYS} days, for ${cost} coins.`);
    }
  }
}

/** Each day, the hired swords are paid (or leave). */
function wages(s: GameState, e: EmpireState): void {
  const m = e.mercs;
  if (m) {
    const due = m.n * MERC_WAGE;
    if (spare(s, e) >= due + TREASURY_KEEP) {
      s.coins = (s.coins ?? 0) - due;
      earn(s, 'trade', -due);
    } else {
      e.mercs = undefined;
      log(s, e, 'The hired swords left, unpaid.');
    }
  }
  if (e.protection) {
    const f = (s.factions ?? []).find((q) => q.id === e.protection!.power);
    if (!f || f.stance === 'war' || f.stance === 'destroyed') e.protection = undefined;
  }
}

/* ------------------------------------------------------------ the day */

/** Hourly from sim.ts. */
export function empireHourly(s: GameState): void {
  if (s.autopilot === false || s.tick % TICKS_PER_HOUR !== 0) return;
  let e = s.empire;
  if (!e) {
    if (!trading(s) || !marketOf(s)) return;
    e = ensure(s);
    e.season = seasonOf(s);
  }
  onTheRoad(s, e);
  const hour = calendarOf(s).hour;
  if (hour === EMPIRE_HOUR) {
    if (seasonOf(s) !== e.season) {
      e.season = seasonOf(s);
      reckon(s, e);
    }
    hazards(s, e);
    dealsDaily(s, e);
    wages(s, e);
    if (trading(s)) {
      offerDeal(s, e);
      richTown(s, e);
      foundPost(s, e);
    }
    if (!e.mercs || s.tick >= e.mercs.until) safety(s, e);
  }
  if (hour === CARAVAN_HOUR && trading(s)) dispatch(s, e);
}

/* ------------------------------------------------------------ the view */

export interface EmpireView {
  posts: { id: string; name: string; level: number; total: number; takings: number; folk: string[]; sea: boolean; age: number; called: boolean; caravan: boolean }[];
  allowed: number;
  caravans: { id: number; kind: 'caravan' | 'ship'; to: string; hoursLeft: number; carrying: string; coins: number; worth: number }[];
  deals: { kind: DealKind; guild: string; text: string; days: number }[];
  standing: number;
  safety: { tributes: number; nextTribute: number; tributePaid: number; mercs: { n: number; days: number } | null; protection: { power: string; days: number } | null };
  season: { so_far: number; last: number };
  totals: { sent: number; lostCaravans: number; lostWorth: number; founded: number; lostPosts: number; made: number; settled: number };
  log: string[];
}

export function empireView(s: GameState): EmpireView | null {
  const e = s.empire;
  if (!e) return null;
  const days = (t: number) => Math.max(0, Math.ceil((t - s.tick) / TICKS_PER_DAY));
  const busy = new Set(e.caravans.flatMap((c) => c.stops.map((t) => t.post)));
  return {
    posts: e.posts.map((p) => ({ id: p.id, name: p.name, level: p.level, total: Math.round(p.total), takings: Math.round(p.takings), folk: p.folk.map((id) => s.people.find((q) => q.id === id)?.name ?? '?'), sea: p.sea, age: Math.floor((s.tick - p.founded) / TICKS_PER_DAY), called: p.called, caravan: busy.has(p.id) })),
    allowed: postsAllowed(s, e),
    caravans: e.caravans.map((c) => ({ id: c.id, kind: c.kind, to: c.stops.map((t) => e.posts.find((q) => q.id === t.post)?.name ?? '?').join(' and '), hoursLeft: Math.max(0, Math.ceil((c.times[c.times.length - 1] - s.tick) / TICKS_PER_HOUR)), carrying: list(s.tick < (c.times[1] ?? 0) ? c.out : c.back), coins: c.purse, worth: Math.round(c.worth) })),
    deals: e.deals.map((d) => ({
      kind: d.kind,
      guild: d.guild,
      days: days(d.until),
      text: d.kind === 'monopoly' ? `Sole right to sell ${d.good ? nameOf(d.good) : 'a good'} (price up, posts earn more; keep ${MONOPOLY_KEEP} in store)` : d.kind === 'charter' ? 'A charter: one more post and safer roads' : `A loan: ${d.owed} coins to pay back`,
    })),
    standing: e.standing,
    safety: {
      tributes: e.tributes,
      nextTribute: tributeFor(e, 6),
      tributePaid: e.tributePaid,
      mercs: e.mercs ? { n: e.mercs.n, days: days(e.mercs.until) } : null,
      protection: e.protection ? { power: FACTION_BY_ID[e.protection.power]?.name ?? e.protection.power, days: days(e.protection.until) } : null,
    },
    season: { so_far: Math.round(e.seasonTakings), last: e.lastTakings },
    totals: { sent: e.sent, lostCaravans: e.lostCaravans, lostWorth: e.lostWorth, founded: e.founded, lostPosts: e.lostPosts, made: Math.round(e.made), settled: e.settled },
    log: e.log,
  };
}

/** The empire on the world map: the posts and the roads to them, and each caravan on the leg it is on. */
export function empireOnMap(s: GameState): { posts: { id: string; name: string; x: number; y: number; level: number; sea: boolean }[]; moves: { kind: 'caravan' | 'ship'; boat?: BoatKind; from: { x: number; y: number }; to: { x: number; y: number }; t: number; label: string }[] } | null {
  const e = s.empire;
  if (!e || (!e.posts.length && !e.caravans.length)) return null;
  const boat = e.caravans.some((c) => c.kind === 'ship') ? shipKind(s) : undefined;
  const moves = e.caravans.map((c) => {
    let i = 1;
    while (i < c.times.length - 1 && s.tick >= c.times[i]) i++;
    const t = Math.max(0, Math.min(1, (s.tick - c.times[i - 1]) / Math.max(1, c.times[i] - c.times[i - 1])));
    const toward = i < c.path.length - 1 ? e.posts.find((q) => q.id === c.stops[i - 1]?.post)?.name : 'home';
    return { kind: c.kind, ...(c.kind === 'ship' ? { boat } : {}), from: c.path[i - 1], to: c.path[i], t, label: `Our ${c.kind} ${i < c.path.length - 1 ? 'to' : 'bound'} ${toward ?? 'a far market'}: ${list(s.tick < (c.times[1] ?? 0) ? c.out : c.back)}` };
  });
  return { posts: e.posts.map((p) => ({ id: p.id, name: p.name, x: p.x, y: p.y, level: p.level, sea: p.sea })), moves };
}
