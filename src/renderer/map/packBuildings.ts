// Craftpix's Village tileset (the top-down tower-defence one, also the raid map's tower pads) lends the medieval
// town its houses and market awnings on the map: half-timbered houses for the cottage, the row houses and the
// inn, striped awnings for the trading post and the stalls. Each picture is scaled to its building's footprint (a
// little overhang each side), pixel for pixel on the fine grid, and stands in for the code-drawn picture in the
// looks it suits (the base town and the knights). Until a picture has loaded, the code-drawn one stands.

import { CanvasSource, Texture } from 'pixi.js';
import { lineOfDef, venueOfDef } from '../../shared/data/shop';
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
import palisade01 from '../art/village/palisade01.png';
import palisade02 from '../art/village/palisade02.png';
import palisade03 from '../art/village/palisade03.png';
import palisade36 from '../art/village/palisade36.png';
import palisade37 from '../art/village/palisade37.png';
import palisade14 from '../art/village/palisade14.png';
import palisade19 from '../art/village/palisade19.png';
import palisade21 from '../art/village/palisade21.png';
import palisade24 from '../art/village/palisade24.png';
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
import suWatchtower from '../art/packs/su_watchtower.png';
import suLookout from '../art/packs/su_lookout.png';
import suCastle from '../art/packs/su_castle.png';
import suMageTower from '../art/packs/su_magetower.png';
import sfPylon from '../art/packs/sf_pylon.png';
import sf27 from '../art/packs/sf_27.png';
import sfTube4 from '../art/packs/sf_tube4.png';

/** A pack picture for a building: one image, or several laid together (`parts`: image, x, y in source px, on a
 *  canvas `size`), hanging `overhang` px over the footprint each side, in the looks it suits (`styles`; none: all
 *  but the origins with their own tents and halls). */
/** A part: an image at x, y (source px), the whole of it or a crop of it (sx, sy, sw, sh). */
type Part = [string, number, number] | [string, number, number, number, number, number, number];
export interface Pick {
  url?: string;
  parts?: Part[];
  size?: [number, number];
  overhang?: number;
  styles?: Set<string>;
  /** Several pictures to choose from by the building's id. */
  any?: string[];
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
}
/** How a wall piece joins the pieces about it (map/mapView.ts `wallJoin`). */
export type Join = 'h' | 'v' | 'nw' | 'ne' | 'sw' | 'se' | 'end';
/** The glow of a pack house's window (the painter's window colour). */
const WINDOW_GLOW = 0xf0d890;
/** The looks the pack's timber houses suit. */
const TIMBER = new Set(['town', 'settlers', 'knights']);
/** The looks whose origins have tents and walls of their own (originStyles.ts): the pack's tents and walls (`own`)
 *  are kept from them; the shared props (the well, racks, fire pits, benches, plants) suit every look. */
const OWN_TENTS = new Set(['vampire', 'lich', 'robot', 'nomads', 'merfolk', 'nomads_city']);
/** The nomads' looks: the rocky-area pack's tipis and yurts stand for their homes. */
const NOMAD = ['nomads', 'nomads_city'];
/** The looks whose halls are the Simple Summer pack's stone keep, and its crystal-crowned mage tower. */
const KEEP_HALL = ['lich', 'werewolf'];
const MAGE_HALL = ['alchemists', 'fae'];
const hallVariants = (): { styles: string[]; pick: Pick }[] => [
  { styles: KEEP_HALL, pick: { url: suCastle, overhang: 4 } },
  { styles: MAGE_HALL, pick: { url: suMageTower, overhang: 4 } },
];
const PICKS: Record<string, Pick> = {
  cottage: { url: house1, styles: TIMBER, smoke: [[22, 7]], lamps: [[81, 51], [39, 85], [81, 85]], variants: [{ styles: NOMAD, pick: { url: rockyYurt2, overhang: 6, smoke: [[40, 1]] } }] },
  rowhouse: { url: house2, styles: TIMBER, smoke: [[26, 31]], lamps: [[80, 74], [110, 74], [132, 74], [37, 106], [80, 106]], variants: [{ styles: NOMAD, pick: { parts: [[rockyYurt1, 0, 0], [rockyYurt2, 84, 4]], size: [164, 82], overhang: 6, smoke: [[39, 1], [124, 5]] } }] },
  // the shops and the tavern: the Glassblower's Workshop pack's shop fronts (the big red-roofed house with its chimney
  // for the inn and the emporium, the smaller shop for the rest), with the pack's barrels, crates and signpost at the
  // door; each venue's banner is hung out front by `packDressing`
  fireside_inn: { parts: [[gbHouse, 0, 0], [gbBarrels, 104, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  tavern: { parts: [[gbHouse, 0, 0], [gbBarrels, 104, 118], [gbSignpost, 2, 112]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  trading_post: { url: gbShop, styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  market: { url: tent2, styles: TIMBER },
  general_store: { parts: [[gbShop, 0, 0], [gbCrates, 2, 118]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  emporium: { parts: [[gbHouse, 0, 0], [gbCrates, 120, 122], [gbBarrels, 2, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]] },
  furniture_store: { parts: [[gbShop, 0, 0], [gbCrates, 84, 118]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  weapon_store: { parts: [[gbShop, 0, 0], [vSignSword, 2, 118]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  armour_store: { parts: [[gbShop, 0, 0], [vSignShield, 2, 118]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  apothecary_shop: { parts: [[gbShop, 0, 0], [gbBarrels, 80, 120]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]] },
  // the first homes: the nomads' tipis and yurts; everyone else's are the top-down painter's huts and the longhouse
  // (the owner's call: tents are a nomad thing, not a settler's house). `styles` NOMAD alone, so the rest get no pick.
  lean_to: { styles: new Set(NOMAD), url: rockyTipi2, overhang: 4, smoke: [[29, 1]] },
  hide_tent: { styles: new Set(NOMAD), url: rockyTipi1, overhang: 4, smoke: [[38, 2]] },
  longhouse: { styles: new Set(NOMAD), url: rockyYurt1, overhang: 8, smoke: [[39, 1]] },
  // the great halls: the Glassblower pack's big house for the elder lodge and the town hall (the painter's hall shape
  // was clunky), its shop with the shield sign for the trophy hall
  elder_lodge: { parts: [[gbHouse, 0, 0], [gbSignpost, 2, 112], [gbBarrels, 104, 118]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]], variants: hallVariants() },
  town_hall: { parts: [[gbHouse, 0, 0], [gbCrates, 120, 122]], size: [142, 160], styles: TIMBER, smoke: [[40, 6]], lamps: [[48, 96], [100, 96]], variants: hallVariants() },
  trophy_hall: { parts: [[gbShop, 0, 0], [vSignShield, 2, 118], [gbCrates, 84, 118]], size: [105, 156], styles: TIMBER, smoke: [[60, 2]], lamps: [[36, 100], [72, 100]], variants: hallVariants() },
  // the stockpile: crates and logs heaped together
  stockpile: { parts: [[log3, 2, 14], [box1, 10, 4], [box2, 28, 8], [log1, 44, 6], [box1, 62, 10], [box2, 76, 2]], size: [96, 28], overhang: 0 },
  // the Village pack's palisade stakes and gate
  palisade_wall: {
    own: true,
    any: [palisade01, palisade02, palisade03],
    overhang: 0,
    // (a run down a column is the pack's post pair; a corner or a lone piece a single post)
    joins: { v: { any: [palisade24, palisade14], overhang: 0 }, nw: { url: palisade19, overhang: 0 }, ne: { url: palisade19, overhang: 0 }, sw: { url: palisade19, overhang: 0 }, se: { url: palisade19, overhang: 0 }, end: { url: palisade21, overhang: 0 } },
  },
  palisade_gate: { own: true, parts: [[palisade36, 0, 0], [palisade37, 32, 0]], size: [64, 32], overhang: 0, joins: { v: { parts: [[palisade36, 0, 0], [palisade37, 32, 0]], size: [64, 32], overhang: 0, rotate: 90 } } },
  // the dungeon pack's stonework: a stretch of wall, an arched gate with its door
  stone_wall: { own: true, parts: [[dwalls, 0, 0, 32, 240, 32, 48]], size: [32, 48], overhang: 0 },
  stone_gate: { own: true, parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  brick_gate: { own: true, parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  concrete_gate: { own: true, parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, joins: { v: { parts: [[dwalls, 0, 0, 80, 288, 48, 48]], size: [48, 48], overhang: 0, rotate: 90 } } },
  // the dungeon props: bookshelves for the library, an alchemist's bench for the healer, a plain table for the workbench
  library: { parts: [[dprops, 0, 0, 16, 256, 48, 48], [dprops, 48, 0, 64, 256, 48, 48], [dprops, 96, 0, 112, 256, 48, 48]], size: [144, 48], overhang: 0 },
  healers_hut: { parts: [[dprops, 0, 0, 16, 304, 48, 48]], size: [48, 48], overhang: 0 },
  workbench: { parts: [[dprops, 0, 0, 80, 144, 64, 32]], size: [64, 32], overhang: 0 },
  // the undead pack's graves for the graveyard
  graveyard: { parts: [[grave1, 0, 0], [grave2, 34, 6], [grave3, 66, 0], [grave4, 16, 28], [grave5, 50, 30]], size: [98, 62], overhang: 0 },
  // the Village pack's stone well, its carts, its drying rack and its market awning
  well: { url: vWell, overhang: 2 },
  // (the Simple Summer pack's windmill and timber watchtowers)
  windmill: { url: suWindmill, overhang: 8 },
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
  hunters_lodge: { own: true, parts: [[camp3, 0, 4], [vRack, 58, 0], [vSignBow, 90, 18]], size: [114, 44], overhang: 0 },
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
  // the shrine is the cave pack's skull altar; the phylactery its crystal (green for the liches)
  resurrection_shrine: { url: caveAltar, overhang: 0 },
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

/** The pick for a building in a look: a variant for that look first, else the pick itself where it suits. */
function pickFor(def: string, style: string): Pick | null {
  const pick = PICKS[def];
  if (!pick) return null;
  const v = pick.variants?.find((x) => x.styles.includes(style));
  if (v) return v.pick;
  return suits(pick, style) ? pick : null;
}

export function packArt(def: string, w: number, style: string, id = 0, join?: Join): PixelArt | null {
  let pick = pickFor(def, style);
  if (!pick) return null;
  if (join && pick.joins?.[join]) pick = pick.joins[join]!;
  return pickArt(pick, w, `${def}|${style}|${join ?? ''}`, id);
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
}

const dressTex = new Map<string, Texture>();

/* ------------------------------------------------------------ the venues' banners */

const BANNER_W = 16;
const BANNER_H = 36;
const banners = new Map<string, Texture>();
/** A venue's banner: a pole with a cloth hanging from its crossbar in the shop's colours, with its emblem on it (a
 *  sword, a shield, a chair, a bottle; scales for the general store, a tankard for the tavern). Null for anything
 *  that isn't a venue. */
function bannerOf(def: string): Texture | null {
  const line = lineOfDef(def);
  const venue = venueOfDef(def);
  if (!venue) return null;
  const kind = line ?? venue;
  let tex = banners.get(kind);
  if (tex) return tex;
  const l = line ? LINES[line] : null;
  const cloth = l ? l.cloth : venue === 'tavern' ? 0x6a3a22 : 0x2e6a3a;
  const trim = l ? l.trim : venue === 'tavern' ? 0xf0d080 : 0xf0e0a0;
  const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
  const c = document.createElement('canvas');
  c.width = BANNER_W;
  c.height = BANNER_H;
  const g = c.getContext('2d')!;
  const px = (x: number, y: number, w: number, h: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, w, h);
  };
  px(1, 0, 2, BANNER_H, '#4a2e1a'); // the pole
  px(1, 0, 1, BANNER_H, '#6a4428');
  px(0, 1, 13, 2, '#4a2e1a'); // the crossbar
  px(4, 3, 10, 20, hex(cloth)); // the cloth
  px(4, 3, 10, 1, hex(trim));
  px(4, 3, 1, 20, hex(trim));
  px(13, 3, 1, 20, hex(trim));
  px(4, 23, 4, 2, hex(cloth)); // the swallowtail
  px(10, 23, 4, 2, hex(cloth));
  px(4, 25, 3, 1, hex(cloth));
  px(11, 25, 3, 1, hex(cloth));
  const e = hex(trim);
  switch (kind) {
    case 'weapons': // a sword
      px(8, 7, 2, 11, e);
      px(6, 15, 6, 1, e);
      px(8, 18, 2, 2, '#a07030');
      break;
    case 'armour': // a shield
      px(6, 8, 6, 6, e);
      px(7, 14, 4, 2, e);
      px(8, 16, 2, 1, e);
      px(8, 9, 1, 5, hex(cloth));
      break;
    case 'furniture': // a chair
      px(6, 8, 2, 10, e);
      px(6, 13, 6, 2, e);
      px(10, 15, 2, 4, e);
      px(6, 17, 1, 2, e);
      break;
    case 'medicine': // a bottle
      px(8, 7, 2, 2, e);
      px(7, 9, 4, 2, e);
      px(6, 11, 6, 7, e);
      px(7, 13, 2, 3, hex(cloth));
      break;
    case 'tavern': // a tankard
      px(6, 9, 5, 9, e);
      px(11, 11, 2, 5, e);
      px(12, 12, 1, 3, hex(cloth));
      px(6, 8, 5, 1, '#f8f8f0');
      break;
    default: // scales
      px(8, 7, 2, 10, e);
      px(5, 9, 8, 1, e);
      px(4, 12, 3, 2, e);
      px(11, 12, 3, 2, e);
      px(6, 17, 6, 1, e);
  }
  tex = Texture.from(c);
  tex.source.scaleMode = 'nearest';
  banners.set(kind, tex);
  return tex;
}

/** What stands by a building `w` cells wide (its picture from the pack) with this id, or nothing yet. */
export function packDressing(def: string, id: number, w: number, style: string): Dressing[] {
  const out: Dressing[] = [];
  // (every shop and tavern hangs its banner out front, by the door, whatever the look: the owner's ask)
  const banner = bannerOf(def);
  if (banner) out.push({ texture: banner, dx: (w * CELL) / 2 - BANNER_W - 10, dy: 1, w: BANNER_W, h: BANNER_H });
  const pick = pickFor(def, style);
  if (!pick || pick.styles !== TIMBER) return out;
  const corners: [number, number][] = [
    [-2, 0],
    [w * CELL + 2, 0],
  ];
  corners.forEach(([dx, dy], i) => {
    const h = (id * 2654435761 + i * 40503) >>> 0;
    if ((h % 7) < 3) return; // (not every corner has something)
    const url = DRESSING[(h >>> 8) % DRESSING.length];
    const im = images.get(url);
    if (im === undefined) return fetch(url);
    if (!im) return;
    let tex = dressTex.get(url);
    if (!tex) {
      tex = Texture.from(im);
      tex.source.scaleMode = 'nearest';
      dressTex.set(url, tex);
    }
    out.push({ texture: tex, dx: dx - (i ? 0 : im.naturalWidth), dy, w: im.naturalWidth, h: im.naturalHeight });
  });
  return out;
}
