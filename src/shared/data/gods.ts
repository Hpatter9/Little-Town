// Gods and faith (the owner's pick): every people keeps four gods, one for each part of life. The town builds them
// shrines and temples, makes offerings and holds rites by itself (sim/faith.ts); a god pleased sends a blessing, a god
// neglected sends its wrath.

import type { BuildingDef } from './buildings';
import type { Lever } from './eventKit';
import type { OriginId } from './origins';

export type Domain = 'harvest' | 'hearth' | 'war' | 'sky';
export const DOMAINS: readonly Domain[] = ['harvest', 'hearth', 'war', 'sky'];

export interface DomainDef {
  /** What the god keeps, in a word or two. */
  keeps: string;
  /** Pleased: a lever lifted for a day (an event's mark), and the words for it. */
  bless: { lever: Lever | 'morale'; value: number; text: string };
  /** Angered: what the wrath does (sim/faith.ts `smite`), and the words for it. */
  wrath: 'blight' | 'plague' | 'defeat' | 'lightning';
  wrathText: string;
  /** What's laid on the altar for it, by preference. */
  offer: readonly string[];
}

export const DOMAIN_DEFS: Record<Domain, DomainDef> = {
  harvest: { keeps: 'fields and herds', bless: { lever: 'crops', value: 1.4, text: 'blessed the fields' }, wrath: 'blight', wrathText: 'withers the fields', offer: ['grain', 'vegetables', 'fruit', 'berries'] },
  hearth: { keeps: 'homes and healing', bless: { lever: 'morale', value: 8, text: 'warms every hearth' }, wrath: 'plague', wrathText: 'sends a sickness', offer: ['bread', 'meat', 'milk', 'eggs'] },
  war: { keeps: 'battle and walls', bless: { lever: 'fight', value: 1.25, text: 'steels every arm' }, wrath: 'defeat', wrathText: 'turns from the town in battle', offer: ['iron', 'hide', 'meat'] },
  sky: { keeps: 'weather and fortune', bless: { lever: 'travellers', value: 1.5, text: 'sends fair winds and travellers' }, wrath: 'lightning', wrathText: 'hurls lightning', offer: ['cloth', 'coins', 'wood'] },
};

/** Each people's four gods: name and title, in the order of `DOMAINS`. */
export const PANTHEONS: Record<OriginId, [string, string][]> = {
  settlers: [['Ceres', 'Mother of the Furrow'], ['Hestia', 'Keeper of the Hearth'], ['Tyr', 'the One-Handed'], ['Aeolus', 'Lord of the Winds']],
  lich: [['Morrow', 'the Grey Sower'], ['Ossia', 'Lady of Bones'], ['Karnak', 'the Unbroken Host'], ['Vael', 'the Starless Sky']],
  druid: [['Cernun', 'the Antlered'], ['Brigid', 'of the Well and Flame'], ['Andrast', 'the Thorn Queen'], ['Taranis', 'the Thunderer']],
  vampire: [['Lilith', 'the Red Harvest'], ['Nyx', 'Mother of Night'], ['Draculea', 'the Impaler'], ['Selene', 'the Pale Moon']],
  werewolf: [['Fenra', 'the Provider'], ['Lupa', 'the Den Mother'], ['Fenrir', 'the Devourer'], ['Mani', 'the Moon Hunter']],
  robot: [['PRIME-0', 'the Allocator'], ['CORE', 'the Maintainer'], ['VECTOR', 'the Protocol of War'], ['STATIC', 'the Signal']],
  dwarves: [['Durna', 'of the Deep Roots'], ['Hearthgrim', 'the Forge-Mother'], ['Grundar', 'the Shield'], ['Thrumm', 'the Mountain Thunder']],
  merfolk: [['Kelpra', 'of the Swaying Fields'], ['Nerissa', 'the Tide Home'], ['Dagon', 'the Deep Spear'], ['Tethys', 'Mother of Storms']],
  nomads: [['Umay', 'of the Grass Sea'], ['Ötüken', 'the Tent-Keeper'], ['Erlik', 'the Rider of Bones'], ['Tengri', 'the Eternal Sky']],
  fae: [['Mab', 'the Bloom Queen'], ['Puck', 'the Hearth Trickster'], ['Oberon', 'the Thorn King'], ['Titania', 'of the Twilight']],
  alchemists: [['Viriditas', 'the Green Principle'], ['Sal', 'the Salt of Life'], ['Mars Ferrum', 'the Iron Star'], ['Mercurius', 'the Quick Spirit']],
  knights: [['Saint Isidore', 'of the Plough'], ['Saint Agnes', 'of the Hearth'], ['Saint George', 'the Dragon-Slayer'], ['Saint Elmo', 'of the Storms']],
  orcs: [['Grub-Mother', 'of the Swill'], ['Old Tusk', 'of the Fire'], ['Gork', 'of the Red Axe'], ['Mork', 'of the Black Sky']],
};

/** Favour runs from -100 (wrathful) to 100 (well pleased). */
export const FAVOUR_MOST = 100;
/** Each day every god's favour drifts this much toward nothing, and further down without a place to worship. */
export const FAVOUR_DRIFT = 2;
export const NEGLECT = 6;
/** What each place of worship standing adds to every god's favour a day. */
export const WORSHIP: Record<string, number> = { wayside_shrine: 3, temple: 6, cathedral: 10 };
/** A daily offering to the least pleased god: so much favour, the goods it costs (a unit each per this many people). */
export const OFFERING_FAVOUR = 14;
export const OFFER_PER = 5;
/** Each pious townsperson adds this to every god a day. */
export const PIOUS = 1.5;
/** A god above this may bless the town each dawn (with this chance), below that may strike (with that chance). */
export const BLESS_AT = 55;
export const BLESS_CHANCE = 0.3;
export const WRATH_AT = -40;
export const WRATH_CHANCE = 0.35;
/** A blessing lasts this long; a god that has blessed or struck spends this much favour. */
export const SIGN_HOURS = 24;
export const SIGN_SPENDS = 30;
/** Lightning that strikes someone out of doors kills them this often. */
export const LIGHTNING_KILLS = 0.35;
/** The hour of the daily offering (and the signs), and the day of the week the town holds a rite. */
export const FAITH_HOUR = 7;
export const RITE_EVERY_DAYS = 7;
export const RITE_FAVOUR = 12;

export const FAITH_BUILDINGS: BuildingDef[] = [
  { id: 'wayside_shrine', name: 'Wayside Shrine', layer: 'mid', width: 2, cost: { stone: 8, wood: 4 }, buildSeconds: 80, purpose: 'A place to pray: every god looks a little more kindly on the town.', morale: [2, 'A shrine to pray at'] },
  { id: 'temple', name: 'Temple', layer: 'mid', width: 4, cost: { stone: 30, lumber: 12, cloth: 4 }, buildSeconds: 260, purpose: 'Priests keep the rites: the gods are pleased twice as much as with a shrine.', research: 'masonry', morale: [4, 'The temple bells'] },
  { id: 'cathedral', name: 'Cathedral', layer: 'mid', width: 6, cost: { stone: 60, bricks: 30, glass: 10, cloth: 10 }, buildSeconds: 600, purpose: 'A wonder of faith: the gods are well pleased, and the town lifted.', research: 'guilds', morale: [8, 'The cathedral rises over us'] },
];
export const FAITH_UPGRADES: Record<string, string> = { wayside_shrine: 'temple', temple: 'cathedral' };
