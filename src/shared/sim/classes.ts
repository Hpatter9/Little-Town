// Special classes (see data/classes.ts): training someone into one, the allies they bring to a fight, and
// what they do in raids at home.

import { CLASS_DEFS, NECRO_RANGE, TAME_EVERY, TAME_RANGE, type ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { MATERIAL_NAMES, type Material } from '../data/materials';
import { TOPIC_BY_ID } from '../data/research';
import { SKILL_NAMES } from '../data/skills';
import { totalStock, storages } from './buildings';
import { addItems } from './crafting';
import { isBeast, unitFighter, type Fighter } from './combat';
import { addStock, notify, type GameState, type Person, type Raid, type Raider } from './state';
import { TICK_HZ } from './time';

export interface TrainCheck {
  ok: boolean;
  reason?: string;
}

export function canTrain(s: GameState, p: Person, cls: ClassId, stock = totalStock(s)): TrainCheck {
  const def = CLASS_DEFS[cls];
  if (!def) return { ok: false, reason: 'Unknown class' };
  if (p.cls) return { ok: false, reason: `${p.name} is already a ${CLASS_DEFS[p.cls].name}` };
  if (p.bornTick != null) return { ok: false, reason: 'Too young' };
  if (p.away !== null) return { ok: false, reason: 'Away' };
  if (!s.research.done.includes(def.research)) return { ok: false, reason: `Needs research: ${TOPIC_BY_ID[def.research]?.name ?? def.research}` };
  // one of each calling in a town at a time
  const holder = s.people.find((q) => q.cls === cls);
  if (holder) return { ok: false, reason: `The town already has a ${def.name}: ${holder.name}` };
  if (p.skills[def.skill].level < def.level) return { ok: false, reason: `Needs ${SKILL_NAMES[def.skill]} ${def.level}` };
  const deed = deedUnmet(s, p, cls);
  if (deed) return { ok: false, reason: deed };
  const short = (Object.entries(def.cost) as [Material, number][]).filter(([m, n]) => (stock[m] ?? 0) < n);
  if (short.length) return { ok: false, reason: `Needs ${short.map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`).join(', ')}` };
  return { ok: true };
}

/** What the calling's deed still asks (null when it's been done). */
function deedUnmet(s: GameState, p: Person, cls: ClassId): string | null {
  const deed = CLASS_DEFS[cls].deed;
  switch (deed.kind) {
    case 'burials': {
      const buried = s.burials ?? s.graves?.length ?? 0; // (older saves only know the graves still standing)
      return buried >= deed.count ? null : `The town has buried ${buried} of its own; a Necromancer needs ${deed.count}`;
    }
    case 'totem':
      return (s.items.spirit_totem ?? 0) > 0 ? null : 'Needs a Spirit Totem to give up';
    case 'scarred':
      return p.scarred ? null : `${p.name} has never been cut down and lived`;
    default:
      return null;
  }
}

/** Train someone into a class, using up its materials. */
export function train(s: GameState, personId: number, cls: ClassId): TrainCheck {
  const p = s.people.find((q) => q.id === personId);
  if (!p) return { ok: false, reason: 'Unknown person' };
  const check = canTrain(s, p, cls);
  if (!check.ok) return check;
  for (const [m, n] of Object.entries(CLASS_DEFS[cls].cost) as [Material, number][]) {
    let left = n;
    for (const st of storages(s)) {
      const k = Math.min(left, st.store[m] ?? 0);
      if (k > 0) {
        addStock(st.store, m, -k);
        left -= k;
      }
    }
  }
  if (CLASS_DEFS[cls].deed.kind === 'totem') addItems(s, 'spirit_totem', -1);
  p.cls = cls;
  notify(s, `${p.name} has become a ${CLASS_DEFS[cls].name}.`, true);
  return { ok: true };
}

/** Allies a party brings into a battle: a Summoner's spirit, a Beast Tamer's wolf. */
export function classAllies(members: Person[]): Fighter[] {
  const out: Fighter[] = [];
  for (const p of members) {
    if (p.hp <= 0 || p.downed) continue;
    if (p.cls === 'summoner') out.push(unitFighter('spirit', 'party', -p.id * 10 - 1));
    if (p.cls === 'beast_tamer') out.push(unitFighter('companion_wolf', 'party', -p.id * 10 - 2));
  }
  return out;
}

/* ------------------------------------------------------------ raids at home */

const inTown = (s: GameState, cls: ClassId) => s.people.filter((p) => p.cls === cls && p.away === null && !p.downed);

/** An ally raider (summoned, raised or tamed) next to x. */
export function ally(s: GameState, kind: string, x: number, dir: 1 | -1): Raider {
  const d = ENEMIES[kind];
  return { id: s.nextId++, kind, x, dir, hp: d.hp, maxHp: d.hp, cooldown: 5, down: false, fleeing: false, gone: false, carrying: {}, lastAction: -999, lastHit: -999, goal: 'harm', ally: true, conjuredAt: s.tick };
}

/** When raiders arrive: each Summoner in town calls a spirit; each Necromancer calls one of the town's own dead up
 *  out of the graveyard (while there are graves to call on). */
export function summonForRaid(s: GameState, r: Raid): void {
  for (const p of inTown(s, 'summoner')) r.raiders.push(ally(s, 'spirit', p.x, p.dir));
  if (inTown(s, 'summoner').length) notify(s, 'Spirits answer the summoner\'s call!');
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
  const tamers = inTown(s, 'beast_tamer');
  if (tamers.length && s.tick >= (r.nextTame ?? 0)) {
    for (const p of tamers) {
      const beast = r.raiders.find((rd) => !rd.down && !rd.gone && !rd.ally && isBeast(rd.kind) && !ENEMIES[rd.kind].boss && Math.abs(rd.x - p.x) <= TAME_RANGE);
      if (!beast) continue;
      beast.ally = true;
      beast.fleeing = false;
      beast.conjuredAt = s.tick;
      r.nextTame = s.tick + TAME_EVERY * TICK_HZ;
      notify(s, `${p.name} tames the ${ENEMIES[beast.kind].name.toLowerCase()}: it turns on the others!`);
    }
  }
}
