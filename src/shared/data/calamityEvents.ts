// The Calamity's choice events (data/calamity.ts, sim/calamity.ts): dreams and omens while it stirs, the blight's
// refugees and wise women once it spreads, its cult's preachers and shrines, its heralds when its armies march. Each
// comes only from its stage on, and many answers move the dread (`dread` in eventKit.ts). Merged into EVENTS; their
// passages are in calamityMore.ts.

import { build, calm, coin, dflt, dread, gain, item, mod, mood, opt, people, raidIn, rep, study, take, teach, type EventDef } from './eventKit';
import type { GameState } from '../sim/state';

const stage = (s: GameState, n: number) => !!s.calamity && s.calamity.beaten === undefined && s.calamity.stage >= n;

export const CALAMITY_EVENTS: readonly EventDef[] = [
  {
    id: 'calamity_dream', title: 'A dream of the dark', who: true, weight: 2,
    text: '{who} woke screaming before dawn, from a dream of the thing that is waking out on the land. They say it spoke to them.',
    when: (s) => stage(s, 1),
    options: [
      dflt('Have them tell the elders every word', study(240), dread(-2), mood(-3, 24, 'The dream {who} told')),
      opt('Tell them it was only a dream', mod('work', 0.9, 24, '{who} is not themselves today')),
      opt('Burn herbs over their bed to keep it off', take('stores', 0.03), dread(-3)),
    ],
  },
  {
    id: 'calamity_eclipse', title: 'Darkness at noon', weight: 2,
    text: 'At midday the sun went black, as if a hand had closed over it. The birds went silent. When the light came back, nobody would look at anyone else.',
    when: (s) => stage(s, 1),
    options: [
      dflt('Gather everyone to pray', dread(-2), mod('work', 0.8, 24, 'A day of prayer')),
      opt('Work on, and say nothing', mood(-6, 48, 'The sun went dark')),
      opt('Hold a feast against the dark', take('food', 0.1), mood(8, 48, 'We feasted against the dark')),
    ],
  },
  {
    id: 'calamity_refugees', title: 'Fleeing the blight', weight: 2,
    text: 'A family comes up the road with everything they own on their backs. Their village is grey now, they say. Everything there is grey.',
    when: (s) => stage(s, 2),
    options: [
      dflt('Take them in', { join: 2 }, take('food', 0.05)),
      opt('Feed them and send them on', take('food', 0.08), rep(2)),
      opt('Turn them away: they may carry it', mood(-6, 48, 'We turned them away'), rep(-2)),
    ],
  },
  {
    id: 'calamity_hedge_witch', title: 'The hedge witch', weight: 2,
    text: 'An old woman with a basket of carved stones asks for the town\'s leader. She knows the signs that keep the dark out, she says, and she will carve them, for a price.',
    when: (s) => stage(s, 2),
    options: [
      dflt('Pay her to carve the signs', coin(-60), dread(-6)),
      opt('Pay her in herbs and food', take('food', 0.06), dread(-3)),
      opt('Send her on her way', mood(-5, 24, 'Was she right?')),
    ],
  },
  {
    id: 'calamity_relic', title: 'A blade in the grey', who: true, weight: 2,
    text: '{who} came back from the edge of the blight with an old sword they found standing in the dead grass. It is cold, and it hums.',
    when: (s) => stage(s, 2),
    options: [
      dflt('Keep it: a blade is a blade', item('iron_sword'), dread(2)),
      opt('Throw it in the fire', dread(-4)),
      opt('Sell it to the next trader', coin(40)),
    ],
  },
  {
    id: 'calamity_well', title: 'The grey well', weight: 2,
    text: 'The water came up grey this morning, and it smells of the blight. The animals will not drink it.',
    when: (s) => stage(s, 2) && s.buildings.some((b) => b.def === 'well'),
    options: [
      dflt('Dig a new well upstream', build('well')),
      opt('Boil every drop before drinking', mod('work', 0.85, 48, 'Boiling the water')),
      opt('Drink it anyway', { sick: 2 }),
    ],
  },
  {
    id: 'cult_preacher', title: 'A preacher of the end', weight: 2,
    text: 'A thin man in grey stands by the fire every evening, speaking softly of the thing that is coming, and how it will be kind to those who welcome it. People listen.',
    when: (s) => stage(s, 3) && people(s, 4),
    options: [
      dflt('Drive him out of the town', dread(-2), rep(-1), mood(-3, 24, 'The preacher was driven out')),
      opt('Let him speak: words are only words', dread(4), mood(5, 24, 'The preacher\'s comfort')),
      opt('Seize him and question him', dread(-4), study(180), rep(-2)),
    ],
  },
  {
    id: 'cult_shrine', title: 'The shrine in the woods', who: true, weight: 2,
    text: '{who} found a clearing in the woods with a ring of grey stones, offerings laid in it, and footprints from the town leading to it.',
    when: (s) => stage(s, 3),
    options: [
      dflt('Smash it, and post a watch', dread(-5), raidIn(36)),
      opt('Study the carvings', study(400), dread(3)),
      opt('Leave it be, and say nothing', mood(-6, 48, 'Someone in town worships it')),
    ],
  },
  {
    id: 'calamity_herald', title: 'The herald', weight: 3,
    text: 'A rider in grey stops at the gate and will not come closer. Its master offers the town mercy, it says, for a tithe of everything it has.',
    when: (s) => stage(s, 4),
    options: [
      opt('Pay the tithe', take('coins', 0.3), take('food', 0.15), calm(72)),
      dflt('Send it back with a refusal', mood(6, 48, 'We will not kneel'), raidIn(18)),
      opt('Cut the herald down', dread(-5), raidIn(8), rep(-2)),
    ],
  },
  {
    id: 'calamity_drill', title: 'The town takes up arms', weight: 2,
    text: 'With the dark so near, the town\'s fighters offer to teach everyone the spear, every evening, in the square.',
    when: (s) => stage(s, 3) && people(s, 5),
    options: [
      dflt('Everyone learns', teach('melee', 1, 'all'), mod('work', 0.9, 48, 'Spear drill every evening')),
      opt('Only those who want to', teach('melee', 2, 'random')),
      opt('Fill the stores instead', gain({ wood: 10, stone: 6 }), mod('work', 0.85, 24, 'Hauling for the siege')),
    ],
  },
];
