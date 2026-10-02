// Quests (the plan's step 11): offered of an evening by a guest at the tavern (or a traveller, with no tavern), each tied
// to a dungeon the town knows of. Clear that dungeon (kill its boss: sim/delves.ts) while the quest is open, and when the
// party is home it pays: a rescued captive joins the town, a bounty is paid, a relic hunt brings one of the uniques held
// back for quests (data/uniques.ts QUEST_UNIQUES), a fallen delver's gear comes home. Unclaimed, a quest lapses.

import { DUNGEONS, DUNGEON_BY_ID } from '../data/dungeons';
import { DESTINATION_BY_ID } from '../data/expeditions';
import { ITEM_BY_ID } from '../data/items';
import { ARRIVING_TYPES } from '../data/people';
import { piece } from '../data/quality';
import { QUEST_UNIQUES } from '../data/uniques';
import { WEAPONS } from '../data/weapons';
import { hashSeed, mixSeed, Rng } from '../rng';
import { addItems } from './crafting';
import { destinationHidden, destinationUnlocked } from './expeditions';
import { earn, makePerson, notify, type GameState, type Person } from './state';
import { TICKS_PER_DAY, TICKS_PER_HOUR } from './time';
import { assignBeds } from './townsfolk';

export type QuestKind = 'rescue' | 'bounty' | 'relic' | 'gear';
export interface Quest {
  id: number;
  kind: QuestKind;
  /** The dungeon it's tied to. */
  dungeon: string;
  /** Who asked. */
  from: string;
  title: string;
  text: string;
  /** The unique a relic hunt is for, the coins a bounty pays. */
  unique?: string;
  coins?: number;
  /** It lapses at this tick. */
  until: number;
}

/** Quests open at once, at most; how long one stays open; the hour they're offered, and the chance on an evening. */
export const MAX_QUESTS = 2;
export const QUEST_DAYS = 6;
const OFFER_HOUR = 19;
const OFFER_CHANCE = 0.45;

const GIVERS = ['a grey-haired pilgrim', 'a weeping widow', 'a hard-faced mercenary', 'a scholar with ink on her hands', 'a merchant in a torn coat', 'a one-eyed hunter', 'a nervous young squire', 'a hooded stranger'];

/** Once an hour: an evening offer of a quest, and the old ones lapsing. */
export function questsHourly(s: GameState): void {
  if (s.tick % TICKS_PER_HOUR !== 0) return;
  for (const q of s.quests ?? []) if (s.tick >= q.until) notify(s, `Nobody took up the quest at ${DUNGEON_BY_ID[q.dungeon]?.name ?? q.dungeon}: ${q.from} has given up and gone.`);
  if (s.quests?.length) s.quests = s.quests.filter((q) => s.tick < q.until);
  const hour = Math.floor(s.tick / TICKS_PER_HOUR) % 24;
  if (hour !== OFFER_HOUR || (s.quests?.length ?? 0) >= MAX_QUESTS) return;
  const rng = new Rng(mixSeed(hashSeed(s.seed), s.tick, 0x9e57));
  if (!rng.chance(OFFER_CHANCE)) return;
  // (only for dungeons the town knows the way to, and without a quest already)
  const known = DUNGEONS.filter((d) => destinationUnlocked(s, DESTINATION_BY_ID[d.id]) && !destinationHidden(s, d.id) && !(s.quests ?? []).some((q) => q.dungeon === d.id));
  if (!known.length) return;
  const d = known[rng.int(0, known.length - 1)];
  const relicLeft = QUEST_UNIQUES.filter((u) => !(s.uniques ?? []).includes(u) && !(s.quests ?? []).some((q) => q.unique === u));
  const kinds: QuestKind[] = ['rescue', 'bounty', 'gear', ...(relicLeft.length ? (['relic', 'relic'] as QuestKind[]) : [])];
  const kind = kinds[rng.int(0, kinds.length - 1)];
  const tavern = s.buildings.some((b) => b.status === 'done' && (b.def === 'fireside_inn' || b.def === 'tavern'));
  const from = GIVERS[rng.int(0, GIVERS.length - 1)];
  const where = tavern ? 'at the tavern' : 'at the edge of town';
  const q: Quest = { id: s.nextId++, kind, dungeon: d.id, from, title: '', text: '', until: s.tick + QUEST_DAYS * TICKS_PER_DAY };
  switch (kind) {
    case 'rescue':
      q.title = `Rescue from ${d.name}`;
      q.text = `${cap(from)} ${where} begs for help: someone they love was taken into ${d.name}. Clear it and bring them home.`;
      break;
    case 'bounty':
      q.coins = 60 + DUNGEONS.indexOf(d) * 15;
      q.title = `A bounty on ${d.name}`;
      q.text = `${cap(from)} ${where} posts a bounty of ${q.coins} coins on whatever rules ${d.name}.`;
      break;
    case 'relic':
      q.unique = relicLeft[rng.int(0, relicLeft.length - 1)];
      q.title = `The hunt for ${ITEM_BY_ID[q.unique].name}`;
      q.text = `${cap(from)} ${where} swears ${ITEM_BY_ID[q.unique].name} lies at the bottom of ${d.name}. Clear it, and it's yours.`;
      break;
    case 'gear':
      q.title = `A fallen delver in ${d.name}`;
      q.text = `${cap(from)} ${where} tells of a delver who went down into ${d.name} and never came up. Their gear is still there.`;
      break;
  }
  (s.quests ??= []).push(q);
  notify(s, `A quest: ${q.text}`, true);
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** A delving party home from a dungeon they cleared: every open quest on it pays. `x`: where they came in. */
export function questsDone(s: GameState, dungeon: string, x: number, rng: Rng): void {
  const done = (s.quests ?? []).filter((q) => q.dungeon === dungeon);
  if (!done.length) return;
  s.quests = (s.quests ?? []).filter((q) => q.dungeon !== dungeon);
  for (const q of done) {
    switch (q.kind) {
      case 'rescue': {
        const p = makePerson(rng, s.nextId++, rng.weighted(ARRIVING_TYPES), x, s.people.map((o) => o.name));
        s.people.push(p);
        assignBeds(s);
        notify(s, `${p.name}, rescued from ${DUNGEON_BY_ID[dungeon].name}, comes home with the party and stays.`, true);
        break;
      }
      case 'bounty':
        s.coins = (s.coins ?? 0) + (q.coins ?? 0);
        earn(s, 'events', q.coins ?? 0);
        notify(s, `The bounty on ${DUNGEON_BY_ID[dungeon].name} is paid: ${q.coins} coins.`, true);
        break;
      case 'relic':
        if (q.unique && !(s.uniques ?? []).includes(q.unique)) {
          (s.uniques ??= []).push(q.unique);
          addItems(s, q.unique, 1);
          notify(s, `The quest is done: ${ITEM_BY_ID[q.unique].name} is the town's, a unique weapon, one of a kind!`, true);
        }
        break;
      case 'gear': {
        const id = fallenGear(s, dungeon, rng);
        addItems(s, id, 1, piece(3, rng.int(1, 3)));
        notify(s, `The fallen delver's gear comes home: ${ITEM_BY_ID[id].name}, finely made.`, true);
        break;
      }
    }
  }
}

/** A good weapon of the dungeon's era (tier 3 up to its era's best) for a fallen delver's gear. */
function fallenGear(_s: GameState, dungeon: string, rng: Rng): string {
  const era = DUNGEON_BY_ID[dungeon].era;
  const top = era === 'neolithic' ? 4 : era === 'medieval' ? 6 : era === 'industrial' ? 8 : 10;
  const list = WEAPONS.filter((i) => (i.tier ?? 0) >= 3 && (i.tier ?? 0) <= top);
  return list[rng.int(0, list.length - 1)].id;
}

/** Someone a delving party met who comes home with them (a rival delver won over). */
export function joinTown(s: GameState, x: number, rng: Rng): Person {
  const p = makePerson(rng, s.nextId++, rng.weighted(ARRIVING_TYPES), x, s.people.map((o) => o.name));
  s.people.push(p);
  assignBeds(s);
  return p;
}
