// Injuries on the body (data/injuries.ts; the owner's ask, after RimWorld). A blow that lands leaves a wound on a part;
// wounds heal by the hour (faster tended, and with the town's learning in the care of the hurt); a bad one may scar,
// and a crushing one may take a limb or an eye for good. What's left of each part sets what the person can do
// (`capacities`): their work, their pace, their aim and blows, and the pain on their mood. A lost part is made good
// by a prosthetic the town crafts (the planner orders the best it can make) and its healer fits in surgery.

import { sickbedHealing } from './sickbeds';
import { ENEMIES } from '../data/enemies';
import {
  BODY,
  fitsOf,
  GLASS_EYE_MORALE,
  LOSE_AT,
  LOSE_CHANCE,
  PAIN_MORALE,
  PAIN_WORK,
  PARTS,
  PROSTHETIC_BY_ITEM,
  PROSTHETICS,
  SCAR_PAIN,
  SCAR_WORKS,
  SEVERITY_PER_SHARE,
  SURGERY_BASE,
  SURGERY_BEST,
  SURGERY_HOURS,
  SURGERY_PER_LEVEL,
  TENDED,
  WOUND_HINDERS,
  WOUNDS,
  type BodyPart,
  type ProstheticDef,
  type WoundKind,
} from '../data/injuries';
import { ITEM_BY_ID } from '../data/items';
import type { Rng } from '../rng';
import { natureOf } from '../data/enemies';
import { researchMods } from './research';
import { maxHp, notify, tireless, type GameState, type Person } from './state';
import { TICKS_PER_HOUR } from './time';

export interface Wound {
  part: BodyPart;
  kind: WoundKind;
  /** How bad it is now (0..1), and how bad it got (for the chance it scars). */
  sev: number;
  peak: number;
}
export interface Lasting {
  part: BodyPart;
  kind: 'scar' | 'lost';
}

const lost = (p: Person, part: BodyPart) => (p.lasting ?? []).some((l) => l.part === part && l.kind === 'lost');
const scarred = (p: Person, part: BodyPart) => (p.lasting ?? []).some((l) => l.part === part && l.kind === 'scar');

/** The kind of wound a foe leaves: beasts bite, fire burns, heavy blows break bones, blades cut. */
export function woundFor(kind: string, sev: number, rng: Rng): WoundKind {
  const def = ENEMIES[kind];
  const name = `${kind} ${def?.name ?? ''}`.toLowerCase();
  if (/fire|flame|dragon|drake|ember|lava|burn|imp\b|mage/.test(name)) return rng.chance(0.6) ? 'burn' : 'cut';
  if (sev > 0.5 && rng.chance(0.35)) return 'fracture';
  const nature = natureOf(kind);
  if (nature === 'beast') return rng.chance(0.8) ? 'bite' : 'bruise';
  if (nature === 'machine') return rng.chance(0.5) ? 'burn' : 'bruise';
  return rng.chance(0.65) ? 'cut' : 'bruise';
}

/** A blow of `dmg` lands on someone: a wound on a part it could land on, and maybe the part lost. */
export function woundPerson(s: GameState, p: Person, dmg: number, kind: WoundKind | ((sev: number) => WoundKind), rng: Rng): Wound | null {
  if (dmg <= 0) return null;
  const parts = BODY.filter((b) => !lost(p, b));
  const part = parts.length ? pickPart(parts, rng) : 'torso';
  const sev = Math.min(1, (dmg / Math.max(1, maxHp(p))) * SEVERITY_PER_SHARE);
  const k = typeof kind === 'function' ? kind(sev) : kind;
  const wounds = (p.wounds ??= []);
  const old = wounds.find((w) => w.part === part && w.kind === k);
  const w: Wound = old ?? { part, kind: k, sev: 0, peak: 0 };
  w.sev = Math.min(1, w.sev + sev);
  w.peak = Math.max(w.peak, w.sev);
  if (!old) wounds.push(w);
  // (a crushing blow may take a limb or an eye)
  if (PARTS[part].losable && w.sev >= LOSE_AT && rng.chance(LOSE_CHANCE * (0.5 + w.sev - LOSE_AT))) losePart(s, p, part);
  return w;
}

function pickPart(parts: BodyPart[], rng: Rng): BodyPart {
  const total = parts.reduce((n, b) => n + PARTS[b].weight, 0);
  let r = rng.next() * total;
  for (const b of parts) {
    r -= PARTS[b].weight;
    if (r <= 0) return b;
  }
  return parts[parts.length - 1];
}

/** A part lost for good (and what goes with it: the hand with the arm). */
export function losePart(s: GameState, p: Person, part: BodyPart): void {
  const gone = [part, ...(PARTS[part].carries ? [PARTS[part].carries!] : [])].filter((b) => !lost(p, b));
  if (!gone.length) return;
  p.wounds = (p.wounds ?? []).filter((w) => !gone.includes(w.part));
  p.lasting = [...(p.lasting ?? []).filter((l) => !gone.includes(l.part)), ...gone.map((b) => ({ part: b, kind: 'lost' as const }))];
  if (p.fitted) for (const b of gone) delete p.fitted[b];
  notify(s, `${p.name} has lost their ${PARTS[part].name}.`, true);
}

/** How well a part works: lost (its prosthetic's worth, or nothing), else scarred and wounded as it is. */
export function partWorks(p: Person, part: BodyPart): number {
  if (lost(p, part)) {
    const own = p.fitted?.[part];
    if (own) return PROSTHETIC_BY_ITEM[own]?.works ?? 0;
    // (a hand lost with its arm: the arm's prosthetic does for both)
    if (part.startsWith('hand')) {
      const arm = p.fitted?.[part === 'hand_l' ? 'arm_l' : 'arm_r'];
      if (arm) return PROSTHETIC_BY_ITEM[arm]?.works ?? 0;
    }
    return 0;
  }
  const worst = Math.max(0, ...(p.wounds ?? []).filter((w) => w.part === part).map((w) => w.sev));
  return (scarred(p, part) ? SCAR_WORKS : 1) * (1 - worst * WOUND_HINDERS);
}

export interface Capacities {
  sight: number;
  handling: number;
  moving: number;
  pain: number;
}
const WHOLE: Capacities = { sight: 1, handling: 1, moving: 1, pain: 0 };

/** What someone can do, all told (1 sound; a bionic part can take it past 1). */
export function capacities(p: Person): Capacities {
  if (!p.wounds?.length && !p.lasting?.length) return WHOLE;
  const w = (b: BodyPart) => partWorks(p, b);
  const sight = (w('eye_l') + w('eye_r')) / 2;
  const handling = (w('arm_l') * Math.min(1.25, w('hand_l')) + w('arm_r') * Math.min(1.25, w('hand_r'))) / 2;
  const moving = (w('leg_l') + w('leg_r')) / 2;
  let pain = 0;
  for (const x of p.wounds ?? []) pain += x.sev * WOUNDS[x.kind].pain;
  pain += (p.lasting ?? []).filter((l) => l.kind === 'scar').length * SCAR_PAIN;
  return { sight, handling, moving, pain: tireless(p) ? 0 : Math.min(0.9, pain) };
}

/** Work at their injuries' pace: handling most, sight a little, pain off the top. */
export function injuryWork(p: Person): number {
  const c = capacities(p);
  if (c === WHOLE) return 1;
  return (0.35 + 0.65 * c.handling) * (0.8 + 0.2 * Math.min(1, c.sight)) * (1 - c.pain * PAIN_WORK);
}
/** Walking pace. */
export function injuryPace(p: Person): number {
  const c = capacities(p);
  return c === WHOLE ? 1 : 0.35 + 0.65 * c.moving;
}
/** In a fight: their blows by their handling, their aim by their sight. */
export function injuryFight(p: Person): { damage: number; aim: number } {
  const c = capacities(p);
  if (c === WHOLE) return { damage: 1, aim: 0 };
  return { damage: (0.4 + 0.6 * c.handling) * (1 - c.pain * 0.3), aim: (Math.min(1.25, c.sight) - 1) * 0.3 };
}
/** Their pain on their mood (and a glass eye's small comfort). */
export function injuryMood(p: Person): { pain: number; comfort: number } {
  const c = capacities(p);
  const glass = Object.values(p.fitted ?? {}).filter((i) => i === 'glass_eye').length;
  return { pain: c.pain > 0.04 ? Math.round(c.pain * PAIN_MORALE) : 0, comfort: glass * GLASS_EYE_MORALE };
}

/** The town's healer (an infirmary's or a healer's hut's), at home and on their feet. */
function healerOf(s: GameState, not?: Person): Person | undefined {
  for (const b of s.buildings) {
    if (b.status !== 'done' || (b.def !== 'infirmary' && b.def !== 'healers_hut' && b.def !== 'hospital' && b.def !== 'trauma_center')) continue;
    const h = s.people.find((q) => q.id === b.operator && q.away === null && !q.downed && q !== not);
    if (h) return h;
  }
  return undefined;
}

/** The best prosthetic in store for a kind of part, better than what's fitted. */
function bestInStore(s: GameState, fits: ProstheticDef['fits'], than: number): ProstheticDef | undefined {
  return PROSTHETICS.filter((d) => d.fits === fits && d.rank > than && (s.items[d.item] ?? 0) > 0).sort((a, b) => b.rank - a.rank)[0];
}

/** Who's waiting for a part, and the kind (for the planner: what to make). */
export function prostheticsWanted(s: GameState): ProstheticDef['fits'][] {
  const out: ProstheticDef['fits'][] = [];
  for (const p of s.people) {
    for (const l of p.lasting ?? []) {
      if (l.kind !== 'lost') continue;
      const f = fitsOf(l.part);
      // (a hand lost with its arm waits on the arm)
      if (!f || (f === 'hand' && lost(p, l.part === 'hand_l' ? 'arm_l' : 'arm_r'))) continue;
      const have = p.fitted?.[l.part];
      const rank = have ? (PROSTHETIC_BY_ITEM[have]?.rank ?? 0) : 0;
      if (rank < 3) out.push(f);
    }
  }
  return out;
}

/** Once an hour: wounds heal (and may scar), and the healer fits whoever is waiting for a part. */
export function injuriesHourly(s: GameState, rng: Rng): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  const care = researchMods(s.research).careHeal;
  for (const p of s.people) {
    if (!p.wounds?.length) continue;
    // (tended: lying in a healing building's sickbed, sim/sickbeds.ts)
    const pace = (care * (sickbedHealing(s, p) !== null ? TENDED : 1)) / 24;
    for (const w of [...p.wounds]) {
      w.sev -= pace / WOUNDS[w.kind].days;
      if (w.sev > 0) continue;
      p.wounds = p.wounds.filter((x) => x !== w);
      // (a bad one leaves its mark; the town's learning makes that less likely)
      if (!lost(p, w.part) && !scarred(p, w.part) && rng.chance((WOUNDS[w.kind].scar * Math.max(0, w.peak - 0.3)) / care)) {
        (p.lasting ??= []).push({ part: w.part, kind: 'scar' });
        notify(s, `${p.name}'s ${WOUNDS[w.kind].name} healed, but left a scar on their ${PARTS[w.part].name}.`);
      }
    }
  }
  surgery(s, rng);
}

/** The healer fits a prosthetic: one surgery an hour, on someone at home and on their feet. */
function surgery(s: GameState, rng: Rng): void {
  if (s.raid) return;
  for (const p of s.people) {
    if (p.away !== null || p.downed || (p.surgeryUntil ?? 0) > s.tick) continue;
    for (const l of p.lasting ?? []) {
      if (l.kind !== 'lost') continue;
      const f = fitsOf(l.part);
      if (!f || (f === 'hand' && lost(p, l.part === 'hand_l' ? 'arm_l' : 'arm_r'))) continue;
      const have = p.fitted?.[l.part];
      const d = bestInStore(s, f, have ? (PROSTHETIC_BY_ITEM[have]?.rank ?? 0) : 0);
      if (!d) continue;
      const healer = healerOf(s, p);
      if (!healer) return;
      s.items[d.item] -= 1;
      p.surgeryUntil = s.tick + SURGERY_HOURS * TICKS_PER_HOUR;
      const odds = Math.min(SURGERY_BEST, SURGERY_BASE + healer.skills.medicine.level * SURGERY_PER_LEVEL);
      const name = ITEM_BY_ID[d.item]?.name.toLowerCase() ?? d.item;
      if (rng.chance(odds)) {
        (p.fitted ??= {})[l.part] = d.item;
        notify(s, `${healer.name} fitted ${p.name} with a ${name} for their lost ${PARTS[l.part].name}.`, true);
      } else {
        (p.wounds ??= []).push({ part: 'torso', kind: 'cut', sev: 0.35, peak: 0.35 });
        notify(s, `${healer.name}'s surgery on ${p.name} went badly: the ${name} was ruined, and ${p.name} is hurting.`, true);
      }
      return;
    }
  }
}

/** A brawl, an event's wound, a fall: a bruise or a cut somewhere. */
export function minorWound(s: GameState, p: Person, hp: number, rng: Rng): void {
  woundPerson(s, p, hp, rng.chance(0.6) ? 'bruise' : 'cut', rng);
}

/** A wound in words, for the inspect page. */
export function woundText(w: Wound): string {
  const how = w.sev > 0.66 ? 'bad' : w.sev > 0.33 ? '' : 'healing';
  return `${how ? `${how} ` : ''}${WOUNDS[w.kind].name} (${PARTS[w.part].name})`;
}

