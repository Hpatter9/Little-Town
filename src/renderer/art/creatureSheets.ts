// The creature sheets' layout (see creatures.ts, which loads and cuts them with Pixi): kept apart, with no Pixi in it,
// so the menus can show a creature's picture too (art/creatureThumbs.ts).

import bearUrl from './creatures/bear.png';
import drakesUrl from './creatures/drakes.png';
import golemsUrl from './creatures/golems.png';
import horrorUrl from './creatures/horror.png';
import horseUrl from './creatures/horse.png';
import skeleghoulsUrl from './creatures/skeleghouls.png';
import boarUrl from './creatures/wildboar.png';
import wolfUrl from './creatures/wolfdog.png';
import wolfmanUrl from './creatures/wolfman.png';
import wyvernUrl from './creatures/wyvern.png';
import zombieAnimalsUrl from './creatures/zombieanimals.png';
import champNecroUrl from './creatures/champ_necromancer.png';
import champSummonerUrl from './creatures/champ_summoner.png';
import champTamerUrl from './creatures/champ_beast_tamer.png';
import champKnightUrl from './creatures/champ_blood_knight.png';
import darkKnightUrl from './creatures/dark_knight.png';
import ghostsUrl from './creatures/ghosts.png';
import golems2Url from './creatures/golems2.png';
import snowmonkeyUrl from './creatures/snowmonkey.png';
import mouseUrl from './creatures/mouse.png';
import bloodMonsterUrl from './creatures/blood_monster.png';
import demonUrl from './creatures/demon.png';
import goblinUrl from './creatures/goblin.png';
import slimeUrl from './creatures/slime.png';
import champSageUrl from './creatures/champ_sage.png';
import champMercenaryUrl from './creatures/champ_mercenary.png';
import champDragoonUrl from './creatures/champ_dragoon.png';
import lionsUrl from './creatures/lions.png';
import wildDogsUrl from './creatures/wilddogs.png';
import crocodilesUrl from './creatures/crocodiles.png';
import behemothUrl from './creatures/behemoth.png';
import tomesUrl from './creatures/tomes.png';
import batsUrl from './creatures/bats.png';
import camelUrl from './creatures/camel.png';
import shroomsUrl from './creatures/shrooms.png';
import mimicUrl from './creatures/mimic.png';
import dawnUrl from './creatures/dawn.png';
import { DAWN_ACROSS } from '../../shared/data/menagerie';
import { PACK_LAYOUT, packUrl } from './creatures/packs';
import type { PackSheetId } from '../../shared/data/packSheets';

export type CreatureSheet = 'mouse' |'wolf' | 'boar' | 'bear' | 'horse' | 'wyvern' | 'drakes' | 'golems' | 'skeleghouls' | 'zombieanimals' | 'wolfman' | 'horror' | 'dark_knight' | 'champ_necromancer' | 'champ_summoner' | 'champ_beast_tamer' | 'champ_blood_knight' | 'ghosts' | 'golems2' | 'snowmonkey' | 'blood_monster' | 'demon' | 'goblin' | 'slime' | 'champ_sage' | 'champ_mercenary' | 'champ_dragoon' | 'lions' | 'wilddogs' | 'crocodiles' | 'behemoth' | 'tomes' | 'bats' | 'camel' | 'shrooms' | 'mimic' | 'dawn' | PackSheetId;

export interface SheetDef {
  url: string;
  /** Frame size. */
  w: number;
  h: number;
  /** Blocks across (4 for the usual 8-creature sheets, 1 for a single big creature). */
  blocksAcross: number;
  /** Recolour on load: green becomes red (the wyvern turned dragon). */
  redden?: boolean;
  /** An animation strip instead of facing rows: frames per row, and which frames walk and attack (it faces left). */
  strip?: { perRow: number; walk: number[]; attack: number[]; idle: number[]; hurt?: number[]; dead?: number[]; attack2?: number[]; defend?: number[] };
  /** Two-frame creatures (the menagerie's DawnLike sheet): so many to a row, each its two frames side by side,
   *  facing left (mirrored to face right). */
  pairs?: number;
  /** (strips face left unless this says otherwise) */
  facesRight?: boolean;
  /** Where the art starts, as a share of the frame's height from the top (for placing health bars over small
   *  creatures in big frames). */
  top?: number;
  /** Where its feet are, as a share of the frame's height from the top (small creatures in big frames; 1: the
   *  bottom edge). */
  feet?: number;
}

/** The Craftpix packs' creatures (tools/compose-sheets.cjs): one sheet each, a row per animation (walk, attack, idle,
 *  hurt, dying), each frame cropped to the creature with its feet on the bottom edge. */
const PACK_DEFS = Object.fromEntries(
  Object.entries(PACK_LAYOUT).map(([id, p]) => {
    const row = (name: string) => {
      const r = p.rows.indexOf(name);
      return r < 0 ? undefined : Array.from({ length: p.counts[name] }, (_, i) => r * p.perRow + i);
    };
    const def: SheetDef = {
      url: packUrl(id),
      w: p.w,
      h: p.h,
      blocksAcross: 1,
      facesRight: p.facesRight,
      strip: { perRow: p.perRow, walk: row('walk')!, attack: row('attack')!, idle: row('idle')!, hurt: row('hurt'), dead: row('dead'), attack2: row('attack2'), defend: row('defend') },
    };
    return [id, def];
  }),
) as Record<PackSheetId, SheetDef>;

export const SHEETS: Record<CreatureSheet, SheetDef> = {
  ...PACK_DEFS,
  wolf: { url: wolfUrl, w: 48, h: 48, blocksAcross: 4 },
  boar: { url: boarUrl, w: 48, h: 48, blocksAcross: 4 },
  bear: { url: bearUrl, w: 48, h: 48, blocksAcross: 4 },
  horse: { url: horseUrl, w: 48, h: 48, blocksAcross: 4 },
  // a green wyvern, turned red: Vermithrax
  wyvern: { url: wyvernUrl, w: 144, h: 96, blocksAcross: 1, redden: true },
  drakes: { url: drakesUrl, w: 48, h: 48, blocksAcross: 4 },
  golems: { url: golemsUrl, w: 48, h: 48, blocksAcross: 4 },
  skeleghouls: { url: skeleghoulsUrl, w: 48, h: 48, blocksAcross: 4 },
  zombieanimals: { url: zombieAnimalsUrl, w: 48, h: 48, blocksAcross: 4 },
  wolfman: { url: wolfmanUrl, w: 48, h: 52, blocksAcross: 4 },
  // Tiny RPG's Dark Knight: the Black Knight boss (a side-view strip that faces right)
  dark_knight: { url: darkKnightUrl, w: 48, h: 48, blocksAcross: 1, facesRight: true, strip: { perRow: 8, walk: [8, 9, 10], attack: [16, 17, 18], idle: [0, 1, 2, 3, 4, 5, 6, 7] } },
  // Pixel Champions: townsfolk who have taken up a special class (24px RPG Maker sheets)
  champ_necromancer: { url: champNecroUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_summoner: { url: champSummonerUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_beast_tamer: { url: champTamerUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_blood_knight: { url: champKnightUrl, w: 24, h: 24, blocksAcross: 4 },
  ghosts: { url: ghostsUrl, w: 48, h: 48, blocksAcross: 4 },
  // the Deep Freeze: an ice golem (block 1) and a white yeti (block 1)
  golems2: { url: golems2Url, w: 48, h: 48, blocksAcross: 4 },
  snowmonkey: { url: snowmonkeyUrl, w: 48, h: 48, blocksAcross: 4 },
  // the Rat Plague: brown rats (block 0), grey plague rats (5), and the black Rat King (3, drawn huge)
  mouse: { url: mouseUrl, w: 48, h: 48, blocksAcross: 4, top: 0.62 },
  // Tiny RPG Character Asset Pack 02 (Zerie): the Blood Court's blood monsters and demons; the mobs pack's goblin
  // (the Wild Hunt's redcaps) and slime (the Mad Alchemist's acid slimes). Strips: walk, attack and idle rows.
  blood_monster: { url: bloodMonsterUrl, w: 100, h: 100, blocksAcross: 1, facesRight: true, top: 0.4, feet: 0.57, strip: { perRow: 8, walk: [0, 1, 2, 3, 4, 5, 6, 7], attack: [8, 9, 10, 11, 12, 13, 14, 15], idle: [16, 17, 18, 19, 20, 21] } },
  demon: { url: demonUrl, w: 100, h: 100, blocksAcross: 1, facesRight: true, top: 0.37, feet: 0.59, strip: { perRow: 8, walk: [0, 1, 2, 3, 4, 5, 6, 7], attack: [8, 9, 10, 11, 12, 13, 14], idle: [16, 17, 18, 19, 20, 21] } },
  goblin: { url: goblinUrl, w: 64, h: 64, blocksAcross: 1, facesRight: true, top: 0.1, feet: 0.82, strip: { perRow: 5, walk: [0, 1, 2, 3, 4], attack: [5, 6, 7], idle: [10, 11, 12, 13] } },
  slime: { url: slimeUrl, w: 64, h: 64, blocksAcross: 1, facesRight: true, top: 0.46, feet: 0.8, strip: { perRow: 10, walk: [0, 1, 2, 3, 4, 5], attack: [10, 11, 12, 13, 14, 15, 16, 17, 18, 19], idle: [20, 21, 22, 23, 24, 25, 26, 27] } },
  // Pixel Champions: rival lords (Prime the Great Sage is the Mad Alchemist; Oratio the Mercenary, the Khan;
  // Wyvera the Queen Dragoon, the Tide Queen)
  champ_sage: { url: champSageUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_mercenary: { url: champMercenaryUrl, w: 24, h: 24, blocksAcross: 4 },
  champ_dragoon: { url: champDragoonUrl, w: 24, h: 24, blocksAcross: 4 },
  // More of whtdragon's MV sheets: desert lions and wild dogs, coastal crocodiles, the Behemoth, possessed tomes,
  // vampire bats, the desert caravan's camels, the druid's walking mushrooms; and the mobs pack's mimic (a strip:
  // walk, attack, idle and disguised rows).
  lions: { url: lionsUrl, w: 48, h: 48, blocksAcross: 4 },
  wilddogs: { url: wildDogsUrl, w: 48, h: 48, blocksAcross: 4 },
  crocodiles: { url: crocodilesUrl, w: 96, h: 96, blocksAcross: 4 },
  behemoth: { url: behemothUrl, w: 96, h: 132, blocksAcross: 1, top: 0.1 },
  tomes: { url: tomesUrl, w: 48, h: 48, blocksAcross: 4, feet: 0.8 },
  bats: { url: batsUrl, w: 48, h: 48, blocksAcross: 4 },
  camel: { url: camelUrl, w: 48, h: 48, blocksAcross: 2 },
  shrooms: { url: shroomsUrl, w: 48, h: 48, blocksAcross: 4 },
  // the menagerie (data/menagerie.ts): DawnLike's creatures, two frames each (tools/compose-dawn.cjs)
  dawn: { url: dawnUrl, w: 16, h: 16, blocksAcross: 1, pairs: DAWN_ACROSS },
  mimic: { url: mimicUrl, w: 64, h: 64, blocksAcross: 1, feet: 0.88, strip: { perRow: 6, walk: [0, 1, 2, 3, 4, 5], attack: [6, 7, 8], idle: [12, 13, 14, 15] } },
  horror: { url: horrorUrl, w: 80, h: 64, blocksAcross: 1, strip: { perRow: 5, walk: [4, 5, 6, 7, 8, 9], attack: [11, 13, 15, 17], idle: [0, 1, 2, 3] } },
};
