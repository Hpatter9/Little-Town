// Craftpix's Village tileset (the top-down tower-defence one, also the raid map's tower pads) lends the medieval
// town its houses and market awnings on the map: half-timbered houses for the cottage, the row houses and the
// inn, striped awnings for the trading post and the stalls. Each picture is scaled to its building's footprint (a
// little overhang each side), pixel for pixel on the fine grid, and stands in for the code-drawn picture in the
// looks it suits (the base town and the knights). Until a picture has loaded, the code-drawn one stands.

import { CanvasSource, Texture } from 'pixi.js';
import { lineOfDef, venueOfDef } from '../../shared/data/shop';
import { BUILDING_BY_ID } from '../../shared/data/buildings';
import { LINES } from '../../shared/data/stores';
import { CELL } from '../../shared/sim/land';
import { loadImage } from '../art/loadImage';
import { FINE, type PixelArt } from '../art/pixelArt';
import house1 from '../art/village/house1.png';
import gbHouse from '../art/shops/gb_house.png';
import gbShop from '../art/shops/gb_shop.png';
import gbSignpost from '../art/shops/gb_signpost.png';
import gbBarrels from '../art/shops/gb_barrels.png';
import gbCrates from '../art/shops/gb_crates.png';
import gbAwning from '../art/shops/gb_awning.png';
import gbCanopy from '../art/shops/gb_canopy.png';
import gbSacks from '../art/shops/gb_sacks.png';
import gbBarrow from '../art/shops/gb_barrow.png';
import apShelf from '../art/shops/ap_shelf.png';
import apPlant from '../art/shops/ap_plant.png';
import apVase from '../art/shops/ap_vase.png';
import vHelm from '../art/shops/v_helm.png';
import house2 from '../art/village/house2.png';
import house4 from '../art/village/house4.png';
import tent2 from '../art/village/tent2.png';
import barrel from '../art/village/barrel.png';
import cart from '../art/village/cart.png';
import crate from '../art/village/crate.png';
import lantern from '../art/village/lantern.png';
import sign from '../art/village/sign.png';

import box1 from '../art/village/box1.png';
import box2 from '../art/village/box2.png';
import log1 from '../art/village/log1.png';
import log3 from '../art/village/log3.png';
import palisade02 from '../art/village/palisade02.png';
import palisade01 from '../art/village/palisade01.png';
import palisade04 from '../art/village/palisade04.png';
import palisade06 from '../art/village/palisade06.png';
import palisade09 from '../art/village/palisade09.png';
import palisade10 from '../art/village/palisade10.png';
import palisade11 from '../art/village/palisade11.png';
import palisade12 from '../art/village/palisade12.png';
import palisade14 from '../art/village/palisade14.png';
import palisade17 from '../art/village/palisade17.png';
import palisade22 from '../art/village/palisade22.png';
import palisade25 from '../art/village/palisade25.png';
import palisade30 from '../art/village/palisade30.png';
import palisade33 from '../art/village/palisade33.png';
import palisade38 from '../art/village/palisade38.png';
import palisade41 from '../art/village/palisade41.png';
import palisade46 from '../art/village/palisade46.png';
import palisade03 from '../art/village/palisade03.png';
import palisade36 from '../art/village/palisade36.png';
import palisade37 from '../art/village/palisade37.png';
import palisade19 from '../art/village/palisade19.png';
import dwalls from '../art/village/dwalls.png';
import dprops from '../art/village/dprops.png';
import grave1 from '../art/village/grave1.png';
import grave2 from '../art/village/grave2.png';
import grave3 from '../art/village/grave3.png';
import grave4 from '../art/village/grave4.png';
import grave5 from '../art/village/grave5.png';
import soil01 from '../art/fields/soil01.png';
import soil05 from '../art/fields/soil05.png';
import soil07 from '../art/fields/soil07.png';
import fence1 from '../art/fields/fence1.png';
import fence9 from '../art/fields/fence9.png';
import flower1 from '../art/fields/flower1.png';
import flower3 from '../art/fields/flower3.png';
import flower5 from '../art/fields/flower5.png';
import flower9 from '../art/fields/flower9.png';
import tuft2 from '../art/fields/tuft2.png';
import house3 from '../art/village/house3.png';
import camp3 from '../art/village/camp3.png';
import palisade05 from '../art/village/palisade05.png';
import vCart2 from '../art/packs/v_cart2.png';
import vLogpile from '../art/packs/v_logpile.png';
import vBucket from '../art/packs/v_bucket.png';
import vAnvil from '../art/packs/v_anvil.png';
import vRack from '../art/packs/v_rack.png';
import vWell from '../art/packs/v_well.png';
import vSignAnvil from '../art/packs/v_sign_anvil.png';
import vSignBow from '../art/packs/v_sign_bow.png';
import vSignSword from '../art/packs/v_sign_sword.png';
import vSignShield from '../art/packs/v_sign_shield.png';
import fLog1 from '../art/packs/f_log1.png';
import fLog2 from '../art/packs/f_log2.png';
import fLog3 from '../art/packs/f_log3.png';
import fBox1 from '../art/packs/f_box1.png';
import fStump from '../art/packs/f_stump.png';
import fDirt from '../art/packs/f_dirt.png';
import caveCrystal from '../art/packs/cave_crystal.png';
import caveGate from '../art/packs/cave_gate.png';
import portalGate from '../art/deep/ruin2.png';
import portalCircle from '../art/deep/circle.png';
import shard1 from '../art/deep/crystal1.png';
import shard2 from '../art/deep/crystal2.png';
import caveFire1 from '../art/packs/cave_fire1.png';
import caveFire2 from '../art/packs/cave_fire2.png';
import caveAltar from '../art/packs/cave_altar.png';
import caveStatue from '../art/packs/cave_statue.png';
import caveTotem from '../art/packs/cave_totem.png';
import caveGem from '../art/packs/cave_gem.png';
import rockyMine1 from '../art/packs/rocky_mine1.png';
import rockyMine2 from '../art/packs/rocky_mine2.png';
import rockyTipi1 from '../art/packs/rocky_tipi1.png';
import rockyTipi2 from '../art/packs/rocky_tipi2.png';
import rockyYurt1 from '../art/packs/rocky_yurt1.png';
import rockyYurt2 from '../art/packs/rocky_yurt2.png';
import dpTank1 from '../art/packs/dp_tank1.png';
import dpTank2 from '../art/packs/dp_tank2.png';
import dpTank3 from '../art/packs/dp_tank3.png';
import dpTank4 from '../art/packs/dp_tank4.png';
import dpChair1 from '../art/packs/dp_chair1.png';
import dpChair2 from '../art/packs/dp_chair2.png';
import dpTable2 from '../art/packs/dp_table2.png';
import dpBooks from '../art/packs/dp_books.png';
import dpShelf1 from '../art/packs/dp_shelf1.png';
import dpShelf2 from '../art/packs/dp_shelf2.png';
import dpDesk from '../art/packs/dp_desk.png';
import dpBench from '../art/packs/dp_bench.png';
import dpBench2 from '../art/packs/dp_bench2.png';
import doBarrel from '../art/packs/do_barrel.png';
import doGold from '../art/packs/do_gold.png';
import doJug from '../art/packs/do_jug.png';
import doChest from '../art/packs/do_chest.png';
import doCrates from '../art/packs/do_crates.png';
import sf8 from '../art/packs/sf_8.png';
import sf9 from '../art/packs/sf_9.png';
import sf10 from '../art/packs/sf_10.png';
import sf11 from '../art/packs/sf_11.png';
import sf12 from '../art/packs/sf_12.png';
import sf13 from '../art/packs/sf_13.png';
import sf14 from '../art/packs/sf_14.png';
import sf15 from '../art/packs/sf_15.png';
import sf16 from '../art/packs/sf_16.png';
import sf17 from '../art/packs/sf_17.png';
import sf18 from '../art/packs/sf_18.png';
import sf19 from '../art/packs/sf_19.png';
import sf20 from '../art/packs/sf_20.png';
import sf24 from '../art/packs/sf_24.png';
import sf25 from '../art/packs/sf_25.png';
import sf26 from '../art/packs/sf_26.png';
import suWindmill from '../art/packs/su_windmill.png';
import suWindmillBody from '../art/packs/su_windmill_body.png';
import suWindmillSail from '../art/packs/su_windmill_sail.png';
import suWindmillHub from '../art/packs/su_windmill_hub.png';
import fieldsFlag from '../art/fields/flag.png';
import suWatchtower from '../art/packs/su_watchtower.png';
import suLookout from '../art/packs/su_lookout.png';
import suCastle from '../art/packs/su_castle.png';
import suMageTower from '../art/packs/su_magetower.png';
import suRoundCastle from '../art/packs/su_roundcastle.png';
import suTent from '../art/packs/su_tent.png';
import suHouse from '../art/packs/su_house.png';
import ttLong from '../art/packs/tt_long.png';
import ttGable from '../art/packs/tt_gable.png';
import dlPit from '../art/packs/dl_pit.png';
import dlFence from '../art/packs/dl_fence.png';
import fPointer4 from '../art/packs/f_pointer4.png';
import fFence1 from '../art/packs/f_fence1.png';
import fFence3 from '../art/packs/f_fence3.png';
import vBench from '../art/packs/v_bench.png';
import pierH from '../art/roads/pier_h.png';
import dlStakes from '../art/packs/dl_stakes.png';
import dlCaltrops from '../art/packs/dl_caltrops.png';
import dlSpikes from '../art/packs/dl_spikes.png';
import aoCoil from '../art/packs/ao_coil.png';
import sfPylon from '../art/packs/sf_pylon.png';
import sf27 from '../art/packs/sf_27.png';
import sfTube4 from '../art/packs/sf_tube4.png';

/** A pack picture for a building: one image, or several laid together (`parts`: image, x, y in source px, on a
 *  canvas `size`), hanging `overhang` px over the footprint each side, in the looks it suits (`styles`; none: all
 *  but the origins with their own tents and halls). */
/** A part: an image at x, y (source px), the whole of it or a crop of it (sx, sy, sw, sh). */
type Part = [string, number, number] | [string, number, number, number, number, number, number];
/** The palisade's single post, cropped so it stands in the middle of its cell (the pack drew it right of centre). */
const POST: Part = [palisade19, 0, 0, 4, 0, 28, 32];
/** A palisade piece two tiles tall (the stakes' pointed tops over the cell above, their feet on the cell), or one. */
const pal2 = (top: string, foot: string): Pick => ({ parts: [[top, 0, 0], [foot, 0, 32]], size: [32, 64], overhang: 0 });
const pal1 = (tile: string): Pick => ({ parts: [[tile, 0, 0]], size: [32, 32], overhang: 0 });
/** The palisade's runs of stakes, one of three by the piece's id. */
const PAL_RUN: Pick[] = [pal2(palisade02, palisade10), pal2(palisade03, palisade11), pal2(palisade04, palisade12)];
/** A water grate's bars (`dl_fence.png`: a 16px cell, drawn across the whole cell), turned to stand down a column. */
const grate = (col: number, grade?: string): Pick => {
  const bars: Pick = { parts: [[dlFence, 0, 0, col * 16, 0, 16, 16]], size: [16, 16], overhang: 0, ...(grade ? { grade } : {}) };
  return { own: true, ...bars, joins: { v: { ...bars, rotate: 90 } } };
};
export interface Pick {
  url?: string;
  parts?: Part[];
  size?: [number, number];
  overhang?: number;
  styles?: Set<string>;
  /** Several pictures to choose from by the building's id. */
  any?: string[];
  /** Several picks to choose from by the building's id (pictures laid from parts). */
  of?: Pick[];
  /** Other pictures for particular looks (the nomads' tents, the dwarves' gates), tried before the pick itself. */
  variants?: { styles: string[]; pick: Pick }[];
  /** Where smoke rises from (the chimneys' tops, in source px), for the map's smoke. */
  smoke?: [number, number][];
  /** The windows (their centres, in source px): they glow after dark like the painted art's lamp colours. */
  lamps?: [number, number][];
  /** A tent or a wall: the origins with tents and walls of their own (`OWN_TENTS`) keep theirs instead. */
  own?: true;
  /** Drawn turned a quarter clockwise (a gate standing down a column). */
  rotate?: 90;
  /** A wall piece's picture by how it joins its neighbours (the ring wall: sim/ringWall.ts): along a row (`h`), down a
   *  column (`v`), at a corner, or standing alone (`end`); the pick itself when a join has none. */
  joins?: Partial<Record<Join, Pick>>;
  /** Recoloured for a look (`GRADES`): the shops' pictures worn by the peoples without timber houses of their own. */
  grade?: string;
  /** Sails that turn (the windmill): on the map the picture is `body` (the sails cut away) and `blades` copies of
   *  `sail` (one blade pointing up, its foot on the hub) turn about `at` (source px) with `hub` over them; a still
   *  picture (a card) keeps the pick's own. */
  turning?: { body: string; sail: string; hub: string; at: [number, number]; blades: number };
}
/** How a wall piece joins the pieces about it (map/mapView.ts `wallJoin`). */
export type Join = 'h' | 'v' | 've' | 'nw' | 'ne' | 'sw' | 'se' | 'end';
/** The glow of a pack house's window (the painter's window colour). */
const WINDOW_GLOW = 0xf0d890;
/** The looks the pack's timber houses suit. */
const TIMBER = new Set(['town', 'settlers', 'knights']);
/** The looks whose origins have tents and walls of their own (originStyles.ts): the pack's tents and walls (`own`)
 *  are kept from them; the shared props (the well, racks, fire pits, benches, plants) suit every look. */
const OWN_TENTS = new Set(['vampire', 'lich', 'robot', 'nomads', 'merfolk', 'nomads_city']);
/** The nomads' looks: the rocky-area pack's tipis and yurts stand for their homes. */
const NOMAD = ['nomads', 'nomads_city'];
/** The looks whose halls are the Simple Summer pack's stone keep, its crystal-crowned mage tower, its round keep (a
 *  shore town's tower by the sea), and its striped tent (a caravan on the move). */
const KEEP_HALL = ['lich', 'werewolf'];
const MAGE_HALL = ['alchemists', 'fae', 'druid'];
const ROUND_HALL = ['merfolk'];
const TENT_HALL = ['nomads'];
const MACHINE_HALL = ['robot'];
const hallVariants = (): { styles: string[]; pick: Pick }[] => [
  { styles: KEEP_HALL, pick: { url: suCastle, overhang: 4 } },
  { styles: MAGE_HALL, pick: { url: suMageTower, overhang: 4 } },
  { styles: ROUND_HALL, pick: { url: suRoundCastle, overhang: 4 } },
  { styles: TENT_HALL, pick: { url: suTent, overhang: 6 } },
  // (the machines' hall, put together from the futuristic objects: a transformer, the shuttered block with a console
  // before it, and a great tank)
  { styles: MACHINE_HALL, pick: { parts: [[sf26, 0, 29], [sf27, 66, 42], [sf12, 92, 59], [sf25, 142, 0]], size: [210, 77], overhang: 0 } },
];
const PICKS: Record<string, Pick> = {
  cottage: { url: house1, styles: TIMBER, smoke: [[22, 7]], lamps: [[81, 51], [39, 85], [81, 85]], variants: [{ styles: NOMAD, pick: { url: rockyYurt2, overhang: 6, smoke: [[40, 1]] } }] },
  rowhouse: { url: house2, styles: TIMBER, smoke: [[26, 31]], lamps: [[80, 74], [110, 74], [132, 74], [37, 106], [80, 106]], variants: [{ styles: NOMAD, pick: { parts: [[rockyYurt1, 0, 0], [rockyYurt2, 84, 4]], size: [164, 82], overhang: 6, smoke: [[39, 1], [124, 5]] } }] },
  // the shops and the tavern: the Glassblower's Workshop pack's shop fronts (the big red-roofed house with its chimney
  // for the inn, tavern and emporium; the small timber shop, its gable set on its walls, for the rest), and the trading
  // post an open market stall under the pack's red canopy with its goods beneath; each venue's storefront (an awning in
  // its colours over the goods of its trade) and banner are set out front by `packDressing`, in every look
  fireside_inn: { parts: [[gbHouse, 0, 0], [gbBarrels, 104, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  tavern: { parts: [[gbHouse, 0, 0], [gbBarrels, 104, 118], [gbSignpost, 2, 112]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  trading_post: { parts: [[gbCanopy, 0, 0], [gbCrates, 26, 34], [gbSacks, 52, 50], [gbCrates, 86, 38]], size: [129, 87], styles: TIMBER, overhang: 4 },
  market: { url: tent2, styles: TIMBER },
  general_store: { url: gbShop, styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]] },
  emporium: { parts: [[gbHouse, 0, 0], [gbCrates, 120, 122], [gbBarrels, 2, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  furniture_store: { url: gbShop, styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]] },
  weapon_store: { url: gbShop, styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]] },
  armour_store: { url: gbShop, styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]] },
  apothecary_shop: { url: gbShop, styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]] },
  // the first homes: the nomads' tipis and yurts; everyone else's are the top-down painter's huts and the longhouse
  // (the owner's call: tents are a nomad thing, not a settler's house). `styles` NOMAD alone, so the rest get no pick.
  // the first homes: the Simple Summer pack's cottage on its stone footing, and the tiny-rpg-town pack's long house
  // (its inn sign painted over with its other window); the nomads keep their tipis and yurts
  lean_to: { url: suHouse, styles: TIMBER, overhang: 2, smoke: [[23, 5]], lamps: [[42, 72]], variants: [{ styles: NOMAD, pick: { url: rockyTipi2, overhang: 4, smoke: [[29, 1]] } }] },
  hide_tent: { url: suHouse, styles: TIMBER, overhang: 4, smoke: [[23, 5]], lamps: [[42, 72]], variants: [{ styles: NOMAD, pick: { url: rockyTipi1, overhang: 4, smoke: [[38, 2]] } }] },
  longhouse: { url: ttLong, styles: TIMBER, overhang: 2, smoke: [[22, 2]], lamps: [[22, 44], [72, 44], [17, 77], [78, 77]], variants: [{ styles: NOMAD, pick: { url: rockyYurt1, overhang: 8, smoke: [[39, 1]] } }] },
  // the tiny-rpg-town pack's tall gabled house, its window boxes in flower, two side by side for the apartments
  apartments: { parts: [[ttGable, 0, 0], [ttGable, 47, 0]], size: [95, 132], styles: TIMBER, overhang: 2, lamps: [[25, 103], [24, 60], [72, 103], [71, 60]] },
  // the trades the timber house's gear tells apart
  gunsmith: { parts: [[house3, 0, 0], [vRack, 120, 112], [vAnvil, 6, 132]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  cinema: { parts: [[house4, 0, 0], [vSignShield, 2, 110]], size: [154, 149], styles: TIMBER, lamps: [[97, 87], [114, 122]] },
  university: { parts: [[gbHouse, 0, 0], [dpShelf1, 104, 112], [dpBooks, 2, 124]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  // towers from the Simple Summer pack: the tall timber tower keeps the guard, the short one hangs the bell
  guard_tower: { url: suWatchtower, overhang: 3 },
  bell_tower: { url: suLookout, overhang: 3 },
  // a yard of logs, racks and a cart where the boats are built
  boatyard: { parts: [[vLogpile, 0, 6], [vRack, 46, 0], [fLog3, 80, 24], [doBarrel, 128, 14]], size: [156, 50], overhang: 0 },
  // the Court's blood farm: graves and the cells' stones
  blood_farm: { parts: [[grave1, 0, 0], [grave3, 34, 6], [grave5, 66, 0], [grave2, 16, 28], [grave4, 50, 30]], size: [98, 62], overhang: 0 },
  // DawnLike's pit, stakes and spikes, a cell each; the loose animated-objects pack's electric coil
  pit_trap: { url: dlPit, overhang: 0 },
  spike_trap: { url: dlStakes, overhang: 0 },
  caltrops: { url: dlCaltrops, overhang: 0 },
  wolf_trap: { url: dlCaltrops, overhang: 0 },
  bramble_snare: { url: dlStakes, overhang: 0, grade: 'druid' },
  land_mine: { url: dlSpikes, overhang: 0 },
  tesla_coil: { url: aoCoil, overhang: 2 },
  shield_generator: { parts: [[aoCoil, 0, 0], [aoCoil, 34, 0]], size: [63, 43], overhang: 2 },
  // each people's own defence, from the props that suit it (the war engines and turrets stay painted: no pack has them)
  militia_post: { parts: [[vRack, 0, 0], [vSignSword, 26, 18]], size: [49, 42], overhang: 2 },
  bone_spire: { url: caveTotem, overhang: 2, grade: 'lich' },
  gargoyle_perch: { url: caveStatue, overhang: 2, grade: 'vampire' },
  rune_bolt_thrower: { url: caveTotem, overhang: 2 },
  arrow_wagon: { parts: [[vCart2, 0, 4], [vRack, 38, 0]], size: [66, 42], overhang: 2 },
  glamour_ring: { url: caveGem, overhang: 2, grade: 'fae' },
  crossbow_bastion: { url: suLookout, overhang: 3 },
  // the late plants, put together from the futuristic objects like the factory
  steelworks: { parts: [[sf26, 0, 28], [sfTube4, 50, 0], [sf25, 150, 0]], size: [218, 77], overhang: 0 },
  cement_works: { parts: [[sf24, 0, 0], [sf12, 72, 56]], size: [100, 76], overhang: 0 },
  alloy_foundry: { parts: [[sf27, 0, 40], [sf26, 82, 27], [sf19, 154, 52]], size: [186, 76], overhang: 0 },
  fusion_reactor: { parts: [[sf24, 0, 0], [aoCoil, 74, 30], [sf25, 106, 0], [sf26, 178, 28]], size: [246, 77], overhang: 0 },
  cryo_pod: { parts: [[sf8, 0, 0]], size: [19, 24], overhang: 2 },
  clone_vat: { parts: [[sf24, 0, 0]], size: [68, 76], overhang: 0 },
  habitat_dome: { url: suRoundCastle, overhang: 4, grade: 'robot' },
  trauma_center: { parts: [[dpBench, 0, 14], [dpBench, 82, 14], [dpTank1, 166, 0], [dpTank4, 204, 0]], size: [240, 52], overhang: 0 },
  // the great halls: the Glassblower pack's big house for the elder lodge and the town hall (the painter's hall shape
  // was clunky), its shop with the shield sign for the trophy hall
  elder_lodge: { parts: [[gbHouse, 0, 0], [gbSignpost, 2, 112], [gbBarrels, 104, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]], variants: hallVariants() },
  town_hall: { parts: [[gbHouse, 0, 0], [gbCrates, 120, 122]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]], variants: hallVariants() },
  trophy_hall: { parts: [[gbShop, 0, 0], [vSignShield, 2, 60]], size: [110, 98], styles: TIMBER, lamps: [[30, 83], [80, 83], [74, 45]], variants: hallVariants() },
  // the stockpile: crates and logs heaped together
  stockpile: { parts: [[log3, 2, 14], [box1, 10, 4], [box2, 28, 8], [log1, 44, 6], [box1, 62, 10], [box2, 76, 2]], size: [96, 28], overhang: 0 },
  // the Village pack's palisade (its tileset laid as the pack lays it: a run along a row is two tiles tall, the pointed
  // tops over the cell above and the feet with their stones on the cell; each corner is the pack's own corner piece;
  // down a column the post of that side (the west wall's at the left of its cell, the east wall's at the right, so they
  // meet the corners' posts); a lone piece a single post)
  palisade_wall: {
    own: true,
    of: PAL_RUN,
    overhang: 0,
    joins: {
      h: { of: PAL_RUN, overhang: 0 },
      v: { of: [pal1(palisade17), pal1(palisade25)], overhang: 0 },
      ve: { of: [pal1(palisade22), pal1(palisade30)], overhang: 0 },
      nw: pal2(palisade01, palisade09),
      ne: pal2(palisade06, palisade14),
      sw: pal2(palisade33, palisade41),
      se: pal2(palisade38, palisade46),
      end: { parts: [POST], size: [32, 32], overhang: 0 },
    },
  },
  palisade_gate: { own: true, parts: [[palisade36, 0, 0], [palisade37, 32, 0]], size: [64, 32], overhang: 0, joins: { v: { parts: [[palisade36, 0, 0], [palisade37, 32, 0]], size: [64, 32], overhang: 0, rotate: 90 } } },
  // the dungeon pack's stonework: a stretch of wall, an arched gate with its door
  stone_wall: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0 },
  brick_wall: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0, grade: 'brick' },
  concrete_wall: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0, grade: 'concrete' },
  force_wall: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0, grade: 'force' },
  stone_gate: { own: true, parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  brick_gate: { own: true, grade: 'brick', parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  concrete_gate: { own: true, grade: 'concrete', parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  force_gate: { own: true, grade: 'force', parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  // the grates where the ring wall crosses a river (sim/ringWall.ts): DawnLike's fence runs, wooden bars for the
  // palisade, iron for the stone wall, pale steel for the concrete one, the water showing between the bars
  palisade_grate: grate(0),
  stone_grate: grate(1),
  brick_grate: grate(1, 'brick'),
  concrete_grate: grate(2),
  force_grate: grate(2, 'force'),
  // the places of leisure (data/recreation.ts), laid from the Fields and Village packs' small things: a signpost for
  // the green's pole with logs for benches, the rack and a post for the yard, the bridge pack's planks for the jetty,
  // a peg and rails for the pitch, the garden's beds, bench and lamps, a tent and benches for the bandstand
  village_green: { parts: [[fPointer4, 36, 4], [log3, 2, 44], [log3, 50, 46], [fStump, 66, 8], [flower1, 10, 12], [flower5, 20, 30], [flower9, 60, 40], [flower1, 86, 30], [tuft2, 28, 56], [tuft2, 78, 20]], size: [96, 64], overhang: 0 },
  sparring_yard: { parts: [[vRack, 0, 6], [palisade19, 62, 2, 4, 0, 28, 32], [fDirt, 40, 30], [fDirt, 70, 38], [fFence1, 0, 49], [fFence1, 28, 49], [fFence1, 56, 49], [box1, 80, 46]], size: [96, 64], overhang: 0 },
  fishing_jetty: { parts: [[pierH, 0, 0], [pierH, 32, 0], [barrel, 42, 4], [vBucket, 6, 10]], size: [64, 36], overhang: 0 },
  // the training grounds (data/training.ts)
  drill_yard: { parts: [[vRack, 0, 6], [palisade19, 62, 2, 4, 0, 28, 32], [palisade19, 30, 10, 4, 0, 28, 32], [fDirt, 40, 30], [fDirt, 70, 38], [fFence1, 0, 49], [fFence1, 28, 49], [fFence1, 56, 49]], size: [96, 64], overhang: 0 },
  archery_range: { parts: [[fFence3, 0, 0], [fFence3, 26, 0], [box2, 70, 4], [box2, 82, 10], [palisade19, 52, 0, 4, 0, 28, 32]], size: [96, 32], overhang: 0 },
  kennels: { parts: [[fence1, 2, 0], [fence1, 34, 0], [fence1, 66, 0], [fence9, 0, 8], [fence9, 92, 8], [fLog1, 10, 26], [fLog2, 50, 30], [box1, 70, 24]], size: [96, 52], overhang: 0 },
  arcane_academy: { url: suMageTower, overhang: 4 },
  siege_workshop: { parts: [[vCart2, 0, 10], [fLog1, 54, 30], [fLog2, 70, 40], [fLog3, 90, 28], [vRack, 96, 4]], size: [128, 64], overhang: 0 },
  quoits_pitch: { parts: [[fFence3, 0, 0], [fFence3, 26, 0], [palisade19, 64, 0, 4, 0, 28, 32], [fDirt, 20, 18], [fDirt, 44, 16], [box2, 2, 14]], size: [96, 32], overhang: 0 },
  pleasure_garden: { parts: [[lantern, 4, 0], [lantern, 76, 0], [vBench, 34, 18], [flower1, 8, 50], [flower5, 18, 56], [flower9, 10, 70], [flower1, 24, 78], [flower9, 70, 52], [flower5, 82, 60], [flower1, 74, 74], [flower9, 86, 82], [tuft2, 40, 70], [tuft2, 52, 84], [flower5, 46, 64]], size: [96, 96], overhang: 0, lamps: [[12, 9], [84, 9]] },
  bandstand: { parts: [[tent2, 16, 0], [log1, 0, 46], [log3, 50, 52], [lantern, 0, 4], [lantern, 80, 4]], size: [96, 68], overhang: 0, lamps: [[8, 13], [88, 13]] },
  // the dungeon props: bookshelves for the library, an alchemist's bench for the healer, a plain table for the workbench
  library: { parts: [[dprops, 0, 0, 16, 256, 48, 48], [dprops, 48, 0, 64, 256, 48, 48], [dprops, 96, 0, 112, 256, 48, 48]], size: [144, 48], overhang: 0 },
  healers_hut: { parts: [[dprops, 0, 0, 16, 304, 48, 48]], size: [48, 48], overhang: 0 },
  workbench: { parts: [[dprops, 0, 0, 80, 144, 64, 32]], size: [64, 32], overhang: 0 },
  // the undead pack's graves for the graveyard
  graveyard: { parts: [[grave1, 0, 0], [grave2, 34, 6], [grave3, 66, 0], [grave4, 16, 28], [grave5, 50, 30]], size: [98, 62], overhang: 0 },
  // the Village pack's stone well, its carts, its drying rack and its market awning
  well: { url: vWell, overhang: 2 },
  // (the Simple Summer pack's windmill and timber watchtowers)
  windmill: { url: suWindmill, overhang: 8, turning: { body: suWindmillBody, sail: suWindmillSail, hub: suWindmillHub, at: [84, 85], blades: 4 } },
  watchtower: { url: suWatchtower, overhang: 3 },
  lookout: { url: suLookout, overhang: 3 },
  wagon_circle: { url: vCart2, overhang: 2 },
  drying_rack: { url: vRack, overhang: 0 },
  tanning_rack: { parts: [[vRack, 0, 0], [vRack, 30, 0], [vBucket, 22, 28]], size: [58, 48], overhang: 0 },
  // the medieval workshops: the pack's third timber house with each trade's gear at its door (the base and knights looks)
  smithy: { parts: [[house3, 0, 0], [vAnvil, 122, 132], [vSignAnvil, 6, 118]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  bakery: { parts: [[house3, 0, 0], [fBox1, 118, 136], [doGold, 134, 128], [doGold, 6, 130]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  sawmill: { parts: [[house3, 0, 0], [fLog3, 100, 140], [vLogpile, 130, 116], [fLog1, 2, 128]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  tannery: { parts: [[house3, 0, 0], [doBarrel, 122, 124], [vBucket, 108, 140], [vRack, 2, 110]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  loom: { parts: [[house3, 0, 0], [vRack, 120, 112], [fBox1, 4, 134]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  // the hunters' camp tent with a rack and the bow sign; the barracks' tents behind a palisade and the sword sign
  // the Monster Hunters' Guild (data/hunts.ts): the Glassblower pack's shop with a sword sign and a rack of pelts
  monster_guild: { own: true, parts: [[gbShop, 0, 0], [vSignSword, 0, 64], [vRack, 82, 56]], size: [110, 98], lamps: [[30, 83], [80, 83], [74, 45]] },
  hunters_lodge: { own: true, parts: [[camp3, 0, 4], [vRack, 58, 0], [vSignBow, 90, 18]], size: [114, 44], overhang: 0 },
  // the prisons (data/prisons.ts): a pen of the Village pack's stakes, then the dungeon pack's stonework with its barred
  // gate, a gaol and (greyed as concrete) a prison
  stockade: { own: true, parts: [[palisade05, 0, 0], [palisade05, 32, 0], [palisade05, 64, 0], [palisade05, 0, 30], [palisade05, 64, 30]], size: [96, 62], overhang: 0 },
  gaol: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48], [dwalls, 32, 0, 80, 288, 48, 48], [dwalls, 80, 0, 32, 240, 32, 48]], size: [112, 48], overhang: 0 },
  prison: { own: true, grade: 'concrete', parts: [[dwalls, 0, 0, 32, 240, 32, 48], [dwalls, 32, 0, 32, 240, 32, 48], [dwalls, 64, 0, 80, 288, 48, 48], [dwalls, 112, 0, 32, 240, 32, 48], [dwalls, 144, 0, 32, 240, 32, 48]], size: [176, 48], overhang: 0 },
  barracks: { own: true, parts: [[camp3, 4, 0], [camp3, 64, 6], [vRack, 122, 2], [palisade05, 0, 30], [palisade05, 32, 30], [vSignSword, 110, 36]], size: [152, 62], overhang: 0 },
  // fires in stone rings (the cave pack) for the bloomery and the kiln; the storytellers' fire with logs to sit on
  bloomery: { url: caveFire1, overhang: 0 },
  kiln: { url: caveFire2, overhang: 0 },
  storytellers_circle: {
    parts: [[caveFire1, 32, 8], [fLog1, 0, 56], [fLog3, 44, 72], [fLog2, 102, 18], [fStump, 98, 64]],
    size: [132, 90],
    overhang: 0,
    variants: [{ styles: ['dwarves'], pick: { parts: [[caveTotem, 0, 10], [caveStatue, 52, 0], [caveTotem, 108, 10]], size: [158, 60], overhang: 0 } }],
  },
  // the herb garden: three of the pack's soil tiles with its flowers in them
  herb_garden: { parts: [[soil01, 0, 0], [soil05, 32, 0], [soil07, 64, 0], [fDirt, 50, 4], [flower1, 6, 8], [flower5, 40, 14], [flower9, 70, 6], [tuft2, 20, 20], [flower3, 84, 22], [flower1, 60, 24]], size: [96, 32], overhang: 0 },
  // mine mouths from the rocky-area pack; the deep mine, and the dwarves' every mine, the cave pack's carved gates
  mine: { url: rockyMine1, overhang: 0, variants: [{ styles: ['dwarves'], pick: { url: caveGate, overhang: 0 } }] },
  coal_mine: { url: rockyMine2, overhang: 0, variants: [{ styles: ['dwarves'], pick: { url: caveGate, overhang: 0 } }] },
  deep_mine: { url: caveGate, overhang: 0 },
  // the shaft to the Deep (data/deep.ts): the cave pack's carved gate, a winch's rack and a barrel of the dug ore beside it
  deep_shaft: { parts: [[caveGate, 0, 0], [vRack, 84, 62], [barrel, 96, 88]], size: [124, 110], overhang: 0 },
  // the shrine is the cave pack's skull altar; the phylactery its crystal (green for the liches)
  resurrection_shrine: { url: caveAltar, overhang: 0 },
  // the gods' houses (data/gods.ts): the altar, the crystal tower, the great stone keep
  wayside_shrine: { url: caveAltar, overhang: 0 },
  // the Portal Arch (data/portals.ts): the cave pack's horned gate between two crystals; a rift is its summoning circle
  portal_arch: { parts: [[shard1, 0, 60], [portalGate, 22, 0], [shard2, 104, 64]], size: [168, 126], overhang: 0 },
  portal_rift: { parts: [[portalCircle, 0, 0], [shard1, 32, 8]], size: [128, 118], overhang: 0 },
  // (the Calamity's ward stone: the cave pack's white crystal)
  ward_stone: { url: caveCrystal, overhang: 0 },
  temple: { url: suMageTower, overhang: 4 },
  cathedral: { url: suCastle, overhang: 4 },
  phylactery: { url: caveCrystal, overhang: 0, variants: [{ styles: ['lich'], pick: { url: caveGem, overhang: 0 } }] },
  // the stable: a fence with the cart by it; the school and scriptorium from the dungeon props' furniture
  stable: { parts: [[fence1, 2, 0], [fence1, 34, 0], [fence1, 66, 0], [fence1, 98, 0], [fence9, 0, 8], [fence9, 124, 8], [vCart2, 72, 14], [fLog1, 8, 26]], size: [130, 52], overhang: 0 },
  scriptorium: { parts: [[dpShelf1, 0, 0], [dpShelf2, 24, 0], [dpShelf1, 52, 0], [dpDesk, 78, 6], [dpBooks, 30, 44]], size: [118, 62], overhang: 0 },
  school: { parts: [[dpChair2, 0, 2], [dpTable2, 28, 14], [dpChair1, 94, 2], [dpBooks, 46, 2], [dpBench2, 40, 40]], size: [118, 74], overhang: 0 },
  // glass: the props' tanks; the infirmary and hospital their benches of flasks
  glassworks: { parts: [[dpTank1, 0, 0], [dpTank4, 36, 0], [dpTank2, 74, 14], [dpTank3, 106, 24]], size: [132, 52], overhang: 0 },
  infirmary: { parts: [[dpBench, 0, 16], [dpTank1, 84, 0], [dpDesk, 122, 8]], size: [160, 48], overhang: 0 },
  hospital: { parts: [[dpBench, 0, 14], [dpBench, 82, 14], [dpTank1, 166, 0], [dpTank4, 204, 0]], size: [240, 52], overhang: 0 },
  // the later eras from the futuristic objects pack: tanks, a transformer, consoles, server racks, screens
  power_station: { parts: [[sf26, 0, 10], [sf24, 76, 0], [sf25, 150, 0], [sf19, 230, 30]], size: [262, 78], overhang: 0 },
  refinery: { parts: [[sf24, 0, 0], [sf25, 72, 0], [sf17, 20, 62], [sf18, 100, 64]], size: [150, 80], overhang: 0 },
  oil_derrick: { url: sf25, overhang: 0 },
  factory: { parts: [[sfTube4, 40, 0], [sf26, 0, 28], [sf27, 68, 41], [sf24, 146, 0]], size: [214, 76], overhang: 0 },
  garage: { parts: [[sf27, 0, 0], [sf27, 78, 0]], size: [156, 35], overhang: 0 },
  radio_tower: { url: sfPylon, overhang: 3 },
  drone_hub: { parts: [[sf27, 0, 10], [sf12, 48, 0]], size: [78, 45], overhang: 0 },
  battery_plant: { parts: [[sf24, 0, 0], [sf26, 72, 28]], size: [140, 76], overhang: 0 },
  electronics_plant: { parts: [[sf9, 0, 10], [sf12, 40, 10], [sf13, 70, 6], [sf14, 130, 6], [sf10, 190, 8]], size: [202, 32], overhang: 0 },
  chip_fab: { parts: [[sf15, 0, 0], [sf16, 60, 0], [sf11, 120, 8], [sf12, 136, 8], [sf9, 166, 10]], size: [202, 30], overhang: 0 },
  ai_core: { parts: [[sf9, 0, 8], [sf12, 38, 8], [sf11, 66, 6], [sf10, 82, 6], [sf9, 96, 8]], size: [132, 28], overhang: 0 },
  mission_control: { parts: [[sf19, 40, 0], [sf20, 110, 0], [sf19, 170, 0], [sf13, 0, 22], [sf14, 60, 22], [sf15, 120, 22], [sf16, 180, 22], [sf8, 240, 20]], size: [260, 48], overhang: 0 },
  robot_workshop: { parts: [[sf26, 0, 0], [sf17, 70, 32], [sf12, 80, 6], [sf8, 140, 22]], size: [160, 50], overhang: 0 },
  // the workshops of data/workshops.ts: the Stone Age ones from the camp's racks, fires and crates; the medieval trades
  // in the pack's third timber house with their gear at the door (the base and knights looks); the industrial and later
  // plants from the futuristic objects and the dungeon props; each people's own from the props that suit it
  smokehouse: { parts: [[vRack, 0, 0], [caveFire1, 20, 10], [vRack, 76, 0]], size: [104, 74], overhang: 0 },
  bone_carver: { parts: [[dpDesk, 0, 0], [dpChair1, 40, 0], [fBox1, 64, 24]], size: [82, 43], overhang: 0 },
  basketry: { parts: [[doCrates, 0, 8], [fBox1, 48, 16], [fBox1, 66, 8], [vRack, 86, 0]], size: [114, 42], overhang: 0 },
  brewery: { parts: [[house3, 0, 0], [doBarrel, 118, 124], [doJug, 2, 126]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  tailor: { parts: [[house3, 0, 0], [vRack, 120, 112], [fBox1, 6, 136]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  jeweller: { parts: [[house3, 0, 0], [doGold, 134, 130], [doChest, 6, 132]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  cooper: { parts: [[house3, 0, 0], [doBarrel, 118, 124], [doBarrel, 2, 126], [fLog1, 128, 112]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  apothecary: { parts: [[house3, 0, 0], [doJug, 122, 124], [vBucket, 8, 136]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  chandlery: { parts: [[house3, 0, 0], [lantern, 128, 112], [lantern, 6, 112]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  dyeworks: { parts: [[house3, 0, 0], [vBucket, 120, 138], [vBucket, 134, 136], [vRack, 2, 110]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  clockmaker: { parts: [[house3, 0, 0], [doGold, 134, 130], [sign, 4, 128]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
  print_shop: { parts: [[dpShelf1, 0, 0], [dpDesk, 26, 4], [dpBooks, 66, 22], [dpShelf2, 94, 0]], size: [120, 44], overhang: 0 },
  cannery: { parts: [[sf24, 0, 0], [doCrates, 72, 44], [sf17, 72, 20]], size: [138, 76], overhang: 0 },
  textile_mill: { parts: [[sf26, 0, 0], [vRack, 72, 4], [vRack, 104, 4], [sf17, 72, 48]], size: [138, 64], overhang: 0 },
  appliance_plant: { parts: [[sf13, 0, 6], [sf14, 60, 6], [sf9, 120, 12], [sf12, 158, 14]], size: [184, 32], overhang: 0 },
  pharmacy: { parts: [[dpTank2, 0, 4], [dpDesk, 34, 0], [dpTank3, 74, 12]], size: [100, 40], overhang: 0 },
  bio_lab: { parts: [[dpTank1, 0, 0], [dpTank4, 38, 0], [sf12, 78, 30]], size: [104, 50], overhang: 0 },
  nanoforge: { parts: [[sf15, 0, 0], [sf11, 60, 8], [sf10, 76, 10], [sf8, 90, 2]], size: [110, 26], overhang: 0 },
  blood_cellar: { parts: [[doBarrel, 0, 0], [doBarrel, 28, 2], [doJug, 58, 0]], size: [84, 32], overhang: 0 },
  bone_forge: { parts: [[caveTotem, 0, 10], [caveFire2, 48, 0], [caveTotem, 116, 10]], size: [166, 64], overhang: 0 },
  gem_cutter: { parts: [[caveGem, 0, 10], [dpDesk, 46, 0], [caveGem, 86, 10]], size: [130, 56], overhang: 0 },
  herb_press: { parts: [[soil05, 0, 0], [soil07, 32, 0], [flower1, 6, 8], [flower5, 40, 14], [flower9, 20, 20], [flower3, 50, 6], [fBox1, 46, 14]], size: [64, 32], overhang: 0 },
  pearl_works: { parts: [[dpDesk, 0, 0], [vBucket, 40, 18], [doChest, 58, 20]], size: [78, 40], overhang: 0 },
  felt_works: { parts: [[vRack, 0, 0], [vRack, 30, 0], [fBox1, 62, 22]], size: [80, 42], overhang: 0 },
  glamour_loom: { parts: [[vRack, 0, 0], [flower9, 32, 14], [flower3, 44, 24], [flower1, 36, 30]], size: [54, 42], overhang: 0 },
  alembic: { parts: [[dpTank3, 0, 10], [dpTank2, 28, 0], [dpTank3, 62, 10]], size: [88, 37], overhang: 0 },
  assembler: { parts: [[sf12, 0, 10], [dpDesk, 30, 0], [sf8, 70, 10]], size: [90, 40], overhang: 0 },
  armourer: { parts: [[house3, 0, 0], [vAnvil, 122, 132], [vSignShield, 6, 118]], size: [160, 160], smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] }, // (the knights' alone, a timber look)
  pelt_house: { parts: [[vRack, 0, 0], [vRack, 30, 0], [vRack, 60, 0]], size: [88, 42], overhang: 0 },
  granary: { parts: [[doCrates, 0, 0], [doCrates, 0, 24], [doCrates, 46, 12], [fBox1, 94, 20]], size: [112, 48], overhang: 0 },
  theatre: { url: house4, styles: TIMBER, smoke: [[61, 10]], lamps: [[97, 87], [114, 122]] },
  bathhouse: { parts: [[house3, 0, 0], [vBucket, 122, 138], [vBucket, 8, 138]], size: [160, 160], styles: TIMBER, smoke: [[37, 0]], lamps: [[59, 86], [89, 86]] },
};
/** How far a picture hangs over its footprint, each side (px), unless the pick says. */
const OVERHANG = 6;

const images = new Map<string, HTMLImageElement | null>();
const loading = new Set<string>();
const arts = new Map<string, PixelArt>();
const listeners = new Set<() => void>();

/** Called when a picture has loaded (the map draws its buildings again). */
export function onPackArt(cb: () => void): void {
  listeners.add(cb);
}

function fetch(url: string): void {
  if (loading.has(url)) return;
  loading.add(url);
  loadImage(url).then(
    (im) => {
      images.set(url, im);
      for (const cb of listeners) cb();
    },
    () => images.set(url, null),
  );
}

/** The pack picture for a building `w` cells wide in a look, scaled to its footprint; null when there is none (or
 *  it hasn't loaded yet). */
/** Whether a pick suits a look. */
const suits = (pick: Pick, style: string) => (pick.styles ? pick.styles.has(style) : !(pick.own && OWN_TENTS.has(style)));

/** The pick's source picture (an image, or its parts laid together), or null while something is still loading. */
function source(pick: Pick, id: number): { draw: (g: CanvasRenderingContext2D, scale: number) => void; w: number; h: number } | null {
  if (pick.of?.length) return source(pick.of[id % pick.of.length], id);
  const urls = pick.parts ? pick.parts.map((p) => p[0]) : [pick.any ? pick.any[id % pick.any.length] : pick.url!];
  let waiting = false;
  for (const u of urls) {
    const im = images.get(u);
    if (im === undefined) {
      fetch(u);
      waiting = true;
    } else if (!im) return null;
  }
  if (waiting) return null;
  if (pick.parts) {
    const [w, h] = pick.size!;
    return {
      w,
      h,
      draw: (g, k) => {
        for (const part of pick.parts!) {
          const im = images.get(part[0])!;
          if (part.length === 7) g.drawImage(im, part[3], part[4], part[5], part[6], part[1] * k, part[2] * k, part[5] * k, part[6] * k);
          else g.drawImage(im, part[1] * k, part[2] * k, im.naturalWidth * k, im.naturalHeight * k);
        }
      },
    };
  }
  const im = images.get(urls[0])!;
  return { w: im.naturalWidth, h: im.naturalHeight, draw: (g, k) => g.drawImage(im, 0, 0, im.naturalWidth * k, im.naturalHeight * k) };
}

/** How the shops' timber pictures are recoloured for the other peoples (none of the packs has their own shop
 *  fronts): how much of the colour is taken out (0..1), the colour laid over what's left, and the brightness. The
 *  liches' shops go grey-green and dim, the Court's blood-dark, the machines' steel, the shore's sea-washed... */
const GRADES: Record<string, { grey: number; tint: number; light: number }> = {
  // (materials, whatever the look: the stone wall's stonework as brick, concrete and a force field)
  brick: { grey: 0.45, tint: 0xe08a6a, light: 1.0 },
  concrete: { grey: 0.95, tint: 0xd8d8d0, light: 1.12 },
  force: { grey: 0.9, tint: 0x80d8ff, light: 1.25 },
  lich: { grey: 0.8, tint: 0x9ab0a0, light: 0.82 },
  vampire: { grey: 0.65, tint: 0xc08a94, light: 0.78 },
  robot: { grey: 0.85, tint: 0xa8c0d8, light: 0.95 },
  merfolk: { grey: 0.5, tint: 0x9ad8d0, light: 1.02 },
  nomads: { grey: 0.25, tint: 0xf0d8a8, light: 1.02 },
  nomads_city: { grey: 0.3, tint: 0xf0c890, light: 1.0 },
  druid: { grey: 0.35, tint: 0xb8e0a0, light: 0.95 },
  fae: { grey: 0.4, tint: 0xe0c0f0, light: 1.05 },
  dwarves: { grey: 0.55, tint: 0xd0c0a8, light: 0.9 },
  werewolf: { grey: 0.45, tint: 0xc8a888, light: 0.85 },
  alchemists: { grey: 0.45, tint: 0xd0b0e0, light: 0.95 },
};
const graded = new Map<string, Pick>();

/** The pick for a building in a look: a variant for that look first, else the pick itself where it suits; a venue's
 *  timber picture recoloured (`GRADES`) for a look it doesn't suit. */
function pickFor(def: string, style: string): Pick | null {
  const pick = PICKS[def];
  if (!pick) return null;
  const v = pick.variants?.find((x) => x.styles.includes(style));
  if (v) return v.pick;
  if (suits(pick, style)) return pick;
  // (another look's picture, recoloured for this one: the timber houses, trades and walls in every people's colours;
  // the merfolk keep their stilt huts, which the painter draws)
  if (GRADES[style] && !(style === 'merfolk' && BUILDING_BY_ID[def]?.housing)) {
    const key = `${def}|${style}`;
    let g = graded.get(key);
    if (!g) graded.set(key, (g = { ...pick, styles: undefined, own: undefined, grade: pick.grade ?? style }));
    return g;
  }
  return null;
}

/** Recolours a drawn picture by its look's grade (`GRADES`). */
function regrade(g: CanvasRenderingContext2D, w: number, h: number, style: string): void {
  const gr = GRADES[style];
  if (!gr) return;
  const im = g.getImageData(0, 0, w, h);
  const d = im.data;
  const tr = ((gr.tint >> 16) & 255) / 255;
  const tg = ((gr.tint >> 8) & 255) / 255;
  const tb = (gr.tint & 255) / 255;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const r = d[i], gg = d[i + 1], b = d[i + 2];
    const y = 0.3 * r + 0.59 * gg + 0.11 * b;
    const k = gr.light;
    d[i] = Math.min(255, (r + (y - r) * gr.grey) * (1 - gr.grey + gr.grey * tr) * k);
    d[i + 1] = Math.min(255, (gg + (y - gg) * gr.grey) * (1 - gr.grey + gr.grey * tg) * k);
    d[i + 2] = Math.min(255, (b + (y - b) * gr.grey) * (1 - gr.grey + gr.grey * tb) * k);
  }
  g.putImageData(im, 0, 0);
}

/** A building's turning sails (the windmill's), scaled as its picture is and recoloured for the look: the blade
 *  (pointing up, its foot at the hub), the hub, where the hub is (px from the picture's top left) and how many blades;
 *  null for a building without, or while a picture loads. */
export interface Turning {
  sail: Texture;
  hub: Texture;
  x: number;
  y: number;
  scale: number;
  blades: number;
}
const turnings = new Map<string, Turning>();
export function packTurning(def: string, w: number, style: string): Turning | null {
  const pick = pickFor(def, style);
  const t = pick?.turning;
  if (!pick || !t) return null;
  const key = `${def}|${style}|${w}`;
  const had = turnings.get(key);
  if (had) return had;
  const ims = [t.body, t.sail, t.hub].map((u) => images.get(u));
  if (ims.some((im) => im === undefined)) {
    for (const u of [t.body, t.sail, t.hub]) if (images.get(u) === undefined) fetch(u);
    return null;
  }
  if (ims.some((im) => !im)) return null;
  const [body, sail, hub] = ims as HTMLImageElement[];
  const scale = (w * CELL + (pick.overhang ?? OVERHANG) * 2) / body.naturalWidth;
  // (each piece scaled on the fine grid and recoloured as the picture is)
  const piece = (im: HTMLImageElement): Texture => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(im.naturalWidth * scale * FINE));
    c.height = Math.max(1, Math.round(im.naturalHeight * scale * FINE));
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(im, 0, 0, c.width, c.height);
    if (pick.grade) regrade(g, c.width, c.height, pick.grade);
    return new Texture({ source: new CanvasSource({ resource: c, resolution: FINE }) });
  };
  const out = { sail: piece(sail), hub: piece(hub), x: t.at[0] * scale, y: t.at[1] * scale, scale, blades: t.blades };
  turnings.set(key, out);
  return out;
}

/** Whole buildings seen from outside (houses, shop fronts, tents, towers, the windmill): never a room's furnishings. */
const EXTERIORS = new Set([suHouse, ttLong, ttGable, house1, house2, house3, house4, gbHouse, gbShop, tent2, rockyTipi1, rockyTipi2, rockyYurt1, rockyYurt2, suWindmill, suWatchtower, suLookout, suCastle, suMageTower, suRoundCastle, suTent]);
const urlsOf = (p: Pick): string[] => [p.url, ...(p.any ?? []), ...(p.parts ?? []).map((x) => x[0]), ...(p.of ?? []).flatMap(urlsOf)].filter((u): u is string => !!u);

/** A building's pack picture as a castle's or a hold's room furnishings: only a picture of things (racks, benches, a
 *  well, a fire pit), never the outside of a whole building (a trade's timber house stood inside a hall). */
export function packArtIndoors(def: string, w: number, style: string, id = 0): PixelArt | null {
  const pick = pickFor(def, style);
  if (!pick || urlsOf(pick).some((u) => EXTERIORS.has(u))) return null;
  return packArt(def, w, style, id);
}

export function packArt(def: string, w: number, style: string, id = 0, join?: Join, moving = false): PixelArt | null {
  let pick = pickFor(def, style);
  if (!pick) return null;
  // (on the map, a windmill's body alone: its sails are drawn turning over it, packTurning)
  if (moving && pick.turning) return pickArt({ ...pick, url: pick.turning.body, turning: undefined }, w, `${def}|${style}|body`, id);
  const joined = join ? pick.joins?.[join] ?? (join === 've' ? pick.joins?.v : undefined) : undefined;
  if (joined) pick = { ...joined, grade: joined.grade ?? pick.grade };
  // (one of several by the building's id)
  let which = '';
  if (pick.of?.length) {
    const i = id % pick.of.length;
    which = `#${i}`;
    pick = { ...pick.of[i], grade: pick.of[i].grade ?? pick.grade };
  }
  return pickArt(pick, w, `${def}|${style}|${join ?? ''}${which}`, id);
}

/** Any pick's picture, scaled to `w` cells (the castle's furnishings use this too); `key` names it for the cache. */
export function pickArt(pick: Pick, w: number, key0: string, id = 0): PixelArt | null {
  const src = source(pick, id);
  if (!src) return null;
  const key = `${key0}|${w}|${pick.any ? id % pick.any.length : 0}`;
  let art = arts.get(key);
  if (!art) {
    // (a turned picture: its source height stands across the cells)
    const sw = pick.rotate ? src.h : src.w;
    const sh = pick.rotate ? src.w : src.h;
    const target = w * CELL + (pick.overhang ?? OVERHANG) * 2;
    const scale = target / sw;
    const width = Math.round(sw * scale);
    const height = Math.round(sh * scale);
    const c = document.createElement('canvas');
    c.width = width * FINE;
    c.height = height * FINE;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    if (pick.rotate) {
      g.translate(c.width, 0);
      g.rotate(Math.PI / 2);
    }
    src.draw(g, scale * FINE);
    if (pick.grade) {
      g.setTransform(1, 0, 0, 1, 0, 0);
      regrade(g, c.width, c.height, pick.grade);
    }
    // (the first opaque row of each art column, for hit-testing, as the painter records it)
    const data = g.getImageData(0, 0, c.width, c.height).data;
    const tops = new Int16Array(width);
    for (let x = 0; x < width; x++) {
      let top = height;
      for (let y = 0; y < height && top === height; y++) {
        const fx = x * FINE;
        const fy = y * FINE;
        if (data[(fy * c.width + fx) * 4 + 3] > 40 || data[(fy * c.width + fx + 1) * 4 + 3] > 40) top = y;
      }
      tops[x] = top;
    }
    art = { texture: new Texture({ source: new CanvasSource({ resource: c, resolution: FINE }) }), width, height, tops };
    if (pick.smoke) art.smoke = pick.smoke.map(([x, y]) => ({ x: x * scale, y: y * scale }));
    if (pick.lamps) art.lights = pick.lamps.map(([x, y]) => ({ x: x * scale, y: y * scale, r: 9 * scale + 3, color: WINDOW_GLOW }));
    arts.set(key, art);
  }
  return art;
}

/** The street furniture the pack lends a finished pack-drawn building: a lantern post, a barrel, a crate, a cart or a
 *  signboard at its front corners, picked by the building's id. */
const DRESSING = [lantern, barrel, crate, sign, cart, barrel, lantern, crate];

export interface Dressing {
  texture: Texture;
  /** Its foot's offset from the building's bottom-left corner (world px) and its size (px). */
  dx: number;
  dy: number;
  w: number;
  h: number;
  /** A colour laid over it (the awning's cloth in the shop's colours). */
  tint?: number;
  /** Frames it plays through, stirring in the wind (a venue's banner): the map turns them. */
  frames?: Texture[];
}

const dressTex = new Map<string, Texture>();

/* ------------------------------------------------------------ the venues' banners */

/** A venue's banner as it stands on the map (px), and the Fields pack's flag it is made from: six frames of 32x64,
 *  the cloth stirring on its pole (`FLAG_FRAMES`). */
const BANNER_W = 19;
const BANNER_H = 38;
const FLAG_W = 32;
const FLAG_H = 64;
export const FLAG_FRAMES = 6;
/** The flag's own colours: its cloth, the cloth's light, the trim and the trim's shine (recoloured per shop). */
const FLAG_CLOTH = 0x405273;
const FLAG_CLOTH_LIGHT = 0x6c81a1;
const FLAG_TRIM = 0xbbc3d0;
const FLAG_SHINE = 0xf1f6f0;
const banners = new Map<string, Texture[]>();
/** A colour `k` of the way toward white. */
const toWhite = (c: number, k: number) => {
  const ch = (v: number) => Math.round(v + (255 - v) * k);
  return (ch((c >> 16) & 255) << 16) | (ch((c >> 8) & 255) << 8) | ch(c & 255);
};
/** A venue's banner: the Fields pack's flag, its cloth and trim in the shop's colours, with the shop's emblem on it (a
 *  sword, a shield, a chair, a bottle; scales for the general store, a tankard for the tavern), six frames of it
 *  stirring in the wind (the map turns them faster as the wind rises). Null for anything that isn't a venue, or while
 *  the flag loads. */
function bannerOf(def: string): Texture[] | null {
  const line = lineOfDef(def);
  const venue = venueOfDef(def);
  if (!venue) return null;
  const kind = line ?? venue;
  const had = banners.get(kind);
  if (had) return had;
  const flag = images.get(fieldsFlag);
  if (flag === undefined) {
    fetch(fieldsFlag);
    return null;
  }
  if (!flag) return null;
  const l = line ? LINES[line] : null;
  const cloth = l ? l.cloth : venue === 'tavern' ? 0x6a3a22 : 0x2e6a3a;
  const trim = l ? l.trim : venue === 'tavern' ? 0xf0d080 : 0xf0e0a0;
  const swap = new Map<number, number>([
    [FLAG_CLOTH, cloth],
    [FLAG_CLOTH_LIGHT, toWhite(cloth, 0.28)],
    [FLAG_TRIM, trim],
    [FLAG_SHINE, toWhite(trim, 0.6)],
  ]);
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const frames: Texture[] = [];
  for (let f = 0; f < FLAG_FRAMES; f++) {
    const c = document.createElement('canvas');
    c.width = FLAG_W;
    c.height = FLAG_H;
    const g = c.getContext('2d')!;
    g.imageSmoothingEnabled = false;
    g.drawImage(flag, f * FLAG_W, 0, FLAG_W, FLAG_H, 0, 0, FLAG_W, FLAG_H);
    // (the cloth and trim in the shop's colours, and where the cloth lies in this frame for the emblem)
    const im = g.getImageData(0, 0, FLAG_W, FLAG_H);
    const d = im.data;
    let x0 = FLAG_W;
    let x1 = 0;
    let y0 = FLAG_H;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const was = (d[i] << 16) | (d[i + 1] << 8) | d[i + 2];
      const to = swap.get(was);
      if (to === undefined) continue;
      d[i] = (to >> 16) & 255;
      d[i + 1] = (to >> 8) & 255;
      d[i + 2] = to & 255;
      if (was === FLAG_CLOTH) {
        const x = (i / 4) % FLAG_W;
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, Math.floor(i / 4 / FLAG_W));
      }
    }
    g.putImageData(im, 0, 0);
    // the emblem, in the trim's colour, on the middle of the cloth (drawn on a grid ten wide, a little larger)
    const e = hex(trim);
    const back = hex(cloth);
    const k = 1.4;
    const ox = (x0 + x1 + 1) / 2 - 5 * k;
    const oy = y0 + 2;
    const px = (x: number, y: number, w: number, h: number, col: string) => {
      g.fillStyle = col;
      g.fillRect(Math.round(ox + x * k), Math.round(oy + y * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    };
    switch (kind) {
      case 'weapons': // a sword
        px(4, 1, 2, 11, e);
        px(2, 9, 6, 1, e);
        px(4, 12, 2, 2, '#a07030');
        break;
      case 'armour': // a shield
        px(2, 2, 6, 6, e);
        px(3, 8, 4, 2, e);
        px(4, 10, 2, 1, e);
        px(4, 3, 1, 5, back);
        break;
      case 'furniture': // a chair
        px(2, 2, 2, 10, e);
        px(2, 7, 6, 2, e);
        px(6, 9, 2, 4, e);
        px(2, 11, 1, 2, e);
        break;
      case 'medicine': // a bottle
        px(4, 1, 2, 2, e);
        px(3, 3, 4, 2, e);
        px(2, 5, 6, 7, e);
        px(3, 7, 2, 3, back);
        break;
      case 'tavern': // a tankard
        px(2, 3, 5, 9, e);
        px(7, 5, 2, 5, e);
        px(8, 6, 1, 3, back);
        px(2, 2, 5, 1, '#f8f8f0');
        break;
      default: // scales
        px(4, 1, 2, 10, e);
        px(1, 3, 8, 1, e);
        px(0, 6, 3, 2, e);
        px(7, 6, 3, 2, e);
        px(2, 11, 6, 1, e);
    }
    const tex = Texture.from(c);
    tex.source.scaleMode = 'nearest';
    frames.push(tex);
  }
  banners.set(kind, frames);
  return frames;
}

/** What stands by a building `w` cells wide (its picture from the pack) with this id, or nothing yet. */
/** Each venue's storefront, whatever the look: an awning in its colours (the pack's cloth on its pole, tinted) right of
 *  the door, and the goods of its trade set out under it. Offsets in px from the door (the footprint's bottom middle),
 *  right and down; the awning stands just behind the goods. */
const STOREFRONT: Record<string, { awning?: number; goods: [string, number, number][] }> = {
  trading_post: { goods: [[gbBarrow, 14, 4]] },
  general_store: { awning: 0x3e8a4a, goods: [[gbCrates, 14, 3], [gbSacks, 36, 4]] },
  emporium: { awning: 0xc09a30, goods: [[gbCrates, 14, 3], [apVase, 37, 4], [gbBarrels, 52, 4]] },
  fireside_inn: { goods: [[doBarrel, 16, 4]] },
  tavern: { goods: [[dpBench, 16, 5], [doBarrel, 98, 4]] },
  furniture_store: { awning: 0x7a5230, goods: [[dpChair1, 12, 4], [dpChair2, 34, 4]] },
  weapon_store: { awning: 0x8a2020, goods: [[vRack, 12, 3], [vAnvil, 40, 5]] },
  armour_store: { awning: 0x2c4a7a, goods: [[vHelm, 13, 4], [doChest, 36, 5]] },
  apothecary_shop: { awning: 0x2e6a3a, goods: [[apShelf, 10, 3], [apPlant, 46, 5]] },
};
/** The awning's foot left of where its goods start, and how far in front of the wall it stands (px). */
const AWNING_BACK = 4;
const AWNING_DY = 2;

/** A pack image as a texture at its own size, once loaded (undefined while it loads; null if it failed). */
function texOf(url: string): Texture | undefined | null {
  const im = images.get(url);
  if (im === undefined) {
    fetch(url);
    return undefined;
  }
  if (!im) return null;
  let tex = dressTex.get(url);
  if (!tex) {
    tex = Texture.from(im);
    tex.source.scaleMode = 'nearest';
    dressTex.set(url, tex);
  }
  return tex;
}

export function packDressing(def: string, id: number, w: number, style: string): Dressing[] {
  const out: Dressing[] = [];
  // (every shop and tavern hangs its banner out front, by the door, whatever the look: the owner's ask)
  const banner = bannerOf(def);
  if (banner) out.push({ texture: banner[0], frames: banner, dx: (w * CELL) / 2 - BANNER_W - 10, dy: 1, w: BANNER_W, h: BANNER_H });
  // (its storefront: the awning and the goods of its trade, right of the door)
  const front = STOREFRONT[def];
  if (front) {
    const door = (w * CELL) / 2;
    if (front.awning !== undefined) {
      const tex = texOf(gbAwning);
      if (tex) out.push({ texture: tex, dx: door + (front.goods[0]?.[1] ?? 12) - AWNING_BACK, dy: AWNING_DY, w: tex.width, h: tex.height, tint: front.awning });
    }
    for (const [url, gx, gy] of front.goods) {
      const tex = texOf(url);
      if (tex) out.push({ texture: tex, dx: door + gx, dy: gy + AWNING_DY, w: tex.width, h: tex.height });
    }
  }
  const pick = pickFor(def, style);
  if (!pick || pick.styles !== TIMBER || front) return out;
  const corners: [number, number][] = [
    [-2, 0],
    [w * CELL + 2, 0],
  ];
  corners.forEach(([dx, dy], i) => {
    const h = (id * 2654435761 + i * 40503) >>> 0;
    if ((h % 7) < 3) return; // (not every corner has something)
    const url = DRESSING[(h >>> 8) % DRESSING.length];
    const tex = texOf(url);
    if (!tex) return;
    out.push({ texture: tex, dx: dx - (i ? 0 : tex.width), dy, w: tex.width, h: tex.height });
  });
  return out;
}

/** Whether a building has a pack picture in a look (the audit of what's still painted: test/packCoverage.test.ts). */
export const pickCovered = (def: string, style: string): boolean => !!pickFor(def, style);
