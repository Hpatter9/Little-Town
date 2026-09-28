// The hidden Occult branch (DESIGN §9). It stays out of sight until something reveals it: a strange tome
// from the Old Ruins, a hermit with forbidden knowledge joining the town, or the main character's first
// brush with death. Its first gifts soften that death: a Spirit Totem (one second life) and, later, a
// Resurrection Shrine (one more).

import { TOPICS } from '../data/research';
import { addItems } from './crafting';
import { maxHp, notify, campX, personFx, type GameState, type Person } from './state';
import { fullMoon } from './monsters';
import { buildingCentreX } from './buildings';
import { TICKS_PER_DAY } from './time';

/** Research done: offer the founder the Blood Rite (a question; declining is the default). */
export function offerBloodRite(s: GameState): void {
  const main = s.people.find((p) => p.id === s.mainId);
  if (!main || main.monster) return;
  s.prompts.push({
    id: s.nextId++,
    kind: 'rite',
    expedition: null,
    title: 'The Blood Rite',
    text: `The rite is ready. Should ${main.name} become a vampire? (Stronger, rises again once a night, but must feed, and the Hunter's Guild will come.)`,
    options: ['Embrace the night', 'Refuse'],
    defaultOption: 1,
    expiresTick: s.tick + 24 * 600,
  });
  notify(s, 'The Blood Rite is ready. A choice awaits.', true);
}

/** Research done: offer the founder the Moon Rite (the same kind of question). */
export function offerMoonRite(s: GameState): void {
  const main = s.people.find((p) => p.id === s.mainId);
  if (!main || main.monster) return;
  s.prompts.push({
    id: s.nextId++,
    kind: 'rite',
    expedition: null,
    title: 'The Moon Rite',
    text: `The moon is rising. Should ${main.name} answer it and become a werewolf? (The wolf packs will run with them, and under a full moon they can't stay dead; but on those nights the beast gets out, and the Hunter's Guild will come.)`,
    options: ['Answer the moon', 'Refuse'],
    defaultOption: 1,
    expiresTick: s.tick + 24 * 600,
  });
  notify(s, 'The Moon Rite is ready. A choice awaits.', true);
}

export function answerRite(s: GameState, label: string): void {
  const main = s.people.find((p) => p.id === s.mainId);
  const kind = label.startsWith('Embrace') ? 'vampire' : label.startsWith('Answer the moon') ? 'werewolf' : null;
  if (!main || !kind) return notify(s, 'The rite was refused.');
  main.monster = kind;
  main.order = 'fight';
  main.lastFed = s.tick;
  personFx(s, main.id, kind);
  notify(s, kind === 'vampire' ? `${main.name} has become a vampire.` : `${main.name} howls at the moon, and the wolves howl back. ${main.name} is a werewolf now.`, true);
}

export const occultRevealed = (s: GameState) => (s.research.revealed ?? []).includes('forbidden_lore');

/** Open the Occult branch (once). */
export function revealOccult(s: GameState, how: string): void {
  if (occultRevealed(s)) return;
  s.research.revealed = [...(s.research.revealed ?? []), ...TOPICS.filter((t) => t.branch === 'occult').map((t) => t.id)];
  notify(s, `${how} A hidden branch of research has opened: the Occult.`, true);
}

/**
 * The main character has died. A Spirit Totem or an unspent Resurrection Shrine brings them back.
 * Returns true if they were brought back (and the game goes on).
 */
/** Cryo pods and clone vats can bring the founder back again, but only so often; a clone loses this share of skill. */
export const CRYO_COOLDOWN_DAYS = 3;
export const CLONE_COOLDOWN_DAYS = 2;
export const CLONE_SKILL_LOSS = 0.25;

export function tryRevive(s: GameState, p: Person): boolean {
  let how: string | null = null;
  const day = Math.floor(s.tick / TICKS_PER_DAY);
  const phylactery = s.buildings.find((b) => b.def === 'phylactery' && b.status === 'done');
  if (phylactery) {
    // a lich always returns to their phylactery
    how = 'Dark light gathers at the phylactery';
    p.x = buildingCentreX(phylactery);
  } else if (p.monster === 'vampire' && s.vampireRevivedDay !== day) {
    // a vampire rises again, once a night
    s.vampireRevivedDay = day;
    how = 'At dusk the grave stirs';
  } else if (p.monster === 'werewolf' && fullMoon(s) && s.werewolfRevivedDay !== day) {
    // under a full moon the wolf won't stay down (once a night)
    s.werewolfRevivedDay = day;
    how = 'The full moon breaks through the clouds, and the body twitches';
  } else if ((s.items.spirit_totem ?? 0) > 0) {
    addItems(s, 'spirit_totem', -1);
    how = 'The Spirit Totem crumbles to dust';
  } else {
    const shrine = s.buildings.find((b) => b.def === 'resurrection_shrine' && b.status === 'done' && !b.spent);
    const ready = (def: string) => s.buildings.find((b) => b.def === def && b.status === 'done' && (b.readyTick ?? 0) <= s.tick);
    const vat = ready('clone_vat');
    const pod = ready('cryo_pod');
    // the reusable ones first, so the shrine is kept for when they're not ready
    if (vat) {
      // a clone wakes with their memories, but not all of their skill
      vat.readyTick = s.tick + CLONE_COOLDOWN_DAYS * TICKS_PER_DAY;
      for (const sk of Object.values(p.skills)) {
        sk.level = Math.max(1, Math.round(sk.level * (1 - CLONE_SKILL_LOSS)));
        sk.xp = 0;
      }
      how = 'The Clone Vat drains, and a familiar face steps out (a little less skilled)';
    } else if (pod) {
      // frozen in time and thawed out, frailer than before
      pod.readyTick = s.tick + CRYO_COOLDOWN_DAYS * TICKS_PER_DAY;
      p.traits.push('frail');
      how = 'The Cryo Pod hisses open';
    } else if ((s.items.deaths_bargain ?? 0) > 0) {
      addItems(s, 'deaths_bargain', -1);
      how = "Death takes the old coin instead";
    } else if (shrine) {
      shrine.spent = true;
      how = 'The Resurrection Shrine flares and goes dark';
    }
  }
  if (!how) return false;
  p.hp = Math.round(maxHp(p) * 0.3);
  p.downed = null;
  p.scarred = true;
  p.sick = null;
  p.away = null;
  p.task = null;
  if (!phylactery) p.x = campX(s);
  if (!s.people.includes(p)) s.people.push(p);
  s.revivedAt = { tick: s.tick, id: p.id };
  notify(s, `${how}, and ${p.name} draws breath again.`, true);
  return true;
}
