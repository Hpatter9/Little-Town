// Class paths (the owner's ask: eight basic starting callings, and at every evolution a choice of two roads, so the
// tree spreads into many very specific callings, each with a skill of its own). A townsperson begins on one of the
// BASES (a Fighter, a Scout, an Apprentice...) and at each stage level (classes.ts STAGE_LEVELS: 12, 30, 55) may
// take either of the node's two branches; the fifth stage (85) is the one ascended form of wherever they stand, won
// by an ascension as before. Every node stands on an archetype (`cls`: one of the 26 classes of classes.ts), which
// gives it its gear, spells and skills, its dress and hero form; the node adds its own name, a line of what it is,
// a signature skill (data/pathSkills.ts) and, for a few, stats of its own (the Summoner line: a glass cannon). The
// sim (sim/classes.ts) keeps `Person.path` as the node they stand on, and the evolution is a prompt of kind
// `evolve` unless the town is set to let them choose for themselves.

import type { ClassId, ClassStats } from './classes';
import { FOUNDER_CLASSES, FOUNDER_ROADS } from './founderLines';
import { ORIGIN_ROADS } from './originPaths';
import { callingId, ORIGIN_CALLINGS, type CallingForm, type CallingNode } from './originCallings';
import { MYTHIC_CALLINGS, mythicId, WANDERER_ROAD } from './mythic';
import type { OriginId } from './origins';
import type { FamilyId } from './weapons';

export interface PathNode {
  id: string;
  name: string;
  /** 0 the base, 1 to 3 the branches, 4 the ascended form. */
  stage: number;
  from: string | null;
  /** The archetype it fights as. */
  cls: ClassId;
  text: string;
  /** Stats over the archetype's (the Summoner line is frail and fierce). */
  stats?: Partial<ClassStats>;
  /** The creature a caller brings to every fight (classAllies, summonForRaid), in place of the archetype's. */
  companion?: string;
  /** Open only to a townsperson of this people (data/originPaths.ts). */
  origin?: OriginId;
  /** On a founder's own line (data/founderLines.ts): the founder's id, and whether it is the line's own stage. */
  founder?: string;
  own?: boolean;
  /** Its telling, for nodes off the shared tree (the shared ones' is in data/pathLore.ts). */
  lore?: string;
  /** On a people's own base calling's tree (data/originCallings.ts): how it is drawn fighting, and a weapon kind it
   *  may wield over its archetype's (each the nearest set up its road: `formOf`, `armsOf`). */
  calling?: true;
  /** On a mythic calling's tree (data/mythic.ts), the grafted Summoner road among it. */
  mythic?: true;
  form?: CallingForm;
  arms?: FamilyId;
}

const nodes: PathNode[] = [];
const add = (id: string, name: string, stage: number, from: string | null, cls: ClassId, text: string, extra: Partial<PathNode> = {}): string => {
  nodes.push({ id, name, stage, from, cls, text, ...extra });
  return id;
};
/** A branch at stage 1, 2 or 3; `asc` names its ascended form (stage 4), reached only from a stage-3 node. */
type Branch = { id: string; name: string; cls: ClassId; text: string; extra?: Partial<PathNode>; asc?: [string, string] };
const B = (id: string, name: string, cls: ClassId, text: string, extra?: Partial<PathNode>, asc?: [string, string]): Branch => ({ id, name, cls, text, extra, asc });

/** The summoner line's stats: little health, great power (glass cannon: the owner's call). */
const GLASS: Partial<ClassStats> = { hp: 0.6, power: 1.7, armor: -0.04, dodge: 0.02 };

interface Base {
  id: string;
  name: string;
  cls: ClassId;
  text: string;
  /** Its two stage-1 roads, each with two stage-2 roads, each with two stage-3 roads (each naming its ascended form). */
  roads: [[Branch, [[Branch, [Branch, Branch]], [Branch, [Branch, Branch]]]], [Branch, [[Branch, [Branch, Branch]], [Branch, [Branch, Branch]]]]];
}

const BASES: Base[] = [
  {
    id: 'fighter', name: 'Fighter', cls: 'warrior', text: 'A strong arm and whatever is heaviest to hand. The plainest road, and the broadest.',
    roads: [
      [B('knight', 'Knight', 'knight', 'Sworn to the shield: holds the line and takes the blows meant for others.'), [
        [B('paladin', 'Paladin', 'knight', 'A knight who calls on holy light: mends the line and burns the dead.'), [
          B('crusader', 'Crusader', 'knight', 'The hammer of the faith: every blow a judgement, every charge a sermon.', undefined, ['crusader_king', 'Crusader King']),
          B('templar', 'Templar', 'knight', 'A wall of consecrated steel that no curse or spell gets through.', undefined, ['grand_templar', 'Grand Templar']),
        ]],
        [B('dragoon', 'Dragoon', 'dragoon', 'Leaps high and comes down spear-first.'), [
          B('wyvern_knight', 'Wyvern Knight', 'dragoon', 'Fights as if winged: longer leaps, harder landings, and the sky on their side.', undefined, ['dragon_lord', 'Dragon Lord']),
          B('lance_captain', 'Lance Captain', 'dragoon', 'Leads the charge: when they strike, everyone strikes.', undefined, ['lord_of_lances', 'Lord of Lances']),
        ]],
      ]],
      [B('berserker', 'Berserker', 'warrior', 'Fights harder the worse it gets, and does not much mind the getting.'), [
        [B('warlord', 'Warlord', 'warrior', 'A berserker who learned to make everyone else fight like one.'), [
          B('titan', 'Titan', 'warrior', 'Too big to stop: blows that shake the ground and fell two at once.', undefined, ['titan_of_war', 'Titan of War']),
          B('warchief', 'Warchief', 'warrior', 'The war cry that turns a crowd into an army.', undefined, ['high_warchief', 'High Warchief']),
        ]],
        [B('blood_reaver', 'Blood Reaver', 'blood_knight', 'Heals from the wounds they deal; the fight feeds them.'), [
          B('blood_lord', 'Blood Lord', 'blood_knight', 'Every drop spilt nearby is theirs to drink.', undefined, ['sanguine_king', 'Sanguine King']),
          B('gorefiend', 'Gorefiend', 'blood_knight', 'Half mad with it: the lower their health, the more terrible their blows.', undefined, ['avatar_of_slaughter', 'Avatar of Slaughter']),
        ]],
      ]],
    ],
  },
  {
    id: 'guard', name: 'Guard', cls: 'guardian', text: 'Stands at the door. Whatever comes has to get past them first.',
    roads: [
      [B('sentinel', 'Sentinel', 'guardian', 'Shield first, always: draws the blows and turns them.'), [
        [B('bulwark', 'Bulwark', 'guardian', 'A wall with a person somewhere behind it.'), [
          B('aegis', 'Aegis', 'guardian', 'Shields the whole line: blows meant for anyone near land on the Aegis instead.', undefined, ['the_unbreakable', 'The Unbreakable']),
          B('colossus', 'Colossus', 'guardian', 'Armour on armour: too heavy to move, too heavy to be moved.', undefined, ['living_fortress', 'Living Fortress']),
        ]],
        [B('gatewarden', 'Gatewarden', 'guardian', 'Holds the gate: raiders who reach it find it holding back.'), [
          B('ironwall', 'Ironwall', 'guardian', 'Nothing gets by: holds twice as many at the gate as anyone.', undefined, ['warden_eternal', 'Warden Eternal']),
          B('shield_saint', 'Shield Saint', 'knight', 'A guard who found faith: the shield glows, and the hurt behind it mend.', undefined, ['saint_of_the_wall', 'Saint of the Wall']),
        ]],
      ]],
      [B('spellsword', 'Spellsword', 'spellblade', 'Sword in one hand, spell in the other.'), [
        [B('battlemage', 'Battlemage', 'spellblade', 'Casts in the thick of it: fire on the blade, lightning in the charge.'), [
          B('arcane_knight', 'Arcane Knight', 'spellblade', 'Plate woven with wards; spells struck home with the sword.', undefined, ['archon_of_blades', 'Archon of Blades']),
          B('stormblade', 'Stormblade', 'spellblade', 'The blade is a lightning rod: every cut a thunderclap.', undefined, ['tempest_lord', 'Tempest Lord']),
        ]],
        [B('rune_knight', 'Rune Knight', 'spellblade', 'Runes cut into armour and steel: slower magic, and it lasts.'), [
          B('runeguard', 'Runeguard', 'spellblade', 'Runes of warding on everyone near: the party fights under a shield.', undefined, ['runelord', 'Runelord']),
          B('hexblade', 'Hexblade', 'spellblade', 'Runes of ruin on the blade: the struck weaken, slow and fail.', undefined, ['doomblade', 'Doomblade']),
        ]],
      ]],
    ],
  },
  {
    id: 'scout', name: 'Scout', cls: 'archer', text: 'Light on their feet, sharp of eye, and better at a distance.',
    roads: [
      [B('archer', 'Archer', 'archer', 'Shoots from the back, and rarely misses.'), [
        [B('sharpshooter', 'Sharpshooter', 'archer', 'One shot, one fall: picks the target that matters.'), [
          B('hawkeye', 'Hawkeye', 'archer', 'Sees everything and hits all of it, at any range.', undefined, ['eye_of_the_storm', 'Eye of the Storm']),
          B('deadeye', 'Deadeye', 'archer', 'Aims for the gap in the armour: strikes true more often than not.', undefined, ['death_from_afar', 'Death from Afar']),
        ]],
        [B('gunner', 'Gunner', 'engineer', 'Takes to the new weapons as they come: powder, shot and the smell of it.'), [
          B('musketeer', 'Musketeer', 'engineer', 'Volley fire and a bayonet for anything that gets close.', undefined, ['marshal_of_guns', 'Marshal of Guns']),
          B('artillerist', 'Artillerist', 'engineer', 'Thinks in blasts: hits everything near the mark.', undefined, ['master_of_ordnance', 'Master of Ordnance']),
        ]],
      ]],
      [B('ranger', 'Ranger', 'ranger', 'At home in the wild: bow and blade, beast lore and a little nature magic.'), [
        [B('hunter', 'Hunter', 'hunter', 'Traps, nets and big shots: deadly to beasts and monsters.'), [
          B('beast_slayer', 'Beast Slayer', 'hunter', 'Knows where the heart is on anything with fur or scales.', undefined, ['bane_of_beasts', 'Bane of Beasts']),
          B('monster_hunter', 'Monster Hunter', 'hunter', 'The bigger they are, the more there is to aim at.', undefined, ['dread_hunter', 'Dread Hunter']),
        ]],
        [B('beast_tamer', 'Beast Tamer', 'beast_tamer', 'Fights beside a beast companion, and wins wild ones over.', { companion: 'companion_wolf' }), [
          B('beastmaster', 'Beastmaster', 'beast_tamer', 'A pack at their heels; wild things turn on their own.', { companion: 'lion' }, ['lord_of_the_wild', 'Lord of the Wild']),
          B('packleader', 'Packleader', 'beast_tamer', 'Runs with the wolves: the pack strikes as one.', { companion: 'companion_wolf' }, ['alpha_eternal', 'Alpha Eternal']),
        ]],
      ]],
    ],
  },
  {
    id: 'rogue', name: 'Rogue', cls: 'assassin', text: 'Quick hands and quicker feet; fights dirty, and wins.',
    roads: [
      [B('assassin', 'Assassin', 'assassin', 'Quick blades and poison from the shadows.'), [
        [B('shadow', 'Shadow', 'assassin', 'Not seen until the knife is in.'), [
          B('nightblade', 'Nightblade', 'assassin', 'Strikes from darkness and is gone before the body falls.', undefined, ['lord_of_shadows', 'Lord of Shadows']),
          B('phantom', 'Phantom', 'assassin', 'Half there: blows pass through, and theirs always land.', undefined, ['the_unseen', 'The Unseen']),
        ]],
        [B('venomist', 'Venomist', 'assassin', 'Every blade dipped; the struck sicken and slow.'), [
          B('toxicant', 'Toxicant', 'assassin', 'Poisons that spread from one foe to the next.', undefined, ['plague_hand', 'Plague Hand']),
          B('widowmaker', 'Widowmaker', 'assassin', 'A single cut that keeps on killing.', undefined, ['death_whisper', 'Death Whisper']),
        ]],
      ]],
      [B('duelist', 'Duelist', 'samurai', 'One blade, held just so: a fencer who ends things in a cut or two.'), [
        [B('samurai', 'Samurai', 'samurai', 'One perfect cut: draws and strikes true more than any.'), [
          B('kensei', 'Kensei', 'samurai', 'The sword saint: strikes that cannot be turned.', undefined, ['sword_saint', 'Sword Saint']),
          B('iaijutsu_master', 'Iaijutsu Master', 'samurai', 'The draw is the strike: acts first, and the first blow is the last.', undefined, ['blade_of_heaven', 'Blade of Heaven']),
        ]],
        [B('blade_dancer', 'Blade Dancer', 'dancer', 'A dance with two blades: impossible to pin down.'), [
          B('mirage', 'Mirage', 'dancer', 'Never where the blow lands; the foe strikes at air.', undefined, ['the_untouchable', 'The Untouchable']),
          B('whirling_dervish', 'Whirling Dervish', 'dancer', 'Spins through the press, blades out: everyone near is cut.', undefined, ['storm_of_blades', 'Storm of Blades']),
        ]],
      ]],
    ],
  },
  {
    id: 'apprentice', name: 'Apprentice', cls: 'mage', text: 'Has read a book or two, and a spark comes when called. Frail, and curious.',
    roads: [
      [B('elementalist', 'Elementalist', 'mage', 'Fire, frost and lightning from afar.'), [
        [B('archmage', 'Archmage', 'mage', 'Master of all three elements, and of the big spells.'), [
          B('pyromancer', 'Pyromancer', 'mage', 'All fire: infernos that burn on after the spell is done.', undefined, ['lord_of_cinders', 'Lord of Cinders']),
          B('cryomancer', 'Cryomancer', 'mage', 'All ice: the foe slows, freezes and shatters.', undefined, ['winter_incarnate', 'Winter Incarnate']),
        ]],
        [B('chronomancer', 'Chronomancer', 'chronomancer', 'Hastens friends and slows foes; bends the turn order.'), [
          B('time_weaver', 'Time Weaver', 'chronomancer', 'Winds the party ahead: more turns, sooner, for everyone.', undefined, ['chronarch', 'Chronarch']),
          B('fatespinner', 'Fatespinner', 'chronomancer', 'Winds the foe back: stopped, slowed, undone.', undefined, ['epoch_sage', 'Epoch Sage']),
        ]],
      ]],
      [B('occultist', 'Occultist', 'witch', 'Reads the darker books: curses, poisons and sleeps.'), [
        [B('witch', 'Witch', 'witch', 'Weakens the foe more than it burns them.'), [
          B('hexer', 'Hexer', 'witch', 'Curses that stack and stick: the struck fail at everything.', undefined, ['crone_queen', 'Crone Queen']),
          B('coven_mother', 'Coven Mother', 'witch', 'Hexes on the foe, blessings on the party, both at once.', undefined, ['mother_of_night', 'Mother of Night']),
        ]],
        [B('necromancer', 'Necromancer', 'necromancer', 'Raises fallen enemies to fight for the town; drains life.'), [
          B('deathcaller', 'Deathcaller', 'necromancer', 'The dead come when called, and more of them.', undefined, ['death_incarnate', 'Death Incarnate']),
          B('lich_adept', 'Lich Adept', 'necromancer', 'Halfway to undeath: drains to heal, and does not stay down.', undefined, ['lich_lord_ascendant', 'Lich Lord']),
        ]],
      ]],
    ],
  },
  {
    id: 'acolyte', name: 'Acolyte', cls: 'white_mage', text: 'Prays, and sometimes something answers: a little mending, a little light.',
    roads: [
      [B('priest', 'Priest', 'white_mage', 'Heals, shields and raises the fallen; holy light against the dead.'), [
        [B('cleric', 'Cleric', 'white_mage', 'The great mender: keeps a whole party standing.'), [
          B('high_priest', 'High Priest', 'white_mage', 'Mends everyone at once, and brings back the fallen.', undefined, ['saint', 'Saint']),
          B('hierophant', 'Hierophant', 'white_mage', 'Blessings that last: the party fights warded, hasted, inspired.', undefined, ['voice_of_heaven', 'Voice of Heaven']),
        ]],
        [B('inquisitor', 'Inquisitor', 'knight', 'A priest who took up the sword: light in the blade, and no mercy for the dead.'), [
          B('witch_hunter', 'Witch Hunter', 'knight', 'Silences casters and burns the unholy.', undefined, ['grand_inquisitor', 'Grand Inquisitor']),
          B('exorcist', 'Exorcist', 'white_mage', 'Turns the dead and the possessed; cleanses every curse.', undefined, ['light_unending', 'Light Unending']),
        ]],
      ]],
      [B('monk', 'Monk', 'monk', 'Bare-handed or with a staff: quick, hard to hit, and heals themselves.'), [
        [B('master', 'Master', 'monk', 'A flurry of blows and a calm mind.'), [
          B('grandmaster', 'Grandmaster', 'monk', 'Strikes faster than the eye: three blows for every one.', undefined, ['ascendant', 'Ascendant']),
          B('fist_of_light', 'Fist of Light', 'monk', 'Holy light in every blow; mends the party with each strike landed.', undefined, ['enlightened_one', 'Enlightened One']),
        ]],
        [B('shaman', 'Shaman', 'shaman', 'Totems and spirits: heals and hexes in one hand.'), [
          B('witch_doctor', 'Witch Doctor', 'shaman', 'Poisons and plagues on the foe, cures for the party.', undefined, ['totem_lord', 'Totem Lord']),
          B('spirit_chief', 'Spirit Chief', 'shaman', 'The ancestors answer: spirits fight beside the party.', undefined, ['voice_of_ancestors', 'Voice of the Ancestors']),
        ]],
      ]],
    ],
  },
  {
    id: 'wanderer', name: 'Wanderer', cls: 'druid', text: 'Walked a long way and listened to the land. Something in the wild listens back.',
    roads: [
      [B('druid', 'Druid', 'druid', 'Roots, thorns and storms; mends with the green.'), [
        [B('archdruid', 'Archdruid', 'druid', 'The forest fights for them: roots, swarms and sudden growth.'), [
          B('green_sage', 'Green Sage', 'druid', 'Life itself: the party heals as it fights, and the fallen rise.', undefined, ['heart_of_the_wood', 'Heart of the Wood']),
          B('stormcaller', 'Stormcaller', 'druid', 'Calls down the weather: lightning, hail and gales.', undefined, ['voice_of_thunder', 'Voice of Thunder']),
        ]],
        [B('shapeshifter', 'Shapeshifter', 'shapeshifter', 'Fights in the shape of a beast, a greater one with every stage.'), [
          B('primal', 'Primal', 'shapeshifter', 'More beast than person: tougher, faster, hungrier.', undefined, ['wild_god', 'Wild God']),
          B('manyform', 'Manyform', 'shapeshifter', 'Shifts mid-fight: the shape for every moment.', undefined, ['the_thousand_shapes', 'The Thousand Shapes']),
        ]],
      ]],
      // (the Summoner's road: it grows from the first mythic calling now, data/mythic.ts, and the Wanderer has a new
      // road in its place, WANDERER_ROAD; built here so its ids and nodes stay as they were)
      [B('summoner', 'Summoner', 'summoner', 'Calls spirits and beasts to fight at their side. Frail, and fiercer than anyone while something stands between them and the foe.', { stats: GLASS, companion: 'spirit' }), [
        [B('conjurer', 'Conjurer', 'summoner', 'Binds the elements: salamanders, golems and undines answer.', { stats: GLASS, companion: 'fire_elemental' }), [
          B('elementarch', 'Elementarch', 'summoner', 'A court of elementals at once: fire, stone, water and storm.', { stats: GLASS, companion: 'stone_golem' }, ['planeswalker', 'Planeswalker']),
          B('voidbinder', 'Voidbinder', 'summoner', 'Reaches past the elements into the dark: demons and worse, bound to serve.', { stats: GLASS, companion: 'crystal_fiend' }, ['gatekeeper_of_the_void', 'Gatekeeper of the Void']),
        ]],
        [B('beastcaller', 'Beastcaller', 'summoner', 'Calls the beasts of the wild, and in time the beasts of legend.', { stats: GLASS, companion: 'lion' }), [
          B('drake_tamer', 'Drake Tamer', 'summoner', 'Dragon-kind comes to the call: hatchlings first, then the wyvern.', { stats: GLASS, companion: 'drake' }, ['dragon_caller', 'Dragon Caller']),
          B('lord_of_hosts', 'Lord of Hosts', 'summoner', 'Not one beast but a host of them, and the Behemoth at the last.', { stats: GLASS, companion: 'treant' }, ['king_of_the_wild_host', 'King of the Wild Host']),
        ]],
      ]],
    ],
  },
  {
    id: 'minstrel', name: 'Minstrel', cls: 'bard', text: 'A tune, a tale and a quick wit: makes everyone around them a little braver.',
    roads: [
      [B('bard', 'Bard', 'bard', 'Songs that steady the party and shake the foe.'), [
        [B('skald', 'Skald', 'bard', 'Sings of war and the party fights as if it were already a saga.'), [
          B('maestro', 'Maestro', 'bard', 'Every song at once: haste, courage, mending, dread.', undefined, ['voice_of_ages', 'Voice of Ages']),
          B('warsinger', 'Warsinger', 'bard', 'The song is a weapon: notes that cut and chords that stun.', undefined, ['herald_of_war', 'Herald of War']),
        ]],
        [B('dancer', 'Dancer', 'dancer', 'Dances that charm foes and quicken friends.'), [
          B('muse', 'Muse', 'dancer', 'Inspires beyond reason: the party strikes true and never tires.', undefined, ['eternal_muse', 'Eternal Muse']),
          B('fire_dancer', 'Fire Dancer', 'dancer', 'Dances with flame: beautiful, and the foe burns.', undefined, ['phoenix_dancer', 'Phoenix Dancer']),
        ]],
      ]],
      [B('tinker', 'Tinker', 'alchemist', 'Pockets full of flasks and springs; something in them always goes off.'), [
        [B('alchemist', 'Alchemist', 'alchemist', 'Throws flasks of fire and acid, and brews tonics for the party.'), [
          B('bombardier', 'Bombardier', 'alchemist', 'Bigger flasks: the whole foe line burns and chokes.', undefined, ['master_of_fire', 'Master of Fire']),
          B('philosopher', 'Philosopher', 'alchemist', 'The deeper art: tonics that make the party more than they were.', undefined, ['philosopher_king', 'Philosopher King']),
        ]],
        [B('artificer', 'Artificer', 'engineer', 'Guns, turrets and contraptions; mends armour mid-fight.'), [
          B('machinist', 'Machinist', 'engineer', 'A turret for every fight and a bigger gun each age.', undefined, ['master_machinist', 'Master Machinist']),
          B('clockwork_sage', 'Clockwork Sage', 'engineer', 'Devices that heal, shield and hasten: a workshop on legs.', undefined, ['architect_of_wonders', 'Architect of Wonders']),
        ]],
      ]],
    ],
  },
];

for (const base of BASES) {
  add(base.id, base.name, 0, null, base.cls, base.text);
  for (const [r1, roads2] of base.roads) {
    add(r1.id, r1.name, 1, base.id, r1.cls, r1.text, r1.extra);
    for (const [r2, roads3] of roads2) {
      add(r2.id, r2.name, 2, r1.id, r2.cls, r2.text, r2.extra);
      for (const r3 of roads3) {
        add(r3.id, r3.name, 3, r2.id, r3.cls, r3.text, r3.extra);
        if (r3.asc) add(r3.asc[0], r3.asc[1], 4, r3.id, r3.cls, `${r3.text} Ascended: the last and greatest of the line.`, r3.extra);
      }
    }
  }
}

// (the Wanderer's second road, in the Summoner's place now the Summoner has gone up to the mythic callings)
const summonerRoad = nodes.find((n) => n.id === 'summoner')!;

if (WANDERER_ROAD) {
  const [r1, roads2] = WANDERER_ROAD;
  const mk = (n: CallingNode, stage: number, from: string) => add(n.id, n.name, stage, from, n.cls, n.text, { lore: n.lore, ...(n.companion ? { companion: n.companion } : {}), ...(n.stats ? { stats: n.stats } : {}) });
  mk(r1, 1, 'wanderer');
  for (const [r2, roads3] of roads2) {
    mk(r2, 2, r1.id);
    for (const r3 of roads3) {
      mk(r3, 3, r2.id);
      add(r3.asc[0], r3.asc[1], 4, r3.id, r3.cls, `${r3.text} Ascended: the last and greatest of the line.`, { ...(r3.stats ? { stats: r3.stats } : {}), ...(r3.companion ? { companion: r3.companion } : {}) });
    }
  }
}

/** The shared tree, open to everyone (all but the Summoner's road, which grows from the first mythic calling now:
 *  filled in below, once the mythic callings are grown). */
const shared: PathNode[] = [];
export const PATHS: readonly PathNode[] = shared;

/* ------------------------------------------------------------ the mythic callings */

const mythicNodeList: PathNode[] = [];
for (const t of MYTHIC_CALLINGS) {
  const mk = (n: CallingNode, stage: number, from: string | null): PathNode => {
    const node: PathNode = { id: mythicId(n.id), name: n.name, stage, from, cls: n.cls, text: n.text, lore: n.lore, mythic: true };
    if (n.stats) node.stats = n.stats;
    if (n.companion) node.companion = n.companion;
    if (n.form) node.form = n.form;
    if (n.arms) node.arms = n.arms;
    mythicNodeList.push(node);
    return node;
  };
  const base = mk(t.base, 0, null);
  for (const road of t.roads) {
    // (the shared Summoner road, and everything after it, grows from here now)
    if (road === 'summoner') {
      summonerRoad.from = base.id;
      continue;
    }
    const [r1, roads2] = road;
    const one = mk(r1, 1, base.id);
    for (const [r2, roads3] of roads2) {
      const two = mk(r2, 2, one.id);
      for (const r3 of roads3) {
        const three = mk(r3, 3, two.id);
        mythicNodeList.push({ id: mythicId(r3.asc[0]), name: r3.asc[1], stage: 4, from: three.id, cls: r3.cls, text: `${r3.text} Ascended: a legend, and the last of a line few ever walk.`, mythic: true, ...(r3.stats ? { stats: r3.stats } : {}), ...(r3.companion ? { companion: r3.companion } : {}) });
      }
    }
  }
}
/** The mythic callings, whole trees (ids `my_<id>`, and the grafted Summoner road with its own). */
export const MYTHIC_PATHS: readonly PathNode[] = mythicNodeList;
/** The mythic callings' starting nodes. */
export const MYTHIC_BASES: readonly PathNode[] = mythicNodeList.filter((n) => n.stage === 0);

/* ------------------------------------------------------------ the peoples' own roads */

const originNodes: PathNode[] = [];
for (const r of ORIGIN_ROADS) {
  const mk = (n: (typeof r)['two'], stage: number, from: string): PathNode => ({ id: n.id, name: n.name, stage, from, cls: n.cls, text: n.text, lore: n.lore, origin: r.origin, ...(n.stats ? { stats: n.stats } : {}), ...(n.companion ? { companion: n.companion } : {}) });
  const base = nodes.find((n) => n.id === r.from)!.from!;
  originNodes.push(mk(r.two, 1, base), mk(r.three, 2, r.two.id), mk(r.high, 3, r.three.id));
  originNodes.push({ id: r.asc[0], name: r.asc[1], stage: 4, from: r.high.id, cls: r.high.cls, text: `${r.high.text} Ascended: the last and greatest of their people's road.`, origin: r.origin, ...(r.high.companion ? { companion: r.high.companion } : {}) });
}
/** Every people's road of its own: a third choice at the first evolution (beside the shared calling `from`), then
 *  straight on. */
export const ORIGIN_PATHS: readonly PathNode[] = originNodes;

/* ------------------------------------------------------------ the peoples' own base callings */

const callingNodes: PathNode[] = [];
for (const t of ORIGIN_CALLINGS) {
  const id = (k: string) => callingId(t.origin, k);
  const mk = (n: CallingNode, stage: number, from: string | null): PathNode => {
    const node: PathNode = { id: id(n.id), name: n.name, stage, from, cls: n.cls, text: n.text, lore: n.lore, origin: t.origin, calling: true };
    if (n.stats) node.stats = n.stats;
    if (n.companion) node.companion = n.companion;
    if (n.form) node.form = n.form;
    if (n.arms) node.arms = n.arms;
    callingNodes.push(node);
    return node;
  };
  const base = mk(t.base, 0, null);
  for (const [r1, roads2] of t.roads) {
    const one = mk(r1, 1, base.id);
    for (const [r2, roads3] of roads2) {
      const two = mk(r2, 2, one.id);
      for (const r3 of roads3) {
        const three = mk(r3, 3, two.id);
        callingNodes.push({ id: id(r3.asc[0]), name: r3.asc[1], stage: 4, from: three.id, cls: r3.cls, text: `${r3.text} Ascended: the last and greatest of their people's calling.`, origin: t.origin, calling: true, ...(r3.stats ? { stats: r3.stats } : {}), ...(r3.companion ? { companion: r3.companion } : {}) });
      }
    }
  }
}
/** Every people's own base callings, whole trees (ids `oc_<people>_<id>`). */
export const CALLING_PATHS: readonly PathNode[] = callingNodes;
/** A people's own base callings (the starting nodes). */
export const callingBases = (origin: string | null | undefined): PathNode[] => callingNodes.filter((n) => n.stage === 0 && n.origin === origin);

/* ------------------------------------------------------------ the founders' lines, with their choices */

const founderNodes: PathNode[] = [];
for (const f of FOUNDER_CLASSES) {
  const roads = FOUNDER_ROADS[f.id];
  const first = f.description.match(/^[^:;,.]*/)?.[0] ?? f.description;
  const root: PathNode = { id: `f_${f.id}`, name: f.stages[0], stage: 0, from: null, cls: f.base, text: f.description, founder: f.id, own: true, stats: f.stats, lore: `${f.description} Every story of the town begins with them, and theirs is not finished.` };
  founderNodes.push(root);
  // (a binary tree to the third stage: the line's own name or the road of their own at each; the last stage is the line's)
  let at: PathNode[] = [root];
  for (let stage = 1; stage <= 3; stage++) {
    const next: PathNode[] = [];
    for (const parent of at) {
      const own: PathNode = { id: `${parent.id}_o`, name: f.stages[stage], stage, from: parent.id, cls: f.base, text: f.description, founder: f.id, own: true, stats: f.stats,
        lore: `The line the stories already tell: ${f.stages[stage]}. ${first}, and more of it, the signature of the founder grown greater. It is the road everyone expected, which is not the same as an easy one.` };
      const [name, text] = roads.alt[stage - 1];
      const alt: PathNode = { id: `${parent.id}_a`, name, stage, from: parent.id, cls: f.base, text, founder: f.id, own: false, stats: { ...f.stats, ...roads.bent },
        lore: `${text} A road of the founder's own making, away from the one the stories expected: the town will have to learn new songs about them, and the old ones will not fit.` };
      next.push(own, alt);
    }
    founderNodes.push(...next);
    at = next;
  }
  for (const parent of at) founderNodes.push({ id: `${parent.id}_x`, name: f.stages[4], stage: 4, from: parent.id, cls: f.base, text: `${f.description} Ascended: the last and greatest of their line.`, founder: f.id, own: parent.own, stats: parent.stats });
}
/** The founders' own lines (a tree each: the line's stage or their own road at each of the first three evolutions). */
export const FOUNDER_PATHS: readonly PathNode[] = founderNodes;
/** A founder's starting node. */
export const founderRoot = (fid: string) => `f_${fid}`;

export const PATH_BY_ID: Readonly<Record<string, PathNode>> = Object.fromEntries([...nodes, ...originNodes, ...callingNodes, ...mythicNodeList, ...founderNodes].map((n) => [n.id, n]));
// (the grafted Summoner road is mythic too, wherever it grows from: it leaves the shared tree for the mythic one)
for (const n of nodes) if (n.from && lineage(n.id)[0]?.mythic) n.mythic = true;
shared.push(...nodes.filter((n) => !n.mythic));
mythicNodeList.push(...nodes.filter((n) => n.mythic));
export const BASE_PATHS: readonly PathNode[] = nodes.filter((n) => n.stage === 0);
const kids = new Map<string, PathNode[]>();
for (const n of Object.values(PATH_BY_ID)) if (n.from) kids.set(n.from, [...(kids.get(n.from) ?? []), n]);
/** The shared roads out of a node (two, or the one ascended form from a stage-3 node; none past that), and a
 *  founder's line's. A people's own roads are left out: `roadsFrom` adds them. */
export const branchesOf = (id: string): PathNode[] => (kids.get(id) ?? []).filter((n) => !n.origin || PATH_BY_ID[id]?.origin);
/** The roads out of a node for someone of a people: the shared ones and their people's own (and, once on a people's
 *  own calling, its roads whoever they are now). */
export const roadsFrom = (id: string, origin?: string | null): PathNode[] => (kids.get(id) ?? []).filter((n) => !n.origin || n.origin === origin || (n.calling && PATH_BY_ID[id]?.calling));
/** A node and every node before it, the base first. */
export function lineage(id: string): PathNode[] {
  const out: PathNode[] = [];
  for (let n: PathNode | undefined = PATH_BY_ID[id]; n; n = n.from ? PATH_BY_ID[n.from] : undefined) out.unshift(n);
  return out;
}
/** How a road's calling is drawn fighting, and the weapon kind it may wield over its archetype's: the nearest set up
 *  its road (only the peoples' own callings set them). */
export function formOf(id: string | null | undefined): CallingForm | null {
  for (let n = id ? PATH_BY_ID[id] : undefined; n; n = n.from ? PATH_BY_ID[n.from] : undefined) if (n.form) return n.form;
  return null;
}
export function armsOf(id: string | null | undefined): FamilyId | null {
  for (let n = id ? PATH_BY_ID[id] : undefined; n; n = n.from ? PATH_BY_ID[n.from] : undefined) if (n.arms) return n.arms;
  return null;
}
/** The node at a stage of someone's road (the base at 0, where they stand now at their stage). */
export const pathStage = (id: string, stage: number): PathNode | undefined => lineage(id)[stage];
/** Whether a road is one of the mythic callings (data/mythic.ts; the Summoner's road among them). */
export const isMythic = (id: string | null | undefined) => !!id && !!PATH_BY_ID[id]?.mythic;
