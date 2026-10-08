// Cutscenes queued by the sim (data/cutscenes.ts holds the scripts; renderer/cutscene/ plays them). A big moment (the
// Calamity waking, each of its stages, the last siege won or lost, its heart broken; the first nest found and burned
// out; the dragon come and slain; a saga ended well; the founding) queues its scene with the cast filled from the town
// as it is then (`castFor`: the founder, the best fighter, a joker and a worrier by their natures, the oldest; the
// Calamity's avatar and the dragon by their enemy ids; their names, looks and gear kept, so the scene plays the same
// even if someone dies before it's watched) and the words it needs (the town's name, the Calamity's, the nest's...).
// The player is offered it (the strip's card): **Watch** pauses the town and plays it full screen; **Skip** drops it.
// A scene may carry the event box's telling (`fallback`): put to the player if the scene is skipped or left, dropped
// if it's watched. Each scene watched or skipped is kept to watch again (`s.scenesSeen`). A scene left
// `SCENE_WAIT_HOURS` lapses (its telling still comes).

import { CALAMITIES } from '../data/calamity';
import { CUTSCENES } from '../data/cutscenes';
import { levelOf } from '../data/levels';
import { natureOf } from '../data/natures';
import type { Look } from '../data/people';
import type { Slot } from '../data/items';
import { notify, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_HOUR } from './time';
import { isChild } from './social';
import { ageDays } from './ageing';

/** A scene waits this long to be watched; at most so many wait at once; so many are kept to watch again. */
export const SCENE_WAIT_HOURS = 12;
export const SCENES_WAITING = 3;
export const SCENES_KEPT = 30;

/** Someone in a scene, as they were when it was queued. */
export interface SceneActor {
  /** A townsperson's id (their look and gear with it), or a foe's enemy id. */
  person?: number;
  name: string;
  look?: Look;
  gear?: Partial<Record<Slot, string>>;
  foe?: string;
}

export interface SceneRun {
  key: number;
  id: string;
  title: string;
  tick: number;
  /** Each cast member by the script's actor id. */
  cast: Record<string, SceneActor>;
  /** The words its lines are filled with. */
  vars: Record<string, string>;
  /** The event box's telling, put to the player if the scene isn't watched. */
  fallback?: Prompt;
}

const actorOf = (p: Person): SceneActor => ({ person: p.id, name: p.name, look: p.look, gear: { ...p.gear } });

/** The town's people for a scene's roles: the founder; its best fighter; a joker (a cheerful, jolly or curious soul) and
 *  a worrier (a gloomy, shy or stern one), each someone else where the town has them; and its oldest. */
export function castFor(s: GameState): Partial<Record<'founder' | 'hero' | 'wit' | 'worrier' | 'elder', Person>> {
  const folk = s.people.filter((p) => !isChild(p));
  if (!folk.length) return {};
  const founder = folk.find((p) => p.id === s.mainId) ?? folk[0];
  const used = new Set<number>([founder.id]);
  const pick = (score: (p: Person) => number): Person => {
    const free = folk.filter((p) => !used.has(p.id));
    const best = (free.length ? free : folk).slice().sort((a, b) => score(b) - score(a) || a.id - b.id)[0];
    used.add(best.id);
    return best;
  };
  const fight = (p: Person) => levelOf(p) * 3 + p.skills.melee.level + p.skills.ranged.level;
  const hero = pick(fight);
  const wit = pick((p) => (['cheerful', 'jolly', 'curious', 'restless'].includes(natureOf(p).id) ? 100 : 0) + p.skills.social.level);
  const worrier = pick((p) => (['gloomy', 'shy', 'stern', 'pious'].includes(natureOf(p).id) ? 100 : 0) - p.skills.melee.level);
  const elder = folk.slice().sort((a, b) => ageDays(s, b) - ageDays(s, a))[0];
  return { founder, hero, wit, worrier, elder };
}

/** Queue a scene (by its script's id), its cast filled from the town, with extra words and foes. Null when there's no
 *  script by that id, or nobody in the town to play it. */
export function queueScene(s: GameState, id: string, opts: { vars?: Record<string, string>; foes?: Record<string, string>; fallback?: Prompt; people?: Partial<Record<'hero' | 'wit' | 'worrier', Person>> } = {}): SceneRun | null {
  const script = CUTSCENES[id];
  const town = { ...castFor(s), ...opts.people };
  if (!script || !town.founder) {
    if (opts.fallback) s.prompts.push(opts.fallback);
    return null;
  }
  const calamity = s.calamity ? CALAMITIES[s.calamity.kind] : null;
  const vars: Record<string, string> = {
    town: 'the town',
    founder: town.founder.name,
    hero: town.hero?.name ?? town.founder.name,
    wit: town.wit?.name ?? town.founder.name,
    worrier: town.worrier?.name ?? town.founder.name,
    elder: town.elder?.name ?? town.founder.name,
    ...(calamity ? { calamity: calamity.name, heart: calamity.heart, cult: calamity.cult } : {}),
    ...opts.vars,
  };
  const cast: Record<string, SceneActor> = {};
  for (const [actor, member] of Object.entries(script.cast)) {
    const role = member.role;
    if (role.startsWith('foe:')) {
      const foe = role.slice(4).replace(/\{(\w+)\}/g, (_, k: string) => opts.foes?.[k] ?? vars[k] ?? k);
      cast[actor] = { foe, name: foe };
    } else if (role === 'avatar' || role === 'dragon') {
      const foe = opts.foes?.[role] ?? (role === 'avatar' && calamity ? calamity.avatar : undefined);
      if (foe) cast[actor] = { foe, name: vars[role] ?? foe };
    } else {
      const p = town[role as keyof typeof town];
      if (p) cast[actor] = actorOf(p);
    }
  }
  const key = (s.nextSceneKey ??= 1);
  s.nextSceneKey++;
  const run: SceneRun = { key, id, title: script.title, tick: s.tick, cast, vars, ...(opts.fallback ? { fallback: opts.fallback } : {}) };
  const q = (s.scenes ??= []);
  q.push(run);
  // (too many waiting: the oldest lapses, and its telling comes)
  while (q.length > SCENES_WAITING) lapse(s, q.shift()!);
  notify(s, `A scene to watch: ${script.title}.`);
  return run;
}

/** A scene not watched: its telling comes instead, and it's kept to watch later. */
function lapse(s: GameState, r: SceneRun): void {
  // (its telling, with as long to answer as it had when the scene was queued)
  if (r.fallback) s.prompts.push({ ...r.fallback, ...(r.fallback.expiresTick !== undefined ? { expiresTick: s.tick + (r.fallback.expiresTick - r.tick) } : {}) });
  keep(s, r);
}

function keep(s: GameState, r: SceneRun): void {
  const seen = (s.scenesSeen ??= []);
  if (!seen.some((q) => q.key === r.key)) seen.push({ ...r, fallback: undefined });
  if (seen.length > SCENES_KEPT) seen.splice(0, seen.length - SCENES_KEPT);
}

/** Hourly: scenes left too long lapse. */
export function scenesHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0 || !s.scenes?.length) return;
  for (const r of [...s.scenes]) {
    if (s.sceneOn === r.key || s.tick - r.tick < SCENE_WAIT_HOURS * TICKS_PER_HOUR) continue;
    s.scenes = s.scenes.filter((q) => q !== r);
    lapse(s, r);
  }
}

/** Watch a scene: one waiting (by key), or one seen before. The town holds still while it plays. */
export function watchScene(s: GameState, key: number): boolean {
  const r = s.scenes?.find((q) => q.key === key) ?? s.scenesSeen?.find((q) => q.key === key);
  if (!r) return false;
  if (s.sceneOn === undefined) s.scenePaused = s.paused;
  s.sceneOn = key;
  s.paused = true;
  return true;
}

/** The scene is over (played to the end, or skipped partway): the town goes on; a waiting scene watched drops its
 *  telling. `skip` without watching (from the offer) puts its telling to the player. */
export function endScene(s: GameState, key: number, watched: boolean): void {
  const r = s.scenes?.find((q) => q.key === key);
  if (r) {
    s.scenes = s.scenes!.filter((q) => q !== r);
    if (watched) keep(s, r);
    else lapse(s, r);
  }
  if (s.sceneOn === key) {
    s.sceneOn = undefined;
    s.paused = s.scenePaused ?? false;
    s.scenePaused = undefined;
  }
}

/** The scene for the snapshot: the one playing, else the first waiting. */
export function sceneView(s: GameState): (Omit<SceneRun, 'fallback'> & { playing: boolean }) | null {
  const on = s.sceneOn !== undefined ? (s.scenes?.find((q) => q.key === s.sceneOn) ?? s.scenesSeen?.find((q) => q.key === s.sceneOn)) : undefined;
  const r = on ?? s.scenes?.[0];
  if (!r) return null;
  const { fallback: _f, ...rest } = r;
  return { ...rest, playing: !!on };
}
