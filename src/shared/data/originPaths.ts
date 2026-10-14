// Origin roads (the owner's ask: some evolutions open only to certain peoples). Every people has one road of its own,
// a third choice at the second evolution (level 30) off a stage-1 calling that suits it: the liches' Grave Cantor off
// the Occultist, the orcs' Nob off the Berserker, the dwarves' Hearthguard off the Sentinel. It runs on straight from
// there (a stage-3 calling and its ascended form: no more forks, the people's own way is narrow) and is a step
// stronger than the shared roads (`ORIGIN_EDGE` in data/levels.ts). Each node has its name, text, lore, signature
// skill, emblem and stat lean; data/paths.ts adds them to the tree (`ORIGIN_PATHS`, `roadsFrom`).

import type { ClassId, ClassStats } from './classes';
import type { OriginId } from './origins';
import type { Attrs } from './attributes';
import type { Passive } from './abilities';
import { drain, grant, heal, hit, inflict, revive, summon, type Effect } from './effects';

type Glyph = [string, number];
export interface OriginNode {
  id: string;
  name: string;
  cls: ClassId;
  text: string;
  lore: string;
  /** The signature skill: [id, name, passive | [cooldown, effects]]. */
  skill: [string, string, Passive | [number, Effect[]]];
  lean: Partial<Attrs>;
  emblem: { main: Glyph; charge?: Glyph };
  stats?: Partial<ClassStats>;
  companion?: string;
}
export interface OriginRoad {
  origin: OriginId;
  /** The stage-1 calling it branches from. */
  from: string;
  /** The stage-2 and stage-3 callings, and the ascended form's [id, name]. */
  two: OriginNode;
  three: OriginNode;
  asc: [string, string];
}

const P = (p: Passive) => p;
const A = (cooldown: number, effects: Effect[]): [number, Effect[]] => [cooldown, effects];

export const ORIGIN_ROADS: readonly OriginRoad[] = [
  {
    origin: 'settlers', from: 'knight',
    two: { id: 'militia_captain', name: 'Militia Captain', cls: 'knight', text: 'Drills farmhands into a line that holds, and stands at its middle.', lore: 'No noble blood and no warhorse: only a pitchfork that became a pike, a hayfield that became a drill ground, and neighbours who would follow them anywhere. The Militia Captain makes an army out of a village, and the village never forgets it.', skill: ['muster_the_village', 'Muster the Village', A(28, [grant('protect', 8, 'allies'), grant('inspired', 8, 'allies')])], lean: { str: 0.1, vit: 0.15, cha: 0.2 }, emblem: { main: ['LongWep', 32], charge: ['Tool', 3] } },
    three: { id: 'shire_reeve', name: 'Shire Reeve', cls: 'knight', text: 'The law of the land with a sword: every road safe, every raider answered.', lore: 'The Shire Reeve rides the bounds and keeps the king\'s peace where there is no king. Bandits move a county over when they hear the name, and the towns along the road send cheese at midwinter.', skill: ['the_kings_peace', 'The King\'s Peace', P({ guard: 0.2, hp: 0.12, armor: 0.04 })], lean: { str: 0.1, vit: 0.2, wis: 0.1, cha: 0.15 }, emblem: { main: ['Shield', 3] } },
    asc: ['lord_protector', 'Lord Protector'],
  },
  {
    origin: 'lich', from: 'occultist',
    two: { id: 'grave_cantor', name: 'Grave Cantor', cls: 'necromancer', text: 'Sings to the dead, and the dead sing back: the fallen of both sides rise to the hymn.', lore: 'Under the necropolis the old hymns are still sung, in voices that stopped breathing centuries ago. The Grave Cantor leads them. When they lift the requiem the barrows answer, and what crawls out fights for the town that sang it awake.', skill: ['requiem', 'Requiem', A(40, [summon('wraith'), summon('wraith'), inflict('fear', 6, 'foes', 0.5)])], lean: { int: 0.3, wis: 0.1, cha: 0.2 }, emblem: { main: ['Book', 40], charge: ['Music', 8] } },
    three: { id: 'deathless_magister', name: 'Deathless Magister', cls: 'necromancer', text: 'Master of the long dark: drains the living to mend the dead.', lore: 'The Deathless Magister holds a chair in a school that has no living students. Their lectures are short, their examinations final, and the essay question is always the same: why should anything stay dead?', skill: ['grave_tithe', 'Grave Tithe', A(22, [drain(1.4, 'dark', 'foes'), heal(0.6, 'allies')])], lean: { int: 0.35, vit: 0.15, cha: 0.1 }, emblem: { main: ['Wand', 26] } },
    asc: ['archlich', 'Archlich'],
  },
  {
    origin: 'druid', from: 'druid',
    two: { id: 'oakheart', name: 'Oakheart', cls: 'druid', text: 'Bark for skin and sap for blood: the grove holds them up.', lore: 'Oakhearts are druids the forest has adopted. Their skin roughens, their hair greens in spring, and when they are struck the wound closes over like a tree healing round a nail. The grove counts them among its own.', skill: ['heartwood', 'Heartwood', P({ hp: 0.18, armor: 0.06, regen: 0.02 })], lean: { vit: 0.3, wis: 0.25 }, emblem: { main: ['LongWep', 40], charge: ['Potion', 4] } },
    three: { id: 'circle_warden', name: 'Circle Warden', cls: 'druid', text: 'Keeper of the standing stones: calls the whole wood to war.', lore: 'The Circle Warden keeps the stones that were old when the town was a footprint. At their word the roots heave, the thorns close round the raiders and the stags come down out of the hills. The circle does not lose.', skill: ['the_wood_awakes', 'The Wood Awakes', A(50, [summon('treant'), summon('treant'), inflict('slow', 6, 'foes', 0.6)])], lean: { wis: 0.35, int: 0.15, vit: 0.1 }, emblem: { main: ['Magic', 30] } },
    asc: ['first_grove', 'Voice of the First Grove'],
  },
  {
    origin: 'vampire', from: 'berserker',
    two: { id: 'thrall_lord', name: 'Thrall-Lord', cls: 'blood_knight', text: 'Drinks deep in the fight, and the thralls fight harder for it.', lore: 'Among the Blood Court the Thrall-Lords are the ones who still remember what it was to be hungry. They go to war at the head of their thralls and come home fuller than they left, and the thralls are proud to have been bled for them.', skill: ['the_red_cup', 'The Red Cup', A(18, [drain(1.7, 'blood'), grant('berserk', 5, 'self')])], lean: { str: 0.25, cha: 0.2 }, emblem: { main: ['Potion', 0], charge: ['Amulet', 3] } },
    three: { id: 'night_scion', name: 'Scion of the Long Night', cls: 'blood_knight', text: 'Old blood, and the night itself on their side.', lore: 'A Scion of the Long Night has outlived three dynasties and buried two. Their blood is old enough to command, and in the dark it does: bats boil out of the eaves, the wounded rise half-dead, and the dawn comes late.', skill: ['blood_of_ages', 'Blood of Ages', P({ lifesteal: 0.25, hp: 0.12, damage: 0.08 })], lean: { str: 0.2, vit: 0.15, cha: 0.2 }, emblem: { main: ['Amulet', 7] } },
    asc: ['eternal_count', 'Eternal Count'],
  },
  {
    origin: 'werewolf', from: 'ranger',
    two: { id: 'moonhowler', name: 'Moonhowler', cls: 'shapeshifter', text: 'Wears the wolf whenever they fight, and the pack answers the howl.', lore: 'A Moonhowler no longer waits for the full moon. The change comes when they call it, and with it the howl that brings every wolf in the hills running. They hunt with the pack and the pack hunts for them.', skill: ['the_great_howl', 'The Great Howl', A(36, [summon('companion_wolf'), summon('companion_wolf'), grant('berserk', 6, 'allies')])], lean: { str: 0.25, dex: 0.2, vit: 0.1 }, emblem: { main: ['Tool', 14], charge: ['Amulet', 4] } },
    three: { id: 'silverback', name: 'Silverback', cls: 'shapeshifter', text: 'Grey at the muzzle and terrible: the old wolf the young ones fear.', lore: 'Silverbacks are the pack\'s grandfathers and grandmothers: grizzled, scarred and slower to anger than the young, and far more dangerous for it. Silver burns them less than it should. Nothing else burns them at all.', skill: ['old_wolf', 'The Old Wolf', P({ hp: 0.2, damage: 0.12, lifesteal: 0.1 })], lean: { str: 0.3, vit: 0.25 }, emblem: { main: ['Hat', 5] } },
    asc: ['moon_avatar', 'Avatar of the Moon'],
  },
  {
    origin: 'robot', from: 'tinker',
    two: { id: 'servitor_prime', name: 'Servitor Prime', cls: 'engineer', text: 'A unit rebuilt for war: plating, a second arm and a turret on the shoulder.', lore: 'The colony refits its best units for the defence of the core. A Servitor Prime comes out of the assembler heavier, quicker and with three new subroutines for the efficient removal of threats. It does not mind. It was asked politely.', skill: ['deploy_turrets', 'Deploy Turrets', A(44, [summon('iron_sentry'), summon('iron_sentry'), grant('shield', 6, 'self', 1)])], lean: { int: 0.3, vit: 0.15, dex: 0.1 }, emblem: { main: ['ShortWep', 25], charge: ['Armor', 56] } },
    three: { id: 'war_engine', name: 'War Engine', cls: 'engineer', text: 'Walking siege: armour like a wall and guns like a battery.', lore: 'Somewhere along the upgrades the Servitor stopped being a unit and became a machine of war. The War Engine fills a doorway, shrugs off arrows and answers with a barrage the old stories would have called the wrath of a god.', skill: ['overclocked_core', 'Overclocked Core', P({ hp: 0.2, armor: 0.08, damage: 0.1 })], lean: { int: 0.25, vit: 0.3 }, emblem: { main: ['Armor', 56] } },
    asc: ['omega_construct', 'Omega Construct'],
  },
  {
    origin: 'dwarves', from: 'sentinel',
    two: { id: 'hearthguard', name: 'Hearthguard', cls: 'guardian', text: 'Sworn to the hold\'s hearth: a door of iron and beard.', lore: 'The Hearthguard are chosen at the forge and sworn on the anvil. They do not leave the hold except to die for it, and they have very rarely been asked to. Raiders who reach the inner door find it is not a door.', skill: ['oath_of_the_anvil', 'Oath of the Anvil', P({ armor: 0.08, guard: 0.2, resist: 0.2 })], lean: { vit: 0.35, str: 0.15 }, emblem: { main: ['Armor', 56], charge: ['Shield', 1] } },
    three: { id: 'runic_bastion', name: 'Runic Bastion', cls: 'guardian', text: 'Runes cut into the shield and the stone itself takes the blows.', lore: 'A Runic Bastion carries a shield the runesmiths spent a lifetime on, and every rune on it is a promise kept. Blows meant for the line land on the stone round them instead, and the stone does not care.', skill: ['wall_of_runes', 'Wall of Runes', A(30, [grant('shield', 10, 'allies', 2), grant('protect', 10, 'allies'), grant('taunt', 8, 'self')])], lean: { vit: 0.35, wis: 0.15, str: 0.1 }, emblem: { main: ['Scroll', 8] } },
    asc: ['stonefather', 'Stonefather'],
  },
  {
    origin: 'merfolk', from: 'summoner',
    two: { id: 'tidecaller', name: 'Tidecaller', cls: 'summoner', text: 'The sea comes when they call: a wave that walks and fights.', companion: 'coral_golem', lore: 'Tidecallers grow up singing to the surf until the surf sings back. In a fight they open their arms and the water comes up out of the ground, out of the barrels and the wells, and stands beside them with fists of foam.', skill: ['call_the_tide', 'Call the Tide', A(40, [summon('coral_golem'), summon('coral_golem'), hit(1.3, 'water', 'foes')])], lean: { int: 0.25, wis: 0.15, cha: 0.25 }, emblem: { main: ['Potion', 10], charge: ['Music', 8] } },
    three: { id: 'leviathan_speaker', name: 'Leviathan Speaker', cls: 'summoner', text: 'Speaks with the great things of the deep, and sometimes they surface.', companion: 'coral_golem', lore: 'A Leviathan Speaker has gone down past where the light ends and come back up with a promise. When the town is in danger the sea darkens, the boats rock, and something very large and very old lifts its head to listen.', skill: ['from_the_deep', 'From the Deep', A(70, [summon('coral_golem'), summon('coral_golem'), summon('coral_golem'), inflict('stun', 2, 'foes', 0.4)])], lean: { int: 0.3, cha: 0.3 }, emblem: { main: ['LongWep', 6] } },
    asc: ['deep_sovereign', 'Sovereign of the Deep'],
  },
  {
    origin: 'nomads', from: 'archer',
    two: { id: 'horse_archer', name: 'Horse Archer', cls: 'archer', text: 'Shoots from the saddle at the gallop, and is gone before the answer.', lore: 'The horde learned to ride before it learned to walk, and to shoot before it learned to count. A Horse Archer empties a quiver in the time it takes the foe to turn, wheels away, and comes again from the side.', skill: ['parthian_shot', 'Parthian Shot', A(12, [hit(1.6, 'physical', 'foes'), grant('haste', 4, 'self')])], lean: { dex: 0.4, vit: 0.1 }, emblem: { main: ['Ammo', 13], charge: ['Hat', 1] } },
    three: { id: 'windrunner', name: 'Windrunner', cls: 'archer', text: 'Rides with the wind at their back and arrows that never seem to miss.', lore: 'Windrunners are said to have outridden a storm across the steppe and kept its wind for their own. Their arrows go where they look, their horses never tire, and the horizon is only ever a day away.', skill: ['the_endless_sky', 'The Endless Sky', P({ speed: 0.1, accuracy: 0.08, crit: 0.06 })], lean: { dex: 0.45, wis: 0.1 }, emblem: { main: ['Ammo', 9] } },
    asc: ['open_sky_lord', 'Lord of the Open Sky'],
  },
  {
    origin: 'fae', from: 'bard',
    two: { id: 'glamour_weaver', name: 'Glamour Weaver', cls: 'dancer', text: 'Weaves glamours over the fight: the foe sees friends, and strikes them.', lore: 'Glamour Weavers learned their craft at the Court, where nothing is what it seems and everything is beautiful. In battle they draw the veil across the foe\'s eyes, and the raiders find themselves fighting each other, laughing.', skill: ['the_veil', 'The Veil', A(26, [inflict('charm', 5, 'foes', 0.45), grant('haste', 5, 'allies')])], lean: { dex: 0.2, cha: 0.35 }, emblem: { main: ['Ring', 2], charge: ['Magic', 30] } },
    three: { id: 'court_enchanter', name: 'Court Enchanter', cls: 'dancer', text: 'A favourite of the Court: dreams for friends, nightmares for foes.', lore: 'A Court Enchanter is welcome at the revels, which is to say they have survived them. They carry the Court\'s favour like a scent, and where they dance the grass grows greener and the foe falls asleep in it.', skill: ['dream_and_nightmare', 'Dream and Nightmare', A(32, [inflict('sleep', 4, 'foes', 0.5), heal(0.7, 'allies'), grant('inspired', 8, 'allies')])], lean: { cha: 0.35, wis: 0.15, dex: 0.1 }, emblem: { main: ['Amulet', 4] } },
    asc: ['dream_sovereign', 'Sovereign of Dreams'],
  },
  {
    origin: 'alchemists', from: 'tinker',
    two: { id: 'transmuter', name: 'Transmuter', cls: 'alchemist', text: 'Turns steel to lead in the foe\'s hand and water to wine in the healer\'s.', lore: 'Transmuters are the Crucible\'s first rank: alchemists who have understood that a thing is only what it is agreed to be, and have stopped agreeing. They mend wounds by persuading them they were never there.', skill: ['transmute', 'Transmute', A(20, [hit(1.5, 'arcane'), inflict('vulnerable', 6, 'foe', 0.8), heal(0.5, 'weakest')])], lean: { int: 0.4, wis: 0.1 }, emblem: { main: ['Money', 16], charge: ['Potion', 27] } },
    three: { id: 'great_work_adept', name: 'Adept of the Great Work', cls: 'alchemist', text: 'Close to the Stone: elixirs that make the party more than mortal for a while.', lore: 'An Adept of the Great Work has seen the red stage in the bottom of a flask and lived. Their elixirs do things a physician would not believe: wounds closing as you watch, arms that do not tire, a fearlessness like drink without the stumble.', skill: ['quintessence', 'Quintessence', A(40, [heal(1, 'allies'), grant('berserk', 8, 'allies'), grant('protect', 8, 'allies'), revive(0.3)])], lean: { int: 0.35, wis: 0.25 }, emblem: { main: ['Potion', 36] } },
    asc: ['hermetic_sage', 'Hermetic Sage'],
  },
  {
    origin: 'knights', from: 'knight',
    two: { id: 'order_knight', name: 'Knight of the Order', cls: 'knight', text: 'Sworn to the Order\'s rule: the lance, the vow and the chapterhouse.', lore: 'To be a Knight of the Order is to keep the vows when nobody is looking and the line when everybody is. They ride in the van, they pray before the charge, and they have never once been seen to retreat in good order. They do not retreat.', skill: ['vow_of_the_order', 'Vow of the Order', P({ hp: 0.12, damage: 0.08, guard: 0.15 })], lean: { str: 0.2, vit: 0.15, wis: 0.15 }, emblem: { main: ['LongWep', 28], charge: ['Shield', 3] } },
    three: { id: 'knight_commander', name: 'Knight Commander', cls: 'knight', text: 'Leads the Order\'s charge, and the charge does not stop.', lore: 'A Knight Commander has a chapterhouse of their own and a banner the raiders know. When it goes forward the whole line goes with it, lances level, and the ground shakes all the way to the gate.', skill: ['the_great_charge', 'The Great Charge', A(30, [hit(2, 'physical', 'foes'), inflict('stun', 2, 'foes', 0.4), grant('inspired', 8, 'allies')])], lean: { str: 0.25, vit: 0.15, cha: 0.2 }, emblem: { main: ['LongWep', 18] } },
    asc: ['order_grand_master', 'Grand Master of the Order'],
  },
  {
    origin: 'orcs', from: 'berserker',
    two: { id: 'nob', name: 'Nob', cls: 'warrior', text: 'Bigger than the other boyz, and loud about it: the horde fights harder near them.', lore: 'A Nob is an orc who won enough fights to get bigger, and got bigger enough to win more. They lead from the front because the front is where the fighting is, and the boyz follow because the Nob is louder than the fear.', skill: ['oi_ladz', 'Oi, Ladz!', A(26, [grant('berserk', 7, 'allies'), hit(1.5)])], lean: { str: 0.35, vit: 0.15 }, emblem: { main: ['MedWep', 8], charge: ['Music', 40] } },
    three: { id: 'big_boss', name: 'Big Boss', cls: 'warrior', text: 'A wall of green muscle and iron: the Waaagh made flesh.', lore: 'Big Bosses are as big as orcs get without becoming weather. They wear the iron of everyone they have beaten and carry the biggest choppa in the camp, and when they roar the whole Warband roars back.', skill: ['da_biggest', 'Da Biggest', P({ hp: 0.22, damage: 0.15, lastStand: 0.3 })], lean: { str: 0.35, vit: 0.3 }, emblem: { main: ['LongWep', 48] } },
    asc: ['waaagh_prophet', 'Prophet of the Waaagh'],
  },
];
