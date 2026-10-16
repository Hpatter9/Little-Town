// Fateful events (the owner's ask: events that change a town's course, toward fortune or ruin). Thirty of
// them, rarer than the rest (no sooner than FATEFUL_FROM_DAY, no oftener than FATEFUL_GAP_DAYS; `fateful` on the def,
// `s.lastFateful` in sim/events.ts), each with answers that matter: a great fire, a plague, a royal patron, gold in
// the river, an exodus, famine, a lost library, war, a miracle... The new effects (eventKit.ts): `burn` (buildings
// set alight), `ruin` (pulled down), `exodus` (a share of the town leaves), `sickShare` (a share falls ill), `learn`
// (topics learned outright), `heal` (everyone mended).
import { adopt, busy, calm, chance, coins, dflt, eraAt, favour, follow, gain, has, later, mod, mood, note, opt, people, take, type EventDef } from './eventKit';
import type { GameState } from '../sim/state';
import { TICKS_PER_DAY } from '../sim/time';

export const FATEFUL_FROM_DAY = 3;
export const FATEFUL_GAP_DAYS = 10;
/** Fateful events weigh this much against an ordinary one's 1 (there are few of them; with the gap above, about one
 *  in ten events once it allows: a town meets one every couple of weeks, not every few days). */
export const FATEFUL_WEIGHT = 3;

/** The longest a fateful choice's consequences take to land, in days (the longest `later` below fits in it). */
export const FATE_LATER_DAYS = 21;

const due = (s: GameState) => s.tick >= FATEFUL_FROM_DAY * TICKS_PER_DAY && s.tick - (s.lastFateful ?? -Infinity) >= FATEFUL_GAP_DAYS * TICKS_PER_DAY;
const fate = (def: Omit<EventDef, 'fateful' | 'weight'> & { when?: (s: GameState) => boolean }): EventDef => ({ ...def, fateful: true, weight: FATEFUL_WEIGHT, when: (s) => due(s) && (!def.when || def.when(s)) });

export const FATEFUL_EVENTS: readonly EventDef[] = [ // (twenty-five, and the five of the stakes' update below)
  fate({
    id: 'great_fire', scene: 'fire', title: 'Fire in the night', text: 'A spark from a hearth takes a roof, and the wind is up. By the time the alarm is raised, the roof is gone and the next is smoking.',
    when: (s) => s.buildings.filter((b) => b.status === 'done').length >= 6,
    options: [
      // (the fireline: the whole town at it for a day, and little lost)
      dflt('Cut a fireline: everyone to it', { burn: 1 }, busy(24, 1, 'Cutting the fireline'), mood(-3, 48, 'The day of the fireline'), note('Every hand is at the axes and shovels till the line is cut. Nothing else gets done today.')),
      opt('Save the stores first', { burn: 3 }, busy(8, 0.5, 'Hauling the stores clear', 'build', 'camp'), note('The stores are carried clear, and three roofs are lost.')),
      // (left to burn: it may die down, or it may take the town and come back as a second, worse choice)
      opt(
        'Let it burn, and keep clear',
        chance(
          0.5,
          [{ burn: 4 }, { kill: 'random', chance: 0.4, cause: 'in the fire, trying to save what was theirs' }, later(6, chance(0.6, [follow('fire_spreads')], [note('The fire burns itself out against the bare ground.')]))],
          [{ burn: 1 }, note('The wind turns. The fire dies down on its own, with one roof lost.')],
        ),
        mood(-6, 72, 'We stood and watched it burn'),
        { reputation: -2 },
      ),
    ],
  }),
  // (never by chance: only when a fire left to burn reaches the town)
  fate({
    id: 'fire_spreads', scene: 'fire', title: 'The fire reaches the town', text: 'The fire left to burn has jumped the lane on the wind. Sparks are coming down on the thatch all along the street.',
    when: () => false,
    options: [
      dflt('A bucket line from the well', { burn: 2 }, { wound: 'all', hp: 12 }, { kill: 'random', chance: 0.35, cause: 'in the smoke of the bucket line' }, busy(12, 1, 'Fighting the fire', 'build', 'camp')),
      opt('Pull down the houses in its path', { ruin: 2 }, { burn: 1 }, busy(8, 0.6, 'Pulling down houses in the fire\'s path', 'build', 'camp'), mood(-5, 72, 'Our own homes pulled down')),
      opt('Run for the fields and pray', { burn: 6 }, { kill: 'random', chance: 0.6, cause: 'in the great fire' }, { kill: 'random', chance: 0.3, cause: 'in the great fire' }, mood(-10, 96, 'The town burned while we ran')),
    ],
  }),
  fate({
    id: 'black_fever', scene: 'plague', title: 'The black fever', text: 'A trader came through with a cough. Now a third of the town is abed, and the healer has no name for it.',
    when: (s) => people(s, 6),
    options: [
      opt('Shut the gates and quarantine the sick', { sickShare: 0.25 }, mod('work', 0.65, 96, 'Half the town nursing the other half'), { calm: 96 }, note('No one comes or goes for four days.')),
      dflt('Carry on, and trust to broth and prayer', { sickShare: 0.45 }, { kill: 'random', chance: 0.5, cause: 'of the black fever' }, { kill: 'random', chance: 0.35, cause: 'of the black fever' }),
      opt('Burn the sickhouse bedding and everything in it', { sickShare: 0.15 }, take('stores', 0.25), mood(-5, 48, 'The burning of the bedding')),
    ],
  }),
  fate({
    id: 'royal_patron', scene: 'envoy', title: 'A royal patron', text: 'A lord of the old blood stops in the town, is well served, and takes a liking to the place. He offers his patronage: his coin and his name.',
    when: (s) => s.buildings.some((b) => !!b.shop) && people(s, 8),
    options: [
      dflt('Accept his patronage', { coins: 300 }, { renown: 40 }, mod('prices', 1.3, 240, "A lord's name over the door"), { reputation: 4 }, later(72, { raid: 6 }, note("The lord's enemies have heard the town is his now."))),
      opt('Thank him, and keep the town its own', { coins: 60 }, mood(5, 72, 'We answer to no lord'), { reputation: 1 }),
    ],
  }),
  fate({
    id: 'river_gold', scene: 'wilds', title: 'Gold in the river', text: 'A child comes running from the ford with a fist of yellow pebbles. There is gold in the gravel, and everyone has seen it.',
    options: [
      dflt('Pan it, all hands', gain({ gold: 24 }), mod('work', 0.7, 72, 'Everyone is at the river'), later(48, { raid: 12 }, note('Word of the gold has got out: raiders are on the road.'))),
      opt('Pan it quietly, a few at a time', gain({ gold: 12 }), note('The gold comes in slowly, and nobody is the wiser.')),
      opt('Leave it in the river', mood(3, 48, 'Wiser than gold'), { reputation: 2 }),
    ],
  }),
  fate({
    id: 'prophet', scene: 'cult', title: 'The prophet', text: 'A ragged preacher has been at the well for three days, and a third of the town now hangs on every word. Tonight he says they must follow him into the wilderness.',
    when: (s) => people(s, 9),
    options: [
      dflt('Let them go who will', { exodus: 0.33 }, mood(-6, 96, 'Friends gone into the wilderness')),
      opt('Pay him to move on (200 coins)', chance(0.7, [{ coins: -200 }, note('He takes the purse and his flock drifts back by morning.'), mood(-2, 24, 'Bought off a prophet')], [{ coins: -200 }, { exodus: 0.2 }, note('He takes the purse and leads them off anyway.')])),
      opt('Drive him out', chance(0.5, [note('The spell breaks: his followers stay, ashamed.'), mood(-3, 48, 'A preacher driven out')], [{ exodus: 0.25 }, { reputation: -3 }, note('His followers go with him, cursing the town.')])),
    ],
  }),
  fate({
    id: 'blight_famine', scene: 'famine', title: 'The great blight', text: 'The crops are black in the field overnight, every one. There will be no harvest this season, and the stores will not last.',
    when: (s) => has(s, 'garden_plot', 'open_field', 'estate_farm', 'vegetable_patch'),
    options: [
      dflt('Tighten belts and ride it out', take('food', 0.6), mod('crops', 0.4, 240, 'The blighted fields'), mood(-6, 120, 'The hungry season')),
      opt('Slaughter the herds and empty the pens', take('food', 0.3), gain({ meat: 30, hide: 8 }), note('The pens are emptied for the pot.'), { herdLoss: 1 }, mod('crops', 0.5, 240, 'The blighted fields')),
      opt('Send everyone to forage the wilds', take('food', 0.5), mod('forage', 1.6, 240, 'Living off the land'), mod('build', 0.6, 240, 'Everyone is out foraging')),
    ],
  }),
  fate({
    id: 'lost_library', scene: 'study', title: 'The lost library', text: 'Diggers for a new cellar break into a vault of old stone. Shelves of scrolls, dry as the day they were sealed.',
    when: (s) => people(s, 5),
    options: [
      dflt('Set the scholars to reading', { learn: 2 }, mood(4, 72, 'The lost library')),
      opt('Sell the scrolls to collectors', { coins: 220 }, { renown: 15 }),
      opt('Seal it again: some things are better unread', { reputation: 1 }, chance(0.3, [{ occult: 'One scroll came out with the diggers all the same: cold to the touch.' }])),
    ],
  }),
  fate({
    id: 'lost_legion', scene: 'refugees', title: 'The lost legion', text: 'Soldiers of a fallen lord, a dozen of them, come to the gate with their spears and their wounds. They ask for bread and a place.',
    when: (s) => people(s, 6),
    options: [
      opt('Take them all in', { join: 6, type: 'hunter' }, mod('work', 0.9, 48, 'More mouths than bread'), later(48, { raid: 12 }, note('Whoever beat their lord has come looking for the rest.'))),
      dflt('Feed them and send them on', take('food', 0.2), { reputation: 2 }, { calm: 72 }),
      opt('Bar the gate', { reputation: -2 }, chance(0.4, [{ raid: 3 }, note('They take by force what they asked for.')])),
    ],
  }),
  fate({
    id: 'earthquake', scene: 'quake', title: 'The ground shakes', text: 'The earth heaves in the small hours. Walls crack, roofs fall, and the well runs muddy.',
    when: (s) => s.buildings.filter((b) => b.status === 'done').length >= 5,
    options: [
      dflt('Dig out whoever is trapped', { ruin: 2 }, { wound: 'all', hp: 10 }, mood(-5, 72, 'The night the ground shook')),
      opt('Save what can be saved from the stores', { ruin: 3 }, { wound: 'random', hp: 25 }, note('Three buildings are lost, but the stores are whole.')),
    ],
  }),
  fate({
    id: 'f_comet', scene: 'omen', title: 'A comet', text: 'A new star hangs over the town for three nights, its tail across half the sky. The old folk say it means a change of fortune. Which way, they will not say.',
    options: [
      dflt('A sign of better days', mood(10, 240, 'The comet'), { research: 900 }),
      opt('A warning: double the watch', mod('guard', 1.4, 240, 'The watch doubled under the comet'), { raid: 36 }, note('Something is coming, and the town will be ready.')),
      opt('An omen of doom', mood(-8, 120, 'Doom in the sky'), chance(0.5, [{ kill: 'random', cause: 'under the comet, of a fright' }])),
    ],
  }),
  fate({
    id: 'bandit_king', scene: 'envoy', title: "The bandit king's tribute", text: 'A rider under a black flag reads a demand at the gate: half the town\'s coin by sundown, or the bandit king comes himself.',
    when: (s) => coins(s, 60),
    options: [
      opt('Pay the tribute', take('coins', 0.5), { calm: 240 }, mood(-3, 48, 'We paid the bandit king')),
      dflt('Refuse him', { raid: 6 }, mood(4, 48, 'We bowed to no bandit')),
    ],
  }),
  fate({
    id: 'bountiful_years', scene: 'harvest', title: 'The fat years', text: 'The rains come right, the frosts come late, and every seed sown comes up double. The old folk have never seen the like.',
    options: [
      dflt('Store it all against the lean years', mod('crops', 1.6, 360, 'The fat years'), mood(6, 240, 'Full barns')),
      opt('Sell the surplus while prices hold', mod('crops', 1.6, 360, 'The fat years'), { coins: 150 }, { renown: 10 }),
    ],
  }),
  fate({
    id: 'barrow_curse', scene: 'ghost', title: 'The curse of the barrow', text: 'Since the hunters broke open the old mound for its stones, the milk sours, the tools break, and three have taken to their beds.',
    when: (s) => people(s, 6),
    options: [
      dflt('Put the stones back and seal the mound', mod('work', 0.75, 120, 'The curse of the barrow'), { sick: 2 }, note('The curse fades over the days that follow.')),
      opt('Send someone in to lay the dead to rest', { kill: 'who', chance: 0.4, cause: 'in the barrow, laying the dead to rest' }, mood(5, 120, 'The barrow is quiet'), gain({ gold: 6, gems: 2 })),
      opt('Ignore old wives\' tales', mod('work', 0.6, 240, 'The curse of the barrow'), { sick: 4 }, { kill: 'random', chance: 0.4, cause: 'of a wasting sickness' }),
    ],
    who: true,
  }),
  fate({
    id: 'founders_vision', scene: 'omen', title: "The founder's vision", text: 'For three nights the founder has not slept, and on the fourth they come down with a light in their eyes and a plan the town has never heard the like of.',
    options: [
      dflt('Follow the vision', { learn: 1 }, mood(6, 120, "The founder's vision"), mod('build', 1.3, 240, 'Building the vision')),
      opt('Talk them down: it is only tiredness', mood(-2, 48, 'A vision set aside'), { wound: 'who', hp: 5 }),
    ],
  }),
  fate({
    id: 'dragon_hoard', scene: 'dragon', title: 'The hoard', text: 'A dying traveller presses a map into the keeper\'s hand: a cave in the hills, and in it the hoard of something that sleeps.',
    when: (s) => people(s, 6),
    options: [
      opt('Send the boldest for it', chance(0.45, [{ coins: 500 }, gain({ gold: 20, gems: 6 }), { renown: 30 }, note('They come back laden, and will not say what they saw.')], [{ kill: 'random', cause: 'in the hoard cave' }, { kill: 'random', chance: 0.6, cause: 'in the hoard cave' }, note('Two went in. One came back, and the hoard stays where it is.')])),
      dflt('Burn the map', mood(2, 48, 'The dragon left sleeping'), calm(48), note('Nothing from the hills troubles the town for a while.')),
    ],
  }),
  fate({
    id: 'f_rats', scene: 'famine', title: 'Rats', text: 'The stores are alive with them: a plague of rats that has eaten through the sacks and fouled the rest.',
    when: (s) => has(s, 'stockpile', 'granary', 'warehouse'),
    options: [
      dflt('Clear the stores and start again', take('stores', 0.5), mood(-3, 48, 'The rats')),
      opt('Bring in cats from the next valley (40 coins)', { coins: -40 }, take('stores', 0.25), note('The cats earn their keep, and stay.'), mood(3, 120, 'Cats on the stores')),
    ],
  }),
  fate({
    id: 'merchant_princes', scene: 'caravan', title: 'The merchant princes', text: 'A fleet of wagons under silk banners draws up outside the town: the merchant princes of the far cities, come to see if the place is worth their trade.',
    when: (s) => s.buildings.some((b) => !!b.shop),
    options: [
      dflt('Feast them', take('food', 0.3), { renown: 50 }, { coins: 150 }, mod('travellers', 1.5, 240, 'The merchant princes came')),
      opt('Trade hard', { coins: 300 }, { renown: 10 }, mod('prices', 0.9, 120, 'The princes drive a hard bargain')),
    ],
  }),
  fate({
    id: 'secession', scene: 'council', title: 'The town divides', text: 'Half the town has had enough of the other half. They mean to found a place of their own across the river, and take their tools with them.',
    when: (s) => people(s, 10),
    options: [
      dflt('Let them go in peace', { exodus: 0.4 }, take('stores', 0.3), mood(-4, 96, 'The town divided')),
      opt('Give them what they ask: a say in the council and a feast', mod('work', 0.85, 240, 'The council of two halves'), mood(4, 120, 'The town stayed one'), take('food', 0.2)),
      opt('Hold them: the gates are shut', { exodus: 0.15 }, mood(-10, 240, 'Kept in against our will'), { reputation: -3 }),
    ],
  }),
  fate({
    id: 'miracle', scene: 'miracle', title: 'A miracle at the well', text: 'The sick child who was given up for dead rises and walks. By evening the lame are at the well too, and some of them walk home.',
    options: [
      dflt('Give thanks', { heal: 1 }, mood(12, 240, 'The miracle at the well'), { renown: 20 }),
      opt('Keep it quiet, before the pilgrims come', { heal: 1 }, mood(6, 120, 'The miracle at the well')),
    ],
  }),
  fate({
    id: 'long_winter', scene: 'famine', title: 'The long winter', text: 'The snow that should have gone in a week is still on the ground a month on, and the seed in the furrows is dead.',
    options: [
      dflt('Ration everything', take('food', 0.5), mod('crops', 0.3, 240, 'The long winter'), mood(-6, 240, 'The long winter')),
      opt('Hunt the deep woods, whatever the risk', take('food', 0.3), mod('forage', 1.5, 240, 'Hunting the deep woods'), { kill: 'random', chance: 0.4, cause: 'in the deep woods, in the long winter' }, mod('crops', 0.3, 240, 'The long winter')),
    ],
  }),
  fate({
    id: 'hearth_treasure', scene: 'home', title: 'Under the hearth', text: 'Relaying the hearthstone, a mason finds a box: coin of an old mint, and stones that catch the light.',
    options: [dflt('Into the town\'s chest', { coins: 250 }, gain({ gems: 5 })), opt('Share it out among everyone', mood(10, 240, 'A share of the hearth treasure'), { coins: 60 })],
  }),
  fate({
    id: 'war_comes', scene: 'battle', title: 'War comes', text: 'A host is on the march across the valley, burning as it goes. Scouts say it will be at the gate within the day, and again, and again.',
    when: (s) => people(s, 8) && eraAt(s, 'neolithic'),
    options: [
      dflt('Stand and fight', { raid: 3 }, later(24, { raid: 2 }), later(60, { raid: 2 }), mood(3, 72, 'We stand')),
      opt('Pay the host to pass by (most of the coin)', take('coins', 0.7), take('food', 0.3), { calm: 240 }, mood(-3, 72, 'We paid the host')),
    ],
  }),
  fate({
    id: 'alchemists_gift', scene: 'magic', title: "The wanderer's gift", text: 'A traveller in a stained coat leaves a sealed jar in payment for a night\'s lodging. In it: a powder that turns iron bright, and a recipe.',
    when: (s) => eraAt(s, 'medieval'),
    options: [dflt('Try the recipe', { learn: 1 }, chance(0.3, [{ burn: 1 }, note('The first batch goes up in flames.')])), opt('Sell the jar', { coins: 120 })],
  }),
  fate({
    id: 'wolf_winter', scene: 'beast', title: 'The wolves come down', text: 'The deep cold has driven the wolves out of the mountains, and they are in the streets at night. Three dogs are gone, and a child nearly.',
    options: [
      dflt('Hunt them to the last', { raid: 2 }, mod('guard', 1.3, 120, 'Wolf watch'), gain({ hide: 10, meat: 12 })),
      opt('Bar the doors and wait for the thaw', mod('work', 0.7, 120, 'Wolves in the streets'), { kill: 'random', chance: 0.3, cause: 'to the wolves, in the night' }),
    ],
  }),
  fate({
    id: 'golden_age', scene: 'festival', title: 'A golden age', text: 'Everything goes right at once: the fields, the forge, the markets. Travellers speak of the town in the far cities, and the young folk walk tall.',
    when: (s) => people(s, 12),
    options: [
      dflt('Make the most of it', mod('work', 1.3, 360, 'A golden age'), mod('travellers', 1.5, 360, 'A golden age'), mood(10, 360, 'A golden age'), { renown: 40 }),
      opt('Save against the day it ends', mod('work', 1.15, 360, 'A golden age, soberly'), { coins: 200 }, mood(5, 360, 'A golden age')),
    ],
  }),

  // ---- the stakes' update: choices that stay (each lands a consequence later, which the Chronicle writes beside it)
  fate({
    id: 'stranger_at_the_gate', scene: 'gate', title: 'A stranger at the gate', remember: 'the night you let the stranger in',
    text: 'Rain at midnight, and a knocking at the gate that will not stop. A stranger in a good cloak gone to ruin stands there with a wound badly bound and a signet ring they keep turning. They say their house is fallen and they want only a roof. They say a good many things.',
    when: (s) => people(s, 5) && s.heirId === undefined,
    options: [
      dflt('Let them in, and name them the founder\'s heir', adopt('elder'), mood(3, 96, 'A stranger at the founder\'s fire'),
        later(96, { raid: 6 }, note('Those who hunted the stranger have followed the tracks to the gate.')),
        later(300, { coins: 250 }, { reputation: 3 }, note('The stranger\'s signet opens a lord\'s door, and the lord pays for the town\'s kindness.'))),
      opt('A place in the barn till dawn, and no more', { reputation: 1 }, note('They are gone at first light, leaving only a cloak-pin on the barn floor.')),
      opt('Keep the gate shut', { reputation: -1 }, mood(-3, 96, 'We left a stranger in the rain'),
        later(72, mood(-4, 120, 'The stranger at the ford'), note('The stranger was found at the ford in the morning, and nobody could say whose fault it was.'))),
    ],
  }),
  fate({
    id: 'hollow_tithe', scene: 'cult', title: 'The tithe of the hollow', remember: 'the bargain you struck at the hollow', who: true,
    text: 'In the hollow beyond the fields something old keeps its own counsel. Tonight it has spoken to {who}, and what it offers is plain: good years, for as long as the town keeps faith. Its price it will name only at the end.',
    when: (s) => people(s, 6),
    options: [
      opt('Strike the bargain', mod('crops', 1.6, 480, 'The hollow\'s good years'), mod('forage', 1.3, 480, 'The hollow\'s good years'), mood(6, 240, 'Good years, and the price unnamed'),
        later(480, { kill: 'who', cause: 'to the price of the hollow\'s bargain' }, note('The hollow has named its price, and {who} has gone to pay it.'))),
      dflt('Offer coin in a life\'s place (300 coins)', { coins: -300 }, mod('crops', 1.25, 480, 'The hollow, bought off'),
        later(480, mood(-4, 72, 'What the hollow wanted instead'), note('The hollow took the coin and kept its silence. Whatever it wanted, it has not forgotten the offer.'))),
      opt('Stop your ears: have nothing to do with it', mood(2, 48, 'We kept faith with the daylight'),
        later(240, mod('crops', 0.8, 240, 'The hollow\'s silence'), note('The hollow sent no blessing, and no ill. The old folk say that is its way of waiting.'))),
    ],
  }),
  fate({
    id: 'shrine_in_the_wood', scene: 'miracle', title: 'The nameless shrine', remember: 'the shrine you gave a name',
    text: 'Hunters in the deep wood have found a shrine older than the town: a flat stone, a ring of blackened trees, and no god\'s name on it. Offerings have been left there, and lately. The town must decide whose it will be.',
    when: (s) => people(s, 4),
    options: [
      dflt('Dedicate it to the harvest', favour('harvest', 40), favour('war', -10), { build: 'wayside_shrine' },
        later(240, mod('crops', 1.25, 360, 'The harvest god keeps its word'), note('The harvest god keeps its word: the fields are heavy this year.'))),
      opt('Dedicate it to war', favour('war', 40), favour('harvest', -10), { build: 'wayside_shrine' },
        later(240, mod('fight', 1.2, 360, 'The war god\'s favour'), mod('guard', 1.2, 360, 'The war god\'s favour'), note('The war god is pleased: the town fights as though it were owed.'))),
      opt('Pull it down for the stone', gain({ stone: 20 }), favour('all', -25),
        later(240, mood(-6, 240, 'The gods are quiet'), note('Nobody will say it, but the town has been quieter since the stone came down.'))),
    ],
  }),
  fate({
    id: 'warlords_oath', scene: 'envoy', title: "The warlord's oath", remember: 'the oath you swore to the warlord',
    text: 'A warlord with a hundred spears at his back sits his horse at the edge of the fields and asks for little: an oath, spoken before the town, that you will answer when he calls. In return no spear of his, nor of any he can hold back, will trouble you.',
    when: (s) => people(s, 8),
    options: [
      opt('Swear it', calm(480), { reputation: 2 }, mood(2, 96, 'Under the warlord\'s peace'),
        later(360, { exodus: 0.15 }, take('coins', 0.3), note('He has called, and the town has answered with silver and with its young. The warlord remembers who was quick.'))),
      dflt('Refuse him to his face', { raid: 8 }, mood(4, 72, 'We swore to no one'),
        later(200, chance(0.5, [{ raid: 4 }, note('His second host is smaller. He is not done with the town.')], [note('He did not come back. Perhaps another town swore.')]))),
      opt('Swear, and mean to break it', chance(0.5, [calm(240), note('He never learns of it, and the peace holds.')], [{ raid: 6 }, { reputation: -4 }, note('He knows. A warlord always knows.')]),
        later(360, mood(-3, 120, 'A broken oath on the founder\'s conscience'), note('The oath sits ill on the founder, whoever else it was sworn for.'))),
    ],
  }),
  fate({
    id: 'the_deep_well', scene: 'well', title: 'The well that does not end', remember: 'the night you dug the deep well',
    text: 'The well has been losing water for a week, and when the diggers went down to deepen it their rope ran out before the bottom did. Something down there is warm, and on still nights the town can hear it breathe.',
    options: [
      dflt('Send the diggers down', { wound: 'random', hp: 20 },
        later(96, { learn: 2 }, gain({ gems: 4 }), note('The diggers broke through into a cistern of carved stone, and the tablets in it were dry and legible.')),
        later(264, { sickShare: 0.1 }, mood(-4, 96, 'What breathes in the well'), note('The air from the cistern has made some of the town ill.'))),
      opt('Seal it with stone', take('stores', 0.1), mood(2, 48, 'The well is sealed'),
        later(120, note('The sealed well is quiet. The old folk have stopped listening for it.'))),
      opt('Lower the keenest on a rope', chance(0.65, [{ learn: 1 }, gain({ gems: 6 }), later(96, { renown: 20 }, note('They talk of the well in the market towns now.'))], [{ kill: 'random', cause: 'at the bottom of the well' }, mood(-5, 96, 'The rope came up empty')])),
    ],
  }),
];
