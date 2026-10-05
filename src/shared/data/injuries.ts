// Injuries (the owner's ask: in the manner of RimWorld). A blow lands on a body part and leaves a wound of a kind
// (a cut, a bite, a bruise, a broken bone, a burn) with a severity; wounds heal over days, faster when tended, and a
// bad one may leave a lasting scar, or take the part for good. What each part does goes into what the person can do
// (`capacities` in sim/injuries.ts): sight, handling (arms and hands), moving (legs), and pain. A lost part can be
// made good by a prosthetic, crafted and fitted by the healer in surgery.

export type BodyPart = 'head' | 'eye_l' | 'eye_r' | 'torso' | 'arm_l' | 'arm_r' | 'hand_l' | 'hand_r' | 'leg_l' | 'leg_r';
export type Capacity = 'sight' | 'handling' | 'moving';

export interface PartDef {
  id: BodyPart;
  name: string;
  /** How often a blow lands here (relative). */
  weight: number;
  /** The capacity it serves (none for the head and torso: they hurt, they can't be lost). */
  serves?: Capacity;
  /** Can be lost to a crushing blow. */
  losable: boolean;
  /** Lost with it (a hand goes with its arm). */
  carries?: BodyPart;
}

export const PARTS: Readonly<Record<BodyPart, PartDef>> = {
  head: { id: 'head', name: 'head', weight: 8, losable: false },
  eye_l: { id: 'eye_l', name: 'left eye', weight: 2, serves: 'sight', losable: true },
  eye_r: { id: 'eye_r', name: 'right eye', weight: 2, serves: 'sight', losable: true },
  torso: { id: 'torso', name: 'torso', weight: 30, losable: false },
  arm_l: { id: 'arm_l', name: 'left arm', weight: 12, serves: 'handling', losable: true, carries: 'hand_l' },
  arm_r: { id: 'arm_r', name: 'right arm', weight: 12, serves: 'handling', losable: true, carries: 'hand_r' },
  hand_l: { id: 'hand_l', name: 'left hand', weight: 6, serves: 'handling', losable: true },
  hand_r: { id: 'hand_r', name: 'right hand', weight: 6, serves: 'handling', losable: true },
  leg_l: { id: 'leg_l', name: 'left leg', weight: 11, serves: 'moving', losable: true },
  leg_r: { id: 'leg_r', name: 'right leg', weight: 11, serves: 'moving', losable: true },
};
export const BODY: readonly BodyPart[] = Object.keys(PARTS) as BodyPart[];

export type WoundKind = 'cut' | 'bite' | 'bruise' | 'fracture' | 'burn';
export interface WoundDef {
  id: WoundKind;
  name: string;
  /** Pain at full severity (0..1 of the whole body's tolerance). */
  pain: number;
  /** Game days to heal from full severity untended (tended heals TENDED times as fast). */
  days: number;
  /** Chance it scars, at full severity (scales with how bad it got). */
  scar: number;
}
export const WOUNDS: Readonly<Record<WoundKind, WoundDef>> = {
  cut: { id: 'cut', name: 'cut', pain: 0.25, days: 3, scar: 0.35 },
  bite: { id: 'bite', name: 'bite', pain: 0.3, days: 3.5, scar: 0.45 },
  bruise: { id: 'bruise', name: 'bruise', pain: 0.15, days: 1.5, scar: 0.05 },
  fracture: { id: 'fracture', name: 'broken bone', pain: 0.45, days: 6, scar: 0.5 },
  burn: { id: 'burn', name: 'burn', pain: 0.4, days: 4, scar: 0.6 },
};

/** A blow's share of the person's most health becomes this much severity on the part it lands on. */
export const SEVERITY_PER_SHARE = 2.5;
/** A blow at least this severe on a part that can be lost may take it (chance LOSE_CHANCE times how far past). */
export const LOSE_AT = 0.85;
export const LOSE_CHANCE = 0.5;
/** Tended wounds (an infirmary or healer's hut standing, the person in town) heal this many times as fast. */
export const TENDED = 2;
/** What a lasting scar leaves: pain, and its part working at this share. */
export const SCAR_PAIN = 0.06;
export const SCAR_WORKS = 0.85;
/** Pain, all told, takes this share off work at full pain, and this much off morale. */
export const PAIN_WORK = 0.5;
export const PAIN_MORALE = -20;
/** A part not lost but wounded works at 1 - severity times this. */
export const WOUND_HINDERS = 0.6;

/** Prosthetics: what each replaces and how well it works (1 is a sound part; over 1, better). */
export interface ProstheticDef {
  item: string;
  /** The kind of part it stands in for. */
  fits: 'eye' | 'arm' | 'hand' | 'leg';
  works: number;
  /** The rank among those for the same part (the best the town has is fitted, and a better one replaces it). */
  rank: number;
}
export const PROSTHETICS: readonly ProstheticDef[] = [
  { item: 'peg_leg', fits: 'leg', works: 0.55, rank: 1 },
  { item: 'hook_hand', fits: 'hand', works: 0.45, rank: 1 },
  { item: 'wooden_arm', fits: 'arm', works: 0.35, rank: 1 },
  { item: 'glass_eye', fits: 'eye', works: 0, rank: 1 },
  { item: 'prosthetic_leg', fits: 'leg', works: 0.85, rank: 2 },
  { item: 'prosthetic_hand', fits: 'hand', works: 0.75, rank: 2 },
  { item: 'prosthetic_arm', fits: 'arm', works: 0.75, rank: 2 },
  { item: 'bionic_leg', fits: 'leg', works: 1.25, rank: 3 },
  { item: 'bionic_hand', fits: 'hand', works: 1.25, rank: 3 },
  { item: 'bionic_arm', fits: 'arm', works: 1.25, rank: 3 },
  { item: 'bionic_eye', fits: 'eye', works: 1.25, rank: 3 },
];
export const PROSTHETIC_BY_ITEM: Readonly<Record<string, ProstheticDef>> = Object.fromEntries(PROSTHETICS.map((p) => [p.item, p]));
export const fitsOf = (part: BodyPart): ProstheticDef['fits'] | null => (part.startsWith('eye') ? 'eye' : part.startsWith('arm') ? 'arm' : part.startsWith('hand') ? 'hand' : part.startsWith('leg') ? 'leg' : null);

/** Surgery: the healer's chance of fitting one well (by Medicine level, up to SURGERY_BEST), the hours it takes and
 *  the patient rests after, and a botch's wound. */
export const SURGERY_BASE = 0.55;
export const SURGERY_PER_LEVEL = 0.02;
export const SURGERY_BEST = 0.97;
export const SURGERY_HOURS = 4;
/** Morale for a glass eye's comfort, a botched surgery's pain. */
export const GLASS_EYE_MORALE = 2;
