// Founders' own callings: every ready-made founder (data/founders.ts) has a class line no one else has, five stages
// named for them and their origin, in place of a calling rolled at random. Each stands on a base class (data/classes.ts)
// for what they wear and wield and the spells and skills they learn, and fights a step above it (`FOUNDER_EDGE` on the
// base's edge, and a signature stat of their own).

import { CLASS_DEFS, type ClassId, type ClassStats } from './classes';
import { lineage, PATH_BY_ID } from './paths';

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
  F('mogra', 'shaman', ['Bone-Thrower', 'The Bone-Reader', 'Witch Doctor', 'Mother of Omens', 'The Last Bone'], 'Foul brews for the hurt and worse for the foe; the bones always say war.', { healing: 1.35, power: 1.2 }),
];

export const FOUNDER_CLASS: Readonly<Record<string, FounderClassDef>> = Object.fromEntries(FOUNDER_CLASSES.map((f) => [f.id, f]));

type Classed = { cls?: ClassId | null; fcls?: string | null; road?: string | null };

/** The name of someone's calling at a stage: their founder's line if they have one, else their class's. */
export function callingName(p: Classed, stage: number): string | null {
  const st = Math.max(0, Math.min(4, stage));
  const f = p.fcls ? FOUNDER_CLASS[p.fcls] : undefined;
  if (f) return f.stages[st];
  // (on a path: the node of their road at that stage, data/paths.ts)
  if (p.road && PATH_BY_ID[p.road]) {
    const line = lineage(p.road);
    return (line[st] ?? line[line.length - 1]).name;
  }
  return p.cls ? CLASS_DEFS[p.cls].stages[st] : null;
}

/** What their calling is about (founder line or class). */
export const callingText = (p: Classed): string => (p.fcls && FOUNDER_CLASS[p.fcls] ? FOUNDER_CLASS[p.fcls].description : p.road && PATH_BY_ID[p.road] ? PATH_BY_ID[p.road].text : p.cls ? CLASS_DEFS[p.cls].description : '');
