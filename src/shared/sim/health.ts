// Health: injury, being downed, bleeding out, death, and healing in town (DESIGN §3).

import { mournFor } from './ceremonies';
import { BUILDING_BY_ID } from '../data/buildings';
import { HEALER_PER_LEVEL } from '../data/operators';
import { UNDEAD_HEAL } from '../data/monsters';
import { operatorSkill } from './operators';
import { buildingCentre } from './buildings';
import { grieve, isChild } from './social';
import { revealOccult, tryRevive } from './occult';
import { tireless, notify, maxHp, markBlood, personFx, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

/** How long someone downed has before they bleed out, unless a medic (or the camp) tends them. */
export const BLEED_TICKS = 2 * TICKS_PER_HOUR;
/** Everyone mourns a death for this long. */
const MOURNING_TICKS = 24 * TICKS_PER_HOUR;
/** Graves kept in town. */
const MAX_GRAVES = 12;
/** HP regained per game hour in town: awake, asleep on the ground, asleep in a bed. */
const REGEN_AWAKE = 4;
const REGEN_GROUND = 8;
const REGEN_BED = 12;
/** A downed (stabilized) person gets up again at this share of their health. */
const BACK_ON_FEET = 0.3;
/** The near-death vision that reveals the Occult needs this many topics researched first. */
const VISION_AFTER_TOPICS = 10;
/** Starving (food need this low): health lost per game hour instead of healing. */
const STARVING = 0.02;
const STARVE_HP_PER_HOUR = 1.2; // (a fit adult lasts about two days of real famine: time to notice and do something)
/** Below this share of health someone counts as injured. */
export const INJURED = 0.5;

/** Struck down by a blow just landed (not sickness, hunger or a fall): blood where they lie. */
function bloodOf(s: GameState, p: Person): void {
  if (p.lastHit !== undefined && s.tick - p.lastHit <= 2 && p.away === null) markBlood(s, p.x, p.y, p.hitFrom ?? 1);
}

export function knockDown(s: GameState, p: Person): void {
  bloodOf(s, p);
  // an emergency medkit is used on the spot (in town)
  if (p.away === null && (s.items.medkit ?? 0) > 0) {
    s.items.medkit -= 1;
    p.hp = Math.round(maxHp(p) * MEDKIT_HP);
    p.downed = null;
    p.scarred = true;
    personFx(s, p.id, 'heal');
    notify(s, `${p.name} was struck down, but a medkit got them straight back up.`);
    return;
  }
  p.hp = 0;
  // (in town the founder is always carried to safety: losing them ends everything; an infirmary's healers slow
  // everyone else's bleeding, the better the infirmary the more)
  const slower = p.away === null ? bestHealing(s) : 1;
  p.downed = { bleedUntil: p.id === s.mainId && p.away === null ? null : s.tick + BLEED_TICKS * slower };
}

/** The town's best healing building (1 without one; an infirmary 2, a hospital 3, a trauma center 4). */
export const bestHealing = (s: GameState) => s.buildings.reduce((m, b) => (b.status === 'done' ? Math.max(m, BUILDING_BY_ID[b.def]?.healing ?? 1) : m), 1);

/** Health a medkit brings someone back to. */
const MEDKIT_HP = 0.4;

export function stabilize(p: Person): void {
  if (p.downed) p.downed.bleedUntil = null;
}

export const isInjured = (p: Person) => p.hp < maxHp(p) * INJURED;

/** How hard the town takes its leader's death, and for how long (game hours). */
export const SUCCESSION_MORALE = -15;
export const SUCCESSION_HOURS = 48;

/** Who leads after the leader: their partner, else their eldest grown child, else the grown-up the town thinks most
 *  of (the best at getting on with people, then at learning). Someone at home before someone away. None if only
 *  children are left. */
export function heirOf(s: GameState, dead: Person): Person | undefined {
  const grown = s.people.filter((q) => q !== dead && !isChild(q));
  if (!grown.length) return undefined;
  const rank = (q: Person) =>
    (q.away === null ? 1000 : 0) + (q.id === dead.partner ? 500 : 0) + ((q.parents ?? []).includes(dead.id) ? 300 : 0) + q.skills.social.level * 3 + q.skills.research.level;
  return [...grown].sort((a, b) => rank(b) - rank(a))[0];
}

/** Remove someone who has died. The leader's death passes the town to an heir (it ends the game only if no grown-up
 *  is left to take over). */
export function killPerson(s: GameState, p: Person, cause: string): void {
  bloodOf(s, p);
  for (const e of s.expeditions) {
    e.members = e.members.filter((id) => id !== p.id);
    delete e.roles[p.id];
  }
  // the main character may have a way back (the Occult branch)
  if (p.id === s.mainId && tryRevive(s, p)) return;
  // a phoenix feather: whoever dies next in town rises from the ashes instead
  if (p.away === null && (s.items.phoenix_feather ?? 0) > 0) {
    s.items.phoenix_feather -= 1;
    p.hp = maxHp(p);
    p.downed = null;
    p.sick = null;
    s.revivedAt = { tick: s.tick, id: p.id };
    notify(s, `${p.name} fell, and the Phoenix Feather burst into flame: ${p.name} rises from the ashes!`, true);
    return;
  }
  s.people = s.people.filter((q) => q !== p);
  // what they wore stays in town if they died there (it's lost with them on the road)
  if (p.away === null) for (const id of Object.values(p.gear)) s.items[id!] = (s.items[id!] ?? 0) + 1;
  if (p.id === s.mainId) {
    // someone takes up the leadership, if there's a grown-up left to; else the town is finished
    const heir = heirOf(s, p);
    if (!heir) {
      s.gameOver = { tick: s.tick, text: `${p.name} has died ${cause}. Without them, the camp breaks apart.` };
      notify(s, s.gameOver.text, true);
      return;
    }
    s.mainId = heir.id;
    // (the lich's rite was for the one who died)
    if (s.lichChosen && !s.lich) s.lichChosen = undefined;
    (s.marks ??= []).push({ lever: 'morale', value: SUCCESSION_MORALE, until: s.tick + SUCCESSION_HOURS * TICKS_PER_HOUR, text: `${p.name} is dead` });
    notify(s, `${p.name}, who founded the town, has died ${cause}. ${heir.name} takes up the leadership, and the town mourns.`, true);
  }
  s.mourningUntil = s.tick + MOURNING_TICKS;
  // a grave in the graveyard, or where they fell if there isn't one (the oldest make way after a while)
  if (p.away === null) {
    s.burials = (s.burials ?? 0) + 1;
    s.graves = [...(s.graves ?? []), { x: Math.round(p.x), y: Math.round(p.y), name: p.name }].slice(-MAX_GRAVES);
    layOutGraves(s);
  }
  mournFor(s, p); // (a funeral at the next evening: sim/ceremonies.ts)
  grieve(s, p);
  notify(s, `${p.name} has died ${cause}.`, true);
  // in an outbreak, those who fall in town among the dead get up again
  const r = s.raid;
  if (r && r.kind === 'zombies' && r.phase === 'active' && p.away === null) {
    r.raiders.push({ id: s.nextId++, kind: 'zombie', x: p.x, y: p.y, dir: p.dir, hp: 45, maxHp: 45, cooldown: 20, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm', risenFrom: p.name, ally: s.doom?.kind === 'outbreak' && s.doom.commanded === true, conjuredAt: s.tick });
    notify(s, s.doom?.commanded ? `${p.name} rises again, and stands with the lich.` : `${p.name} rises again, one of the dead now.`, true);
  }
}

/** With a graveyard, every grave stands in its rows (called on each burial, and when the graveyard is built:
 *  the dead are moved there). */
export function layOutGraves(s: GameState): void {
  const yard = s.buildings.find((b) => b.def === 'graveyard' && b.status === 'done');
  if (!yard || !s.graves) return;
  const c = buildingCentre(yard);
  s.graves.forEach((g, i) => {
    g.x = Math.round(c.x + ((i % 5) - 2) * 12);
    g.y = Math.round(c.y - 8 + Math.floor(i / 5) * 10);
  });
}

/** Bleeding out: die when the timer runs out. */
export function checkBleeding(s: GameState, p: Person): void {
  if (p.downed?.bleedUntil != null && s.tick >= p.downed.bleedUntil) killPerson(s, p, 'of their wounds');
}

/** Heal a bit (in town). Sleeping heals faster, in a bed fastest. The starving don't heal: they waste away, and
 *  die of hunger if nobody feeds them. */
export function heal(s: GameState, p: Person): void {
  const max = maxHp(p);
  // (the downed are recovering in bed and can't go and eat: they aren't worn down, or they'd never get up)
  if (p.needs.food <= STARVING && !tireless(p) && !p.downed) {
    if (!p.starving) {
      p.starving = true;
      notify(s, `${p.name} is starving! There's no food to be had: plant fields, hunt, or trade for some.`, true);
    }
    p.hp -= STARVE_HP_PER_HOUR / TICKS_PER_HOUR;
    if (p.hp <= 0) killPerson(s, p, 'of hunger');
    return;
  }
  if (p.starving && p.needs.food > STARVING) p.starving = false;
  if (p.hp >= max) return;
  const asleep = p.task?.type === 'sleep' && p.activity === 'sleep';
  const rate = asleep ? (p.task?.type === 'sleep' && p.task.building !== null ? REGEN_BED : REGEN_GROUND) : REGEN_AWAKE;
  let infirmary = bestHealing(s);
  if (infirmary > 1) infirmary += operatorSkill(s, 'infirmary') * HEALER_PER_LEVEL; // a healer on hand
  p.hp = Math.min(max, p.hp + (rate * infirmary * (tireless(p) ? UNDEAD_HEAL : 1)) / TICKS_PER_HOUR);
  if (p.downed && p.downed.bleedUntil === null && p.hp >= max * BACK_ON_FEET) {
    p.downed = null;
    p.scarred = true;
    notify(s, `${p.name} is back on their feet.`);
    // coming back from the brink, the main character saw something...
    // (only once the town has some learning to make sense of it)
    if (p.id === s.mainId && s.research.done.length >= VISION_AFTER_TOPICS) revealOccult(s, `Near death, ${p.name} had a strange vision.`);
  }
}
