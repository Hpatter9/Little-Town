// How human enemies look: they have no stored look of their own, so it's picked from their outfit and
// varied by index. Rivals wear dark hides; bandits leather and hoods; warband soldiers chainmail and helms; ice
// mages pale blue robes.

import type { HumanSprite } from '../../shared/data/enemies';
import type { Look } from '../../shared/data/people';
import type { LpcAnim } from './lpc/lpc';

export function rivalLook(i: number): Look {
  const skins = ['#c9956a', '#a0704a', '#e3b890'];
  return { gender: 'm', skin: skins[i % skins.length], hair: i % 2 ? 'unkempt' : 'messy2', hairColor: '#241810', beard: i % 2 === 0, outfit: '#4a3826' };
}

/** The animation a human enemy attacks with: bows shoot, slings throw, clubs and swords swing, spears thrust. */
export function attackAnim(s: HumanSprite, ranged: boolean): LpcAnim {
  if (s.weapon === 'bow') return 'shoot';
  if (ranged) return 'spell';
  return s.weapon === 'spear' || !s.weapon ? 'thrust' : 'slash';
}

/** A human enemy's look and the armour layers drawn over it. */
export function enemyLook(people: HumanSprite['people'], i: number): { look: Look; wear: string[] } {
  switch (people) {
    case 'rival':
      return { look: rivalLook(i), wear: [] };
    case 'bandit':
      return { look: { ...rivalLook(i), outfit: '#3a3a34', hairColor: i % 3 ? '#2a1c14' : '#6e4a2c' }, wear: i % 2 ? ['torso_leather', 'head_hood'] : ['torso_leather'] };
    case 'zombie':
      // grey-green skin and rags
      return { look: { ...rivalLook(i), skin: i % 2 ? '#8fa27e' : '#9aa88a', hairColor: '#3a3a30', beard: false, outfit: i % 2 ? '#4a4638' : '#3e4a3a' }, wear: [] };
    case 'soldier':
      return { look: { ...rivalLook(i), outfit: '#5a2a24', beard: i % 3 === 0 }, wear: ['torso_chain', 'head_helm'] };
    case 'frost':
      // pale and white-haired, robed in icy blue
      return { look: { ...rivalLook(i), skin: '#dfe8ee', hairColor: '#e8f0f4', beard: i % 3 === 0, outfit: i % 2 ? '#6fa8d0' : '#8cc0e0' }, wear: [] };
    case 'archmage':
      // the Archmage: deep blue robes, a long white beard
      return { look: { ...rivalLook(i), skin: '#d4e2ec', hair: 'unkempt', hairColor: '#f4f8fa', beard: true, outfit: '#2c4e8c' }, wear: [] };
  }
}
