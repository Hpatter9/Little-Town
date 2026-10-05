// Automatic battles (DESIGN §8): the player doesn't control them; skills, traits, roles and rows decide.
// Fighters act on their own cooldowns. Melee can only reach the other side's front row while it stands;
// ranged attacks reach anyone. Medics heal instead of attacking; porters stay out of it. Gear adds damage,
// aim, armour and blocking.

import { injuryFight } from './injuries';
import type { EliteAffix } from '../data/dungeons';
import { BLOOD_FURY, BLOOD_LIFESTEAL, CLASS_DEFS, NECRO_RAISES, type ClassId } from '../data/classes';
import { classStat, levelPower } from '../data/levels';
import { afraid, held, kitOf, pace, passiveStats, strike, takeTurn, tickStatuses, type ActMeta, type Arena, type Kit, type Statuses } from './actions';
import { ATTR_BASE, DEX_AIM, DEX_DODGE, INT_POWER, manaRegenOf, maxManaOf, maxStaminaOf, speedOfDex, STAMINA_PER_BLOW, staminaRegenOf, STR_DAMAGE, VIT_HP, type Attrs } from '../data/attributes';
import { attributesOf } from './attributes';
import { ENEMIES, enemyArmor, natureOf, type EnemyGroup } from '../data/enemies';
import { WEREWOLF_DAMAGE } from '../data/monsters';
import type { Role } from '../data/expeditions';
import { AMMO_DAMAGE, ITEM_BY_ID, type ItemDef } from '../data/items';
import { plusMult, plusOf, qualityMult } from '../data/quality';
import type { Material, Stock } from '../data/materials';
import type { Rng } from '../rng';
import { gearEffects } from './crafting';
import { maxHp, type Person } from './state';
import { TICK_HZ } from './time';

export interface Fighter {
  /** A delve's elite (data/dungeons.ts ELITES): its affix, also in its name. */
  elite?: EliteAffix;
  side: 'party' | 'enemy';
  /** Person id (party) or enemy index (enemy). */
  ref: number;
  /** Enemy def id, or 'person'. */
  kind: string;
  name: string;
  hp: number;
  maxHp: number;
  row: 'front' | 'back';
  ranged: boolean;
  damage: [number, number];
  accuracy: number;
  dodge: number;
  /** Ticks between actions, and ticks until the next one. */
  interval: number;
  cooldown: number;
  down: boolean;
  role: Role | 'enemy';
  /** Medics: HP restored per action. */
  heal: number;
  tough: boolean;
  coward: boolean;
  /** Battle tick of their last action and of the last time they were hit (for animation). */
  lastAction: number;
  lastHit: number;
  /** What the last hit looked like when it wasn't an ordinary blow: a Blood Knight's, a gunshot's, a laser's. */
  hitFx?: 'blood' | 'fire' | 'lightning' | null;
  /** Attacks made (for skill XP afterwards). */
  attacks: number;
  /** Gear: share of each hit taken away, chance to block a blow outright, extra damage against beasts. */
  armor: number;
  block: number;
  beastDamage: number;
  /** A weapon's quirks (data/weapons.ts): chance to strike true for double, armour ignored, a share that cleaves into
   *  another foe, chance to stun, extra against the dead and against machines. */
  quirks?: Quirks;
  /** Ammunition: what kind, how much on hand, the extra damage each shot adds, and how many were used. */
  ammoType?: Material | null;
  ammo: number;
  ammoBonus: number;
  ammoUsed: number;
  /** A special class (people only). */
  cls?: ClassId | null;
  /** Fallen enemies this fighter has raised (necromancers), and who raised this one. */
  raised?: number;
  raisedBy?: number;
  raiseChecked?: boolean;
  /** Spells and skills (actions.ts): what they have ready, and the statuses on them. Conjured: called up by a spell. */
  kit?: Kit;
  st?: Statuses;
  conjured?: boolean;
  pop?: { tick: number; amount: number; heal: boolean };
  /** Attributes and the pools (data/attributes.ts): people only; a creature pays nothing and has no limit. */
  attrs?: Attrs;
  mp?: number;
  maxMp?: number;
  sp?: number;
  maxSp?: number;
  limit?: number;
  /** Epic bosses: raging yet, called for help yet, attacks made (for the sweeping attack). */
  enraged?: boolean;
  summoned?: boolean;
  bossAttacks?: number;
  lastArea?: number;
}

/** What a person's weapon shoots, if anything. */
export const ammoOf = (p: Person): Material | null => (p.gear.weapon ? (ITEM_BY_ID[p.gear.weapon]?.effects.ammo ?? null) : null);

export const isBeast = (kind: string) => !!ENEMIES[kind] && 'sheet' in ENEMIES[kind].sprite;

export interface Quirks {
  crit: number;
  pierce: number;
  cleave: number;
  stun: number;
  undead: number;
  machine: number;
  /** Skills' banes: a share more against beasts, the dead, machines; a true strike's extra. */
  beastShare?: number;
  undeadShare?: number;
  machineShare?: number;
  critDamage?: number;
  /** A share of each blow drunk as life (a unique's). */
  drain?: number;
}

/** What someone's weapon adds in a fight, made finer by its grade and its +N (quality.ts): damage, aim, its time
 *  between blows (a share), and its quirks. Nothing without a weapon. */
export function weaponOf(p: Person): { def?: ItemDef; damage: number; accuracy: number; speed: number; reach: boolean; quirks: Quirks } {
  const def = p.gear.weapon ? ITEM_BY_ID[p.gear.weapon] : undefined;
  const fx = def?.effects ?? {};
  const q = p.gearQ?.weapon;
  const k = qualityMult(q) * plusMult(q);
  return {
    def,
    damage: (fx.damage ?? 0) * k,
    accuracy: (fx.accuracy ?? 0) * qualityMult(q) + plusOf(q) * PLUS_AIM,
    speed: fx.speed ?? 1,
    reach: !!fx.reach,
    quirks: { crit: fx.crit ?? 0, pierce: fx.pierce ?? 0, cleave: fx.cleave ?? 0, stun: fx.stun ?? 0, undead: (fx.undeadDamage ?? 0) * k, machine: (fx.machineDamage ?? 0) * k, ...(fx.lifesteal ? { drain: fx.lifesteal } : {}) },
  };
}
/** A weapon's reach on the raid's battle map (cells), and the stand-ins: fists, a thrown stone (a shooter with no bow),
 *  a mage's fire with no staff. */
export const UNARMED_RANGE = 1;
export const THROWN_RANGE = 3;
export const MAGIC_RANGE = 4;
const DEFAULT_MELEE = 1.2;
const DEFAULT_SHOT = 4;
const DEFAULT_REACH = 2.2;
/** How far the weapon in someone's hand reaches (cells on the battle map). Whoever fights from range with no ranged
 *  weapon in hand throws (or a mage casts) instead. */
export function weaponRange(p: Person, shooter = false): number {
  const def = p.gear.weapon ? ITEM_BY_ID[p.gear.weapon] : undefined;
  const fx = def?.effects;
  if (shooter && !fx?.ranged) return p.cls === 'mage' ? MAGIC_RANGE : THROWN_RANGE;
  if (!def) return UNARMED_RANGE;
  return fx!.range ?? (fx!.ranged ? DEFAULT_SHOT : fx!.reach ? DEFAULT_REACH : DEFAULT_MELEE);
}
const NO_QUIRKS: Quirks = { crit: 0, pierce: 0, cleave: 0, stun: 0, undead: 0, machine: 0 };
/** Each + on a weapon steadies the aim this much. */
const PLUS_AIM = 0.015;

export interface Battle {
  fighters: Fighter[];
  tick: number;
  outcome: null | 'won' | 'retreated' | 'lost';
  boss: boolean;
  /** What the bosses said and did, for the Journal (taken and cleared by the expedition). */
  shouts?: string[];
  /** The spells and skills used lately (for the watcher's box naming the action), with what each was. */
  acts?: { tick: number; side: Fighter['side']; ref: number; name: string; targets: number[]; meta?: ActMeta }[];
  /** Turn-based: ticks until the next fighter may act (a beat after each action, so turns come one at a time). */
  beat?: number;
}

/** Ticks between one fighter's turn and the next's (the beat of a turn-based fight), longer after an ultimate. */
export const TURN_BEAT = 6;
export const ULT_BEAT = 14;

/** Ticks before the first exchange can end in a retreat (so a party at least tries). */
const MIN_TICKS_BEFORE_RETREAT = 2 * TICK_HZ;
const PERSON_INTERVAL = 1.2;

/** How someone fights: with a sling or bow if they carry one; from the back row (or if much better at
 *  throwing) they throw stones; otherwise hand to hand, with their weapon or knife. */
export function personFighter(p: Person, role: Role, row: 'front' | 'back', ammo = 0): Fighter {
  const melee = p.skills.melee.level;
  const cls = p.cls ? CLASS_DEFS[p.cls] : undefined;
  // (a caster's aim is their study: their staff or their bare hands carry their spells)
  const caster = cls?.role === 'caster' || cls?.role === 'healer';
  const ranged = caster ? Math.max(p.skills.ranged.level, p.skills.research.level) : p.skills.ranged.level;
  const w = weaponOf(p);
  const weapon = w.def;
  const knife = p.gear.tool ? (ITEM_BY_ID[p.gear.tool]?.effects.damage ?? 0) : 0;
  const sling = !!weapon?.effects.ranged;
  // (a class that fights from range does, whatever they hold)
  const useRanged = sling || row === 'back' || ranged > melee + 2 || !!cls?.ranged;
  const skill = useRanged ? ranged : melee;
  // the weapon only helps in the way it's used
  const bonus = Math.round(useRanged ? (sling ? w.damage : 0) : sling || !weapon ? knife : w.damage);
  const used = !!weapon && sling === useRanged;
  const aim = used ? w.accuracy : 0;
  const base: [number, number] = useRanged ? [Math.round(2 + ranged * 0.5), Math.round(4 + ranged * 0.5)] : [Math.round(3 + melee * 0.6), Math.round(5 + melee * 0.6)];
  const wolf = p.monster === 'werewolf' ? WEREWOLF_DAMAGE : 0; // (a werewolf fights with more than a weapon)
  // (their attributes: a caster's blows by their Intellect, anyone else's by their Strength; Dexterity in their aim,
  // their footwork and how often their turn comes; Vitality in their health)
  const at = attributesOf(p);
  const over = (k: keyof Attrs) => Math.max(0, at[k] - ATTR_BASE);
  const attrK = 1 + (caster ? over('int') * INT_POWER : over('str') * STR_DAMAGE);
  // (their class, its stage and their level make them stronger: casters by their spell power)
  const k = (caster ? classStat(p, 'power') : classStat(p, 'damage')) * levelPower(p) * attrK;
  // (and their wounds: a lost arm or a blind eye tells: sim/injuries.ts)
  const inj = injuryFight(p);
  const damage: [number, number] = [Math.round((base[0] + bonus + wolf) * k * inj.damage), Math.round((base[1] + bonus + wolf) * k * inj.damage)];
  const g = gearEffects(p);
  // (their skills: always-on passives, and the kit of spells and skills they use)
  const ps = passiveStats(p);
  const kit = role === 'porter' ? undefined : kitOf(p);
  const most = Math.round(maxHp(p) * (1 + (ps.hp ?? 0) + over('vit') * VIT_HP));
  const wq = used ? w.quirks : NO_QUIRKS;
  const quirks: Quirks = {
    ...wq,
    crit: wq.crit + classStat(p, 'crit') + (ps.crit ?? 0),
    pierce: wq.pierce + (ps.pierce ?? 0),
    cleave: wq.cleave + (ps.cleave ?? 0),
    stun: wq.stun + (ps.stun ?? 0),
    beastShare: ps.beast,
    undeadShare: ps.undead,
    machineShare: ps.machine,
    critDamage: ps.critDamage,
  };
  return {
    side: 'party',
    ref: p.id,
    kind: 'person',
    name: p.name,
    hp: Math.min(most, Math.round((p.hp * most) / Math.max(1, maxHp(p)))), // (the same share of their health, at the fight's reckoning)
    maxHp: most,
    row,
    ranged: useRanged,
    damage: role === 'porter' ? [0, 0] : damage,
    accuracy: 0.55 + skill * 0.025 + aim + inj.aim + classStat(p, 'accuracy') + (ps.accuracy ?? 0) + over('dex') * DEX_AIM,
    dodge: 0.05 + melee * 0.01 + g.dodge + classStat(p, 'dodge') + (ps.dodge ?? 0) + over('dex') * DEX_DODGE,
    interval: Math.max(3, Math.round(PERSON_INTERVAL * TICK_HZ * (used ? w.speed : 1) * g.slow * classStat(p, 'speed') * (1 - (ps.speed ?? 0)) * speedOfDex(at.dex))),
    cooldown: 0,
    down: p.hp <= 0,
    role,
    heal: role === 'medic' ? 3 + p.skills.medicine.level * 0.5 : 0,
    tough: p.traits.includes('tough'),
    coward: p.traits.includes('coward'),
    lastAction: -99,
    lastHit: -99,
    attacks: 0,
    armor: Math.min(0.7, g.armor + classStat(p, 'armor') + (ps.armor ?? 0)),
    block: Math.min(0.6, g.block + (ps.block ?? 0)),
    beastDamage: g.beastDamage,
    quirks,
    ...(kit ? { kit } : {}),
    ammoType: ammoOf(p),
    ammo: ammoOf(p) ? ammo : 0,
    ammoBonus: AMMO_DAMAGE[ammoOf(p) ?? 'wood'] ?? 0,
    ammoUsed: 0,
    cls: p.cls ?? null,
    attrs: at,
    mp: maxManaOf(at),
    maxMp: maxManaOf(at),
    sp: maxStaminaOf(at),
    maxSp: maxStaminaOf(at),
    limit: 0,
  };
}

/** Damage one attack does to a target, after ammo, beast bonus, blocking, armour and toughness. Uses the
 *  attacker's ammo. Returns 0 for a blocked blow. */
export function hitDamage(f: Pick<Fighter, 'damage' | 'ammo' | 'ammoBonus' | 'ammoUsed' | 'beastDamage' | 'quirks'>, target: { kind: string; armor: number; block: number; tough: boolean }, rng: Rng): number {
  let dmg = rng.int(f.damage[0], f.damage[1]);
  if (f.ammoBonus && f.ammo > 0) {
    f.ammo--;
    f.ammoUsed++;
    dmg += f.ammoBonus;
  }
  if (isBeast(target.kind)) dmg += f.beastDamage;
  const q = f.quirks;
  if (q) {
    const nature = natureOf(target.kind);
    if (nature === 'undead') dmg = (dmg + q.undead) * (1 + (q.undeadShare ?? 0));
    if (nature === 'machine') dmg = (dmg + q.machine) * (1 + (q.machineShare ?? 0));
    if (nature === 'beast') dmg *= 1 + (q.beastShare ?? 0);
    // (a true strike: double, or more)
    if (q.crit && rng.chance(q.crit)) dmg *= 2 + (q.critDamage ?? 0);
  }
  if (target.block && rng.chance(target.block)) return 0;
  const armor = target.armor * (1 - (q?.pierce ?? 0));
  return Math.max(1, Math.round(dmg * (1 - armor) * (target.tough ? 0.85 : 1)));
}

/** After a blow lands: a stunning weapon may cost the foe its next blow, a cleaving one carries into another foe
 *  beside it (any of `beside`, for that share of the blow). Returns who the cleave struck. */
export function afterBlow(q: Quirks | undefined, dmg: number, target: { cooldown: number; interval?: number }, beside: { hp: number; down: boolean }[], rng: Rng): { hp: number; down: boolean } | null {
  if (!q) return null;
  if (q.stun && rng.chance(q.stun)) target.cooldown += target.interval ?? STUN_TICKS;
  if (!q.cleave || !beside.length) return null;
  const o = beside[rng.int(0, beside.length - 1)];
  o.hp = Math.max(0, o.hp - Math.max(1, Math.round(dmg * q.cleave)));
  if (o.hp === 0) o.down = true;
  return o;
}
/** How long a stun holds a foe whose pace isn't known (ticks). */
const STUN_TICKS = 12;

function enemyFighters(group: EnemyGroup): Fighter[] {
  const out: Fighter[] = [];
  for (const [id, n] of Object.entries(group)) for (let i = 0; i < n; i++) out.push(unitFighter(id, 'enemy', out.length));
  return out;
}

/** A fighter from an enemy (or ally) def, on either side. */
export function unitFighter(id: string, side: Fighter['side'], ref: number): Fighter {
  const d = ENEMIES[id];
  return {
    side,
    ref,
    kind: id,
    name: d.name,
    hp: d.hp,
    maxHp: d.hp,
    row: d.ranged ? 'back' : 'front',
    ranged: d.ranged,
    damage: d.damage,
    accuracy: d.accuracy,
    dodge: d.dodge,
    interval: Math.round(d.interval * TICK_HZ),
    cooldown: 0,
    down: false,
    role: side === 'enemy' ? 'enemy' : 'fighter',
    heal: 0,
    tough: false,
    coward: false,
    lastAction: -99,
    lastHit: -99,
    attacks: 0,
    armor: enemyArmor(id),
    block: 0,
    beastDamage: 0,
    ammo: 0,
    ammoBonus: 0,
    ammoUsed: 0,
  };
}

/**
 * Set up a fight. Fighters go in front; everyone else in back (if nobody fights, everyone stands in front).
 * The ammunition in `ammo` (sling stones, arrows) is shared out among whoever shoots that kind.
 */
export function startBattle(members: Person[], roles: Record<number, Role>, group: EnemyGroup, rng: Rng, ammo: Stock = {}): Battle {
  const standing = members.filter((p) => p.hp > 0 && !p.downed);
  const anyFighter = standing.some((p) => (roles[p.id] ?? 'fighter') === 'fighter');
  const party = standing.map((p) => {
    const role = roles[p.id] ?? 'fighter';
    const front = role === 'fighter' || (!anyFighter && role !== 'porter');
    const kind = ammoOf(p);
    const shooters = kind ? standing.filter((q) => ammoOf(q) === kind) : [];
    const have = kind ? (ammo[kind] ?? 0) : 0;
    const i = shooters.indexOf(p);
    const share = i < 0 ? 0 : Math.floor(have / shooters.length) + (i < have % shooters.length ? 1 : 0);
    return personFighter(p, role, front ? 'front' : 'back', share);
  });
  const fighters = [...party, ...enemyFighters(group)];
  // stagger first actions so nobody moves in lockstep
  for (const f of fighters) f.cooldown = f.kit?.passive.firstStrike ? 1 : rng.int(1, f.interval);
  return { fighters, tick: 0, outcome: null, boss: Object.keys(group).some((id) => ENEMIES[id].boss) };
}

export interface BattleRules {
  /** Party HP fraction at which they fall back. */
  retreatAt: number;
  /** The main character's person id, if they're in the fight (they pull the party out when badly hurt). */
  mainId: number | null;
}

/** The fight as the spells and skills see it (actions.ts). */
function arenaOf(b: Battle, rng: Rng): Arena {
  return {
    tick: b.tick,
    rng,
    all: () => b.fighters,
    summon: (user, kind) => {
      if (!ENEMIES[kind]) return null;
      const f: Fighter = { ...unitFighter(kind, user.side, -5000 - b.fighters.length), conjured: true, cooldown: 5 };
      if (user.side === 'party') f.role = 'fighter';
      b.fighters.push(f);
      return f;
    },
    log: (user, name, targets, meta) => {
      (b.acts ??= []).push({ tick: b.tick, side: user.side, ref: user.ref, name, targets: targets.map((t) => t.ref), ...(meta ? { meta } : {}) });
      if (meta?.ult) {
        (b.shouts ??= []).push(`${user.name} unleashes ${name}!`);
        b.beat = ULT_BEAT;
      }
      if (b.acts.length > 12) b.acts.shift();
    },
  };
}

/** One tick of fighting. Sets `outcome` when it's over. */
export function stepBattle(b: Battle, rng: Rng, rules: BattleRules): void {
  if (b.outcome) return;
  b.tick++;
  const arena = arenaOf(b, rng);
  for (const f of b.fighters) tickStatuses(arena, f);
  // Turn-based: everyone's gauge fills (cooldown runs down), but only one acts a tick, and a beat passes after each
  // action before the next may (so turns come one at a time, and the quick, by Dexterity, come round more often).
  for (const f of b.fighters) if (!f.down) f.cooldown--; // (below zero while they wait their turn: the longest waiting goes first)
  if ((b.beat ?? 0) > 0) {
    b.beat!--;
    return endCheck(b, rules);
  }
  const ready = b.fighters.filter((f) => !f.down && f.cooldown <= 0).sort((x, y) => x.cooldown - y.cooldown || (y.attrs?.dex ?? 0) - (x.attrs?.dex ?? 0));
  for (const f of ready.slice(0, 1)) {
    f.cooldown = pace(f, b.tick);
    b.beat = TURN_BEAT;
    // (mana and stamina come back a little each turn)
    if (f.attrs) {
      if (f.mp !== undefined && f.maxMp !== undefined) f.mp = Math.min(f.maxMp, f.mp + manaRegenOf(f.attrs));
      if (f.sp !== undefined && f.maxSp !== undefined) f.sp = Math.min(f.maxSp, f.sp + staminaRegenOf(f.attrs));
    }
    if (f.role === 'porter') continue;
    // stunned, asleep, frozen, stopped: the turn is lost
    if (held(f, b.tick)) continue;
    // a spell or a skill, when one is ready and worth it
    if (takeTurn(arena, f)) {
      f.attacks++;
      continue;
    }
    if (afraid(f, b.tick)) continue;
    if (f.role === 'medic') {
      const hurt = b.fighters.filter((o) => o.side === f.side && !o.down && o.hp < o.maxHp).sort((a, c) => a.hp / a.maxHp - c.hp / c.maxHp)[0];
      if (hurt) {
        hurt.hp = Math.min(hurt.maxHp, hurt.hp + f.heal);
        f.lastAction = b.tick;
      }
      continue;
    }
    // A hurt coward backs out of the front line and throws stones instead.
    if (f.coward && f.row === 'front' && f.hp < f.maxHp * 0.6) {
      f.row = 'back';
      f.ranged = true;
    }
    const foes = b.fighters.filter((o) => o.side !== f.side && !o.down);
    if (!foes.length) break;
    const front = foes.filter((o) => o.row === 'front');
    const reachable = f.ranged || !front.length ? foes : front;
    let target = f.ranged ? reachable.reduce((a, c) => (c.hp < a.hp ? c : a)) : reachable[rng.int(0, reachable.length - 1)];
    // a guardian steps in front of a friend who's badly hurt; a foe taunting draws the blow
    const taunting = reachable.find((o) => (o.st?.taunt?.until ?? 0) > b.tick);
    if (taunting) target = taunting;
    else if (target.hp < target.maxHp * 0.5) {
      const guard = foes.find((o) => o !== target && !o.down && o.kit?.passive.guard && rng.chance(o.kit.passive.guard));
      if (guard) target = guard;
    }
    f.lastAction = b.tick;
    f.attacks++;
    if (f.sp !== undefined && f.maxSp !== undefined) f.sp = Math.min(f.maxSp, f.sp + STAMINA_PER_BLOW); // (a plain blow steadies the breath)
    if (rng.next() >= f.accuracy - target.dodge) {
      if (f.ammoBonus && f.ammo > 0) (f.ammo--, f.ammoUsed++); // a stone thrown is a stone gone
      continue; // miss
    }
    // an epic boss: every few blows, a sweeping attack that hits several at once
    const kit = f.kind !== 'person' ? ENEMIES[f.kind]?.kit : undefined;
    if (kit?.area) {
      f.bossAttacks = (f.bossAttacks ?? 0) + 1;
      if (f.bossAttacks % kit.area.every === 0) {
        const hit = foes.slice().sort(() => rng.next() - 0.5).slice(0, kit.area.targets);
        for (const t of hit) {
          const d = hitDamage(f, t, rng);
          t.hp = Math.max(0, t.hp - d);
          t.lastHit = b.tick;
          t.hitFx = null;
          if (t.hp === 0) t.down = true;
        }
        (b.shouts ??= []).push(`${f.name} ${kit.area.name}!`);
        f.lastArea = b.tick;
        continue;
      }
    }
    let dmg = hitDamage(f, target, rng);
    if (!dmg) continue; // blocked
    // a Blood Knight hits harder when hurt, and drinks in some of what they deal
    if (f.cls === 'blood_knight') {
      if (f.hp < f.maxHp / 2) dmg = Math.round(dmg * BLOOD_FURY);
      f.hp = Math.min(f.maxHp, f.hp + Math.round(dmg * BLOOD_LIFESTEAL));
    }
    // (through shields, protection and the rest: actions.ts; the armour's already counted)
    dmg = strike(arena, f, target, dmg, true, true);
    // (a unique that drinks life heals by a share of the blow)
    if (f.quirks?.drain && dmg > 0) f.hp = Math.min(f.maxHp, f.hp + Math.round(dmg * f.quirks.drain));
    // a guard strikes back
    if (!f.ranged && !target.down && target.kit?.passive.counter && rng.chance(target.kit.passive.counter)) strike(arena, target, f, hitDamage(target, f, rng), true, true);
    const cleft = afterBlow(f.quirks, dmg, target, foes.filter((o) => o !== target && o.row === target.row), rng) as Fighter | null;
    if (cleft) cleft.lastHit = b.tick;
    target.hitFx = f.cls === 'blood_knight' ? 'blood' : f.ranged && f.ammoType === 'power_cells' ? 'lightning' : f.ranged && (f.ammoType === 'shot' || f.ammoType === 'cartridges') ? 'fire' : null;
    bossHurt(b, target);
    if (target.hp === 0) target.down = true;
  }
  raiseFallen(b);
  endCheck(b, rules);
}

/** Whether the fight is over: won, lost, or the party pulling out. */
function endCheck(b: Battle, rules: BattleRules): void {
  const party = b.fighters.filter((f) => f.side === 'party');
  const enemies = b.fighters.filter((f) => f.side === 'enemy');
  if (enemies.every((f) => f.down)) b.outcome = 'won';
  else if (party.every((f) => f.down || f.role === 'porter')) b.outcome = 'lost';
  else if (b.tick >= MIN_TICKS_BEFORE_RETREAT) {
    const hp = party.reduce((n, f) => n + f.hp, 0) / party.reduce((n, f) => n + f.maxHp, 0);
    const main = party.find((f) => f.ref === rules.mainId);
    if (hp < rules.retreatAt || (main && !main.down && main.hp < main.maxHp * 0.5) || (main && main.down)) b.outcome = 'retreated';
  }
}

/** A Necromancer raises the enemies that fell, whatever felled them (a blow or a spell), to fight for their side. */
function raiseFallen(b: Battle): void {
  for (const target of b.fighters) {
    if (!target.down || target.side !== 'enemy' || target.raiseChecked) continue;
    target.raiseChecked = true;
    const necro = b.fighters.find((o) => o.side === 'party' && o.cls === 'necromancer' && !o.down && (o.raised ?? 0) < NECRO_RAISES);
    if (!necro || ENEMIES[target.kind]?.boss) continue;
    necro.raised = (necro.raised ?? 0) + 1;
    target.side = 'party';
    target.role = 'fighter';
    target.down = false;
    target.hp = Math.round(target.maxHp / 2);
    target.raisedBy = necro.ref;
  }
}

/** A boss below half health rages (harder, faster) and calls for help, once each. */
function bossHurt(b: Battle, f: Fighter): void {
  const kit = f.kind !== 'person' ? ENEMIES[f.kind]?.kit : undefined;
  if (!kit || f.down || f.hp >= f.maxHp / 2) return;
  if (!f.enraged) {
    f.enraged = true;
    f.damage = [Math.round(f.damage[0] * BOSS_RAGE), Math.round(f.damage[1] * BOSS_RAGE)];
    f.interval = Math.max(3, Math.round(f.interval * 0.75));
    (b.shouts ??= []).push(kit.enrage);
  }
  if (kit.summon && !f.summoned) {
    f.summoned = true;
    for (let i = 0; i < kit.summon.count; i++) b.fighters.push({ ...unitFighter(kit.summon.kind, f.side, 100 + b.fighters.length), cooldown: 5 });
    (b.shouts ??= []).push(kit.summon.text);
  }
}

/** How much harder a raging boss hits. */
export const BOSS_RAGE = 1.5;

/** Loot dropped by the enemies that fell. */
export function battleLoot(b: Battle): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of b.fighters) {
    if (f.side !== 'enemy' || !f.down) continue;
    for (const [m, n] of Object.entries(ENEMIES[f.kind].loot)) out[m] = (out[m] ?? 0) + (n ?? 0);
  }
  return out;
}
