// A fight's card shows the fight's own foes (the playthrough: every party's fight was drawn with orcs). Pure: no DOM,
// so the tests read it. A foe drawn from a pack sheet the card can play (`PACK_LAYOUT`, the Craftpix and Legends of the
// Fall sheets) stands in as itself; a foe who is a person (tribesmen, bandits, soldiers) as an outsider in a person's
// look (the cast's stranger places); a beast on one of the creature sheets (the wolves, boars and bears, DawnLike's
// menagerie) as itself, drawn side-on from its frames (`creatureWho`, art/creatureSheets.ts `sheetFrame`), or by the
// PixelLab side-on sheet for its kind once that is in (`pl_wolf`, `pl_bear`, `pl_dragon`). A fight with none of these
// (a still, a machine) keeps the scene's own.

import { ENEMIES, type EnemyDef } from '../../shared/data/enemies';
import { SHEETS, type CreatureSheet } from '../art/creatureSheets';
import { PACK_LAYOUT } from '../art/creatures/packs';
import { SLOT } from './eventCast';
import type { SceneScript } from './sceneScripts';

const STRANGERS = [SLOT.stranger, SLOT.stranger2, SLOT.stranger3];

/** An actor played from a creature sheet: `cr:<sheet>:<block>:<scale>` (the scale it has on the fight screen). */
const CR = 'cr:';
/** The PixelLab side-on sheet that plays a kind of beast on the cards, by its creature sheet (used once it is in). */
const MADE_FOR: Partial<Record<string, string>> = { wolf: 'pl_wolf', wilddogs: 'pl_wolf', bear: 'pl_bear', wyvern: 'pl_dragon', drakes: 'pl_dragon' };

/** Who plays a foe drawn from a creature sheet on a card: its PixelLab sheet when that is in, else itself from its own
 *  frames; null when neither can (a sheet the card can't draw: the wyvern, recoloured only in Pixi). */
export function creatureWho(sp: { sheet: string; block: number; scale?: number }): string | null {
  const made = MADE_FOR[sp.sheet];
  if (made && PACK_LAYOUT[made]) return made;
  const def = SHEETS[sp.sheet as CreatureSheet];
  if (!def || def.redden) return null;
  return `${CR}${sp.sheet}:${sp.block}:${sp.scale ?? 1}`;
}

/** The same for a foe by its id (`ENEMIES`), or null. */
export const foeWho = (id: string): string | null => {
  const sp: EnemyDef['sprite'] | undefined = ENEMIES[id]?.sprite;
  return sp && 'sheet' in sp && !PACK_LAYOUT[sp.sheet] ? creatureWho(sp) : null;
};

/** A creature actor's sheet, block and scale (`creatureWho`), or null for any other actor. */
export function parseCreatureWho(who: string): { sheet: CreatureSheet; block: number; scale: number } | null {
  if (!who.startsWith(CR)) return null;
  const [sheet, block, scale] = who.slice(CR.length).split(':');
  return SHEETS[sheet as CreatureSheet] ? { sheet: sheet as CreatureSheet, block: Number(block) || 0, scale: Number(scale) || 1 } : null;
}

/** Who plays a fight's foes, in the order given, each kind once: a pack sheet's id, or a stranger's place. */
export function foeSheets(foes: readonly string[]): (string | number)[] {
  const out: (string | number)[] = [];
  let people = 0;
  for (const id of foes) {
    const sp = ENEMIES[id]?.sprite;
    if (!sp) continue;
    if ('people' in sp) {
      if (people < STRANGERS.length) out.push(STRANGERS[people++]);
    } else if ('sheet' in sp && PACK_LAYOUT[sp.sheet]) {
      if (!out.includes(sp.sheet)) out.push(sp.sheet);
    } else if ('sheet' in sp) {
      const who = creatureWho(sp);
      if (who && !out.includes(who)) out.push(who);
    }
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
