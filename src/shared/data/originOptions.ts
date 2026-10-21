// Choice events with an answer for one people only (the owner's ask): the existing events, with an extra option at
// the end that shows only to the people it is written for, and ties into that people's own system (the blood farm,
// the raised dead, the grove's favour, the Court's, the Great Work, the Order's honour, the foundry's power, the
// frontier's wagons, the pack's renown, the horde's fury). `originOptions` gives the extras for a town; sim/events.ts
// appends them to the event (so the answers of the common options keep their numbers).
// (the shorthands are written out here: eventKit pulls in the simulation, which pulls in this file)
import type { EventEffect, EventOption, Lever } from './eventKit';
import type { Stock } from './materials';
import type { OriginId } from './origins';

const opt = (label: string, ...effects: EventEffect[]): EventOption => ({ label, effects });
const chance = (p: number, then: EventEffect[], otherwise: EventEffect[] = []): EventEffect => ({ chance: p, then, else: otherwise });
const coin = (n: number): EventEffect => ({ coins: n });
const gain = (stock: Stock): EventEffect => ({ gain: stock });
const horse = (n: number): EventEffect => ({ horse: n });
const mod = (lever: Lever, mult: number, hours: number, text: string): EventEffect => ({ mod: lever, mult, hours, text });
const mood = (by: number, hours: number, text: string): EventEffect => ({ mood: by, hours, text });
const note = (text: string): EventEffect => ({ note: text });
const rep = (n: number): EventEffect => ({ reputation: n });
const take = (what: 'food' | 'stores' | 'coins', share: number): EventEffect => ({ take: what, share });
const ways = (key: Extract<EventEffect, { ways: string }>['ways'], by: number): EventEffect => ({ ways: key, by });
const captives = (n: number): EventEffect => ({ captives: n });
const join = (n: number, type?: string): EventEffect => ({ join: n, ...(type ? { type } : {}) });
const sick = (n: number): EventEffect => ({ sick: n });
const wound = (hp: number, who: 'who' | 'random' | 'all' = 'random'): EventEffect => ({ wound: who, hp });
const calmFor = (h: number): EventEffect => ({ calm: h });
const raidWithin = (h: number): EventEffect => ({ raid: h });

type Extra = Record<string, EventOption>;

export const ORIGIN_OPTIONS: Partial<Record<OriginId, Extra>> = {
  /* ---- the Blood Court (sim/vampires.ts: the blood farm and its cells) */
  vampire: {
    refugees: opt('Take them for the Blood Farm (up to 3 captives in the cells, blood in store; reputation -3)', captives(3), gain({ blood: 4 }), rep(-3)),
    sick_traveller: opt('Drain the traveller (+6 blood; a chance the tainted blood sickens one of you)', gain({ blood: 6 }), chance(0.3, [sick(1), note('The traveller\'s blood was tainted.')]), rep(-1)),
    deserter: opt('Make the deserter a thrall (they join; morale -2, reputation -1)', join(1), mood(-2, 24, 'A thrall bound at the gate'), rep(-1)),
    captive_raider: opt('Send the raider to the Blood Farm (a cell filled, +3 blood)', captives(1), gain({ blood: 3 })),
  },
  /* ---- the liches (sim/occult.ts: the raised dead) */
  lich: {
    refugees: opt('Raise the dead among them (3 join as the raised; reputation -4, morale -4)', join(3), rep(-4), mood(-4, 24, 'The refugees rose again')),
    dead_walk: opt('Bind the risen to the town (2 join as the raised; reputation -1)', join(2), rep(-1)),
    w_pilgrim_dies: opt('Raise the pilgrim to keep the gate (1 joins; morale -2)', join(1), mood(-2, 24, 'The pilgrim walks again')),
    w_old_battlefield: opt('Raise the fallen soldiers (3 join, +6 bone; reputation -2, morale -2)', join(3), gain({ bone: 6 }), rep(-2), mood(-2, 24, 'Soldiers rise from the old field')),
  },
  /* ---- the druids (sim/grove.ts: the grove's favour) */
  druid: {
    wildfire: opt('Sing the fire down (grove favour -4, morale +4 for a day)', ways('grove', -4), mood(4, 24, 'The grove turned the fire')),
    bumper_crop: opt('Give the first sheaf to the grove (a tenth of the food; grove favour +6)', take('food', 0.1), ways('grove', 6)),
    drought: opt('Beg the grove for rain (grove favour -5, crops +15% for 3 days)', ways('grove', -5), mod('crops', 1.15, 72, 'The grove sent rain')),
    l_wolf_pup: opt('Give the pup to the grove (a little from the stores; grove favour +6)', take('stores', 0.02), ways('grove', 6)),
  },
  /* ---- the fae (sim/bargains.ts: the Court's favour) */
  fae: {
    fairy_ring: opt('Dance with the Court (15 coins in gifts; Court favour +6, morale +3)', coin(-15), ways('court', 6), mood(3, 24, 'Danced in the ring')),
    wishing_well: opt('Trade a wish to the Court (Court favour -5, 40 coins)', ways('court', -5), coin(40)),
    stranger: opt('Ask the stranger\'s true name (they join; Court favour -3, a name is a debt)', join(1), ways('court', -3)),
    comet: opt('Hang silver charms for the Court (20 coins; Court favour +5)', coin(-20), ways('court', 5)),
  },
  /* ---- the alchemists (sim/greatWork.ts: the Great Work's progress) */
  alchemists: {
    sick_traveller: opt('Study the illness (Great Work +2, 4 herbs; a chance it spreads)', ways('work', 2), gain({ herbs: 4 }), chance(0.4, [sick(1)])),
    fever_home: opt('Take samples from the sick (Great Work +2, 10 coins in glass and spirits)', ways('work', 2), coin(-10)),
    hermit_tome: opt('Copy the tome into the Great Work (20 coins; Great Work +3)', coin(-20), ways('work', 3)),
    sinkhole: opt('Assay the raw earth (3 sulphur, 3 iron ore, Great Work +1; 10 coins)', gain({ sulphur: 3, iron_ore: 3 }), ways('work', 1), coin(-10)),
  },
  /* ---- the knights (sim/chivalry.ts: the Order's honour) */
  knights: {
    refugees: opt('Swear them to service (3 join; honour +3, work slower for a day)', join(3), ways('honour', 3), mod('work', 0.95, 24, 'Squires to train')),
    deserter: opt('Try the deserter before the Order (honour +3; reputation -1, morale -2)', ways('honour', 3), rep(-1), mood(-2, 12, 'A man shamed in the yard')),
    tribute: opt('Refuse, and offer the chief single combat (honour +6 and peace for 3 days if it is won; if lost, honour -6 and a hurt knight)', chance(0.5, [ways('honour', 6), calmFor(72)], [ways('honour', -6), wound(20)])),
    mercenaries: opt('Send the sellswords away (honour +3, reputation +1; the watch weaker for 3 days)', ways('honour', 3), rep(1), mod('guard', 0.95, 72, 'No hired swords')),
  },
  /* ---- the machines (sim/foundry.ts: the colony's power) */
  robot: {
    stranger: opt('Scan and assimilate the stranger (they join; power -8)', join(1), ways('power', -8)),
    l_gale: opt('Spin the turbines in the gale (power +10)', ways('power', 10)),
    l_lightning_tree: opt('Draw the lightning into the cells (power +15; a chance a unit is scorched)', ways('power', 15), chance(0.25, [wound(15)])),
    broken_axle: opt('Strip the wreck for parts (5 iron, 1 circuit; power -4)', gain({ iron: 5, circuits: 1 }), ways('power', -4)),
  },
  /* ---- the settlers (sim/frontier.ts: wagons and claims) */
  settlers: {
    refugees: opt('Send a wagon for their kin (2 join now and a wagon of settlers follows; 20 coins)', join(2), ways('wagons', 1), coin(-20)),
    stranger: opt('Offer a homestead claim (they join; 15 coins, reputation +2)', join(1), coin(-15), rep(2)),
    bumper_crop: opt('Load a wagon for the new claims (a tenth of the food; a wagon of settlers follows)', take('food', 0.1), ways('wagons', 1)),
    wild_horses: opt('Round them up for the wagons (2 horses; 10 coins)', horse(2), coin(-10)),
  },
  /* ---- the Moon Pack (sim/pack.ts: the pack's renown) */
  werewolf: {
    wolves_livestock: opt('Parley with the wild wolves (pack renown +3; a little food as a gift)', ways('renown', 3), take('food', 0.05)),
    l_wolf_pup: opt('Raise the pup into the pack (pack renown +3; a little food)', ways('renown', 3), take('food', 0.03)),
    bear: opt('Hunt the bear (pack renown +5, 6 meat, 3 hide; someone hurt)', ways('renown', 5), gain({ meat: 6, hide: 3 }), wound(15)),
    monster_lair: opt('Make the lair the pack\'s hunt (pack renown +6, 4 bone if it goes well; all hurt a little)', chance(0.6, [ways('renown', 6), gain({ bone: 4 })], [ways('renown', 1)]), wound(10, 'all')),
  },
  /* ---- the nomads (sim/nomads.ts: herds and the road) */
  nomads: {
    wild_horses: opt('Drive the herd to the summer pasture (3 horses; work slower for a day)', horse(3), mod('work', 0.9, 24, 'Out with the herd')),
    horse_trade: opt('Trade for mares (2 horses; 30 coins)', horse(2), coin(-30)),
    drought: opt('Strike camp for greener ground (foraging +20% for 3 days; morale -3, a little from the stores)', mod('forage', 1.2, 72, 'Greener ground'), mood(-3, 24, 'Struck camp in haste'), take('stores', 0.03)),
    tribute: opt('Outride the raiders (a 60% chance of 3 days\' peace and a horse; otherwise raiders soon and a tenth of the stores gone)', chance(0.6, [calmFor(72), horse(1)], [raidWithin(6), take('stores', 0.1)])),
  },
  /* ---- the merfolk (sim/sea.ts: the shore and the reef) */
  merfolk: {
    flood: opt('Call the flood in to the reef (12 fish, 6 kelp; a twentieth of the stores lost)', gain({ fish: 12, kelp: 6 }), take('stores', 0.05)),
    l_gale: opt('Ride the gale in to the reef (10 fish, 1 pearl; someone is hurt)', gain({ fish: 10, pearls: 1 }), wound(10)),
    plague_ship: opt('Salvage the ship\'s cargo from the deep (3 pearls, 3 cloth; a chance of sickness)', gain({ pearls: 3, cloth: 3 }), chance(0.4, [sick(1)])),
    refugees: opt('Lead them down to the reef (2 join; 8% of the food, reputation +2)', join(2), take('food', 0.08), rep(2)),
  },
  /* ---- the dwarves (the hold: ore, gold and gems) */
  dwarves: {
    cave: opt('Delve it for the hold (8 iron ore, 1 gem; someone hurt)', gain({ iron_ore: 8, gems: 1 }), wound(12)),
    w_cave_in: opt('Tunnel round the rubble (6 iron ore, 2 gold; 20 coins in timber)', gain({ iron_ore: 6, gold: 2 }), coin(-20)),
    dragon: opt('Bar the hold doors and wait it out (no raid for 5 days; 5% of the stores)', calmFor(120), take('stores', 0.05)),
    w_ruin_map: opt('Dig out the old dwarf-halls (a 50% chance of 3 gold and 2 gems; someone hurt)', chance(0.5, [gain({ gold: 3, gems: 2 })]), wound(10)),
  },
  /* ---- the orcs (sim/warpath.ts: the horde's fury) */
  orcs: {
    refugees: opt('Take the strong as thralls (2 join; fury +6, reputation -4)', join(2), ways('fury', 6), rep(-4)),
    captive_raider: opt('Press the raider into the horde (1 joins; fury +5)', join(1), ways('fury', 5)),
    tribute: opt('Take the chief\'s head (a 60% chance of fury +8, 3 days\' peace and 30 coins; otherwise all hurt and fury +3)', chance(0.6, [ways('fury', 8), calmFor(72), coin(30)], [wound(8, 'all'), ways('fury', 3)])),
    scouts: opt('Ride the scouts down (a 70% chance of fury +6 and 3 iron; otherwise one badly hurt)', chance(0.7, [ways('fury', 6), gain({ iron: 3 })], [wound(15)])),
  },
};

/** The extra answers a town of this people has on an event (none for most). */
export function originOptions(origin: OriginId | undefined, eventId: string): EventOption[] {
  const o = ORIGIN_OPTIONS[origin ?? 'settlers']?.[eventId];
  return o ? [o] : [];
}
