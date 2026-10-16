// The settlers' own base callings (data/originCallings.ts; the shape in ./kit.ts). The frontier's three: the Frontier
// Hand (out past the last fence, or making the new ground hold), the Homesteader (the farm held, or the farm
// harvested) and the Preacher (the faith carried along the trails, or the town's learning and its law). They lean on
// the frontier (sim/frontier.ts): claims staked and jumped, wagons of new settlers, and tricks learned from every people.

import { A, P, cleanse, grant, heal, hit, inflict, revive, summon, type CallingTree } from './kit';

const FRONTIER_HAND: CallingTree = {
  origin: 'settlers',
  colours: { fill: '#5e7a3a', dark: '#2f3e1c', light: '#d6e4b4' },
  fork: '{name} came back from the edge of the map with mud to the knees and a claim marked on a strip of bark. The town is growing out towards wherever they have been. They can keep pushing the edge further, or stay and make the new ground hold.',
  base: {
    id: 'frontier_hand', name: 'Frontier Hand', cls: 'ranger',
    text: 'Clears the trees, stakes the claims and shoots whatever objects: the frontier\'s odd-job hand.',
    lore: 'The Frontier Hand owns an axe, a bow, a blanket and a great many opinions about weather. They are the first out past the last fence and the last back in, and have stopped finding either remarkable.',
    skill: ['bark_and_bow', 'Bark and Bow', P({ accuracy: 0.05, hp: 0.05 })],
    lean: { dex: 0.2, vit: 0.15, str: 0.1 }, emblem: { main: ['Tool', 0] }, behind: ['MedWep', 9], form: 'samurai_archer', arms: 'ax',
  },
  roads: [
    [{
      id: 'trailblazer', name: 'Trailblazer', cls: 'ranger',
      text: 'Goes where there is no path yet, and leaves one behind.',
      lore: 'Every road the settlers walk was first a line of notches on trees, cut by a Trailblazer who did not know where it would end. They move fast through rough country and are hard to ambush, because they were there first.',
      skill: ['blaze_the_trail', 'Blaze the Trail', P({ speed: 0.07, dodge: 0.06, accuracy: 0.05 })],
      lean: { dex: 0.25, wis: 0.15, vit: 0.1 }, emblem: { main: ['Tool', 6] },
    }, [
      [{
        id: 'pathfinder', name: 'Pathfinder', cls: 'ranger',
        text: 'Finds the way through, and the ambush waiting on it.',
        lore: 'The Pathfinder reads a trail like a letter: who passed, how many, how heavy, how frightened. The settlers\' wagons follow them, and so, now and then, do raiders who later wish they had not.',
        skill: ['read_the_ground', 'Read the Ground', A(16, [hit(1.7), inflict('vulnerable', 5, 'foe', 0.8), grant('focus', 5)])],
        lean: { dex: 0.25, wis: 0.2, vit: 0.05 }, emblem: { main: ['Scroll', 10] },
      }, [
        {
          id: 'claim_staker', name: 'Claim Staker', cls: 'ranger',
          text: 'Stakes the town\'s claims at the edge of the known land, and holds them against the jumpers.',
          lore: 'The Claim Staker drives the first post into new ground, carves the town\'s mark on it, and sits by it with a bow across their knees. Claim-jumpers who come for the post find the Staker very fond of it.',
          skill: ['staked_and_held', 'Staked and Held', P({ hp: 0.12, damage: 0.12, guard: 0.1, accuracy: 0.08, counter: 0.08 })],
          lean: { dex: 0.2, vit: 0.2, str: 0.1 }, emblem: { main: ['Tool', 14] },
          asc: ['lord_of_the_far_claims', 'Lord of the Far Claims'],
        },
        {
          id: 'wagon_scout', name: 'Wagon Scout', cls: 'ranger',
          text: 'Rides ahead of the settlers\' wagons and clears the road of whatever is on it.',
          lore: 'New settlers come up the road in wagons, one for every claim, and the Wagon Scout brings them in. They know every river crossing by its mood, and have shot more wolves off a tailboard than they can count.',
          skill: ['circle_the_wagons', 'Circle the Wagons', A(28, [grant('protect', 8, 'allies'), hit(0.9, 'physical', 'random_foes', 3)])],
          lean: { dex: 0.25, cha: 0.15, vit: 0.1 }, emblem: { main: ['Ammo', 2] },
          asc: ['master_of_the_wagon_road', 'Master of the Wagon Road'],
        },
      ]],
      [{
        id: 'trapper', name: 'Trapper', cls: 'hunter',
        text: 'Lives out past the claims on furs and snares, and the snares do not much care what walks into them.',
        lore: 'The Trapper comes to town twice a year with a mule full of pelts and leaves before anyone can ask how they are. Their snares catch rabbits, foxes and, on one remembered occasion, an entire outlaw.',
        skill: ['spring_the_snare', 'Spring the Snare', A(18, [hit(1.6), inflict('stop', 3, 'foe', 0.6), inflict('bleed', 5, 'foe', 0.6)])],
        lean: { dex: 0.2, wis: 0.2, vit: 0.1 }, emblem: { main: ['Tool', 20] },
      }, [
        {
          id: 'bounty_tracker', name: 'Bounty Tracker', cls: 'hunter',
          text: 'Follows claim-jumpers and outlaws into the wild, and comes back alone.',
          lore: 'Claim-jumpers have a price on their heads in every settlement on the frontier, and the Bounty Tracker collects. They follow a trail for weeks without losing it, and do not much care whether the quarry knows.',
          skill: ['wanted', 'Wanted', A(20, [hit(2.4), inflict('slow', 5, 'foe', 0.8), inflict('bleed', 6, 'foe', 0.7)])],
          lean: { dex: 0.3, wis: 0.15, str: 0.05 }, emblem: { main: ['Scroll', 40] },
          asc: ['bane_of_outlaws', 'Bane of Outlaws'],
        },
        {
          id: 'bear_trapper', name: 'Bear Trapper', cls: 'beast_tamer', companion: 'companion_wolf',
          text: 'Hunts the big beasts with iron jaws, and a hound that is nearly as big.',
          lore: 'Out past the last claim the Bear Trapper sets iron jaws for things that would eat a settler, and keeps a hound the size of a calf for the things that will not wait to be trapped. Neither of them is friendly, and both are good at their work.',
          skill: ['iron_jaws', 'Iron Jaws', P({ beast: 0.3, damage: 0.12, stun: 0.08, hp: 0.1 })],
          lean: { str: 0.2, vit: 0.2, wis: 0.1 }, emblem: { main: ['Tool', 22] },
          asc: ['king_of_the_pelt_trade', 'King of the Pelt Trade'],
        },
      ]],
    ]],
    [{
      id: 'woodsman', name: 'Woodsman', cls: 'warrior', form: 'ninja_peasant',
      text: 'Fells the forest for the town, and fells whatever comes out of it too.',
      lore: 'Every home in the settlement started as a tree the Woodsman took down. They swing an axe all day for a living, so a raider is mostly a short and unusual afternoon.',
      skill: ['heavy_swing', 'Heavy Swing', A(14, [hit(1.5), inflict('weak', 4, 'foe', 0.4)])],
      lean: { str: 0.25, vit: 0.15, dex: 0.05 }, emblem: { main: ['Tool', 2] },
    }, [
      [{
        id: 'timberjack', name: 'Timberjack', cls: 'warrior',
        text: 'Brings down the great trees, and the great foes, with two-handed cuts.',
        lore: 'The Timberjack takes the trees the others will not try: the old giants at the heart of the wood, wide as a cart. They fight the way they fell, a cut from each side and a shout of warning that is more for form than anything.',
        skill: ['timber', 'Timber!', A(20, [hit(1.9, 'physical', 'foes'), inflict('stun', 1, 'foes', 0.3)])],
        lean: { str: 0.3, vit: 0.15, dex: 0.05 }, emblem: { main: ['LongWep', 4] },
      }, [
        {
          id: 'greatwood_feller', name: 'Greatwood Feller', cls: 'warrior',
          text: 'Fells trees older than the town, and anything else that stands too tall.',
          lore: 'The oldest trees on the frontier were there before any people, and some of them do not want to come down. The Greatwood Feller has met a few that fought back, and treats a troll or a treant much as they would a stubborn oak.',
          skill: ['fell_the_giant', 'Fell the Giant', A(24, [hit(2.6), inflict('vulnerable', 6, 'foe', 0.8)])],
          lean: { str: 0.35, vit: 0.15 }, emblem: { main: ['LongWep', 46] },
          asc: ['bane_of_the_old_wood', 'Bane of the Old Wood'],
        },
        {
          id: 'log_driver', name: 'Log Driver', cls: 'warrior', arms: 'sp',
          text: 'Rides the logs down the river in spring, and has never once fallen in.',
          lore: 'Every spring the Log Driver takes the winter\'s timber downriver standing on it, with a pike pole and no fear of water. A raider on a wall is steadier footing than a log in a flood, and they fight like it.',
          skill: ['spring_drive', 'Spring Drive', P({ dodge: 0.12, speed: 0.1, damage: 0.12, counter: 0.1 })],
          lean: { dex: 0.25, str: 0.2, vit: 0.1 }, emblem: { main: ['LongWep', 36] },
          asc: ['master_of_the_spring_drive', 'Master of the Spring Drive'],
        },
      ]],
      [{
        id: 'stockade_builder', name: 'Stockade Builder', cls: 'guardian', form: 'knight_1',
        text: 'Raises the palisade round each new claim, and stands at its gate.',
        lore: 'A claim is a hope; a claim with a stockade is a home. The Stockade Builder can put a fence of sharpened logs round a homestead in a day, and has learned the hard way to finish the gate first.',
        skill: ['sharpened_logs', 'Sharpened Logs', P({ guard: 0.12, thorns: 0.1, armor: 0.04, hp: 0.06 })],
        lean: { vit: 0.25, str: 0.2 }, emblem: { main: ['Tool', 16] },
      }, [
        {
          id: 'blockhouse_keeper', name: 'Blockhouse Keeper', cls: 'guardian',
          text: 'Holds the log blockhouse at the edge of the land: the last door before the wild.',
          lore: 'Every frontier has a blockhouse at its far end, two storeys of squared logs with loopholes and a well inside. The Keeper has held it through sieges by outlaws and worse, and the door has never once been opened from outside.',
          skill: ['bar_the_door', 'Bar the Door', P({ guard: 0.22, armor: 0.06, hp: 0.15, block: 0.1, resist: 0.08 })],
          lean: { vit: 0.3, str: 0.15, wis: 0.1 }, emblem: { main: ['Armor', 64] },
          asc: ['keeper_of_the_last_fort', 'Keeper of the Last Fort'],
        },
        {
          id: 'palisade_sergeant', name: 'Palisade Sergeant', cls: 'knight',
          text: 'Mans the walls with whoever is to hand, and makes them a garrison.',
          lore: 'The Palisade Sergeant has trained cooks, children and one very old preacher to hold a wall, and all of them held it. They walk the fire step shouting names, and everyone answers.',
          skill: ['man_the_walls', 'Man the Walls', A(28, [grant('protect', 8, 'allies'), grant('taunt', 5), hit(1.8, 'physical', 'foes')])],
          lean: { vit: 0.2, cha: 0.2, str: 0.15 }, emblem: { main: ['Hat', 20] },
          asc: ['wall_of_the_frontier', 'Wall of the Frontier'],
        },
      ]],
    ]],
  ],
};

const HOMESTEADER: CallingTree = {
  origin: 'settlers',
  colours: { fill: '#b58a3c', dark: '#5f4518', light: '#f3e2b3' },
  fork: 'The claim {name} staked is a real farm now: a house, a barn, and a field that came through the frost. Neighbours ride over to ask their advice about seed. A farm like that can be made to stand against anything, or made to bring in more than anyone thought the land could give.',
  base: {
    id: 'homesteader', name: 'Homesteader', cls: 'warrior',
    text: 'Works a claim into a farm, and keeps a pitchfork sharp for whatever comes over the fence.',
    lore: 'The Homesteader turned a patch of wild ground into a house, a field and a winter\'s worth of food, mostly with their hands. They are slow to anger and very slow to leave, and the pitchfork by the door is not only for hay.',
    skill: ['hard_graft', 'Hard Graft', P({ hp: 0.07, regen: 0.01, guard: 0.03 })],
    lean: { vit: 0.25, str: 0.15, wis: 0.05 }, emblem: { main: ['Tool', 8] }, behind: ['LongWep', 0], form: 'ninja_peasant', arms: 'sp',
  },
  roads: [
    [{
      id: 'smallholder', name: 'Smallholder', cls: 'guardian',
      text: 'Holds their few acres against all comers: the weather, the wolves and the tax.',
      lore: 'A Smallholder has a cow, a field and no intention of giving up either. They have fought off frost, blight, wolves and a surveyor, and the last was the hardest.',
      skill: ['my_few_acres', 'My Few Acres', P({ guard: 0.08, hp: 0.07, resist: 0.04 })],
      lean: { vit: 0.25, wis: 0.15, str: 0.1 }, emblem: { main: ['Tool', 12] },
    }, [
      [{
        id: 'yeoman', name: 'Yeoman', cls: 'archer', arms: 'lb',
        text: 'A free farmer with a longbow, and practice every feast day at the village butts.',
        lore: 'The law in the old country made every free farmer practise the bow on feast days, and the settlers kept the habit. A Yeoman can drop a running deer at two hundred paces, and has very little interest in what a knight thinks about that.',
        skill: ['feast_day_practice', 'Feast-Day Practice', A(16, [hit(1.9), inflict('bleed', 4, 'foe', 0.5)])],
        lean: { dex: 0.3, vit: 0.1, str: 0.1 }, emblem: { main: ['Ammo', 24] },
      }, [
        {
          id: 'bowman_of_the_shire', name: 'Bowman of the Shire', cls: 'archer',
          text: 'Lines up with the other farmers and darkens the sky.',
          lore: 'Twenty farmers with longbows are a nuisance; two hundred are the end of an army, and the Bowman of the Shire knows how to make twenty sound like two hundred. They shoot in volleys, by the count, and the count is short.',
          skill: ['darken_the_sky', 'Darken the Sky', A(24, [hit(1.8, 'physical', 'foes'), hit(0.6, 'physical', 'random_foes', 2)])],
          lean: { dex: 0.3, cha: 0.15, vit: 0.1 }, emblem: { main: ['Ammo', 44] },
          asc: ['bow_of_the_shire', 'Bow of the Shire'],
        },
        {
          id: 'freeholder', name: 'Freeholder', cls: 'guardian', arms: 'sp',
          text: 'Owns their land outright, and the land seems to fight for them.',
          lore: 'The Freeholder holds their deed from nobody: no lord, no Order, no moneylender. They plant their feet on their own soil and become very hard to shift, as though the ground had a stake in the outcome.',
          skill: ['deed_to_the_land', 'Deed to the Land', P({ guard: 0.2, hp: 0.15, armor: 0.05, regen: 0.03, resist: 0.1 })],
          lean: { vit: 0.3, wis: 0.15, str: 0.1 }, emblem: { main: ['Scroll', 24] },
          asc: ['heart_of_the_free_land', 'Heart of the Free Land'],
        },
      ]],
      [{
        id: 'herdsman', name: 'Herdsman', cls: 'beast_tamer', companion: 'companion_wolf',
        text: 'Drives the cattle out to grass and back, with a dog that bites more than cattle.',
        lore: 'The Herdsman knows every beast in the herd by its face and every wolf in the hills by its habits. Their dog does not like raiders, and has made its feelings known on a number of legs.',
        skill: ['set_the_dog_on', 'Set the Dog On Them', A(18, [hit(1.6), inflict('fear', 4, 'foe', 0.5), grant('focus', 4)])],
        lean: { wis: 0.2, vit: 0.15, dex: 0.15 }, emblem: { main: ['Tool', 18] },
      }, [
        {
          id: 'drover', name: 'Drover', cls: 'beast_tamer',
          text: 'Drives a herd a hundred miles to market, and a stampede through raiders.',
          lore: 'The Drover moves cattle by the thousand across rivers and passes to the markets downcountry, and has learned how to turn a herd. Raiders caught in the path of a turned herd are rarely seen again in one piece.',
          skill: ['stampede', 'Stampede', A(28, [hit(2.2, 'earth', 'foes'), inflict('stun', 2, 'foes', 0.4)])],
          lean: { wis: 0.2, str: 0.2, cha: 0.1 }, emblem: { main: ['Tool', 23] },
          asc: ['king_of_the_cattle_road', 'King of the Cattle Road'],
        },
        {
          id: 'hill_shepherd', name: 'Hill Shepherd', cls: 'beast_tamer', arms: 'st',
          text: 'Keeps the flock, the dogs and the hills, and none of the three is ever lost.',
          lore: 'Up in the high pastures the Hill Shepherd lives with a crook, three dogs and several hundred sheep, and the wolves of the hills have come to terms with all of them. The dogs work as one, and in a fight so does anyone the Shepherd whistles for.',
          skill: ['three_dogs', 'Three Dogs', A(45, [summon('companion_wolf'), summon('companion_wolf'), grant('inspired', 6, 'allies')])],
          lean: { wis: 0.3, cha: 0.15, vit: 0.1 }, emblem: { main: ['Wand', 10] },
          asc: ['shepherd_of_the_high_pastures', 'Shepherd of the High Pastures'],
        },
      ]],
    ]],
    [{
      id: 'reaper', name: 'Reaper', cls: 'warrior', arms: 'sc',
      text: 'Brings in the harvest with a scythe, and has found it brings in other things too.',
      lore: 'At harvest the Reaper goes down the field in long, even sweeps, and the wheat lies down behind them in rows. It takes the same swing to clear a gate, and the Reaper is not shy of the comparison.',
      skill: ['long_sweep', 'Long Sweep', A(16, [hit(1.4, 'physical', 'foes')])],
      lean: { str: 0.2, dex: 0.15, vit: 0.15 }, emblem: { main: ['LongWep', 42] },
    }, [
      [{
        id: 'harvester', name: 'Harvester', cls: 'warrior',
        text: 'Works the field in a gang, and fights in one.',
        lore: 'At harvest the whole town goes out to the fields in a line, and the Harvester sets the pace. They can work from dawn to dusk without stopping, and in a fight they do not slow down either.',
        skill: ['harvest_pace', 'Harvest Pace', P({ speed: 0.1, damage: 0.1, cleave: 0.15 })],
        lean: { str: 0.25, vit: 0.2, dex: 0.05 }, emblem: { main: ['Tool', 5] },
      }, [
        {
          id: 'scythe_dancer', name: 'Scythe Dancer', cls: 'warrior',
          text: 'Whirls the scythe in wide circles, and nothing standing near them stays standing.',
          lore: 'The harvest festival has a dance with scythes, and the Scythe Dancer won it so often they were asked to stop entering. It turns out the dance was a fighting form all along, and the settlers\' grandmothers knew it.',
          skill: ['harvest_dance', 'Harvest Dance', A(22, [hit(0.9, 'physical', 'foes', 2), inflict('bleed', 5, 'foes', 0.5)])],
          lean: { dex: 0.25, str: 0.2, cha: 0.1 }, emblem: { main: ['LongWep', 50] },
          asc: ['the_last_harvest', 'The Last Harvest'],
        },
        {
          id: 'thresher', name: 'Thresher', cls: 'warrior', arms: 'fl',
          text: 'Beats the grain from the chaff with a flail, and the fight out of raiders the same way.',
          lore: 'Threshing is the hardest work on the farm: hours of swinging a jointed flail at the barn floor until the grain gives up. The Thresher has done it every autumn since they could lift one, and raiders give up rather faster than grain.',
          skill: ['beat_the_chaff', 'Beat the Chaff', A(18, [hit(1.1, 'physical', 'foe', 2), inflict('stun', 2, 'foe', 0.4)])],
          lean: { str: 0.3, vit: 0.2 }, emblem: { main: ['MedWep', 4] },
          asc: ['flail_of_the_fields', 'Flail of the Fields'],
        },
      ]],
      [{
        id: 'granary_warden', name: 'Granary Warden', cls: 'guardian',
        text: 'Keeps the winter stores, and keeps the town alive on them.',
        lore: 'Every frontier winter is a sum: so many mouths, so many sacks, so many days to spring. The Granary Warden does the sum every night, and in a fight they share out strength the same careful way.',
        skill: ['fair_shares', 'Fair Shares', A(22, [heal(0.8, 'allies'), grant('regen', 6, 'allies')])],
        lean: { wis: 0.25, vit: 0.2, int: 0.1 }, emblem: { main: ['Money', 20] },
      }, [
        {
          id: 'root_cellar_keeper', name: 'Root-Cellar Keeper', cls: 'guardian',
          text: 'Has food put by for every hard winter, and the town comes through each one.',
          lore: 'The Root-Cellar Keeper has a store under every house and a list of every store. When the snow shuts the passes and the wagons stop coming, the town eats because of them, and goes into the spring raids stronger than the raiders expected.',
          skill: ['put_by_for_winter', 'Put By for Winter', P({ hp: 0.2, regen: 0.04, resist: 0.12, guard: 0.1, healing: 0.1 })],
          lean: { vit: 0.3, wis: 0.2 }, emblem: { main: ['Potion', 14] },
          asc: ['keeper_of_the_long_winter', 'Keeper of the Long Winter'],
        },
        {
          id: 'hedge_doctor', name: 'Hedge Doctor', cls: 'alchemist', form: 'doll',
          text: 'Grows the physic garden: a cure for most things, and a poison for the rest.',
          lore: 'There is no physician on the frontier, so the Hedge Doctor learned from the strangers who settled: a poultice from one people, a tincture from another, a bitter tea from a third. Most of it works, and the parts that do not work on the sick work very well on raiders.',
          skill: ['borrowed_cures', 'Borrowed Cures', A(26, [heal(1.1, 'allies'), cleanse('allies'), inflict('poison', 6, 'foes', 0.6)])],
          lean: { int: 0.25, wis: 0.25 }, emblem: { main: ['Potion', 30] },
          asc: ['keeper_of_every_remedy', 'Keeper of Every Remedy'],
        },
      ]],
    ]],
  ],
};

const PREACHER: CallingTree = {
  origin: 'settlers',
  colours: { fill: '#4a4038', dark: '#221d18', light: '#e6dccb' },
  fork: 'On Sundays the barn is too small for everyone who comes to hear {name}, and on weekdays half the town brings them questions that are not about God. The settlers brought no magic over the mountains, only faith and whatever they could learn. {name} can carry the faith out along the trails, or keep the town\'s learning and its law.',
  base: {
    id: 'preacher', name: 'Preacher', cls: 'white_mage',
    text: 'Preaches in the barn on Sundays, and sits with the dying the rest of the week.',
    lore: 'The settlers brought no priests, so a Preacher is whoever stood up first and kept standing. They have a battered book, a voice for the back row and a staff for the walk between farms, and they are wanted at every birth, burial and barn-raising.',
    skill: ['sabbath_rest', 'Sabbath Rest', P({ healing: 0.06, regen: 0.01, resist: 0.04 })],
    lean: { wis: 0.25, cha: 0.15, vit: 0.05 }, emblem: { main: ['Book', 0] }, behind: ['LongWep', 16], form: 'wanderer_mage', arms: 'st',
  },
  roads: [
    [{
      id: 'circuit_rider', name: 'Circuit Rider', cls: 'white_mage',
      text: 'Rides from claim to claim with the word, and patches up whoever needs it on the way.',
      lore: 'The farthest claims see a preacher once a month, when the Circuit Rider comes through on a tired horse. They marry, bury and baptise in a single afternoon and are back on the road by dark, because the next claim is waiting.',
      skill: ['on_the_circuit', 'On the Circuit', A(16, [heal(0.9, 'weakest'), grant('haste', 4, 'weakest')])],
      lean: { wis: 0.25, vit: 0.15, cha: 0.1 }, emblem: { main: ['Book', 8] },
    }, [
      [{
        id: 'revivalist', name: 'Revivalist', cls: 'white_mage',
        text: 'Holds the camp meetings where the whole frontier comes to be saved, and some are.',
        lore: 'The Revivalist pitches a tent in a field, and three days later the field holds every settler in the county, singing. People leave the meeting sure they could take on anything, and for a week or so they are not wrong.',
        skill: ['camp_meeting', 'Camp Meeting', A(26, [heal(0.8, 'allies'), grant('inspired', 8, 'allies')])],
        lean: { wis: 0.25, cha: 0.25 }, emblem: { main: ['Light', 1] },
      }, [
        {
          id: 'hellfire_preacher', name: 'Hellfire Preacher', cls: 'white_mage',
          text: 'Preaches fire and damnation, and the fire is not entirely a figure of speech.',
          lore: 'The Hellfire Preacher has a sermon about the flames that wait for the wicked, and preaches it at raiders with such conviction that the flames sometimes turn up early. The faithful stand behind them and feel very safe and slightly singed.',
          skill: ['fire_and_brimstone', 'Fire and Brimstone', A(24, [hit(2.2, 'fire', 'foes'), inflict('fear', 5, 'foes', 0.5)])],
          lean: { wis: 0.25, cha: 0.25, int: 0.05 }, emblem: { main: ['Book', 60] },
          asc: ['voice_in_the_wilderness', 'Voice in the Wilderness'],
        },
        {
          id: 'faith_healer', name: 'Faith Healer', cls: 'white_mage',
          text: 'Lays on hands, and the lame walk, and the fallen get up.',
          lore: 'Nobody can say how the Faith Healer does it, least of all the Faith Healer. They put their hands on a wound and pray out loud and the wound closes; once, in front of the whole town, a dead man sat up and asked for water.',
          skill: ['rise_and_walk', 'Rise and Walk', A(45, [revive(0.5), heal(1.2, 'weakest'), heal(0.5, 'allies')])],
          lean: { wis: 0.35, cha: 0.15 }, emblem: { main: ['Amulet', 20] },
          asc: ['hand_of_providence', 'Hand of Providence'],
        },
      ]],
      [{
        id: 'hymn_leader', name: 'Hymn Leader', cls: 'bard',
        text: 'Lines out the hymns for a congregation that cannot read, and they sing like an army.',
        lore: 'Few settlers can read the hymnbook, so the Hymn Leader sings each line first and the congregation sings it back. In a fight the call and answer carries the length of the wall, and the settlers keep time with it.',
        skill: ['line_out_the_hymn', 'Line Out the Hymn', A(22, [grant('protect', 6, 'allies'), grant('regen', 6, 'allies'), hit(1.5, 'sound')])],
        lean: { cha: 0.25, wis: 0.2, vit: 0.05 }, emblem: { main: ['Music', 4] },
      }, [
        {
          id: 'psalm_singer', name: 'Psalm Singer', cls: 'bard',
          text: 'Sings the old psalms so the whole town hears them, and so do the raiders.',
          lore: 'The Psalm Singer knows every psalm the settlers carried over the mountains, all hundred and fifty, by heart. Sung at the wall in battle they put a kind of steel into the defenders and a kind of doubt into the attackers.',
          skill: ['a_mighty_fortress', 'A Mighty Fortress', A(30, [grant('protect', 8, 'allies'), grant('inspired', 8, 'allies'), inflict('weak', 6, 'foes', 0.5), hit(1.6, 'sound', 'foes')])],
          lean: { cha: 0.3, wis: 0.2 }, emblem: { main: ['Music', 16] },
          asc: ['voice_of_the_great_awakening', 'Voice of the Great Awakening'],
        },
        {
          id: 'barn_dance_fiddler', name: 'Barn-Dance Fiddler', cls: 'bard', form: 'doll',
          text: 'Plays the barn dances, and the town fights to the tune.',
          lore: 'The Preacher does not hold with dancing, and the Barn-Dance Fiddler plays for it every Saturday anyway, with the Preacher tapping a foot at the back. A fiddle tune at the wall makes the defenders quick on their feet and the raiders oddly clumsy.',
          skill: ['strike_up', 'Strike Up', P({ speed: 0.12, dodge: 0.1, accuracy: 0.08, crit: 0.06, counter: 0.06 })],
          lean: { cha: 0.25, dex: 0.2, vit: 0.05 }, emblem: { main: ['Music', 36] },
          asc: ['fiddler_at_the_worlds_edge', 'Fiddler at the World\'s Edge'],
        },
      ]],
    ]],
    [{
      id: 'schoolteacher', name: 'Schoolteacher', cls: 'mage',
      text: 'Teaches the frontier\'s children their letters, and learns from every stranger who passes.',
      lore: 'The settlers have no magic of their own, but they have a schoolroom, and the Schoolteacher fills it with whatever the strangers who settle can teach. A sum, a star chart, a word in another people\'s tongue that makes a spark: all of it goes on the slate.',
      skill: ['chalk_and_slate', 'Chalk and Slate', A(14, [hit(1.4, 'arcane'), inflict('slow', 4, 'foe', 0.5)])],
      lean: { int: 0.25, wis: 0.15, cha: 0.1 }, emblem: { main: ['Scroll', 4] },
    }, [
      [{
        id: 'learner_of_ways', name: 'Learner of Ways', cls: 'mage',
        text: 'Has picked up a trick from every people the town has met, and uses them all.',
        lore: 'The frontier meets everyone sooner or later, and the Learner of Ways asks each of them the same question: how do you do that? They now know a little fae glamour, a little dwarven runecraft, and an orc insult that works as a spell.',
        skill: ['borrowed_tricks', 'Borrowed Tricks', A(18, [hit(1.6, 'arcane'), hit(0.7, 'fire', 'random_foes', 2), inflict('weak', 5, 'foe', 0.5)])],
        lean: { int: 0.3, wis: 0.15, cha: 0.05 }, emblem: { main: ['Book', 20] },
      }, [
        {
          id: 'jack_of_all_peoples', name: 'Jack of All Peoples', cls: 'spellblade', arms: 'sw',
          text: 'A blade in one hand, and every people\'s trick in the other.',
          lore: 'The Jack of All Peoples fights in a style nobody taught them, because everybody taught them. A raider facing one can expect a nomad\'s feint, a knight\'s guard and a druid\'s thorns in the same three heartbeats.',
          skill: ['every_trick_known', 'Every Trick Known', A(22, [hit(1.8, 'arcane'), hit(1, 'nature'), grant('haste', 6), grant('shield', 6)])],
          lean: { int: 0.2, dex: 0.2, str: 0.15 }, emblem: { main: ['Wand', 36] },
          asc: ['master_of_every_way', 'Master of Every Way'],
        },
        {
          id: 'hedge_wizard', name: 'Hedge Wizard', cls: 'mage',
          text: 'Self-taught from borrowed books, and dangerous in ways the schools never thought of.',
          lore: 'The Hedge Wizard never went to a college of magic; there are none on the frontier. They worked it out of second-hand books by lamplight, and their spells have the lopsided force of things nobody told them were impossible.',
          skill: ['lamplight_learning', 'Lamplight Learning', A(24, [hit(2.4, 'lightning', 'foes'), inflict('stun', 2, 'foes', 0.3)])],
          lean: { int: 0.35, wis: 0.15 }, emblem: { main: ['Wand', 44] },
          asc: ['the_self_taught_archmage', 'The Self-Taught Archmage'],
        },
      ]],
      [{
        id: 'justice_of_the_peace', name: 'Justice of the Peace', cls: 'guardian', form: 'doll', arms: 'mc',
        text: 'Holds court in the store on market day: settles feuds, fines drunks, and tries claim-jumpers.',
        lore: 'With no lord and no king, the frontier makes its own law, and the Justice of the Peace is what it made. They hold court on an upturned barrel, judge fast and fairly, and keep a mallet handy for order in the court and out of it.',
        skill: ['order_in_court', 'Order in Court', A(20, [hit(1.7), inflict('silence', 4, 'foe', 0.7), inflict('stun', 1, 'foe', 0.4)])],
        lean: { wis: 0.2, vit: 0.15, cha: 0.15 }, emblem: { main: ['Book', 44] },
      }, [
        {
          id: 'circuit_judge', name: 'Circuit Judge', cls: 'guardian',
          text: 'Rides the claims and brings the law to all of them, whether they want it or not.',
          lore: 'The Circuit Judge carries the whole law of the frontier in a saddlebag and their head. Their verdicts are short and their sentences shorter, and claim-jumpers who hear the Judge is on the road start drifting west.',
          skill: ['sentence_passed', 'Sentence Passed', A(26, [hit(2.3, 'holy'), inflict('stop', 3, 'foe', 0.6), inflict('fear', 5, 'foes', 0.5)])],
          lean: { wis: 0.25, cha: 0.2, vit: 0.1 }, emblem: { main: ['Scroll', 36] },
          asc: ['the_last_word', 'The Last Word'],
        },
        {
          id: 'town_marshal', name: 'Town Marshal', cls: 'hunter', arms: 'cb',
          text: 'Wears the tin star, keeps the peace, and is very quick with a crossbow.',
          lore: 'The Town Marshal was elected by a show of hands in the barn, and has been shot at by most of the losing side since. They walk the streets at night with a loaded crossbow and a lantern, and the town sleeps.',
          skill: ['quick_draw', 'Quick Draw', P({ firstStrike: true, accuracy: 0.12, crit: 0.12, critDamage: 0.2, speed: 0.08 })],
          lean: { dex: 0.3, wis: 0.1, vit: 0.1 }, emblem: { main: ['Ammo', 36] },
          asc: ['law_beyond_the_river', 'Law Beyond the River'],
        },
      ]],
    ]],
  ],
};

export const SETTLERS_CALLINGS: readonly CallingTree[] = [FRONTIER_HAND, HOMESTEADER, PREACHER];
