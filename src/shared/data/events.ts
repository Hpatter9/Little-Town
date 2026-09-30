// The choice events (EVENTS.md), drawn at random now and then (sim/events.ts). Each asks the player a question with
// two or three answers; the one marked default is what the town does if nobody answers. What an answer does is a
// list of effects (EventEffect). {who} in a text is a townsperson picked for the event (an event with `who`), and
// {founder} the town's founder. Numbers are starting points for tuning.

import type { GameState } from '../sim/state';
import { ERAS, type Era } from './eras';
import type { Stock } from './materials';
import type { OriginId } from './origins';

/** What an event's mark can push: the same levers origins and research use (sim/origin.ts). */
export type Lever = 'work' | 'build' | 'crops' | 'forage' | 'research' | 'craft' | 'travellers' | 'prices' | 'fight' | 'guard';

export type EventEffect =
  | { note: string }
  /** Everyone's morale, this much, for so many game hours. */
  | { mood: number; hours: number; text: string }
  /** A lever multiplied, for so many game hours. */
  | { mod: Lever; mult: number; hours: number; text: string }
  | { gain: Stock }
  /** A share of the town's food, of everything in store, or of its coins, lost. */
  | { take: 'food' | 'stores' | 'coins'; share: number }
  | { coins: number }
  | { renown: number }
  | { reputation: number }
  /** Newcomers (a type from data/people.ts, or a wanderer of any sort). */
  | { join: number; type?: string }
  /** The event's person, or someone at random, leaves; dies (with a chance); is hurt (or everyone is). The founder is
   *  never picked at random to leave or die. */
  | { leave: 'who' | 'random' }
  | { kill: 'who' | 'random'; chance?: number; cause: string }
  | { wound: 'who' | 'random' | 'all'; hp: number }
  /** So many fall sick (the plague's sickness). */
  | { sick: number }
  /** The next raid comes within so many game hours; or none comes for so many. */
  | { raid: number }
  | { calm: number }
  /** Seconds of work on the topic being researched. */
  | { research: number }
  /** The Occult is revealed. */
  | { occult: string }
  | { chance: number; then: EventEffect[]; else?: EventEffect[] }
  /** Effects that come after so many game hours (only at the top of an answer). */
  | { later: number; effects: EventEffect[] };

export interface EventOption {
  label: string;
  default?: boolean;
  effects: EventEffect[];
}

export interface EventDef {
  id: string;
  title: string;
  text: string;
  /** A townsperson is picked for it ({who}). */
  who?: boolean;
  weight?: number;
  /** When it can happen (always, if left out). */
  when?: (s: GameState) => boolean;
  options: EventOption[];
}

/* ------------------------------------------------------------ shorthands */

const note = (note: string): EventEffect => ({ note });
const mood = (mood: number, hours: number, text: string): EventEffect => ({ mood, hours, text });
const mod = (lever: Lever, mult: number, hours: number, text: string): EventEffect => ({ mod: lever, mult, hours, text });
const gain = (stock: Stock): EventEffect => ({ gain: stock });
const chance = (p: number, then: EventEffect[], otherwise: EventEffect[] = []): EventEffect => ({ chance: p, then, else: otherwise });
const later = (hours: number, ...effects: EventEffect[]): EventEffect => ({ later: hours, effects });
const opt = (label: string, ...effects: EventEffect[]): EventOption => ({ label, effects });
const dflt = (label: string, ...effects: EventEffect[]): EventOption => ({ label, default: true, effects });

const has = (s: GameState, ...ids: string[]) => s.buildings.some((b) => ids.includes(b.def) && b.status === 'done');
const eraAt = (s: GameState, e: Era) => ERAS.indexOf(s.era) >= ERAS.indexOf(e);
const eraIs = (s: GameState, e: Era) => s.era === e;
const origin = (s: GameState, ...ids: OriginId[]) => ids.includes(s.origin ?? 'settlers');
const people = (s: GameState, n: number) => s.people.length >= n;
const coins = (s: GameState, n: number) => (s.coins ?? 0) >= n;
const shop = (s: GameState) => s.buildings.some((b) => !!b.shop);
const pens = (s: GameState) => has(s, 'chicken_coop', 'goat_pen', 'pig_sty', 'sheep_fold', 'cattle_pasture');
const fields = (s: GameState) => has(s, 'garden_plot', 'hydroponics_bay');

export const EVENTS: readonly EventDef[] = [
  /* ---------------------------------------------------------- strangers and newcomers */
  {
    id: 'stranger', title: 'A stranger at the gate', text: 'A lone wanderer asks to join the town. They say little about where they came from.',
    options: [opt('Take them in', { join: 1 }, chance(0.3, [note('The stranger turns out to know a trade: they settle in well.'), mood(3, 24, 'A new face fitting in')])), dflt('Turn them away', note('The stranger walks on.'))],
  },
  {
    id: 'refugees', title: 'Refugees', text: 'A family of four, fleeing a war, begs to be taken in.', when: (s) => people(s, 5),
    options: [
      opt('Take them all in', { join: 4 }, mod('work', 0.95, 24, 'More mouths than hands, for now'), { reputation: 2 }),
      opt('Take the children only', { join: 2 }, mood(-3, 24, 'A family split at the gate')),
      dflt('Send them on', mood(-4, 24, 'Turned refugees away')),
    ],
  },
  {
    id: 'sick_traveller', title: 'A sick traveller', text: 'A feverish traveller begs for shelter at the gate.',
    options: [
      opt('Shelter them', chance(0.4, [{ sick: 2 }, note('The fever spreads to the town.')], [gain({ herbs: 6 }), note('The traveller recovers and leaves herbs in thanks.'), { reputation: 1 }])),
      dflt('Turn them away', mood(-2, 12, 'Turned away a sick traveller')),
    ],
  },
  {
    id: 'deserter', title: 'A deserter', text: "A soldier who fled a rival lord's army asks to hide in the town.",
    options: [
      opt('Hide them', { join: 1, type: 'hunter' }, chance(0.4, [{ raid: 12 }, note('Their lord has come looking for them!')])),
      dflt('Hand them back', { calm: 24 }, note('The rival lord is pleased: no raids from them for a while.')),
    ],
  },
  {
    id: 'foundling', title: 'A child in the woods', text: 'A child was found alone in the woods, too young to say where from.',
    options: [opt('Raise them', { join: 1 }, mood(4, 36, 'Took in a foundling')), dflt('Leave them at the shrine', mood(-3, 36, 'Left a child at the shrine'))],
  },
  {
    id: 'master_craftsman', title: 'A master craftsman', text: 'A famous craftsman passing through asks for a week of room and board.', when: (s) => has(s, 'workbench'),
    options: [opt('Host them', { take: 'food', share: 0.1 }, mod('craft', 1.25, 72, 'Learning from a master'), { reputation: 1 }), dflt('Decline', note('The craftsman moves on.'))],
  },
  {
    id: 'bard', title: 'A bard', text: 'A bard offers to stay the winter, for a place by the fire.',
    options: [opt('Let them stay', mood(6, 72, 'A bard by the fire'), { take: 'food', share: 0.05 }), dflt('Pay them to move on', { coins: -5 }, note('The bard takes a few coins and leaves.'))],
  },
  {
    id: 'hermit_tome', title: 'A hermit with a tome', text: 'A hermit comes down from the hills, clutching a strange old book.',
    options: [opt('Take the tome', { occult: 'A hermit left the town a book of forbidden things.' }, mood(-2, 24, 'Uneasy about the hermit\'s book')), dflt('Send them away', note('The hermit shuffles back into the hills.'))],
  },
  {
    id: 'knight_oath', title: 'A disgraced knight', text: 'A knight in tarnished armour asks to swear to {founder}.', when: (s) => eraAt(s, 'medieval'),
    options: [opt('Accept the oath', { join: 1, type: 'hunter' }, mod('fight', 1.1, 96, 'A sworn knight in the ranks'), mood(-2, 48, 'A quarrelsome knight about')), dflt('Refuse', note('The knight rides on.'))],
  },
  {
    id: 'twins', title: 'Twins born', text: 'Twins were born in the night. The parents ask the town to name one after a hero.', when: (s) => people(s, 6),
    options: [opt('Name one after a hero', mood(6, 48, 'Twins named for a hero')), dflt('Let the parents choose', mood(3, 48, 'Twins born'))],
  },
  {
    id: 'mail_bride', title: 'An unexpected match', text: 'A suitor arrives, claiming {who} sent for them. {who} did not.', who: true,
    options: [opt('Let them stay', { join: 1 }, mood(2, 24, 'A curious match')), dflt('Send them home', note('The suitor leaves, red-faced.'))],
  },
  {
    id: 'runaway_apprentice', title: 'A runaway apprentice', text: 'An apprentice from another town begs to hide. Their master is close behind.',
    options: [opt('Hide them', { join: 1, type: 'crafter' }, { reputation: -1 }), dflt('Hand them back', { coins: 10 }, note('The master pays a small reward.'))],
  },

  /* ---------------------------------------------------------- raiders, rivals and war */
  {
    id: 'tribute', title: 'A raider chief offers terms', text: 'A raider chief rides up: pay tribute now, or they attack.', when: (s) => !s.raid && people(s, 4),
    options: [opt('Pay tribute', { take: 'stores', share: 0.3 }, { take: 'coins', share: 0.5 }, { calm: 48 }), dflt('Fight', { raid: 2 }, mod('fight', 1.1, 6, 'Defiant'))],
  },
  {
    id: 'scouts', title: 'Scouts on the ridge', text: 'Raider scouts are watching the town from the ridge.', when: (s) => !s.raid,
    options: [
      opt('Ambush them', chance(0.6, [note('The scouts are driven off.'), { calm: 36 }], [{ wound: 'random', hp: 20 }, note('The ambush goes badly.')])),
      dflt('Let them pass', { raid: 12 }),
    ],
  },
  {
    id: 'envoy', title: 'An envoy', text: "A rival lord's envoy offers a truce, for a tribute.", when: (s) => eraAt(s, 'medieval'),
    options: [opt('Accept the truce', { take: 'coins', share: 0.3 }, { calm: 72 }), dflt('Refuse', note('The envoy leaves, scowling.'))],
  },
  {
    id: 'captive_raider', title: 'A captured raider', text: 'A captured raider offers to lead the town to their camp.',
    options: [opt('Follow them', later(8, chance(0.6, [gain({ iron: 6, hide: 8, meat: 10 }), note('The raiders\' camp is looted.')], [{ wound: 'random', hp: 30 }, note('It was a trap!')]))), dflt('Keep them prisoner', note('The prisoner is locked up.'))],
  },
  {
    id: 'mercenaries', title: 'Mercenaries', text: 'A band of mercenaries offers its swords for a season.', when: (s) => coins(s, 20),
    options: [opt('Hire them', { coins: -20 }, mod('fight', 1.3, 72, 'Mercenaries on the walls'), mod('guard', 0.8, 72, 'Mercenaries on the walls')), dflt('Decline', note('The mercenaries ride on.'))],
  },
  {
    id: 'hunters_guild', title: "The Hunters' Guild", text: 'Monster hunters want to search the town.', when: (s) => origin(s, 'vampire', 'werewolf') || !!s.lich,
    options: [opt('Let them search', chance(0.5, [{ kill: 'random', cause: 'at the hands of the Hunters\' Guild' }], [note('The hunters find nothing and leave.')])), dflt('Bar the gates', { raid: 6 })],
  },
  {
    id: 'mercy', title: 'A plea for mercy', text: 'A beaten raider begs for their life.',
    options: [opt('Spare them', chance(0.5, [{ join: 1 }, note('The raider swears to the town.')], [note('The raider slips away in the night.')])), dflt('Execute them', { reputation: 1 }, mood(-2, 12, 'An execution'))],
  },
  {
    id: 'war_drums', title: 'War drums', text: 'War drums in the distance: an army is passing through.', when: (s) => eraAt(s, 'medieval'),
    options: [opt('Hide behind the walls', mod('work', 0.3, 12, 'Hiding from the army'), { calm: 24 }), dflt('Trade with them', { coins: 25 }, chance(0.25, [{ raid: 4 }]))],
  },
  {
    id: 'spy', title: 'A spy', text: 'A spy was caught in the stores.',
    options: [opt('Question them', { calm: 24 }, note('The spy gives up their camp\'s plans.')), dflt('Hang them', mood(-2, 12, 'A hanging')), opt('Let them go', { reputation: 2 }, chance(0.5, [gain({ iron: 4, cloth: 3 })]))],
  },
  {
    id: 'sleeping_watch', title: 'The watch slept', text: '{who} fell asleep on watch, and raiders nearly got in.', who: true,
    options: [opt('Punish them', mod('guard', 0.9, 48, 'A sharper watch'), mood(-3, 24, 'A punishment')), dflt('Forgive them', mood(2, 24, 'Forgiven'))],
  },
  {
    id: 'rival_relic', title: "A rival's relic", text: "A traveller carries a relic taken from a rival lord.", when: (s) => shop(s) && coins(s, 30),
    options: [opt('Buy it', { coins: -30 }, { renown: 10 }, chance(0.5, [{ raid: 24 }])), dflt('Leave it', note('The traveller moves on.'))],
  },
  {
    id: 'horse_trade', title: 'The riders offer horses', text: 'Horde riders offer to trade horses for stores.', when: (s) => has(s, 'stable'),
    options: [opt('Trade', { take: 'stores', share: 0.15 }, mod('travellers', 1.2, 72, 'Horses in the stable')), dflt('Refuse', note('The riders gallop off.'))],
  },

  /* ---------------------------------------------------------- plague, hunger and weather */
  {
    id: 'fever_home', title: 'Fever in a home', text: 'A fever has taken hold in one home.', when: (s) => people(s, 5),
    options: [opt('Quarantine it', { sick: 1 }, chance(0.3, [{ kill: 'random', cause: 'of the fever, shut away' }])), dflt('Nurse them together', { sick: 3 })],
  },
  {
    id: 'foul_well', title: 'The well is foul', text: 'Something has fouled the well.', when: (s) => has(s, 'well'),
    options: [opt('Dig a new one', mod('work', 0.85, 24, 'Digging a new well'), { take: 'stores', share: 0.05 }), dflt('Boil the water', mod('work', 0.9, 72, 'Boiling every drop'))],
  },
  {
    id: 'early_frost', title: 'An early frost', text: 'A frost threatens the harvest.', when: fields,
    options: [opt('Harvest now', gain({ grain: 15 }), mod('crops', 0.8, 48, 'Harvested green')), dflt('Wait and hope', chance(0.5, [gain({ grain: 35 }), note('The frost passes: a fine harvest.')], [mod('crops', 0.5, 72, 'Frost-bitten fields'), note('The frost takes the crop.')]))],
  },
  {
    id: 'locusts', title: 'Locusts', text: 'A cloud of locusts is on the horizon.', when: fields,
    options: [opt('Burn the edge fields', mod('crops', 0.8, 48, 'Burnt field edges')), dflt('Pray', chance(0.5, [note('The swarm passes by.')], [mod('crops', 0.4, 72, 'Locusts in the fields'), { take: 'food', share: 0.15 }]))],
  },
  {
    id: 'flood', title: 'The river rises', text: 'A flood is coming: there is time to save the fields or the stores.',
    options: [opt('Save the fields', { take: 'stores', share: 0.2 }), dflt('Save the stores', mod('crops', 0.5, 72, 'Flooded fields'))],
  },
  {
    id: 'wildfire', title: 'Wildfire', text: 'A fire is burning through the forest.',
    options: [opt('Cut a firebreak', mod('forage', 0.8, 72, 'Forest cut for a firebreak'), mod('work', 0.9, 12, 'Cutting a firebreak')), dflt('Let it burn out', chance(0.4, [{ take: 'stores', share: 0.15 }, note('The fire reached the town\'s stores!')]))],
  },
  {
    id: 'hard_winter', title: 'A hard winter coming', text: 'The elders say a hard winter is coming.',
    options: [opt('Ration food now', mood(-5, 72, 'Rationing'), gain({ grain: 10 })), dflt('Eat as usual', chance(0.5, [{ take: 'food', share: 0.2 }]))],
  },
  {
    id: 'drought', title: 'Drought', text: 'The rains have failed.', when: fields,
    options: [opt('Carry water from the river', mod('work', 0.85, 48, 'Hauling water')), dflt('Let the fields rest', mod('crops', 0.3, 72, 'Dry fields'))],
  },
  {
    id: 'bumper_crop', title: 'A bumper crop', text: 'The fields are heavy with grain.', when: fields,
    options: [opt('Feast', mood(8, 48, 'A harvest feast')), dflt('Store it all', gain({ grain: 30 })), opt('Sell it to travellers', { coins: 25 })],
  },
  {
    id: 'rats', title: 'Rats in the granary', text: 'Rats are getting into the food stores.',
    options: [opt('Get cats', { coins: -5 }, note('The cats make short work of them.')), dflt('Poison', chance(0.2, [{ sick: 1 }]), { take: 'food', share: 0.05 }), opt('Burn the granary', { take: 'food', share: 0.3 })],
  },
  {
    id: 'plague_ship', title: 'A plague ship', text: 'A ship with sickness aboard asks to land.', when: (s) => s.biome === 'coast',
    options: [opt('Let them land', { coins: 20 }, chance(0.5, [{ sick: 3 }])), dflt('Wave them off', note('The ship sails on.'))],
  },
  {
    id: 'bad_berries', title: 'Poisoned berries', text: 'Three people fell sick from berries at the edge of the woods.',
    options: [opt('Burn the bushes', mod('forage', 0.9, 48, 'Berry bushes burnt')), dflt('Mark them and move on', { wound: 'random', hp: 15 })],
  },

  /* ---------------------------------------------------------- faith, omens and the strange */
  {
    id: 'comet', title: 'A comet', text: 'A comet burns across the night sky.',
    options: [opt('Hold a ritual', { take: 'food', share: 0.05 }, mood(6, 48, 'The comet\'s ritual')), dflt('Ignore it', note('The comet fades.')), opt('Call it a bad sign', mod('guard', 0.85, 72, 'Braced for trouble'), mood(-4, 48, 'A bad omen'))],
  },
  {
    id: 'eclipse', title: 'An eclipse', text: 'The sun goes dark at midday.',
    options: [opt('Hide indoors', mod('work', 0.5, 4, 'Hiding from the eclipse')), dflt('Watch it', { research: 60 }, mood(-1, 12, 'Unsettled by the eclipse'))],
  },
  {
    id: 'shrine', title: 'A holy wanderer', text: 'A holy wanderer asks to build a shrine.',
    options: [opt('Let them', { take: 'stores', share: 0.05 }, mood(5, 120, 'A shrine in town')), dflt('Refuse', note('The wanderer blesses the town anyway and leaves.'))],
  },
  {
    id: 'dead_walk', title: 'The dead walk', text: 'Something stirred in the graveyard last night.', when: (s) => has(s, 'graveyard') || (s.graves?.length ?? 0) > 0,
    options: [opt('Burn the graves', mood(-5, 48, 'Burnt the graves')), dflt('Post a guard', mod('work', 0.95, 24, 'Watching the graves'), chance(0.3, [{ raid: 3 }]))],
  },
  {
    id: 'talking_animal', title: 'A talking animal', text: 'A fox at the edge of the woods spoke to {who}.', who: true, when: (s) => origin(s, 'druid', 'fae'),
    options: [opt('Follow it', later(6, chance(0.7, [gain({ herbs: 10, berries: 15 }), note('The fox led {who} to a hidden grove.')], [{ leave: 'who' }]))), dflt('Shoo it away', note('The fox vanishes.'))],
  },
  {
    id: 'fairy_ring', title: 'A fairy ring', text: 'A ring of mushrooms has appeared in a field.', when: (s) => origin(s, 'fae', 'druid') || s.biome === 'forest',
    options: [opt('Dance in it', chance(0.5, [mod('crops', 1.4, 72, 'Blessed by the fair folk')], [mood(-6, 48, 'Cursed by the fair folk')])), dflt('Mow it down', note('The ring is gone by morning.'))],
  },
  {
    id: 'wishing_well', title: 'A voice in the well', text: 'A voice in the well offers a wish.', when: (s) => has(s, 'well'),
    options: [opt('Wish for gold', { coins: 30 }, chance(0.3, [{ sick: 2 }])), opt('Wish for health', mood(5, 72, 'A wish for health'), mod('guard', 0.85, 72, 'Hale and hearty')), dflt('Seal the well', note('The well is sealed.'))],
  },
  {
    id: 'meteor', title: 'A falling star', text: 'A meteor fell beyond the fields.',
    options: [opt('Dig it out', chance(0.7, [gain({ iron: 10, stone: 20 })], [{ wound: 'random', hp: 30 }])), dflt('Leave it', note('The crater cools.'))],
  },
  {
    id: 'blood_moon', title: 'A blood moon', text: 'The moon rises red.', when: (s) => origin(s, 'vampire', 'werewolf'),
    options: [opt('Hold the hunt', mod('fight', 1.3, 24, 'The blood moon hunt'), chance(0.3, [{ wound: 'random', hp: 30 }])), dflt('Lock the doors', mood(-2, 24, 'Locked in under the red moon'))],
  },
  {
    id: 'phylactery', title: "The phylactery's whisper", text: 'The phylactery whispers, hungry for a soul.', when: (s) => !!s.lich,
    options: [opt('Feed it a soul', { kill: 'random', cause: 'fed to the phylactery' }, mod('research', 1.5, 96, 'The phylactery sated'), mod('fight', 1.2, 96, 'The phylactery sated')), dflt('Starve it', mod('research', 0.8, 72, 'The phylactery starving'))],
  },
  {
    id: 'ghost', title: 'A haunting', text: "A ghost haunts {who}'s home.", who: true,
    options: [opt('Exorcise it', { take: 'stores', share: 0.03 }, note('The ghost is laid to rest.')), dflt('Live with it', mood(-3, 72, 'A ghost in the house')), opt('Speak with it', { research: 90 }, note('The ghost tells {who} an old secret.'))],
  },
  {
    id: 'marsh_lights', title: 'Strange lights', text: 'Strange lights dance over the marsh at night.',
    options: [opt('Investigate', chance(0.6, [gain({ iron: 5, cloth: 4 }), note('A drowned merchant\'s goods, in the reeds.')], [{ leave: 'random' }, note('Whoever went never came back.')])), dflt('Stay away', note('The lights fade by dawn.'))],
  },
  {
    id: 'founder_dream', title: "The founder's dream", text: '{founder} dreams of a place far away.',
    options: [opt('Send scouts', mod('work', 0.9, 24, 'Scouts away'), later(12, gain({ flint: 6, herbs: 6, hide: 4 }), note('The scouts return with finds from far away.'))), dflt('Forget it', note('The dream fades.'))],
  },
  {
    id: 'statue', title: 'A buried statue', text: 'Diggers unearthed an old statue.',
    options: [opt('Set it up in the square', mood(4, 120, 'The old statue')), dflt('Sell it', { coins: 20 }), opt('Smash it', chance(0.5, [mood(5, 48, 'An old curse lifted')], [mood(-5, 48, 'Something angry was freed')]))],
  },

  /* ---------------------------------------------------------- trade and coin */
  {
    id: 'rare_relic', title: 'A rare relic', text: 'A merchant offers a rare relic for most of the town\'s coins.', when: (s) => shop(s) && coins(s, 40),
    options: [opt('Buy it', { take: 'coins', share: 0.7 }, { renown: 25 }, mood(4, 72, 'A relic in the town')), dflt('Pass', note('The merchant moves on.'))],
  },
  {
    id: 'broken_axle', title: 'A broken axle', text: "A caravan's axle broke outside town.",
    options: [opt('Help them', mod('work', 0.95, 6, 'Helping the caravan'), gain({ cloth: 4, iron: 2 }), { reputation: 1 }), dflt('Charge them', { coins: 10 }), opt('Ignore them', { reputation: -1 })],
  },
  {
    id: 'moneylender', title: 'A moneylender', text: 'A moneylender offers a loan.', when: shop,
    options: [opt('Borrow', { coins: 40 }, later(48, { coins: -60 }, note('The moneylender comes back for the loan, and more.'))), dflt('Refuse', note('The moneylender shrugs.'))],
  },
  {
    id: 'counterfeit', title: 'Counterfeit coins', text: 'Counterfeit coins turned up in the till.', when: shop,
    options: [opt('Hunt the forger', chance(0.5, [{ coins: 20 }, note('The forger is caught.')], [{ wound: 'random', hp: 25 }])), dflt('Swallow the loss', { take: 'coins', share: 0.15 })],
  },
  {
    id: 'noble_buyer', title: 'A noble buyer', text: "A noble wants to buy the town's finest piece.", when: shop,
    options: [opt('Sell it', { coins: 50 }, { renown: -10 }), dflt('Keep it', { renown: 3 })],
  },
  {
    id: 'stray_dog', title: 'A stray dog', text: "A traveller's dog won't leave the town.",
    options: [opt('Keep it', mod('guard', 0.9, 240, 'A guard dog'), mood(3, 120, 'The town dog')), dflt('Shoo it', note('The dog trots off.'))],
  },
  {
    id: 'guild_contract', title: 'A guild contract', text: 'The guild offers a contract: three people away for two days, for a big reward.', when: (s) => people(s, 8),
    options: [opt('Send them', mod('work', 0.8, 48, 'Three away on contract'), later(48, { coins: 60 }, gain({ iron: 6 }), note('The contract is done: the guild pays well.'))), dflt('Decline', note('The guild finds others.'))],
  },
  {
    id: 'tax_collector', title: 'A tax collector', text: 'A tax collector from a far kingdom demands a share.', when: (s) => eraAt(s, 'medieval') && coins(s, 10),
    options: [opt('Pay', { take: 'coins', share: 0.25 }), dflt('Refuse', { raid: 24 }), opt('Bribe them', { take: 'coins', share: 0.1 }, chance(0.5, [note('The bribe works.')], [{ raid: 24 }]))],
  },
  {
    id: 'dead_guest', title: 'A death at the tavern', text: 'A rich traveller died in the night at the tavern.', when: (s) => has(s, 'fireside_inn', 'tavern'),
    options: [opt('Keep the purse', { coins: 30 }, { reputation: -2 }), dflt('Send it to their family', { reputation: 2 }, { renown: 5 })],
  },
  {
    id: 'market_fair', title: 'A market fair', text: 'A travelling fair asks to set up in town.', when: shop,
    options: [opt('Host it', mod('travellers', 2, 24, 'The fair is in town'), mood(5, 24, 'The fair'), chance(0.4, [{ take: 'stores', share: 0.05 }])), dflt('Decline', note('The fair moves on.'))],
  },
  {
    id: 'smugglers', title: 'Smugglers', text: 'Smugglers want to store goods in the cellars.', when: shop,
    options: [opt('Let them', { coins: 30 }, { raid: 36 }), dflt('Refuse', note('The smugglers find another town.'))],
  },
  {
    id: 'exotic_seeds', title: 'Exotic seeds', text: 'A caravan offers seeds from far away.', when: (s) => fields(s) && coins(s, 10),
    options: [opt('Buy them', { coins: -10 }, mod('crops', 1.4, 72, 'Exotic seeds in the fields')), dflt('Pass', note('The caravan rolls on.'))],
  },

  /* ---------------------------------------------------------- townsfolk and their lives */
  {
    id: 'quarrel', title: 'A quarrel', text: '{who} and a neighbour are at each other\'s throats over a debt.', who: true,
    options: [opt('Side with {who}', mood(-2, 24, 'A quarrel settled one way')), opt('Side with the neighbour', mood(-2, 24, 'A quarrel settled the other way')), dflt('Let them sort it out', chance(0.4, [{ wound: 'who', hp: 20 }, note('The quarrel came to blows.')]))],
  },
  {
    id: 'wants_to_leave', title: 'Leaving for the city', text: '{who} wants to leave for the city.', who: true, when: (s) => people(s, 6),
    options: [opt('Let them go', { leave: 'who' }), dflt('Ask them to stay', mood(-3, 48, 'Someone sulking'))],
  },
  {
    id: 'proposal', title: 'A proposal', text: '{who} wants to marry someone from a rival trade.', who: true,
    options: [opt('Bless it', mood(5, 48, 'A wedding')), dflt('Forbid it', mood(-4, 48, 'A forbidden match'))],
  },
  {
    id: 'thief', title: 'A thief among you', text: 'Things keep going missing from the stores.',
    options: [opt('Search the homes', mood(-4, 48, 'Homes searched'), note('The thief is found.')), dflt('Set a trap', { take: 'stores', share: 0.05 }, later(24, note('The trap catches the thief.')))],
  },
  {
    id: 'dying_elder', title: 'A last wish', text: '{who}, old and dying, asks to see the mountains one last time.', who: true,
    options: [opt('Send them with an escort', mod('work', 0.9, 24, 'An escort away'), mood(5, 72, 'A last wish granted')), dflt('Keep them comfortable', mood(-1, 24, 'A last wish refused'))],
  },
  {
    id: 'prank_fire', title: "A child's prank", text: "A child's prank set a shed on fire.",
    options: [opt('Punish them', mood(-2, 12, 'A child punished')), dflt('Laugh it off', later(36, { take: 'stores', share: 0.03 }, note('Another prank: more mischief in the stores.')))],
  },
  {
    id: 'revenge_hunt', title: 'A hunter\'s vengeance', text: '{who} wants to go after the beast that killed their kin.', who: true,
    options: [opt('Let them go', later(10, chance(0.6, [gain({ hide: 6, meat: 10 }), mood(5, 48, 'The beast slain')], [{ kill: 'who', cause: 'hunting the beast that killed their kin' }]))), dflt('Forbid it', mood(-3, 36, 'Forbidden a vengeance'))],
  },
  {
    id: 'duel', title: 'A duel for honour', text: "A stranger insults {founder} and demands a duel.",
    options: [opt('Accept', chance(0.6, [mood(6, 72, 'The founder\'s honour upheld'), { reputation: 2 }], [{ wound: 'random', hp: 40 }, mood(-4, 48, 'A duel lost')])), dflt('Decline', mood(-2, 48, 'A duel declined'))],
  },
  {
    id: 'confession', title: 'A confession', text: '{who} confesses to an old crime.', who: true,
    options: [opt('Forgive them', mood(2, 24, 'A crime forgiven')), dflt('Exile them', { leave: 'who' })],
  },
  {
    id: 'brawl', title: 'A brawl', text: 'A drunken brawl broke out last night.', when: (s) => has(s, 'fireside_inn', 'tavern'),
    options: [opt('Throw them in the stocks', mood(-1, 12, 'Brawlers in the stocks'), mod('guard', 0.95, 48, 'Order kept')), dflt('Let it go', chance(0.4, [{ wound: 'random', hp: 15 }]))],
  },
  {
    id: 'own_home', title: 'A home apart', text: '{who} wants to build a home away from the town.', who: true,
    options: [opt('Let them', { leave: 'who' }, note('{who} moves out to the wilds.')), dflt('No', mood(-2, 24, 'Told to stay put'))],
  },
  {
    id: 'talent', title: 'A talent', text: '{who} has a real talent for carving.', who: true,
    options: [opt('Give them time to practise', mod('work', 0.97, 24, 'Time off to practise'), later(24, mod('craft', 1.2, 96, 'A gifted carver'))), dflt('Keep them working', note('{who} goes back to work.'))],
  },
  {
    id: 'wake', title: 'A funeral', text: 'The town mourns one of its own.', when: (s) => (s.graves?.length ?? 0) > 0,
    options: [opt('Hold a great wake', { take: 'food', share: 0.08 }, mood(5, 48, 'A great wake')), dflt('Bury them quietly', note('A quiet burial.'))],
  },
  {
    id: 'founder_birthday', title: "The founder's birthday", text: "It's {founder}'s birthday.",
    options: [opt('Hold a feast', { take: 'food', share: 0.08 }, mood(6, 24, 'A birthday feast')), dflt('Work as usual', note('Just another day.'))],
  },
  {
    id: 'apprentice', title: 'An apprentice', text: '{who} wants to learn a trade from a master.', who: true,
    options: [opt('Let them', mod('work', 0.95, 48, 'An apprentice learning'), later(48, mod('craft', 1.15, 120, 'A trained apprentice'))), dflt('Not now', note('Maybe another time.'))],
  },
  {
    id: 'midwife_herbs', title: 'The midwife needs herbs', text: 'A birth is coming, and the midwife needs herbs nobody has.',
    options: [opt('Send someone to the hills', later(6, gain({ herbs: 8 }), mood(4, 48, 'A safe birth'))), dflt('Make do', chance(0.3, [mood(-6, 72, 'A birth gone wrong')]))],
  },

  /* ---------------------------------------------------------- land, ruins and beasts */
  {
    id: 'ruin', title: 'An old ruin', text: 'An old ruin was found near the town.',
    options: [opt('Dig now', chance(0.6, [gain({ iron: 8, stone: 20, cloth: 4 })], [{ raid: 4 }, note('Something woke in the ruin!')])), dflt('Seal it', note('The ruin is sealed.')), opt('Study it', { research: 120 })],
  },
  {
    id: 'monster_lair', title: "A monster's lair", text: "A monster's lair was found in the hills.", when: (s) => people(s, 6),
    options: [opt('Hunt it', chance(0.5, [gain({ hide: 10, bone: 8, meat: 15 }), mood(6, 72, 'Slew the monster')], [{ kill: 'random', cause: 'hunting the monster' }])), dflt('Leave it be', chance(0.3, [{ raid: 12 }]))],
  },
  {
    id: 'cave', title: 'A cave opens', text: 'A quake opened a cave near the town.',
    options: [opt('Explore it', chance(0.7, [gain({ iron_ore: 12, stone: 15 })], [{ wound: 'random', hp: 35 }])), dflt('Block it', note('The cave is blocked.'))],
  },
  {
    id: 'wolves_livestock', title: 'Wolves at the livestock', text: 'Wolves have been taking the livestock.', when: pens,
    options: [opt('Hunt the pack', chance(0.7, [gain({ hide: 4, meat: 4 })], [{ wound: 'random', hp: 25 }])), dflt('Build a better fence', { take: 'stores', share: 0.03 })],
  },
  {
    id: 'bear', title: 'A bear', text: 'A bear is sleeping under the stockpile.',
    options: [opt('Drive it off', chance(0.6, [gain({ hide: 4, meat: 8 })], [{ wound: 'random', hp: 40 }])), dflt('Let it sleep', mod('work', 0.9, 24, 'A bear under the stockpile'))],
  },
  {
    id: 'fallen_tree', title: 'A fallen giant', text: 'A giant tree has fallen across the road.',
    options: [opt('Cut it up', gain({ wood: 40 }), mod('work', 0.9, 12, 'Cutting up the giant')), dflt('Go around it', mod('travellers', 0.8, 48, 'The road is blocked'))],
  },
  {
    id: 'hot_spring', title: 'A hot spring', text: 'A spring of hot water was found.',
    options: [opt('Build a bathhouse', { take: 'stores', share: 0.05 }, mood(5, 240, 'The bathhouse')), dflt('Leave it', note('The spring steams on.'))],
  },
  {
    id: 'sinkhole', title: 'A sinkhole', text: 'A sinkhole swallowed part of a field.', when: fields,
    options: [opt('Fill it', { take: 'stores', share: 0.05 }), dflt('Make it a pond', gain({ meat: 6 }), mod('crops', 0.9, 72, 'A field lost to a pond'))],
  },
  {
    id: 'wild_horses', title: 'Wild horses', text: 'Wild horses are grazing in the meadow.',
    options: [opt('Catch them', chance(0.6, [mod('travellers', 1.2, 120, 'Horses caught'), mood(3, 48, 'Horses caught')], [{ wound: 'random', hp: 25 }])), dflt('Let them run', note('The horses gallop off.'))],
  },
  {
    id: 'bees', title: 'Bees in the oak', text: 'A swarm of bees has settled in the old oak.',
    options: [opt('Take the honey', gain({ berries: 12 }), { wound: 'random', hp: 8 }), dflt('Leave them', mod('crops', 1.15, 120, 'Bees in the fields'))],
  },
  {
    id: 'dragon', title: 'A dragon', text: 'A dragon was seen over the mountains.', weight: 0.3, when: (s) => people(s, 10),
    options: [opt('Hide the gold', mod('work', 0.8, 12, 'Hiding the gold')), opt('Offer tribute', { take: 'coins', share: 0.4 }, { take: 'food', share: 0.1 }), dflt('Ignore it', chance(0.2, [{ take: 'stores', share: 0.25 }, { kill: 'random', chance: 0.5, cause: 'in dragonfire' }, note('The dragon came!')]))],
  },
  {
    id: 'bandit_trail', title: 'A bandit trail', text: 'A trail leads to a bandit hideout.',
    options: [opt('Follow it', later(8, chance(0.6, [gain({ iron: 6, cloth: 6 }), { coins: 20 }], [{ wound: 'random', hp: 30 }]))), dflt('Report it to travellers', { reputation: 2 })],
  },

  /* ---------------------------------------------------------- era and origin moments */
  {
    id: 'printing_press', title: 'The printing press', text: 'The first printing press is ready.', when: (s) => eraIs(s, 'medieval') && has(s, 'scriptorium', 'library'),
    options: [opt('Print pamphlets', mod('research', 1.25, 120, 'Pamphlets everywhere'), mood(-3, 72, 'Unrest from the pamphlets')), dflt('Print scripture', mood(5, 120, 'Scripture in print'))],
  },
  {
    id: 'railway', title: 'Railway surveyors', text: 'Surveyors want to lay a railway line through the town.', when: (s) => eraIs(s, 'industrial'),
    options: [opt('Allow it', mod('travellers', 1.5, 240, 'The railway'), mod('crops', 0.9, 240, 'A field lost to the line')), dflt('Refuse', note('The line goes elsewhere.'))],
  },
  {
    id: 'strike', title: 'A factory strike', text: 'The workers are on strike.', when: (s) => eraAt(s, 'industrial') && has(s, 'factory'),
    options: [opt('Raise wages', { take: 'coins', share: 0.2 }, mood(4, 72, 'Better wages')), dflt('Wait it out', mod('craft', 0.3, 48, 'On strike'))],
  },
  {
    id: 'radio_call', title: 'A call for volunteers', text: 'A radio broadcast calls for volunteers.', when: (s) => eraAt(s, 'modern') && people(s, 8),
    options: [opt('Send them', mod('work', 0.85, 72, 'Volunteers away'), { reputation: 3 }, { renown: 10 }), dflt('Stay home', note('The town stays out of it.'))],
  },
  {
    id: 'drone_crash', title: 'A crashed drone', text: 'A drone crashed in the square.', when: (s) => eraIs(s, 'space'),
    options: [opt('Salvage it', gain({ circuits: 4, alloys: 2 })), dflt('Return it', { coins: 30 })],
  },
  {
    id: 'machine_names', title: 'The machines ask for names', text: 'The machines ask to be given names.', when: (s) => origin(s, 'robot'),
    options: [opt('Name them', mod('work', 1.1, 120, 'Named, not numbered')), dflt('Keep serial numbers', note('Units remain numbered.'))],
  },
  {
    id: 'grove_sacrifice', title: 'The grove asks', text: 'The grove asks for a sacrifice of iron.', when: (s) => origin(s, 'druid'),
    options: [opt('Give a felling tool', { take: 'stores', share: 0.02 }, mod('crops', 1.3, 120, 'The grove is pleased')), dflt('Give nothing', mod('forage', 1.2, 72, 'The forest grows back fast'))],
  },
  {
    id: 'court_ball', title: 'The court demands a ball', text: 'The court demands a grand ball.', when: (s) => origin(s, 'vampire'),
    options: [opt('Hold it', { take: 'coins', share: 0.3 }, mod('prices', 1.3, 120, 'The talk of the court')), dflt('Cancel it', mood(-5, 72, 'No ball this season'))],
  },
  {
    id: 'moon_hunt', title: 'The pack wants to run', text: 'The pack wants to hunt the moon.', when: (s) => origin(s, 'werewolf'),
    options: [opt('Let them run', mod('fight', 1.25, 72, 'The moon hunt'), chance(0.3, [{ leave: 'random' }, note('One of the pack never came back.')])), dflt('Chain the gates', mood(-3, 48, 'Chained in'))],
  },
  {
    id: 'route_split', title: 'The tribe splits over the route', text: 'The tribe argues over the road to the next pasture.', when: (s) => origin(s, 'nomads') && !s.nomad?.settled,
    options: [opt('By the river', mod('work', 0.9, 24, 'The long way round'), { calm: 24 }), dflt('Over the pass', mod('work', 1.05, 24, 'The quick way'), chance(0.4, [{ raid: 12 }]))],
  },
];

export const EVENT_BY_ID: Readonly<Record<string, EventDef>> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
