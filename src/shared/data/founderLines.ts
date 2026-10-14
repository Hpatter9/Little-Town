// Founders' own callings (the data: data/founderClasses.ts has the rules that read them). Every ready-made founder
// (data/founders.ts) has a class line no one else has, five stages named for them and their origin, standing on a
// base class (data/classes.ts) for what they wear and wield and the spells and skills they learn, and fighting a step
// above it (`FOUNDER_EDGE`). At each of the first three evolutions they choose (the owner's ask: founders evolve like
// everyone else): the line's own next stage (its signature stats), or a road of their own making (`roads`, with the
// `bent` stats); data/paths.ts makes the choices nodes on the tree (`FOUNDER_PATHS`). The last stage is the line's.

import type { ClassId, ClassStats } from './classes';

export interface FounderClassDef {
  /** The founder's id (data/founders.ts). */
  id: string;
  base: ClassId;
  stages: readonly [string, string, string, string, string];
  description: string;
  /** Their own edge, over the base class's stats. */
  stats: Partial<ClassStats>;
}

/** How much more a founder's class gives than its base (on the base's edge over plain). */
export const FOUNDER_EDGE = 1.35;

const F = (id: string, base: ClassId, stages: FounderClassDef['stages'], description: string, stats: Partial<ClassStats>): FounderClassDef => ({ id, base, stages, description, stats });

export const FOUNDER_CLASSES: readonly FounderClassDef[] = [
  // the Settlers
  F('maren', 'druid', ['Hearth-Keeper', 'Harvest Mother', 'Seedwarden', 'Keeper of the Fields', 'The Eternal Hearth'], 'Her fire is the heart of the town; what she plants grows, and what she tends heals.', { healing: 1.35, hp: 1.1 }),
  F('tobin', 'ranger', ['Wayfinder', 'Trailblazer', 'Pathlord', 'Warden of the Valleys', 'The Far Horizon'], 'Never lost and never far: arrows from where no one is looking.', { accuracy: 0.1, dodge: 0.06 }),
  F('edda', 'mage', ['Schoolmistress', 'Lorekeeper', 'Sage of Letters', 'Grand Scholar', 'The Living Library'], 'Knows a little of everything, and a great deal about the rest.', { power: 1.4, hp: 0.95 }),
  // the Liches
  F('morvain', 'necromancer', ['Bone Sorcerer', 'The Bone King', 'Lord of the Ossuary', 'Lich Emperor', 'The Undying Crown'], 'A crown on a skull, and a kingdom of the patient dead.', { power: 1.4 }),
  F('ashka', 'guardian', ['Crypt-Keeper', 'Grave-Warden', 'Tomb Sentinel', 'Bastion of Bones', 'The Eternal Vigil'], 'Three hundred years at a crypt door; she has never let anything past.', { hp: 1.45, armor: 0.1 }),
  F('quill', 'summoner', ['Scrivener', 'The Archivist', 'Inkbound', 'Lorewraith', 'The Unfinished Page'], 'What he writes down comes when he calls it.', { power: 1.35, speed: 0.92 }),
  // the Druids
  F('rowan', 'druid', ['Grove-Tender', 'Oak-Speaker', 'Heartwood', 'Elder of the Wilds', 'The Green Throne'], 'The trees lean in when he speaks, and sometimes they answer.', { power: 1.3, healing: 1.25 }),
  F('briar', 'ranger', ['Thornling', 'The Thornward', 'Bramble Stalker', 'Briar Sovereign', 'The Living Thicket'], 'An arrow from the brambles before you see her.', { crit: 0.1, accuracy: 0.08 }),
  F('ilka', 'shaman', ['Hedge-Healer', 'The Herb-Wife', 'Root Mother', 'Wise of the Glade', 'The Green Remedy'], 'A cure for every ill, and a poison for every cure.', { healing: 1.45 }),
  // the Blood Court
  F('ilse', 'spellblade', ['Fallen Countess', 'Countess of the Long Night', 'Blood Duchess', 'Empress of Night', 'The Eternal Dusk'], 'A court in exile, a sword in one hand and blood magic in the other.', { power: 1.25, damage: 1.2 }),
  F('varn', 'blood_knight', ['Risen Captain', 'The Warlord', 'Crimson General', 'Blood Tyrant', 'Lord of Ten Thousand Graves'], 'Rose from the battle he lost, and has not lost one since.', { damage: 1.35, hp: 1.15 }),
  F('severin', 'alchemist', ['Barber-Surgeon', 'The Physician', 'Hemomancer', 'Master of Veins', 'The Cure for Death'], 'A doctor of blood, who knows what it costs to keep it flowing.', { healing: 1.3, power: 1.2 }),
  // the Werewolves
  F('greymane', 'warrior', ['Packrunner', 'Alpha of the Ridge', 'Silver Fang', 'Moonlord', 'The Unbowed'], 'Scarred, silver-shot and unbeaten.', { damage: 1.35, hp: 1.15 }),
  F('sable', 'hunter', ['Shadow-Stalker', 'The Moon-Hunter', 'Night Fang', 'Eclipse Hunter', 'The Unseen Kill'], 'Never seen until the kill.', { crit: 0.12, dodge: 0.06 }),
  F('fenn', 'beast_tamer', ['Wolf-Caller', 'The Howl-Sage', 'Elder of Howls', 'Voice of the Pack', 'The First Wolf'], 'Every wolf in the hills comes when he calls.', { hp: 1.2, power: 1.2 }),
  // the Machines
  F('ax7', 'engineer', ['Construction Drone', 'The Foreman', 'Architect Unit', 'Master Fabricator', 'Colony Prime'], 'Builds, mends and fortifies, by the plan or a better one.', { armor: 0.08, damage: 1.15 }),
  F('calliope', 'mage', ['Index Engine', 'Archive Mind', 'Logic Core', 'Oracle Array', 'The Total Library'], 'Has read everything aboard, and works out the rest.', { power: 1.4, accuracy: 0.06 }),
  F('warden9', 'guardian', ['Hold Sentry', 'The Sentinel', 'Bulwark Frame', 'Citadel Unit', 'Aegis Absolute'], 'Decided the whole colony is the hold now, and guards it.', { hp: 1.4, armor: 0.12 }),
  // the Dwarves
  F('thrain', 'warrior', ['Hold-Thane', 'Lord of the Hold', 'Deepaxe', 'Mountain King', 'The Undermountain'], 'Leads from the front with an axe older than the hold.', { damage: 1.3, armor: 0.06 }),
  F('hilda', 'spellblade', ['Rune-Apprentice', 'The Runesmith', 'Rune-Forger', 'Anvil Sovereign', 'The Unbroken Rune'], 'Every blade she makes has a name, and hers has a rune for every one of them.', { damage: 1.2, power: 1.25 }),
  F('grumli', 'engineer', ['Tunneler', 'The Delver', 'Seam-Seeker', 'Deep Prospector', 'Heart of the Mountain'], 'Smells ore through solid rock, and blasts his way to it.', { hp: 1.2, damage: 1.15 }),
  // the Merfolk
  F('nerissa', 'bard', ['Shore-Singer', 'The Tide-Singer', 'Siren of the Shoals', 'Voice of the Deep', 'The Endless Song'], 'Her songs call fish to the nets and courage to the fighters.', { power: 1.35 }),
  F('kael', 'dragoon', ['Reef-Spear', 'The Harpooner', 'Shark-Slayer', 'Leviathan Hunter', 'The Riptide'], 'A harpoon thrown true, from the reef or from the deep.', { damage: 1.3, crit: 0.06 }),
  F('coralie', 'chronomancer', ['Shell-Reader', 'Tide-Seer', 'Oracle of Currents', 'Keeper of Tides', 'The Deep Fate'], 'Reads the tides in shells, and turns them.', { power: 1.35, speed: 0.92 }),
  // the Nomads
  F('temur', 'dragoon', ['Horse-Lord', 'Khan of the Steppe', 'Great Khan', 'Khan of Khans', 'The Endless Steppe'], 'At the head of the caravan, lance first.', { damage: 1.25, hp: 1.15 }),
  F('aylin', 'bard', ['Caravan-Trader', 'The Silk-Trader', 'Merchant Prince', 'Master of the Silk Road', 'The Golden Road'], 'Talks her way past anything, and her friends fight the better for it.', { power: 1.3, dodge: 0.06 }),
  F('batu', 'archer', ['Outrider', 'The Rider-Scout', 'Steppe Arrow', 'Windrider', "The Horizon's Eye"], 'Sees them a day away, and shoots them from as far.', { accuracy: 0.12, crit: 0.06 }),
  // the Fae
  F('oriel', 'summoner', ['Summer Courtier', 'Queen of the Summer Court', 'Sun-Crowned', 'High Queen of Faerie', 'The Eternal Summer'], 'Calls the Summer Court to her side, and expects it to come.', { power: 1.4 }),
  F('puck', 'dancer', ['Prankster', 'The Trickster', 'Hob of Mischief', 'Lord of Misrule', 'The Laughing Wild'], 'Nobody can catch him; somehow the foe trips over their own feet.', { dodge: 0.12, speed: 0.9 }),
  F('morwen', 'mage', ['Frost Courtier', 'Lady of the Winter Court', 'Rime Sage', 'Winter Regent', 'The Long Winter'], 'Cold, clever and very old; her spells bite like midwinter.', { power: 1.45, hp: 0.95 }),
  // the Alchemists
  F('voss', 'alchemist', ['Expelled Scholar', 'The Transmuter', 'Magister of Gold', 'Grand Magister', "The Philosopher's Stone"], 'Turns lead to gold, and foes to something worse.', { power: 1.35 }),
  F('ottilie', 'engineer', ['Tinkerer', 'The Volatile', 'Demolitionist', 'Master of Blasts', 'The Great Detonation'], 'Close to something big; usually the thing that explodes.', { damage: 1.35, crit: 0.05 }),
  F('isolde', 'white_mage', ['Tonic-Brewer', 'The Physick', 'Tonic-Master', 'Panacea', 'The Universal Cure'], 'A tonic for every ailment; the side effects are part of the cure.', { healing: 1.45 }),
  // the Knights
  F('aldric', 'knight', ['Disgraced Knight', 'The Oathbound', 'Oathkeeper', 'Paragon', 'The Unbroken Oath'], 'Kept his sword and his oath when he lost everything else.', { hp: 1.3, damage: 1.15 }),
  F('yseult', 'guardian', ['Shield-Bearer', 'The Shieldmaiden', 'Bridge-Holder', 'Bastion of the Order', 'The Unyielding Wall'], 'Held a bridge alone for a night and a day.', { hp: 1.35, armor: 0.1 }),
  F('cade', 'white_mage', ['Novice Chaplain', 'The Chaplain', 'Battle Priest', 'Abbot of the Order', 'Saint of the Field'], 'Prays over the wounded, then stitches them up; and swings a mace in between.', { healing: 1.35, damage: 1.15 }),
  // the Orcs
  F('grakk', 'warrior', ['Boss', 'The Warchief', 'Warboss', 'Overlord of the Horde', 'The Great Waaagh'], 'Leads from the front, and the horde follows the noise.', { damage: 1.35, hp: 1.2 }),
  F('ushna', 'blood_knight', ['Raider', 'Bloodaxe', 'Reaver Queen', 'Scourge of the Roads', 'The Red Harvest'], 'Every wound she gives heals one of hers; she gives a great many.', { damage: 1.3, crit: 0.06 }),
  F('mogra', 'shaman', ['Bone-Thrower', 'The Bone-Reader', 'Grub-Seer', 'Mother of Omens', 'The Last Bone'], 'Foul brews for the hurt and worse for the foe; the bones always say war.', { healing: 1.35, power: 1.2 }),
];


/** A founder's road of their own: a name and a line for each of the first three evolutions, and the stats it leans
 *  to (over the line's signature ones). */
export interface FounderRoads {
  alt: readonly [[string, string], [string, string], [string, string]];
  bent: Partial<ClassStats>;
}
const R = (a: [string, string], b: [string, string], c: [string, string], bent: Partial<ClassStats>): FounderRoads => ({ alt: [a, b, c], bent });

export const FOUNDER_ROADS: Readonly<Record<string, FounderRoads>> = {
  // the Settlers
  maren: R(['Hearth-Warden', 'Her fire keeps the raiders out as well as the cold in.'], ['Flame of the Commons', 'The hearth\'s fire carried into the fight: it burns foes and warms friends.'], ['Matriarch of the Realm', 'Mother to a town grown into a people; they fight like her children.'], { hp: 1.3, armor: 0.06 }),
  tobin: R(['Pathbreaker', 'Cuts the way through, blade first, where the trail runs out.'], ['Valley Hawk', 'Strikes from the heights and is gone before the shout.'], ['Lord of the Open Road', 'Every road is his; every traveller on it safe.'], { damage: 1.3, crit: 0.08 }),
  edda: R(['Hedge-Witch of Letters', 'Found the spells hidden in the old primers.'], ['Mistress of Wards', 'Writes wards in chalk on every door; the doors hold.'], ['Archivist of Power', 'Every spell ever written down, and she has read them all.'], { hp: 1.2, armor: 0.05 }),
  // the Liches
  morvain: R(['Bone Tyrant', 'Rules the dead by fear rather than law.'], ['Lord of Plagues', 'His breath is the grave\'s: the living sicken where he walks.'], ['The Black Sun', 'Where he rises, the light goes out.'], { damage: 1.3, crit: 0.06 }),
  ashka: R(['Barrow-Reaper', 'Leaves the door to cut down whoever comes for it.'], ['Gravecleaver', 'Her blade has opened more tombs than it has guarded.'], ['Reaper of the Long Watch', 'Three hundred years of waiting, spent in one terrible swing.'], { damage: 1.35, hp: 1.15 }),
  quill: R(['Ink-Hexer', 'Writes curses in the margins of the foe\'s fate.'], ['Palimpsest', 'Scrapes the living out of the story and writes the dead in.'], ['The Final Draft', 'What he writes last is what happened.'], { crit: 0.1, accuracy: 0.08 }),
  // the Druids
  rowan: R(['Thornfather', 'The wood\'s anger in a man\'s shape.'], ['Stormoak', 'An oak struck by lightning that kept the lightning.'], ['Wrath of the Wilds', 'The forest at war, and he walks at its head.'], { damage: 1.3, hp: 1.15 }),
  briar: R(['Bramble Warden', 'Stands in the thicket and lets nothing through.'], ['Rose of Thorns', 'Beautiful, and every inch of her cuts.'], ['Queen of the Hedge', 'The hedge is a wall, and the wall is hers.'], { hp: 1.3, armor: 0.08 }),
  ilka: R(['Nightshade', 'The poison side of the herb-lore.'], ['Mother of Rot', 'What she curses withers in a day.'], ['The Green Death', 'The cure\'s shadow: as sure, and far quicker.'], { power: 1.35, crit: 0.06 }),
  // the Blood Court
  ilse: R(['Crimson Duellist', 'Lays the spells down and lets the sword speak.'], ['Blade of the Court', 'The Court\'s champion, unbeaten in a hundred years of challenges.'], ['Sovereign Blade', 'Her sword is the law of the Long Night.'], { damage: 1.4, speed: 0.92 }),
  varn: R(['Iron Revenant', 'Came back from the dead in his armour, and never took it off.'], ['Grave Bastion', 'His men shelter behind him as they did in life.'], ['The Unburied Wall', 'No grave will hold him and no army get past.'], { hp: 1.4, armor: 0.1 }),
  severin: R(['Leech-Lord', 'Draws the blood out of the foe and into his patients.'], ['Plague Doctor', 'Carries sickness in one hand and its cure in the other.'], ['Master of the Red Tide', 'Every vein on the field answers him.'], { damage: 1.3, power: 1.3 }),
  // the Werewolves
  greymane: R(['Iron Hide', 'Scars on scars: the blows slide off.'], ['Old Grey', 'The pack\'s wall in a fight, and its memory after.'], ['The Last Wolf Standing', 'When the rest have fallen, he is still there.'], { hp: 1.35, armor: 0.08 }),
  sable: R(['Moon-Eye', 'Sees by moonlight as by day, and shoots by it.'], ['Silver Arrow', 'The hunter who hunts the hunters.'], ['Huntress of the Eclipse', 'Her shot comes when the moon goes out.'], { accuracy: 0.12, damage: 1.25 }),
  fenn: R(['Wolf-Kin', 'Runs with the wolves on four legs as well as two.'], ['Fang of the Elders', 'The old wolves\' strength in his jaws.'], ['The Great Wolf', 'Bigger than any wolf has a right to be.'], { damage: 1.35, dodge: 0.06 }),
  // the Machines
  ax7: R(['Siege Frame', 'The builder rebuilt as a battering ram.'], ['Demolisher', 'Takes things down faster than it ever put them up.'], ['Engine of Ruin', 'The colony\'s will to remove obstacles, given legs.'], { damage: 1.4, crit: 0.06 }),
  calliope: R(['War Logic', 'Has calculated the battle; the foe has not.'], ['Fire Control Array', 'Every shot placed by an equation.'], ['The Final Theorem', 'Proved that the foe loses. They did.'], { accuracy: 0.12, crit: 0.08 }),
  warden9: R(['Counter Frame', 'Every blow it takes, it returns.'], ['Retaliator', 'Its defence is the foe\'s worst idea.'], ['Judgement Protocol', 'Guards the hold by ending whatever threatens it.'], { damage: 1.3, crit: 0.06 }),
  // the Dwarves
  thrain: R(['Shieldfather', 'Sets the axe down and holds the gate with the shield.'], ['Stone Thane', 'As immovable as the mountain he rules.'], ['Mountain\'s Wall', 'The hold\'s last door has a beard.'], { hp: 1.4, armor: 0.1 }),
  hilda: R(['Rune-Warden', 'Cuts runes of warding into the line\'s shields.'], ['Rune of the Hearth', 'Her runes mend as well as guard.'], ['Living Rune', 'Every rune she ever cut, glowing on her skin.'], { hp: 1.3, armor: 0.08 }),
  grumli: R(['Blastmaster', 'Why dig when you can blow it up?'], ['Black Powder Thane', 'Every fight a quarry to be cleared.'], ['The Big Bang', 'The loudest dwarf ever to live.'], { damage: 1.4, crit: 0.06 }),
  // the Merfolk
  nerissa: R(['Storm-Siren', 'Her song brings the squall.'], ['Wrecker\'s Voice', 'Sings ships onto the rocks, and raiders onto spears.'], ['The Drowning Song', 'Those who hear it the wrong way never surface.'], { damage: 1.3, crit: 0.06 }),
  kael: R(['Reef-Guard', 'Plants the harpoon and holds the shallows.'], ['Coral Bastion', 'Hard as the reef and as hard to get past.'], ['The Breakwater', 'The sea\'s fury breaks on him.'], { hp: 1.35, armor: 0.1 }),
  coralie: R(['Undertow', 'Drags the foe down into the slow water.'], ['Riptide Sage', 'Turns the tide of a fight like the tide of the sea.'], ['The Fathomless', 'The deep\'s patience and its weight.'], { damage: 1.3, hp: 1.15 }),
  // the Nomads
  temur: R(['Horse-Archer Khan', 'Leaves the lance for the bow at the gallop.'], ['Khan of Arrows', 'His horde darkens the sky with shafts.'], ['The Storm of Hooves', 'An empire on horseback, and he at its head.'], { accuracy: 0.12, speed: 0.9 }),
  aylin: R(['Silk Blade', 'Hides a dagger in the silk.'], ['Dancer of the Bazaar', 'Haggles with steel when words run out.'], ['Queen of Knives', 'The road\'s most dangerous merchant.'], { damage: 1.3, crit: 0.08 }),
  batu: R(['Steppe Lancer', 'Rides close with the lance instead of far with the bow.'], ['Thunder Rider', 'His charge is heard a mile away.'], ['The Unhorsed Never', 'Has never once been knocked from the saddle.'], { damage: 1.35, hp: 1.15 }),
  // the Fae
  oriel: R(['Thorn Queen', 'The Summer Court\'s thorns, not its flowers.'], ['Queen of Wild Hunts', 'Leads the Court out riding, and the foe is the quarry.'], ['The Burning Summer', 'Summer as a drought and a wildfire.'], { damage: 1.3, crit: 0.06 }),
  puck: R(['Hob-Knight', 'Gets a sword, somehow, and is worse with it than anyone expected.'], ['Goodfellow', 'Pranks that heal the friends and harm the foes.'], ['The King of Fools', 'Nobody laughs last but him.'], { damage: 1.3, hp: 1.15 }),
  morwen: R(['Ice Warden', 'Wraps herself and hers in winter\'s armour.'], ['Rime Bastion', 'A wall of frost that thaws for no one.'], ['The Glacier', 'Slow, cold, and unstoppable.'], { hp: 1.35, armor: 0.1 }),
  // the Alchemists
  voss: R(['Gold-Hand', 'Turns his fists to gold and the foe\'s armour to lead.'], ['Living Crucible', 'Burns hotter than his own furnace.'], ['The Golden Ruin', 'Everything he touches turns, and none of it back.'], { damage: 1.35, hp: 1.15 }),
  ottilie: R(['Fuse-Keeper', 'Learned to point the bang the right way.'], ['Clockwork Bombardier', 'A satchel of timed charges and a very good watch.'], ['The Precise Explosion', 'The blast goes exactly where she wants it.'], { accuracy: 0.12, power: 1.25 }),
  isolde: R(['Acid Physick', 'The tonics that burn.'], ['Vitriol Mistress', 'Her flasks melt through shields.'], ['The Corrosive Cure', 'Cures the town of its enemies.'], { power: 1.35, crit: 0.06 }),
  // the Knights
  aldric: R(['Penitent Blade', 'Lays down his shield as penance and fights with both hands.'], ['Avenger', 'His oath now is that the guilty fall.'], ['The Avenging Oath', 'An oath that does not rest until it is kept.'], { damage: 1.4, crit: 0.06 }),
  yseult: R(['Lance-Maiden', 'Leaves the bridge for the charge.'], ['Banner Knight', 'Where her banner goes, the Order follows.'], ['Herald of the Charge', 'The charge that broke the siege, every time.'], { damage: 1.35, speed: 0.92 }),
  cade: R(['Mace of the Faith', 'Prays less and swings more.'], ['Hammer Chaplain', 'Blesses the line with every blow.'], ['The Righteous Hammer', 'The field\'s saint, and its terror.'], { damage: 1.35, hp: 1.15 }),
  // the Orcs
  grakk: R(['Big Mek Boss', 'Bolts iron to himself until he clanks.'], ['Iron Gob', 'More iron than orc, and more orc than anyone.'], ['The Ironclad Waaagh', 'A walking fortress of scrap and fury.'], { hp: 1.4, armor: 0.1 }),
  ushna: R(['Red Hand', 'Leaves the axe for two knives and goes quicker.'], ['Gutripper', 'Faster than any orc should be.'], ['The Crimson Blur', 'They never see the second cut.'], { speed: 0.88, crit: 0.1 }),
  mogra: R(['Weirdboy', 'The Waaagh\'s noise comes out of her ears as lightning.'], ['Green Storm', 'Raw Waaagh, aimed roughly at the foe.'], ['The Eye of Gork', 'Gork looks out through her, and does not like what he sees.'], { power: 1.4, crit: 0.06 }),
};
