// Seasonal festivals (the owner's ask, a DLC-sized update): every people keeps a festival each season, so a town has
// four a year of its own. Each has a name and its lore, the days before it when the town makes ready (a food and a
// ware made for it at the fire), its gathering on the map (dressed in its own colours and things), a song of its own,
// what it leaves behind (a lift to the spirits, a boon for a few days, a god's favour), and what comes of skipping it
// for want of food (the town sore, the god offended). Travellers come for them. The sim is sim/festivals.ts.

import type { Domain } from './gods';
import type { ItemDef, IconSheet } from './items';
import type { Material } from './materials';
import type { OriginId } from './origins';
import type { Lever } from './eventKit';
import type { Season } from '../sim/time';

/** The festival's day in its season (1-based: the seasons are ten days), the days of making ready before it, the hour
 *  it begins, how long it lasts, and the last hour it may still begin (put off by a raid or a funeral). */
export const FESTIVAL_DAY = 7;
export const PREP_DAYS = 3;
export const FESTIVAL_HOUR = 17;
export const FESTIVAL_HOURS = 4;
export const FESTIVAL_LATEST = 21;
/** How many of the festival's food and ware the town makes ready: a few, and one more for every so many people. */
export const FOOD_LEAST = 2;
export const WARE_LEAST = 1;
export const PER_PEOPLE = 6;
export const MAKE_MOST = 5;
/** Food eaten a head at it (need units, as a feast), and the days of food the stores must still hold after it. */
export const FESTIVAL_FOOD = 0.5;
export const FESTIVAL_FOOD_DAYS = 2;
/** What it leaves: the spirits lifted (morale, hours; more the readier it was), the boon (its lever, for BOON_HOURS),
 *  the god's favour, and each ware sold to the visitors for WARE_PRICE coins (times the age's purse). */
export const FESTIVAL_MARK: [number, number] = [8, 48];
export const BOON_HOURS = 120;
export const FESTIVAL_FAVOUR = 12;
export const WARE_PRICE = 6;
/** Skipped for want of food: the town sore for SKIPPED_MARK, the god's favour down SKIPPED_FAVOUR. */
export const SKIPPED_MARK: [number, number] = [-8, 72];
export const SKIPPED_FAVOUR = 20;
/** Visitors: a band of travellers comes for it on its day (the town's grown-ups at least VISIT_PEOPLE), and the roads
 *  are busier (`travellers` lever) from the day before till it's over. */
export const VISIT_PEOPLE = 2;
export const VISIT_MULT = 1.6;
/** The festival-only choice events weigh this much (they can come only in the days of making ready and the day). */
export const FESTIVAL_EVENT_WEIGHT = 25;

/** The things laid out about the ring (the packs' sprites: renderer/map/mapFestival.ts). */
export type DecorKit = 'blossom' | 'harvest' | 'candles' | 'bones' | 'grove' | 'sea' | 'crystal' | 'forge' | 'war' | 'flasks' | 'banners' | 'fire' | 'gold';

/** A song of its own (renderer/musicScore.ts `festivalPiece`): a mode, a tempo, the bar's beats, its lead and drums. */
export interface FestivalSong {
  name: string;
  mode: 'ionian' | 'dorian' | 'phrygian' | 'lydian' | 'mixolydian' | 'aeolian' | 'harmonic';
  bpm: number;
  meter: 3 | 4;
  lead: 'flute' | 'pluck' | 'harp' | 'bell' | 'organ' | 'brass' | 'pad';
  drums: 'none' | 'light' | 'march' | 'heavy';
}

interface Made {
  name: string;
  cost: Partial<Record<Material, number>>;
  icon: [IconSheet, number, number];
  text: string;
}

export interface FestivalDef {
  id: string;
  origin: OriginId;
  season: Season;
  name: string;
  lore: string;
  /** What the town is doing at it (the Townsfolk tab, the Journal). */
  doing: string;
  food: Made;
  ware: Made;
  god: Domain;
  boon: { lever: Lever; mult: number; text: string };
  kit: DecorKit;
  /** The pennants' colours, and the lanterns'. */
  colours: number[];
  lantern: number;
  song: FestivalSong;
}

const m = (name: string, cost: Made['cost'], icon: Made['icon'], text: string): Made => ({ name, cost, icon, text });
const song = (name: string, mode: FestivalSong['mode'], bpm: number, meter: 3 | 4, lead: FestivalSong['lead'], drums: FestivalSong['drums']): FestivalSong => ({ name, mode, bpm, meter, lead, drums });

function F(origin: OriginId, season: Season, id: string, name: string, lore: string, doing: string, food: Made, ware: Made, god: Domain, boon: FestivalDef['boon'], kit: DecorKit, colours: number[], lantern: number, s: FestivalSong): FestivalDef {
  return { id, origin, season, name, lore, doing, food, ware, god, boon, kit, colours, lantern, song: s };
}

export const FESTIVALS: readonly FestivalDef[] = [
  // ---- the settlers
  F('settlers', 'spring', 'sowing_day', 'Sowing Day', 'The first seed of the year goes in by the founder\'s hand, and the whole town walks the furrows after. Whoever finds the bean in the blossom cake is lucky till midsummer.', 'Dancing for Sowing Day',
    m('Blossom Cakes', { berries: 2 }, ['Food', 0, 5], 'Little cakes with a flower pressed on top, and a bean in one.'), m('Maypole Ribbons', { fiber: 2 }, ['Music', 0, 0], 'Ribbons in every colour, for the pole and for sweethearts.'),
    'harvest', { lever: 'crops', mult: 1.1, text: 'Sowing Day blessed the fields' }, 'blossom', [0xf080a0, 0xf8e070, 0x80c870, 0xffffff], 0xffd060, song('The Blossom Reel', 'ionian', 120, 3, 'flute', 'light')),
  F('settlers', 'summer', 'long_light_fair', 'The Long Light Fair', 'On the longest days the town keeps open house till the sun goes down at last. Stalls by the fire, races for the children, and the old songs when the light finally goes.', 'At the Long Light Fair',
    m('Honey Buns', { berries: 2, herbs: 1 }, ['Food', 0, 4], 'Sticky buns glazed with wild honey.'), m('Painted Tokens', { wood: 2 }, ['Money', 6, 0], 'Wooden tokens painted bright, swapped as keepsakes.'),
    'sky', { lever: 'travellers', mult: 1.25, text: 'Word of the Long Light Fair travels' }, 'banners', [0xf0c030, 0x3a78d8, 0xe04040, 0xffffff], 0xffd060, song('Long Light', 'mixolydian', 116, 4, 'pluck', 'light')),
  F('settlers', 'autumn', 'harvest_supper', 'The Harvest Supper', 'When the last sheaf is in, the town sits down together at one long table. The last sheaf is plaited into a corn dolly and hung over the hearth for luck till spring.', 'At the Harvest Supper',
    m('Harvest Pie', { meat: 1, berries: 2 }, ['Food', 4, 5], 'A great pie of everything the fields gave.'), m('Corn Dollies', { fiber: 2 }, ['Food', 6, 1], 'Plaited from the last sheaf, hung up for luck.'),
    'harvest', { lever: 'forage', mult: 1.1, text: 'The corn dolly hangs over the hearth' }, 'harvest', [0xe0a040, 0xc05a20, 0xf0d070, 0x80502a], 0xffa040, song('The Last Sheaf', 'dorian', 104, 3, 'flute', 'light')),
  F('settlers', 'winter', 'yule_hearth', 'Yule Hearth', 'A great log is dragged in from the woods and kept burning a whole night through, so the sun knows its way back. Gifts go to the children, and nobody sleeps cold.', 'Keeping Yule by the fire',
    m('Spiced Wassail', { berries: 2, herbs: 1 }, ['Potion', 0, 0], 'Hot, spiced and shared from one bowl.'), m('Yule Log Charms', { wood: 2 }, ['Food', 5, 0], 'Splinters of last year\'s log, kept for luck.'),
    'hearth', { lever: 'work', mult: 1.06, text: 'Warm from the Yule Hearth' }, 'candles', [0xd03030, 0x2a8a3a, 0xf0d070, 0xffffff], 0xffb050, song('Yule Log', 'ionian', 92, 3, 'bell', 'none')),
  // ---- the liches' necropolis
  F('lich', 'spring', 'unburial', 'The Unburial', 'In spring the dead are taken from their crypts and walked about the town, so they remember it. Each is told the news of the year in a whisper.', 'Walking the dead at the Unburial',
    m('Grave Bread', { bone: 1, herbs: 1 }, ['Food', 0, 4], 'Grey loaves left on the stones: the living must not eat them.'), m('Bone Chimes', { bone: 2 }, ['Music', 0, 4], 'Hung where the wind blows, so the dead hear something.'),
    'harvest', { lever: 'research', mult: 1.08, text: 'The dead remembered the town' }, 'bones', [0x80e0a0, 0x404848, 0xb0c0b8, 0x205030], 0x80ff9a, song('Walk of the Unburied', 'phrygian', 72, 3, 'organ', 'none')),
  F('lich', 'summer', 'night_of_lamps', 'The Night of Lamps', 'On the shortest night the necropolis lights a green lamp for every soul it has raised, and counts them aloud till dawn.', 'Counting souls on the Night of Lamps',
    m('Ash Cakes', { bone: 1, herbs: 1 }, ['Food', 3, 5], 'Offerings, pale as ash, set before each lamp.'), m('Soul Lanterns', { clay: 2 }, ['Light', 3, 0], 'Clay lanterns with green glass.'),
    'sky', { lever: 'guard', mult: 1.06, text: 'Every soul counted, every lamp lit' }, 'candles', [0x60e090, 0x203828, 0x90b0a0], 0x70ff90, song('Green Lamps', 'aeolian', 76, 4, 'bell', 'none')),
  F('lich', 'autumn', 'grave_harvest', 'The Grave Harvest', 'As the year dies the necropolis gathers its bones, sorts them and sings over them. Nothing that has died is wasted.', 'At the Grave Harvest',
    m('Marrow Offerings', { bone: 2 }, ['Flesh', 0, 0], 'Laid on the altar, and taken back, cleaned, the next day.'), m('Carved Skulls', { bone: 2 }, ['Money', 4, 4], 'Small skulls of bone, carved with names.'),
    'harvest', { lever: 'craft', mult: 1.08, text: 'The bones gathered in' }, 'bones', [0xc0b080, 0x404040, 0x80a070], 0xb0ff80, song('Bone Harvest', 'harmonic', 88, 3, 'organ', 'light')),
  F('lich', 'winter', 'long_silence', 'The Long Silence', 'For a night the necropolis does not speak. The dead stand in rings in the snow and listen to the dark, and whatever they hear they keep.', 'Standing in the Long Silence',
    m('Frost Wafers', { herbs: 2 }, ['Food', 3, 1], 'Thin as frost, left out to melt.'), m('Black Candles', { bone: 1, herbs: 1 }, ['Light', 0, 0], 'Candles that burn with a cold flame.'),
    'hearth', { lever: 'research', mult: 1.1, text: 'What was heard in the Long Silence' }, 'candles', [0x3a3a4a, 0x80e0a0, 0xd0d8e0], 0x90ffb0, song('The Long Silence', 'phrygian', 60, 4, 'pad', 'none')),
  // ---- the druids' grove
  F('druid', 'spring', 'beltane_bloom', 'Beltane Bloom', 'Twin fires are lit and everyone walks between them for luck, then the young run into the woods to bring back the first blossom.', 'Walking between the Beltane fires',
    m('Flower Bannocks', { berries: 2 }, ['Food', 0, 5], 'Oat cakes with petals baked in.'), m('Blossom Garlands', { herbs: 2 }, ['Food', 6, 1], 'Garlands of hawthorn and primrose.'),
    'harvest', { lever: 'crops', mult: 1.12, text: 'The grove blooms after Beltane' }, 'grove', [0xf0f0f0, 0xf080a0, 0x60c060, 0xf8e070], 0xffe080, song('Twin Fires', 'mixolydian', 112, 3, 'flute', 'light')),
  F('druid', 'summer', 'oakcrown', 'Oakcrown', 'The tallest oak is crowned with a ring of mistletoe and green ribbon, and the grove sings to it from noon to dusk.', 'Singing at Oakcrown',
    m('Acorn Bread', { berries: 1, herbs: 1 }, ['Food', 0, 4], 'Dense, sweet and brown.'), m('Oak Crowns', { wood: 1, herbs: 1 }, ['Food', 5, 0], 'Leafy crowns for every head.'),
    'sky', { lever: 'forage', mult: 1.12, text: 'The oak was crowned' }, 'grove', [0x2a8a3a, 0xf0d070, 0x80c870], 0xfff090, song('The Oak King', 'dorian', 100, 4, 'harp', 'light')),
  F('druid', 'autumn', 'seedfall', 'Seedfall', 'The grove gathers the seeds of every wild thing and scatters a handful of each back into the woods, so the woods will give again.', 'Scattering seed at Seedfall',
    m('Nut Cakes', { berries: 2 }, ['Food', 3, 5], 'Hazelnut and blackberry.'), m('Seed Pouches', { hide: 1, herbs: 1 }, ['Food', 7, 2], 'Little pouches of seed, given to the woods.'),
    'harvest', { lever: 'forage', mult: 1.1, text: 'The seed given back to the woods' }, 'harvest', [0xc06a20, 0xe0a040, 0x6a8a2a], 0xffb040, song('Seedfall', 'aeolian', 92, 3, 'flute', 'none')),
  F('druid', 'winter', 'mistletoe_night', 'Mistletoe Night', 'The oldest druid cuts the mistletoe with a sickle of bone, and it must never touch the ground. Under it, every quarrel of the year is made up.', 'Making peace under the mistletoe',
    m('Mulled Berries', { berries: 2, herbs: 1 }, ['Potion', 4, 0], 'Hot berries in their juice.'), m('Mistletoe Sprigs', { herbs: 2 }, ['Food', 6, 1], 'Tied with red thread over every door.'),
    'hearth', { lever: 'work', mult: 1.06, text: 'Every quarrel made up under the mistletoe' }, 'grove', [0xf0f0f0, 0x2a8a3a, 0xd03030], 0xfff0c0, song('White Berries', 'lydian', 84, 3, 'harp', 'none')),
  // ---- the Blood Court
  F('vampire', 'spring', 'pale_spring', 'The Pale Spring', 'When the nights grow short again the Court holds a vigil, veiled against the coming light, and drinks to the dark that will return.', 'Keeping the Pale Spring vigil',
    m('Rose Cordial', { blood: 1, berries: 1 }, ['Potion', 0, 1], 'Red and sweet, served in thin glasses.'), m('Lace Veils', { fiber: 2 }, ['Hat', 0, 0], 'Black lace, worn till dawn.'),
    'harvest', { lever: 'prices', mult: 1.08, text: 'The Court drank to the dark' }, 'candles', [0x801828, 0x101010, 0xe0d0d0], 0xff6060, song('Veils', 'harmonic', 80, 3, 'organ', 'none')),
  F('vampire', 'summer', 'night_of_masks', 'The Night of Masks', 'On the shortest night everyone goes masked and nobody may ask who anyone is. Debts are forgotten, and a few new ones are made.', 'Dancing masked on the Night of Masks',
    m('Black Pudding', { blood: 1, meat: 1 }, ['Flesh', 3, 0], 'Rich and dark, for those who eat.'), m('Masquerade Masks', { hide: 1, fiber: 1 }, ['Hat', 1, 0], 'Feathered and gilt.'),
    'sky', { lever: 'travellers', mult: 1.2, text: 'Strangers still talk of the Night of Masks' }, 'gold', [0x801828, 0xe0b040, 0x401060, 0x101010], 0xff7050, song('Masks', 'harmonic', 132, 3, 'pluck', 'light')),
  F('vampire', 'autumn', 'blood_harvest', 'The Blood Harvest', 'The year\'s blood is tasted, judged and laid down in the cellars. The best cask is named after whoever gave the most.', 'Tasting at the Blood Harvest',
    m('Blood Wine Tastings', { blood: 2 }, ['Potion', 1, 2], 'A thimble of each vintage.'), m('Garnet Pins', { stone: 1, bone: 1 }, ['Amulet', 3, 0], 'Red stones on a pin, for the cloak.'),
    'harvest', { lever: 'craft', mult: 1.08, text: 'The vintage laid down' }, 'gold', [0x6a1018, 0xb02030, 0x101010], 0xff5040, song('The Vintage', 'phrygian', 84, 4, 'organ', 'none')),
  F('vampire', 'winter', 'longest_night', 'The Longest Night', 'The Court\'s holiest night: the dark at its longest, the castle lit end to end with candles, and a toast at every hour.', 'Toasting the Longest Night',
    m('Candied Plums', { berries: 2 }, ['Food', 7, 2], 'Dark, sticky, for the living guests.'), m('Silver Bells', { stone: 1, wood: 1 }, ['Music', 0, 4], 'Rung at every hour of the night.'),
    'hearth', { lever: 'guard', mult: 1.08, text: 'The Court is strong after the Longest Night' }, 'candles', [0x801828, 0xd0d0e0, 0x101010], 0xffd0a0, song('Twelve Toasts', 'aeolian', 72, 3, 'bell', 'none')),
  // ---- the Moon Pack
  F('werewolf', 'spring', 'first_howl', 'The First Howl', 'The cubs born that winter howl for the first time with the pack, and each is given a name it must earn.', 'Howling at the First Howl',
    m('Roast Hare', { meat: 2 }, ['Flesh', 1, 0], 'Spitted and charred.'), m('Fang Necklaces', { bone: 2 }, ['Amulet', 0, 1], 'A tooth for every cub.'),
    'harvest', { lever: 'fight', mult: 1.06, text: 'The cubs have howled' }, 'fire', [0x8a6a4a, 0xd0c0a0, 0x404040], 0xffa050, song('First Howl', 'dorian', 108, 4, 'flute', 'march')),
  F('werewolf', 'summer', 'sun_hunt', 'The Sun Hunt', 'In the brightest days the pack hunts as people, on two feet, to remember they can. The one who brings back the most is Sun-Wolf for the year.', 'Back from the Sun Hunt',
    m('Spit-Roast Boar', { meat: 3 }, ['Flesh', 2, 0], 'The hunt\'s best, roasted whole.'), m('Sun Pelts', { hide: 2 }, ['Armor', 2, 0], 'Pale hides, tanned in the sun.'),
    'sky', { lever: 'forage', mult: 1.12, text: 'The Sun Hunt fed the pack' }, 'war', [0xe0a040, 0x8a6a4a, 0xf0e0b0], 0xffc060, song('Two Feet', 'mixolydian', 124, 4, 'pluck', 'march')),
  F('werewolf', 'autumn', 'hunters_moon', 'The Hunter\'s Moon', 'The great autumn moon rises orange, and the whole pack runs under it, and every grudge is settled in the ring by the fire.', 'Running under the Hunter\'s Moon',
    m('Blood Sausage', { meat: 2, herbs: 1 }, ['Flesh', 4, 0], 'Thick and smoky.'), m('Moon Totems', { wood: 1, bone: 1 }, ['Amulet', 7, 0], 'A carved moon on a thong.'),
    'war', { lever: 'fight', mult: 1.1, text: 'The pack ran under the Hunter\'s Moon' }, 'war', [0xe07020, 0x303030, 0xd0c0a0], 0xff9040, song('Hunter\'s Moon', 'aeolian', 128, 4, 'brass', 'heavy')),
  F('werewolf', 'winter', 'snow_chase', 'The Snow Chase', 'The pack chases the fastest of its young through the drifts all night. Whoever catches them at dawn takes their place as the fastest.', 'Running the Snow Chase',
    m('Bone Broth', { bone: 1, meat: 1 }, ['Potion', 4, 2], 'Hot, and it keeps you running.'), m('Wolf-Fur Mittens', { hide: 2 }, ['Armor', 3, 1], 'For the slow ones.'),
    'hearth', { lever: 'work', mult: 1.06, text: 'Warm after the Snow Chase' }, 'fire', [0xd0e0f0, 0x404040, 0x8a6a4a], 0xffc080, song('Snow Chase', 'dorian', 138, 3, 'flute', 'light')),
  // ---- the machines
  F('robot', 'spring', 'calibration_day', 'Calibration Day', 'Every unit stands in a line and is measured against the first. Drift is forgiven, and corrected.', 'Standing in line for Calibration Day',
    m('Oil Rations', { stone: 1, wood: 1 }, ['Potion', 2, 3], 'A sip of something to keep the joints sweet.'), m('Brass Gauges', { stone: 2 }, ['Tool', 2, 2], 'Little dials, kept as tokens.'),
    'harvest', { lever: 'build', mult: 1.08, text: 'Every unit calibrated' }, 'forge', [0x60c0e0, 0xc0c0c0, 0xf0a040], 0x80e0ff, song('Zero Point', 'lydian', 120, 4, 'bell', 'march')),
  F('robot', 'summer', 'solar_jubilee', 'The Solar Jubilee', 'When the sun stands highest the town opens every panel and stores the light. Units who would have slept dance instead: the light is spare.', 'Dancing at the Solar Jubilee',
    m('Charged Cells', { stone: 1, clay: 1 }, ['Light', 4, 0], 'Little cells, warm from the sun.'), m('Mirror Pins', { stone: 1, clay: 1 }, ['Amulet', 6, 0], 'Polished to catch the sun.'),
    'sky', { lever: 'work', mult: 1.08, text: 'Full of the Solar Jubilee\'s light' }, 'crystal', [0xf0d040, 0x60c0e0, 0xffffff], 0xfff080, song('Full Charge', 'ionian', 132, 4, 'brass', 'march')),
  F('robot', 'autumn', 'defrag_festival', 'The Defrag Festival', 'Old memories are sorted, joined up and shared: every unit tells its year to the others, so nothing it learned is lost.', 'Sharing memory at the Defrag Festival',
    m('Coolant Tea', { herbs: 2 }, ['Potion', 5, 0], 'Mostly ceremonial.'), m('Memory Tapes', { fiber: 1, stone: 1 }, ['Book', 0, 0], 'A year, wound on a spool.'),
    'harvest', { lever: 'research', mult: 1.1, text: 'The year\'s memories shared' }, 'crystal', [0x60e0a0, 0x404850, 0x80a0c0], 0x80ffc0, song('Defragment', 'dorian', 104, 4, 'pluck', 'light')),
  F('robot', 'winter', 'cold_boot', 'Cold Boot', 'At the year\'s darkest hour every unit powers down for a breath, and then up again, in order of its making. The first to wake greets the rest.', 'Rebooting for Cold Boot',
    m('Warm Oil', { wood: 2 }, ['Potion', 2, 3], 'For the cold joints.'), m('Signal Lamps', { clay: 1, stone: 1 }, ['Light', 4, 0], 'A blink for every unit woken.'),
    'hearth', { lever: 'guard', mult: 1.06, text: 'Booted up warm' }, 'forge', [0x80b0ff, 0xd0d0d0, 0xf06040], 0xa0d0ff, song('Power On', 'lydian', 96, 4, 'pad', 'none')),
  // ---- the Deep Hold
  F('dwarves', 'spring', 'stone_thaw', 'Stone-Thaw', 'When the snow melts off the mountain\'s face the hold throws its gates wide and every dwarf takes one step outside, blinking, for luck.', 'Blinking in the sun at Stone-Thaw',
    m('Rock Cakes', { berries: 1, stone: 1 }, ['Food', 3, 5], 'Hard as their name. Dwarves like them.'), m('Thaw Runes', { stone: 2 }, ['Money', 5, 6], 'Pebbles carved with the rune for "open".'),
    'harvest', { lever: 'build', mult: 1.08, text: 'The gates opened at Stone-Thaw' }, 'gold', [0xc08040, 0x606870, 0xf0d070], 0xffc060, song('Open the Gates', 'dorian', 112, 4, 'brass', 'march')),
  F('dwarves', 'summer', 'forgefire', 'Forgefire', 'Every forge in the hold is lit at once and kept roaring for a day. The smiths try their best work against each other, and the loser buys the ale.', 'At the Forgefire',
    m('Forge-Baked Bread', { berries: 1, meat: 1 }, ['Food', 0, 4], 'Baked on the anvil\'s heat.'), m('Little Hammers', { stone: 1, wood: 1 }, ['Tool', 1, 1], 'A toy hammer for every child.'),
    'sky', { lever: 'craft', mult: 1.1, text: 'The forges burned hot at Forgefire' }, 'forge', [0xf06020, 0x404040, 0xf0c040], 0xff8030, song('Hammer and Anvil', 'mixolydian', 126, 4, 'brass', 'heavy')),
  F('dwarves', 'autumn', 'ale_tapping', 'The Ale Tapping', 'The year\'s first barrel is tapped by the oldest beard in the hold, who must drink the first mug in one go or the year\'s ale is bad.', 'Drinking at the Ale Tapping',
    m('Cave Mushroom Pie', { herbs: 1, meat: 1 }, ['Food', 4, 5], 'Grey and good.'), m('Pewter Tankards', { stone: 2 }, ['Potion', 3, 2], 'Each with the drinker\'s rune.'),
    'harvest', { lever: 'work', mult: 1.06, text: 'The ale was good this year' }, 'gold', [0xe0a040, 0x6a4020, 0xf0e0b0], 0xffb050, song('First Barrel', 'ionian', 120, 3, 'pluck', 'light')),
  F('dwarves', 'winter', 'deepwinter_lanterns', 'Deepwinter Lanterns', 'The hold goes down to its deepest hall and hangs a lantern for every dwarf who ever dug there. The names are read till the oil runs out.', 'Reading the names at Deepwinter',
    m('Spiced Stew', { meat: 1, herbs: 1 }, ['Food', 4, 5], 'Thick enough to stand a spoon in.'), m('Gem Lanterns', { stone: 1, clay: 1 }, ['Light', 3, 0], 'A chip of gem for every name.'),
    'hearth', { lever: 'research', mult: 1.06, text: 'The names were read at Deepwinter' }, 'crystal', [0x60a0e0, 0xf0c040, 0x404040], 0xa0d0ff, song('The Deep Names', 'aeolian', 80, 4, 'organ', 'none')),
  // ---- the merfolk
  F('merfolk', 'spring', 'spawning_tide', 'The Spawning Tide', 'When the spring tide runs highest the shoals come in, and the clan sings them home along the shore so they will come again.', 'Singing in the Spawning Tide',
    m('Kelp Rolls', { kelp: 2 }, ['Food', 6, 1], 'Green and salt.'), m('Shell Garlands', { stone: 1, fiber: 1 }, ['Amulet', 2, 1], 'Shells on a cord.'),
    'harvest', { lever: 'forage', mult: 1.12, text: 'The shoals were sung home' }, 'sea', [0x40c0d0, 0xf0f0f0, 0x60e0a0], 0x80f0ff, song('Shoals', 'lydian', 100, 3, 'harp', 'light')),
  F('merfolk', 'summer', 'high_tide_revel', 'The High Tide Revel', 'At the summer\'s highest tide the clan swims out to the farthest rock and dances on it till the water comes back up over their tails.', 'Dancing at the High Tide Revel',
    m('Grilled Fish', { fish: 2 }, ['Flesh', 7, 0], 'Charred on driftwood.'), m('Coral Combs', { stone: 2 }, ['Tool', 2, 0], 'Pink coral, for long hair.'),
    'sky', { lever: 'travellers', mult: 1.2, text: 'Sailors still talk of the Revel' }, 'sea', [0xf08080, 0x40c0d0, 0xf0e0a0], 0xffc0a0, song('High Water', 'mixolydian', 124, 4, 'pluck', 'light')),
  F('merfolk', 'autumn', 'pearl_gathering', 'The Pearl Gathering', 'The year\'s pearls are laid out on the strand and counted, and the finest is given back to the sea.', 'Counting pearls at the Gathering',
    m('Oyster Stew', { fish: 2 }, ['Potion', 5, 2], 'Creamy and briny.'), m('Pearl Pins', { stone: 1, bone: 1 }, ['Amulet', 4, 1], 'A pearl on a pin.'),
    'harvest', { lever: 'prices', mult: 1.08, text: 'The finest pearl given back' }, 'sea', [0xf0f0f0, 0xc0e0f0, 0x40a0c0], 0xe0f8ff, song('The Strand', 'dorian', 92, 3, 'harp', 'none')),
  F('merfolk', 'winter', 'ice_song', 'The Ice-Song', 'When the shallows freeze the clan sings to the ice, low and long, so it will let the sea through again in spring.', 'Singing the Ice-Song',
    m('Smoked Eel', { fish: 2 }, ['Flesh', 6, 0], 'For the long nights.'), m('Driftwood Flutes', { wood: 2 }, ['Music', 0, 0], 'Pale and sweet-toned.'),
    'hearth', { lever: 'guard', mult: 1.06, text: 'The ice heard the clan' }, 'crystal', [0xd0e8ff, 0x40a0c0, 0xf0f0f0], 0xc0f0ff, song('Under the Ice', 'aeolian', 70, 3, 'flute', 'none')),
  // ---- the nomads' horde
  F('nomads', 'spring', 'foaling_feast', 'The Foaling Fair', 'The new foals are led round the fire and named, and the horde drinks mare\'s milk from the same cup.', 'Naming foals at the Foaling Fair',
    m('Mare\'s Milk', { berries: 1, herbs: 1 }, ['Potion', 6, 1], 'Sour and fizzing.'), m('Felt Ribbons', { hide: 1, fiber: 1 }, ['Music', 1, 0], 'Tied in the foals\' manes.'),
    'harvest', { lever: 'forage', mult: 1.1, text: 'The foals named' }, 'banners', [0x3a78d8, 0xe04040, 0xf0c030, 0xffffff], 0xffd060, song('Foals', 'mixolydian', 116, 3, 'pluck', 'light')),
  F('nomads', 'summer', 'great_race', 'The Great Race', 'The horde\'s riders race from the camp to the far hills and back. The winner\'s horse eats first all year.', 'At the Great Race',
    m('Roast Mutton', { meat: 2 }, ['Flesh', 2, 0], 'Cooked in its own skin.'), m('Race Banners', { fiber: 2 }, ['Music', 2, 0], 'Long streamers for the riders.'),
    'sky', { lever: 'work', mult: 1.08, text: 'The horde rides proud after the Race' }, 'banners', [0xe04040, 0xf0c030, 0x3a78d8], 0xffc060, song('Hooves', 'dorian', 144, 4, 'pluck', 'march')),
  F('nomads', 'autumn', 'wool_moot', 'The Wool Moot', 'Before the long ride to the winter grounds every family brings its felt and wool and the horde trades, quarrels and marries.', 'Trading at the Wool Moot',
    m('Dumplings', { meat: 1, berries: 1 }, ['Food', 3, 5], 'Steamed in their hundreds.'), m('Felt Rugs', { hide: 2 }, ['Chest0', 1, 0], 'Thick, bright, for the yurts.'),
    'harvest', { lever: 'prices', mult: 1.08, text: 'Good trading at the Moot' }, 'harvest', [0xc04020, 0xf0c030, 0x40a080], 0xffb050, song('The Moot', 'mixolydian', 108, 4, 'flute', 'light')),
  F('nomads', 'winter', 'star_camp', 'Star Camp', 'On the clearest winter night the horde puts out every fire and lies on its back to read the year to come in the stars.', 'Reading the stars at Star Camp',
    m('Butter Tea', { herbs: 2 }, ['Potion', 6, 0], 'Salt, rich and hot.'), m('Star Charts', { hide: 1, herbs: 1 }, ['Scroll', 0, 0], 'The year to come, pricked in hide.'),
    'hearth', { lever: 'research', mult: 1.08, text: 'The year read in the stars' }, 'candles', [0x203070, 0xf0f0ff, 0xf0c030], 0xfff0c0, song('Under the Stars', 'lydian', 76, 4, 'harp', 'none')),
  // ---- the Fae Court
  F('fae', 'spring', 'bloom_court', 'The Bloom Court', 'The Court sits in a ring of flowers that opened that morning and judges which is the loveliest. The loser must be a weed till summer.', 'Judging at the Bloom Court',
    m('Dew Cakes', { berries: 1, herbs: 1 }, ['Food', 3, 1], 'Light as nothing at all.'), m('Petal Crowns', { herbs: 2 }, ['Food', 5, 0], 'They never wilt. Never.'),
    'harvest', { lever: 'crops', mult: 1.12, text: 'The Bloom Court smiled on the fields' }, 'blossom', [0xf0a0e0, 0xa0e0f0, 0xf0f0a0, 0xc0a0ff], 0xffc0ff, song('Bloom', 'lydian', 120, 3, 'harp', 'light')),
  F('fae', 'summer', 'midsummer_revel', 'The Midsummer Revel', 'The one night the Court opens its ring to anyone who can find it. Mortals who dance there come home a year older, or a year younger.', 'Dancing in the Midsummer Revel',
    m('Faerie Wine', { berries: 2 }, ['Potion', 7, 1], 'Don\'t drink three cups.'), m('Glamour Masks', { herbs: 1, fiber: 1 }, ['Hat', 1, 0], 'Wear it, and be someone else.'),
    'sky', { lever: 'travellers', mult: 1.25, text: 'Mortals still seek the Revel' }, 'crystal', [0xc0a0ff, 0xf0a0e0, 0xf0f0f0, 0x80f0c0], 0xe0c0ff, song('The Ring', 'lydian', 140, 3, 'flute', 'light')),
  F('fae', 'autumn', 'masque_of_leaves', 'The Masque of Leaves', 'Every leaf that falls in the glade is a guest, and must be danced with before it touches the ground.', 'At the Masque of Leaves',
    m('Honeyed Rosehips', { berries: 2 }, ['Food', 7, 2], 'Red and sticky.'), m('Leaf Gowns', { herbs: 1, fiber: 1 }, ['Armor', 0, 0], 'Sewn of real leaves, somehow.'),
    'harvest', { lever: 'craft', mult: 1.08, text: 'The Masque inspired the crafters' }, 'harvest', [0xe08030, 0xc04030, 0xf0c040, 0x804060], 0xffb060, song('Falling Leaves', 'dorian', 112, 3, 'harp', 'light')),
  F('fae', 'winter', 'frost_ball', 'The Frost Ball', 'The Court dances on the frozen pond in gowns of rime, and whoever slips must tell a true thing.', 'Dancing at the Frost Ball',
    m('Snow Sugar', { berries: 1, herbs: 1 }, ['Food', 3, 1], 'It melts on the tongue and then you remember something.'), m('Ice Brooches', { stone: 2 }, ['Amulet', 1, 0], 'They stay cold all year.'),
    'hearth', { lever: 'research', mult: 1.08, text: 'True things told at the Frost Ball' }, 'crystal', [0xd0f0ff, 0xc0a0ff, 0xffffff], 0xd0e8ff, song('Rime Waltz', 'lydian', 96, 3, 'bell', 'none')),
  // ---- the alchemists' crucible
  F('alchemists', 'spring', 'quickening', 'The Quickening', 'Every flask in the crucible is opened to the spring air, and the town drinks a drop of the year\'s first tincture for luck.', 'Drinking to the Quickening',
    m('Green Tincture', { herbs: 2 }, ['Potion', 4, 0], 'Tastes of grass and lightning.'), m('Glass Charms', { clay: 1, stone: 1 }, ['Potion', 1, 3], 'A bead of coloured glass.'),
    'harvest', { lever: 'crops', mult: 1.08, text: 'The Quickening\'s tincture' }, 'flasks', [0x60e060, 0xf0d040, 0x60a0e0], 0xa0ff80, song('Quickening', 'lydian', 116, 4, 'bell', 'light')),
  F('alchemists', 'summer', 'solar_distillation', 'The Solar Distillation', 'At noon on the longest day the sun is caught in a great glass and its heat is distilled into a single gold drop.', 'At the Solar Distillation',
    m('Sun Syrup', { berries: 2 }, ['Potion', 3, 0], 'Gold and very sweet.'), m('Burning Glasses', { clay: 2 }, ['Tool', 3, 2], 'A lens to catch the sun.'),
    'sky', { lever: 'research', mult: 1.1, text: 'The gold drop distilled' }, 'flasks', [0xf0c030, 0xf06020, 0xffffff], 0xfff080, song('The Gold Drop', 'ionian', 124, 4, 'brass', 'light')),
  F('alchemists', 'autumn', 'fermentation_fair', 'The Fermentation Fair', 'Every brewer, vintner and alchemist sets out the year\'s ferments to be judged. Some of them are alive. Some of them judge back.', 'Judging the Fermentation Fair',
    m('Pickled Roots', { herbs: 1, berries: 1 }, ['Food', 0, 3], 'Sharp and purple.'), m('Stoppered Vials', { clay: 2 }, ['Potion', 0, 3], 'Tiny ferments, for sale.'),
    'harvest', { lever: 'craft', mult: 1.1, text: 'The Fair\'s best ferments' }, 'flasks', [0xa040c0, 0x60c060, 0xe0a040], 0xd080ff, song('Bubbling', 'mixolydian', 108, 3, 'pluck', 'light')),
  F('alchemists', 'winter', 'nigredo_night', 'Nigredo Night', 'The blackest night of the year is the first stage of the Great Work. Every fire burns black, and the crucible waits for the white.', 'Watching on Nigredo Night',
    m('Black Broth', { herbs: 1, meat: 1 }, ['Potion', 2, 2], 'It is better than it looks.'), m('Salt Sigils', { stone: 2 }, ['Scroll', 1, 0], 'Salt pressed into the Work\'s signs.'),
    'hearth', { lever: 'research', mult: 1.1, text: 'The Work deepened on Nigredo Night' }, 'flasks', [0x202020, 0xd0d0d0, 0xa040c0], 0xc0a0ff, song('Nigredo', 'phrygian', 72, 4, 'organ', 'none')),
  // ---- the knights' order
  F('knights', 'spring', 'spring_tourney', 'The Spring Tourney', 'The Order rides out its first tourney of the year on the green, ladies\' favours on every lance, and the winner keeps watch on the walls till summer.', 'At the Spring Tourney',
    m('Venison Pasties', { meat: 2 }, ['Food', 1, 5], 'Eaten in the stands.'), m('Ladies\' Favours', { fiber: 2 }, ['Music', 1, 0], 'A ribbon for a lance.'),
    'war', { lever: 'fight', mult: 1.08, text: 'Honour won at the Tourney' }, 'banners', [0x3060c0, 0xf0c030, 0xe04040, 0xffffff], 0xffd060, song('Lances', 'ionian', 128, 4, 'brass', 'march')),
  F('knights', 'summer', 'feast_of_banners', 'The Day of Banners', 'Every knight\'s banner is carried round the walls and hung in the hall, and every name on them is read aloud.', 'Carrying the banners round the walls',
    m('Honey Mead', { berries: 2 }, ['Potion', 3, 1], 'Golden, for the toasts.'), m('Banner Pennants', { fiber: 2 }, ['Music', 2, 0], 'Little copies for the children.'),
    'sky', { lever: 'guard', mult: 1.08, text: 'The banners hung in the hall' }, 'banners', [0xe04040, 0xffffff, 0x3060c0, 0xf0c030], 0xffe080, song('Banners', 'mixolydian', 112, 4, 'brass', 'march')),
  F('knights', 'autumn', 'michaelmas_muster', 'The Michaelmas Muster', 'Before the winter every arm in the Order is counted and every blade is sharpened, and the squires are tested.', 'At the Michaelmas Muster',
    m('Roast Goose', { meat: 2 }, ['Flesh', 5, 0], 'The Muster\'s goose, for luck.'), m('Polished Badges', { stone: 1, wood: 1 }, ['Amulet', 0, 2], 'A squire\'s first badge.'),
    'war', { lever: 'fight', mult: 1.1, text: 'Every blade sharp after the Muster' }, 'war', [0x803020, 0xc0c0c0, 0xf0c030], 0xffb050, song('The Muster', 'dorian', 116, 4, 'brass', 'heavy')),
  F('knights', 'winter', 'twelfth_night', 'Twelfth Night', 'The lowest squire is made king for a night and the lords serve at table. Whatever is said in jest that night is forgiven.', 'At the Twelfth Night revels',
    m('Twelfth Cake', { berries: 2 }, ['Food', 2, 4], 'With a bean in it: whoever finds it is king.'), m('Paper Crowns', { fiber: 1, wood: 1 }, ['Hat', 2, 0], 'Every head a king.'),
    'hearth', { lever: 'work', mult: 1.06, text: 'Merry after Twelfth Night' }, 'candles', [0xf0c030, 0x3060c0, 0xe04040], 0xffd080, song('The Bean King', 'ionian', 100, 3, 'pluck', 'light')),
  // ---- the orc warband
  F('orcs', 'spring', 'mud_bash', 'The Mud Bash', 'When the thaw turns the camp to mud the warband wrestles in it till nobody can tell who\'s who. The last one standing is clean all year. Nobody is.', 'Wrestling in the Mud Bash',
    m('Grub Skewers', { meat: 2 }, ['Flesh', 3, 0], 'Crunchy.'), m('Mud Paint', { clay: 2 }, ['Potion', 2, 3], 'Smeared on for the bash.'),
    'war', { lever: 'fight', mult: 1.08, text: 'Toughened in the Mud Bash' }, 'war', [0x6a8a2a, 0x8a5a2a, 0xe04040], 0xffa040, song('Mud', 'phrygian', 132, 4, 'brass', 'heavy')),
  F('orcs', 'summer', 'big_burn', 'The Big Burn', 'The warband builds the biggest fire it can and jumps over it. Whoever jumps highest gets to name the next raid.', 'Jumping the Big Burn',
    m('Charred Haunches', { meat: 3 }, ['Flesh', 2, 0], 'Burnt black. As is right.'), m('Tusk Charms', { bone: 2 }, ['Amulet', 0, 1], 'Rattling on a thong.'),
    'sky', { lever: 'build', mult: 1.08, text: 'Fired up by the Big Burn' }, 'fire', [0xf06020, 0xf0c030, 0x303030], 0xff6020, song('Over the Fire', 'harmonic', 148, 4, 'brass', 'heavy')),
  F('orcs', 'autumn', 'skull_harvest', 'The Skull Harvest', 'The year\'s trophies are counted, polished and piled up on the war totem, and each one gets a story, shouted.', 'Shouting at the Skull Harvest',
    m('Grog Stew', { meat: 1, berries: 1 }, ['Potion', 1, 2], 'Mostly grog.'), m('Polished Skulls', { bone: 2 }, ['Money', 4, 4], 'Shiny, and proud of it.'),
    'war', { lever: 'fight', mult: 1.1, text: 'The skulls piled high' }, 'bones', [0xd0c0a0, 0xe04040, 0x303030], 0xff8040, song('Skull Pile', 'phrygian', 120, 4, 'organ', 'heavy')),
  F('orcs', 'winter', 'grog_night', 'Grog Night', 'The year\'s grog is drunk in one night, all of it, so none of it freezes. In the morning the warchief counts who is still breathing.', 'Drinking all of it on Grog Night',
    m('Fat Ribs', { meat: 2 }, ['Flesh', 4, 0], 'Dripping.'), m('Grog Skins', { hide: 2 }, ['Potion', 1, 2], 'A skin each. Full.'),
    'hearth', { lever: 'work', mult: 1.06, text: 'Somehow cheerful after Grog Night' }, 'fire', [0x6a8a2a, 0xf0c030, 0x8a5a2a], 0xffb040, song('Grog', 'mixolydian', 136, 3, 'brass', 'march')),
];

export const FESTIVAL_BY_ID: Readonly<Record<string, FestivalDef>> = Object.fromEntries(FESTIVALS.map((f) => [f.id, f]));

/** A people's festival of a season. */
export const festivalFor = (origin: OriginId | undefined, season: Season): FestivalDef => FESTIVALS.find((f) => f.origin === (origin ?? 'settlers') && f.season === season)!;

/** The ids of a festival's food and ware. */
export const foodId = (f: FestivalDef) => `fest_${f.id}_food`;
export const wareId = (f: FestivalDef) => `fest_${f.id}_ware`;

/** The festivals' foods and wares, made at the fire with no study (merged into ITEMS). */
export const FESTIVAL_ITEMS: readonly ItemDef[] = FESTIVALS.flatMap((f): ItemDef[] => [
  { id: foodId(f), name: f.food.name, slot: null, station: 'campfire', cost: f.food.cost, seconds: 30, research: [], effects: {}, description: `Made for ${f.name}: ${f.food.text}`, icon: { sheet: f.food.icon[0], x: f.food.icon[1], y: f.food.icon[2] } },
  { id: wareId(f), name: f.ware.name, slot: null, station: 'campfire', cost: f.ware.cost, seconds: 40, research: [], effects: {}, description: `Made for ${f.name}, and sold to the visitors: ${f.ware.text}`, icon: { sheet: f.ware.icon[0], x: f.ware.icon[1], y: f.ware.icon[2] } },
]);
export const FESTIVAL_ITEM_IDS: ReadonlySet<string> = new Set(FESTIVAL_ITEMS.map((i) => i.id));
