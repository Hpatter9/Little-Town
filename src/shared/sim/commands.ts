// Player actions. The UI never edits state directly: it sends commands, and the sim applies them at the
// start of the next tick so every change happens at a well-defined point in sim time.

import type { TacticsOrder } from './tactics';
import type { RealmOp } from './factions';
const REALM_OPS: readonly RealmOp[] = ['gift', 'peace', 'trade', 'alliance', 'war', 'demand', 'free', 'marry'];
import { TAX_RATES, type TaxRate } from '../data/economy';
import { ATTR_KEYS, type Attrs } from '../data/attributes';
import type { MonsterKind } from '../data/monsters';
const TURN_KINDS: readonly string[] = ['undead', 'vampire', 'werewolf'];
import { BUILDING_BY_ID } from '../data/buildings';
import { DESTINATION_BY_ID, ROLES, STANCES, type Role, type Stance } from '../data/expeditions';
import { ITEM_BY_ID, SLOTS, type Slot } from '../data/items';
import { MATERIALS, type Material } from '../data/materials';
import { ORDER_NAMES, type StandingOrder } from '../data/monsters';
import { JOBS, type Job, type Priority } from '../data/people';
import { TOPIC_BY_ID } from '../data/research';
import { DIRECTIONS, type Direction } from './planner';

export type MusterOp = 'raise' | 'add' | 'drop' | 'lead' | 'persuade' | 'order' | 'set' | 'send' | 'cancel';
const MUSTER_OPS: readonly MusterOp[] = ['raise', 'add', 'drop', 'lead', 'persuade', 'order', 'set', 'send', 'cancel'];

export type Command =
  | { type: 'setPaused'; paused: boolean }
  /** Where the self-running town puts its effort. */
  | { type: 'setDirection'; direction: Direction }
  | { type: 'setTownSize'; size: number | null }
  | { type: 'setTax'; rate: TaxRate }
  /** Forbid a destination to the town's parties, or allow it again; post (raise) or withdraw a bounty on one. */
  | { type: 'veto'; dest: string; on: boolean }
  | { type: 'bounty'; dest: string; post: boolean }
  /** Mark a wild cell of the land for gathering (clearing it), or unmark it. */
  | { type: 'toggleGather'; cell: number }
  /** Place a blueprint with its top-left cell at (x, y). */
  | { type: 'placeBuilding'; def: string; x: number; y: number }
  /** Cancel a blueprint or demolish a finished building. */
  | { type: 'demolish'; building: number }
  /** Throw out everything of one material held in a storage building (to make room). */
  | { type: 'discardStock'; building: number; material: Material }
  /** Add a topic to the end of the research queue. */
  | { type: 'queueResearch'; topic: string }
  /** Remove a topic (and anything queued that depends on it) from the queue. Progress is kept. */
  | { type: 'cancelResearch'; topic: string }
  /** Move a topic to the front of the queue. */
  | { type: 'researchNext'; topic: string }
  /** Send a party (leader first) to a destination, with a role for each member and a stance. */
  | { type: 'sendExpedition'; dest: string; members: number[]; roles?: Record<number, Role>; stance?: Stance; horses?: number; truck?: boolean }
  /** Send a party the town plans, at the stakes the player picks (safe or risky). */
  | { type: 'sendParty'; dest: string; stakes: 'safe' | 'risky' }
  | { type: 'sendDelve'; dest: string; members: number[]; stakes: 'safe' | 'risky' }
  /** Raise a party yourself (sim/muster.ts): raise one for a place, ask or drop someone, make them leader, talk round
   *  or order someone who said no, set how boldly and what's packed, send them, or call it off. */
  /** Diplomacy with a power of the realm (sim/factions.ts). */
  | { type: 'realm'; faction: string; op: RealmOp }
  | { type: 'muster'; op: MusterOp; dest?: string; person?: number; stakes?: 'safe' | 'risky'; rations?: 'lean' | 'normal' | 'plenty'; torches?: number; horses?: boolean }
  /** Pass on a curse (hidden): turn one person, or everyone who can be. */
  | { type: 'turnPerson'; person: number; kind: MonsterKind }
  | { type: 'turnTown'; kind: MonsterKind }
  /** Train someone into a special class. */
  /** Rebuild a finished building as its upgrade, in place. */
  | { type: 'upgrade'; building: number }
  /** Take a caravan's offer. */
  | { type: 'trade'; offer: number }
  /** Hand a building's operator role to the next candidate. */
  | { type: 'cycleOperator'; building: number }
  /** Let a prisoner go. */
  | { type: 'releasePrisoner'; prisoner: number }
  /** A monster's standing order for when the Hunter's Guild comes. */
  | { type: 'setOrder'; person: number; order: StandingOrder }
  /** Answer a question from the road. */
  | { type: 'answerPrompt'; prompt: number; option: number }
  /** Keep one of the origin's powers back to cast yourself (null: let the town cast them all), and cast it. */
  | { type: 'holdPower'; power: string | null }
  | { type: 'castHeld' }
  /** Follow a townsperson (null: nobody). */
  | { type: 'follow'; person: number | null }
  | { type: 'watch'; expedition: number | null }
  /** Go into a mine on the land and watch the digging (null: back to the town). */
  | { type: 'watchMine'; place: number | null }
  /** Look down into the Deep (sim/deep.ts): a level by its depth, or null to come back up. */
  | { type: 'watchDeep'; depth: number | null }
  | { type: 'watchPortal'; realm: string | null }
  | { type: 'lookInside'; building: number | null }
  | { type: 'giftVillage'; id: number }
  /** Rally a defender in a raid (a burst of courage; sim/rally.ts). */
  | { type: 'rally'; person: number }
  /** The battle on the trail (sim/battle.ts): put a fighter on a spot (or off: null), send the raiders on now, auto-watch
   *  on or off, and cast a power at a point on the map. */
  | { type: 'battlePlace'; person: number; spot: number | null }
  | { type: 'battleGo' }
  | { type: 'battleAuto'; on: boolean }
  | { type: 'battleSpeed'; speed: number }
  | { type: 'battleStyle'; style: 'trail' | 'tactics' }
  /** Spend one of a townsperson's stat points (data/attributes.ts), or all of them their class's way (`attr` null). */
  | { type: 'spendStat'; person: number; attr: keyof Attrs | null }
  /** Whether someone spends their own points from now on (attributes.ts `statsHourly`). */
  | { type: 'autoStats'; person: number; on: boolean }
  /** Whether evolutions and stat points are put to the player, or left to the town. */
  | { type: 'setAsk'; evolve?: boolean; stats?: boolean }
  /** The conquest (sim/conquest/squads.ts): train a batch of troops, form a squad round a hero, set a place in its
   *  formation (a troop kind, or null to clear it), disband it. */
  | { type: 'conquest'; op: 'train'; troop: string; n: number }
  | { type: 'conquest'; op: 'form'; hero: number }
  | { type: 'conquest'; op: 'slot'; squad: number; slot: number; troop: string | null }
  | { type: 'conquest'; op: 'disband'; squad: number }
  /** Fill a squad's empty places from the trained troops as its hero would (sim/conquest/squads.ts `fillSquad`). */
  | { type: 'conquest'; op: 'fill'; squad: number }
  /** Armies (sim/conquest/armies.ts): raise one round a squad, add or drop a squad (at home), load spare troops into
   *  its train, march it to a province (any: it goes the shortest friendly way), leave `n` of its train as a garrison
   *  where it stands, pick a garrison up, recall it home, dismiss it. */
  | { type: 'conquest'; op: 'raise'; squad: number }
  | { type: 'conquest'; op: 'add'; army: number; squad: number }
  | { type: 'conquest'; op: 'drop'; army: number; squad: number }
  | { type: 'conquest'; op: 'load'; army: number; troop: string; n: number }
  | { type: 'conquest'; op: 'march'; army: number; province: number }
  | { type: 'conquest'; op: 'garrison'; army: number; n: number }
  | { type: 'conquest'; op: 'pickup'; army: number }
  | { type: 'conquest'; op: 'recall'; army: number }
  | { type: 'conquest'; op: 'dismiss'; army: number }
  /** Pay a captive hero's ransom (sim/conquest/battles.ts). */
  | { type: 'conquest'; op: 'ransom'; hero: number }
  | { type: 'tactics'; order: TacticsOrder }
  | { type: 'gameSpeed'; speed: number }
  /** A cutscene: watch it (one waiting, or one seen before), it's done (played to the end), or skip it (sim/cutscenes.ts). */
  | { type: 'scene'; op: 'watch' | 'done' | 'skip'; key: number }
  | { type: 'battleCast'; power: string; x: number; y: number }
  /** Turn a party around. */
  | { type: 'recallExpedition'; expedition: number }
  /** Let the waiting visitor join, or send them on their way. */
  | { type: 'acceptVisitor' }
  | { type: 'rejectVisitor' }
  /** Set one job priority by hand (turns off auto mode for that person). */
  | { type: 'setPriority'; person: number; job: Job; priority: Priority }
  /** Let a person's priorities follow their skills. */
  | { type: 'setAutoPriorities'; person: number; on: boolean }
  /** Add one of an item to the craft queue. */
  | { type: 'queueCraft'; item: string }
  /** Make one fewer of an order (or cancel it outright). */
  | { type: 'reduceCraft'; order: number; all: boolean }
  /** Put a spare item on someone (or take off what's in the slot, with item null). */
  | { type: 'equip'; person: number; slot: Slot; item: string | null }
  /** Close the "while you were away" report (it stays in the Journal). */
  | { type: 'dismissAway' }
  /** Bind the founder's soul into a phylactery (once Lichcraft is learned): the town builds it. */
  | { type: 'becomeLich' }
  /** Debug: make every building available regardless of research. */
  | { type: 'cheatUnlockAll'; on: boolean };

/** Validate a command that arrived over IPC. */
export function parseCommand(raw: unknown): Command | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  switch (c.type) {
    case 'setPaused':
      return typeof c.paused === 'boolean' ? { type: 'setPaused', paused: c.paused } : null;
    case 'becomeLich':
      return { type: 'becomeLich' };
    case 'setDirection':
      return DIRECTIONS.includes(c.direction as Direction) ? { type: 'setDirection', direction: c.direction as Direction } : null;
    case 'setTax':
      return TAX_RATES.includes(c.rate as TaxRate) ? { type: 'setTax', rate: c.rate as TaxRate } : null;
    case 'veto':
      return typeof c.dest === 'string' && typeof c.on === 'boolean' ? { type: 'veto', dest: c.dest, on: c.on } : null;
    case 'bounty':
      return typeof c.dest === 'string' && typeof c.post === 'boolean' ? { type: 'bounty', dest: c.dest, post: c.post } : null;
    case 'setTownSize':
      return c.size === null || (Number.isInteger(c.size) && (c.size as number) >= 1 && (c.size as number) <= 200) ? { type: 'setTownSize', size: c.size as number | null } : null;
    case 'toggleGather':
      return Number.isInteger(c.cell) ? { type: 'toggleGather', cell: c.cell as number } : null;
    case 'placeBuilding':
      return typeof c.def === 'string' && BUILDING_BY_ID[c.def] && Number.isInteger(c.x) && Number.isInteger(c.y) ? { type: 'placeBuilding', def: c.def, x: c.x as number, y: c.y as number } : null;
    case 'demolish':
      return Number.isInteger(c.building) ? { type: 'demolish', building: c.building as number } : null;
    case 'turnPerson':
      return Number.isInteger(c.person) && TURN_KINDS.includes(c.kind as MonsterKind) ? { type: 'turnPerson', person: c.person as number, kind: c.kind as MonsterKind } : null;
    case 'turnTown':
      return TURN_KINDS.includes(c.kind as MonsterKind) ? { type: 'turnTown', kind: c.kind as MonsterKind } : null;
    case 'upgrade':
      return Number.isInteger(c.building) ? { type: 'upgrade', building: c.building as number } : null;
    case 'discardStock':
      return Number.isInteger(c.building) && MATERIALS.includes(c.material as Material)
        ? { type: 'discardStock', building: c.building as number, material: c.material as Material }
        : null;
    case 'queueCraft':
      return typeof c.item === 'string' && ITEM_BY_ID[c.item] ? { type: 'queueCraft', item: c.item } : null;
    case 'reduceCraft':
      return Number.isInteger(c.order) ? { type: 'reduceCraft', order: c.order as number, all: c.all === true } : null;
    case 'equip':
      return Number.isInteger(c.person) && SLOTS.includes(c.slot as Slot) && (c.item === null || (typeof c.item === 'string' && ITEM_BY_ID[c.item]))
        ? { type: 'equip', person: c.person as number, slot: c.slot as Slot, item: c.item as string | null }
        : null;
    case 'queueResearch':
    case 'cancelResearch':
    case 'researchNext':
      return typeof c.topic === 'string' && TOPIC_BY_ID[c.topic] ? { type: c.type, topic: c.topic } : null;
    case 'sendDelve':
      return typeof c.dest === 'string' && Array.isArray(c.members) && c.members.every((m: unknown) => typeof m === 'number') && (c.stakes === 'safe' || c.stakes === 'risky') ? { type: 'sendDelve', dest: c.dest, members: c.members as number[], stakes: c.stakes } : null;
    case 'realm':
      return typeof c.faction === 'string' && REALM_OPS.includes(c.op as RealmOp) ? { type: 'realm', faction: c.faction, op: c.op as RealmOp } : null;
    case 'muster': {
      if (!MUSTER_OPS.includes(c.op as MusterOp)) return null;
      const out: Command = { type: 'muster', op: c.op as MusterOp };
      if (typeof c.dest === 'string') out.dest = c.dest;
      if (Number.isInteger(c.person)) out.person = c.person as number;
      if (c.stakes === 'safe' || c.stakes === 'risky') out.stakes = c.stakes;
      if (c.rations === 'lean' || c.rations === 'normal' || c.rations === 'plenty') out.rations = c.rations;
      if (Number.isInteger(c.torches)) out.torches = c.torches as number;
      if (typeof c.horses === 'boolean') out.horses = c.horses;
      return out;
    }
    case 'sendParty':
      return typeof c.dest === 'string' && (c.stakes === 'safe' || c.stakes === 'risky') ? { type: 'sendParty', dest: c.dest, stakes: c.stakes } : null;
    case 'sendExpedition': {
      if (typeof c.dest !== 'string' || !(DESTINATION_BY_ID[c.dest] || c.dest.startsWith('place:')) || !Array.isArray(c.members) || !c.members.every(Number.isInteger)) return null;
      const stance = (typeof c.stance === 'string' && c.stance in STANCES ? c.stance : 'balanced') as Stance;
      const roles: Record<number, Role> = {};
      if (c.roles && typeof c.roles === 'object') {
        for (const [id, r] of Object.entries(c.roles as Record<string, unknown>)) if (typeof r === 'string' && r in ROLES) roles[Number(id)] = r as Role;
      }
      const horses = Number.isInteger(c.horses) ? Math.max(0, c.horses as number) : 0;
      return { type: 'sendExpedition', dest: c.dest, members: c.members as number[], roles, stance, horses, truck: c.truck === true };
    }
    case 'trade':
      return Number.isInteger(c.offer) ? { type: 'trade', offer: c.offer as number } : null;
    case 'cycleOperator':
      return Number.isInteger(c.building) ? { type: 'cycleOperator', building: c.building as number } : null;
    case 'releasePrisoner':
      return Number.isInteger(c.prisoner) ? { type: 'releasePrisoner', prisoner: c.prisoner as number } : null;
    case 'setOrder':
      return Number.isInteger(c.person) && typeof c.order === 'string' && c.order in ORDER_NAMES ? { type: 'setOrder', person: c.person as number, order: c.order as StandingOrder } : null;
    case 'holdPower':
      return c.power === null || typeof c.power === 'string' ? { type: 'holdPower', power: c.power as string | null } : null;
    case 'castHeld':
      return { type: 'castHeld' };
    case 'watch':
      return c.expedition === null || Number.isInteger(c.expedition) ? { type: 'watch', expedition: c.expedition as number | null } : null;
    case 'giftVillage':
      return Number.isInteger(c.id) ? { type: 'giftVillage', id: c.id as number } : null;
    case 'lookInside':
      return c.building === null || Number.isInteger(c.building) ? { type: 'lookInside', building: c.building as number | null } : null;
    case 'watchPortal':
      return c.realm === null || typeof c.realm === 'string' ? { type: 'watchPortal', realm: c.realm as string | null } : null;
    case 'watchDeep':
      return c.depth === null || (Number.isInteger(c.depth) && (c.depth as number) >= 1) ? { type: 'watchDeep', depth: c.depth as number | null } : null;
    case 'watchMine':
      return c.place === null || Number.isInteger(c.place) ? { type: 'watchMine', place: c.place as number | null } : null;
    case 'follow':
      return c.person === null || Number.isInteger(c.person) ? { type: 'follow', person: c.person as number | null } : null;
    case 'rally':
      return Number.isInteger(c.person) ? { type: 'rally', person: c.person as number } : null;
    case 'battlePlace':
      return Number.isInteger(c.person) && (c.spot === null || Number.isInteger(c.spot)) ? { type: 'battlePlace', person: c.person as number, spot: c.spot as number | null } : null;
    case 'battleGo':
      return { type: 'battleGo' };
    case 'scene':
      return (c.op === 'watch' || c.op === 'done' || c.op === 'skip') && Number.isInteger(c.key) ? { type: 'scene', op: c.op, key: c.key as number } : null;
    case 'gameSpeed':
      return c.speed === 1 || c.speed === 2 || c.speed === 3 ? { type: 'gameSpeed', speed: c.speed } : null;
    case 'battleSpeed':
      return c.speed === 1 || c.speed === 2 || c.speed === 3 ? { type: 'battleSpeed', speed: c.speed } : null;
    case 'battleStyle':
      return c.style === 'trail' || c.style === 'tactics' ? { type: 'battleStyle', style: c.style } : null;
    case 'autoStats':
      return Number.isInteger(c.person) && typeof c.on === 'boolean' ? { type: 'autoStats', person: c.person as number, on: c.on } : null;
    case 'spendStat':
      return Number.isInteger(c.person) && (c.attr === null || (ATTR_KEYS as readonly string[]).includes(c.attr as string)) ? { type: 'spendStat', person: c.person as number, attr: c.attr as keyof Attrs | null } : null;
    case 'setAsk':
      return (c.evolve === undefined || typeof c.evolve === 'boolean') && (c.stats === undefined || typeof c.stats === 'boolean') ? { type: 'setAsk', ...(c.evolve === undefined ? {} : { evolve: c.evolve as boolean }), ...(c.stats === undefined ? {} : { stats: c.stats as boolean }) } : null;
    case 'tactics': {
      const o = c.order as Record<string, unknown> | undefined;
      if (!o || typeof o !== 'object') return null;
      const n = (x: unknown) => typeof x === 'number' && Number.isInteger(x);
      const str = (x: unknown) => typeof x === 'string' && x.length < 20;
      switch (o.op) {
        case 'auto':
          return typeof o.on === 'boolean' ? { type: 'tactics', order: { op: 'auto', on: o.on } } : null;
        case 'move':
          return n(o.u) && n(o.v) ? { type: 'tactics', order: { op: 'move', u: o.u as number, v: o.v as number } } : null;
        case 'undo':
          return { type: 'tactics', order: { op: 'undo' } };
        case 'attack':
        case 'tend':
          return str(o.target) ? { type: 'tactics', order: { op: o.op, target: o.target as string } } : null;
        case 'skill':
          {
            const at = Array.isArray(o.at) && o.at.length === 2 && o.at.every((n) => Number.isInteger(n) && (n as number) >= 0 && (n as number) < 64) ? ([o.at[0], o.at[1]] as [number, number]) : undefined;
            return str(o.skill) && (o.target === undefined || str(o.target)) && (o.at === undefined || at) ? { type: 'tactics', order: { op: 'skill', skill: o.skill as string, ...(o.target !== undefined ? { target: o.target as string } : {}), ...(at ? { at } : {}) } } : null;
          }
        case 'wait':
          return o.facing === undefined || n(o.facing) ? { type: 'tactics', order: { op: 'wait', ...(o.facing !== undefined ? { facing: o.facing as number } : {}) } } : null;
      }
      return null;
    }
    case 'battleAuto':
      return typeof c.on === 'boolean' ? { type: 'battleAuto', on: c.on } : null;
    case 'battleCast':
      return typeof c.power === 'string' && Number.isFinite(c.x) && Number.isFinite(c.y) ? { type: 'battleCast', power: c.power, x: c.x as number, y: c.y as number } : null;
    case 'answerPrompt':
      return Number.isInteger(c.prompt) && Number.isInteger(c.option) ? { type: 'answerPrompt', prompt: c.prompt as number, option: c.option as number } : null;
    case 'recallExpedition':
      return Number.isInteger(c.expedition) ? { type: 'recallExpedition', expedition: c.expedition as number } : null;
    case 'acceptVisitor':
    case 'rejectVisitor':
    case 'dismissAway':
      return { type: c.type };
    case 'setPriority':
      return Number.isInteger(c.person) && JOBS.includes(c.job as Job) && [0, 1, 2, 3].includes(c.priority as number)
        ? { type: 'setPriority', person: c.person as number, job: c.job as Job, priority: c.priority as Priority }
        : null;
    case 'setAutoPriorities':
      return Number.isInteger(c.person) && typeof c.on === 'boolean' ? { type: 'setAutoPriorities', person: c.person as number, on: c.on } : null;
    case 'cheatUnlockAll':
      return typeof c.on === 'boolean' ? { type: 'cheatUnlockAll', on: c.on } : null;
    default:
      return null;
  }
}
