// A townsperson's attributes (data/attributes.ts): the base, their class's growth by level, their work skills' part,
// their traits' and a founder's edge.
import { ATTR_AT_START, ATTR_BASE, ATTR_KEYS, ATTR_PER_LEVEL, ATTR_PER_SKILL, classAttrs, type Attrs } from '../data/attributes';
import { FOUNDER_EDGE } from '../data/founderClasses';
import { levelOf } from '../data/levels';
import type { Person } from './state';

type Leveled = Pick<Person, 'cls' | 'level' | 'fcls' | 'skills' | 'traits' | 'monster'>;

export function attributesOf(p: Leveled): Attrs {
  const w = classAttrs(p.cls);
  const lv = levelOf(p);
  const pts = ATTR_AT_START + ATTR_PER_LEVEL * (lv - 1);
  const edge = p.fcls ? FOUNDER_EDGE : 1;
  const sk = (k: keyof Person['skills']) => (p.skills[k]?.level ?? 1) * ATTR_PER_SKILL;
  const a: Attrs = {
    str: ATTR_BASE + pts * w.str * edge + sk('melee') + sk('construction') * 0.5,
    dex: ATTR_BASE + pts * w.dex * edge + sk('ranged') + sk('crafting') * 0.5,
    vit: ATTR_BASE + pts * w.vit * edge + sk('gathering') * 0.5 + sk('farming') * 0.5,
    int: ATTR_BASE + pts * w.int * edge + sk('research'),
    wis: ATTR_BASE + pts * w.wis * edge + sk('medicine') + sk('social') * 0.5,
  };
  if (p.traits.includes('tough')) a.vit += 3;
  if (p.traits.includes('quick_learner')) a.int += 2;
  // (a werewolf's curse: the beast's strength and quickness)
  if (p.monster === 'werewolf') (a.str += 4), (a.dex += 3);
  for (const k of ATTR_KEYS) a[k] = Math.round(a[k] * 10) / 10;
  return a;
}
