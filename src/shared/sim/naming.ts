// Naming things (step of playing the founder: "More ways to interact"). The founder may name a building (from its card), a
// newborn of their family (a question with three suggestions and a box to type in) and a unique weapon when it is forged.
// A building's name is kept in `Building.homeName` (the same place a home's own name is, so every sign and card that shows
// that shows this) with `Building.named` set; a child's is their `name`; a unique's is in `GameState.uniqueNames` and
// the renderer lays it over the item's name (renderer/art/givenNames.ts). The God creature is named by the town when it
// comes (`askCreatureName`: three names that fit its kind) and may be renamed from its menu; its name is `creature.name`,
// which every line about it uses. The command is `name`; `cleanName` checks it.
// The questions (autopilot only) draw from their own side stream and lapse, after `NAME_HOURS`, to keeping what it has.

import { BUILDING_BY_ID } from '../data/buildings';
import { CREATURE_DEFS, CREATURE_NAMES } from '../data/creature';
import type { CreatureState } from './creature';
import { NAMES } from '../data/people';
import { ITEM_BY_ID } from '../data/items';
import { hashSeed, Rng } from '../rng';
import { isChild } from './social';
import { notify, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_HOUR } from './time';

export const NAME_MIN = 2;
export const NAME_MAX = 24;
/** How long a naming question waits before the name stays as it is. */
export const NAME_HOURS = 24;

export type NameKind = 'building' | 'person' | 'unique' | 'creature';
/** The God creature's id in a naming (there is only ever one). */
export const CREATURE_NAMING = 'creature';
export type NameResult = { ok: true; name: string } | { ok: false; reason: string };

/** What a unique may be called, for the suggestions. */
const WEAPON_NAMES = ['Dawnsplitter', 'Widowmaker', 'Oathkeeper', 'Ember', 'Grudge', 'Hearthguard', 'Mercy', 'Kingfall', 'Nightsong', 'Ironwill', 'Stormcaller', 'Last Word', 'Thornbite', 'Longwinter', 'Hope', 'Quiet Death'];

/** A typed name made tidy and checked: letters, digits, spaces, and ' - . only; it starts with a letter; NAME_MIN to
 *  NAME_MAX long. null when it will not do. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = raw.replace(/\s+/g, ' ').trim();
  if (name.length < NAME_MIN || name.length > NAME_MAX) return null;
  return /^\p{L}[\p{L}\p{N}' .-]*$/u.test(name) ? name : null;
}

const BAD = `A name is ${NAME_MIN} to ${NAME_MAX} letters, numbers, spaces, ' or -, and starts with a letter`;

/** Is this child one of the founder's family (theirs, or their partner's)? */
export function foundersChild(s: GameState, p: Person): boolean {
  const f = s.people.find((q) => q.id === s.mainId);
  return !!f && isChild(p) && !!p.parents?.some((id) => id === f.id || id === f.partner);
}

/** Give a thing its name. Checks the name and that the thing may be named. */
export function applyName(s: GameState, kind: NameKind, id: number | string, raw: unknown): NameResult {
  const name = cleanName(raw);
  if (!name) return { ok: false, reason: BAD };
  if (kind === 'building') {
    const b = s.buildings.find((q) => q.id === id);
    if (!b || b.status !== 'done' || b.ring !== undefined || b.room) return { ok: false, reason: 'That cannot be named' };
    b.homeName = name;
    b.named = true;
    notify(s, `The ${(BUILDING_BY_ID[b.def]?.name ?? b.def).toLowerCase()} is named ${name}.`);
    return { ok: true, name };
  }
  if (kind === 'person') {
    const p = s.people.find((q) => q.id === id);
    if (!p || !foundersChild(s, p)) return { ok: false, reason: 'Only the children of your family can be named' };
    if ([...s.people, ...s.captives].some((q) => q !== p && q.name.toLowerCase() === name.toLowerCase())) return { ok: false, reason: `Someone is already called ${name}` };
    const was = p.name;
    p.name = name;
    notify(s, `${was} is named ${name}.`, true);
    return { ok: true, name };
  }
  if (kind === 'creature') {
    const c = s.creature;
    if (!c) return { ok: false, reason: 'There is no God creature' };
    if (s.people.some((q) => q.name.toLowerCase() === name.toLowerCase())) return { ok: false, reason: `Someone is already called ${name}` };
    const was = c.name;
    c.name = name;
    (c.history ??= []).push({ tick: s.tick, text: was === name ? `Named ${name} by the town.` : `Named ${name} by the town (it was called ${was}).` });
    notify(s, `The God creature is named ${name}.`, true);
    return { ok: true, name };
  }
  if (typeof id !== 'string' || !(s.uniques ?? []).includes(id)) return { ok: false, reason: 'That cannot be named' };
  (s.uniqueNames ??= {})[id] = name;
  notify(s, `${ITEM_BY_ID[id]?.name ?? 'The weapon'} is named ${name}.`, true);
  return { ok: true, name };
}

/** The name a unique goes by now. */
export const uniqueNameOf = (s: Pick<GameState, 'uniqueNames'>, id: string): string => s.uniqueNames?.[id] ?? ITEM_BY_ID[id]?.name ?? id;

/** Put a naming question to the founder. `suggest` are the three; the last option keeps what it has. */
function ask(s: GameState, naming: NonNullable<Prompt['naming']>, title: string, text: string, suggest: string[], keep: string, who?: number): void {
  if (s.prompts.some((q) => q.naming?.kind === naming.kind && q.naming.id === naming.id)) return;
  s.prompts.push({
    id: s.nextId++,
    kind: 'name',
    expedition: null,
    title,
    text,
    options: [...suggest, `Keep "${keep}"`],
    defaultOption: suggest.length,
    expiresTick: s.tick + NAME_HOURS * TICKS_PER_HOUR,
    naming,
    ...(who !== undefined ? { who } : {}),
  });
}

/** A child of the founder's family is born: the founder may name them. */
export function askChildName(s: GameState, child: Person): void {
  if (s.autopilot === false || !foundersChild(s, child)) return;
  const rng = new Rng(hashSeed(`${s.seed}:naming:${s.tick}:${child.id}`));
  const taken = new Set([...s.people, ...s.captives].map((p) => p.name.toLowerCase()));
  const pool = NAMES.filter((n) => !taken.has(n.toLowerCase()));
  const suggest: string[] = [];
  while (suggest.length < 3 && pool.length) suggest.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  ask(s, { kind: 'person', id: child.id }, 'A child is born', `A child has come to your house. What will you call them? They are called ${child.name} for now.`, suggest, child.name, child.id);
}

/** A unique has just been forged: the founder may name it. */
export function askUniqueName(s: GameState, id: string): void {
  if (s.autopilot === false || !ITEM_BY_ID[id]) return;
  const rng = new Rng(hashSeed(`${s.seed}:naming:${s.tick}:${id}`));
  const pool = [...WEAPON_NAMES];
  const suggest: string[] = [];
  while (suggest.length < 3) suggest.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const was = ITEM_BY_ID[id].name;
  ask(s, { kind: 'unique', id }, `${was} is forged`, `There is no other like it. What will you call it?`, suggest, was);
}

/** The God creature has come: the town names it (three names that fit its kind, or one typed; left, it keeps the one it
 *  goes by). */
export function askCreatureName(s: GameState, c: CreatureState): void {
  if (s.autopilot === false) return;
  const rng = new Rng(hashSeed(`${s.seed}:naming:${s.tick}:creature`));
  const taken = new Set(s.people.map((p) => p.name.toLowerCase()));
  const pool = CREATURE_NAMES[c.kind].filter((n) => n !== c.name && !taken.has(n.toLowerCase()));
  const suggest: string[] = [];
  while (suggest.length < 3 && pool.length) suggest.push(pool.splice(rng.int(0, pool.length - 1), 1)[0]);
  const kind = CREATURE_DEFS[c.kind].name.toLowerCase();
  ask(s, { kind: 'creature', id: CREATURE_NAMING }, 'Name the God creature', `The young ${kind} follows ${s.people.find((p) => p.id === s.mainId)?.name ?? 'you'} about, and the town wants a name for it. It will be called by it from now on. For now it answers to ${c.name}.`, suggest, c.name);
}

/** A naming question answered by tapping one of its options. */
export function answerName(s: GameState, prompt: Prompt, option: number): void {
  const n = prompt.naming;
  if (!n || option >= prompt.options.length - 1) return; // (keep the name)
  applyName(s, n.kind, n.id, prompt.options[option]);
}

/** Answer a naming question by typing a name (the `name` command): the question, if one stands, is done with. */
export function nameCommand(s: GameState, kind: NameKind, id: number | string, raw: unknown): void {
  const r = applyName(s, kind, id, raw);
  if (!r.ok) return void notify(s, `${r.reason}.`);
  s.prompts = s.prompts.filter((q) => !(q.kind === 'name' && q.naming?.kind === kind && q.naming.id === id));
}
