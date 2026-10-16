// The mythic callings (data/mythic.ts; the shape in ./kit.ts), and the Wanderer's road that takes the Summoner's place.
// The owner's ask: "mythic rare classes. Only a few that show up very very rarely. Like a summoner." Five lines, open to
// every people and given to almost nobody: the Pact-born (the shared Summoner road grafted on, and a caller of the dead
// and the stars beside it), the Dragon-blooded, the Fate-touched (an oracle), the Twice-buried (who will not stay dead)
// and the Doorborn (who walks between worlds). They are drawn in the great sheets no other calling uses.

import { A, P, cleanse, dispel, drain, grant, heal, hit, inflict, revive, summon, type MythicTree, type Road1 } from './kit';

/** The callers' stats, as the shared Summoner line's (data/paths.ts GLASS): frail and fierce, the owner's call. */
const GLASS = { hp: 0.6, power: 1.7, armor: -0.04, dodge: 0.02 };

const PACT_BORN: MythicTree = {
  colours: { fill: '#4b1f6e', dark: '#24093a', light: '#e2c6ff' },
  fork: 'Things gather round {name} now without being asked: a cold patch in a warm room, a fox that sits and waits, a light over the barrow field that goes where they go. The Old Pact was made long before the town, and it has finally found someone to keep it. The question is only who answers the next call: the bound things of fire and fang, or the quiet dead and the stars above them.',
  born: 'A child of the Old Pact is born in {town}: {name} speaks a word nobody taught them, and something unseen answers.',
  title: 'the Pact-born',
  base: {
    id: 'pact_born', name: 'Pact-born', cls: 'summoner', stats: GLASS,
    text: 'Born under a promise older than the town: things nobody else can see come when they call.',
    lore: 'Once in a long while a child is born who was promised to something before they were born at all. The Pact-born do not learn to summon; they learn, with some difficulty, how to stop. Their mothers keep the shutters closed and the salt line swept.',
    skill: ['the_old_pact', 'The Old Pact', A(30, [summon('spirit'), hit(1.2, 'arcane'), grant('shield', 6, 'self')])],
    lean: { wis: 0.2, cha: 0.2, int: 0.15 }, emblem: { main: ['Magic', 30], charge: ['Scroll', 44] }, behind: ['Wand', 40], form: 'hk_demon_lord', arms: 'st',
  },
  roads: [
    'summoner',
    [{
      id: 'soulkeeper', name: 'Soulkeeper', cls: 'summoner', companion: 'grave_ghost', stats: GLASS,
      text: 'Keeps the town\'s dead close by, and lets them out to fight when the living need them.',
      lore: 'The Soulkeeper walks the graveyard of an evening and knows every stone by its occupant\'s voice. The dead of the town are fond of them and come when called, cold and loyal. Funerals go quicker with a Soulkeeper there: nobody is in any doubt that they are listening.',
      skill: ['the_kept_dead', 'The Kept Dead', A(20, [summon('grave_ghost'), drain(1.4, 'dark')])],
      lean: { wis: 0.25, cha: 0.15, vit: 0.1 }, emblem: { main: ['Light', 3] },
    }, [
      [{
        id: 'barrow_warden', name: 'Barrow Warden', cls: 'summoner', companion: 'wraith', stats: GLASS,
        text: 'Calls up the old dead from the barrows, the ones from before anyone kept names.',
        lore: 'There were people on this land before the town, and they are buried in the long mounds past the fields. The Barrow Warden wakes them, and they come up armed and in a very bad temper about the plough. Nobody else in town will go near the mounds at night, and the Warden sleeps on one.',
        skill: ['out_of_the_mound', 'Out of the Mound', A(24, [summon('wraith'), hit(1.6, 'dark', 'foes'), inflict('fear', 4, 'foes', 0.5)])],
        lean: { wis: 0.25, vit: 0.15, cha: 0.1 }, emblem: { main: ['Amulet', 17], charge: ['Tool', 9] },
      }, [
        {
          id: 'host_of_the_hollow_hills', name: 'Host of the Hollow Hills', cls: 'summoner', companion: 'night_shade', stats: GLASS,
          text: 'Empties every barrow at once: a whole forgotten people marches out behind them.',
          lore: 'The Hollow Hills opened for this one and have not properly shut since. When they call, a forgotten people comes out in rusted bronze, under banners nobody can read, and fights for a town they would not recognise. Afterwards the Host walks them home and closes the turf over them like a blanket.',
          skill: ['the_hills_empty', 'The Hills Empty', A(36, [summon('wraith'), summon('grave_ghost'), summon('night_shade'), hit(1.8, 'dark', 'foes')])],
          lean: { wis: 0.25, cha: 0.2, vit: 0.1 }, emblem: { main: ['Hat', 27] },
          asc: ['king_under_the_barrow', 'King under the Barrow'],
        },
        {
          id: 'bell_of_the_drowned', name: 'Bell of the Drowned', cls: 'summoner', companion: 'flying_skull', stats: GLASS,
          text: 'Rings for the dead of the river and the sea, and they rise dripping to answer.',
          lore: 'Everyone who ever drowned within a day\'s walk is theirs to call, and the river has had a great many. The Bell rings a little iron bell, and the foe hears it in their teeth. Fishermen will not take a Bell of the Drowned out in a boat, and are right not to.',
          skill: ['toll_for_them', 'Toll for Them', A(26, [hit(1.0, 'sound', 'random_foes', 3), inflict('stun', 2, 'foes', 0.4), summon('flying_skull')])],
          lean: { wis: 0.25, cha: 0.15, int: 0.15 }, emblem: { main: ['Music', 30] },
          asc: ['the_tolling_deep', 'The Tolling Deep'],
        },
      ]],
      [{
        id: 'caller_of_the_high_lamps', name: 'Caller of the High Lamps', cls: 'summoner', companion: 'spirit', stats: GLASS,
        text: 'Follows the dead upward: the souls that went to the stars come down when they are called.',
        lore: 'The old folk say the dead go up and become the lamps in the sky, and the Caller of the High Lamps has checked. They spend clear nights on the roof naming them. In a fight the light comes down in a column, and something in it remembers the town.',
        skill: ['lamplight_kin', 'Lamplight Kin', P({ power: 0.2, healing: 0.1, resist: 0.08 })],
        lean: { wis: 0.25, int: 0.2, cha: 0.1 }, emblem: { main: ['Light', 6], charge: ['Magic', 12] },
      }, [
        {
          id: 'choir_of_falling_stars', name: 'Choir of Falling Stars', cls: 'summoner', companion: 'fire_elemental', stats: GLASS,
          text: 'Calls the stars down whole, burning, onto the foe.',
          lore: 'A star the Choir calls arrives the short way, which is straight down and on fire. The children count the marks in the meadow afterwards and wish on them. The foe does not get to wish on anything.',
          skill: ['starfall_hymn', 'Starfall Hymn', A(30, [hit(1.6, 'holy', 'random_foes', 2), summon('fire_elemental')])],
          lean: { wis: 0.25, int: 0.2, cha: 0.1 }, emblem: { main: ['Magic', 40] },
          asc: ['herald_of_the_last_star', 'Herald of the Last Star'],
        },
        {
          id: 'moonwarden', name: 'Moonwarden', cls: 'summoner', companion: 'ice_golem', stats: GLASS,
          text: 'Calls the cold patient light of the moon to stand guard over the living.',
          lore: 'The moon has a guardian of white ice that walks behind the Moonwarden on bright nights, and a fight is always a bright night when they are in it. Wounds close under that light, and blows that ought to land go wide. The Moonwarden sleeps all day and nobody minds.',
          skill: ['under_the_white_moon', 'Under the White Moon', P({ power: 0.25, guard: 0.15, hp: 0.15, resist: 0.15, regen: 0.04 })],
          lean: { wis: 0.3, vit: 0.15, cha: 0.1 }, emblem: { main: ['Ring', 33] },
          asc: ['the_moons_own', 'The Moon\'s Own'],
        },
      ]],
    ]],
  ],
};

const DRAGON_BLOODED: MythicTree = {
  colours: { fill: '#8c1c13', dark: '#3d0905', light: '#ffc46b' },
  fork: '{name} has started sleeping in the forge with the fire banked high, and the smith has stopped asking why. The scales have spread from their hands up their arms, and their breath steams on warm days. Dragon-blood wants two things in the end, the sky or the hoard; the old blood in them has not yet decided which.',
  born: 'A Dragon Knight is born in {town}: {name} wakes with scales on their hands and fire in their throat.',
  title: 'the Dragon-marked',
  base: {
    id: 'dragon_blooded', name: 'Dragon-blooded', cls: 'dragoon',
    text: 'Somewhere up the family tree a dragon took a bride, and it has finally come out in them.',
    lore: 'The Dragon-blooded run hot: they eat for three and sleep in their shirts in midwinter. They take to the lance as if they had been waiting for it, and when they shout at a foe the foe\'s eyebrows go.',
    skill: ['scalded_breath', 'Scalded Breath', A(28, [hit(1.5, 'fire'), grant('protect', 5, 'self')])],
    lean: { str: 0.25, vit: 0.2, cha: 0.1 }, emblem: { main: ['LongWep', 44], charge: ['Magic', 3] }, behind: ['LongWep', 20], form: 'hk_demon', arms: 'pl',
  },
  roads: [
    [{
      id: 'wyrm_lancer', name: 'Wyrm Lancer', cls: 'dragoon', arms: 'sp',
      text: 'Leaps like a dragon stoops: high, then all at once, and burning.',
      lore: 'The Wyrm Lancer jumps higher than anyone has a right to and comes down point-first and smoking. They learned it from the barn roof, which needs mending. Raiders who saw it once will tell you they mostly remember the shadow.',
      skill: ['stooping_wyrm', 'Stooping Wyrm', A(18, [hit(1.6, 'fire'), grant('haste', 4)])],
      lean: { str: 0.25, dex: 0.2, vit: 0.1 }, emblem: { main: ['LongWep', 26], charge: ['Magic', 3] },
    }, [
      [{
        id: 'skyfall_knight', name: 'Skyfall Knight', cls: 'dragoon',
        text: 'Falls on the foe from the sky and leaves the ground burning round them.',
        lore: 'The Skyfall Knight lands in the middle of the foe and the grass catches for a yard all round. They stand up out of the smoke with their shield already raised. The fire brigade has a standing arrangement with them.',
        skill: ['ring_of_cinders', 'Ring of Cinders', A(22, [hit(1.0, 'fire', 'foes', 2), inflict('burn', 5, 'foes', 0.6), grant('shield', 4)])],
        lean: { str: 0.25, vit: 0.15, dex: 0.15 }, emblem: { main: ['Shield', 5], charge: ['Magic', 3] },
      }, [
        {
          id: 'knight_of_the_burning_sky', name: 'Knight of the Burning Sky', cls: 'dragoon',
          text: 'Dives through the foe\'s ranks again and again, and the sky behind them is red.',
          lore: 'On the day a Knight of the Burning Sky rides out the sunset comes early. They go up, they come down, they go up again, and each time the foe is fewer and smaller and more on fire. Their horse has been replaced with something that has wings, and nobody has asked where it came from.',
          skill: ['red_sky', 'Red Sky', A(30, [hit(1.6, 'fire', 'foes', 2), inflict('stun', 2, 'foes', 0.4)])],
          lean: { str: 0.25, dex: 0.2, cha: 0.1 }, emblem: { main: ['LongWep', 50] },
          asc: ['lord_of_the_burning_sky', 'Lord of the Burning Sky'],
        },
        {
          id: 'drakeshield', name: 'Drakeshield', cls: 'guardian',
          text: 'Scales from neck to heel: blows skid off, and fire is only warmth.',
          lore: 'The scales came all the way in for the Drakeshield, and now arrows bounce off their cheeks. They stand at the gate in the worst of it and let the raid break on them like weather. What hits them comes back hotter.',
          skill: ['wyrmscale_hide', 'Wyrmscale Hide', P({ armor: 0.2, block: 0.15, thorns: 0.15, resist: 0.15, hp: 0.12 })],
          lean: { vit: 0.3, str: 0.2, wis: 0.05 }, emblem: { main: ['Armor', 60] },
          asc: ['the_unburnt_wall', 'The Unburnt Wall'],
        },
      ]],
      [{
        id: 'hoard_warden', name: 'Hoard-warden', cls: 'dragoon',
        text: 'Has the dragon\'s eye for the soft place in the armour, and the gold behind it.',
        lore: 'The Hoard-warden can tell you to the penny what is in your purse without looking. In a fight the same eye finds the loose plate and the bad knee. They keep a chest under the bed and count it on Sundays.',
        skill: ['gold_sense', 'Gold Sense', P({ crit: 0.12, critDamage: 0.15, damage: 0.1 })],
        lean: { dex: 0.2, str: 0.2, int: 0.15 }, emblem: { main: ['Money', 40] },
      }, [
        {
          id: 'goldscale', name: 'Goldscale', cls: 'dragoon',
          text: 'Picks out the one foe worth killing and puts a lance through the exact spot.',
          lore: 'The Goldscale\'s scales have gone the colour of old coin. They pick the richest, proudest foe on the field, walk up to them through everything, and take them apart with a jeweller\'s care. They keep the rings.',
          skill: ['the_one_worth_taking', 'The One Worth Taking', A(26, [hit(2.6, 'physical'), inflict('vulnerable', 6), grant('focus', 6)])],
          lean: { dex: 0.25, str: 0.2, cha: 0.1 }, emblem: { main: ['Money', 52], charge: ['Ring', 9] },
          asc: ['wyrm_king_of_the_hoard', 'Wyrm-King of the Hoard'],
        },
        {
          id: 'ember_tongue', name: 'Ember-tongue', cls: 'dragoon',
          text: 'Breathes fire at last: a long rolling gout of it, and drinks the heat back.',
          lore: 'One winter the cough turned into a flame, and the Ember-tongue has not needed a tinderbox since. Their breath rolls across a whole line of foes, and the warmth that comes back off the burning feeds them. They have to be careful who they sigh at.',
          skill: ['dragons_breath', 'Dragon\'s Breath', A(28, [hit(1.4, 'fire', 'foes', 2), drain(0.4, 'fire')])],
          lean: { str: 0.2, vit: 0.2, int: 0.15 }, emblem: { main: ['Magic', 6] },
          asc: ['mouth_of_the_mountain', 'Mouth of the Mountain'],
        },
      ]],
    ]],
    [{
      id: 'wyrmheart', name: 'Wyrmheart', cls: 'blood_knight', form: 'hk_ogre_horned', arms: 'gs',
      text: 'The dragon is in the blood and the temper: grows bigger, angrier and harder to kill.',
      lore: 'The Wyrmheart has grown a head taller in a year and broken two doorframes. The dragon in them wants to fight and does not much mind getting hurt. Cut them and the blood steams.',
      skill: ['hot_blood', 'Hot Blood', P({ hp: 0.08, lifesteal: 0.05, lastStand: 0.07 })],
      lean: { str: 0.3, vit: 0.2, cha: 0.05 }, emblem: { main: ['Potion', 31], charge: ['Magic', 3] },
    }, [
      [{
        id: 'wyrmrage', name: 'Wyrmrage', cls: 'blood_knight',
        text: 'Lets the dragon all the way out: a great blade, a roar and no thought of the cost.',
        lore: 'When the Wyrmrage loses their temper it is lost for good, and the field knows it. They swing a sword nobody else can lift, and roar until the windows rattle. Afterwards they are very sorry, and eat a whole sheep.',
        skill: ['the_dragon_wakes', 'The Dragon Wakes', A(24, [grant('berserk', 8), hit(2.0, 'fire')])],
        lean: { str: 0.3, vit: 0.2, dex: 0.05 }, emblem: { main: ['LongWep', 10] },
      }, [
        {
          id: 'cinderwrath', name: 'Cinderwrath', cls: 'blood_knight',
          text: 'Burns through the foe like a dragon through a village, and every wound it gives heals it.',
          lore: 'The Cinderwrath goes through a raid the way the old dragons went through towns, which the town finds a little close to home. Every cut they give closes one of theirs. They come back black with soot and quite unhurt.',
          skill: ['the_burning_of_the_towns', 'The Burning of the Towns', A(34, [hit(1.5, 'fire', 'foes', 2), grant('berserk', 8), grant('lifelink', 8)])],
          lean: { str: 0.3, vit: 0.2, cha: 0.05 }, emblem: { main: ['LongWep', 14], charge: ['Magic', 6] },
          asc: ['wrath_of_the_old_wyrm', 'Wrath of the Old Wyrm'],
        },
        {
          id: 'dragon_hearted', name: 'Dragon-hearted', cls: 'blood_knight',
          text: 'A dragon\'s heart beats in them: wounds that would kill three men only make them angry.',
          lore: 'The surgeon listened to the Dragon-hearted\'s chest once and went home early. Their heart beats slow and enormous, and it does not stop for spears. The worse it goes for them, the worse it goes for whoever did it.',
          skill: ['the_great_slow_heart', 'The Great Slow Heart', P({ hp: 0.2, regen: 0.05, lifesteal: 0.15, lastStand: 0.2, resist: 0.1 })],
          lean: { vit: 0.3, str: 0.25 }, emblem: { main: ['Amulet', 4] },
          asc: ['heart_of_the_last_dragon', 'Heart of the Last Dragon'],
        },
      ]],
      [{
        id: 'wyrm_shepherd', name: 'Wyrm-shepherd', cls: 'beast_tamer', companion: 'drake',
        text: 'The drakes know their own blood: one follows them about like a dog.',
        lore: 'A drake came down off the moor one spring and has not left the Wyrm-shepherd\'s side since. It eats the town\'s rats and the occasional goat. In a fight it remembers whose kin it is, and the others take heart from it.',
        skill: ['kin_of_the_drakes', 'Kin of the Drakes', A(26, [summon('drake'), grant('inspired', 6, 'allies')])],
        lean: { cha: 0.25, vit: 0.15, wis: 0.15 }, emblem: { main: ['Tool', 19], charge: ['Magic', 3] },
      }, [
        {
          id: 'brood_keeper', name: 'Brood Keeper', cls: 'beast_tamer', companion: 'drake',
          text: 'Raises a whole clutch: drakes on every rooftop, and imps scuttling behind them.',
          lore: 'The Brood Keeper\'s eggs sit in the bakery oven, which the baker agreed to before she knew how many. Now there are drakes on every roof and a smell of sulphur on wash day. When the raid comes, the roofs empty.',
          skill: ['the_clutch_takes_wing', 'The Clutch Takes Wing', A(40, [summon('drake'), summon('drake'), summon('red_imp'), inflict('burn', 4, 'foes', 0.5)])],
          lean: { cha: 0.25, wis: 0.2, vit: 0.1 }, emblem: { main: ['Potion', 9] },
          asc: ['elder_of_the_brood', 'Elder of the Brood'],
        },
        {
          id: 'wyrm_speaker', name: 'Wyrm-speaker', cls: 'beast_tamer',
          text: 'Speaks the dragons\' own tongue: foes stop to listen, and that is the end of them.',
          lore: 'The dragons\' tongue is all hiss and gravel, and the Wyrm-speaker talks it in their sleep. Spoken at a foe, it turns their legs to water and their loyalty inside out. Spoken over the town\'s own, it makes them stand like stone.',
          skill: ['the_old_tongue', 'The Old Tongue', A(30, [inflict('charm', 4, 'foe', 0.6), hit(2.2, 'fire'), grant('protect', 6, 'allies')])],
          lean: { cha: 0.3, int: 0.15, wis: 0.1 }, emblem: { main: ['Book', 61] },
          asc: ['voice_of_the_elder_wyrms', 'Voice of the Elder Wyrms'],
        },
      ]],
    ]],
  ],
};

const FATE_TOUCHED: MythicTree = {
  colours: { fill: '#1c5f6e', dark: '#082a31', light: '#c8f4ea' },
  fork: '{name} said the bridge would go, and the bridge went, and now the whole town looks at them sideways at supper. The future comes to them in two ways: as threads to be read and cut, or as a stare that turns what it sees to stone. Whichever they take, they already know how it ends, and will not say.',
  born: 'An oracle is born in {town}: {name} cries before the thunder every time, and is never once wrong.',
  title: 'the Far-sighted',
  base: {
    id: 'fate_touched', name: 'Fate-touched', cls: 'chronomancer',
    text: 'Sees a little way ahead of everyone else: the blow before it lands, the rain before it falls.',
    lore: 'The Fate-touched step out of the way of the cart before the horse shies. They are hard to surprise and very hard to play cards with. Small children find them restful and grown-ups find them unbearable.',
    skill: ['a_step_ahead', 'A Step Ahead', P({ dodge: 0.1, crit: 0.08, accuracy: 0.05, firstStrike: true })],
    lean: { wis: 0.25, int: 0.2, dex: 0.1 }, emblem: { main: ['Scroll', 33], charge: ['Magic', 21] }, behind: ['Wand', 12], form: 'gorgon_3', arms: 'st',
  },
  roads: [
    [{
      id: 'seer_of_threads', name: 'Seer of Threads', cls: 'chronomancer',
      text: 'Sees every life as a thread, and the foe\'s ones as short and fraying.',
      lore: 'The Seer of Threads looks at you and sees how long you have, and is polite about it. In a fight they see the foe\'s threads too, and pull. Everything near them goes a beat slower than it meant to.',
      skill: ['pull_the_thread', 'Pull the Thread', A(16, [inflict('slow', 5, 'foes', 0.7), hit(1.3, 'time')])],
      lean: { wis: 0.25, int: 0.2, dex: 0.05 }, emblem: { main: ['Tool', 21] },
    }, [
      [{
        id: 'thread_cutter', name: 'Thread-cutter', cls: 'chronomancer',
        text: 'Carries small silver shears, and cuts the foe\'s thread short.',
        lore: 'The Thread-cutter\'s shears are no bigger than a seamstress\'s, and they never seem to touch anything. A foe they snip at feels their time run out and knows it. The tailor will not lend them anything.',
        skill: ['snip', 'Snip', A(24, [inflict('doom', 8, 'foe', 0.5), hit(1.8, 'time')])],
        lean: { int: 0.25, wis: 0.2, dex: 0.1 }, emblem: { main: ['ShortWep', 37] },
      }, [
        {
          id: 'unspinner', name: 'Unspinner', cls: 'chronomancer',
          text: 'Unwinds whole fights: the foe stops where they stand, and comes apart.',
          lore: 'The Unspinner takes hold of a moment and winds it back onto the spool. Foes stand frozen mid-stride while the rest of the world gets on without them. When they start again, they start a good deal worse off.',
          skill: ['back_on_the_spool', 'Back on the Spool', A(36, [inflict('stop', 4, 'foes', 0.5), hit(1.5, 'time', 'foes', 2)])],
          lean: { int: 0.3, wis: 0.2, dex: 0.05 }, emblem: { main: ['Magic', 24] },
          asc: ['last_of_the_fates', 'Last of the Fates'],
        },
        {
          id: 'weaver_of_ends', name: 'Weaver of Ends', cls: 'chronomancer',
          text: 'Knows how every fight ends, and makes sure it ends that way.',
          lore: 'The Weaver of Ends has already seen the end of this fight, and the foe is not in it. Every strike lands where the foe will be, not where they are. They hum while they do it, a tune nobody has written yet.',
          skill: ['the_pattern_holds', 'The Pattern Holds', P({ power: 0.25, crit: 0.15, critDamage: 0.2, accuracy: 0.15 })],
          lean: { wis: 0.3, int: 0.2, cha: 0.05 }, emblem: { main: ['Book', 55] },
          asc: ['the_loom_itself', 'The Loom Itself'],
        },
      ]],
      [{
        id: 'omen_reader', name: 'Omen-reader', cls: 'white_mage',
        text: 'Reads the birds, the smoke and the cracks in the ice: the party is never where the blow falls.',
        lore: 'The Omen-reader takes the long way home when the crows fly left, and it is always the right call. They tell the party where to stand and what to drink before it is needed. Bad news they give gently, which is most of the time.',
        skill: ['the_crows_said', 'The Crows Said', P({ dodge: 0.12, healing: 0.12, resist: 0.12 })],
        lean: { wis: 0.3, cha: 0.15, vit: 0.1 }, emblem: { main: ['Hat', 14], charge: ['Magic', 21] },
      }, [
        {
          id: 'voice_of_the_well', name: 'Voice of the Well', cls: 'white_mage',
          text: 'Speaks for the old well under the hill: what it foresees, it also mends.',
          lore: 'There is a well under the hill older than the hill, and it talks to this one. Water drawn from it while they speak closes wounds and washes off curses. The well asks only to be listened to, and they listen.',
          skill: ['well_water', 'Well Water', A(30, [heal(1.6, 'allies'), grant('protect', 6, 'allies'), cleanse('allies')])],
          lean: { wis: 0.3, vit: 0.15, cha: 0.1 }, emblem: { main: ['Potion', 21] },
          asc: ['the_well_at_the_worlds_root', 'The Well at the World\'s Root'],
        },
        {
          id: 'foreteller', name: 'Foreteller', cls: 'white_mage',
          text: 'Said who would fall before the fight began, and so was ready to bring them back.',
          lore: 'The Foreteller tells you on the walk out that you will fall at the ford, and they are already kneeling there when you do. Curses meant for the party slide off and go back where they came from. They say they hate being right; they are bad at hiding that they do not.',
          skill: ['as_it_was_told', 'As It Was Told', A(28, [revive(0.5), grant('reflect', 6, 'allies'), dispel('foes')])],
          lean: { wis: 0.3, int: 0.15, cha: 0.1 }, emblem: { main: ['Scroll', 40] },
          asc: ['speaker_of_the_unwritten', 'Speaker of the Unwritten'],
        },
      ]],
    ]],
    [{
      id: 'stone_eyed', name: 'Stone-eyed', cls: 'witch', form: 'gorgon_2', arms: 'wd',
      text: 'Sees too much: what they look at hard enough stops moving.',
      lore: 'Their eyes went grey the year the visions got worse, and now what they stare at goes still and cold. They wear a veil to market and take it off at the gate. The town\'s cats will not meet their eye, and the cats are right.',
      skill: ['a_hard_look', 'A Hard Look', A(20, [inflict('stun', 2, 'foe'), hit(1.4, 'earth')])],
      lean: { wis: 0.25, int: 0.15, cha: 0.15 }, emblem: { main: ['Amulet', 20] },
    }, [
      [{
        id: 'veiled_seer', name: 'Veiled Seer', cls: 'witch',
        text: 'Lifts the veil for a breath, and the whole front rank goes cold and grey.',
        lore: 'The Veiled Seer keeps the veil down for everyone\'s sake. In a fight they lift it, just for a breath, and the foes in front stiffen like washing in a frost. Then down it goes again, and they apologise to nobody in particular.',
        skill: ['lift_the_veil', 'Lift the Veil', A(24, [inflict('freeze', 3, 'foes', 0.5), hit(1.6, 'earth', 'foes')])],
        lean: { wis: 0.25, int: 0.2, cha: 0.1 }, emblem: { main: ['Armor', 66] },
      }, [
        {
          id: 'gaze_of_stone', name: 'Gaze of Stone', cls: 'witch',
          text: 'One long look, and the raid is a garden of statues.',
          lore: 'There is a field past the gate full of raiders who met the Gaze of Stone and stayed. The children climb them. The Gaze does not lift the veil at all any more except for this, and goes and sits alone afterwards.',
          skill: ['the_stone_garden', 'The Stone Garden', A(34, [inflict('stop', 5, 'foes', 0.6), hit(2.2, 'earth', 'foes'), inflict('weak', 6, 'foes')])],
          lean: { wis: 0.3, int: 0.2, cha: 0.05 }, emblem: { main: ['Magic', 15] },
          asc: ['keeper_of_the_stone_garden', 'Keeper of the Stone Garden'],
        },
        {
          id: 'mirror_sighted', name: 'Mirror-sighted', cls: 'witch',
          text: 'Sees every blow coming in a polished shield, and sends it back.',
          lore: 'The Mirror-sighted watch the fight in a disc of polished bronze, never straight on. They see the blow coming before it is thrown, and step aside, and the blow goes home somewhere else. Usually in whoever threw it.',
          skill: ['in_the_bronze', 'In the Bronze', P({ dodge: 0.2, thorns: 0.2, resist: 0.2, counter: 0.15 })],
          lean: { dex: 0.25, wis: 0.25, int: 0.05 }, emblem: { main: ['Shield', 7] },
          asc: ['the_unlooked_at', 'The Unlooked-at'],
        },
      ]],
      [{
        id: 'doom_sayer', name: 'Doom-sayer', cls: 'witch',
        text: 'Tells the foe exactly how they will die, and the telling does half the work.',
        lore: 'The Doom-sayer stands on the wall and tells each raider their death in plain words, by name. Some of them turn round and go home. The rest come on knowing, and that is worse for them.',
        skill: ['your_name_and_your_death', 'Your Name and Your Death', A(22, [inflict('doom', 10, 'foe', 0.6), inflict('fear', 4, 'foes', 0.5), drain(1.4, 'dark')])],
        lean: { cha: 0.25, wis: 0.25, int: 0.05 }, emblem: { main: ['Scroll', 8] },
      }, [
        {
          id: 'prophet_of_ruin', name: 'Prophet of Ruin', cls: 'witch',
          text: 'Foretells the end of whole armies, and the end comes on time.',
          lore: 'The Prophet of Ruin speaks of the fall of whole hosts as if reading out the market prices. The host falls, more or less on the hour. They have stopped being invited to weddings.',
          skill: ['the_hour_is_come', 'The Hour Is Come', A(36, [inflict('doom', 10, 'foes', 0.4), hit(2.4, 'dark', 'foes')])],
          lean: { wis: 0.3, cha: 0.2, int: 0.05 }, emblem: { main: ['Book', 13] },
          asc: ['the_last_prophecy', 'The Last Prophecy'],
        },
        {
          id: 'unheeded', name: 'Unheeded', cls: 'witch',
          text: 'Warned them all, and nobody listened; fights hardest when it all comes true.',
          lore: 'The Unheeded told the town about every raid and every flood, and was thanked for none of it. When it comes true they are already armed and at the wall, furious. The nearer the end, the less there is to stop them.',
          skill: ['i_did_tell_you', 'I Did Tell You', P({ power: 0.3, lastStand: 0.25, crit: 0.15, resist: 0.1 })],
          lean: { wis: 0.25, cha: 0.15, vit: 0.15 }, emblem: { main: ['Hat', 9] },
          asc: ['the_one_who_was_right', 'The One Who Was Right'],
        },
      ]],
    ]],
  ],
};

const TWICE_BURIED: MythicTree = {
  colours: { fill: '#3e4a3a', dark: '#141a12', light: '#d9e6b8' },
  fork: '{name} has been killed now, as far as anyone can count, three times, and has come home three times for supper. Death does not know what to do with them. They can make a warrior of it, someone who is not afraid of the blow because the blow does not stick; or they can learn what the grave knows, and bring others back with them.',
  born: 'Something unnatural is born in {town}: {name} was laid out for burial at dawn, and sat up before the grave was dug.',
  title: 'the Deathless',
  base: {
    id: 'twice_buried', name: 'Twice-buried', cls: 'warrior',
    text: 'Died, and did not stay that way: the grave let them go, and they would rather not discuss it.',
    lore: 'The Twice-buried have a faint smell of turned earth and no fear of anything sharp. The gravedigger crosses the road when he sees them. They sleep very soundly, which their families find hard to watch.',
    skill: ['the_grave_let_go', 'The Grave Let Go', P({ hp: 0.08, lastStand: 0.12, regen: 0.03 })],
    lean: { vit: 0.3, str: 0.2, wis: 0.05 }, emblem: { main: ['Tool', 7], charge: ['Amulet', 2] }, behind: ['LongWep', 3], form: 'hk_tyrant', arms: 'gs',
  },
  roads: [
    [{
      id: 'grave_risen', name: 'Grave-risen', cls: 'blood_knight',
      text: 'Fights like someone who has already lost the worst thing, and drinks the foe\'s life to keep going.',
      lore: 'The Grave-risen came back hungry, and what they hunger for is the warmth in other people. In a fight they take it from the foe a cut at a time. Their hands are always cold, even in August.',
      skill: ['cold_hands', 'Cold Hands', A(20, [drain(1.5, 'blood'), grant('lifelink', 6)])],
      lean: { vit: 0.25, str: 0.25, wis: 0.05 }, emblem: { main: ['Potion', 34] },
    }, [
      [{
        id: 'bone_oath', name: 'Bone-oath', cls: 'blood_knight',
        text: 'Swore on their own grave never to lie in it, and the oath holds.',
        lore: 'The Bone-oath carries a finger-bone from their own first burial on a cord round their neck. While it is there they will not lie down for long. Every wound they take, they collect on.',
        skill: ['sworn_on_the_grave', 'Sworn on the Grave', P({ lifesteal: 0.12, hp: 0.12, lastStand: 0.12 })],
        lean: { vit: 0.3, str: 0.2, wis: 0.05 }, emblem: { main: ['Amulet', 9] },
      }, [
        {
          id: 'the_unburied', name: 'The Unburied', cls: 'blood_knight',
          text: 'Cannot be put in the ground: cut down, they stand; struck through, they mend.',
          lore: 'The town has tried, kindly, to bury the Unburied on two occasions, and both times they climbed out and asked what was for dinner. Wounds shut on them as you watch. Raiders have learned to recognise them and go round.',
          skill: ['no_grave_will_hold', 'No Grave Will Hold', P({ hp: 0.2, regen: 0.06, lifesteal: 0.15, lastStand: 0.25, resist: 0.1 })],
          lean: { vit: 0.35, str: 0.2 }, emblem: { main: ['Armor', 46] },
          asc: ['the_graves_refusal', 'The Grave\'s Refusal'],
        },
        {
          id: 'coffin_breaker', name: 'Coffin-breaker', cls: 'blood_knight',
          text: 'Smashes out of the box and through everyone near it, and comes out bloodier and stronger.',
          lore: 'The Coffin-breaker went into the ground in a good oak box and came out through the lid. They fight the same way: straight through whatever is in front, splinters and all. What they spill, they drink.',
          skill: ['through_the_lid', 'Through the Lid', A(30, [hit(1.6, 'blood', 'foes', 2), grant('lifelink', 8), inflict('bleed', 5, 'foes', 0.6)])],
          lean: { str: 0.3, vit: 0.25 }, emblem: { main: ['Tool', 15] },
          asc: ['lord_of_the_broken_coffins', 'Lord of the Broken Coffins'],
        },
      ]],
      [{
        id: 'ashen_revenant', name: 'Ashen Revenant', cls: 'warrior',
        text: 'Came back for someone in particular, and will keep coming back until it is done.',
        lore: 'The Ashen Revenant was killed by a raider, and remembers the face. Every foe looks a little like it now. They stand in front and draw every blade to them, which is what they want.',
        skill: ['i_remember_you', 'I Remember You', A(24, [hit(2.0, 'dark'), inflict('fear', 4, 'foes', 0.4), grant('taunt', 4)])],
        lean: { str: 0.25, vit: 0.25, cha: 0.05 }, emblem: { main: ['MedWep', 12] },
      }, [
        {
          id: 'vengeance_unending', name: 'Vengeance Unending', cls: 'warrior',
          text: 'Hunts one foe at a time to the end of the world and past it.',
          lore: 'Death was only an interruption to Vengeance Unending\'s grudge. They mark one foe and nothing else on the field exists after that. The marked know it, and run, and it does not help.',
          skill: ['the_debt_comes_due', 'The Debt Comes Due', A(32, [hit(2.6, 'dark'), inflict('doom', 8, 'foe', 0.5), grant('berserk', 6)])],
          lean: { str: 0.3, vit: 0.2, dex: 0.05 }, emblem: { main: ['LongWep', 6] },
          asc: ['the_debt_never_paid', 'The Debt Never Paid'],
        },
        {
          id: 'ironbone_sentinel', name: 'Ironbone Sentinel', cls: 'guardian',
          text: 'Stands at the gate dead or alive, and nothing gets past either way.',
          lore: 'The Ironbone Sentinel stood at the gate through a raid that killed them, and was still standing at the end of it. They have been standing there more or less ever since. Their bones have gone dark and hard as iron, and blows ring off them.',
          skill: ['still_standing', 'Still Standing', P({ armor: 0.2, guard: 0.2, block: 0.12, thorns: 0.15, hp: 0.1 })],
          lean: { vit: 0.35, str: 0.15, wis: 0.05 }, emblem: { main: ['Shield', 3] },
          asc: ['the_wall_that_will_not_fall', 'The Wall That Will Not Fall'],
        },
      ]],
    ]],
    [{
      id: 'lich_born', name: 'Lich-born', cls: 'necromancer', arms: 'wd',
      text: 'Brought something back from the grave with them: the knack of bringing others.',
      lore: 'Whatever the Lich-born saw while they were dead, they took notes. Now the town\'s dead rise when they whistle, and the foe\'s warmth goes cold in their hands. Their own reflection is getting fainter, and they are not worried.',
      skill: ['what_i_learned_below', 'What I Learned Below', A(18, [summon('zombie'), drain(1.3, 'dark')])],
      lean: { int: 0.25, wis: 0.2, vit: 0.1 }, emblem: { main: ['Book', 44] },
    }, [
      [{
        id: 'phylactery_keeper', name: 'Phylactery-keeper', cls: 'necromancer',
        text: 'Keeps their life in a jar somewhere safe, and fights as though they have nothing to lose.',
        lore: 'Nobody knows where the Phylactery-keeper hid the jar, and they mean to keep it that way. With their life out of reach, they fight carelessly and call the dead in pairs. They check the hiding place every full moon.',
        skill: ['somewhere_safe', 'Somewhere Safe', A(26, [summon('zombie'), summon('flying_skull'), grant('shield', 6)])],
        lean: { int: 0.3, wis: 0.15, vit: 0.1 }, emblem: { main: ['Potion', 2] },
      }, [
        {
          id: 'keeper_of_the_black_jar', name: 'Keeper of the Black Jar', cls: 'necromancer',
          text: 'Opens the jar a crack, and what comes out is very large and very hungry.',
          lore: 'The Black Jar holds more than one life now, and some of them were never people. The Keeper loosens the stopper and the field fills with stitched things and screaming. The jar is warm to the touch, and getting warmer.',
          skill: ['loosen_the_stopper', 'Loosen the Stopper', A(36, [summon('abomination'), summon('wraith'), hit(1.8, 'dark', 'foes')])],
          lean: { int: 0.3, wis: 0.2, vit: 0.05 }, emblem: { main: ['Potion', 38] },
          asc: ['the_jarred_heart', 'The Jarred Heart'],
        },
        {
          id: 'ever_returning', name: 'Ever-returning', cls: 'necromancer',
          text: 'Shares the trick: the party\'s fallen get up again, as they once did.',
          lore: 'The Ever-returning cannot stay dead, and has learned to lend the knack to others. Friends who fall near them stand up again, blinking and offended. It does not always take, and nobody asks what they have to give the grave in return.',
          skill: ['not_today', 'Not Today', A(40, [revive(0.8), revive(0.8), grant('regen', 8, 'allies')])],
          lean: { wis: 0.3, int: 0.2, cha: 0.05 }, emblem: { main: ['Amulet', 13] },
          asc: ['master_of_the_second_dawn', 'Master of the Second Dawn'],
        },
      ]],
      [{
        id: 'grave_chill', name: 'Grave-chill', cls: 'necromancer',
        text: 'Brought the cold of the grave back with them, and lets it out on the foe.',
        lore: 'There is frost on the Grave-chill\'s windowsill in June. When they open their hand in a fight the grave\'s cold pours out, and foes slow and stiffen in it. They are lovely company in a heatwave.',
        skill: ['earth_six_feet_down', 'Earth Six Feet Down', A(22, [hit(1.8, 'ice', 'foes'), inflict('freeze', 2, 'foes', 0.4)])],
        lean: { int: 0.3, wis: 0.15, vit: 0.1 }, emblem: { main: ['Wand', 26] },
      }, [
        {
          id: 'winter_of_bones', name: 'Winter of Bones', cls: 'necromancer',
          text: 'Brings a winter with them that the dead walk about in.',
          lore: 'Where the Winter of Bones stands it is January, and the snow is full of things that were people. A shape of white ice walks beside them. Spring comes back after, a little hesitant.',
          skill: ['the_long_frost', 'The Long Frost', A(34, [hit(1.5, 'ice', 'foes', 2), inflict('slow', 6, 'foes'), summon('ice_golem')])],
          lean: { int: 0.3, wis: 0.15, vit: 0.1 }, emblem: { main: ['Magic', 9] },
          asc: ['the_long_winter_below', 'The Long Winter Below'],
        },
        {
          id: 'bone_choir', name: 'Bone-choir', cls: 'necromancer',
          text: 'Sings with the voices of the dead: the foe falls silent, and the living take heart.',
          lore: 'The Bone-choir sings in a dozen voices at once, none of them their own. Foes who hear it forget how to speak, then how to stand. To the town\'s ears the same song sounds like every grandmother they ever had.',
          skill: ['the_dead_sing', 'The Dead Sing', A(30, [inflict('silence', 5, 'foes', 0.6), drain(2.4, 'dark'), grant('inspired', 6, 'allies')])],
          lean: { cha: 0.25, int: 0.2, wis: 0.1 }, emblem: { main: ['Music', 41] },
          asc: ['conductor_of_the_dead', 'Conductor of the Dead'],
        },
      ]],
    ]],
  ],
};

const DOORBORN: MythicTree = {
  colours: { fill: '#26408f', dark: '#0d1640', light: '#ffe08a' },
  fork: 'Doors do not always open onto the same room for {name}. Last week the woodshed opened onto a beach under two suns, and they came back with sand in their boots and a new scar. They can learn the doors themselves, the gates and the maze between them; or they can learn the time that runs differently on the other side.',
  born: 'A worldwalker is born in {town}: {name} walked through the cellar door and came out of the well, three days later and not a day older.',
  title: 'the Door-walker',
  base: {
    id: 'doorborn', name: 'Doorborn', cls: 'spellblade',
    text: 'Born on a threshold: doors open for them onto places that are not behind the door.',
    lore: 'The midwife delivered the Doorborn in a doorway, and they have been going through the wrong ones ever since. They turn up in the middle of a fight from nowhere, which is useful, and in the middle of the night in the wrong house, which is less so.',
    skill: ['through_the_wrong_door', 'Through the Wrong Door', A(26, [hit(1.5, 'arcane'), grant('invisible', 3)])],
    lean: { dex: 0.2, int: 0.2, wis: 0.15 }, emblem: { main: ['Tool', 1], charge: ['Magic', 42] }, behind: ['MedWep', 8], form: 'minotaur_3', arms: 'sw',
  },
  roads: [
    [{
      id: 'gatewright', name: 'Gatewright', cls: 'spellblade',
      text: 'Cuts a door in the air with their sword, and steps through it behind the foe.',
      lore: 'The Gatewright draws a doorway in the air with the point of their blade and walks through. The foe turns round to find them gone, and then finds them again. Carpenters bring them odd jobs.',
      skill: ['a_door_in_the_air', 'A Door in the Air', A(18, [hit(1.6, 'arcane'), inflict('slow', 4, 'foe')])],
      lean: { dex: 0.25, int: 0.2, str: 0.05 }, emblem: { main: ['MedWep', 5] },
    }, [
      [{
        id: 'maze_runner', name: 'Maze-runner', cls: 'spellblade',
        text: 'Has walked the maze between the worlds and learned every turning.',
        lore: 'Between every door and the place it opens onto there is a labyrinth, and the Maze-runner has been lost in it more times than they admit. They came out quick, and hard to pin down. The bull at the centre knows their name.',
        skill: ['every_turning', 'Every Turning', P({ dodge: 0.15, speed: 0.12, crit: 0.1 })],
        lean: { dex: 0.3, int: 0.15, wis: 0.1 }, emblem: { main: ['Scroll', 27] },
      }, [
        {
          id: 'heart_of_the_labyrinth', name: 'Heart of the Labyrinth', cls: 'spellblade',
          text: 'Reached the centre of the maze and took the bull\'s place: in a fight, the foe is the one lost.',
          lore: 'At the heart of the maze between the worlds there was a bull-headed thing, and now there is this one. Foes who come at them find the field has more corners than it had. Every wrong turn costs them.',
          skill: ['the_centre_holds', 'The Centre Holds', P({ dodge: 0.2, counter: 0.2, speed: 0.15, critDamage: 0.25 })],
          lean: { dex: 0.3, str: 0.15, wis: 0.1 }, emblem: { main: ['Amulet', 22] },
          asc: ['lord_of_the_labyrinth', 'Lord of the Labyrinth'],
        },
        {
          id: 'corner_turner', name: 'Corner-turner', cls: 'spellblade',
          text: 'Steps round a corner that is not there and strikes from three directions at once.',
          lore: 'The Corner-turner finds corners in open fields. They step round one and strike, and step round another and strike again, and the foe cannot see them for the edges. Their friends have learned not to play hide and seek with them.',
          skill: ['round_the_corner', 'Round the Corner', A(28, [hit(1.6, 'arcane', 'random_foes', 2), grant('invisible', 3), inflict('blind', 4, 'foes', 0.5)])],
          lean: { dex: 0.3, int: 0.2, cha: 0.05 }, emblem: { main: ['ShortWep', 29] },
          asc: ['the_wrong_turn', 'The Wrong Turn'],
        },
      ]],
      [{
        id: 'rift_knight', name: 'Rift-knight', cls: 'spellblade',
        text: 'Slashes rifts in the world; spells and wards fall through them and are gone.',
        lore: 'Where the Rift-knight\'s sword passes there is a thin black line in the air for a moment, and things fall into it. Mostly the foe\'s wards and blessings, sometimes a hat. They keep the edge very clean.',
        skill: ['the_world_tears', 'The World Tears', A(22, [hit(1.9, 'arcane'), dispel('foe'), grant('shield', 4)])],
        lean: { str: 0.2, int: 0.2, dex: 0.15 }, emblem: { main: ['LongWep', 39] },
      }, [
        {
          id: 'breaker_of_seals', name: 'Breaker of Seals', cls: 'spellblade',
          text: 'Breaks the seals between worlds: the sky cracks open over the foe.',
          lore: 'Some doors were shut on purpose, and the Breaker of Seals has a key for all of them. They crack one open over the foe and the other side leaks through. They shut it again afterwards; mostly.',
          skill: ['the_seal_breaks', 'The Seal Breaks', A(32, [hit(2.4, 'arcane', 'foes'), dispel('foes'), inflict('vulnerable', 6, 'foes', 0.6)])],
          lean: { int: 0.3, str: 0.15, dex: 0.1 }, emblem: { main: ['Scroll', 46] },
          asc: ['the_opened_sky', 'The Opened Sky'],
        },
        {
          id: 'warden_of_thresholds', name: 'Warden of Thresholds', cls: 'guardian',
          text: 'Stands in the doorway between worlds, and nothing comes through that they do not let through.',
          lore: 'Every door they ever opened, the Warden of Thresholds also has to guard, and they take it seriously. They stand in the gap and the gap holds. Things from the other side have learned to knock.',
          skill: ['none_shall_pass_the_door', 'None Shall Pass the Door', P({ guard: 0.2, resist: 0.2, armor: 0.15, block: 0.15, hp: 0.1 })],
          lean: { vit: 0.3, str: 0.15, wis: 0.1 }, emblem: { main: ['Shield', 6] },
          asc: ['keeper_of_every_door', 'Keeper of Every Door'],
        },
      ]],
    ]],
    [{
      id: 'timeslipped', name: 'Timeslipped', cls: 'chronomancer',
      text: 'Came back through the wrong door at the wrong time: time runs oddly round them since.',
      lore: 'The Timeslipped went through a door one autumn and came back the spring before. Now time stretches and folds round them, and their own hours run quicker than everyone else\'s. Their tea goes cold too fast.',
      skill: ['the_wrong_hour', 'The Wrong Hour', A(18, [grant('haste', 5), hit(1.5, 'time')])],
      lean: { int: 0.25, dex: 0.2, wis: 0.1 }, emblem: { main: ['Tool', 12] },
    }, [
      [{
        id: 'hour_thief', name: 'Hour-thief', cls: 'chronomancer',
        text: 'Steals hours from the foe and hands them out to friends.',
        lore: 'The Hour-thief takes a moment off the foe the way a pickpocket takes a purse, and the foe stands there missing it. The stolen time goes to the party, who find they have more of it than they ought. Nobody knows where the thief keeps the rest.',
        skill: ['pocketed_hours', 'Pocketed Hours', A(24, [inflict('stop', 3, 'foe', 0.6), grant('haste', 6, 'allies'), hit(1.4, 'time')])],
        lean: { dex: 0.25, int: 0.2, cha: 0.1 }, emblem: { main: ['Money', 21] },
      }, [
        {
          id: 'walker_of_lost_days', name: 'Walker of Lost Days', cls: 'chronomancer',
          text: 'Walks in the days that fell out of the calendar, and brings the party with them.',
          lore: 'There are days that never happened, and the Walker of Lost Days has spent years in them. In a fight they open one, and the party have a whole quiet afternoon to get ready in while the foe waits a heartbeat. Then they strike.',
          skill: ['an_afternoon_nobody_had', 'An Afternoon Nobody Had', A(34, [grant('haste', 8, 'allies'), grant('focus', 8, 'allies'), hit(2.2, 'time', 'random_foes')])],
          lean: { int: 0.25, wis: 0.2, dex: 0.1 }, emblem: { main: ['Book', 29] },
          asc: ['the_day_that_never_was', 'The Day That Never Was'],
        },
        {
          id: 'echo_of_tomorrow', name: 'Echo of Tomorrow', cls: 'chronomancer',
          text: 'Half of them is already in tomorrow, and always strikes first.',
          lore: 'The Echo of Tomorrow is a little ahead of themselves: you see them do a thing, and then they do it. In a fight they have already moved before anyone else thinks to. They are sometimes found at the door before the knock.',
          skill: ['already_there', 'Already There', P({ speed: 0.2, power: 0.2, dodge: 0.15, accuracy: 0.15, crit: 0.1, firstStrike: true })],
          lean: { dex: 0.3, int: 0.2, wis: 0.05 }, emblem: { main: ['Ring', 41] },
          asc: ['tomorrows_shadow', 'Tomorrow\'s Shadow'],
        },
      ]],
      [{
        id: 'stranger_from_elsewhere', name: 'Stranger from Elsewhere', cls: 'monk',
        text: 'Has been so long through the doors that they fight in a way nobody here taught them.',
        lore: 'The Stranger from Elsewhere spent ten years somewhere else in what was a fortnight here. They came back with an odd way of standing, an odder way of fighting and a taste for food nobody can cook. Blows meant for them land on empty air.',
        skill: ['other_worlds_ways', 'Other Worlds\' Ways', P({ dodge: 0.12, counter: 0.12, resist: 0.12 })],
        lean: { dex: 0.25, wis: 0.2, vit: 0.1 }, emblem: { main: ['Hat', 20] },
      }, [
        {
          id: 'worldwalker', name: 'Worldwalker', cls: 'monk',
          text: 'Walks between worlds at will, and sometimes brings something big back with them.',
          lore: 'The Worldwalker goes through a door and comes back with whatever was on the other side, which is sometimes a friend. On a bad day it is a beast the size of a barn, and it fights for them. They are not entirely sure where they live any more.',
          skill: ['what_came_back_with_me', 'What Came Back With Me', A(30, [hit(1.6, 'arcane', 'foes', 2), summon('behemoth')])],
          lean: { dex: 0.25, wis: 0.2, str: 0.1 }, emblem: { main: ['Scroll', 15] },
          asc: ['walker_of_all_worlds', 'Walker of All Worlds'],
        },
        {
          id: 'one_who_came_back', name: 'One Who Came Back', cls: 'monk',
          text: 'Came home at last from all the worlds, and brought the way home for others.',
          lore: 'The One Who Came Back has decided this is the world they are staying in, and has unpacked. They know the way home from anywhere, and can lead a hurt friend back from the edge of it. Curses do not travel well, and they leave them at the door.',
          skill: ['the_way_home', 'The Way Home', A(28, [heal(1.4, 'allies'), cleanse('allies'), grant('reflect', 6, 'allies')])],
          lean: { wis: 0.3, vit: 0.15, dex: 0.1 }, emblem: { main: ['Light', 1] },
          asc: ['the_homecoming', 'The Homecoming'],
        },
      ]],
    ]],
  ],
};

export const MYTHIC_TREES: readonly MythicTree[] = [PACT_BORN, DRAGON_BLOODED, FATE_TOUCHED, TWICE_BURIED, DOORBORN];

/** The Wanderer's second stage-1 road, now the Summoner has gone up to the mythic callings: the spirits of the land and
 *  the old ways across it (the Druid road keeps the green and the beast-shapes). */
export const WANDERER_ROAD: Road1 = [{
  id: 'spirit_wayfarer', name: 'Spirit Wayfarer', cls: 'shaman',
  text: 'Walks with the spirits of the land: the ones in the stones, the springs and the old tracks.',
  lore: 'The Spirit Wayfarer says good morning to the standing stone and waits for an answer. The spirits of the land walk beside them on the road and lend a hand in a fight. They are never lost, and never in a hurry.',
  skill: ['company_on_the_road', 'Company on the Road', A(16, [hit(1.4, 'nature'), grant('regen', 6, 'allies')])],
  lean: { wis: 0.25, vit: 0.15, dex: 0.1 }, emblem: { main: ['Amulet', 15] },
}, [
  [{
    id: 'waymaker', name: 'Waymaker', cls: 'ranger',
    text: 'Knows the old ways across the land, the ones the spirits made: always first there, never caught.',
    lore: 'The old tracks are older than the roads and shorter, if you know how to find them. The Waymaker does, and turns up at the fight before the foe has got their boots on. They mark the ways with little cairns nobody else notices.',
    skill: ['the_short_way', 'The Short Way', P({ accuracy: 0.1, dodge: 0.12, speed: 0.1 })],
    lean: { dex: 0.25, wis: 0.2, vit: 0.05 }, emblem: { main: ['Tool', 22] },
  }, [
    {
      id: 'ley_tracer', name: 'Ley-tracer', cls: 'shaman',
      text: 'Follows the lines of power under the land, and stamps on them: the ground rises against the foe.',
      lore: 'The Ley-tracer walks the hidden lines from stone to stone with a hazel rod and bare feet. Where two lines cross they can wake the land itself, and the earth heaves under the foe. The farmers ask them where to dig wells.',
      skill: ['the_land_wakes', 'The Land Wakes', A(28, [hit(2.2, 'earth', 'foes'), inflict('slow', 5, 'foes', 0.6)])],
      lean: { wis: 0.3, int: 0.15, vit: 0.1 }, emblem: { main: ['Wand', 3] },
      asc: ['keeper_of_the_leylines', 'Keeper of the Leylines'],
    },
    {
      id: 'pathfinder_of_the_old_ways', name: 'Pathfinder of the Old Ways', cls: 'ranger',
      text: 'Has walked every old way there is: strikes first, from the place nobody thought to watch.',
      lore: 'There is no corner of the land the Pathfinder of the Old Ways has not walked, and the land remembers them. They come at the foe out of a hollow nobody knew was there. Their arrows go where the wind tells them to.',
      skill: ['the_way_nobody_watched', 'The Way Nobody Watched', P({ accuracy: 0.15, crit: 0.15, dodge: 0.15, critDamage: 0.2, firstStrike: true })],
      lean: { dex: 0.3, wis: 0.2, vit: 0.05 }, emblem: { main: ['Ammo', 30] },
      asc: ['walker_of_the_first_road', 'Walker of the First Road'],
    },
  ]],
  [{
    id: 'ancestor_speaker', name: 'Ancestor-speaker', cls: 'shaman',
    text: 'Speaks with the spirits of those who walked the land before: they watch over the party.',
    lore: 'The Ancestor-speaker burns sweet grass at the old fire-rings and listens to whoever is still sitting round them. The old ones keep an eye on the living, and turn aside a blow now and then. They do not like being kept waiting.',
    skill: ['the_old_ones_watch', 'The Old Ones Watch', A(22, [heal(1.4, 'allies'), grant('protect', 5, 'allies'), cleanse('weakest')])],
    lean: { wis: 0.3, cha: 0.15, vit: 0.05 }, emblem: { main: ['Light', 5] },
  }, [
    {
      id: 'totem_keeper', name: 'Totem Keeper', cls: 'shaman',
      text: 'Raises the totem of the land\'s spirits: its wolf runs with the party and its voice lifts them.',
      lore: 'The Totem Keeper carves a pole for each spirit that will speak to them, and the wolf spirit spoke first. When they plant the totem in a fight, the wolf comes off it and runs, and the party stand straighter. It takes a week to carve and a heartbeat to plant.',
      skill: ['plant_the_totem', 'Plant the Totem', A(30, [summon('companion_wolf'), grant('inspired', 8, 'allies'), hit(1.6, 'nature', 'foes')])],
      lean: { wis: 0.25, cha: 0.2, str: 0.05 }, emblem: { main: ['Tool', 18] },
      asc: ['the_standing_totem', 'The Standing Totem'],
    },
    {
      id: 'dreamhunter', name: 'Dreamhunter', cls: 'hunter',
      text: 'Hunts in dreams as well as on the land: the foe sleeps, and the hunter is waiting there.',
      lore: 'The spirits taught the Dreamhunter to follow game into its sleep. They do the same to the foe now, and the foe dreams of a hunter and wakes up wounded, or does not wake. They sleep in the afternoons with their bow strung.',
      skill: ['into_their_sleep', 'Into Their Sleep', A(26, [hit(2.3, 'nature'), inflict('sleep', 4, 'foes', 0.4)])],
      lean: { dex: 0.25, wis: 0.25, vit: 0.05 }, emblem: { main: ['Ammo', 12] },
      asc: ['hunter_in_the_dream', 'Hunter in the Dream'],
    },
  ]],
]];
