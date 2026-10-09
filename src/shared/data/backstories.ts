// Everyone's own short story (the owner's ask: a background for every character, short, interesting and their own).
// Put together from where they came from (by their people), what they did before (by how they came: a hunter, a
// crafter, a hermit...), one telling thing about them, and what they want now (their ambition); each part picked by
// their id, so a person's story never changes and two people seldom share more than a line. Children born in the town
// get a story of their own birth. A ready-made founder keeps the story written for them.

import type { AmbitionId } from './ambitions';
import type { OriginId } from './origins';

/** Where they came from, by their people. */
const FROM: Record<OriginId, string[]> = {
  settlers: [
    'Grew up in a mill town on a slow brown river',
    'Was raised on a sheep farm where the wind never stopped',
    'Came from a fishing village that the sea took back',
    'Was born in a crowded city and left it at fifteen',
    'Grew up in a border fort, among soldiers and their wives',
    'Was raised by a grandmother in a cottage at the edge of a great wood',
    'Spent a childhood on the road with a family of tinkers',
  ],
  lich: [
    'Was a gravedigger in a town of plague, before the town was buried too',
    'Died in a war nobody now remembers, and woke in a barrow',
    'Was a scribe who copied one book too many, and was found at the desk years later',
    'Drowned in a lake of black water, and walked out of it',
  ],
  druid: [
    'Was born under an oak older than any kingdom',
    'Grew up among the standing stones, learning the turn of the year',
    'Was raised by a hermit who spoke more to birds than people',
    'Came from a village that worshipped a spring, until it ran dry',
  ],
  vampire: [
    'Was a servant in a great house that never opened its shutters',
    'Was born in a mountain village that paid its tithe in blood',
    'Grew up a noble\'s ward, kept indoors and taught to bow',
    'Was a gambler in a city of masks, until a bad wager',
  ],
  werewolf: [
    'Was born on a full moon in a hunter\'s hut',
    'Grew up wild in the hills, half raised by the pack',
    'Was bitten as a child and hidden by a frightened mother',
    'Came from a valley where the howling was a lullaby',
  ],
  robot: [
    'Was assembled in a foundry long since rusted shut',
    'Woke in a scrapyard with half a memory and no maker',
    'Was a mining unit that walked out of the dark one day',
    'Served a family of clockmakers until the last of them died',
  ],
  dwarves: [
    'Was born deep under the mountain, by forge light',
    'Grew up in a hold that fell to the deep things',
    'Was raised among the gem cutters of a far vein',
    'Came from a clan that keeps its grudges in a great book',
  ],
  merfolk: [
    'Was born in a kelp forest where the light comes down green',
    'Grew up on a reef, racing turtles',
    'Was raised in a drowned city by the tide clan\'s singers',
    'Came up out of the deep after a storm, and stayed in the shallows',
  ],
  nomads: [
    'Was born in a wagon on the move, between two rivers',
    'Grew up on horseback before learning to walk',
    'Was raised among the great herds of the grass sea',
    'Came from a horde that broke apart after a hard winter',
  ],
  fae: [
    'Was born in a ring of mushrooms on midsummer night',
    'Grew up in the court under the hill, where a day is a year',
    'Was a changeling swapped into a mortal cradle and swapped back',
    'Came from a glade that only exists at dusk',
  ],
  alchemists: [
    'Grew up in a guild hall full of stinking smoke and broken glass',
    'Was an apprentice whose master vanished in a green flash',
    'Was raised in a city of towers, among scholars and fools',
    'Came from a salt marsh, gathering what the guilds would buy',
  ],
  knights: [
    'Was born in a castle\'s kitchens and grew up among squires',
    'Was raised in a monastery that trained the Order\'s sons and daughters',
    'Grew up on a small estate with a proud name and an empty purse',
    'Came from a march-land where every child learns the spear',
  ],
  orcs: [
    'Was born in a raiding camp and weaned on smoke and meat',
    'Grew up fighting their brothers for scraps in the war-pits',
    'Was taken from a burned fort as a whelp and raised by the warband',
    'Came down from the black hills, where the orcs still keep to the old ways',
  ],
};

/** What they did before, by how they came. */
const BEFORE: Record<string, string[]> = {
  hunter: ['tracked deer for a lord who never paid on time', 'hunted wolves for a bounty, and kept the best pelt', 'trapped furs in the far north for three winters running'],
  gatherer: ['picked herbs for a healer and learned half her cures', 'gathered firewood for a whole village every autumn', 'foraged mushrooms and sold them at market, some of them safe'],
  crafter: ['worked a forge under a hard master', 'carved bowls and spoons and sold them at fairs', 'wove baskets fine enough to hold water'],
  hermit: ['lived alone on a crag for eleven years', 'kept a lighthouse until the ships stopped coming', 'tended a shrine no pilgrim visited'],
  elder: ['led a village council through two famines', 'taught a generation of children their letters', 'sailed as a ship\'s mate in their youth'],
  werewolf: ['ran with a pack until the pack turned on them', 'hid the curse for years behind a quiet trade'],
  vampire: ['lived among the living, feeding where no one would miss', 'kept a tavern open only after dark'],
  wanderer: [
    'drifted from town to town, working for a meal and a bed',
    'sold songs and stories along the high roads',
    'served as a soldier for a lord who lost',
    'drove a merchant\'s wagon until the merchant went broke',
    'worked the docks until a fight they don\'t talk about',
    'apprenticed to a cartographer and walked half the map',
    'kept bees and sold honey on a quiet road',
    'was a cook in a mercenary company',
  ],
};

/** One telling thing about them. */
const MARK: string[] = [
  'They still carry a letter they have never opened.',
  'They can\'t abide the sound of bells, and won\'t say why.',
  'They whistle the same tune whenever they work.',
  'They keep a lucky stone in each pocket, just in case.',
  'They have a scar across one palm from a promise kept.',
  'They talk to the fire as if it answers.',
  'They swear they once saw a dragon over the sea.',
  'They count everything: steps, stars, coins.',
  'They never eat the last of anything.',
  'They are terrified of geese.',
  'They write a line in a journal every night, in a language nobody else reads.',
  'They have a sister somewhere, and ask every traveller about her.',
  'They once lost everything at dice and still play.',
  'They know a hundred songs and the end of none of them.',
  'They plant a seed wherever they sleep for a week.',
  'They have never been ill a day in their life, and say so often.',
  'They keep a dried flower pressed in a book of law.',
  'They can tell the weather by the ache in an old wound.',
  'They are owed a favour by someone very important.',
  'They talk in their sleep, always about the sea.',
  'They have a knack for finding lost things.',
  'They keep the first coin they ever earned, drilled through on a string.',
  'They feed every stray that comes near.',
  'They were once mistaken for a prince and played along for a week.',
];

/** What they want now, by their ambition. */
const WANT: Record<AmbitionId, string[]> = {
  farmer: ['Now they want a field of their own and a good harvest.', 'Now they want to grow something that outlasts them.'],
  crafter: ['Now they want to make one thing so fine it is talked about after they\'re gone.', 'Now they want a workshop of their own.'],
  keeper: ['Now they want a shop with their name over the door.', 'Now they want to keep a warm house where travellers stop.'],
  adventurer: ['Now they want to see what lies past the edge of the map.', 'Now they want one great deed to be remembered for.'],
  scholar: ['Now they want to understand how the world truly works.', 'Now they want to write a book worth copying.'],
  guard: ['Now they want to keep this place safe, whatever it costs.', 'Now they want never to run from a fight again.'],
  homebody: ['Now they want a quiet home, a full larder and nothing to happen.', 'Now they want a family and a hearth.'],
  wealthy: ['Now they want to be rich, and they are counting.', 'Now they want enough gold that nobody can tell them no.'],
};

const pickOf = <T>(list: readonly T[], n: number): T => list[((n % list.length) + list.length) % list.length];
/** A number from the person's id and name, so each part is picked differently. */
function hash(id: number, name: string, salt: number): number {
  let h = (id * 2654435761 + salt * 40503) >>> 0;
  for (const c of name) h = ((h ^ c.charCodeAt(0)) * 16777619) >>> 0;
  return h;
}

export interface StoryOf {
  id: number;
  name: string;
  type: string;
  people: OriginId;
  ambition: AmbitionId | null;
  /** Born in this town, and to whom. */
  born?: { town: string; parents: string[] };
}

/** Someone's story, in two or three sentences. */
export function backstory(p: StoryOf): string {
  if (p.born) {
    const who = p.born.parents.length ? p.born.parents.join(' and ') : 'parents now gone';
    const first = `${p.name} was born in ${p.born.town} to ${who}, and knows no other home.`;
    return `${first} ${pickOf(MARK, hash(p.id, p.name, 3))}${p.ambition ? ` ${pickOf(WANT[p.ambition], hash(p.id, p.name, 4))}` : ''}`;
  }
  const from = pickOf(FROM[p.people] ?? FROM.settlers, hash(p.id, p.name, 1));
  const before = pickOf(BEFORE[p.type] ?? BEFORE.wanderer, hash(p.id, p.name, 2));
  return `${p.name} ${from.charAt(0).toLowerCase()}${from.slice(1)}, and ${before}. ${pickOf(MARK, hash(p.id, p.name, 3))}${p.ambition ? ` ${pickOf(WANT[p.ambition], hash(p.id, p.name, 4))}` : ''}`;
}
