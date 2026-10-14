// Legends across towns (sim/ancestors.ts, sim/legacy.ts): the numbers for a descendant's town. Its ancestors come back
// as spirits, its heirloom may be cursed or grows with each generation that carries it, and the old town comes back:
// as ruins on the new town's land (a town that fell), or as a power of the realm (one that stood).

import type { EnemyDef } from './enemies';
import { PACK_SHEETS, type PackSheetId } from './packSheets';

/** Spirits: from this day, at this hour of the night, no oftener than every `VISIT_GAP_DAYS`, on this chance a
 *  night (more once the old place is laid to rest). */
export const VISIT_FROM_DAY = 2;
export const VISIT_HOUR = 22;
export const VISIT_GAP_DAYS = 4;
export const VISIT_CHANCE = 0.3;
export const VISIT_CHANCE_LAID = 0.5;
/** The first visit asks the town a question: how it honours its forebear. Unanswered, the town honours them. */
export const ASK_HOURS = 12;
/** A blessing's morale (a day of it), and the share of the hurt mended. */
export const BLESS_MORALE = 5;
export const BLESS_MEND = 0.3;
/** Honouring a forebear with a feast costs food a head, and the blessing is doubled. */
export const HONOUR_FOOD = 1;

/** A spirit stands with the town in a raid (not one begun inside), on this chance; more once laid to rest. */
export const ALLY_CHANCE = 0.25;
export const ALLY_CHANCE_LAID = 0.45;
/** The old house's living heroes ride to a raid on this chance when it's in treaty with the town. */
export const HOUSE_ALLY_CHANCE = 0.35;

/** An heirloom: how likely a fresh one is cursed (by the legend, so it's always the same), and the +N it can reach. */
export const CURSE_CHANCE = 0.3;
/** The curse: each morning at this hour the bearer may suffer it (a wound, a sore mood). */
export const CURSE_HOUR = 5;
export const CURSE_CHANCE_DAILY = 0.25;
export const CURSE_HURT = 0.12;
export const CURSE_MORALE = -6;

/** The old place on the new town's land: this far from the camp. */
export const OLD_PLACE_NEAR = 16;
export const OLD_PLACE_FAR = 30;
/** What the old place gives when its dead are laid to rest: coins (and a share of the old renown). */
export const OLD_PLACE_COINS = 30;
export const OLD_PLACE_RENOWN = 0.25;
export const LAID_MORALE = 8;

/** The old house (a town that stood) as a power of the realm: how warmly it starts, the warmth its goodwill rests at,
 *  and its own doings each noon: a gift, or one of its heroes riding over to teach. */
export const HOUSE_START = 45;
export const HOUSE_WARMTH = 40;
export const HOUSE_HOUR = 12;
export const HOUSE_GAP_DAYS = 5;
export const HOUSE_CHANCE = 0.25;
export const HOUSE_GIFT_COINS = 25;

/** The foes and friends of the old town: its restless dead, the barrow's honoured guard, the shade of its greatest,
 *  and the spirits and riders who come to the descendants' aid. (The Himeko ghost and a human champion, tinted.) */
const pack = (sheet: PackSheetId, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });
export const LEGEND_ENEMIES: Record<string, EnemyDef> = {
  restless_shade: { id: 'restless_shade', name: 'Restless Shade', hp: 70, damage: [6, 11], accuracy: 0.76, dodge: 0.3, interval: 1.3, ranged: false, loot: { cloth: 1 }, tint: 0x9fb4d8, sprite: pack('hk_ghost', 54) },
  barrow_guard: { id: 'barrow_guard', name: 'Barrow Guard', hp: 95, damage: [8, 13], accuracy: 0.78, dodge: 0.15, interval: 1.4, ranged: false, loot: { iron: 1 }, tint: 0xc8d0b0, sprite: pack('skeleton_warrior', 50) },
  old_champion: { id: 'old_champion', name: 'The Shade of the Old Champion', hp: 260, damage: [11, 18], accuracy: 0.8, dodge: 0.2, interval: 1.4, ranged: false, loot: { iron: 2, cloth: 2 }, tint: 0xd8e0ff, sprite: pack('hk_ghost', 72) },
  ancestor_shade: { id: 'ancestor_shade', name: 'Ancestral Spirit', hp: 120, damage: [9, 15], accuracy: 0.82, dodge: 0.35, interval: 1.2, ranged: false, loot: {}, tint: 0xffe6a0, sprite: pack('hk_ghost', 54) },
  house_rider: { id: 'house_rider', name: 'Rider of the Old House', hp: 110, damage: [9, 14], accuracy: 0.8, dodge: 0.12, interval: 1.2, ranged: false, loot: {}, sprite: pack('knight_1', 50) },
};
