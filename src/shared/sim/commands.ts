// Player actions. The UI never edits state directly: it sends commands, and the sim applies them at the
// start of the next tick so every change happens at a well-defined point in sim time.

import type { MonsterKind } from '../data/monsters';
const TURN_KINDS: readonly string[] = ['undead', 'vampire', 'werewolf'];
import { CLASSES, type ClassId } from '../data/classes';
import { BUILDING_BY_ID } from '../data/buildings';
import { DESTINATION_BY_ID, ROLES, STANCES, type Role, type Stance } from '../data/expeditions';
import { ITEM_BY_ID, SLOTS, type Slot } from '../data/items';
import { MATERIALS, type Material } from '../data/materials';
import { ORDER_NAMES, type StandingOrder } from '../data/monsters';
import { JOBS, type Job, type Priority } from '../data/people';
import { TOPIC_BY_ID } from '../data/research';
import { DIRECTIONS, type Direction } from './planner';

export type Command =
  | { type: 'setPaused'; paused: boolean }
  /** Where the self-running town puts its effort. */
  | { type: 'setDirection'; direction: Direction }
  /** Mark a wild tile for gathering (clearing it), or unmark it. */
  | { type: 'toggleGather'; tile: number }
  /** Place a blueprint with its left edge on `tile` of the building's layer. */
  | { type: 'placeBuilding'; def: string; tile: number }
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
  /** Pass on a curse (hidden): turn one person, or everyone who can be. */
  | { type: 'turnPerson'; person: number; kind: MonsterKind }
  | { type: 'turnTown'; kind: MonsterKind }
  /** Train someone into a special class. */
  | { type: 'trainClass'; person: number; cls: ClassId }
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
  /** Debug: make every building available regardless of research. */
  | { type: 'cheatUnlockAll'; on: boolean };

/** Validate a command that arrived over IPC. */
export function parseCommand(raw: unknown): Command | null {
  if (!raw || typeof raw !== 'object') return null;
  const c = raw as Record<string, unknown>;
  switch (c.type) {
    case 'setPaused':
      return typeof c.paused === 'boolean' ? { type: 'setPaused', paused: c.paused } : null;
    case 'setDirection':
      return DIRECTIONS.includes(c.direction as Direction) ? { type: 'setDirection', direction: c.direction as Direction } : null;
    case 'toggleGather':
      return Number.isInteger(c.tile) ? { type: 'toggleGather', tile: c.tile as number } : null;
    case 'placeBuilding':
      return typeof c.def === 'string' && BUILDING_BY_ID[c.def] && Number.isInteger(c.tile) ? { type: 'placeBuilding', def: c.def, tile: c.tile as number } : null;
    case 'demolish':
      return Number.isInteger(c.building) ? { type: 'demolish', building: c.building as number } : null;
    case 'turnPerson':
      return Number.isInteger(c.person) && TURN_KINDS.includes(c.kind as MonsterKind) ? { type: 'turnPerson', person: c.person as number, kind: c.kind as MonsterKind } : null;
    case 'turnTown':
      return TURN_KINDS.includes(c.kind as MonsterKind) ? { type: 'turnTown', kind: c.kind as MonsterKind } : null;
    case 'trainClass':
      return Number.isInteger(c.person) && CLASSES.includes(c.cls as ClassId) ? { type: 'trainClass', person: c.person as number, cls: c.cls as ClassId } : null;
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
    case 'sendExpedition': {
      if (typeof c.dest !== 'string' || !DESTINATION_BY_ID[c.dest] || !Array.isArray(c.members) || !c.members.every(Number.isInteger)) return null;
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
