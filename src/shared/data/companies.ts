// Bonded parties (the owner's ask): townsfolk who go out together and come home together, a couple of times, become a
// company: it names itself, is remembered, and its members go out together again.

/** Trips the same few must make together, and come home from, before they call themselves a company. */
export const BOND_TRIPS = 2;
/** The fewest of a party who must have gone together (and the fewest members a company keeps before it breaks up). */
export const BOND_LEAST = 2;
/** The most a company holds (a newcomer who goes out with it joins while there's room). */
export const COMPANY_MOST = 6;
/** The companies kept in the town's memory (those broken up drop off first), and the deeds each remembers. */
export const COMPANIES_KEPT = 12;
export const DEEDS_KEPT = 12;
/** Fellowships counted toward a bond (the oldest forgotten first). */
export const FELLOWS_KEPT = 40;
/** Recruiting: someone of the same company as one already going comes along before almost anyone. */
export const RECRUIT_COMPANY = 10;
/** A company's leader looks among the fit for their own first: a leader whose company is home and fit leads sooner. */
export const LEAD_COMPANY = 2;

/** The words a company's name is made from. */
export const NAME_ADJ = ['Iron', 'Grey', 'Red', 'Silver', 'Black', 'Lantern', 'Wandering', 'Lucky', 'Stubborn', 'Bright', 'Hollow', 'Thorn', 'Ember', 'Oak', 'Last', 'Merry', 'Weary', 'Crooked', 'Golden', 'Quiet'];
export const NAME_NOUN = ['Company', 'Band', 'Fellowship', 'Lanterns', 'Wolves', 'Blades', 'Wardens', 'Ravens', 'Hounds', 'Boots', 'Shields', 'Cloaks', 'Oath', 'Brotherhood', 'Rovers', 'Stags'];
/** A people's own words for a band, mixed in with the rest. */
export const ORIGIN_NOUN: Partial<Record<string, string[]>> = {
  vampires: ['Court', 'Night', 'Thirst'],
  liches: ['Barrow', 'Bones', 'Shroud'],
  druids: ['Grove', 'Thorns', 'Antlers'],
  werewolves: ['Pack', 'Fangs', 'Howl'],
  machines: ['Unit', 'Gears', 'Array'],
  dwarves: ['Delvers', 'Picks', 'Anvil'],
  merfolk: ['Tide', 'Shoal', 'Fins'],
  nomads: ['Riders', 'Horde', 'Hooves'],
  fae: ['Ring', 'Glamour', 'Wings'],
  alchemists: ['Crucible', 'Flasks', 'Salts'],
  knights: ['Order', 'Lances', 'Banner'],
  orcs: ['Warband', 'Tusks', 'Skulls'],
};
