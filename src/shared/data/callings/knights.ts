// The knights' own base callings (data/originCallings.ts; the shape in ./kit.ts). The Exiled Order's three: the
// Squire-at-Arms (the lists and the line), the Herald (the rolls, the trumpets and the road between the Order and
// everyone else) and the Chaplain (the vows and the Order's faith, carried to the sick or into the charge). They lean
// on the Order's code (sim/chivalry.ts): vows, tournaments, the liege's call and the Grail.

import { A, P, cleanse, grant, heal, hit, inflict, revive, type CallingTree } from './kit';

const SQUIRE: CallingTree = {
  origin: 'knights',
  colours: { fill: '#3b5b8c', dark: '#1f3152', light: '#c9d6ea' },
  fork: 'The old knight\'s armour has been polished so often that {name} can see their own face in it, and this morning they buckled every strap of it without being told the order. A squire who knows the straps is a squire about to be something else. The lists are calling, and so is the plain hard work of the line.',
  base: {
    id: 'squire_at_arms', name: 'Squire-at-Arms', cls: 'warrior',
    text: 'Carries the lance, minds the horse, and learns the trade of arms one bruise at a time.',
    lore: 'In exile the Order cannot afford pages, so every squire is also the cook, the farrier and the spare sword. They polish armour that is not theirs yet, and sleep in it more often than they ought to.',
    skill: ['strap_and_buckle', 'Strap and Buckle', P({ hp: 0.05, armor: 0.03, guard: 0.04 })],
    lean: { str: 0.2, vit: 0.15, wis: 0.1 }, emblem: { main: ['Armor', 8] }, behind: ['MedWep', 3], form: 'knight_1', arms: 'sw',
  },
  roads: [
    [{
      id: 'tourney_rider', name: 'Tourney Rider', cls: 'dragoon', form: 'knight_2', arms: 'sp',
      text: 'Rides at the weekly tournament and has the scars to prove it: a lance aimed at a single point.',
      lore: 'The Order\'s tournaments are the only feasts an exile can afford, and the Tourney Rider means to win every one. They have learned that a lance broken on a shield is a point and a lance through it is a funeral, and they have stopped aiming for the shield.',
      skill: ['first_tilt', 'First Tilt', A(16, [hit(1.6), inflict('stun', 1, 'foe', 0.3)])],
      lean: { str: 0.2, dex: 0.2, cha: 0.1 }, emblem: { main: ['LongWep', 26] },
    }, [
      [{
        id: 'jouster', name: 'Jouster', cls: 'dragoon',
        text: 'Unhorses the foe in one pass and turns for the next before they land.',
        lore: 'A Jouster counts the passes, not the blows. They come down the field in a straight line, the foe goes over the back of a horse that is not there, and by the time anyone looks round they have turned at the end of the lists and are coming again.',
        skill: ['unhorse', 'Unhorse', A(18, [hit(1.9), inflict('vulnerable', 5, 'foe', 0.7)])],
        lean: { str: 0.25, dex: 0.2, vit: 0.1 }, emblem: { main: ['LongWep', 30], charge: ['Shield', 2] },
      }, [
        {
          id: 'champion_of_the_lists', name: 'Champion of the Lists', cls: 'dragoon',
          text: 'Has won the tournament so often that the visiting knights now come only to lose to them.',
          lore: 'The Champion of the Lists has a shelf of prizes and a body of old breaks that ache in the rain. Raiders are not visiting knights and keep no rules, which the Champion finds restful: no herald, no bow to the gallery, just the charge.',
          skill: ['the_crowd_roars', 'The Crowd Roars', A(20, [hit(2.4), grant('inspired', 8, 'allies')])],
          lean: { str: 0.25, dex: 0.15, cha: 0.15 }, emblem: { main: ['Amulet', 10] },
          asc: ['king_of_the_tourney', 'King of the Tourney'],
        },
        {
          id: 'lance_breaker', name: 'Lance Breaker', cls: 'dragoon',
          text: 'Breaks lances, shields and the foes behind them, three at a pass.',
          lore: 'The armourers keep a pile of splintered ash for the Lance Breaker, who goes through a dozen a tournament and does not slow down for the changing. Their charge goes through the first rank into the second, and the third rank generally decides to be somewhere else.',
          skill: ['splintering_pass', 'Splintering Pass', A(22, [hit(1.9, 'physical', 'foes'), inflict('stun', 2, 'foes', 0.35)])],
          lean: { str: 0.3, vit: 0.15, dex: 0.1 }, emblem: { main: ['LongWep', 34] },
          asc: ['the_shattering_lance', 'The Shattering Lance'],
        },
      ]],
      [{
        id: 'hedge_knight', name: 'Hedge Knight', cls: 'knight', form: 'knight_3', arms: 'sw',
        text: 'A knight with no lands and no lord: sleeps under hedges and fights for whoever is in the right.',
        lore: 'Exile made every knight of the Order a hedge knight for a while, and some of them liked it. They mend their own mail, eat what the road gives, and have a better sense than any lord of what a sword is for.',
        skill: ['roadworn', 'Roadworn', P({ hp: 0.12, resist: 0.08, regen: 0.02, dodge: 0.03 })],
        lean: { vit: 0.2, str: 0.15, wis: 0.15 }, emblem: { main: ['Armor', 24], charge: ['Tool', 4] },
      }, [
        {
          id: 'questing_knight', name: 'Questing Knight', cls: 'knight',
          text: 'Rides out after what the Order has lost, and comes back with more than they went for.',
          lore: 'A Questing Knight is sent after a relic, a rumour or a lost brother and comes home months later thinner, quieter and carrying something nobody asked for, usually a dragon\'s tooth. The Grail is the quest they all pretend they are not on.',
          skill: ['the_long_road_home', 'The Long Road Home', P({ hp: 0.15, damage: 0.12, resist: 0.1, regen: 0.03, lastStand: 0.1 })],
          lean: { vit: 0.2, str: 0.15, wis: 0.2 }, emblem: { main: ['Scroll', 20] },
          asc: ['knight_of_the_long_road', 'Knight of the Long Road'],
        },
        {
          id: 'knight_disinherited', name: 'Knight Disinherited', cls: 'knight',
          text: 'Stripped of a name and a hall in the exile, and fighting to win both back.',
          lore: 'They carry a blank shield, because the arms they were born to were struck from the rolls the year the Order was driven out. The Knight Disinherited fights like someone with a debt to collect, and the town has noticed that they never miss a liege\'s call.',
          skill: ['blank_shield', 'Blank Shield', A(24, [hit(2.2), grant('shield', 6), grant('taunt', 5)])],
          lean: { str: 0.25, vit: 0.2, cha: 0.1 }, emblem: { main: ['Shield', 0] },
          asc: ['the_lord_returned', 'The Lord Returned'],
        },
      ]],
    ]],
    [{
      id: 'man_at_arms', name: 'Man-at-Arms', cls: 'warrior', arms: 'pl',
      text: 'The Order\'s foot soldier: a halberd, a helmet, and a place in the line.',
      lore: 'Not every exile was a knight; most were the men and women who walked behind them. The Man-at-Arms does the unglamorous work of a battle, which is most of it, and is usually still standing when the knights are counting their horses.',
      skill: ['in_the_line', 'In the Line', P({ guard: 0.08, armor: 0.03, damage: 0.05 })],
      lean: { str: 0.2, vit: 0.2, dex: 0.05 }, emblem: { main: ['LongWep', 10] },
    }, [
      [{
        id: 'halberdier', name: 'Halberdier', cls: 'warrior',
        text: 'Hooks riders off horses and raiders off walls, then makes sure they stay down.',
        lore: 'The halberd is an axe, a spear and a hook, and the Halberdier uses all three in the time it takes a raider to choose which to fear. They hold the gap in the wall where the horses cannot go.',
        skill: ['hook_and_cleave', 'Hook and Cleave', A(16, [hit(1.8), inflict('weak', 5, 'foe', 0.6)])],
        lean: { str: 0.25, vit: 0.15, dex: 0.1 }, emblem: { main: ['LongWep', 14] },
      }, [
        {
          id: 'pike_sergeant', name: 'Pike Sergeant', cls: 'warrior',
          text: 'Drills the foot into a hedge of points that no horse will face.',
          lore: 'The Pike Sergeant shouts the same four words all morning on the drill yard and the same four in battle, and the second time the square closes like a fist. Anything that charges it learns what the drill was for.',
          skill: ['close_the_square', 'Close the Square', A(30, [grant('protect', 8, 'allies'), grant('thorns', 8, 'allies'), hit(1.6, 'physical', 'foes')])],
          lean: { str: 0.2, vit: 0.15, cha: 0.15 }, emblem: { main: ['LongWep', 38] },
          asc: ['captain_of_the_square', 'Captain of the Square'],
        },
        {
          id: 'poleaxe_master', name: 'Poleaxe Master', cls: 'warrior',
          text: 'One long weapon, both hands, and no plate made that turns it.',
          lore: 'The poleaxe was made for one purpose, which is opening knights, and the Poleaxe Master was an exile before they were anything else and has views on knights. They fight in slow circles and finish things with one blow.',
          skill: ['plate_splitter', 'Plate Splitter', P({ damage: 0.2, pierce: 0.25, crit: 0.08, critDamage: 0.15 })],
          lean: { str: 0.35, dex: 0.1, vit: 0.1 }, emblem: { main: ['LongWep', 44] },
          asc: ['the_headsman', 'The Headsman'],
        },
      ]],
      [{
        id: 'banneret', name: 'Banneret', cls: 'knight', form: 'knight_2',
        text: 'Has earned a square banner and the right to lead others under it.',
        lore: 'A Banneret\'s pennon was cut square on the field for valour, which is how the Order says "you are in charge now". The Order has few banners left, and the ones it has are carried by people who do not drop them.',
        skill: ['square_banner', 'Square Banner', A(28, [grant('inspired', 8, 'allies'), grant('protect', 6, 'allies'), hit(1.4)])],
        lean: { str: 0.15, vit: 0.15, cha: 0.2 }, emblem: { main: ['Hat', 12], charge: ['Music', 12] },
      }, [
        {
          id: 'standard_bearer', name: 'Standard-Bearer', cls: 'knight',
          text: 'Carries the Order\'s standard into the press; while it stands, so does everyone.',
          lore: 'The Order\'s standard was carried out of the old country on a broken pole and has never touched the ground since. The Standard-Bearer would rather die than lower it, and has to be reminded fairly often that this is a figure of speech.',
          skill: ['the_standard_stands', 'The Standard Stands', P({ guard: 0.2, hp: 0.15, lastStand: 0.15, resist: 0.1 })],
          lean: { vit: 0.25, cha: 0.2, str: 0.1 }, emblem: { main: ['LongWep', 52] },
          asc: ['the_oriflamme', 'The Oriflamme'],
        },
        {
          id: 'liegeman', name: 'Liegeman', cls: 'knight',
          text: 'Answers the liege lord\'s every call, and comes back with gold and stories.',
          lore: 'When the liege\'s messenger comes to the gate, the Liegeman is already saddled. They have fought in more of other people\'s wars than anyone in the town, and come home from each with the pay, a new scar and a fresh grudge against somebody\'s cousin.',
          skill: ['answer_the_call', 'Answer the Call', A(26, [hit(2.3), inflict('fear', 4, 'foe', 0.5), grant('haste', 5)])],
          lean: { str: 0.25, vit: 0.15, cha: 0.1 }, emblem: { main: ['Money', 8] },
          asc: ['hand_of_the_liege', 'Hand of the Liege'],
        },
      ]],
    ]],
  ],
};

const HERALD: CallingTree = {
  origin: 'knights',
  colours: { fill: '#a8322d', dark: '#5e1715', light: '#f0c75e' },
  fork: '{name} has the arms of every house in the old country by heart, and at the last tournament they called the lists so well that the visiting knights asked who they served. A herald goes wherever the Order needs a voice. That may be the lists and the rolls, or the long road between the Order and everyone else.',
  base: {
    id: 'herald', name: 'Herald', cls: 'bard',
    text: 'Calls the lists, reads the arms, and carries the Order\'s word under a flag of truce.',
    lore: 'Heralds are sworn not to fight, which the Order\'s heralds read narrowly. They know every blazon, every pedigree and every grudge, and can make a line of tired exiles stand up straight with one blast of a horn.',
    skill: ['blazon', 'Blazon', P({ accuracy: 0.05, speed: 0.03, crit: 0.03 })],
    lean: { cha: 0.25, wis: 0.1, dex: 0.1 }, emblem: { main: ['Music', 20] }, behind: ['LongWep', 24], form: 'samurai_commander', arms: 'sp',
  },
  roads: [
    [{
      id: 'pursuivant', name: 'Pursuivant', cls: 'bard',
      text: 'A junior herald who keeps the Order\'s rolls and reads a foe\'s arms for its weak places.',
      lore: 'The Pursuivant keeps the rolls: who swore what vow, who kept it, who is owed and who owes. A foe\'s shield tells them almost as much, and they will shout across the field which side the raider favours.',
      skill: ['read_the_arms', 'Read the Arms', A(14, [inflict('vulnerable', 6, 'foe', 0.9), hit(1.3, 'sound')])],
      lean: { int: 0.15, wis: 0.15, cha: 0.2 }, emblem: { main: ['Book', 12] },
    }, [
      [{
        id: 'blazoner', name: 'Blazoner', cls: 'bard',
        text: 'Knows every device and sigil, and every weakness that goes with them.',
        lore: 'The Blazoner can tell you the colours of a house that died out three hundred years ago, and why. On the field they name each foe aloud as it comes on, and the naming seems to take something out of it.',
        skill: ['named_and_known', 'Named and Known', A(18, [inflict('vulnerable', 6, 'foes', 0.7), inflict('weak', 5, 'foes', 0.5), hit(1.5, 'sound')])],
        lean: { int: 0.25, cha: 0.2, wis: 0.1 }, emblem: { main: ['Book', 30] },
      }, [
        {
          id: 'keeper_of_the_rolls', name: 'Keeper of the Rolls', cls: 'bard',
          text: 'Keeps the Order\'s great roll of honour, and every name on it fights a little harder.',
          lore: 'Every vow kept, every knighthood and every disgrace goes into the Keeper\'s roll in a hand nobody else can read. Townsfolk fight differently when they know the Keeper is watching, and the Keeper is always watching.',
          skill: ['writ_of_honour', 'Writ of Honour', A(30, [grant('inspired', 10, 'allies'), grant('focus', 8, 'allies'), grant('protect', 6, 'allies')])],
          lean: { int: 0.2, wis: 0.2, cha: 0.15 }, emblem: { main: ['Scroll', 30] },
          asc: ['king_of_arms', 'King of Arms'],
        },
        {
          id: 'remembrancer', name: 'Remembrancer', cls: 'bard',
          text: 'Speaks the names of the Order\'s dead, and the dead seem to listen.',
          lore: 'When the Order buries one of its own the Remembrancer reads the whole list again, from the first of the founders to the newest grave. Raiders who hear it in battle say the air goes cold, and the exiles say that is the point.',
          skill: ['roll_of_the_fallen', 'Roll of the Fallen', A(28, [hit(2, 'holy', 'foes'), inflict('fear', 5, 'foes', 0.5), revive(0.25)])],
          lean: { wis: 0.25, cha: 0.2, int: 0.1 }, emblem: { main: ['Book', 50] },
          asc: ['voice_of_the_honoured_dead', 'Voice of the Honoured Dead'],
        },
      ]],
      [{
        id: 'crier_of_the_lists', name: 'Crier of the Lists', cls: 'bard',
        text: 'Runs the weekly tournament: the trumpets, the rules, and the lances in the right order.',
        lore: 'The Crier\'s voice carries across a tournament field and a battlefield alike, and their trumpet means the same on both: begin. Fighters under it start faster and strike in time.',
        skill: ['let_them_go', 'Let Them Go!', A(24, [grant('haste', 6, 'allies'), grant('inspired', 6, 'allies'), hit(1.6, 'sound')])],
        lean: { cha: 0.3, dex: 0.1, vit: 0.1 }, emblem: { main: ['Music', 24] },
      }, [
        {
          id: 'master_of_the_lists', name: 'Master of the Lists', cls: 'bard',
          text: 'Every fight is a tournament they are judging, and the town always wins on points.',
          lore: 'The Master of the Lists has seen every trick a jouster knows and scored them all. In a raid they call the fight as it happens, and the townsfolk find they are fighting by the rules of a contest they are winning.',
          skill: ['by_the_rules', 'By the Rules', P({ accuracy: 0.12, crit: 0.1, speed: 0.08, counter: 0.1, block: 0.08 })],
          lean: { cha: 0.25, wis: 0.15, dex: 0.1 }, emblem: { main: ['Money', 52] },
          asc: ['lord_of_tourneys', 'Lord of Tourneys'],
        },
        {
          id: 'trumpeter_of_the_van', name: 'Trumpeter of the Van', cls: 'bard',
          text: 'Blows the charge, and the sound itself goes ahead of the knights like a lance.',
          lore: 'The Order\'s old trumpets were melted for coin in the exile; the Trumpeter blows one made from a cooking pot and a length of pipe, and it is somehow louder. The blast staggers raiders before the charge arrives.',
          skill: ['sound_the_charge', 'Sound the Charge', A(26, [hit(2.2, 'sound', 'foes'), inflict('stun', 2, 'foes', 0.4), grant('haste', 6, 'allies')])],
          lean: { cha: 0.25, vit: 0.15, str: 0.1 }, emblem: { main: ['Music', 32] },
          asc: ['the_last_trumpet', 'The Last Trumpet'],
        },
      ]],
    ]],
    [{
      id: 'outrider', name: 'Outrider', cls: 'ranger', form: 'samurai_archer', arms: 'bw',
      text: 'Rides ahead of the Order with the news and a bow, and gets back with both.',
      lore: 'A herald\'s word is only as good as the horse that carries it. The Outrider learns the roads, the fords and the safe barns, and shoots well from the saddle, because the roads are not safe and the news is rarely good.',
      skill: ['ride_ahead', 'Ride Ahead', P({ speed: 0.08, dodge: 0.05, accuracy: 0.04, firstStrike: true })],
      lean: { dex: 0.25, vit: 0.1, wis: 0.1 }, emblem: { main: ['Ammo', 12] },
    }, [
      [{
        id: 'lieges_courier', name: 'Liege\'s Courier', cls: 'ranger',
        text: 'Carries the liege lord\'s summons and the Order\'s answer, through anything.',
        lore: 'The Liege\'s Courier has ridden through raids, floods and one wedding to deliver a letter on time. They do not stop for anything, and they shoot whatever tries to stop them.',
        skill: ['through_anything', 'Through Anything', A(16, [hit(1, 'physical', 'foe', 2), grant('haste', 5)])],
        lean: { dex: 0.25, vit: 0.15, wis: 0.1 }, emblem: { main: ['Scroll', 2] },
      }, [
        {
          id: 'hard_rider', name: 'Hard Rider', cls: 'ranger',
          text: 'Never stops: arrows from the saddle, and gone before the answer comes.',
          lore: 'The Hard Rider sleeps in the saddle and eats in it too. Raiders who chase one find themselves strung out along a road full of arrows, with the rider wheeling back for another pass.',
          skill: ['saddle_volley', 'Saddle Volley', A(18, [hit(0.9, 'physical', 'random_foes', 3), inflict('slow', 4, 'foes', 0.4)])],
          lean: { dex: 0.3, vit: 0.15, str: 0.05 }, emblem: { main: ['Ammo', 28] },
          asc: ['rider_of_the_last_message', 'Rider of the Last Message'],
        },
        {
          id: 'signal_archer', name: 'Signal Archer', cls: 'archer',
          text: 'Looses burning arrows that mark the foe for everyone else to aim at.',
          lore: 'Heralds once spoke across valleys with flags; the Signal Archer does it with fire. One burning shaft in a raider\'s shield and every bow in the town knows where to look.',
          skill: ['beacon_shaft', 'Beacon Shaft', A(16, [hit(2.1, 'fire'), inflict('burn', 5, 'foe', 0.8), inflict('vulnerable', 6, 'foe', 0.8)])],
          lean: { dex: 0.3, wis: 0.15, int: 0.05 }, emblem: { main: ['Ammo', 40] },
          asc: ['arrow_of_tidings', 'Arrow of Tidings'],
        },
      ]],
      [{
        id: 'envoy_of_the_order', name: 'Envoy of the Order', cls: 'bard', form: 'doll', arms: 'dg',
        text: 'Speaks for the Order at foreign courts, and is very hard to say no to.',
        lore: 'An exiled Order lives on other people\'s goodwill, and the Envoy is how it gets it. They have the manners of a court, the patience of a siege, and a dagger they have so far never needed to mention.',
        skill: ['parley', 'Parley', A(22, [inflict('charm', 4, 'foe', 0.6), inflict('weak', 6, 'foes', 0.5), hit(1.4, 'sound')])],
        lean: { cha: 0.3, wis: 0.15, int: 0.1 }, emblem: { main: ['Ring', 6] },
      }, [
        {
          id: 'silver_tongue', name: 'Silver Tongue', cls: 'bard',
          text: 'Talks raiders out of the fight, and now and then into fighting each other.',
          lore: 'The Silver Tongue once persuaded a bandit captain that his lieutenant was plotting against him, from the far side of a wall, in the dark. The lieutenant was not, but by morning it did not matter.',
          skill: ['sow_doubt', 'Sow Doubt', A(30, [inflict('charm', 6, 'foes', 0.4), inflict('fear', 5, 'foes', 0.4), hit(1.6, 'sound', 'foes')])],
          lean: { cha: 0.35, int: 0.15, wis: 0.1 }, emblem: { main: ['Ring', 20] },
          asc: ['voice_of_kings', 'Voice of Kings'],
        },
        {
          id: 'herald_of_defiance', name: 'Herald of Defiance', cls: 'knight', form: 'knight_3', arms: 'sw',
          text: 'Throws down the Order\'s gauntlet: every foe on the field comes for them, and regrets it.',
          lore: 'Some messages are not meant to be answered politely. The Herald of Defiance rides to the raiders\' line, reads the Order\'s challenge aloud and throws a steel glove at their leader\'s feet, then holds the gap while everyone who took offence tries to get through.',
          skill: ['gauntlet_down', 'Gauntlet Down', A(24, [grant('taunt', 6), grant('protect', 6), grant('thorns', 6), hit(1.8)])],
          lean: { vit: 0.25, cha: 0.2, str: 0.1 }, emblem: { main: ['Armor', 40] },
          asc: ['the_gauntlet_thrown', 'The Gauntlet Thrown'],
        },
      ]],
    ]],
  ],
};

const CHAPLAIN: CallingTree = {
  origin: 'knights',
  colours: { fill: '#5d4a7a', dark: '#2e2340', light: '#ddd2ec' },
  fork: '{name} has heard more confessions on the drill yard than in the chapel, and blessed more blades than loaves. The Order\'s faith went into exile with it, and somebody has to carry it. They can carry it to the sick and the sworn, or into the line beside the lances.',
  base: {
    id: 'chaplain', name: 'Chaplain', cls: 'white_mage',
    text: 'The Order\'s priest: blesses the arms, hears the vows, and mends what the fighting breaks.',
    lore: 'An exiled Order has no cathedral, only a Chaplain and an altar that folds into a saddlebag. They say mass on the drill yard, hear vows at the gate, and carry a mace because the rule forbids them an edge and says nothing about weight.',
    skill: ['blessed_arms', 'Blessed Arms', P({ healing: 0.06, resist: 0.04 })],
    lean: { wis: 0.25, vit: 0.1, cha: 0.1 }, emblem: { main: ['Amulet', 6] }, behind: ['MedWep', 10], form: 'wanderer_mage', arms: 'mc',
  },
  roads: [
    [{
      id: 'confessor', name: 'Confessor', cls: 'white_mage',
      text: 'Hears the vows sworn and the vows broken, and lifts the weight of both.',
      lore: 'Every vow in the Order is sworn before the Confessor, and every broken one confessed to them. They know the town better than anyone and say less about it, and a word from them steadies a shaking hand.',
      skill: ['absolution', 'Absolution', A(18, [heal(1, 'weakest'), cleanse('weakest')])],
      lean: { wis: 0.3, cha: 0.15 }, emblem: { main: ['Book', 4] },
    }, [
      [{
        id: 'vow_warden', name: 'Vow-Warden', cls: 'white_mage',
        text: 'Holds the sworn to their vows, and the vows hold them up in turn.',
        lore: 'The Vow-Warden keeps the register of who has sworn what and checks on them weekly, kindly and without mercy. Those who keep their vows under the Warden\'s eye find the vow keeping them: the sworn fight on past where they should fall.',
        skill: ['oath_bound', 'Oath-Bound', A(26, [grant('protect', 8, 'allies'), grant('regen', 8, 'allies'), heal(0.7, 'allies')])],
        lean: { wis: 0.3, cha: 0.15, vit: 0.1 }, emblem: { main: ['Scroll', 14] },
      }, [
        {
          id: 'keeper_of_oaths', name: 'Keeper of Oaths', cls: 'white_mage',
          text: 'No vow sworn near them is broken, and none who keep one fall for long.',
          lore: 'The Keeper of Oaths has kept every vow the Order has, all at once, for years, and it shows in the face. When they raise a hand over the line, the sworn get up from wounds that should have kept them down.',
          skill: ['unbroken_word', 'Unbroken Word', A(40, [revive(0.4), heal(1, 'allies'), grant('shield', 6, 'allies')])],
          lean: { wis: 0.35, vit: 0.15, cha: 0.1 }, emblem: { main: ['Amulet', 14] },
          asc: ['saint_of_vows', 'Saint of Vows'],
        },
        {
          id: 'flagellant', name: 'Flagellant', cls: 'monk', arms: 'fl',
          text: 'Takes the Order\'s penance on their own back, and hands the foe some too.',
          lore: 'Flagellants hold that every broken vow in the town must be paid for, and have volunteered to do the paying. They walk into a fight already bleeding and do not seem to notice anyone else\'s blows, least of all their own.',
          skill: ['the_scourge', 'The Scourge', P({ lastStand: 0.3, lifesteal: 0.1, damage: 0.12, resist: 0.08 })],
          lean: { vit: 0.25, wis: 0.2, str: 0.1 }, emblem: { main: ['MedWep', 12] },
          asc: ['the_scourged_saint', 'The Scourged Saint'],
        },
      ]],
      [{
        id: 'almoner', name: 'Almoner', cls: 'white_mage',
        text: 'Gives out the alms the vows of poverty pay in, and tends whoever needs them.',
        lore: 'The Order\'s vows of poverty send a steady trickle of coin to the Almoner, who turns it into bread, bandages and the odd bribe to a ferryman. In a fight they are the one moving from wounded to wounded with a full satchel.',
        skill: ['open_satchel', 'Open Satchel', A(20, [heal(1.1, 'weakest'), heal(0.5, 'allies')])],
        lean: { wis: 0.25, cha: 0.2, vit: 0.1 }, emblem: { main: ['Money', 4] },
      }, [
        {
          id: 'hospitaller', name: 'Hospitaller', cls: 'white_mage', form: 'doll',
          text: 'Runs the Order\'s hospital: a bed for every wound, and a blade for whoever caused it.',
          lore: 'The Hospitaller keeps the sickbeds clean and the swords sharp, and sees no contradiction. Patients in their care heal faster than they have any right to, mostly so as not to be scolded.',
          skill: ['rule_of_the_hospital', 'Rule of the Hospital', P({ healing: 0.3, regen: 0.04, hp: 0.1, resist: 0.08 })],
          lean: { wis: 0.3, vit: 0.2, int: 0.05 }, emblem: { main: ['Potion', 22] },
          asc: ['master_of_the_hospital', 'Master of the Hospital'],
        },
        {
          id: 'mendicant', name: 'Mendicant', cls: 'monk', arms: 'st',
          text: 'Owns nothing, begs for everything, and is very hard to hurt.',
          lore: 'The Mendicant took the vow of poverty and kept going: no shoes, no coin, no roof, no fear. They walk into a raid with a bowl and a staff, and raiders find that a person with nothing to lose is not easy to take anything from.',
          skill: ['nothing_to_take', 'Nothing to Take', P({ dodge: 0.12, resist: 0.15, counter: 0.12, hp: 0.1 })],
          lean: { wis: 0.25, vit: 0.15, dex: 0.15 }, emblem: { main: ['Tool', 10] },
          asc: ['the_barefoot_saint', 'The Barefoot Saint'],
        },
      ]],
    ]],
    [{
      id: 'war_chaplain', name: 'War Chaplain', cls: 'knight', form: 'knight_3',
      text: 'Rides with the lances, mace in one hand and the blessing in the other.',
      lore: 'The rule says a priest may not shed blood. The War Chaplain says a mace mostly bruises, and rides in the second rank of the charge saying the office for the dying at a brisk pace.',
      skill: ['brisk_office', 'Brisk Office', A(18, [hit(1.5, 'holy'), heal(0.6, 'weakest')])],
      lean: { str: 0.15, wis: 0.2, vit: 0.15 }, emblem: { main: ['MedWep', 6] },
    }, [
      [{
        id: 'relic_bearer', name: 'Relic Bearer', cls: 'knight',
        text: 'Carries the Order\'s last relic into battle, and the relic has opinions.',
        lore: 'The Order brought one relic out of the old country: a finger bone, a nail or a scrap of cloth, depending on who tells it. The Relic Bearer wears it in a silver box on their breast, and the dead and worse will not come near it willingly.',
        skill: ['the_silver_box', 'The Silver Box', P({ undead: 0.25, resist: 0.1, armor: 0.03 })],
        lean: { wis: 0.25, vit: 0.2, str: 0.1 }, emblem: { main: ['Amulet', 18] },
      }, [
        {
          id: 'grail_seeker', name: 'Grail Seeker', cls: 'knight',
          text: 'Hunts the Holy Grail, and fights like someone who has seen it in a dream.',
          lore: 'When the Order\'s honour runs high it rides out after the Grail, and the Grail Seeker rides first. They have dreamed of the cup so often they could draw it, and in battle they move with the calm of someone who already knows how the story ends.',
          skill: ['cup_of_the_dream', 'Cup of the Dream', A(30, [hit(2.3, 'holy', 'foes'), heal(0.8, 'allies'), cleanse('allies')])],
          lean: { wis: 0.25, str: 0.15, cha: 0.15 }, emblem: { main: ['Potion', 34] },
          asc: ['keeper_of_the_grail', 'Keeper of the Grail'],
        },
        {
          id: 'reliquary_guard', name: 'Reliquary Guard', cls: 'guardian',
          text: 'Stands over the Order\'s holy things, and nothing that walks dead gets past.',
          lore: 'The Reliquary Guard keeps the chapel door, and the chapel holds everything the Order has left that it believes in. They are patient, enormous and immovable, and the dead that have tried them did not get a second death so much as a sharp lesson.',
          skill: ['holy_ground', 'Holy Ground', P({ guard: 0.2, undead: 0.25, armor: 0.06, resist: 0.12 })],
          lean: { vit: 0.3, wis: 0.2 }, emblem: { main: ['Shield', 7] },
          asc: ['shield_of_the_relics', 'Shield of the Relics'],
        },
      ]],
      [{
        id: 'militant_prior', name: 'Militant Prior', cls: 'knight',
        text: 'Runs a chapterhouse like a barracks, and a barracks like a chapel.',
        lore: 'The Prior keeps the hours of prayer and the hours of drill on the same bell, and nobody in the chapterhouse is allowed to tell them apart. Under them the brothers fight with a hymn in their mouths and a ferocious sense of order.',
        skill: ['bell_of_hours', 'Bell of Hours', A(24, [grant('inspired', 8, 'allies'), grant('focus', 6, 'allies'), hit(1.7, 'holy')])],
        lean: { wis: 0.2, str: 0.15, cha: 0.15 }, emblem: { main: ['Music', 2] },
      }, [
        {
          id: 'prior_of_the_sword', name: 'Prior of the Sword', cls: 'knight',
          text: 'Leads the chapterhouse to war, and the hymn becomes a battle cry.',
          lore: 'The Prior of the Sword has given up pretending the Order is a monastery that happens to fight. Their brothers go into battle singing in four parts, and raiders who have heard them describe the sound as being sentenced.',
          skill: ['battle_hymn', 'Battle Hymn', A(30, [hit(2, 'holy', 'foes'), grant('berserk', 6, 'allies'), grant('protect', 6, 'allies')])],
          lean: { str: 0.2, wis: 0.2, cha: 0.15 }, emblem: { main: ['LongWep', 20] },
          asc: ['abbot_of_battles', 'Abbot of Battles'],
        },
        {
          id: 'anointed_mace', name: 'Anointed Mace', cls: 'knight',
          text: 'The mace that is blessed every morning, and the arm that swings it.',
          lore: 'The Anointed Mace has been blessed so many times that the oil has soaked into the haft. Each blow rings like a bell, and things that should not be walking stop doing so.',
          skill: ['ringing_blow', 'Ringing Blow', A(16, [hit(2.5, 'holy'), inflict('stun', 2, 'foe', 0.5)])],
          lean: { str: 0.3, wis: 0.15, vit: 0.1 }, emblem: { main: ['MedWep', 14] },
          asc: ['mace_of_heaven', 'Mace of Heaven'],
        },
      ]],
    ]],
  ],
};

export const KNIGHTS_CALLINGS: readonly CallingTree[] = [SQUIRE, HERALD, CHAPLAIN];
