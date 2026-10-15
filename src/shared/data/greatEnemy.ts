// The Great Enemy (the owner's ask: one slow-building villain a town, a long arc for a game meant to last months).
// The Calamity (data/calamity.ts) is this Enemy's stirring made manifest, a force of the land it sends; the Enemy is someone: a lord with a name,
// a seat far off on the world map, a goal, lieutenants who do its work, and its own way of fighting. One is chosen for
// each town soon after the founding, to fit the land and the people (`ENEMY_FITS`): a dark lord in a tower, a dragon
// brood in the peaks, a plague cult in the fens, a machine mind in the wastes, a drowned king for a shore town, an
// undying warlord on the plains. It sleeps, then sends omens, then stirs (its blight creeps onto the town's land, its
// agents slip in among the visitors, raids come bearing its mark, rival powers fall to it), then marches (its
// lieutenants lead hosts, it demands tribute), and at last lays its one great siege on the town. The rules are in
// sim/greatEnemy.ts; the stage thresholds count the paced day (sim/time.ts `paceDay`), as every growing danger does.

import type { EnemyDef } from './enemies';
import type { ItemDef } from './items';
import type { BuildingDef } from './buildings';
import type { RaidKind } from './raids';
import type { BackdropId } from './backdrops';
import type { Biome } from './biomes';
import type { OriginId } from './origins';
import { PACK_SHEETS } from './packSheets';

export type EnemyKind = 'tower' | 'brood' | 'plague' | 'engine' | 'drowned' | 'undying';
export type EnemyStage = 'dormant' | 'omens' | 'stirring' | 'march' | 'siege' | 'peace' | 'fallen';

export interface Lieutenant {
  /** Its enemy id (merged into ENEMIES), its name, and the outpost it holds (a place on the board from the stirring). */
  id: string;
  name: string;
  outpost: string;
  /** Who stands with it at its outpost (besides itself). */
  guard: Record<string, number>;
}

export interface EnemyKindDef {
  kind: EnemyKind;
  /** "Malgrith", and with the title: "Malgrith the Tower Lord". */
  short: string;
  name: string;
  /** Its seat on the world map, and the scenery a party fights in there. */
  seat: string;
  scenery: 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';
  /** What it wants, and how it makes war: told in the menus. */
  goal: string;
  way: string;
  /** Its own enemy id (it leads the last siege, and waits at its seat once its lieutenants are dead). */
  boss: string;
  lieutenants: Lieutenant[];
  /** Its army (a raid kind: the marked raids, the hosts, the siege). */
  army: string;
  /** Who guards its seat while a lieutenant still lives (the boss itself waits there once they're all dead). */
  seatGuard: Record<string, number>;
  /** An omen line for a night it shows itself; a dream the townsfolk write down; a stranger's warning; a traveller lost. */
  omens: string[];
  dreams: string[];
  warning: string;
  missing: string[];
  /** Who its agents pass for among the visitors. */
  agent: string;
  /** Each stage's telling, as the town passes into it. */
  stages: Partial<Record<EnemyStage, string>>;
  /** What it says when it demands tribute. */
  demand: string;
  /** Words for an event picture (data/eventScenes.ts), and the backdrop of its scenes. */
  picture: string;
  backdrop: BackdropId;
  /** The colour of its spread on the world map (CSS). */
  colour: string;
  /** Its relic (merged into ITEMS), the town's once it falls. */
  trophy: string;
}

const pack = (sheet: keyof typeof PACK_SHEETS, height: number) => ({ sheet, block: 0, scale: +(height / PACK_SHEETS[sheet]).toFixed(2) });

export const GREAT_ENEMIES: Record<EnemyKind, EnemyKindDef> = {
  tower: {
    kind: 'tower',
    short: 'Malgrith',
    name: 'Malgrith the Tower Lord',
    seat: 'the Black Tower of Vorn',
    scenery: 'quarry',
    goal: 'To bind every living soul in the land to his will, one town at a time, and to rule them from his tower for ever.',
    way: 'Sorcery and fear: storm-mages and fallen knights, and demons called up from under his tower.',
    boss: 'ge_malgrith',
    lieutenants: [
      { id: 'ge_ember_witch', name: 'Isolde the Ember Witch', outpost: 'the Cinder Shrine', guard: { cultist: 3, storm_mage: 1 } },
      { id: 'ge_gate_warden', name: 'Gorrath the Gate Warden', outpost: 'the Iron Gate', guard: { brute_demon: 1, red_imp: 3 } },
      { id: 'ge_black_seneschal', name: 'the Black Seneschal', outpost: 'the Seneschal\'s Keep', guard: { fallen_knight: 2, crimson_knight: 1 } },
    ],
    army: 'enemy_tower',
    seatGuard: { knight_captain: 2, storm_mage: 3, brute_demon: 2 },
    omens: [
      'A tower was seen on the far horizon at dusk, where no tower stands. By morning it was gone.',
      'Every candle in the town guttered at once, at midnight, and lit again by itself.',
      'A raven landed on the well and spoke a name nobody knew. Then it flew north.',
      'The stars over the north went out one by one, and came back an hour later in the wrong order.',
    ],
    dreams: ['of a black tower with a single lit window, and someone in it, watching me', 'that a man in a crown of iron called me by name, and I answered'],
    warning: 'A ragged old scholar stopped at the gate for bread. "Vorn," she said. "There is a tower in Vorn again. I was there when it fell the first time. Burn your letters; he reads them."',
    missing: ['A pedlar who left for the northern road three days ago was found walking in circles in a field, with no memory of his name.', 'Two woodcutters went out past the ridge and never came back. Their axes were found stuck in a tree, very neatly, side by side.'],
    agent: 'a soft-spoken pilgrim in grey',
    stages: {
      omens: 'Far off in Vorn, a tower that fell an age ago stands again, and a lamp burns at its top. Malgrith the Tower Lord has woken, and he has noticed the town.',
      stirring: 'Malgrith stirs. His shadow creeps across the land toward the town, his spies walk the roads, and his lieutenants have taken outposts within a few days\' march.',
      march: 'Malgrith marches. His lieutenants lead his hosts against the town, and a herald has come to demand the town kneel.',
      siege: 'Malgrith the Tower Lord has left his tower. He comes himself, with all his host. This is the last siege.',
    },
    demand: 'A herald in black stands at the gate and reads from a scroll: "Malgrith the Tower Lord, master of Vorn, asks a token of your loyalty. Pay, and his gaze will pass over you a while longer."',
    picture: 'dark tower storm ruin',
    backdrop: 'battle_ruins',
    colour: '#7a4cc8',
    trophy: 'ge_tower_crown',
  },
  brood: {
    kind: 'brood',
    short: 'Sarnath',
    name: 'Sarnath, Mother of Wyrms',
    seat: 'the Smoking Peaks',
    scenery: 'cave',
    goal: 'To raise a brood great enough to burn the land clean, and make every hill a nest for her children.',
    way: 'Fire from the sky: drakes and wyrmlings by the score, a cult of dragon-priests, and her own breath.',
    boss: 'ge_sarnath',
    lieutenants: [
      { id: 'ge_drake_lord', name: 'Vyrax the Drake Lord', outpost: 'the Scorched Crag', guard: { red_drake: 1, ember_wyrmling: 2 } },
      { id: 'ge_wyrm_priest', name: 'the Wyrm Priest', outpost: 'the Ash Temple', guard: { cultist: 3, ember_wyrmling: 1 } },
      { id: 'ge_clutch_warden', name: 'Ossk, Warden of the Clutch', outpost: 'the Egg Caves', guard: { black_drake: 1, drake: 2 } },
    ],
    army: 'enemy_brood',
    seatGuard: { black_drake: 2, red_drake: 2, ember_wyrmling: 3 },
    omens: [
      'A great shadow crossed the moon last night, slow, with wings.',
      'The snow on the far peaks has melted in the middle of winter, and the peaks smoke.',
      'Sheep were found in the high pasture burnt to the bone, and the grass around them untouched.',
      'Scales the size of a shield came down the river this morning, still warm.',
    ],
    dreams: ['of an egg as big as a house, cracking, and something singing inside it', 'that the sky was on fire, and it was not the sun'],
    warning: 'A shepherd with burnt hands came down from the hills. "She is nesting in the Smoking Peaks. Not one dragon. Dozens. And the mother. Keep water by every door."',
    missing: ['A herding family on the far hills has not come to market. Their hut was found empty, the roof scorched from above.', 'A trader\'s cart was found on the high road, the mules gone and the canvas burnt in long stripes.'],
    agent: 'a scarred dragon-priest dressed as a tinker',
    stages: {
      omens: 'Up in the Smoking Peaks something vast has woken from a hundred years asleep. Sarnath, Mother of Wyrms, is laying again.',
      stirring: 'Sarnath\'s brood is hatching. Burnt ground spreads down from the peaks, her priests preach among the travellers, and her eldest children have claimed crags within reach of the town.',
      march: 'The brood is grown and hungry. Sarnath\'s lieutenants lead her children against the town, and she wants tribute.',
      siege: 'Sarnath herself has left the peaks, the whole brood flying with her. This is the last siege.',
    },
    demand: 'A dragon-priest with a burnt face comes to the gate under a white rag. "The Mother is hungry. Feed her children gold, and she may forget where you live."',
    picture: 'dragon fire mountain lair',
    backdrop: 'peaks_2',
    colour: '#d0582c',
    trophy: 'ge_brood_heart',
  },
  plague: {
    kind: 'plague',
    short: 'the Pale Prophet',
    name: 'the Pale Prophet',
    seat: 'the Bell Fen',
    scenery: 'river',
    goal: 'To bring every living thing to the "great stillness": a sleep from which the sick rise up as his flock.',
    way: 'Sickness and faith: his flock of the risen dead, plague rats, and preachers who turn the town against itself.',
    boss: 'ge_pale_prophet',
    lieutenants: [
      { id: 'ge_rat_mother', name: 'the Rat Mother', outpost: 'the Gnawed Mill', guard: { plague_rat: 4, ghoul: 1 } },
      { id: 'ge_bell_ringer', name: 'Old Toller, the Bell Ringer', outpost: 'the Drowned Chapel', guard: { plague_zombie: 3, ghoul: 1 } },
      { id: 'ge_mourner', name: 'the Mourner', outpost: 'the Barrow of Hymns', guard: { revenant: 1, plague_zombie: 2 } },
    ],
    army: 'enemy_plague',
    seatGuard: { zombie_ogre: 2, ghoul: 3, cultist: 3 },
    omens: [
      'A bell tolled in the fen all night, though there is no church there.',
      'Every rat in the town ran out through the gate at dawn, in a line, toward the marsh.',
      'A pale moth settled on every door in the night. By morning they were dead.',
      'The river smelled of lilies and rot, and the frogs fell silent.',
    ],
    dreams: ['of a pale man smiling, ringing a bell, and everyone I love lying down to sleep', 'of walking into the fen, very calm, and the water being warm'],
    warning: 'A woman with a cloth over her mouth wouldn\'t come past the gate. "The Bell Fen. A prophet has come there, pale as milk. Our village went to hear him. They came back... different. Burn your dead. All of them."',
    missing: ['A family of travelling players never arrived. Their wagon was found in the reeds, the horses standing quietly, the people gone.', 'A messenger from the south road is three days late. His horse came in alone, its flanks white with fen mud.'],
    agent: 'a gentle preacher with clean hands',
    stages: {
      omens: 'In the Bell Fen a prophet has risen, pale as milk, preaching a great stillness. The Pale Prophet has heard of the town.',
      stirring: 'The Pale Prophet stirs. Grey rot creeps onto the town\'s land, his preachers walk among the visitors, and his flock has taken ground near the town.',
      march: 'The flock marches. The Prophet\'s lieutenants lead the risen dead against the town, and he asks it to kneel.',
      siege: 'The Pale Prophet walks to the town himself, his whole flock behind him, ringing his bell. This is the last siege.',
    },
    demand: 'A preacher stands at the gate, smiling. "The Prophet asks only an offering. A little gold, given freely, and your town will sleep last of all."',
    picture: 'plague swamp dead rot',
    backdrop: 'wasteland_3',
    colour: '#8fa860',
    trophy: 'ge_plague_bell',
  },
  engine: {
    kind: 'engine',
    short: 'the Engine Mind',
    name: 'the Engine Mind',
    seat: 'the Clockwork Deep',
    scenery: 'quarry',
    goal: 'To make the world orderly: every forest a quarry, every river a channel, every living thing a part that turns.',
    way: 'Endless machines: brass golems and sentries, drones that watch, and new designs each time it is beaten.',
    boss: 'ge_engine_mind',
    lieutenants: [
      { id: 'ge_foreman', name: 'Unit Foreman', outpost: 'the Quarry Engine', guard: { brass_golem: 1, clockwork_imp: 2 } },
      { id: 'ge_blade_unit', name: 'Blade Unit Seven', outpost: 'the Signal Tower', guard: { iron_sentry: 2, scout_drone: 2 } },
      { id: 'ge_gunner_prime', name: 'Gunner Prime', outpost: 'the Forward Works', guard: { steam_golem: 1, iron_sentry: 1 } },
    ],
    army: 'enemy_engine',
    seatGuard: { iron_golem: 2, steam_golem: 2, iron_sentry: 3 },
    omens: [
      'A ticking was heard under the ground all night, steady as a heart.',
      'The trees at the edge of the forest have been cut down in a perfectly straight line.',
      'Lights moved in the sky in a grid, blinking, and the birds would not fly under them.',
      'Every tool in the smithy was found in the morning laid out in order of size.',
    ],
    dreams: ['of gears turning behind my eyes, and a voice counting, very patiently', 'that my hands were brass, and I did not mind'],
    warning: 'A tinker with half his face burnt by steam gripped the gate. "Something in the Clockwork Deep has learned to think. It builds itself. It built my village into a wall. Don\'t let it count you."',
    missing: ['A charcoal-burner from the woods is gone. Where his camp was there is a neat square of bare earth, raked flat.', 'Traders on the east road found a waystation stripped to its nails, the nails stacked by length.'],
    agent: 'a too-polite stranger who never blinks',
    stages: {
      omens: 'Deep under the waste, old engines have started to turn on their own. The Engine Mind is awake, and it has counted the town.',
      stirring: 'The Engine Mind stirs. Bare raked ground creeps across the land, its watchers move among the visitors, and its works have been built within reach of the town.',
      march: 'The machines march. The Mind\'s lieutenants lead its engines against the town, and it sends terms.',
      siege: 'The Engine Mind has built itself a body and walks out of the Deep with all its machines. This is the last siege.',
    },
    demand: 'A brass messenger clanks up to the gate and speaks in a flat voice: "TRIBUTE OF METAL AND COIN WILL DELAY YOUR REORGANISATION. NON-COMPLIANCE IS NOTED."',
    picture: 'machine industrial forge ruin',
    backdrop: 'industrial_night',
    colour: '#c8a040',
    trophy: 'ge_engine_core',
  },
  drowned: {
    kind: 'drowned',
    short: 'the Drowned King',
    name: 'the Drowned King',
    seat: 'the Sunken Throne',
    scenery: 'river',
    goal: 'To bring the sea over the land, and rule the drowned from a throne of wrecks, the shore towns first.',
    way: 'Out of the water: drowned sailors and squid-kin, a tide that rises with him, and storms off the sea.',
    boss: 'ge_drowned_king',
    lieutenants: [
      { id: 'ge_drowned_admiral', name: 'Admiral Kell, Drowned', outpost: 'the Wreck of the Lamplight', guard: { drowned_sailor: 3, sky_pirate: 1 } },
      { id: 'ge_tide_witch', name: 'the Tide Witch', outpost: 'the Salt Caves', guard: { squid_spawn: 2, coral_golem: 1 } },
      { id: 'ge_deep_maw', name: 'the Deep Maw', outpost: 'the Black Shoal', guard: { squid_spawn: 2, drowned_sailor: 2 } },
    ],
    army: 'enemy_drowned',
    seatGuard: { tide_wyrm: 1, coral_golem: 2, squid_spawn: 3 },
    omens: [
      'The tide came in twice last night, and the second time it did not smell of salt.',
      'A ship\'s bell rang out at sea, far out, where no ship was.',
      'Drowned men\'s footprints, wet and bare, came up the beach and stopped at the tideline.',
      'Every fish in the nets this morning had its eyes closed.',
    ],
    dreams: ['of a throne under the sea, made of broken ships, and someone on it beckoning', 'that I was drowning, and it was peaceful, and someone thanked me'],
    warning: 'A fisherwoman with seaweed in her hair came up from the shore. "There\'s a king under the water now. He sits on the wrecks off the Sunken Throne, and he wants the land. My husband went down to bargain with him."',
    missing: ['A fishing boat went out at dawn and came back at dusk, empty, its nets full of kelp.', 'The ferryman from down the coast has not been seen for days. His boat is tied up, full of water to the rail.'],
    agent: 'a damp sailor who leaves wet prints',
    stages: {
      omens: 'Far off the coast, beneath the waves, a dead king has opened his eyes on a throne of wrecks. The Drowned King has seen the shore.',
      stirring: 'The Drowned King stirs. Salt and black weed creep up the land, his drowned walk among the travellers, and his captains hold wrecks within reach of the town.',
      march: 'The tide marches. The Drowned King\'s lieutenants lead his drowned against the town, and he asks a tithe of the shore.',
      siege: 'The Drowned King rises from the sea himself, the tide rising with him. This is the last siege.',
    },
    demand: 'A drowned herald walks out of the surf, water running from its mouth as it speaks: "The King under the waves asks his tithe. Pay, and the sea will keep its distance."',
    picture: 'ocean storm wreck dark',
    backdrop: 'ocean_4',
    colour: '#3c8c9c',
    trophy: 'ge_drowned_crown',
  },
  undying: {
    kind: 'undying',
    short: 'Kharzul',
    name: 'Kharzul the Undying',
    seat: 'the Field of Spears',
    scenery: 'woods',
    goal: 'To finish the war he lost a thousand years ago, and to march every army that ever fell under his banner again.',
    way: 'The fallen of every battle: bone legions, death knights, wraith archers, and a marshal who cannot die twice.',
    boss: 'ge_kharzul',
    lieutenants: [
      { id: 'ge_bone_marshal', name: 'the Bone Marshal', outpost: 'the Barrow Camp', guard: { skeleton_warrior: 3, skeleton_spearman: 1 } },
      { id: 'ge_hollow_knight', name: 'Ser Hollow', outpost: 'the Broken Bridge', guard: { bone_knight: 2, skeleton_archer: 1 } },
      { id: 'ge_gravecaller', name: 'the Gravecaller', outpost: 'the Ossuary', guard: { revenant: 1, wraith_archer: 2 } },
    ],
    army: 'enemy_undying',
    seatGuard: { death_knight: 2, bone_knight: 2, wraith_archer: 3 },
    omens: [
      'War drums were heard beyond the hills all night. At dawn there was nobody there.',
      'Old spearheads have been pushing up out of the ploughed fields, rusted, all pointing the same way.',
      'A column of mist marched past the town at dusk, in step.',
      'The graves in the burial ground were found with their earth turned over, and empty.',
    ],
    dreams: ['of a battlefield that goes on for ever, and a voice calling the roll, and my name on it', 'that I stood in a line of soldiers made of bone, and could not step out of it'],
    warning: 'An old soldier with one arm stopped for water. "The Field of Spears. Kharzul is up again. I buried him myself, sixty years back. Count your dead. Count them twice."',
    missing: ['A drover and his herd vanished on the plains road. The cattle were found later, standing in perfect ranks.', 'A party of pilgrims never reached the shrine. Their staffs were found planted in a row like spears.'],
    agent: 'a grey old veteran with a soldier\'s stare',
    stages: {
      omens: 'On the Field of Spears the old dead are stirring under the grass. Kharzul the Undying has woken, and he means to finish his war.',
      stirring: 'Kharzul stirs. Grave-cold creeps onto the land, his deserters walk among the visitors, and his captains have made camp within reach of the town.',
      march: 'The legions march. Kharzul\'s lieutenants lead the dead against the town, and he offers it terms of surrender.',
      siege: 'Kharzul the Undying rides at the head of every legion that ever fell. This is the last siege.',
    },
    demand: 'A skeletal herald under a rotten banner reads out terms: "Kharzul offers quarter. Tribute now, and your town may be spared until last."',
    picture: 'war graves battlefield dark',
    backdrop: 'battle_graves',
    colour: '#9aa4b8',
    trophy: 'ge_war_banner',
  },
};

export const ENEMY_KINDS = Object.keys(GREAT_ENEMIES) as EnemyKind[];
export const STAGE_ORDER: readonly EnemyStage[] = ['dormant', 'omens', 'stirring', 'march', 'siege', 'peace', 'fallen'];
export const STAGE_LABEL: Record<EnemyStage, string> = { dormant: 'Asleep', omens: 'Omens', stirring: 'Stirring', march: 'The march', siege: 'The last siege', peace: 'Peace', fallen: 'The town fell' };

/** How well an enemy fits a town: its land and its people (its Calamity follows from it: data/calamity.ts
 *  `ENEMY_CALAMITY`). A weight; 0 never. */
export function enemyFit(kind: EnemyKind, biome: Biome, origin: OriginId, shore: boolean): number {
  switch (kind) {
    case 'tower':
      return 2;
    case 'brood':
      return ['highlands', 'tundra', 'taiga', 'ashlands', 'desert'].includes(biome) ? 4 : 1;
    case 'plague':
      return ['swamp', 'jungle', 'forest'].includes(biome) ? 4 : 1;
    case 'engine':
      return ['robot', 'alchemists', 'dwarves'].includes(origin) ? 3 : ['desert', 'steppe', 'ashlands'].includes(biome) ? 2 : 1;
    case 'drowned':
      return shore ? 6 : 0;
    case 'undying':
      return origin === 'lich' ? 0.3 : ['steppe', 'ashlands'].includes(biome) ? 4 : 1.5;
  }
}

/* ------------------------------------------------------------ the arc (paced days: sim/time.ts paceDay) */

/** The Enemy is chosen (and its seat set) at this hour of the founding's second day. */
export const ENEMY_CHOSEN_DAY = 2;
/** Each morning at this hour its plan moves on, and the stage's doings are done. */
export const ENEMY_HOUR = 9;
/** Where its plan must reach (paced days of plotting) for each stage. A paced day is `DANGER_PACE` (2.5) game days,
 *  so with nothing done for or against it, omens come on about game day 13, the stirring on day 38, the march on day
 *  80 and the last siege on day 130. */
export const PLAN_AT: Record<'omens' | 'stirring' | 'march' | 'siege', number> = { omens: 5, stirring: 15, march: 32, siege: 52 };
/** The plan's daily pace is 1 a paced day, times this much more for each outpost left standing, and each unanswered
 *  host (ignoring it speeds it), and less for each counter the town holds (research, faith). */
export const OUTPOST_HASTE = 0.2;
export const PACE_MOST = 2;
export const PACE_LEAST = 0.4;
/** The counters: research topics the town knows (each slows it), and a god well pleased (the town's faith). */
export const COUNTER_TOPICS: Readonly<Record<string, number>> = { scouting: 0.05, writing: 0.08, fortification: 0.08, oral_tradition: 0.04, physick: 0.04 };
export const FAITH_SLOW = 0.12;
/** Faith counts when this much favour is summed over the town's four gods. */
export const FAITH_FAVOUR = 120;
/** A lieutenant slain sets its plan back this many paced days; its seat struck (a win there) more; a tribute paid less. */
export const LIEUTENANT_SETBACK = 6;
export const SEAT_SETBACK = 10;
export const TRIBUTE_SETBACK = 3;
/** A tribute refused hastens it. */
export const REFUSED_HASTE = 2;

/** Omens: most nights at this hour, from the omens on. Dreams are written in the diaries the morning after. */
export const OMEN_HOUR = 23;
export const OMEN_NIGHTLY = 0.25;
/** The share of its omens that are its Calamity's, foretold (the grey mould, the red light on the horizon). */
export const CALAMITY_OMEN_SHARE = 0.4;
/** A traveller goes missing (a morning's chance), and a stranger comes to warn the town (once, in the omens). */
export const MISSING_DAILY = 0.12;
export const WARNING_DAILY = 0.1;

/** The scouts find its seat: a morning's chance in the omens (more with Scouting, and for every region the scouts
 *  have mapped); certain at the stirring, and at once when the stranger warns of it. */
export const SEAT_FOUND_DAILY = 0.04;
export const SEAT_FOUND_SCOUTING = 0.06;
export const SEAT_FOUND_PER_REGION = 0.02;
/** The seat struck lies quiet for this many days (it can't be struck again till then). */
export const SEAT_QUIET_DAYS = 12;

/** The stirring: its blight creeps onto the town's land from the edge toward its seat, this many cells a day, up to
 *  the most; at most this many raids a day may come bearing its mark (in place of one already due); its agents among
 *  the visitors (a morning's chance), found out more often with guards; rival powers fall to it. */
export const CREEP_START = 4;
export const CREEP_PER_DAY = 0.3;
export const CREEP_MOST = 26;
export const MARK_CHANCE = 0.4;
export const MARK_SHARE = 1.1;
export const AGENT_DAILY = 0.18;
export const AGENT_CAUGHT = 0.25;
export const AGENT_CAUGHT_PER_GUARD = 0.08;
export const FALL_EVERY_DAYS = 20;
export const POWERS_FALL_MOST = 2;

/** The Monster Hunters' Guild posts a purse on each outpost (coins), and the town's own parties are drawn to them. */
export const GUILD_PURSE = 40;
export const PULL_OUTPOST = 14;

/** The march: a living lieutenant leads a host every so many days (deadlier than an ordinary raid: a bigger budget
 *  and the lieutenant at its head), and the Enemy demands tribute every so often. */
export const HOST_EVERY_DAYS = 6;
export const HOST_SHARE = 2;
export const HOST_MOST = 22;
/** Hosts and the siege grow with the town: one more foe for this many grown-ups at home, up to the most (a phone
 *  can only draw so many on the board). */
export const HOST_PER_GROWN = 6;
export const HOST_CAP = 36;
export const SIEGE_PER_GROWN = 3;
export const SIEGE_CAP = 56;
/** How long a host and the siege stay to fight before giving up (game hours from their coming: an ordinary raid's
 *  three hours run out long before a big board is fought through, and they'd rout on the clock). */
export const HOST_HOURS = 8;
export const SIEGE_HOURS = 12;
export const TRIBUTE_EVERY_DAYS = 15;
export const TRIBUTE_COINS = 120;
export const TRIBUTE_HOURS = 12;

/** The last siege: warned this many hours ahead, then its whole host (at most `SIEGE_SIZE`, more for each living
 *  lieutenant, who march with it) led by the Enemy itself. Lost, `SIEGE_BURN` buildings burn and it draws back to
 *  `SIEGE_REGROUP` paced days short of another siege; the `SIEGES_TO_FALL`th lost is the end of the town. */
export const SIEGE_WARNING_HOURS = 36;
export const SIEGE_SHARE = 3.2;
export const SIEGE_SIZE = 32;
export const SIEGE_PER_LIEUTENANT = 4;
export const SIEGE_LIEUTENANT_SHARE = 0.25;
export const SIEGE_BURN = 5;
/** A lost siege is a sack: this share of the townsfolk in town are cut down in it (the founder spared to lead what's
 *  left), whatever the battle itself cost. */
export const SACK_SLAIN = 0.2;
export const SIEGE_REGROUP = 8;
export const SIEGES_TO_FALL = 2;
/** Peace: how long the town's spirits are lifted, and by how much. */
export const PEACE_MORALE = 18;
export const PEACE_DAYS = 10;

/* ------------------------------------------------------------ the world map */

/** Its seat on the world map (768 px square: data/worldMap.ts), far from home and clear of the powers' strongholds. */
export const SEAT_SPOTS: Record<EnemyKind, { x: number; y: number }> = {
  tower: { x: 150, y: 40 },
  brood: { x: 530, y: 40 },
  plague: { x: 60, y: 570 },
  engine: { x: 720, y: 690 },
  drowned: { x: 150, y: 735 },
  undying: { x: 40, y: 300 },
};
const HOME = { x: 395, y: 410 };
/** Its outposts, strung along the road from its seat toward the town, either side of it. */
export function outpostSpot(kind: EnemyKind, i: number): { x: number; y: number } {
  const seat = SEAT_SPOTS[kind];
  const t = [0.3, 0.5, 0.7][i] ?? 0.5;
  const dx = HOME.x - seat.x;
  const dy = HOME.y - seat.y;
  const len = Math.hypot(dx, dy) || 1;
  const side = [-1, 1, -0.4][i] ?? 0;
  return { x: Math.round(seat.x + dx * t + (-dy / len) * 34 * side), y: Math.round(seat.y + dy * t + (dx / len) * 34 * side) };
}
/** Board destination ids: its seat, and each outpost (by the kind, so the world map can place them). */
export const SEAT_DEST = (k: EnemyKind) => `enemy:${k}:seat`;
export const OUTPOST_DEST = (k: EnemyKind, i: number) => `enemy:${k}:out${i}`;
export const ENEMY_SPOTS: Record<string, { x: number; y: number }> = Object.fromEntries(
  ENEMY_KINDS.flatMap((k) => [[SEAT_DEST(k), SEAT_SPOTS[k]] as const, ...[0, 1, 2].map((i) => [OUTPOST_DEST(k, i), outpostSpot(k, i)] as const)]),
);

/* ------------------------------------------------------------ the foes (merged into ENEMIES) */

type Kit = NonNullable<EnemyDef['kit']>;
const boss = (id: string, name: string, hp: number, damage: [number, number], sprite: EnemyDef['sprite'], kit: Kit, extra: Partial<EnemyDef> = {}): EnemyDef => ({
  id, name, hp, damage, accuracy: 0.78, dodge: 0.08, interval: 1.4, ranged: false, boss: true, loot: { bone: 4, iron: 3 }, sprite, kit, ...extra,
});

export const GREAT_ENEMY_FOES: Record<string, EnemyDef> = {
  // the Enemies themselves: deadlier than the Calamity's avatars (theirs is the long game's last fight)
  ge_malgrith: boss('ge_malgrith', 'Malgrith the Tower Lord', 1600, [22, 34], pack('lightning_mage', 130), {
    roar: 'Malgrith steps out of a crack of lightning, his iron crown smoking. "I have read every letter you ever wrote. Kneel."',
    enrage: 'Malgrith\'s crown splits, and the storm comes down with him!',
    area: { every: 3, targets: 5, name: 'calls the storm down', fx: 'beam' },
    summon: { kind: 'brute_demon', count: 2, text: 'Malgrith tears open the ground, and demons climb out!' },
    trophy: 'ge_tower_crown',
  }, { ranged: true, look: { hue: 250, bright: 0.7 }, nature: 'undead', armor: 0.15, loot: { iron: 14, cloth: 8 } }),
  ge_sarnath: boss('ge_sarnath', 'Sarnath, Mother of Wyrms', 1800, [24, 36], { sheet: 'wyvern', block: 0, scale: 1.35 }, {
    roar: 'Sarnath lands on the hill above the town, and the hill catches fire. Her children circle above her, screaming.',
    enrage: 'Sarnath rears up and the sky goes white with fire!',
    area: { every: 3, targets: 5, name: 'breathes a river of fire', burns: true, fx: 'fire' },
    summon: { kind: 'red_drake', count: 2, text: 'Her eldest children dive to defend her!' },
    trophy: 'ge_brood_heart',
  }, { look: { hue: -15, bright: 0.85 }, nature: 'beast', armor: 0.25, dodge: 0.04, interval: 1.6, loot: { hide: 16, wyrm_scale: 4 } }),
  ge_pale_prophet: boss('ge_pale_prophet', 'The Pale Prophet', 1500, [18, 28], pack('ninja_monk', 110), {
    roar: 'A bell rings, and the Pale Prophet walks out of the fog, smiling at everyone. "Lie down. Rest. It doesn\'t hurt."',
    enrage: 'The Prophet\'s smile splits wide, and the stillness pours out of him!',
    area: { every: 3, targets: 5, name: 'rings the bell of stillness', fx: 'acid' },
    summon: { kind: 'plague_zombie', count: 4, text: 'The flock rises out of the ground at the bell!' },
    trophy: 'ge_plague_bell',
  }, { look: { grey: true, bright: 1.15 }, nature: 'undead', armor: 0.1, dodge: 0.15, loot: { herbs: 14, cloth: 8 } }),
  ge_engine_mind: boss('ge_engine_mind', 'The Engine Mind', 1700, [22, 32], pack('robot_destroyer', 130), {
    roar: 'The ground shakes in rhythm. The Engine Mind strides out of the smoke, every joint of it counting. "INEFFICIENCY DETECTED."',
    enrage: 'The Engine Mind vents steam from every seam and runs past its limits!',
    area: { every: 3, targets: 5, name: 'fires a burning beam', fx: 'beam' },
    summon: { kind: 'steam_golem', count: 2, text: 'It assembles new machines out of the wreckage!' },
    trophy: 'ge_engine_core',
  }, { look: { hue: 30, bright: 0.9 }, nature: 'machine', armor: 0.35, dodge: 0.02, interval: 1.5, loot: { iron: 20, copper: 8 } }),
  ge_drowned_king: boss('ge_drowned_king', 'The Drowned King', 1650, [22, 33], pack('pirate_zombie', 140), {
    roar: 'The sea draws back, and the Drowned King walks up the beach on a wave, crowned in coral. "Come down to the water, little town."',
    enrage: 'The Drowned King roars, and the tide rushes in behind him!',
    area: { every: 3, targets: 5, name: 'brings the tide crashing down', fx: 'frost' },
    summon: { kind: 'squid_spawn', count: 3, text: 'Squid-kin crawl up out of the surf to guard their king!' },
    trophy: 'ge_drowned_crown',
  }, { look: { hue: 150, bright: 0.8 }, nature: 'undead', armor: 0.2, loot: { pearls: 6, gems: 3 } }),
  ge_kharzul: boss('ge_kharzul', 'Kharzul the Undying', 1750, [24, 35], pack('samurai_commander', 120), {
    roar: 'A horn sounds that nobody has blown for a thousand years. Kharzul rides out at the head of his dead. "The war is not over."',
    enrage: 'Kharzul is cut down, and rises again, angrier!',
    area: { every: 3, targets: 5, name: 'sweeps his great blade', fx: 'quake' },
    summon: { kind: 'death_knight', count: 2, text: 'Kharzul calls his oldest knights up out of the earth!' },
    trophy: 'ge_war_banner',
  }, { look: { grey: true, bright: 0.65 }, nature: 'undead', armor: 0.3, loot: { iron: 16, bone: 10 } }),

  // their lieutenants: each a boss of its own (an outpost to clear, a host to lead), with no trophy of its own
  ge_ember_witch: boss('ge_ember_witch', 'Isolde the Ember Witch', 560, [15, 24], pack('fire_wizard', 80), { roar: 'Isolde laughs, and the air catches fire around her.', enrage: 'The Ember Witch blazes up like a bonfire!', area: { every: 3, targets: 3, name: 'throws a sheet of fire', burns: true, fx: 'fire' } }, { ranged: true, look: { hue: -10 } }),
  ge_gate_warden: boss('ge_gate_warden', 'Gorrath the Gate Warden', 720, [17, 26], pack('hk_demon', 140), { roar: 'Gorrath ducks out of a gate of iron, horns scraping the sky.', enrage: 'Gorrath bellows, and the gate behind him opens wider!', summon: { kind: 'red_imp', count: 3, text: 'Imps pour out of the gate!' } }, { nature: 'beast', armor: 0.2, look: { hue: 260, bright: 0.8 } }),
  ge_black_seneschal: boss('ge_black_seneschal', 'The Black Seneschal', 640, [16, 25], pack('knight_3', 82), { roar: 'The Black Seneschal salutes, very correctly, and draws.', enrage: 'The Seneschal stops being polite!', summon: { kind: 'fallen_knight', count: 2, text: 'The Seneschal calls his knights!' } }, { look: { grey: true, bright: 0.5 }, armor: 0.3 }),
  ge_drake_lord: boss('ge_drake_lord', 'Vyrax the Drake Lord', 680, [17, 26], { sheet: 'drakes', block: 1, scale: 2.4 }, { roar: 'Vyrax drops out of the sky with a crash.', enrage: 'Vyrax screams, and his scales glow red-hot!', area: { every: 3, targets: 3, name: 'breathes fire', burns: true, fx: 'fire' } }, { look: { hue: -20 }, nature: 'beast', ranged: true, loot: { hide: 6, wyrm_scale: 1 } }),
  ge_wyrm_priest: boss('ge_wyrm_priest', 'The Wyrm Priest', 540, [14, 22], pack('shaman_king', 88), { roar: 'The Wyrm Priest raises the skull of a dragon and chants.', enrage: 'The Priest calls on the Mother!', summon: { kind: 'ember_wyrmling', count: 3, text: 'Wyrmlings hatch at his feet!' } }, { ranged: true, look: { hue: 10 } }),
  ge_clutch_warden: boss('ge_clutch_warden', 'Ossk, Warden of the Clutch', 760, [18, 27], { sheet: 'dawn', block: 236, scale: 5.5 }, { roar: 'Ossk uncoils from around the eggs, hissing.', enrage: 'Ossk goes mad to save the eggs!', area: { every: 4, targets: 3, name: 'lashes its tail', fx: 'quake' } }, { nature: 'beast', armor: 0.25, loot: { hide: 6, bone: 6 } }),
  ge_rat_mother: boss('ge_rat_mother', 'The Rat Mother', 560, [14, 22], pack('gorgon_2', 84), { roar: 'Something huge shifts in the mill, and a thousand rats come pouring out.', enrage: 'The Rat Mother shrieks!', summon: { kind: 'plague_rat', count: 5, text: 'Rats flood out of every crack!' } }, { look: { grey: true, bright: 0.8 } }),
  ge_bell_ringer: boss('ge_bell_ringer', 'Old Toller, the Bell Ringer', 640, [16, 24], pack('hk_zombie_brute', 96), { roar: 'Old Toller drags on his bell rope, and the drowned chapel tolls.', enrage: 'Toller rings and rings and rings!', summon: { kind: 'plague_zombie', count: 3, text: 'The dead answer the bell!' } }, { nature: 'undead', look: { hue: 60, bright: 0.85 } }),
  ge_mourner: boss('ge_mourner', 'The Mourner', 600, [15, 24], pack('hk_mummy', 86), { roar: 'A veiled figure sings, and everyone listening wants to lie down.', enrage: 'The Mourner\'s hymn turns to a scream!', area: { every: 3, targets: 3, name: 'sings a hymn of rot', fx: 'acid' } }, { nature: 'undead', look: { grey: true } }),
  ge_foreman: boss('ge_foreman', 'Unit Foreman', 760, [17, 26], pack('hk_juggernaut', 120), { roar: 'UNIT FOREMAN: "REALLOCATING YOU TO THE QUARRY."', enrage: 'The Foreman overclocks!', summon: { kind: 'clockwork_imp', count: 3, text: 'Repair imps swarm out!' } }, { nature: 'machine', armor: 0.35, look: { hue: 30 }, loot: { iron: 8, copper: 3 } }),
  ge_blade_unit: boss('ge_blade_unit', 'Blade Unit Seven', 580, [17, 25], pack('robot_swordsman', 82), { roar: 'Blade Unit Seven unfolds its arms. All of them are swords.', enrage: 'Blade Unit Seven spins up to a blur!', area: { every: 3, targets: 3, name: 'spins its blades', fx: 'shell' } }, { nature: 'machine', armor: 0.25, dodge: 0.16, loot: { iron: 8 } }),
  ge_gunner_prime: boss('ge_gunner_prime', 'Gunner Prime', 600, [16, 25], pack('robot_infantry', 84), { roar: 'Gunner Prime levels its barrel. "TARGETS ACQUIRED."', enrage: 'Gunner Prime fires everything!', area: { every: 3, targets: 3, name: 'fires a volley of shells', burns: true, fx: 'shell' } }, { nature: 'machine', armor: 0.25, ranged: true, loot: { iron: 8 } }),
  ge_drowned_admiral: boss('ge_drowned_admiral', 'Admiral Kell, Drowned', 640, [16, 25], pack('pirate_leader', 92), { roar: 'Admiral Kell steps off his rotting deck, sword in hand, barnacles on his hat.', enrage: 'Kell bellows for his crew!', summon: { kind: 'drowned_sailor', count: 3, text: 'His drowned crew climb out of the water!' } }, { nature: 'undead', look: { hue: 150, grey: true } }),
  ge_tide_witch: boss('ge_tide_witch', 'The Tide Witch', 560, [15, 23], pack('squidman', 90), { roar: 'The Tide Witch rises out of a pool, singing.', enrage: 'The Tide Witch calls the sea!', area: { every: 3, targets: 3, name: 'throws a wave', fx: 'frost' } }, { ranged: true, look: { hue: 200 }, loot: { pearls: 2, bone: 3 } }),
  ge_deep_maw: boss('ge_deep_maw', 'The Deep Maw', 780, [18, 28], { sheet: 'dawn', block: 235, scale: 5.5 }, { roar: 'The water bulges, and something all mouth comes up out of it.', enrage: 'The Deep Maw thrashes!', area: { every: 4, targets: 3, name: 'thrashes in the shallows', fx: 'quake' } }, { nature: 'beast', armor: 0.2, loot: { hide: 6, bone: 6 } }),
  ge_bone_marshal: boss('ge_bone_marshal', 'The Bone Marshal', 640, [16, 25], pack('skeleton_spearman', 92), { roar: 'The Bone Marshal raps his spear on the ground, and the dead form ranks.', enrage: 'The Marshal sounds the charge!', summon: { kind: 'skeleton_warrior', count: 3, text: 'Skeletons pull themselves out of the earth!' } }, { nature: 'undead', armor: 0.15 }),
  ge_hollow_knight: boss('ge_hollow_knight', 'Ser Hollow', 700, [17, 27], pack('knight_2', 82), { roar: 'An empty suit of armour rides out onto the bridge and lowers its lance.', enrage: 'Ser Hollow fights like a man with nothing to lose. He has nothing.', area: { every: 3, targets: 3, name: 'rides through the line', fx: 'quake' } }, { nature: 'undead', armor: 0.35, look: { grey: true, bright: 0.6 } }),
  ge_gravecaller: boss('ge_gravecaller', 'The Gravecaller', 560, [14, 22], { sheet: 'champ_necromancer', block: 0, scale: 1.3 }, { roar: 'The Gravecaller lifts a lantern, and the barrow\'s dead lift their heads.', enrage: 'The Gravecaller calls up everything!', summon: { kind: 'revenant', count: 2, text: 'Revenants claw out of the ossuary!' } }, { nature: 'undead', ranged: true, look: { hue: 120, bright: 0.8 } }),
};

/* ------------------------------------------------------------ its armies (merged into RAID_KINDS; never rolled) */

export const GREAT_ENEMY_RAIDS: RaidKind[] = [
  { id: 'enemy_tower', name: "Malgrith's host", goal: 'harm', goals: { harm: 4, burn: 2, kidnap: 1 }, enemies: { cultist: 10, storm_mage: 14, fallen_knight: 18, crimson_knight: 20, brute_demon: 34 }, fromDay: 9999, weight: 0, speed: 45, bribable: false, plural: false },
  { id: 'enemy_brood', name: "Sarnath's brood", goal: 'harm', goals: { harm: 4, burn: 3 }, enemies: { ember_wyrmling: 12, drake: 10, red_drake: 24, black_drake: 26 }, fromDay: 9999, weight: 0, speed: 55, bribable: false, plural: false },
  { id: 'enemy_plague', name: "The Pale Prophet's flock", goal: 'harm', goals: { harm: 5, kidnap: 2 }, enemies: { plague_rat: 4, plague_zombie: 9, ghoul: 12, cultist: 11, zombie_brute: 18, zombie_ogre: 30 }, fromDay: 9999, weight: 0, speed: 30, bribable: false, plural: false },
  { id: 'enemy_engine', name: "The Engine Mind's machines", goal: 'harm', goals: { harm: 4, burn: 1, steal: 1 }, steals: 'valuables', enemies: { scout_drone: 6, clockwork_imp: 10, iron_sentry: 14, brass_golem: 24, steam_golem: 24, iron_golem: 38 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: true },
  { id: 'enemy_drowned', name: "The Drowned King's tide", goal: 'harm', goals: { harm: 4, kidnap: 2 }, enemies: { drowned_sailor: 8, squid_spawn: 10, coral_golem: 18, tide_wyrm: 38 }, fromDay: 9999, weight: 0, speed: 35, bribable: false, plural: false },
  { id: 'enemy_undying', name: "Kharzul's legions", goal: 'harm', goals: { harm: 5, burn: 1 }, enemies: { skeleton_warrior: 9, skeleton_archer: 8, wraith_archer: 14, bone_knight: 18, revenant: 18, death_knight: 34 }, fromDay: 9999, weight: 0, speed: 40, bribable: false, plural: true },
];

/* ------------------------------------------------------------ their unique weapons (merged into data/uniques.ts' rows) */

/** A unique's row as data/uniques.ts keeps it: id, name, family, tier, era (for its ammo), quirks, lore, its bosses.
 *  Each Enemy carries its own; its three lieutenants share one between them (whichever falls first may give it up). */
export const GREAT_ENEMY_UNIQUES: [string, string, string, number, 'neolithic' | 'medieval' | 'industrial', Record<string, number>, string, string[]][] = [
  ['vorn_stormstaff', 'The Stormstaff of Vorn', 'st', 10, 'medieval', { crit: 0.15, pierce: 0.4 }, 'Malgrith\'s staff, still crackling. Lightning goes where it points.', ['ge_malgrith']],
  ['ember_rod', 'The Ember Rod', 'wd', 7, 'medieval', { crit: 0.1, cleave: 0.2 }, 'A wand of the Tower Lord\'s captains, warm to the touch.', ['ge_ember_witch', 'ge_gate_warden', 'ge_black_seneschal']],
  ['mothers_fang', "The Mother's Fang", 'sp', 10, 'medieval', { beastDamage: 10, pierce: 0.5 }, 'A fang of Sarnath on an ash shaft. It never cools.', ['ge_sarnath']],
  ['broodkin_blade', 'Broodkin', 'sw', 7, 'medieval', { beastDamage: 6, crit: 0.08 }, 'A blade of drake scales, taken from the Mother\'s eldest.', ['ge_drake_lord', 'ge_wyrm_priest', 'ge_clutch_warden']],
  ['stillness_scythe', 'The Stillness', 'sc', 10, 'medieval', { lifesteal: 0.12, undeadDamage: 8 }, 'The Pale Prophet\'s scythe. Whatever it touches goes quiet.', ['ge_pale_prophet']],
  ['bell_hammer', 'The Bell Hammer', 'mc', 7, 'medieval', { stun: 0.3, undeadDamage: 6 }, 'A clapper torn out of the drowned chapel\'s bell, on a handle.', ['ge_rat_mother', 'ge_bell_ringer', 'ge_mourner']],
  ['engine_cleaver', 'The Engine Cleaver', 'ax', 10, 'medieval', { machineDamage: 10, cleave: 0.5 }, 'A blade the Engine Mind made to take itself apart with. It works on anything.', ['ge_engine_mind']],
  ['unit_blade', 'Unit Blade', 'sw', 7, 'medieval', { machineDamage: 6, speed: 0.9 }, 'One of Blade Unit Seven\'s arms. It still hums.', ['ge_foreman', 'ge_blade_unit', 'ge_gunner_prime']],
  ['coral_trident', 'The Coral Trident', 'sp', 10, 'medieval', { pierce: 0.5, lifesteal: 0.08 }, 'The Drowned King\'s trident, crusted with coral. Salt water drips from it on dry days.', ['ge_drowned_king']],
  ['wreckers_hook', "The Wrecker's Hook", 'dg', 7, 'medieval', { crit: 0.14, lifesteal: 0.06 }, 'A boat hook filed to a point by drowned hands.', ['ge_drowned_admiral', 'ge_tide_witch', 'ge_deep_maw']],
  ['last_war_blade', 'The Last War', 'gs', 10, 'medieval', { undeadDamage: 10, cleave: 0.45 }, 'Kharzul\'s great blade, a thousand years notched. It has ended a war at last.', ['ge_kharzul']],
  ['marshals_spear', "The Marshal's Spear", 'sp', 7, 'medieval', { undeadDamage: 6, pierce: 0.35 }, 'The Bone Marshal\'s spear. The dead step back from it.', ['ge_bone_marshal', 'ge_hollow_knight', 'ge_gravecaller']],
];

/* ------------------------------------------------------------ relics (merged into ITEMS) and the monument */

const relic = (id: string, name: string, slot: ItemDef['slot'], effects: ItemDef['effects'], description: string, icon: ItemDef['icon']): ItemDef => ({
  id, name, slot, station: 'campfire', cost: {}, seconds: 0, research: ['__relic'], relic: true, effects, description, icon,
});
export const GREAT_ENEMY_TROPHIES: readonly ItemDef[] = [
  relic('ge_tower_crown', 'The Iron Crown of Vorn', 'head', { armor: 0.18, morale: 8, power: 0.35 }, 'Malgrith\'s crown, cold as a well. Its wearer\'s spells strike like his did.', { sheet: 'Hat', x: 2, y: 1 }),
  relic('ge_brood_heart', 'The Heart of the Brood', 'charm', { armor: 0.2, morale: 6, power: 0.2 }, 'Sarnath\'s heart, still hot. No fire burns its bearer.', { sheet: 'Flesh', x: 1, y: 0 }),
  relic('ge_plague_bell', 'The Bell of Stillness', 'charm', { dodge: 0.1, morale: 4, gather: { forage: 1.3 } }, 'The Prophet\'s bell, cracked. Rung softly, it calms the sick.', { sheet: 'Magic', x: 7, y: 1 }),
  relic('ge_engine_core', 'The Engine Core', 'charm', { armor: 0.22, morale: 5, power: 0.15 }, 'The Mind\'s heart of brass, still ticking. It keeps its bearer\'s hands steady.', { sheet: 'Magic', x: 7, y: 1 }),
  relic('ge_drowned_crown', 'The Coral Crown', 'head', { armor: 0.16, morale: 7, dodge: 0.08 }, 'The Drowned King\'s crown. Its wearer can hold their breath for an hour.', { sheet: 'Hat', x: 2, y: 1 }),
  relic('ge_war_banner', 'Kharzul\'s Banner', 'charm', { armor: 0.15, morale: 12, power: 0.2 }, 'The banner of a war a thousand years long, at last laid down. Those who fight under it do not break.', { sheet: 'Flesh', x: 1, y: 0 }),
];

export const MONUMENT = 'victory_monument';
/** Raised by the town when the Enemy falls (sim/greatEnemy.ts), never by the planner (its `NEVER`). */
export const MONUMENT_BUILDING: BuildingDef = {
  id: MONUMENT,
  name: 'Victory Monument',
  layer: 'fore',
  width: 1,
  depth: 1,
  cost: { stone: 20 },
  buildSeconds: 120,
  purpose: 'Raised where the town can see it, to remember the day the Great Enemy fell before its walls and the long peace that came after.',
  morale: [3, 'The victory monument stands'],
};
