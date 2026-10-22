// The great creature's saga (sim/creature.ts begins it once the town has studied Great Beasts). Signs in the night,
// a broken nest with five young beasts, the player's pick of one (`{ creature: kind }`), its first deed, a test of its
// nature, and its coming of age. Its questions hold the game until they are answered (`waits`), like a question on the
// founder's own trip. {beast} is the creature's name. See data/sagas.ts for how a saga is built.

import { CREATURE_DEFS, CREATURE_KINDS, CREATURE_SAGA } from './creature';
import type { SagaDef } from './sagas';
import { mood, rep } from './sagaKit';

const grownOrGone = (s: Parameters<SagaDef['when']>[0]) => !s.creature || !!s.creature.dead || s.creature.size >= 0.6;

export const CREATURE_SAGA_DEF: SagaDef = {
  id: CREATURE_SAGA,
  title: 'The Great Beast',
  blurb: 'Signs in the night, a broken nest, and a young beast for the town to raise, good or ill.',
  when: () => false,
  apart: true,
  first: 'signs',
  chapters: {
    signs: {
      kind: 'wait',
      hours: 10,
      text: 'Tracks as wide as a cartwheel are pressed into the mud by the fields, and something calls in the night that no one can name. The herds will not settle.',
      next: 'trail',
    },
    trail: {
      kind: 'wait',
      hours: 14,
      text: 'A trail of snapped saplings leads from the wild to a hollow past the fields. {founder} goes to look.',
      next: 'nest',
    },
    nest: {
      kind: 'choice',
      picture: 'forest_3',
      waits: true,
      beasts: true,
      text: 'In the hollow lies a broken nest of the old great beasts, the mother long gone. Five young survive, each of a different kind, hungry and watching {founder}. The town can raise only one. Which will {founder} take home?',
      options: CREATURE_KINDS.map((k) => ({
        label: `The ${CREATURE_DEFS[k].name}: ${CREATURE_DEFS[k].blurb}`,
        effects: [{ creature: k }],
        set: [k],
        next: 'young',
      })),
    },
    young: {
      kind: 'wait',
      hours: 36,
      text: '{beast} follows {founder} about the town and copies everything it sees. What it is praised for, it will do again; what it is scolded for, it will learn to leave.',
      next: 'first_deed',
    },
    first_deed: {
      kind: 'choice',
      picture: 'meadows_2',
      waits: true,
      text: "Before dawn {beast} drags a whole deer to {founder}'s door, proud as anything, and leaves a trail of trampled cabbages behind it. The town gathers to see what {founder} will do.",
      options: [
        { label: 'Praise the kill, and let the cabbages go', effects: [{ creatureTeach: 'hunt', by: 1 }], next: 'growing' },
        { label: 'Praise the kill, and scold it for the garden', effects: [{ creatureTeach: 'hunt', by: 1 }, { creatureTeach: 'eat_crops', by: -1 }], next: 'growing' },
        { label: 'Scold it: it must keep out of the gardens', effects: [{ creatureTeach: 'eat_crops', by: -1 }, { creatureTeach: 'hunt', by: -1 }], next: 'growing' },
      ],
    },
    growing: {
      kind: 'wait',
      hours: 120,
      text: '{beast} grows by the week, and the children climb on it when it lets them.',
      next: 'test',
    },
    test: {
      kind: 'choice',
      picture: 'forest_1',
      waits: true,
      text: "A raiders' scout is caught in the woods, wounded, and {beast} stands over him with its teeth bared. It looks back at {founder}, waiting. Whatever happens here, it will remember.",
      options: [
        { label: 'Call it off, and let the scout go', effects: [{ creatureAlign: 15 }, rep(1)], next: 'come_of_age' },
        { label: 'Let it have its way', effects: [{ creatureAlign: -20 }], next: 'come_of_age' },
        { label: 'Say nothing: let it choose for itself', next: (_f, s) => ((s.creature?.align ?? 0) >= 0 ? 'spared' : 'devoured') },
      ],
    },
    spared: { kind: 'wait', hours: 1, text: '{beast} sniffs the scout, and turns away. He runs, and does not come back.', next: 'come_of_age' },
    devoured: { kind: 'wait', hours: 1, text: '{beast} does not wait to be told. Nobody speaks of the scout again.', next: 'come_of_age' },
    come_of_age: {
      kind: 'task',
      text: '{beast} is not yet grown.',
      need: 'the beast to come of age',
      check: grownOrGone,
      hours: 24 * 80,
      done: (_f, s) => (!s.creature || s.creature.dead ? 'lost' : s.creature.align >= 0 ? 'grown_good' : 'grown_cruel'),
      late: 'grown_late',
    },
    grown_good: {
      kind: 'end',
      outcome: 'triumph',
      text: '{beast} is grown, taller than the roofs, and gentle with it. The children ride it on feast days, and raiders give the town a wide berth.',
      effects: [{ title: 'Beast-Friend' }, mood(4, 48, 'Our great beast is grown'), rep(2)],
    },
    grown_cruel: {
      kind: 'end',
      outcome: 'bittersweet',
      text: '{beast} is grown, taller than the roofs, and the town walks softly around it. Its enemies fear it. So does the town.',
      effects: [{ title: 'Beast-Master' }, mood(-2, 48, 'The beast is grown, and cruel'), rep(1)],
    },
    grown_late: {
      kind: 'end',
      outcome: 'bittersweet',
      text: '{beast} is slow to grow, but it is the town\'s, for good or ill.',
    },
    lost: {
      kind: 'end',
      outcome: 'ruin',
      text: 'The great beast is dead before it was grown. The hollow past the fields is quiet again.',
      effects: [mood(-4, 48, 'The great beast is dead')],
    },
  },
};
