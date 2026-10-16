// The cutscene props' and held things' sprites (data/sceneProps.ts names them by their file under art/), as the
// build inlines them. Every file the table names is here (test/sceneProps.test.ts checks).

import birds from '../art/birds.png';
import clutterChest from '../art/clutter/chest.png';
import clutterGold2 from '../art/clutter/gold2.png';
import deepSkeleton from '../art/deep/skeleton.png';
import fieldsFlag from '../art/fields/flag.png';
import nestsSkulls from '../art/nests/skulls.png';
import nestsWarren from '../art/nests/warren.png';
import sceneApple from '../art/scene/apple.png';
import sceneAxe from '../art/scene/axe.png';
import sceneBarrel from '../art/scene/barrel.png';
import sceneBread from '../art/scene/bread.png';
import sceneBucket from '../art/scene/bucket.png';
import sceneCart from '../art/scene/cart.png';
import sceneCauldron from '../art/scene/cauldron.png';
import sceneCheese from '../art/scene/cheese.png';
import sceneCrate from '../art/scene/crate.png';
import sceneFirepit from '../art/scene/firepit.png';
import sceneFirepitCold from '../art/scene/firepit_cold.png';
import sceneGoat from '../art/scene/goat.png';
import sceneGrave from '../art/scene/grave.png';
import sceneHay from '../art/scene/hay.png';
import sceneLadle from '../art/scene/ladle.png';
import sceneLamp from '../art/scene/lamp.png';
import sceneLantern from '../art/scene/lantern.png';
import sceneList from '../art/scene/list.png';
import sceneLog from '../art/scene/log.png';
import sceneMap from '../art/scene/map.png';
import scenePamphlet from '../art/scene/pamphlet.png';
import scenePie from '../art/scene/pie.png';
import sceneRock from '../art/scene/rock.png';
import sceneScorch from '../art/scene/scorch.png';
import sceneSign from '../art/scene/sign.png';
import sceneSignpost from '../art/scene/signpost.png';
import sceneSkull from '../art/scene/skull.png';
import sceneStump from '../art/scene/stump.png';
import sceneSword from '../art/scene/sword.png';
import sceneTable from '../art/scene/table.png';
import sceneTankard from '../art/scene/tankard.png';
import sceneTent from '../art/scene/tent.png';
import sceneTentSide from '../art/scene/tent_side.png';
import sceneTorch from '../art/scene/torch.png';
import sceneWagon from '../art/scene/wagon.png';

/** A prop's or held thing's file (as data/sceneProps.ts names it), loaded. */
export const PROP_ART: Record<string, string> = {
  'birds.png': birds,
  'clutter/chest.png': clutterChest,
  'clutter/gold2.png': clutterGold2,
  'deep/skeleton.png': deepSkeleton,
  'fields/flag.png': fieldsFlag,
  'nests/skulls.png': nestsSkulls,
  'nests/warren.png': nestsWarren,
  'scene/apple.png': sceneApple,
  'scene/axe.png': sceneAxe,
  'scene/barrel.png': sceneBarrel,
  'scene/bread.png': sceneBread,
  'scene/bucket.png': sceneBucket,
  'scene/cart.png': sceneCart,
  'scene/cauldron.png': sceneCauldron,
  'scene/cheese.png': sceneCheese,
  'scene/crate.png': sceneCrate,
  'scene/firepit.png': sceneFirepit,
  'scene/firepit_cold.png': sceneFirepitCold,
  'scene/goat.png': sceneGoat,
  'scene/grave.png': sceneGrave,
  'scene/hay.png': sceneHay,
  'scene/ladle.png': sceneLadle,
  'scene/lamp.png': sceneLamp,
  'scene/lantern.png': sceneLantern,
  'scene/list.png': sceneList,
  'scene/log.png': sceneLog,
  'scene/map.png': sceneMap,
  'scene/pamphlet.png': scenePamphlet,
  'scene/pie.png': scenePie,
  'scene/rock.png': sceneRock,
  'scene/scorch.png': sceneScorch,
  'scene/sign.png': sceneSign,
  'scene/signpost.png': sceneSignpost,
  'scene/skull.png': sceneSkull,
  'scene/stump.png': sceneStump,
  'scene/sword.png': sceneSword,
  'scene/table.png': sceneTable,
  'scene/tankard.png': sceneTankard,
  'scene/tent.png': sceneTent,
  'scene/tent_side.png': sceneTentSide,
  'scene/torch.png': sceneTorch,
  'scene/wagon.png': sceneWagon,
};
