// A fight's card shows the fight's own foes (the playthrough: every party's fight was drawn with orcs). Pure: no DOM,
// so the tests read it. A foe drawn from a pack sheet the card can play (`PACK_LAYOUT`, the Craftpix and Legends of the
// Fall sheets) stands in as itself; a foe who is a person (tribesmen, bandits, soldiers) as an outsider in a person's
// look (the cast's stranger places); a fight with neither (DawnLike's wolves and boars) keeps the scene's own.

import { ENEMIES } from '../../shared/data/enemies';
import { PACK_LAYOUT } from '../art/creatures/packs';
import { SLOT } from './eventCast';
import type { SceneScript } from './sceneScripts';

const STRANGERS = [SLOT.stranger, SLOT.stranger2, SLOT.stranger3];

/** Who plays a fight's foes, in the order given, each kind once: a pack sheet's id, or a stranger's place. */
export function foeSheets(foes: readonly string[]): (string | number)[] {
  const out: (string | number)[] = [];
  let people = 0;
  for (const id of foes) {
    const sp = ENEMIES[id]?.sprite;
    if (!sp) continue;
    if ('people' in sp) {
      if (people < STRANGERS.length) out.push(STRANGERS[people++]);
    } else if ('sheet' in sp && PACK_LAYOUT[sp.sheet] && !out.includes(sp.sheet)) out.push(sp.sheet);
  }
  return out;
}

/** The scene with its creatures played by the fight's foes (the first foe first, the last repeated), or as it is. */
export function withFoes(script: SceneScript, foes: readonly string[] | undefined): SceneScript {
  const who = foeSheets(foes ?? []);
  if (!who.length) return script;
  let n = 0;
  return { ...script, actors: script.actors.map((a) => (typeof a.who === 'string' ? { ...a, who: who[Math.min(n++, who.length - 1)] } : a)) };
}
