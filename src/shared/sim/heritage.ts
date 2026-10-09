// The peoples' own ways (the origins made deeper): each origin's system, as the Town menu's "Our ways" tab shows it,
// and the answers to their questions (prompts of kind `ways`).

import type { Rng } from '../rng';
import { answerBargain, courtView, type CourtView } from './bargains';
import { groveView, type GroveView } from './grove';
import { workView, type WorkView } from './greatWork';
import { answerOrder, orderView, type OrderView } from './chivalry';
import { answerFoundry, foundryView, type FoundryView } from './foundry';
import { frontierView, type FrontierView } from './frontier';
import { bloodView, type BloodView } from './vampires';
import type { GameState, Prompt } from './state';

export interface HeritageView {
  grove: GroveView | null;
  court: CourtView | null;
  work: WorkView | null;
  order: OrderView | null;
  foundry: FoundryView | null;
  frontier: FrontierView | null;
  blood: BloodView | null;
}

export function heritageView(s: GameState): HeritageView | null {
  const v: HeritageView = { grove: groveView(s), court: courtView(s), work: workView(s), order: orderView(s), foundry: foundryView(s), frontier: frontierView(s), blood: bloodView(s) };
  return Object.values(v).some(Boolean) ? v : null;
}

/** A people's own question answered (from roadEvents.ts answerPrompt). */
export function answerWays(s: GameState, prompt: Prompt, option: number, rng: Rng): void {
  switch (prompt.ways?.system) {
    case 'court':
      return answerBargain(s, prompt, option, rng);
    case 'order':
      return answerOrder(s, prompt, option);
    case 'foundry':
      return answerFoundry(s, prompt, option, rng);
  }
}
