// The seat of the town on the map (data/seats.ts), every stage of every people's, laid together from the packs'
// sprites in place of the code-drawn pictures (art/seatArt.ts, which now stands in only while these load): the
// Simple Summer keeps, towers and tents, the tiny-rpg-town and Glassblower houses, the Village pack's timber houses,
// the cave and dungeon packs' gates, altars, totems and fires, the Undead pack's ruins, graves and lich, the rocky-area
// tipis and yurts, the futuristic objects, the seabed's corals and statues, the forest objects' grove trees, and for
// the holds' throne rooms DawnLike's throne, rugs, candelabras and coffins. Each stage is a `Pick` of parts (x, y in
// source px on a canvas `SEAT_CANVAS` wide, the throne rooms `ROOM_CANVAS`), scaled to the footprint by `pickArt`.

import type { OriginId } from '../../shared/data/origins';
import type { PixelArt } from '../art/pixelArt';
import { pickArt, type Pick } from './packBuildings';
import s_altar from '../art/packs/cave_altar.png';
import s_anvil from '../art/packs/v_anvil.png';
import s_arch from '../art/seats/grove_arch.png';
import s_barrel from '../art/village/barrel.png';
import s_barrels from '../art/shops/gb_barrels.png';
import s_barrow from '../art/nests/barrow.png';
import s_bones1 from '../art/deep/bones1.png';
import s_bonfire from '../art/deep/bonfire.png';
import s_btotem from '../art/packs/cave_totem.png';
import s_cand from '../art/seats/dl_candelabra.png';
import s_cart from '../art/village/cart.png';
import s_castle from '../art/packs/su_castle.png';
import s_chest from '../art/packs/do_chest.png';
import s_coffin from '../art/seats/dl_coffin.png';
import s_coffin2 from '../art/seats/dl_coffin2.png';
import s_coil from '../art/packs/ao_coil.png';
import s_coral1 from '../art/seats/coral1.png';
import s_coral2 from '../art/seats/coral2.png';
import s_coral3 from '../art/seats/coral3.png';
import s_coralr from '../art/seats/coral_red.png';
import s_crates from '../art/shops/gb_crates.png';
import s_cry1 from '../art/deep/crystal1.png';
import s_cry2 from '../art/deep/crystal2.png';
import s_cry3 from '../art/deep/crystal3.png';
import s_crystal from '../art/packs/cave_crystal.png';
import s_dbarrel from '../art/packs/do_barrel.png';
import s_dgold from '../art/seats/dl_gold.png';
import s_dskull from '../art/deep/demon_skull.png';
import s_fire1 from '../art/packs/cave_fire1.png';
import s_flag from '../art/seats/flag.png';
import s_fruit from '../art/seats/grove_fruit.png';
import s_gable from '../art/packs/tt_gable.png';
import s_gbhouse from '../art/shops/gb_house.png';
import s_gold from '../art/packs/do_gold.png';
import s_grave1 from '../art/village/grave1.png';
import s_grave3 from '../art/village/grave3.png';
import s_grave4 from '../art/village/grave4.png';
import s_house from '../art/packs/su_house.png';
import s_house4 from '../art/village/house4.png';
import s_lantern from '../art/village/lantern.png';
import s_lich from '../art/seats/ud_lich.png';
import s_lit1 from '../art/seats/grove_lit1.png';
import s_lit2 from '../art/seats/grove_lit2.png';
import s_log1 from '../art/packs/f_log1.png';
import s_log3 from '../art/packs/f_log3.png';
import s_long from '../art/packs/tt_long.png';
import s_lookout from '../art/packs/su_lookout.png';
import s_mage from '../art/packs/su_magetower.png';
import s_mer1 from '../art/seats/mermaid1.png';
import s_mer2 from '../art/seats/mermaid2.png';
import s_mush1 from '../art/deep/mushroom1.png';
import s_mush2 from '../art/deep/mushroom2.png';
import s_mushbig from '../art/deep/mushroom_big.png';
import s_mushbig2 from '../art/deep/mushroom_big2.png';
import s_oak from '../art/seats/grove_oak.png';
import s_pal1 from '../art/village/palisade02.png';
import s_pal2 from '../art/village/palisade03.png';
import s_pal3 from '../art/village/palisade04.png';
import s_pylon from '../art/packs/sf_pylon.png';
import s_rock1 from '../art/deep/rock1.png';
import s_roots from '../art/seats/grove_roots.png';
import s_round from '../art/packs/su_roundcastle.png';
import s_rugg from '../art/seats/dl_rug_grey.png';
import s_rugr from '../art/seats/dl_rug_red.png';
import s_ruin from '../art/seats/ud_ruin1.png';
import s_ruin1 from '../art/deep/ruin1.png';
import s_ruin2 from '../art/deep/ruin2.png';
import s_ruin4 from '../art/seats/ud_ruin4.png';
import s_sacks from '../art/shops/gb_sacks.png';
import s_sf12 from '../art/packs/sf_12.png';
import s_sf13 from '../art/packs/sf_13.png';
import s_sf19 from '../art/packs/sf_19.png';
import s_sf24 from '../art/packs/sf_24.png';
import s_sf25 from '../art/packs/sf_25.png';
import s_sf26 from '../art/packs/sf_26.png';
import s_sf27 from '../art/packs/sf_27.png';
import s_sf9 from '../art/packs/sf_9.png';
import s_shell from '../art/seats/shell.png';
import s_signpost from '../art/shops/gb_signpost.png';
import s_skel from '../art/deep/skeleton.png';
import s_skullpile from '../art/seats/ud_skulls.png';
import s_skulls from '../art/nests/skulls.png';
import s_tank1 from '../art/packs/dp_tank1.png';
import s_tank2 from '../art/packs/dp_tank2.png';
import s_tank3 from '../art/packs/dp_tank3.png';
import s_tank4 from '../art/packs/dp_tank4.png';
import s_tent from '../art/packs/su_tent.png';
import s_tent4 from '../art/village/tent4.png';
import s_throne from '../art/seats/dl_throne.png';
import s_tipi1 from '../art/packs/rocky_tipi1.png';
import s_tipi2 from '../art/packs/rocky_tipi2.png';
import s_totem from '../art/deep/totem.png';
import s_tree1 from '../art/seats/grove_tree1.png';
import s_tree2 from '../art/seats/grove_tree2.png';
import s_tube from '../art/packs/sf_tube4.png';
import s_uarch from '../art/seats/ud_arch.png';
import s_warren from '../art/nests/warren.png';
import s_watch from '../art/packs/su_watchtower.png';
import s_well from '../art/packs/v_well.png';
import s_wheel from '../art/packs/sb_wheel.png';
import s_yurt1 from '../art/packs/rocky_yurt1.png';
import s_yurt2 from '../art/packs/rocky_yurt2.png';

/** The seats' canvas width in source px (the footprint plus `SEAT_OVERHANG` each side), and the throne rooms'. */
const SEAT_CANVAS = 220;
const ROOM_CANVAS = 96;
const SEAT_OVERHANG = 8;

type Laid = [string, number, number][];
const seat = (h: number, parts: Laid, grade?: string): Pick => ({ parts, size: [SEAT_CANVAS, h], overhang: SEAT_OVERHANG, ...(grade ? { grade } : {}) });
const room = (h: number, parts: Laid): Pick => ({ parts, size: [ROOM_CANVAS, h], overhang: 0 });

/** Each people's five stages, the first to the last (the holds' are their throne rooms, `ROOMS`). */
const SEATS: Partial<Record<OriginId, Pick[]>> = {
  settlers: [
    seat(80, [[s_rock1, 78, 2], [s_log3, 42, 62], [s_log3, 134, 62], [s_log1, 93, 61], [s_lantern, 22, 38], [s_lantern, 182, 38]]),
    seat(117, [[s_long, 62, 2], [s_log3, 16, 103], [s_log3, 160, 103], [s_lantern, 48, 75], [s_lantern, 156, 75], [s_signpost, 182, 73]]),
    seat(166, [[s_gbhouse, 40, 2], [s_flag, 12, 92], [s_barrels, 173, 124], [s_crates, 24, 128], [s_lantern, 168, 126]]),
    seat(155, [[s_flag, 4, 71], [s_flag, 184, 71], [s_house4, 33, 2], [s_lantern, 14, 115], [s_lantern, 190, 115], [s_well, 164, 103]]),
    seat(144, [[s_gable, -2, 2], [s_gable, 174, 2], [s_castle, 52, 8], [s_flag, 42, 40], [s_flag, 146, 40], [s_lantern, 56, 104], [s_lantern, 148, 104]]),
  ],
  lich: [
    seat(73, [[s_grave3, 48, 31], [s_grave4, 140, 31], [s_altar, 78, 2], [s_skulls, 50, 42], [s_skel, 134, 41], [s_cry3, 154, 7]]),
    seat(78, [[s_grave1, 26, 32], [s_grave3, 162, 32], [s_barrow, 88, 2], [s_altar, 22, 13], [s_skulls, 144, 47], [s_cry3, 164, 14]]),
    seat(136, [[s_uarch, 70, 58], [s_ruin2, 46, 2], [s_grave1, 14, 92], [s_grave4, 174, 92], [s_skullpile, 8, 85], [s_skulls, 154, 105]]),
    seat(138, [[s_crystal, 8, 29], [s_crystal, 160, 29], [s_ruin1, 46, 2], [s_grave3, 40, 106], [s_grave4, 148, 106], [s_skulls, 88, 113]]),
    seat(152, [[s_ruin, -12, 41], [s_ruin, 152, 41], [s_ruin1, 46, 2], [s_lich, 35, 43], [s_crystal, 22, 55], [s_crystal, 146, 55]]),
  ],
  druid: [
    seat(86, [[s_tree1, 6, 2], [s_tree2, 157, 3], [s_uarch, 70, 16], [s_ruin4, 40, 40], [s_ruin4, 132, 40]]),
    seat(94, [[s_tree1, 20, 2], [s_tree2, 143, 3], [s_lit2, 84, 4], [s_uarch, 70, 32], [s_mush1, -2, 30], [s_mush2, 158, 30]]),
    seat(186, [[s_tree1, 0, 92], [s_oak, 38, 2], [s_tree2, 165, 105], [s_uarch, 0, 124], [s_mush1, 146, 122]]),
    seat(190, [[s_lit1, 0, 94], [s_lit2, 168, 102], [s_oak, 38, 2], [s_roots, 61, 102]]),
    seat(194, [[s_lit1, -6, 94], [s_lit2, 172, 102], [s_arch, 14, 92], [s_fruit, 137, 96], [s_oak, 38, 2], [s_roots, 61, 106], [s_cry1, -2, 130], [s_cry2, 160, 130]]),
  ],
  werewolf: [
    seat(130, [[s_warren, 73, 34], [s_bones1, -20, 2], [s_skulls, 150, 97], [s_log1, 169, 109]]),
    seat(122, [[s_tipi2, 23, 29], [s_warren, 115, 22], [s_bonfire, 72, 58], [s_skulls, 4, 91], [s_bones1, 130, 2]]),
    seat(119, [[s_fire1, -8, 43], [s_long, 62, 2], [s_btotem, 167, 69], [s_btotem, 5, 73], [s_skulls, 42, 88]], 'werewolf'),
    seat(123, [[s_tipi2, -7, 24], [s_tipi1, 154, 20], [s_long, 62, 2], [s_btotem, 85, 83], [s_skulls, 34, 92]], 'werewolf'),
    seat(142, [[s_tipi2, -11, 37], [s_tipi1, 158, 33], [s_castle, 52, 2], [s_btotem, 33, 96], [s_btotem, 137, 96], [s_skulls, 88, 121]], 'werewolf'),
  ],
  robot: [
    seat(58, [[s_sf26, 76, 2], [s_sf9, 38, 39], [s_sf12, 151, 40], [s_coil, 16, 11], [s_coil, 176, 11]]),
    seat(60, [[s_sf27, 41, 13], [s_sf26, 116, 2], [s_sf13, 36, 34], [s_sf19, 152, 38], [s_coil, 8, 15]]),
    seat(90, [[s_sf24, 10, 2], [s_sf26, 96, 32], [s_sf27, 131, 51], [s_sf13, 52, 64], [s_coil, 0, 47], [s_coil, 192, 47]]),
    seat(95, [[s_sf24, -4, 3], [s_sf25, 156, 2], [s_sf26, 42, 39], [s_sf27, 111, 54], [s_tube, 58, 53], [s_coil, 0, 52], [s_coil, 192, 52]]),
    seat(216, [[s_sf24, -8, 120], [s_sf25, 160, 119], [s_pylon, 80, 2], [s_sf26, 26, 160], [s_sf26, 126, 160], [s_sf13, 82, 190], [s_coil, 0, 173], [s_coil, 192, 173]]),
  ],
  merfolk: [
    seat(82, [[s_mer1, 60, 2], [s_mer2, 132, 18], [s_coral1, 20, 40], [s_coral3, 166, 44], [s_shell, 97, 55], [s_coralr, 96, 61]]),
    seat(164, [[s_round, 58, 2], [s_coral1, 16, 122], [s_coral2, 164, 126], [s_shell, 51, 139], [s_coralr, 146, 137]], 'merfolk'),
    seat(166, [[s_mer1, 16, 82], [s_mer2, 176, 98], [s_round, 58, 2], [s_coral1, 36, 128], [s_coral2, 144, 132], [s_shell, 97, 147]], 'merfolk'),
    seat(166, [[s_mer1, 10, 82], [s_mer2, 182, 98], [s_round, 58, 2], [s_coral1, 36, 128], [s_coral3, 150, 132], [s_coralr, 8, 139], [s_coral2, 180, 132], [s_shell, 97, 147]], 'merfolk'),
    seat(176, [[s_round, -18, 2], [s_round, 134, 2], [s_round, 58, 10], [s_mer1, 46, 106], [s_mer2, 146, 122], [s_coral2, -6, 142], [s_coral1, 186, 138], [s_wheel, 90, 151]], 'merfolk'),
  ],
  nomads: [
    seat(101, [[s_tent, 61, 2], [s_bonfire, 8, 37], [s_cart, 158, 73], [s_sacks, 145, 78]]),
    seat(99, [[s_tipi2, 7, 2], [s_yurt1, 82, 15], [s_bonfire, 162, 31], [s_sacks, 39, 70]]),
    seat(103, [[s_yurt2, -6, 13], [s_yurt2, 146, 13], [s_tent, 61, 2], [s_sacks, 49, 74], [s_barrels, 133, 61]]),
    seat(126, [[s_yurt2, -14, 32], [s_yurt2, 154, 32], [s_yurt1, 70, 38], [s_cart, 24, 100], [s_sacks, 89, 103], [s_cart, 148, 100], [s_flag, 94, 2]]),
    seat(172, [[s_yurt2, -14, 76], [s_yurt2, 154, 76], [s_round, 58, 2], [s_yurt1, 16, 92], [s_yurt1, 124, 92], [s_flag, 94, 112]], 'nomads'),
  ],
  fae: [
    seat(82, [[s_mush1, 14, 10], [s_mush2, 48, 4], [s_mush1, 78, 2], [s_mush2, 108, 4], [s_mush1, 142, 10], [s_cry2, 78, 18]]),
    seat(140, [[s_mushbig, 46, 2], [s_mush1, 8, 72], [s_mush2, 148, 72], [s_mush2, 38, 76], [s_mush1, 120, 76]]),
    seat(140, [[s_tent4, 78, 59], [s_mushbig2, -34, 2], [s_mushbig, 126, 2], [s_cry1, 38, 76], [s_cry2, 118, 76], [s_mush1, 78, 82]]),
    seat(142, [[s_cry3, -2, 64], [s_cry3, 158, 64], [s_mage, 71, 2], [s_mushbig, -14, 12], [s_mushbig2, 108, 12], [s_mush2, 78, 86]]),
    seat(146, [[s_arch, -6, 44], [s_arch, 142, 44], [s_mage, 71, 2], [s_mushbig, -4, 16], [s_mushbig2, 98, 16], [s_cry1, -12, 82], [s_cry2, 168, 82], [s_mush1, 78, 92]]),
  ],
  alchemists: [
    seat(127, [[s_house, 67, 2], [s_tank3, 30, 98], [s_tank2, 162, 89], [s_barrel, 50, 105]]),
    seat(140, [[s_mage, 71, 2], [s_tank1, 26, 86], [s_tank4, 158, 86], [s_tank3, 58, 113], [s_tank2, 136, 104]]),
    seat(119, [[s_fire1, -8, 43], [s_long, 62, 2], [s_tank1, 172, 65], [s_tank3, 52, 92], [s_tank2, 144, 83]]),
    seat(170, [[s_fire1, -6, 90], [s_gbhouse, 46, 2], [s_tank4, 182, 110], [s_tank1, 22, 120], [s_tank2, 170, 134], [s_tank3, 68, 149]]),
    seat(172, [[s_mage, 1, 24], [s_fire1, 170, 90], [s_gbhouse, 62, 2], [s_tank1, 0, 122], [s_tank4, 58, 122], [s_tank3, 184, 145], [s_crystal, 164, 79]]),
  ],
  knights: [
    seat(126, [[s_pal1, 32, 88], [s_pal2, 64, 88], [s_lookout, 70, 31], [s_pal3, 124, 88], [s_pal1, 156, 88], [s_flag, 94, 2]]),
    seat(140, [[s_castle, 52, 2], [s_flag, 24, 66], [s_flag, 164, 66], [s_barrels, 167, 98], [s_crates, 26, 102]]),
    seat(140, [[s_watch, -8, 16], [s_castle, 62, 2], [s_flag, 176, 64], [s_barrels, 177, 98], [s_crates, 54, 102]]),
    seat(174, [[s_round, -16, 2], [s_watch, 148, 48], [s_castle, 54, 36], [s_flag, 52, 100], [s_flag, 144, 100]]),
    seat(178, [[s_round, -26, 2], [s_round, 142, 2], [s_castle, 52, 36], [s_flag, 42, 110], [s_flag, 146, 110]]),
  ],
  orcs: [
    seat(140, [[s_totem, 46, 2], [s_skulls, 34, 109], [s_skulls, 144, 109], [s_bonfire, 130, 80]]),
    seat(140, [[s_tipi1, 72, 43], [s_totem, -34, 2], [s_skullpile, 148, 89], [s_bonfire, 30, 76]]),
    seat(132, [[s_fire1, -10, 54], [s_fire1, 162, 54], [s_long, 62, 15], [s_totem, -34, 2], [s_totem, 126, 2], [s_skulls, 88, 107]], 'orcs'),
    seat(142, [[s_fire1, -12, 60], [s_fire1, 164, 60], [s_castle, 52, 2], [s_totem, -30, 12], [s_totem, 122, 12], [s_skullpile, 74, 99]], 'orcs'),
    seat(144, [[s_fire1, -14, 58], [s_fire1, 166, 58], [s_totem, -30, 2], [s_totem, 122, 2], [s_ruin2, 46, 4], [s_dskull, 46, 26], [s_skullpile, -8, 93], [s_skullpile, 156, 93]]),
  ],
};

/** The holds' seats: the throne room's furnishings, laid on the castle's floor (map/castleArt.ts). */
const ROOMS: Partial<Record<OriginId, Pick[]>> = {
  vampire: [
    room(34, [[s_rugr, 32, 2], [s_throne, 40, 6], [s_cand, 15, 13], [s_cand, 67, 13]]),
    room(34, [[s_rugr, 32, 2], [s_throne, 40, 6], [s_cand, 7, 11], [s_cand, 75, 11], [s_coffin, 17, 18], [s_coffin, 65, 18]]),
    room(34, [[s_rugr, 14, 2], [s_rugr, 50, 2], [s_throne, 40, 4], [s_cand, 3, 9], [s_cand, 79, 9], [s_coffin, 9, 18], [s_coffin, 73, 18], [s_dgold, 40, 22]]),
    room(34, [[s_rugr, 14, 2], [s_rugr, 50, 2], [s_throne, 40, 2], [s_cand, 3, 7], [s_cand, 79, 7], [s_cand, 23, 3], [s_cand, 59, 3], [s_coffin2, 6, 18], [s_coffin2, 74, 18], [s_dgold, 40, 22]]),
    room(36, [[s_rugr, 14, 4], [s_rugr, 50, 4], [s_throne, 40, 2], [s_cand, -1, 7], [s_cand, 83, 7], [s_cand, 21, 3], [s_cand, 61, 3], [s_coffin, 3, 20], [s_coffin, 79, 20], [s_dgold, 28, 24], [s_dgold, 52, 24], [s_chest, 38, 24]]),
  ],
  dwarves: [
    room(36, [[s_rugg, 32, 4], [s_throne, 40, 8], [s_dbarrel, 2, 2], [s_anvil, 70, 20]]),
    room(34, [[s_rugg, 32, 2], [s_throne, 40, 6], [s_cand, 15, 9], [s_cand, 67, 9], [s_dbarrel, -4, 4], [s_anvil, 74, 20], [s_chest, 14, 18]]),
    room(34, [[s_rugg, 14, 2], [s_rugg, 50, 2], [s_throne, 40, 4], [s_cand, 3, 9], [s_cand, 79, 9], [s_gold, 14, 17], [s_gold, 62, 17], [s_chest, 38, 20]]),
    room(34, [[s_rugg, 14, 2], [s_rugg, 50, 2], [s_throne, 40, 2], [s_dgold, 16, 6], [s_dgold, 64, 6], [s_cand, 1, 9], [s_cand, 81, 9], [s_gold, 10, 17], [s_gold, 66, 17], [s_chest, 38, 20]]),
    room(36, [[s_rugg, 14, 4], [s_rugg, 50, 4], [s_throne, 40, 2], [s_dgold, 14, 6], [s_dgold, 66, 6], [s_cand, -1, 9], [s_cand, 83, 9], [s_gold, 4, 19], [s_gold, 72, 19], [s_chest, 26, 22], [s_chest, 50, 22], [s_dgold, 40, 28]]),
  ],
};

/** A people's seat at a stage (1..5), `w` cells wide; null while its sprites load (or for a people with none). */
export function seatPack(origin: OriginId, stage: number, w: number): PixelArt | null {
  const pick = SEATS[origin]?.[stage - 1];
  return pick ? pickArt(pick, w, `seat|${origin}|${stage}`) : null;
}

/** A hold's throne room at a stage, for a room `w` cells wide (drawn a cell narrower than the room, as before). */
export function seatRoomPack(origin: OriginId, stage: number, w: number): PixelArt | null {
  const pick = ROOMS[origin]?.[stage - 1];
  return pick ? pickArt(pick, Math.max(2, w - 1), `throne|${origin}|${stage}`) : null;
}

/** Whether a people's seat has its pack pictures (the tests check every people does). */
export const seatPacked = (origin: OriginId): boolean => (SEATS[origin] ?? ROOMS[origin])?.length === 5;
