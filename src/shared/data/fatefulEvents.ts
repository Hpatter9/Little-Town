// Fateful events (the owner's ask: events that change a town's course, toward fortune or ruin). Twenty-five of
// them, rarer than the rest (no sooner than FATEFUL_FROM_DAY, no oftener than FATEFUL_GAP_DAYS; `fateful` on the def,
// `s.lastFateful` in sim/events.ts), each with answers that matter: a great fire, a plague, a royal patron, gold in
// the river, an exodus, famine, a lost library, war, a miracle... The new effects (eventKit.ts): `burn` (buildings
// set alight), `ruin` (pulled down), `exodus` (a share of the town leaves), `sickShare` (a share falls ill), `learn`
// (topics learned outright), `heal` (everyone mended).
import { chance, coins, dflt, eraAt, gain, has, later, mod, mood, note, opt, people, take, type EventDef } from './eventKit';
import type { GameState } from '../sim/state';
import { TICKS_PER_DAY } from '../sim/time';

export const FATEFUL_FROM_DAY = 3;
export const FATEFUL_GAP_DAYS = 4;
/** Fateful events weigh this much against an ordinary one's 1 (there are few of them, so about one in five events
 *  once the gap allows). */
export const FATEFUL_WEIGHT = 6;

const due = (s: GameState) => s.tick >= FATEFUL_FROM_DAY * TICKS_PER_DAY && s.tick - (s.lastFateful ?? -Infinity) >= FATEFUL_GAP_DAYS * TICKS_PER_DAY;
const fate = (def: Omit<EventDef, 'fateful' | 'weight'> & { when?: (s: GameState) => boolean }): EventDef => ({ ...def, fateful: true, weight: FATEFUL_WEIGHT, when: (s) => due(s) && (!def.when || def.when(s)) });

export const FATEFUL_EVENTS: readonly EventDef[] = [ // (twenty-five)
  fate({
    id: 'great_fire', title: 'Fire in the night', text: 'A spark from a hearth takes a roof, and the wind is up. By the time the alarm is raised, half the street is alight.',
    when: (s) => s.buildings.filter((b) => b.status === 'done').length >= 6,
    options: [
      dflt('Everyone to the buckets', { burn: 2 }, { wound: 'all', hp: 8 }, mood(-4, 48, 'The night of the fire')),
      opt('Save the stores first', { burn: 4 }, note('The stores are saved, and four roofs are lost.')),
      opt('Let it burn, and keep clear', { burn: 6 }, mood(-8, 72, 'We stood and watched it burn'), { reputation: -2 }),
    ],
  }),
  fate({
    id: 'black_fever', title: 'The black fever', text: 'A trader came through with a cough. Now a third of the town is abed, and the healer has no name for it.',
    when: (s) => people(s, 6),
    options: [
      opt('Shut the gates and quarantine the sick', { sickShare: 0.25 }, mod('work', 0.65, 96, 'Half the town nursing the other half'), { calm: 96 }, note('No one comes or goes for four days.')),
      dflt('Carry on, and trust to broth and prayer', { sickShare: 0.45 }, { kill: 'random', chance: 0.5, cause: 'of the black fever' }, { kill: 'random', chance: 0.35, cause: 'of the black fever' }),
      opt('Burn the sickhouse bedding and everything in it', { sickShare: 0.15 }, take('stores', 0.25), mood(-5, 48, 'The burning of the bedding')),
    ],
  }),
  fate({
    id: 'royal_patron', title: 'A royal patron', text: 'A lord of the old blood stops in the town, is well served, and takes a liking to the place. He offers his patronage: his coin and his name.',
    when: (s) => s.buildings.some((b) => !!b.shop) && people(s, 8),
    options: [
      dflt('Accept his patronage', { coins: 300 }, { renown: 40 }, mod('prices', 1.3, 240, "A lord's name over the door"), { reputation: 4 }, later(72, { raid: 6 }, note("The lord's enemies have heard the town is his now."))),
      opt('Thank him, and keep the town its own', { coins: 60 }, mood(5, 72, 'We answer to no lord'), { reputation: 1 }),
    ],
  }),
  fate({
    id: 'river_gold', title: 'Gold in the river', text: 'A child comes running from the ford with a fist of yellow pebbles. There is gold in the gravel, and everyone has seen it.',
    options: [
      dflt('Pan it, all hands', gain({ gold: 24 }), mod('work', 0.7, 72, 'Everyone is at the river'), later(48, { raid: 12 }, note('Word of the gold has got out: raiders are on the road.'))),
      opt('Pan it quietly, a few at a time', gain({ gold: 12 }), note('The gold comes in slowly, and nobody is the wiser.')),
      opt('Leave it in the river', mood(3, 48, 'Wiser than gold'), { reputation: 2 }),
    ],
  }),
  fate({
    id: 'prophet', title: 'The prophet', text: 'A ragged preacher has been at the well for three days, and a third of the town now hangs on every word. Tonight he says they must follow him into the wilderness.',
    when: (s) => people(s, 9),
    options: [
      dflt('Let them go who will', { exodus: 0.33 }, mood(-6, 96, 'Friends gone into the wilderness')),
      opt('Pay him to move on (200 coins)', chance(0.7, [{ coins: -200 }, note('He takes the purse and his flock drifts back by morning.'), mood(-2, 24, 'Bought off a prophet')], [{ coins: -200 }, { exodus: 0.2 }, note('He takes the purse and leads them off anyway.')])),
      opt('Drive him out', chance(0.5, [note('The spell breaks: his followers stay, ashamed.'), mood(-3, 48, 'A preacher driven out')], [{ exodus: 0.25 }, { reputation: -3 }, note('His followers go with him, cursing the town.')])),
    ],
  }),
  fate({
    id: 'blight_famine', title: 'The great blight', text: 'The crops are black in the field overnight, every one. There will be no harvest this season, and the stores will not last.',
    when: (s) => has(s, 'garden_plot', 'open_field', 'estate_farm', 'vegetable_patch'),
    options: [
      dflt('Tighten belts and ride it out', take('food', 0.6), mod('crops', 0.4, 240, 'The blighted fields'), mood(-6, 120, 'The hungry season')),
      opt('Slaughter the herds and empty the pens', take('food', 0.3), gain({ meat: 30, hide: 8 }), note('The pens are emptied for the pot.'), { herdLoss: 1 }, mod('crops', 0.5, 240, 'The blighted fields')),
      opt('Send everyone to forage the wilds', take('food', 0.5), mod('forage', 1.6, 240, 'Living off the land'), mod('build', 0.6, 240, 'Everyone is out foraging')),
    ],
  }),
  fate({
    id: 'lost_library', title: 'The lost library', text: 'Diggers for a new cellar break into a vault of old stone. Shelves of scrolls, dry as the day they were sealed.',
    when: (s) => people(s, 5),
    options: [
      dflt('Set the scholars to reading', { learn: 2 }, mood(4, 72, 'The lost library')),
      opt('Sell the scrolls to collectors', { coins: 220 }, { renown: 15 }),
      opt('Seal it again: some things are better unread', { reputation: 1 }, chance(0.3, [{ occult: 'One scroll came out with the diggers all the same: cold to the touch.' }])),
    ],
  }),
  fate({
    id: 'lost_legion', title: 'The lost legion', text: 'Soldiers of a fallen lord, a dozen of them, come to the gate with their spears and their wounds. They ask for bread and a place.',
    when: (s) => people(s, 6),
    options: [
      opt('Take them all in', { join: 6, type: 'hunter' }, mod('work', 0.9, 48, 'More mouths than bread'), later(48, { raid: 12 }, note('Whoever beat their lord has come looking for the rest.'))),
      dflt('Feed them and send them on', take('food', 0.2), { reputation: 2 }, { calm: 72 }),
      opt('Bar the gate', { reputation: -2 }, chance(0.4, [{ raid: 3 }, note('They take by force what they asked for.')])),
    ],
  }),
  fate({
    id: 'earthquake', title: 'The ground shakes', text: 'The earth heaves in the small hours. Walls crack, roofs fall, and the well runs muddy.',
    when: (s) => s.buildings.filter((b) => b.status === 'done').length >= 5,
    options: [
      dflt('Dig out whoever is trapped', { ruin: 2 }, { wound: 'all', hp: 10 }, mood(-5, 72, 'The night the ground shook')),
      opt('Save what can be saved from the stores', { ruin: 3 }, { wound: 'random', hp: 25 }, note('Three buildings are lost, but the stores are whole.')),
    ],
  }),
  fate({
    id: 'f_comet', title: 'A comet', text: 'A new star hangs over the town for three nights, its tail across half the sky. The old folk say it means a change of fortune. Which way, they will not say.',
    options: [
      dflt('A sign of better days', mood(10, 240, 'The comet'), { research: 900 }),
      opt('A warning: double the watch', mod('guard', 1.4, 240, 'The watch doubled under the comet'), { raid: 36 }, note('Something is coming, and the town will be ready.')),
      opt('An omen of doom', mood(-8, 120, 'Doom in the sky'), chance(0.5, [{ kill: 'random', cause: 'under the comet, of a fright' }])),
    ],
  }),
  fate({
    id: 'bandit_king', title: "The bandit king's tribute", text: 'A rider under a black flag reads a demand at the gate: half the town\'s coin by sundown, or the bandit king comes himself.',
    when: (s) => coins(s, 60),
    options: [
      opt('Pay the tribute', take('coins', 0.5), { calm: 240 }, mood(-3, 48, 'We paid the bandit king')),
      dflt('Refuse him', { raid: 6 }, mood(4, 48, 'We bowed to no bandit')),
    ],
  }),
  fate({
    id: 'bountiful_years', title: 'The fat years', text: 'The rains come right, the frosts come late, and every seed sown comes up double. The old folk have never seen the like.',
    options: [
      dflt('Store it all against the lean years', mod('crops', 1.6, 360, 'The fat years'), mood(6, 240, 'Full barns')),
      opt('Sell the surplus while prices hold', mod('crops', 1.6, 360, 'The fat years'), { coins: 150 }, { renown: 10 }),
    ],
  }),
  fate({
    id: 'barrow_curse', title: 'The curse of the barrow', text: 'Since the hunters broke open the old mound for its stones, the milk sours, the tools break, and three have taken to their beds.',
    when: (s) => people(s, 6),
    options: [
      dflt('Put the stones back and seal the mound', mod('work', 0.75, 120, 'The curse of the barrow'), { sick: 2 }, note('The curse fades over the days that follow.')),
      opt('Send someone in to lay the dead to rest', { kill: 'who', chance: 0.4, cause: 'in the barrow, laying the dead to rest' }, mood(5, 120, 'The barrow is quiet'), gain({ gold: 6, gems: 2 })),
      opt('Ignore old wives\' tales', mod('work', 0.6, 240, 'The curse of the barrow'), { sick: 4 }, { kill: 'random', chance: 0.4, cause: 'of a wasting sickness' }),
    ],
    who: true,
  }),
  fate({
    id: 'founders_vision', title: "The founder's vision", text: 'For three nights the founder has not slept, and on the fourth they come down with a light in their eyes and a plan the town has never heard the like of.',
    options: [
      dflt('Follow the vision', { learn: 1 }, mood(6, 120, "The founder's vision"), mod('build', 1.3, 240, 'Building the vision')),
      opt('Talk them down: it is only tiredness', mood(-2, 48, 'A vision set aside'), { wound: 'who', hp: 5 }),
    ],
  }),
  fate({
    id: 'dragon_hoard', title: 'The hoard', text: 'A dying traveller presses a map into the keeper\'s hand: a cave in the hills, and in it the hoard of something that sleeps.',
    when: (s) => people(s, 6),
    options: [
      opt('Send the boldest for it', chance(0.45, [{ coins: 500 }, gain({ gold: 20, gems: 6 }), { renown: 30 }, note('They come back laden, and will not say what they saw.')], [{ kill: 'random', cause: 'in the hoard cave' }, { kill: 'random', chance: 0.6, cause: 'in the hoard cave' }, note('Two went in. One came back, and the hoard stays where it is.')])),
      dflt('Burn the map', mood(2, 48, 'Some treasures are left be')),
    ],
  }),
  fate({
    id: 'f_rats', title: 'Rats', text: 'The stores are alive with them: a plague of rats that has eaten through the sacks and fouled the rest.',
    when: (s) => has(s, 'stockpile', 'granary', 'warehouse'),
    options: [
      dflt('Clear the stores and start again', take('stores', 0.5), mood(-3, 48, 'The rats')),
      opt('Bring in cats from the next valley (40 coins)', { coins: -40 }, take('stores', 0.25), note('The cats earn their keep, and stay.'), mood(3, 120, 'Cats on the stores')),
    ],
  }),
  fate({
    id: 'merchant_princes', title: 'The merchant princes', text: 'A fleet of wagons under silk banners draws up outside the town: the merchant princes of the far cities, come to see if the place is worth their trade.',
    when: (s) => s.buildings.some((b) => !!b.shop),
    options: [
      dflt('Feast them', take('food', 0.3), { renown: 50 }, { coins: 150 }, mod('travellers', 1.5, 240, 'The merchant princes came')),
      opt('Trade hard', { coins: 300 }, { renown: 10 }, mod('prices', 0.9, 120, 'The princes drive a hard bargain')),
    ],
  }),
  fate({
    id: 'secession', title: 'The town divides', text: 'Half the town has had enough of the other half. They mean to found a place of their own across the river, and take their tools with them.',
    when: (s) => people(s, 10),
    options: [
      dflt('Let them go in peace', { exodus: 0.4 }, take('stores', 0.3), mood(-4, 96, 'The town divided')),
      opt('Give them what they ask: a say in the council and a feast', mod('work', 0.85, 240, 'The council of two halves'), mood(4, 120, 'The town stayed one'), take('food', 0.2)),
      opt('Hold them: the gates are shut', { exodus: 0.15 }, mood(-10, 240, 'Kept in against our will'), { reputation: -3 }),
    ],
  }),
  fate({
    id: 'miracle', title: 'A miracle at the well', text: 'The sick child who was given up for dead rises and walks. By evening the lame are at the well too, and some of them walk home.',
    options: [
      dflt('Give thanks', { heal: 1 }, mood(12, 240, 'The miracle at the well'), { renown: 20 }),
      opt('Keep it quiet, before the pilgrims come', { heal: 1 }, mood(6, 120, 'The miracle at the well')),
    ],
  }),
  fate({
    id: 'long_winter', title: 'The long winter', text: 'The snow that should have gone in a week is still on the ground a month on, and the seed in the furrows is dead.',
    options: [
      dflt('Ration everything', take('food', 0.5), mod('crops', 0.3, 240, 'The long winter'), mood(-6, 240, 'The long winter')),
      opt('Hunt the deep woods, whatever the risk', take('food', 0.3), mod('forage', 1.5, 240, 'Hunting the deep woods'), { kill: 'random', chance: 0.4, cause: 'in the deep woods, in the long winter' }, mod('crops', 0.3, 240, 'The long winter')),
    ],
  }),
  fate({
    id: 'hearth_treasure', title: 'Under the hearth', text: 'Relaying the hearthstone, a mason finds a box: coin of an old mint, and stones that catch the light.',
    options: [dflt('Into the town\'s chest', { coins: 250 }, gain({ gems: 5 })), opt('Share it out among everyone', mood(10, 240, 'A share of the hearth treasure'), { coins: 60 })],
  }),
  fate({
    id: 'war_comes', title: 'War comes', text: 'A host is on the march across the valley, burning as it goes. Scouts say it will be at the gate within the day, and again, and again.',
    when: (s) => people(s, 8) && eraAt(s, 'neolithic'),
    options: [
      dflt('Stand and fight', { raid: 3 }, later(24, { raid: 2 }), later(60, { raid: 2 }), mood(3, 72, 'We stand')),
      opt('Pay the host to pass by (most of the coin)', take('coins', 0.7), take('food', 0.3), { calm: 240 }, mood(-3, 72, 'We paid the host')),
    ],
  }),
  fate({
    id: 'alchemists_gift', title: "The wanderer's gift", text: 'A traveller in a stained coat leaves a sealed jar in payment for a night\'s lodging. In it: a powder that turns iron bright, and a recipe.',
    when: (s) => eraAt(s, 'medieval'),
    options: [dflt('Try the recipe', { learn: 1 }, chance(0.3, [{ burn: 1 }, note('The first batch goes up in flames.')])), opt('Sell the jar', { coins: 120 })],
  }),
  fate({
    id: 'wolf_winter', title: 'The wolves come down', text: 'The deep cold has driven the wolves out of the mountains, and they are in the streets at night. Three dogs are gone, and a child nearly.',
    options: [
      dflt('Hunt them to the last', { raid: 2 }, mod('guard', 1.3, 120, 'Wolf watch'), gain({ hide: 10, meat: 12 })),
      opt('Bar the doors and wait for the thaw', mod('work', 0.7, 120, 'Wolves in the streets'), { kill: 'random', chance: 0.3, cause: 'to the wolves, in the night' }),
    ],
  }),
  fate({
    id: 'golden_age', title: 'A golden age', text: 'Everything goes right at once: the fields, the forge, the markets. Travellers speak of the town in the far cities, and the young folk walk tall.',
    when: (s) => people(s, 12),
    options: [
      dflt('Make the most of it', mod('work', 1.3, 360, 'A golden age'), mod('travellers', 1.5, 360, 'A golden age'), mood(10, 360, 'A golden age'), { renown: 40 }),
      opt('Save against the day it ends', mod('work', 1.15, 360, 'A golden age, soberly'), { coins: 200 }, mood(5, 360, 'A golden age')),
    ],
  }),
];
