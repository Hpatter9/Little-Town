// Things that happen on the road (DESIGN §8): mostly settled by the party's stance, sometimes a question
// for the player with a timer and a default.

import { answerSecret } from './specials';
import { answerVisitor } from './townsfolk';
import { answerThirst } from './monsters';
import { openGate } from './raidWait';
import { answerEvent } from './events';
import { answerLich } from './doom';
import { the, The } from '../data/expeditions';
import { FOOD_VALUE } from '../data/people';
import type { Material } from '../data/materials';
import type { Rng } from '../rng';
import { startBattle } from './combat';
import { destinationOf, partyCarry } from './expeditions';
import { answerRaidPrompt } from './raids';
import { answerRite } from './occult';
import { addStock, notify, poolSize, type Expedition, type GameState, type Person, type Prompt } from './state';
import { TICKS_PER_HOUR } from './time';

/** Chance of an event on each leg of the trip. */
export const ROAD_EVENT_CHANCE = 0.2;
/** How long the player has to answer a question. */
const PROMPT_TICKS = TICKS_PER_HOUR;
const SPRAIN_DAMAGE = 10;

type RoadEvent = 'cache' | 'sprain' | 'strangers';
const EVENT_ODDS: Record<RoadEvent, number> = { cache: 3, sprain: 2, strangers: 2 };

const STRANGER_OPTIONS = ['Help (share food)', 'Ignore them', 'Rob them'];

export function rollRoadEvent(s: GameState, e: Expedition, members: Person[], rng: Rng): void {
  if (!rng.chance(ROAD_EVENT_CHANCE) || !members.length) return;
  const d = destinationOf(s, e.dest)!;
  switch (rng.weighted(EVENT_ODDS)) {
    case 'cache': {
      const m = rng.pick<Material>(['stone', 'flint', 'fiber']);
      const n = Math.min(rng.int(2, 4), partyCarry(s, e) - poolSize(e.loot));
      if (n <= 0) return;
      addStock(e.loot, m, n);
      notify(s, `${The(d.name)} party found a hidden cache: ${n} ${m}.`);
      return;
    }
    case 'sprain': {
      const p = rng.pick(members);
      if (e.stance === 'cautious') {
        // they stop and rest it; the leg takes a little longer
        if (e.phase === 'out') e.outTicks += Math.round(e.outTicks * 0.1);
        else e.backTicks += Math.round(e.backTicks * 0.1);
        notify(s, `${p.name} twisted an ankle. The party rested before going on.`);
      } else {
        p.hp = Math.max(1, p.hp - SPRAIN_DAMAGE);
        notify(s, `${p.name} twisted an ankle on the road and pushed on.`);
      }
      return;
    }
    case 'strangers': {
      const defaultOption = e.stance === 'cautious' ? 1 : e.stance === 'balanced' ? 0 : 2;
      const prompt: Prompt = {
        id: s.nextId++,
        kind: 'strangers',
        expedition: e.id,
        title: 'Strangers on the road',
        text: `${The(d.name)} party meets a ragged family on the road. They look hungry.`,
        options: STRANGER_OPTIONS,
        defaultOption,
        expiresTick: s.tick + PROMPT_TICKS,
      };
      s.prompts.push(prompt);
      e.prompt = prompt.id;
      notify(s, `${prompt.title}: ${the(d.name)} party needs a decision.`);
      return;
    }
  }
}

/** Answer a question (by the player, or by default when the timer runs out). */
export function answerPrompt(s: GameState, id: number, option: number, rng: Rng): void {
  const prompt = s.prompts.find((q) => q.id === id);
  if (!prompt || option < 0 || option >= prompt.options.length) return;
  s.prompts = s.prompts.filter((q) => q !== prompt);
  if (prompt.kind === 'raid') return answerRaidPrompt(s, prompt.options[option], rng);
  if (prompt.kind === 'rite') return answerRite(s, prompt.options[option]);
  if (prompt.kind === 'lich') return answerLich(s, prompt.options[option]);
  if (prompt.kind === 'gate') return openGate(s);
  if (prompt.kind === 'event') return answerEvent(s, option, rng);
  if (prompt.kind === 'thirst') return answerThirst(s, prompt.options[option]);
  if (prompt.kind === 'visitor') return answerVisitor(s, prompt.options[option]);
  if (prompt.kind === 'secret') return answerSecret(s, prompt.who, option);
  const e = s.expeditions.find((q) => q.id === prompt.expedition);
  if (!e) return;
  e.prompt = null;
  const members = e.members.map((m) => s.people.find((p) => p.id === m)).filter((p): p is Person => !!p);
  switch (option) {
    case 0: {
      // share up to two food
      let given = 0;
      for (const m of Object.keys(FOOD_VALUE) as Material[]) {
        while (given < 2 && (e.supplies[m] ?? 0) > 0) {
          addStock(e.supplies, m, -1);
          given++;
        }
      }
      s.reputation += 1;
      notify(s, given ? 'The strangers thank you. Word of your kindness will spread.' : 'You had no food to spare, but the strangers remember the kindness.');
      return;
    }
    case 1:
      notify(s, 'The party passes the strangers by.');
      return;
    case 2:
      if (rng.chance(0.5)) {
        const m = rng.pick<Material>(['hide', 'flint', 'fiber']);
        addStock(e.loot, m, rng.int(2, 4));
        s.reputation = Math.max(0, s.reputation - 1);
        notify(s, `The party robs the strangers and takes their ${m}.`);
      } else {
        notify(s, 'The strangers fight back!');
        e.battle = startBattle(members, e.roles, { rival_spear: 2 }, rng, e.supplies);
      }
      return;
  }
}

/** Unanswered questions time out to their default. */
export function expirePrompts(s: GameState, rng: Rng): void {
  for (const p of [...s.prompts]) if (s.tick >= p.expiresTick) answerPrompt(s, p.id, p.defaultOption, rng);
}
