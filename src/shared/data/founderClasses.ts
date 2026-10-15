// Founders' own callings: every ready-made founder (data/founders.ts) has a class line no one else has, five stages
// named for them and their origin, in place of a calling rolled at random. Each stands on a base class (data/classes.ts)
// for what they wear and wield and the spells and skills they learn, and fights a step above it (`FOUNDER_EDGE` on the
// base's edge, and a signature stat of their own).

import { CLASS_DEFS, type ClassId } from './classes';
import { FOUNDER_CLASSES, type FounderClassDef } from './founderLines';
export { FOUNDER_CLASSES, FOUNDER_EDGE, type FounderClassDef } from './founderLines';
import { lineage, PATH_BY_ID } from './paths';

export const FOUNDER_CLASS: Readonly<Record<string, FounderClassDef>> = Object.fromEntries(FOUNDER_CLASSES.map((f) => [f.id, f]));

type Classed = { cls?: ClassId | null; fcls?: string | null; road?: string | null };

/** The name of someone's calling at a stage: their founder's line if they have one, else their class's. */
export function callingName(p: Classed, stage: number): string | null {
  const st = Math.max(0, Math.min(4, stage));
  const f = p.fcls ? FOUNDER_CLASS[p.fcls] : undefined;
  // (on a path, a founder's line too: the node of their road at that stage, data/paths.ts; a founder's stages to
  // come are the line's own)
  if (p.road && PATH_BY_ID[p.road]) {
    const line = lineage(p.road);
    if (line[st]) return line[st].name;
    return f ? f.stages[st] : line[line.length - 1].name;
  }
  if (f) return f.stages[st];
  return p.cls ? CLASS_DEFS[p.cls].stages[st] : null;
}

/** What their calling is about (founder line or class). */
export const callingText = (p: Classed): string => (p.road && PATH_BY_ID[p.road]?.founder ? PATH_BY_ID[p.road].text : p.fcls && FOUNDER_CLASS[p.fcls] ? FOUNDER_CLASS[p.fcls].description : p.road && PATH_BY_ID[p.road] ? PATH_BY_ID[p.road].text : p.cls ? CLASS_DEFS[p.cls].description : '');
