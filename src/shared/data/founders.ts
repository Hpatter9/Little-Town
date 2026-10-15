// Ready-made founders: three for each origin, each a character of their own (a name and title, a line of story, a
// background in the origin's own terms, a trait or two, and a look built from the origin's pieces: a lich is bone in a
// tattered robe, a fae has wings, a machine is a frame of steel). The New Town screen offers the origin's three; the
// founder is whoever is picked (only their name can be changed).

import type { Background } from './founding';
import type { Look } from './people';
import type { OriginId } from './origins';

export interface FounderDef {
  id: string;
  name: string;
  /** Said after the name ("Countess Ilse, of the Long Night"). */
  title: string;
  story: string;
  /** Their skills and passions, named for the origin. */
  background: Background;
  traits: string[];
  look: Look;
  /** Who comes with them (recruit types), beyond the origin's own companions: a settler founder brings a friend, so
   *  the classic town doesn't start a person short of the others. */
  brings?: string[];
}

const bg = (id: string, name: string, description: string, skills: Background['skills'], passions: Background['passions']): Background => ({ id, name, description, skills, passions });

export const FOUNDERS: Readonly<Record<OriginId, readonly FounderDef[]>> = {
  settlers: [
    {
      id: 'maren',
      name: 'Maren Holt',
      title: 'the Hearth-Keeper',
      story: 'Left a burned village with her brother and seed corn sewn into her hem, and means to plant it.',
      background: bg('homesteader', 'Homesteader', 'Green fields early and full stores.', { farming: 5, cooking: 4, gathering: 3 }, ['farming', 'cooking']),
      traits: ['green_thumb'],
      brings: ['gatherer'],
      look: { gender: 'f', skin: '#e3b890', hair: 'ponytail', hairColor: '#6e4a2c', beard: false, outfit: '#5a7a3a', wear: ['torso_dress:#5a7a3a', 'belt_cloth:#c8a868', 'back_cape:#c87a2a', 'head_bandana:#c8a868', 'feet_shoes:#6a4a2a'] },
    },
    {
      id: 'tobin',
      name: 'Tobin Ashford',
      title: 'the Wayfinder',
      story: 'A trapper who knows every trail for three valleys, come down from the hills with his hunting partner.',
      background: bg('wayfinder', 'Wayfinder', 'Keeps the town fed and safe with spear and bow.', { ranged: 5, melee: 4, animals: 3 }, ['ranged', 'animals']),
      traits: ['tough'],
      brings: ['hunter'],
      look: { gender: 'm', skin: '#d6a67c', hair: 'unkempt', hairColor: '#4a3020', beard: true, outfit: '#6a5a3a', wear: ['torso_leather:#7a5a3a', 'hands_bracers', 'feet_boots', 'legs_pants:#4a3a2a', 'head_hood:#4a5a2a', 'back_quiver'] },
    },
    {
      id: 'edda',
      name: 'Edda Brightwater',
      title: 'the Learned',
      story: 'A schoolmistress with a satchel of books, a handy old friend, and more questions than answers.',
      background: bg('teacher', 'Teacher', 'Researches quickly; not much of a fighter.', { research: 5, medicine: 3, social: 3, melee: 1 }, ['research', 'social']),
      traits: ['quick_learner'],
      brings: ['crafter'],
      look: { gender: 'f', skin: '#f0cfa8', hair: 'bangs', hairColor: '#b88a58', beard: false, outfit: '#3a5a8a', wear: ['torso_robe:#3a5a8a', 'legs_robeskirt:#3a5a8a', 'belt_cloth:#e8c860', 'back_cape:#2a3a6a', 'head_tiara_s'] },
    },
  ],
  lich: [
    {
      id: 'morvain',
      name: 'Morvain',
      title: 'the Bone King',
      story: 'Once a court sorcerer. Now a crown on a skull, and a kingdom of the patient dead.',
      background: bg('bone_caller', 'Bone-Caller', 'Raises and reads: the dead answer, and the old books too.', { research: 5, medicine: 4, social: 3 }, ['research', 'medicine']),
      traits: ['night_owl'],
      look: { gender: 'm', skin: '#d8d0b8', hair: 'none', hairColor: '#000000', beard: false, outfit: '#3a2a4a', body: 'skeleton', wear: ['torso_robe:#3a2a4a', 'legs_robeskirt:#3a2a4a', 'torso_goldarms', 'head_tiara', 'back_tatter:#5a1a6a', 'belt_cloth:#c8a040'] },
    },
    {
      id: 'ashka',
      name: 'Sister Ashka',
      title: 'the Grave-Warden',
      story: 'She guarded a crypt for three hundred years. Now she guards the living who serve her.',
      background: bg('grave_warden', 'Grave-Warden', 'Holds the line and raises the walls.', { melee: 5, construction: 4, crafting: 3 }, ['melee', 'construction']),
      traits: ['tough'],
      look: { gender: 'f', skin: '#c8c0a8', hair: 'none', hairColor: '#000000', beard: false, outfit: '#4a4a52', body: 'skeleton', wear: ['torso_chain:#6a6a72', 'legs_robeskirt:#4a4a52', 'head_chainhood:#4a4a52', 'hands_bracers', 'back_tatter:#222228'] },
    },
    {
      id: 'quill',
      name: 'Old Quill',
      title: 'the Archivist',
      story: 'Died at his desk mid-sentence, and simply kept writing.',
      background: bg('archivist', 'Archivist', 'Learns everything, forgets nothing.', { research: 5, crafting: 4, medicine: 3, melee: 1 }, ['research', 'crafting']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#e0d8c0', hair: 'none', hairColor: '#000000', beard: false, outfit: '#2a4a3a', body: 'skeleton', eyes: 'red', wear: ['torso_robe:#2a4a3a', 'legs_robeskirt:#2a4a3a', 'head_hood:#1a2a22', 'belt_cloth:#c8c0a0', 'back_cape:#1a2a22'] },
    },
  ],
  druid: [
    {
      id: 'rowan',
      name: 'Elder Rowan',
      title: 'Oak-Speaker',
      story: 'Old as the grove he tends; the trees lean in when he talks.',
      background: bg('oak_speaker', 'Oak-Speaker', 'Fields, forage and the grove: everything grows for him.', { farming: 5, gathering: 4, medicine: 3 }, ['farming', 'gathering']),
      traits: ['green_thumb'],
      look: { gender: 'm', skin: '#d6a67c', hair: 'long', hairColor: '#ece8e0', beard: true, outfit: '#3a6a2a', wear: ['torso_robe:#3a6a2a', 'legs_robeskirt:#3a6a2a', 'belt_cloth:#8a6a3a', 'back_cape:#6a4a1a', 'head_tiara_s'] },
    },
    {
      id: 'briar',
      name: 'Briar',
      title: 'the Thornward',
      story: 'The grove\'s ranger: an arrow from the brambles before you see her.',
      background: bg('thornward', 'Thornward', 'Hunts and guards the grove.', { ranged: 5, gathering: 4, animals: 3 }, ['ranged', 'gathering']),
      traits: ['night_owl'],
      look: { gender: 'f', skin: '#c9956a', hair: 'loose', hairColor: '#8a3a22', beard: false, outfit: '#4a5a2a', wear: ['torso_leather:#4a5a2a', 'head_hood:#2a4a1a', 'hands_bracers', 'legs_pants:#3a3a1a', 'feet_boots', 'back_quiver'] },
    },
    {
      id: 'ilka',
      name: 'Mother Ilka',
      title: 'the Herb-Wife',
      story: 'Knows a cure for every ill and a poison for every cure.',
      background: bg('herb_wife', 'Herb-Wife', 'Heals, grows, and keeps the circle together.', { medicine: 5, farming: 4, social: 3 }, ['medicine', 'farming']),
      traits: ['hard_worker'],
      look: { gender: 'f', skin: '#e3b890', hair: 'longknot', hairColor: '#a8a29a', beard: false, outfit: '#6a4a2a', wear: ['torso_robe:#6a4a2a', 'legs_robeskirt:#6a4a2a', 'belt_cloth:#5a7a3a', 'head_bandana:#5a7a3a', 'back_cape:#3a5a2a'] },
    },
  ],
  vampire: [
    {
      id: 'ilse',
      name: 'Countess Ilse',
      title: 'of the Long Night',
      story: 'Her court fell to torches a century ago. She has been planning its return ever since.',
      background: bg('courtier', 'Courtier', 'Charms, schemes and studies: thralls flock to her.', { social: 5, research: 4, melee: 3 }, ['social', 'research']),
      traits: ['night_owl'],
      look: { gender: 'f', skin: '#ece4ec', hair: 'xlong', hairColor: '#1a1414', beard: false, outfit: '#6a0a1a', eyes: 'red', wear: ['torso_dress:#6a0a1a', 'torso_goldarms', 'head_tiara', 'back_cape:#2a0a14', 'hands_gloves:#1a0a0a'] },
    },
    {
      id: 'varn',
      name: 'Lord Varn',
      title: 'the Warlord',
      story: 'Rose from a battlefield he lost, and has not lost one since.',
      background: bg('warlord', 'Warlord', 'Leads from the front; builds walls that hold.', { melee: 5, construction: 4, ranged: 3 }, ['melee', 'construction']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#e0dce4', hair: 'plain', hairColor: '#1a1414', beard: false, outfit: '#2a2a32', eyes: 'red', wear: ['torso_plate:#3a3a44', 'torso_platearms:#3a3a44', 'legs_metal:#2a2a34', 'feet_boots', 'head_helm:#2a2a34', 'back_cape:#7a0a1a'] },
    },
    {
      id: 'severin',
      name: 'Severin',
      title: 'the Physician',
      story: 'A doctor who found the cure for death, and the price of it.',
      background: bg('physician', 'Physician', 'Heals the thralls and studies the blood.', { medicine: 5, research: 4, social: 3 }, ['medicine', 'research']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#e8e4ec', hair: 'parted', hairColor: '#ece8e0', beard: false, outfit: '#1a1a22', eyes: 'red', wear: ['torso_jacket:#1a1a22', 'hands_gloves:#e0e0e0', 'legs_pants:#1a1a22', 'feet_boots', 'back_cape:#3a0a14', 'belt_leather'] },
    },
  ],
  werewolf: [
    {
      id: 'greymane',
      name: 'Greymane',
      title: 'Alpha of the Ridge',
      story: 'Scarred, silver-shot and unbeaten. The pack follows him because none has ever made him kneel.',
      background: bg('alpha', 'Alpha', 'Fights first and leads the hunt.', { melee: 5, animals: 4, gathering: 3 }, ['melee', 'animals']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#c9956a', hair: 'unkempt', hairColor: '#7a7470', beard: true, outfit: '#4a3a2a', wear: ['torso_sleeveless:#4a3a2a', 'hands_bracers', 'feet_boots', 'legs_pants:#3a2a1a', 'back_tatter:#6a6a6a', 'belt_leather'] },
    },
    {
      id: 'sable',
      name: 'Sable',
      title: 'the Moon-Hunter',
      story: 'Runs the high ground under the full moon and is never seen until the kill.',
      background: bg('moon_hunter', 'Moon-Hunter', 'Hunts by night with bow and tooth.', { ranged: 5, melee: 4, animals: 3 }, ['ranged', 'melee']),
      traits: ['night_owl'],
      look: { gender: 'f', skin: '#b5825a', hair: 'messy2', hairColor: '#1a1414', beard: false, outfit: '#3a3a3a', wear: ['torso_leathersh:#2a2a2e', 'feet_boots', 'legs_pants:#1a1a1e', 'head_hood:#1a1a1e', 'hands_gloves:#1a1a1e', 'back_quiver'] },
    },
    {
      id: 'fenn',
      name: 'Old Fenn',
      title: 'the Howl-Sage',
      story: 'Too old to run with the pack, but every wolf in the hills still comes when he calls.',
      background: bg('howl_sage', 'Howl-Sage', 'Wolves and beasts heed him; he patches up the pack.', { animals: 5, medicine: 4, social: 3 }, ['animals', 'medicine']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#d6a67c', hair: 'long', hairColor: '#ece8e0', beard: true, outfit: '#5a4a3a', wear: ['torso_robe:#5a4a3a', 'legs_robeskirt:#5a4a3a', 'head_hood:#4a3a2a', 'back_tatter:#8a8a8a', 'belt_cloth:#8a3a22'] },
    },
  ],
  robot: [
    {
      id: 'ax7',
      name: 'Unit AX-7',
      title: 'the Foreman',
      story: 'The ship\'s construction drone. It has rebuilt the colony plan 4,112 times.',
      background: bg('foreman', 'Foreman', 'Builds and fabricates without pause.', { construction: 5, crafting: 4, research: 3 }, ['construction', 'crafting']),
      traits: ['hard_worker'],
      look: { gender: 'm', skin: '#a8b4c0', hair: 'none', hairColor: '#000000', beard: false, outfit: '#5a6878', body: 'skeleton', eyes: 'red', wear: ['torso_plate:#c89a30', 'legs_metal:#8a7a50', 'feet_boots:#5a6878', 'head_helm:#e0b040', 'hands_gloves:#e0b040'] },
    },
    {
      id: 'calliope',
      name: 'CALLIOPE',
      title: 'Archive Mind',
      story: 'The ship\'s library in a body of brass. It wants to know everything about this world.',
      background: bg('archive_mind', 'Archive Mind', 'Thinks fast and keeps the colony running.', { research: 5, medicine: 4, crafting: 3 }, ['research', 'medicine']),
      traits: ['quick_learner'],
      look: { gender: 'f', skin: '#c8a060', hair: 'none', hairColor: '#000000', beard: false, outfit: '#8a6a30', body: 'skeleton', wear: ['torso_goldchest', 'torso_goldarms', 'feet_boots:#a07830', 'head_gold', 'back_cape:#2a6a8a'] },
    },
    {
      id: 'warden9',
      name: 'Warden-9',
      title: 'the Sentinel',
      story: 'Built to guard the ship\'s hold. It has decided the whole colony is the hold now.',
      background: bg('sentinel', 'Sentinel', 'Stands the line and fixes the walls behind it.', { melee: 5, ranged: 4, construction: 3 }, ['melee', 'ranged']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#6a7078', hair: 'none', hairColor: '#000000', beard: false, outfit: '#3a4048', body: 'skeleton', eyes: 'red', wear: ['torso_plate:#4a5058', 'torso_platearms:#4a5058', 'legs_metal:#4a5058', 'feet_boots:#3a4048', 'head_chainhood:#2a3038', 'back_cape:#a01a1a'] },
    },
  ],
  dwarves: [
    {
      id: 'thrain',
      name: 'Thrain Deepaxe',
      title: 'Lord of the Hold',
      story: 'Led his clan out of a flooded mountain, and swears the new hold will go deeper.',
      background: bg('hold_lord', 'Hold-Lord', 'Builds strong and fights stubborn.', { construction: 5, melee: 4, crafting: 3 }, ['construction', 'melee']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#e3b890', hair: 'long', hairColor: '#8a3a22', beard: true, outfit: '#5a4a3a', height: 0.86, wear: ['torso_chain', 'torso_platearms:#8a7a5a', 'head_helm', 'feet_boots', 'belt_leather', 'back_cape:#8a2a1a'] },
    },
    {
      id: 'hilda',
      name: 'Hilda Stonebraid',
      title: 'the Runesmith',
      story: 'Her hammer rings day and night; every blade she makes has a name.',
      background: bg('runesmith', 'Runesmith', 'Crafts the finest work in the hold.', { crafting: 5, construction: 4, research: 3 }, ['crafting', 'construction']),
      traits: ['hard_worker'],
      look: { gender: 'f', skin: '#f0cfa8', hair: 'xlongknot', hairColor: '#c49a62', beard: false, outfit: '#6a4a2a', height: 0.86, wear: ['torso_leather:#5a3a2a', 'hands_bracers', 'feet_boots', 'legs_pants:#4a3a2a', 'belt_leather', 'head_bandana:#c84a1a'] },
    },
    {
      id: 'grumli',
      name: 'Grumli',
      title: 'the Delver',
      story: 'Smells a seam of ore through solid rock, and has the bruises to prove it.',
      background: bg('delver', 'Delver', 'Digs, hauls and builds.', { gathering: 5, construction: 4, melee: 3 }, ['gathering', 'construction']),
      traits: ['hard_worker'],
      look: { gender: 'm', skin: '#d6a67c', hair: 'plain', hairColor: '#1a1414', beard: true, outfit: '#4a4a3a', height: 0.86, wear: ['torso_leathersh:#4a3a2a', 'head_cap:#8a6a3a', 'feet_boots', 'hands_gloves:#6a4a2a', 'legs_pants:#3a3a3a', 'belt_leather'] },
    },
  ],
  merfolk: [
    {
      id: 'nerissa',
      name: 'Nerissa',
      title: 'the Tide-Singer',
      story: 'Her songs call fish to the nets and ships to the shore.',
      background: bg('tide_singer', 'Tide-Singer', 'Charms strangers and fills the nets.', { social: 5, gathering: 4, cooking: 3 }, ['social', 'gathering']),
      traits: ['quick_learner'],
      look: { gender: 'f', skin: '#7cc0b8', hair: 'xlong', hairColor: '#2a9a9a', beard: false, outfit: '#3a8aa8', ears: 'elf', wear: ['torso_dress:#3a8aa8', 'head_tiara_s', 'back_cape:#a8e0e8', 'belt_cloth:#e8d8b0'] },
    },
    {
      id: 'kael',
      name: 'Kael Saltfin',
      title: 'the Harpooner',
      story: 'Has hunted sharks since he could swim, and pirates since they found his reef.',
      background: bg('harpooner', 'Harpooner', 'Spear and net: food and defence.', { ranged: 5, melee: 4, gathering: 3 }, ['ranged', 'melee']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#6aa8b0', hair: 'longhawk', hairColor: '#3a5ac8', beard: false, outfit: '#2a5a6a', ears: 'elf', wear: ['torso_sleeveless:#2a5a6a', 'hands_bracers', 'legs_pants:#1a3a4a', 'belt_leather', 'head_bandana:#c8e0e8'] },
    },
    {
      id: 'coralie',
      name: 'Old Coralie',
      title: 'the Shell-Reader',
      story: 'Reads the tides in shells and the future in the tides.',
      background: bg('shell_reader', 'Shell-Reader', 'Studies the sea\'s secrets; heals with kelp and salt.', { research: 5, medicine: 4, social: 3 }, ['research', 'medicine']),
      traits: ['night_owl'],
      look: { gender: 'f', skin: '#8cc8c0', hair: 'long', hairColor: '#ece8e0', beard: false, outfit: '#c86a5a', ears: 'elf', wear: ['torso_robe:#c86a5a', 'legs_robeskirt:#c86a5a', 'head_hood:#e8a090', 'back_cape:#6a2a4a', 'belt_cloth:#e8d8b0'] },
    },
  ],
  nomads: [
    {
      id: 'temur',
      name: 'Temur',
      title: 'Khan of the Steppe',
      story: 'Rides at the head of the caravan, and has never slept two winters in one place.',
      background: bg('khan', 'Khan', 'Horses, bow and command.', { animals: 5, ranged: 4, melee: 3 }, ['animals', 'ranged']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#c9956a', hair: 'shortknot', hairColor: '#1a1414', beard: true, outfit: '#8a3a22', wear: ['torso_leather:#8a5a2a', 'belt_cloth:#c8281c', 'feet_boots', 'back_cape:#8a3a22', 'head_bandana:#c8281c', 'legs_pants:#4a2a1a'] },
    },
    {
      id: 'aylin',
      name: 'Aylin',
      title: 'the Silk-Trader',
      story: 'Can sell salt to the sea, and buy it back at a profit.',
      background: bg('silk_trader', 'Silk-Trader', 'Bargains, tends the herds, finds what\'s needed.', { social: 5, animals: 4, gathering: 3 }, ['social', 'animals']),
      traits: ['quick_learner'],
      look: { gender: 'f', skin: '#d6a67c', hair: 'long', hairColor: '#2a1c14', beard: false, outfit: '#c87a20', wear: ['torso_dress:#c87a20', 'head_bandana:#8a2a6a', 'belt_cloth:#2a6a8a', 'back_cape:#6a1a5a', 'torso_goldarms'] },
    },
    {
      id: 'batu',
      name: 'Batu',
      title: 'the Rider-Scout',
      story: 'Sees the raiders on the horizon a day before anyone else, and is already riding.',
      background: bg('rider_scout', 'Rider-Scout', 'Scouts, shoots and forages on the move.', { ranged: 5, animals: 4, gathering: 3 }, ['ranged', 'gathering']),
      traits: ['hard_worker'],
      look: { gender: 'm', skin: '#b5825a', hair: 'shorthawk', hairColor: '#2a1c14', beard: false, outfit: '#5a4a2a', wear: ['torso_leathersh:#6a4a2a', 'feet_boots', 'legs_pants:#3a2a1a', 'head_cap:#6a3a1a', 'back_quiver', 'hands_bracers'] },
    },
  ],
  fae: [
    {
      id: 'oriel',
      name: 'Queen Oriel',
      title: 'of the Summer Court',
      story: 'Left the Summer Court on a whim, and expects the mortal world to be grateful.',
      background: bg('summer_queen', 'Summer Queen', 'Charms strangers; flowers bloom where she walks.', { social: 5, farming: 4, medicine: 3 }, ['social', 'farming']),
      traits: ['green_thumb'],
      look: { gender: 'f', skin: '#fbe3cf', hair: 'princess', hairColor: '#f0dca8', beard: false, outfit: '#d890d0', ears: 'elf', wear: ['torso_dress:#d890d0', 'head_tiara', 'back_wings', 'torso_goldarms', 'belt_cloth:#f0dca8'] },
    },
    {
      id: 'puck',
      name: 'Puck',
      title: 'the Trickster',
      story: 'Nobody invited him. Nobody can make him leave. Somehow, things get done.',
      background: bg('trickster', 'Trickster', 'Quick hands, quick bow, quicker tongue.', { gathering: 5, ranged: 4, social: 3 }, ['gathering', 'social']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#e8c29a', hair: 'messy1', hairColor: '#3a9a4a', beard: false, outfit: '#4a7a3a', ears: 'elf', wear: ['torso_leathersh:#4a7a3a', 'back_wings', 'head_cap:#c8281c', 'legs_pants:#3a5a2a', 'feet_shoes:#6a4a2a'] },
    },
    {
      id: 'morwen',
      name: 'Lady Morwen',
      title: 'of the Winter Court',
      story: 'Cold, clever and very old. She came to study mortals, and has not decided what she thinks.',
      background: bg('winter_lady', 'Winter Lady', 'Studies deeply; her frost bites in a fight.', { research: 5, social: 4, ranged: 3 }, ['research', 'social']),
      traits: ['night_owl'],
      look: { gender: 'f', skin: '#f0e8f4', hair: 'xlong', hairColor: '#ece8e0', beard: false, outfit: '#90c0e8', ears: 'elf', wear: ['torso_dress:#a8c8e8', 'back_wings', 'head_tiara', 'hands_gloves:#e8f0f8', 'belt_cloth:#5a7aa8'] },
    },
  ],
  alchemists: [
    {
      id: 'voss',
      name: 'Magister Voss',
      title: 'the Transmuter',
      story: 'Expelled from three universities for experiments that worked too well.',
      background: bg('transmuter', 'Transmuter', 'Researches fast and makes the strange real.', { research: 5, crafting: 4, medicine: 3 }, ['research', 'crafting']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#f0cfa8', hair: 'parted', hairColor: '#a8a29a', beard: true, outfit: '#5a2a7a', wear: ['torso_robe:#5a2a7a', 'legs_robeskirt:#5a2a7a', 'belt_cloth:#c8a040', 'back_cape:#2a1a3a', 'hands_gloves:#c8a040'] },
    },
    {
      id: 'ottilie',
      name: 'Dr. Ottilie',
      title: 'the Volatile',
      story: 'Her eyebrows have grown back eleven times. She is close to something big.',
      background: bg('artificer', 'Artificer', 'Builds the apparatus; throws the flasks.', { crafting: 5, research: 4, ranged: 3 }, ['crafting', 'research']),
      traits: ['hard_worker'],
      look: { gender: 'f', skin: '#e8c29a', hair: 'pixie', hairColor: '#c8281c', beard: false, outfit: '#3a3a3a', wear: ['torso_jacket:#4a3a2a', 'hands_gloves:#2a2a2a', 'feet_boots', 'legs_pants:#3a2a1a', 'head_bandana:#c8a040', 'belt_leather'] },
    },
    {
      id: 'isolde',
      name: 'Isolde',
      title: 'the Physick',
      story: 'Brews tonics for every ailment; the side effects are part of the cure.',
      background: bg('physick', 'Physick', 'Heals with elixirs and cooks the tinctures.', { medicine: 5, research: 4, cooking: 3 }, ['medicine', 'research']),
      traits: ['green_thumb'],
      look: { gender: 'f', skin: '#d6a67c', hair: 'ponytail2', hairColor: '#2a1c14', beard: false, outfit: '#2a6a4a', wear: ['torso_robe:#2a6a4a', 'legs_robeskirt:#2a6a4a', 'hands_gloves:#c8c0a8', 'head_hood:#e8e0d0', 'back_cape:#1a4a2a'] },
    },
  ],
  knights: [
    {
      id: 'aldric',
      name: 'Sir Aldric',
      title: 'the Oathbound',
      story: 'Stripped of his lands for refusing an unjust order. He kept his sword and his oath.',
      background: bg('oathbound', 'Oathbound', 'Leads and fights; men follow him.', { melee: 5, social: 4, construction: 3 }, ['melee', 'social']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#e3b890', hair: 'parted', hairColor: '#b88a58', beard: true, outfit: '#2a4a8a', wear: ['torso_plate', 'torso_platearms', 'legs_metal', 'back_cape:#2a4a8a', 'hands_gloves:#8a8a94'] },
    },
    {
      id: 'yseult',
      name: 'Dame Yseult',
      title: 'the Shieldmaiden',
      story: 'Held a bridge alone for a night and a day. The bards got the details wrong.',
      background: bg('shieldmaiden', 'Shieldmaiden', 'Fights and shoots; patches the wounded after.', { melee: 5, ranged: 4, medicine: 3 }, ['melee', 'ranged']),
      traits: ['hard_worker'],
      look: { gender: 'f', skin: '#f0cfa8', hair: 'ponytail', hairColor: '#e0c890', beard: false, outfit: '#e8e0d0', wear: ['torso_chain', 'torso_platearms', 'head_chainhood', 'legs_metal', 'feet_boots', 'back_cape:#e8e0d0'] },
    },
    {
      id: 'cade',
      name: 'Brother Cade',
      title: 'the Chaplain',
      story: 'The order\'s priest and surgeon. Prays over the wounded, then stitches them up.',
      background: bg('chaplain', 'Chaplain', 'Heals, counsels and holds the order together.', { medicine: 5, social: 4, melee: 3 }, ['medicine', 'social']),
      traits: ['quick_learner'],
      look: { gender: 'm', skin: '#c9956a', hair: 'plain', hairColor: '#4a3020', beard: false, outfit: '#e8e0d0', wear: ['torso_robe:#e8e0d0', 'legs_robeskirt:#e8e0d0', 'torso_chain', 'back_cape:#8a1a1a', 'head_hood:#e8e0d0', 'belt_cloth:#c8a040'] },
    },
  ],
  orcs: [
    {
      id: 'grakk',
      name: 'Grakk',
      title: 'the Warchief',
      story: 'Broke the old chief\'s jaw and took the warband. He has been looking for a bigger fight ever since.',
      background: bg('warchief', 'Warchief', 'Leads from the front and bellows the rest into line.', { melee: 5, social: 3, construction: 3 }, ['melee', 'social']),
      traits: ['tough'],
      look: { gender: 'm', skin: '#5a8a3e', hair: 'shortknot', hairColor: '#1a1414', beard: false, outfit: '#5a3a2a', body: 'orc', ears: 'elf', wear: ['torso_leather:#4a3020', 'torso_platearms:#6a6a70', 'legs_pants:#3a2a1a', 'feet_boots', 'belt_leather'] },
    },
    {
      id: 'ushna',
      name: 'Ushna',
      title: 'Bloodaxe',
      story: 'Took her name from her axe and her axe from a knight. She keeps both very sharp.',
      background: bg('reaver', 'Reaver', 'Raids, carries off the spoils and fights the whole way home.', { melee: 5, gathering: 3, ranged: 3 }, ['melee', 'gathering']),
      traits: ['hard_worker'],
      look: { gender: 'f', skin: '#6a9a4a', hair: 'ponytail', hairColor: '#2a1a14', beard: false, outfit: '#7a2a1a', body: 'orc', ears: 'elf', wear: ['torso_leather:#5a2a1a', 'hands_bracers', 'legs_pants:#3a2a1a', 'feet_boots', 'belt_leather'] },
    },
    {
      id: 'mogra',
      name: 'Old Mogra',
      title: 'the Bone-Reader',
      story: 'Reads the future in thrown knucklebones. It is always war; she is always right.',
      background: bg('bone_reader', 'Bone-Reader', 'Heals with foul brews, curses with worse, and reads the bones.', { medicine: 5, social: 4, research: 3 }, ['medicine', 'social']),
      traits: ['quick_learner'],
      look: { gender: 'f', skin: '#4e7a38', hair: 'long', hairColor: '#c8c0b0', beard: false, outfit: '#4a3a2a', body: 'orc', ears: 'elf', wear: ['torso_robe:#4a3a2a', 'legs_robeskirt:#4a3a2a', 'head_hood:#3a2a1a', 'belt_cloth:#8a6a3a'] },
    },
  ],
};

export const FOUNDER_BY_ID: Readonly<Record<string, FounderDef>> = Object.fromEntries(Object.values(FOUNDERS).flatMap((l) => l.map((f) => [f.id, f])));
