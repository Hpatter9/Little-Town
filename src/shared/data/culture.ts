// Town personality and culture (sim/culture.ts): a few dozen traits a town earns from what happened to it. Each is won
// by a kind of history (a `signal` the sim reads every day: hunger, a raid won, a long peace...), fades if that is never
// repeated, and shows in a custom (a yearly day with a dish), a song (a mode and a lead for the festival music), a saying
// (lines the townsfolk speak), a colour (a pennant at the gatherings), a prop (a few of a festival kit's things standing
// by the square) and, for some, a fashion in the children's names.

import type { Topic } from './natures';
import type { Season } from '../sim/time';
import type { ItemDef, IconSheet } from './items';
import type { Material } from './materials';
import type { DecorKit, FestivalSong } from './festivals';

/** What the town's history is read as, each day. */
export type CultureSignal = 'hunger' | 'plague' | 'raidWon' | 'raidLost' | 'peace' | 'sea' | 'trade' | 'deaths' | 'disaster' | 'plenty' | 'learning' | 'festive' | 'elders' | 'justice' | 'war' | 'births';

export const SIGNALS: readonly CultureSignal[] = ['hunger', 'plague', 'raidWon', 'raidLost', 'peace', 'sea', 'trade', 'deaths', 'disaster', 'plenty', 'learning', 'festive', 'elders', 'justice', 'war', 'births'];

/** How the children come to be named. */
export type Fashion = 'fallen' | 'heroes' | 'gods';

/** Strength is kept 0..STRENGTH_MOST; a trait is won at WIN and lost below LOSE; it fades by DECAY a day; the town holds
 *  HELD_MOST at once. */
export const STRENGTH_MOST = 40;
export const WIN = 12;
export const LOSE = 5;
export const DECAY = 0.96;
export const HELD_MOST = 5;
/** A newcomer to the held traits must beat the weakest of them by this much to take its place. */
export const DISPLACE = 4;
/** The custom day in its season (the festivals use the seventh and the days of making ready before it). */
export const CUSTOM_DAY = 2;
export const CUSTOM_HOUR = 18;
/** The dish is ordered from the season's first day; the custom's morale (hours), more with the dish made. */
export const CUSTOM_MARK: [number, number] = [5, 24];
export const DISH_MARK = 3;
export const DISH_MOST = 4;
/** Visitors remark on the town's ways about this often (days), if one comes by. */
export const REMARK_DAYS = 6;
/** Of the children born into a town with a fashion, this share are named by it. */
export const FASHION_SHARE = 0.6;

interface Dish {
  name: string;
  cost: Partial<Record<Material, number>>;
  icon: [IconSheet, number, number];
  text: string;
}

export interface CultureTrait {
  id: string;
  name: string;
  signal: CultureSignal;
  /** Strength a day gains per unit of the signal. */
  weight: number;
  /** How it is earned, in the card's words. */
  cause: string;
  custom: { name: string; text: string; season: Season };
  dish: Dish;
  /** What the townsfolk say, by topic (renderer/map/speech.ts). */
  saying: Partial<Record<Topic, string[]>>;
  /** What visitors say of it. */
  remark: string;
  song: Pick<FestivalSong, 'mode' | 'lead'>;
  colour: number;
  kit: DecorKit;
  prop: string;
  fashion?: Fashion;
  /** A tavern's sign, if this is the town's strongest trait. */
  sign: string;
}

const d = (name: string, cost: Dish['cost'], x: number, y: number, text: string): Dish => ({ name, cost, icon: ['Food', x, y], text });

export const CULTURE_TRAITS: readonly CultureTrait[] = [
  // ---- hunger
  { id: 'hoarders', name: 'Granary Keepers', signal: 'hunger', weight: 2.2, cause: 'A famine bit the town, and it swore never to be caught short again.', custom: { name: 'The Counting of Sacks', text: 'Every sack in the stores is counted aloud and the tally chalked on the granary door.', season: 'autumn' }, dish: d('Hard Biscuit', { berries: 1, fiber: 1 }, 1, 2, 'Dry biscuit that keeps all winter.'), saying: { hungry: ['Keep a sack back.', 'We never waste a crumb.'], idle: ['Count the sacks again?'] }, remark: 'Strangers remark that the granary has three locks and a guard, in a town with so little to steal.', song: { mode: 'dorian', lead: 'flute' }, colour: 0xc8a050, kit: 'harvest', prop: 'sacks and a crate by the granary', fashion: 'fallen', sign: 'The Full Granary' },
  { id: 'lean_day', name: 'Lean-Day Mourners', signal: 'hunger', weight: 1.8, cause: 'Those who starved are kept in mind.', custom: { name: 'Lean Day', text: 'On the hungry winter\'s anniversary the town fasts till dusk, then feasts together.', season: 'winter' }, dish: d('Famine Stew', { meat: 1, herbs: 1 }, 3, 1, 'Thin stew eaten on Lean Day, thick with remembering.'), saying: { hungry: ['Remember the lean year.', 'Nobody starves on my watch.'], feast: ['Eat! No one goes hungry now.'] }, remark: 'A traveller is told the town fasts one day a year, and feasts the next, and nobody will say why without tears.', song: { mode: 'aeolian', lead: 'organ' }, colour: 0x8a7a68, kit: 'candles', prop: 'candles for the lean winter\'s dead', fashion: 'fallen', sign: 'The Lean Year' },
  // ---- raids
  { id: 'drillmasters', name: 'Drill-Keepers', signal: 'raidWon', weight: 3, cause: 'A great raid was beaten off, and the town learned that it can fight.', custom: { name: 'Muster Day', text: 'The town drills in the square at dawn, children with wooden spears at the back.', season: 'spring' }, dish: d('Soldier\'s Bread', { fiber: 1, meat: 1 }, 2, 2, 'Dense bread for long marches.'), saying: { raid: ['We have beaten them before!', 'Spears up, as we drilled!'], work: ['Mind your stance.'] }, remark: 'Visitors are woken at dawn by drilling, and tell the next town that this one bristles.', song: { mode: 'mixolydian', lead: 'brass' }, colour: 0xc03a30, kit: 'war', prop: 'a drill post and banners', fashion: 'heroes', sign: 'The Spear and Shield' },
  { id: 'war_singers', name: 'War-Singers', signal: 'raidWon', weight: 2.4, cause: 'The victory was sung, and the songs stuck.', custom: { name: 'The Victory Verse', text: 'On the day the raiders broke, the whole square sings the long song of it.', season: 'summer' }, dish: d('Victory Mead Cake', { berries: 2, herbs: 1 }, 4, 3, 'Sweet cake soaked in mead.'), saying: { raid: ['Sing it loud, they flee!'], feast: ['Sing the Verse again!'], mourn: ['Sing them home.'] }, remark: 'Strangers hum the town\'s war song for a week after leaving.', song: { mode: 'phrygian', lead: 'brass' }, colour: 0xd8a030, kit: 'war', prop: 'banners and a drum rack', fashion: 'heroes', sign: 'The Singing Blade' },
  { id: 'wall_wardens', name: 'Wall-Wardens', signal: 'raidLost', weight: 3, cause: 'The town was pillaged, and it will not be again.', custom: { name: 'Watch-Night', text: 'Once a year every grown soul keeps one hour on the wall, with a lantern.', season: 'autumn' }, dish: d('Watchman\'s Broth', { meat: 1, herbs: 1 }, 5, 1, 'Hot broth taken up to the wall.'), saying: { raid: ['Not again. Never again.'], night: ['Who goes there?', 'All quiet. Too quiet.'] }, remark: 'The gate-wardens question every traveller, and some find it rude.', song: { mode: 'harmonic', lead: 'bell' }, colour: 0x6a7a90, kit: 'banners', prop: 'a lantern post', fashion: 'fallen', sign: 'The Last Watch' },
  // ---- peace and festivals
  { id: 'festival_folk', name: 'Festival Folk', signal: 'festive', weight: 4, cause: 'Many a festival kept well makes a town that loves them.', custom: { name: 'Lantern Eve', text: 'The night before each year turns, every house hangs a lantern out.', season: 'summer' }, dish: d('Sugared Twists', { berries: 2 }, 6, 4, 'Twists of fried dough, crusted with sugar.'), saying: { feast: ['One more dance!', 'Is it a festival yet?'], idle: ['What shall we celebrate next?'] }, remark: 'Strangers say there is always a ribbon on a post somewhere in this town.', song: { mode: 'ionian', lead: 'pluck' }, colour: 0xf080a0, kit: 'blossom', prop: 'ribbons and blossom pots', fashion: 'gods', sign: 'The Ribboned Pole' },
  { id: 'long_peace', name: 'Makers of Fine Things', signal: 'peace', weight: 1.3, cause: 'Years of quiet left time for craft.', custom: { name: 'Makers\' Fair', text: 'The best thing each hand made all year is set out on a long table.', season: 'spring' }, dish: d('Glazed Pastry', { berries: 1, herbs: 1 }, 4, 4, 'Delicate pastry only a patient kitchen makes.'), saying: { work: ['Take your time; do it well.', 'A fine joint, that.'], idle: ['Peaceful, isn\'t it?'] }, remark: 'Traders buy things in the market here just because they are beautiful.', song: { mode: 'lydian', lead: 'harp' }, colour: 0x90c0e0, kit: 'candles', prop: 'painted pots', fashion: 'gods', sign: 'The Painted Hand' },
  // ---- plague
  { id: 'bathers', name: 'Bath-Houses', signal: 'plague', weight: 3, cause: 'A plague taught the town to wash.', custom: { name: 'Washing Day', text: 'The whole town scrubs its houses, its bedding and itself, then eats together.', season: 'spring' }, dish: d('Herb Posy Tea', { herbs: 2 }, 1, 4, 'A tea of clean-smelling herbs.'), saying: { sick: ['Wash your hands!', 'Keep the sick apart.'], greet: ['Have you washed?'] }, remark: 'Visitors are sent to the baths before they are allowed near the hearth.', song: { mode: 'ionian', lead: 'bell' }, colour: 0x80d0e0, kit: 'grove', prop: 'herb pots', sign: 'The Clean Hearth' },
  { id: 'wary', name: 'Wary of Strangers', signal: 'plague', weight: 1.6, cause: 'The sickness came with strangers, and the town remembers.', custom: { name: 'Closing Week', text: 'Once a year the gates stay shut for a week and no one comes or goes.', season: 'winter' }, dish: d('Smoked Strips', { meat: 2 }, 2, 3, 'Meat smoked to last a week behind the gate.'), saying: { greet: ['Who are you, then?', 'Stay back a little.'], sick: ['It came with the strangers.'] }, remark: 'The first thing a visitor hears is "Where have you been?"', song: { mode: 'phrygian', lead: 'organ' }, colour: 0x6a8a60, kit: 'bones', prop: 'a fenced gate-post', sign: 'The Shut Gate' },
  // ---- sea
  { id: 'shanty', name: 'Shanty Singers', signal: 'sea', weight: 1, cause: 'Life by the water sets every task to a tune.', custom: { name: 'The Singing Tide', text: 'Spring\'s first spring tide is greeted with a hundred voices on the shore.', season: 'spring' }, dish: d('Chowder', { meat: 1, herbs: 1 }, 5, 2, 'Thick chowder in a bread bowl.'), saying: { sea: ['Haul away, my lads!', 'The tide brings, the tide takes.'], work: ['Heave-ho, and heave-ho!'] }, remark: 'Strangers are taught the chorus before they leave the quay.', song: { mode: 'mixolydian', lead: 'pluck' }, colour: 0x3a78c8, kit: 'sea', prop: 'nets and shells', sign: 'The Merry Mermaid' },
  { id: 'tide_blessers', name: 'Tide-Blessers', signal: 'sea', weight: 0.8, cause: 'The sea gives and takes; the town asks it kindly.', custom: { name: 'The Blessing of Boats', text: 'Every boat is garlanded and blessed at sunrise.', season: 'summer' }, dish: d('Salt Fish Loaf', { fiber: 1, meat: 1 }, 6, 2, 'Fish baked in a salted crust.'), saying: { sea: ['Bless the tide.', 'Calm water, kind sea.'], tired: ['The sea rocks me to sleep.'] }, remark: 'A sailor sees a shell on every doorframe and learns not to remove one.', song: { mode: 'dorian', lead: 'harp' }, colour: 0x40b0c0, kit: 'sea', prop: 'shell garlands', fashion: 'gods', sign: 'The Blessed Tide' },
  // ---- trade
  { id: 'hagglers', name: 'Haggling Folk', signal: 'trade', weight: 1.4, cause: 'So much trading that bargaining became a game.', custom: { name: 'The Great Haggle', text: 'A day when every price is argued, and the best argument is cheered.', season: 'autumn' }, dish: d('Market Pasty', { meat: 1, berries: 1 }, 3, 3, 'Handheld pasty sold from every stall.'), saying: { greet: ['What\'ll you give me for it?', 'A fair price? Never.'], work: ['I\'ve never been cheated twice.'] }, remark: 'Traders say they were beaten at haggling by a child, and loved it.', song: { mode: 'mixolydian', lead: 'pluck' }, colour: 0xe0b030, kit: 'gold', prop: 'coin chests', sign: 'The Fair Haggle' },
  { id: 'hospitable', name: 'Bread and Salt', signal: 'trade', weight: 1, cause: 'Many caravans, and the town learned to host.', custom: { name: 'Guest-Right Night', text: 'Every traveller in town eats at a householder\'s table, free.', season: 'winter' }, dish: d('Salt Loaf', { fiber: 2 }, 0, 2, 'Round loaf pressed with salt, offered to guests.'), saying: { greet: ['Bread and salt to you.', 'Come in, sit down.'] }, remark: 'Everyone is offered a place by a fire, whoever they are.', song: { mode: 'ionian', lead: 'flute' }, colour: 0xe0c898, kit: 'harvest', prop: 'a bread table', fashion: 'gods', sign: 'Bread and Salt' },
  // ---- disaster
  { id: 'ember_watchers', name: 'Ember-Watchers', signal: 'disaster', weight: 2.2, cause: 'Fire, flood or quake struck, and the town now watches for it.', custom: { name: 'Ash Day', text: 'A pale mark is drawn on every door, and the buckets are checked.', season: 'summer' }, dish: d('Ash Bannock', { fiber: 1, herbs: 1 }, 1, 3, 'Baked in embers.'), saying: { work: ['Check the buckets.'], night: ['Is the hearth banked?'], hot: ['Dry as tinder.'] }, remark: 'Every house has a bucket by the door, labelled with a name.', song: { mode: 'aeolian', lead: 'bell' }, colour: 0xd06020, kit: 'fire', prop: 'water buckets', sign: 'The Bucket Brigade' },
  { id: 'storm_wise', name: 'Storm-Wise', signal: 'disaster', weight: 1.4, cause: 'The weather struck hard; the town reads the sky.', custom: { name: 'Sky-Reading', text: 'The elders read the year\'s weather in clouds and bird flight.', season: 'autumn' }, dish: d('Storm Bread', { fiber: 1, berries: 1 }, 2, 4, 'Dense bread baked before the weather turns.'), saying: { rain: ['Told you so.', 'Batten the roofs!'], cold: ['The sky\'s turning.'] }, remark: 'Locals look at the sky before answering anything.', song: { mode: 'dorian', lead: 'flute' }, colour: 0x7088a8, kit: 'sea', prop: 'a weathervane', sign: 'The Weathercock' },
  // ---- plenty
  { id: 'harvest_glad', name: 'The Open-Handed', signal: 'plenty', weight: 0.9, cause: 'Full stores, year after year, make a generous town.', custom: { name: 'Sharing Day', text: 'The stores are opened and a bowl goes to every door.', season: 'autumn' }, dish: d('Overflow Pie', { meat: 1, berries: 2 }, 4, 5, 'A pie made of whatever overflowed.'), saying: { hungry: ['There\'s always a bowl for you.'], greet: ['Have you eaten?'] }, remark: 'Strangers say it is the only place they were fed before they asked.', song: { mode: 'ionian', lead: 'flute' }, colour: 0xe0a040, kit: 'harvest', prop: 'baskets of fruit', sign: 'The Open Hand' },
  // ---- learning
  { id: 'scholars', name: 'Scholars\' Town', signal: 'learning', weight: 1.4, cause: 'Learning after learning made reading a pride.', custom: { name: 'Question Night', text: 'The wisest are asked questions by anyone, and must answer or buy the round.', season: 'winter' }, dish: d('Lamplight Cake', { berries: 1, herbs: 1 }, 5, 4, 'Eaten while reading late.'), saying: { idle: ['I wonder why that is.', 'Have you read it yet?'], work: ['Let me think it through.'] }, remark: 'Children ask visitors riddles and wait for the answer.', song: { mode: 'lydian', lead: 'harp' }, colour: 0x7060c0, kit: 'candles', prop: 'a lectern and candles', sign: 'The Open Book' },
  // ---- elders
  { id: 'ancestor_honour', name: 'Ancestor-Keepers', signal: 'elders', weight: 1.6, cause: 'Many died in their beds, full of days; the town keeps them by.', custom: { name: 'Remembrance Eve', text: 'A place is laid for the dead at every table.', season: 'autumn' }, dish: d('Ancestors\' Cake', { berries: 1, herbs: 1 }, 6, 3, 'A small cake left on the empty plate.'), saying: { old: ['My mother\'s mother said so.', 'The old ways hold.'], mourn: ['They are at the table still.'] }, remark: 'There is an empty chair at every supper, and nobody sits in it.', song: { mode: 'aeolian', lead: 'harp' }, colour: 0xb09870, kit: 'candles', prop: 'candles for the elders', fashion: 'fallen', sign: 'The Empty Chair' },
  { id: 'mourners', name: 'Keepers of Grief', signal: 'deaths', weight: 1.5, cause: 'So many lost, the town made a ritual of grief.', custom: { name: 'The Long Wake', text: 'All night the names of the fallen are read, and each is answered with "here".', season: 'winter' }, dish: d('Wake Bread', { fiber: 1, herbs: 1 }, 0, 3, 'Plain bread eaten at the wake.'), saying: { mourn: ['Here.', 'We say your name.'], idle: ['I think of them still.'] }, remark: 'A traveller is asked to say the name of someone they have lost.', song: { mode: 'phrygian', lead: 'organ' }, colour: 0x505868, kit: 'bones', prop: 'name-stones', fashion: 'fallen', sign: 'The Long Wake' },
  // ---- justice, war, births
  { id: 'strict_justice', name: 'Oath-Keepers', signal: 'justice', weight: 2.5, cause: 'The town has hanged its own, and holds that a word given must be kept.', custom: { name: 'Oath Day', text: 'All grown folk say the town\'s oath aloud before the elders.', season: 'spring' }, dish: d('Oath Bread', { fiber: 1, berries: 1 }, 1, 5, 'Broken and shared when the oath is sworn.'), saying: { protest: ['An oath is an oath.'], rival: ['You gave your word.'] }, remark: 'Contracts here are spoken, not written, and never broken.', song: { mode: 'dorian', lead: 'brass' }, colour: 0x8a4040, kit: 'war', prop: 'an oath-stone', sign: 'The Oath-Stone' },
  { id: 'veterans', name: 'Veterans\' Town', signal: 'war', weight: 2, cause: 'The town has sent its own to fight, and honours the returned.', custom: { name: 'The Old Soldiers\' Walk', text: 'Those who fought march slowly through the square while the rest bow.', season: 'summer' }, dish: d('Campfire Hardtack', { fiber: 1, meat: 1 }, 3, 2, 'Eaten the way it was on campaign.'), saying: { raid: ['I\'ve seen worse.', 'Stay low, stay together.'], old: ['I fought in the lean years.'] }, remark: 'Old soldiers drink for free; younger folk fall quiet as they pass.', song: { mode: 'mixolydian', lead: 'brass' }, colour: 0x806038, kit: 'war', prop: 'a flag-stand', fashion: 'heroes', sign: 'The Old Soldier' },
  { id: 'cradle_song', name: 'Cradle-Singers', signal: 'births', weight: 2, cause: 'Many children were born, and the town sang them in.', custom: { name: 'Naming Morning', text: 'Every child of the year is named aloud at dawn, with a song.', season: 'spring' }, dish: d('Milk Pudding', { berries: 1, herbs: 1 }, 0, 4, 'Sweet pudding for the little ones.'), saying: { child: ['Little one, little one...', 'Sleep, my star.'], greet: ['How\'s the babe?'] }, remark: 'There is a song for every chore, and the children know them all.', song: { mode: 'ionian', lead: 'harp' }, colour: 0xf8c0d0, kit: 'blossom', prop: 'flower pots', fashion: 'gods', sign: 'The Cradle and Star' },
];

export const TRAIT_BY_ID: Readonly<Record<string, CultureTrait>> = Object.fromEntries(CULTURE_TRAITS.map((t) => [t.id, t]));
export const dishId = (t: Pick<CultureTrait, 'id'>) => `cult_${t.id}_dish`;

/** The traits' dishes, made at the fire with no study (merged into ITEMS). */
export const CULTURE_ITEMS: readonly ItemDef[] = CULTURE_TRAITS.map((t): ItemDef => ({ id: dishId(t), name: t.dish.name, slot: null, station: 'campfire', cost: t.dish.cost, seconds: 30, research: [], effects: {}, description: `The town's own custom, ${t.custom.name}: ${t.dish.text}`, icon: { sheet: t.dish.icon[0], x: t.dish.icon[1], y: t.dish.icon[2] } }));
export const CULTURE_ITEM_IDS: ReadonlySet<string> = new Set(CULTURE_ITEMS.map((i) => i.id));
