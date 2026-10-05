// What a castle's or a hold's room is, for the things set about it (map/castleClutter.ts). No Pixi here, so the tests
// can read it.

import type { BuildingDef } from '../../shared/data/buildings';

/** What a room is, for its clutter. */
export type RoomKind = 'hall' | 'home' | 'store' | 'study' | 'forge' | 'healer' | 'kitchen' | 'treasury' | 'mine' | 'work';

/** What a room is by its building: what it holds, what it heals, its name. */
export function kindOf(def: BuildingDef | undefined): RoomKind {
  if (!def) return 'work';
  const id = def.id;
  if (def.seat) return 'treasury';
  if (def.housing) return 'home';
  if (def.healing || /heal|infirm|hospital|apothec|alchem|alembic|herb|pharm/.test(id)) return 'healer';
  if (/librar|school|scriptor|study|archive|observ|scholar|college|universit|lab|elder|council|print/.test(id)) return 'study';
  if (/smith|forge|anvil|armour|armor|bloomery|kiln|foundry|weapon|barrack|guard|bone_forge/.test(id)) return 'forge';
  if (/gem|jewel|gold|mint|vault|treasur|trophy/.test(id)) return 'treasury';
  if (/mine|quarry|delv/.test(id)) return 'mine';
  if (/kitchen|bake|smoke|cann|granary|brew|cellar|larder|mill|butcher|cooper/.test(id)) return 'kitchen';
  if (def.storage) return 'store';
  return 'work';
}

