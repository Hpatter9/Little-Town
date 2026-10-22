// Classes and levels (see data/classes.ts, data/levels.ts, data/paths.ts): who starts on which base calling, the level
// XP that everything earns, evolutions (a choice of two roads at each stage, put to the player or made by the town),
// what each class may wear and wield, the allies the callers bring to a fight, and what they do in raids.

import { ASCEND_DAILY, CLASS_DEFS, NECRO_RANGE, STAGE_LEVELS, TAME_EVERY, TAME_RANGE, type ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { tameChance, tamedMost, tamerPower } from '../data/taming';
import { FOUNDERS } from '../data/founders';
import { callingName, FOUNDER_CLASS } from '../data/founderClasses';
import { ITEM_BY_ID, type ItemDef } from '../data/items';
import { FOCI } from '../data/magic';
import { SPELLCASTERS } from '../data/spells';
import { LEVEL_SHARE_FIGHT, LEVEL_SHARE_WORK, levelOf, levelPower, MAX_LEVEL, stageOf, xpToLevel } from '../data/levels';
import { armsOf, BASE_PATHS, callingBases, founderRoot, lineage, PATH_BY_ID, PATHS, roadsFrom, type PathNode } from '../data/paths';
import { ORIGIN_CALLING_LEAN } from '../data/originCallings';
import { MYTHIC_CALLINGS, MYTHIC_HEIR_ODDS, MYTHIC_ODDS, MYTHIC_OMEN_ODDS, mythicId } from '../data/mythic';
import { MYTHIC_BASES, MYTHIC_PATHS } from '../data/paths';
import { FORK, FOUNDER_FORK } from '../data/pathLore';
import type { Skill } from '../data/skills';
import { hashSeed, mixSeed, Rng } from '../rng';
import { beginRecord, statsHourly } from './attributes';
import { isBeast, unitFighter, type Fighter } from './combat';
import { isChild } from './social';
import { campXY, notify, setOutcome, type GameState, type Person, type Prompt, type Raid, type Raider } from './state';
import { TICK_HZ, TICKS_PER_DAY, TICKS_PER_HOUR, calendarOf } from './time';
import { eventPicture } from '../data/eventScenes';
import { weatherAt } from './weather';
import { seaTown } from './sea';

/* ------------------------------------------------------------ who gets which class */

/** How strongly a class draws someone: its rarity, and how good they are at the skills it's drawn to. */
export function classPull(p: Person, cls: ClassId): number {
  const d = CLASS_DEFS[cls];
  const fit = 1 + Object.entries(d.affinity).reduce((n, [k, a]) => n + (a ?? 0) * (p.skills[k as Skill]?.level ?? 0), 0) / 6;
  return d.rarity * fit * fit;
}

/** The base callings open to someone: the eight shared ones, and (in a town run by its autopilot) the three of their
 *  own people's (data/originCallings.ts), each with its draw: how well their skills fit its archetype, their people's
 *  own leaned a little more (`ORIGIN_CALLING_LEAN`). */
export function basePulls(s: GameState, p: Person): [PathNode, number][] {
  const own = s.autopilot !== false ? callingBases(peopleFor(p, s)) : [];
  return [...BASE_PATHS, ...own].map((b) => [b, (classPull(p, b.cls) / CLASS_DEFS[b.cls].rarity) * (b.calling ? ORIGIN_CALLING_LEAN : 1)]);
}

/** Give someone their calling, once: one of the base paths open to them (`basePulls`), at random but weighted by how
 *  well their skills fit it (decided by the seed, so a town plays the same every time). */
export function assignClass(s: GameState, p: Person): ClassId {
  const rng = new Rng(mixSeed(hashSeed(s.seed), p.id * 7907 + 13));
  const pulls = basePulls(s, p);
  let roll = rng.next() * pulls.reduce((a, [, w]) => a + w, 0);
  let base = pulls[0][0];
  for (const [b, w] of pulls) {
    roll -= w;
    if (roll <= 0) {
      base = b;
      break;
    }
  }
  const mythic = mythicRoll(s, p);
  if (mythic) base = mythic;
  p.road = base.id;
  p.cls = base.cls;
  p.level ??= 1;
  p.stageSeen = 0;
  if (mythic) mythicBorn(s, p, mythic);
  return base.cls;
}

/* ------------------------------------------------------------ the mythic callings (data/mythic.ts) */

/** The chance someone taking their first calling takes a mythic one: `MYTHIC_ODDS`, the child of two ascended
 *  parents `MYTHIC_HEIR_ODDS`, the first after an ascension `MYTHIC_OMEN_ODDS` (the omen spent either way). */
export function mythicOdds(s: GameState, p: Person): number {
  const parents = (p.parents ?? []).map((id) => s.people.find((q) => q.id === id));
  if (parents.length >= 2 && parents.every((q) => q?.ascended)) return MYTHIC_HEIR_ODDS;
  return s.mythicOmen ? MYTHIC_OMEN_ODDS : MYTHIC_ODDS;
}
/** Whether someone taking their first calling is given a mythic one, and which (by how well they fit each): a side
 *  stream of their own, so the town's stream is untouched; only in a town run by its autopilot. */
export function mythicRoll(s: GameState, p: Person): PathNode | null {
  if (s.autopilot === false || !MYTHIC_BASES.length) return null;
  const odds = mythicOdds(s, p);
  if (s.mythicOmen) s.mythicOmen = false;
  const rng = new Rng(hashSeed(`${s.seed}:mythic:${p.id}`));
  if (!rng.chance(odds)) return null;
  const pulls = MYTHIC_BASES.map((b) => classPull(p, b.cls) / CLASS_DEFS[b.cls].rarity);
  let roll = rng.next() * pulls.reduce((a, b) => a + b, 0);
  for (let i = 0; i < MYTHIC_BASES.length; i++) if ((roll -= pulls[i]) <= 0) return MYTHIC_BASES[i];
  return MYTHIC_BASES[MYTHIC_BASES.length - 1];
}
/** A mythic calling comes among the town: their title, the news, and a line for the year's chronicle. */
export function mythicBorn(s: GameState, p: Person, base: PathNode): void {
  const t = MYTHIC_CALLINGS.find((m) => mythicId(m.base.id) === base.id);
  if (!t) return;
  const line = t.born.replaceAll('{name}', p.name).replaceAll('{town}', s.townName ?? 'the town');
  if (!(p.titles ??= []).includes(t.title)) p.titles.push(t.title);
  (s.mythics ??= []).push({ id: p.id, road: base.id, line, tick: s.tick });
  notify(s, `✨ ${line}`, true);
}
/** The year's chronicle lines for the mythic callings that came among the town since `since`. */
export function mythicYearLines(s: GameState, since: number): string[] {
  return (s.mythics ?? []).filter((m) => m.tick >= since).map((m) => m.line);
}

/* ------------------------------------------------------------ evolutions */

/** How long an evolution's question waits before they choose for themselves. */
export const EVOLVE_ASK_HOURS = 24;

/** The people someone is of, for the roads only their people may take: their own, else the town's. */
const peopleFor = (p: Person, s?: GameState) => p.origin ?? s?.origin ?? 'settlers';

/** The roads open to someone now: their node's branches once they have the level (and, for the ascended form, an
 *  ascension), their people's own road among them; empty when there's nothing to become yet. */
export function roadsOpen(p: Person, s?: GameState): PathNode[] {
  const node = p.road ? PATH_BY_ID[p.road] : undefined;
  if (!node || node.stage >= 4) return [];
  const next = node.stage + 1;
  if (levelOf(p) < STAGE_LEVELS[next]) return [];
  if (next === 4 && !p.ascended) return [];
  return roadsFrom(node.id, peopleFor(p, s));
}

/** They take a road: the node is theirs, and they fight as its archetype from now on. */
export function evolveTo(s: GameState, p: Person, node: PathNode, why?: string): void {
  p.road = node.id;
  p.cls = node.cls;
  p.stageSeen = node.stage;
  notify(s, `${why ? `${why}: ` : ''}${p.name} has become ${aCalling(node.name)} (level ${levelOf(p)})!`, true);
}

/** The road someone would take for themselves: the one whose archetype their skills fit best, with a little of
 *  their own whim (by the seed). */
export function chooseRoad(s: GameState, p: Person, roads: PathNode[]): PathNode {
  const rng = new Rng(mixSeed(hashSeed(s.seed), p.id * 131 + 7, roads.length));
  // (their people's own road draws them a little more)
  const pulls = roads.map((r) => classPull(p, r.cls) / CLASS_DEFS[r.cls].rarity + rng.next() * 0.6 + (r.origin ? 0.3 : 0));
  let best = 0;
  for (let i = 1; i < roads.length; i++) if (pulls[i] > pulls[best]) best = i;
  return roads[best];
}

/** Put an evolution to the player: the two roads, and letting them choose. */
export function askEvolve(s: GameState, p: Person, roads: PathNode[]): void {
  const node = PATH_BY_ID[p.road!];
  const cal = calendarOf(s);
  const base = lineage(node.id)[0];
  const scene = (base.founder ? FOUNDER_FORK : FORK[base.id] ?? '{name} stands where the road forks.').replaceAll('{name}', p.name);
  // (an origin road beside the shared ones is told as theirs alone; on a people's own calling every road is)
  const mine = roads.find((r) => r.origin && !r.calling);
  const own = !mine && node.calling ? ' Theirs is a calling of their own people: no one else walks these roads.' : '';
  const story = `${scene} ${p.name} the ${node.name} is level ${levelOf(p)} now, and ${roads.length === 2 ? 'two' : roads.length === 3 ? 'three' : roads.length} callings are open to them.${mine ? ` One of them, the ${mine.name}, is the road of their own people: no one else may walk it.` : own}`;
  s.prompts.push({
    id: s.nextId++,
    kind: 'evolve',
    expedition: null,
    title: `The road forks: ${p.name}`,
    text: `${node.name} → ${roads.map((r) => r.name).join(' or ')}`,
    story,
    picture: eventPicture(`evolve:${node.id}`, `${node.name} ${roads.map((r) => r.text).join(' ')} hall`, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: p.id,
    roads: roads.map((r) => r.id),
    options: [...roads.map((r) => r.name), 'Let them choose'],
    defaultOption: roads.length,
    expiresTick: s.tick + EVOLVE_ASK_HOURS * TICKS_PER_HOUR,
  });
  notify(s, `${p.name} is ready for promotion: ${roads.map((r) => r.name).join(' or ')}?`, true);
}

/** The player's answer (or the default: their own choice). */
export function answerEvolve(s: GameState, prompt: Prompt, option: number): void {
  const p = s.people.find((q) => q.id === prompt.who);
  if (!p || !p.road) return;
  const roads = (prompt.roads ?? []).map((id) => PATH_BY_ID[id]).filter((n): n is PathNode => !!n && n.from === p.road);
  if (!roads.length) return;
  const road = option >= 0 && option < roads.length ? roads[option] : chooseRoad(s, p, roads);
  evolveTo(s, p, road);
  setOutcome(s, prompt.title, option < roads.length ? road.name : 'Their own choice', `${p.name} is now ${aCalling(road.name)}: ${road.text.charAt(0).toLowerCase()}${road.text.slice(1).replace(/\.$/, '')}`);
}

/** Whether evolutions are put to the player (the Town menu's setting; never in a town run by hand: the tests). */
const asksEvolve = (s: GameState) => s.evolveAsk !== false && s.autopilot !== false;

/** A townsperson from before the paths (a class, no path): they take the node of their class nearest their stage,
 *  so an old save's knight is a Knight still. */
export function adoptPath(p: Person): void {
  if (!p.cls || p.road || p.fcls) return;
  const lv = levelOf(p);
  let st = 0;
  for (let i = 0; i < STAGE_LEVELS.length; i++) if (lv >= STAGE_LEVELS[i]) st = i;
  if (!p.ascended) st = Math.min(st, 3);
  // (the shared tree, and the Summoner's road, which grows from a mythic calling now)
  const ofClass = [...PATHS, ...MYTHIC_PATHS].filter((n) => n.cls === p.cls && !n.id.startsWith('my_'));
  const node = ofClass.find((n) => n.stage === st) ?? [...ofClass].sort((a, b) => Math.abs(a.stage - st) - Math.abs(b.stage - st))[0];
  if (!node) return;
  // (a node past their stage: the one of its line at their stage)
  let at: PathNode = node;
  while (at.stage > st && at.from) at = PATH_BY_ID[at.from];
  p.road = at.id;
  p.cls = at.cls;
  p.stageSeen = at.stage;
}

/** Someone rises to their class's last stage (from the daily chance, a quest or an event): on a path, the ascended
 *  form of where they stand. */
export function ascend(s: GameState, p: Person, why = 'Their power has grown past all measure'): void {
  if (p.ascended || !p.cls) return;
  p.ascended = true;
  // (an ascension stirs the old powers: the next to take a calling may take a mythic one)
  if (s.autopilot !== false) s.mythicOmen = true;
  if (p.road) {
    const [road] = roadsOpen(p);
    if (road) evolveTo(s, p, road, why);
    return;
  }
  p.stageSeen = stageOf(p);
  const name = callingName(p, stageOf(p))!;
  notify(s, `${why}: ${p.name} ascends, and is now ${aCalling(name)}!`, true);
}

/** Every hour: grown-ups without a calling are given one (newcomers, the newly grown, towns from before classes),
 *  those with the level for their next stage evolve (asked, or by their own choice), and stat points are spent. */
export function classesHourly(s: GameState): void {
  adoptFounderCalling(s);
  // (a question about a road no longer open: whoever it was for has gone, or moved on)
  s.prompts = s.prompts.filter((q) => q.kind !== 'evolve' || s.people.some((p) => p.id === q.who && q.roads?.every((r) => PATH_BY_ID[r]?.from === p.road)));
  for (const p of s.people) {
    if (isChild(p) || p.away !== null) continue;
    if (!p.cls) {
      const cls = assignClass(s, p);
      const node = PATH_BY_ID[p.road!];
      notify(s, `${p.name} is ${aCalling(node?.name ?? CLASS_DEFS[cls].stages[0])}.`);
      continue;
    }
    adoptPath(p);
    adoptFounderRoad(p);
    // (at the last stage's level, each day a small chance to ascend to it: decided by the seed)
    if (!p.ascended && levelOf(p) >= STAGE_LEVELS[4] && s.tick % TICKS_PER_DAY === 0 && new Rng(mixSeed(hashSeed(s.seed), p.id, s.tick)).chance(ASCEND_DAILY)) ascend(s, p);
    if (p.road) {
      const roads = roadsOpen(p, s);
      if (!roads.length) continue;
      if (roads.length === 1) evolveTo(s, p, roads[0]);
      else if (!asksEvolve(s)) evolveTo(s, p, chooseRoad(s, p, roads));
      else if (!s.prompts.some((q) => q.kind === 'evolve' && q.who === p.id)) askEvolve(s, p, roads);
      continue;
    }
    const st = stageOf(p);
    if (st > (p.stageSeen ?? 0)) {
      p.stageSeen = st;
      const name = callingName(p, st)!;
      notify(s, `${p.name} has become ${aCalling(name)} (level ${levelOf(p)})!`, true);
    }
  }
  statsHourly(s);
}

/** A founder from before their line had choices (a calling, no road): they stand on the line's own node of their
 *  stage, so an old save's Harvest Mother is a Harvest Mother still, and evolves by choice from there. */
export function adoptFounderRoad(p: Person): void {
  if (!p.fcls || p.road || !FOUNDER_CLASS[p.fcls]) return;
  const st = stageOf(p);
  let id = founderRoot(p.fcls);
  for (let i = 1; i <= st; i++) id += i === 4 ? '_x' : '_o';
  if (!PATH_BY_ID[id]) return;
  p.road = id;
  p.cls = PATH_BY_ID[id].cls;
  p.stageSeen = st;
}

/** A calling's name with 'a' or 'an' before it ('The Eternal Hearth' as it is). */
export const aCalling = (name: string) => (/^The /.test(name) ? name : `${/^[AEIOU]/.test(name) ? 'an' : 'a'} ${name}`);

/** A town founded before founders had callings of their own: its founder (always the first person) takes theirs,
 *  found by their look, keeping their level. */
function adoptFounderCalling(s: GameState): void {
  const p = s.people.find((q) => q.id === 1);
  if (!p || p.fcls !== undefined) return;
  const look = JSON.stringify(p.look);
  const def = Object.values(FOUNDERS).flat().find((f) => JSON.stringify(f.look) === look);
  const calling = def ? FOUNDER_CLASS[def.id] : undefined;
  p.fcls = calling?.id ?? null;
  if (!calling) return;
  p.cls = calling.base;
  p.level ??= 1;
  p.stageSeen = stageOf(p);
}

/* ------------------------------------------------------------ levels */

/** Level XP from skill XP (gainSkill calls it): fighting counts for more than work. */
export function gainLevelXp(p: Person, skill: Skill, xp: number): void {
  if (levelOf(p) >= MAX_LEVEL) return;
  p.lvXp = (p.lvXp ?? 0) + xp * (skill === 'melee' || skill === 'ranged' ? LEVEL_SHARE_FIGHT : LEVEL_SHARE_WORK);
  p.level ??= 1;
  while (p.level < MAX_LEVEL && p.lvXp >= xpToLevel(p.level)) {
    p.lvXp -= xpToLevel(p.level);
    // (the record of stat points begins at the first level gained: what came before is spent the class's way)
    beginRecord(p);
    p.level++;
  }
}

/** The share of the way to the next level. */
export const levelProgress = (p: Person) => (levelOf(p) >= MAX_LEVEL ? 1 : Math.min(1, (p.lvXp ?? 0) / xpToLevel(levelOf(p))));

/* ------------------------------------------------------------ gear by class */

/** Whether someone's class lets them wear or wield a piece: weapons by family, armour by weight (tools, torches,
 *  cloaks and charms, and anyone without a class yet: anything). */
export function canWear(p: Pick<Person, 'cls'> & { road?: string | null }, def: ItemDef | string): boolean {
  const d = typeof def === 'string' ? ITEM_BY_ID[def] : def;
  if (d && FOCI.includes(d.id)) return !!p.cls && SPELLCASTERS.has(p.cls); // (a focus only in a caster's hand: data/magic.ts)
  if (!p.cls || !d) return true;
  const c = CLASS_DEFS[p.cls];
  // (a people's own calling may wield its own kind of weapon too: data/originCallings.ts `arms`)
  if (d.slot === 'weapon' && d.family) return c.weapons.includes(d.family) || armsOf(p.road) === d.family;
  if (d.weight && d.weight !== 'trinket') return c.armour.includes(d.weight);
  return true;
}

/** The creature a caller brings to every fight: their path node's companion (a Beastcaller's lion, a Conjurer's
 *  salamander), else their archetype's (a Summoner's spirit, a Beast Tamer's wolf). */
export function companionOf(p: Pick<Person, 'cls' | 'road'>): string | null {
  const node = p.road ? PATH_BY_ID[p.road] : undefined;
  if (node?.companion) return node.companion;
  return p.cls === 'summoner' ? 'spirit' : p.cls === 'beast_tamer' ? 'companion_wolf' : null;
}

/** Allies a party brings into a battle: each caller's companion, as strong as its caller is seasoned. */
export function classAllies(members: Person[]): Fighter[] {
  const out: Fighter[] = [];
  for (const p of members) {
    if (p.hp <= 0 || p.downed) continue;
    const kind = companionOf(p);
    if (!kind || !ENEMIES[kind]) continue;
    const f = unitFighter(kind, 'party', -p.id * 10 - 1);
    const k = levelPower(p);
    f.maxHp = f.hp = Math.round(f.maxHp * k);
    f.damage = [Math.round(f.damage[0] * k), Math.round(f.damage[1] * k)];
    out.push(f);
  }
  return out;
}

/* ------------------------------------------------------------ raids at home */

const inTown = (s: GameState, cls: ClassId) => s.people.filter((p) => p.cls === cls && p.away === null && !p.downed);

/** An ally raider (summoned, raised or tamed) next to x. */
export function ally(s: GameState, kind: string, x: number, dir: 1 | -1, y = campXY(s).y): Raider {
  const d = ENEMIES[kind];
  return { id: s.nextId++, kind, x, y, dir, hp: d.hp, maxHp: d.hp, cooldown: 5, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm', ally: true, conjuredAt: s.tick };
}

/** When raiders arrive: each Summoner in town calls their companion (as strong as they are seasoned); each
 *  Necromancer calls one of the town's own dead up out of the graveyard (while there are graves to call on). */
export function summonForRaid(s: GameState, r: Raid): void {
  for (const p of inTown(s, 'summoner')) {
    const kind = companionOf(p) ?? 'spirit';
    const a = ally(s, ENEMIES[kind] ? kind : 'spirit', p.x, p.dir);
    const k = levelPower(p);
    a.hp = a.maxHp = Math.round(a.maxHp * k);
    a.might = k;
    r.raiders.push(a);
  }
  if (inTown(s, 'summoner').length) notify(s, 'The summoner\'s call is answered!');
  const yard = s.buildings.find((b) => b.def === 'graveyard' && b.status === 'done');
  const graves = s.graves ?? [];
  if (!yard || !graves.length) return;
  const necros = inTown(s, 'necromancer').slice(0, graves.length);
  necros.forEach((p, i) => {
    const g = graves[graves.length - 1 - i];
    const ghost = ally(s, 'grave_ghost', g.x, p.dir);
    ghost.risenFrom = g.name;
    r.raiders.push(ghost);
  });
  if (necros.length) notify(s, `The necromancer calls on the graveyard: ${necros.map((_, i) => graves[graves.length - 1 - i].name).join(' and ')} ${necros.length === 1 ? 'rises' : 'rise'} to defend the town once more.`, true);
}

/** Every tick of a raid: Necromancers raise the fallen, Beast Tamers win over wild beasts. */
export function classesInRaid(s: GameState, r: Raid): void {
  const necros = inTown(s, 'necromancer');
  if (necros.length) {
    for (const rd of r.raiders) {
      if (!rd.down || rd.ally || rd.raiseChecked) continue;
      rd.raiseChecked = true;
      if ((r.raised ?? 0) >= necros.length * 2) continue;
      if (!necros.some((p) => Math.abs(p.x - rd.x) <= NECRO_RANGE)) continue;
      if (rd.risenFrom) continue; // (the townsfolk the dead took stay at rest)
      rd.down = false;
      rd.ally = true;
      rd.hp = Math.round(rd.maxHp / 2);
      rd.fleeing = false;
      rd.carrying = {};
      rd.conjuredAt = s.tick;
      r.raised = (r.raised ?? 0) + 1;
      notify(s, `The necromancer raises the fallen ${ENEMIES[rd.kind].name.toLowerCase()} to fight for the town!`);
    }
  }
  // Beast Tamers try for the beasts in reach, and a try is a roll (data/taming.ts): their level, calling and way with
  // animals against the beast's might and kind, easier the more it's hurt, harder each time it's been tried
  const tamers = inTown(s, 'beast_tamer');
  if (tamers.length && s.tick >= (r.nextTame ?? 0)) {
    r.nextTame = s.tick + TAME_EVERY * TICK_HZ;
    for (const p of tamers) {
      const held = r.raiders.filter((rd) => rd.ally && rd.tamedBy === p.id && !rd.down && !rd.gone).length;
      if (held >= tamedMost(stageOf(p))) continue;
      const beast = r.raiders.find((rd) => !rd.down && !rd.gone && !rd.ally && isBeast(rd.kind) && !ENEMIES[rd.kind].boss && Math.abs(rd.x - p.x) <= TAME_RANGE && Math.abs(rd.y - p.y) <= TAME_RANGE);
      if (!beast) continue;
      const chance = tameChance(tamerPower(levelOf(p), stageOf(p), p.skills.animals?.level ?? 0), beast.kind, beast.maxHp, beast.hp, beast.tameTries ?? 0);
      const roll = (mixSeed(hashSeed(s.seed), beast.id, s.tick, p.id) >>> 0) / 4294967296;
      const name = ENEMIES[beast.kind].name.toLowerCase();
      if (roll >= chance) {
        beast.tameTries = (beast.tameTries ?? 0) + 1;
        if (beast.tameTries === 1) notify(s, `${p.name} tries to tame the ${name}, but it won't be had${chance < 0.15 ? ': it is far too wild' : ''}.`);
        continue;
      }
      beast.ally = true;
      beast.tamedBy = p.id;
      beast.fleeing = false;
      beast.conjuredAt = s.tick;
      notify(s, `${p.name} tames the ${name}${beast.tameTries ? ` at the ${beast.tameTries + 1}${beast.tameTries === 1 ? 'nd' : beast.tameTries === 2 ? 'rd' : 'th'} try` : ''}: it turns on the others!`);
    }
  }
}
