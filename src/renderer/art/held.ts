// What someone visibly holds and wears: their weapon in a fight, the tool that fits the work otherwise,
// and armour drawn as LPC layers. Only items with an LPC layer to show are listed.

import type { Slot } from '../../shared/data/items';
import type { LpcWeapon } from './lpc/lpc';

const LPC_OF: Record<string, LpcWeapon> = {
  spear: 'spear',
  fire_spear: 'spear',
  wooden_club: 'mace',
  flint_knife: 'dagger',
  stone_axe: 'axe',
  stone_hammer: 'mace',
  iron_axe: 'axe',
  iron_hammer: 'mace',
  iron_pick: 'mace',
  iron_sword: 'sword',
  steel_axe: 'axe',
  steel_pick: 'mace',
  bow: 'bow',
};

const AXES = new Set(['stone_axe', 'iron_axe', 'steel_axe', 'chainsaw', 'plasma_cutter']);
const HAMMERS = new Set(['stone_hammer', 'iron_hammer', 'iron_pick', 'steel_pick', 'power_drill', 'plasma_cutter']);

export function heldWeapon(gear: Partial<Record<Slot, string>>, activity: string): LpcWeapon {
  const tool = gear.tool ?? '';
  switch (activity) {
    case 'fight':
      return LPC_OF[gear.weapon ?? ''] ?? LPC_OF[tool] ?? null;
    case 'chop':
      return AXES.has(tool) ? 'axe' : null;
    case 'mine':
    case 'build':
      return HAMMERS.has(tool) ? 'mace' : null;
    default:
      return null;
  }
}

const WORN: Record<string, string> = {
  hide_armor: 'torso_leathersh',
  leather_armor: 'torso_leather',
  chainmail: 'torso_chain',
  hide_cap: 'head_hood',
  leather_cap: 'head_hood',
  iron_helm: 'head_helm',
  steel_cuirass: 'torso_chain',
  kevlar_vest: 'torso_leather',
  combat_helmet: 'head_helm',
  powered_armor: 'torso_chain',
  visor_helmet: 'head_helm',
};

/** Armour layers for what someone wears. */
export function wornLayers(gear: Partial<Record<Slot, string>>): string[] {
  const out: string[] = [];
  for (const slot of ['body', 'head'] as const) {
    const layer = WORN[gear[slot] ?? ''];
    if (layer) out.push(layer);
  }
  return out;
}
