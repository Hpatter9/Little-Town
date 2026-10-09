// The peoples' own ways (the origins made deeper): each origin's system, as the Town menu's "Our ways" tab shows it.

import { groveView, type GroveView } from './grove';
import type { GameState } from './state';

export interface HeritageView {
  grove: GroveView | null;
}

export function heritageView(s: GameState): HeritageView | null {
  const v: HeritageView = { grove: groveView(s) };
  return Object.values(v).some(Boolean) ? v : null;
}
