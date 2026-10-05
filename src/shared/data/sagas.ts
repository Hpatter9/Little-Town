// Sagas: long quest chains, written by hand (the owner's ask: quests and long quest chains, varied, interesting, unique
// and fun; the town takes them on itself, two at a time, and failure bends the story more often than it ends it).
// A saga is a story of chapters. Each chapter is one of the things the game already does:
//   choice  a full-screen question with a picture (the answer's effects are the events' effects, and it may set flags)
//   trip    a place on the Expedition Board a party goes to and fights at (won or lost, or nobody goes in time)
//   task    something the town must have done in time (a building stood, a topic learned, a store laid in)
//   raid    trouble comes to the gate (beaten or not)
//   wait    a while passes
//   end     the story's end: what it leaves the town (effects, a title for its hero, a unique)
// A chapter's next is a chapter id, or a function of the flags set so far. {hero} is the saga's hero (the leader of its
// first trip, else the founder), {founder} the founder, {town} the town, {a} and {b} the townsfolk a saga is about.
// The rules are in sim/sagas.ts.

import type { BackdropId } from './backdrops';
import type { EventEffect, Lever } from './eventKit';
import type { Skill } from './skills';
import type { Stock } from './materials';
import type { Era } from './eras';
import type { GameState } from '../sim/state';
import type { Material } from './materials';

// (the events' shorthands, written out here: data/eventKit.ts can't be loaded this early without a cycle)
const mood = (mood: number, hours: number, text: string): EventEffect => ({ mood, hours, text });
const mod = (lever: Lever, mult: number, hours: number, text: string): EventEffect => ({ mod: lever, mult, hours, text });
const gain = (stock: Stock): EventEffect => ({ gain: stock });
const teach = (skill: Skill, levels: number, on: 'who' | 'random' | 'founder' | 'all' = 'who'): EventEffect => ({ skill, levels, on });
const coin = (n: number): EventEffect => ({ coins: n });
const rep = (n: number): EventEffect => ({ reputation: n });
const calm = (h: number): EventEffect => ({ calm: h });
const raidIn = (h: number): EventEffect => ({ raid: h });

/** A saga's own effects, beside the events': the two townsfolk it's about, the hero's title, a unique. */
export type SagaEffect =
  | EventEffect
  | { castBond: number }
  | { castHurt: 'a' | 'b' | 'both'; hp: number }
  | { castKill: 'a' | 'b'; chance: number; cause: string }
  | { title: string }
  | { unique: string }
  | { join: number; type?: string };

export type Next = string | ((flags: readonly string[], s: GameState) => string);

export interface SagaOption {
  label: string;
  effects?: SagaEffect[];
  /** Flags this answer sets, for later chapters to read. */
  set?: string[];
  next: Next;
}

export type Foes = Record<string, number> | ((s: GameState) => Partial<Record<string, number>>);

export type Chapter =
  | { kind: 'choice'; text: string; picture: BackdropId; options: SagaOption[]; default?: number }
  | {
      kind: 'trip';
      /** The place on the Expedition Board, and what the board says of it. */
      place: string;
      text: string;
      foes: Foes;
      scenery: 'thicket' | 'river' | 'woods' | 'quarry' | 'cave';
      /** Seconds out (each way). */
      out: number;
      loot?: Partial<Record<Material, number>>;
      /** Days the town has to go before it's too late. */
      days: number;
      win: Next;
      lose: Next;
      /** Nobody went in time (else `lose`). */
      late?: Next;
    }
  | { kind: 'task'; text: string; need: string; check: (s: GameState) => boolean; hours: number; done: Next; late: Next }
  | { kind: 'raid'; text: string; raid: 'people' | string; boss?: string; budget: number; after?: number; win: Next; lose: Next }
  | { kind: 'wait'; hours: number; text?: string; next: Next }
  | { kind: 'end'; text: string; outcome: 'triumph' | 'bittersweet' | 'ruin'; effects?: SagaEffect[]; picture?: BackdropId };

export interface SagaDef {
  id: string;
  title: string;
  /** One line for the Quests tab. */
  blurb: string;
  /** Whether the saga can begin in this town now. */
  when: (s: GameState) => boolean;
  /** Two townsfolk the saga is about ({a}, {b}). */
  cast?: boolean;
  first: string;
  chapters: Record<string, Chapter>;
}

const has = (s: GameState, ...ids: string[]) => s.buildings.some((b) => ids.includes(b.def) && b.status === 'done');
const eraAt = (s: GameState, e: Era) => ['neolithic', 'medieval', 'industrial', 'modern', 'space'].indexOf(s.era) >= ['neolithic', 'medieval', 'industrial', 'modern', 'space'].indexOf(e);
const grown = (s: GameState, n: number) => s.people.filter((p) => p.bornTick == null).length >= n;
const dayOf = (s: GameState) => s.tick / (600 * 24);
const byEra = (t: Partial<Record<Era, Record<string, number>>>) => (s: GameState) => t[s.era] ?? t.medieval ?? Object.values(t)[0]!;

/** Bandits by the age. */
const BANDITS = byEra({ neolithic: { rival_spear: 2, rival_slinger: 1 }, medieval: { bandit: 2, bandit_archer: 1 }, industrial: { gangster: 3, rifleman: 1 }, modern: { gangster: 2, raider: 2 }, space: { space_pirate: 3 } });

export const SAGAS: readonly SagaDef[] = [
  /* ------------------------------------------------------------ 1. the burnt cart */
  {
    id: 'burnt_cart',
    title: 'The Burnt Cart',
    blurb: 'A merchant taken, a boy left behind, and a bandit queen who does not forget.',
    when: (s) => dayOf(s) >= 3 && grown(s, 5),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'wasteland_1',
        text: 'A cart lies burnt on the road, its oxen dead in the traces. A boy hiding in the ditch says bandits took his mother, Wynn the merchant, and all her silks. "Black Maud," he whispers, and will not let go of {founder}\'s sleeve.',
        options: [
          { label: 'Take the boy in, and go after them', set: ['boy', 'brave'], next: 'camp' },
          { label: 'Take the boy in, and keep to the walls', set: ['boy'], next: 'wait_raid' },
          { label: 'Send the boy on to the next town', effects: [rep(-1)], next: 'end_sent' },
        ],
      },
      camp: {
        kind: 'trip',
        place: "The camp of Black Maud",
        text: "Smoke in the hills marks Black Maud's camp. Wynn the merchant is a prisoner there, if she still lives.",
        foes: BANDITS,
        scenery: 'woods',
        out: 70,
        loot: { cloth: 3 },
        days: 5,
        win: 'in_camp',
        lose: 'wait_raid',
        late: 'too_late',
      },
      in_camp: {
        kind: 'choice',
        picture: 'forest_2',
        text: "Maud's people scatter into the trees. In the middle of the camp: Wynn in a wooden cage, and beside it Maud's iron-bound strongbox. Maud herself is already on a horse on the ridge, shouting that she will burn {town} to the ground. There is time to carry off one, not both.",
        options: [
          { label: 'Free Wynn', set: ['wynn'], effects: [mood(3, 24, 'We freed the merchant')], next: 'wait_raid' },
          { label: 'Take the strongbox', set: ['box'], effects: [coin(90), gain({ cloth: 8 })], next: 'wait_raid' },
          { label: 'Try for both', next: 'wait_raid', effects: [{ chance: 0.5, then: [coin(60)], else: [{ wound: 'random', hp: 25 }] }], set: ['wynn', 'both'] },
        ],
      },
      wait_raid: { kind: 'wait', hours: 30, text: 'Black Maud gathers every cutthroat in the hills.', next: 'maud_raid' },
      maud_raid: {
        kind: 'raid',
        text: 'Black Maud rides on {town} at the head of her band, as she swore she would.',
        raid: 'people',
        boss: 'bandit_chief',
        budget: 1.2,
        win: (f) => (f.includes('wynn') ? 'end_ally' : f.includes('box') ? 'end_rich' : 'end_held'),
        lose: 'end_maud',
      },
      too_late: {
        kind: 'end',
        outcome: 'bittersweet',
        picture: 'battle_graves',
        text: "When at last someone rode out to Maud's camp it was cold, and Wynn was buried under a cairn beside it. The boy stays in {town}; he does not talk about his mother.",
        effects: [mood(-3, 48, 'We were too slow for Wynn'), { join: 1 }],
      },
      end_sent: {
        kind: 'end',
        outcome: 'bittersweet',
        text: 'The boy goes on down the road with a loaf and a blanket. Nobody in {town} ever learns what became of Wynn, or of him.',
      },
      end_ally: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'summer_1',
        text: "Black Maud falls at the gate, and her band breaks. Wynn the merchant and her son settle in {town}, and her old partners send their caravans this way now. {hero} keeps Maud's knife.",
        effects: [{ join: 1 }, mod('prices', 0.85, 24 * 8, "Wynn's trading friends"), { title: "Maud's Bane" }, { unique: 'maudbane' }],
      },
      end_rich: {
        kind: 'end',
        outcome: 'bittersweet',
        picture: 'battle_ruins',
        text: "Maud is beaten, and the strongbox's silks sell well. But Wynn died in her cage, and her son looks at {hero} every day as if asking why.",
        effects: [coin(60), mood(-2, 72, 'We chose the gold over Wynn'), { join: 1 }, { title: 'the Silk-Taker' }],
      },
      end_held: {
        kind: 'end',
        outcome: 'bittersweet',
        text: "Maud breaks her band on {town}'s walls and flees for good. Nobody went for Wynn; her son grows up in {town}, and becomes the best tracker it ever had.",
        effects: [{ join: 1 }, mood(2, 24, 'We held the walls')],
      },
      end_maud: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'wasteland_1',
        text: 'Black Maud takes what she came for and rides off laughing, with a third of the stores on her carts. She will be back, people say, when she is hungry again.',
        effects: [{ take: 'stores', share: 0.25 }, mood(-6, 72, 'Black Maud robbed us'), raidIn(24 * 5)],
      },
    },
  },

  /* ------------------------------------------------------------ 2. the wolf that walks */
  {
    id: 'wolf_walks',
    title: 'The Wolf That Walks',
    blurb: 'Tracks that start as a man\'s and end as a wolf\'s.',
    when: (s) => dayOf(s) >= 3 && grown(s, 4) && s.origin !== 'werewolf' && !['desert'].includes(s.biome ?? 'forest'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'forest_2',
        text: 'Three sheep lie torn open in the fold at dawn. In the mud by the gate: the prints of a man walking, which halfway across the field become the prints of a wolf, running.',
        options: [
          { label: 'Hunt it down', next: 'lair' },
          { label: 'Ask old Edda the trapper', next: 'edda' },
          { label: 'Bar the doors and wait', next: 'wolf_raid' },
        ],
      },
      edda: {
        kind: 'choice',
        picture: 'abandoned_3',
        text: 'Old Edda spits into the fire. "A man cursed. Bran the woodcutter, I\'d wager: he went into the forest last winter and never came out. Silver will kill him. Wolfsbane might cure him, if you can keep him still long enough to drink it."',
        options: [
          { label: 'Kill it with silver', set: ['silver'], next: 'lair' },
          { label: 'Brew wolfsbane and cure him', set: ['cure'], next: 'brew' },
        ],
      },
      brew: {
        kind: 'task',
        text: 'Wolfsbane wants a herb garden and a healer to brew it.',
        need: 'a herb garden or a healer\'s hut',
        check: (s) => has(s, 'herb_garden', 'healers_hut', 'infirmary', 'hospital'),
        hours: 72,
        done: 'lair',
        late: 'wolf_raid',
      },
      lair: {
        kind: 'trip',
        place: "The wolf's den",
        text: 'Its trail leads to a den under the roots of a dead oak, ringed with gnawed bones.',
        foes: (s) => (eraAt(s, 'medieval') ? { black_werewolf: 1, wolf: 2 } : { black_werewolf: 1, wolf: 1 }),
        scenery: 'woods',
        out: 60,
        loot: { hide: 2 },
        days: 4,
        win: (f) => (f.includes('cure') ? 'bran' : 'end_slain'),
        lose: 'wolf_raid',
      },
      bran: {
        kind: 'choice',
        picture: 'moon_2',
        text: "In the den the beast lies wounded, and under the moonlight it is half a man: thin, grey, weeping. \"Please,\" says Bran the woodcutter. The wolfsbane is in {hero}'s satchel.",
        options: [
          { label: 'Give him the wolfsbane', effects: [{ join: 1, type: 'hunter' }, mood(4, 48, 'We saved Bran')], next: 'end_cured' },
          { label: 'End it here', effects: [gain({ hide: 4 })], next: 'end_slain' },
        ],
      },
      wolf_raid: {
        kind: 'raid',
        text: 'Under the full moon the wolf comes to {town}, and its pack comes with it.',
        raid: 'wolves',
        boss: 'black_werewolf',
        budget: 0.9,
        win: 'end_slain',
        lose: 'end_haunted',
      },
      end_slain: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'forest_4',
        text: 'The wolf that walked like a man lies dead, and {hero} carries its pelt through the gate. Its silvered spear goes over the hearth.',
        effects: [gain({ hide: 3, meat: 6 }), mood(4, 48, 'The wolf is dead'), { title: 'Wolfsbane' }, { unique: 'silvermoon' }],
      },
      end_cured: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'summer_4',
        text: 'Bran the woodcutter lives in {town} now. On full-moon nights he sits by the fire with his hands shaking, and nothing happens. {hero} is the one he thanks.',
        effects: [{ title: 'the Merciful' }, teach('medicine', 2, 'founder')],
      },
      end_haunted: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'moon_3',
        text: 'The wolf takes what it wants and is gone into the forest again. On full-moon nights, nobody in {town} sleeps.',
        effects: [{ herdLoss: 1 }, mood(-5, 96, 'The wolf still hunts us'), { kill: 'random', chance: 0.4, cause: 'by the wolf that walks like a man' }],
      },
    },
  },

  /* ------------------------------------------------------------ 3. the drowned bell */
  {
    id: 'drowned_bell',
    title: 'The Drowned Bell',
    blurb: 'A bell rings under the sea, and a sea-witch sits on it.',
    when: (s) => dayOf(s) >= 3 && grown(s, 4) && (s.biome === 'coast' || s.origin === 'merfolk'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'ocean_2',
        text: 'At the lowest tide of the year the fishers hear it: a bell, ringing under the water off the point, slow and sad, as if for a funeral.',
        options: [
          { label: 'Send divers down to find it', next: 'wreck' },
          { label: 'Leave the sea its secrets', next: 'louder' },
        ],
      },
      louder: { kind: 'wait', hours: 48, text: 'The bell rings every night now, louder, and the fish have gone.', next: 'louder_ask' },
      louder_ask: {
        kind: 'choice',
        picture: 'ocean_5',
        text: 'The bell rings all night now, so loud the children cry, and the nets come up empty. The old fishers say it will not stop until someone answers it.',
        options: [
          { label: 'Answer it: send the divers', next: 'wreck' },
          { label: 'Stop our ears and endure it', next: 'end_tolling' },
        ],
      },
      wreck: {
        kind: 'trip',
        place: 'The drowned chapel',
        text: 'Under the point lies a chapel the sea took long ago. Something guards it.',
        foes: (s) => (eraAt(s, 'medieval') ? { drowned_sailor: 2, squid_spawn: 1 } : { squid_spawn: 2 }),
        scenery: 'river',
        out: 50,
        loot: { pearls: 2, fish: 6 },
        days: 5,
        win: 'morwen',
        lose: 'end_drowned',
      },
      morwen: {
        kind: 'choice',
        picture: 'underwater_3',
        text: 'The bell hangs in the drowned chapel, and on it sits a woman with weed for hair and eyes like the deep. "I am Morwen," she says. "Haul my bell to the land and ring it there, and the sea will remember {town} kindly. Or leave it with me, and I will fill your nets for a year."',
        options: [
          { label: 'Haul the bell home', set: ['bell'], next: 'tower' },
          { label: 'Take her bargain', effects: [gain({ fish: 30 }), mod('crops', 1.15, 24 * 10, "Morwen's bargain")], next: 'end_bargain' },
          { label: 'Strike her down', next: 'witch' },
        ],
      },
      tower: {
        kind: 'task',
        text: 'The bell needs a tower to hang in.',
        need: 'a bell tower or a watchtower',
        check: (s) => has(s, 'bell_tower', 'watchtower', 'radio_tower'),
        hours: 120,
        done: 'end_bell',
        late: 'end_bell_rusts',
      },
      witch: {
        kind: 'trip',
        place: 'The grotto of Morwen',
        text: 'Morwen has gone to her grotto under the reef, angry, with the sea-things she commands.',
        foes: { sea_hag: 1, squid_spawn: 1 },
        scenery: 'river',
        out: 60,
        loot: { pearls: 4 },
        days: 4,
        win: 'end_witch',
        lose: 'end_drowned',
      },
      end_bell: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'ocean_3',
        text: "The drowned bell rings from {town}'s tower now, and on calm days an answering bell rings faintly from under the sea. The fishing has never been better, and no storm has come near.",
        effects: [mood(5, 72, 'The sea-bell rings for us'), calm(24 * 4), { title: 'Bell-Bringer' }, { unique: 'bell_of_morwen' }],
      },
      end_bell_rusts: {
        kind: 'end',
        outcome: 'bittersweet',
        text: 'The bell lies on the strand, rusting, for want of a tower to hang it in. On calm nights it rings by itself, once.',
        effects: [mood(-2, 48, 'The bell lies unhung')],
      },
      end_bargain: {
        kind: 'end',
        outcome: 'bittersweet',
        picture: 'ocean_1',
        text: "Morwen keeps her bell, and her word: the nets come up full all year. But the old fishers won't go out past the point any more, and some nights someone hears singing.",
      },
      end_witch: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'underwater_1',
        text: "Morwen is dead, and her bell comes home on a raft of driftwood. {hero} hangs it from a chain and swings it like a flail; the sea has been sullen ever since.",
        effects: [{ title: 'the Witch-Drowner' }, { unique: 'bell_of_morwen' }, gain({ pearls: 4 })],
      },
      end_drowned: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'underwater_2',
        text: 'The sea keeps its secrets, and some of those who went to learn them. The bell rings every night, now, for them.',
        effects: [mood(-5, 72, 'The sea took our people'), { kill: 'random', chance: 0.5, cause: 'in the drowned chapel' }],
      },
      end_tolling: {
        kind: 'end',
        outcome: 'ruin',
        text: '{town} stops its ears with wax for a season. The fish never come back to the point.',
        effects: [mood(-3, 120, 'The bell under the sea'), { take: 'food', share: 0.15 }],
      },
    },
  },

  /* ------------------------------------------------------------ 4. the feud */
  {
    id: 'feud',
    title: 'The Feud',
    blurb: 'Two households, one field, and a quarrel that will not stay small.',
    when: (s) => dayOf(s) >= 4 && grown(s, 6),
    cast: true,
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'summer_1',
        text: "{a} says {b}'s goats ate the barley. {b} says {a} moved the boundary stones in the night. Their friends are taking sides, and nobody will sit at the same fire. They want {founder} to judge.",
        options: [
          { label: 'Judge for {a}', effects: [{ castBond: -20 }], set: ['for_a'], next: 'brew' },
          { label: 'Judge for {b}', effects: [{ castBond: -20 }], set: ['for_b'], next: 'brew' },
          { label: 'Make them share the field', effects: [{ castBond: -5 }], set: ['fair'], next: 'brew' },
        ],
      },
      brew: { kind: 'wait', hours: 30, text: 'The quarrel festers.', next: 'poison' },
      poison: {
        kind: 'choice',
        picture: 'abandoned_3',
        text: "Someone has poured lamp oil into {a}'s well, and smashed {b}'s loom. Each says the other did it. Half the town has stopped talking to the other half.",
        options: [
          { label: 'Find out who really did it', next: (_f, s) => (s.people.some((p) => p.skills.social.level >= 8) ? 'truth' : 'duel') },
          { label: 'Let them settle it themselves', next: 'duel' },
        ],
      },
      truth: {
        kind: 'choice',
        picture: 'summer_1',
        text: 'It takes a sharp ear to hear it: neither of them did it. A pedlar who wanted their field cheap stirred it all up, and is long gone. {a} and {b} stand in the square, ashamed.',
        options: [
          { label: 'Have them make peace before everyone', effects: [{ castBond: 40 }, mood(4, 48, 'The feud is over')], next: 'end_peace' },
          { label: 'Send them both to work the same field all season', effects: [{ castBond: 25 }, teach('farming', 1, 'all')], next: 'end_peace' },
        ],
      },
      duel: {
        kind: 'choice',
        picture: 'battle_ruins',
        text: '{a} and {b} mean to settle it with knives at dawn in the barley, and their friends have bet on it.',
        options: [
          { label: 'Let them fight', effects: [{ castHurt: 'both', hp: 30 }, { castKill: 'b', chance: 0.35, cause: 'in a duel over a field' }], next: 'end_blood' },
          { label: 'Forbid it, and post a guard', effects: [{ castBond: -10 }, mood(-2, 48, 'The feud simmers')], next: 'end_cold' },
          { label: 'Marry their families instead', effects: [{ castBond: 50 }, mood(5, 48, 'A wedding ended the feud')], next: 'end_wedding' },
        ],
      },
      end_peace: {
        kind: 'end',
        outcome: 'triumph',
        text: "{a} and {b} carve both their names into the old maul that stood by the boundary stone, side by side, and hang it in the square. It's the town's now.",
        effects: [{ unique: 'peacemaker' }, { title: 'the Peacemaker' }],
      },
      end_blood: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'battle_graves',
        text: 'The barley is trampled and red. Whatever the knives settled, {town} is quieter now, and colder.',
        effects: [mood(-5, 96, 'Blood spilled over a field')],
      },
      end_cold: {
        kind: 'end',
        outcome: 'bittersweet',
        text: '{a} and {b} never speak again. Their children will grow up not knowing why.',
      },
      end_wedding: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'summer_2',
        text: "The two households feast together at a wedding nobody expected, and dance on the barley stubble. The old maul by the boundary stone gets both their names carved into it.",
        effects: [{ unique: 'peacemaker' }, { title: 'the Matchmaker' }],
      },
    },
  },

  /* ------------------------------------------------------------ 5. the plague doctor */
  {
    id: 'plague_doctor',
    title: 'The Plague Doctor',
    blurb: 'A sickness coming down the river, and a doctor in a beaked mask.',
    when: (s) => dayOf(s) >= 4 && grown(s, 5) && eraAt(s, 'medieval') && s.origin !== 'lich' && s.origin !== 'robot',
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'abandoned_3',
        text: 'A doctor in a long black coat and a beaked mask comes to the gate. "A sickness is coming down the river. Three villages are already empty. I can stop it, with moonwort from the marsh caves, and a place to brew. My name is Corvin."',
        options: [
          { label: 'Trust him: fetch the moonwort', set: ['trust'], next: 'caves' },
          { label: 'Send him away', next: 'spread' },
        ],
      },
      spread: { kind: 'wait', hours: 24, text: 'The sickness comes down the river, as he said.', next: 'second' },
      second: {
        kind: 'choice',
        picture: 'battle_graves',
        text: 'Two are already burning with fever. Corvin is still camped by the ford, writing in a small black book. He looks up as if he expected them.',
        options: [
          { label: 'Beg his help after all', effects: [{ sick: 2 }], set: ['trust'], next: 'caves' },
          { label: 'Drive him off for good', effects: [{ sickShare: 0.3 }], next: 'end_alone' },
        ],
      },
      caves: {
        kind: 'trip',
        place: 'The marsh caves',
        text: 'Moonwort grows only in the marsh caves, where something has nested.',
        foes: (s) => (eraAt(s, 'industrial') ? { slime: 2, acid_slime: 2 } : { slime: 3, giant_rat: 2 }),
        scenery: 'cave',
        out: 60,
        loot: { herbs: 6 },
        days: 3,
        win: 'brewhouse',
        lose: 'unmasked',
      },
      brewhouse: {
        kind: 'task',
        text: 'Corvin needs a place to brew the cure: a healer\'s hut at least.',
        need: "a healer's hut, an infirmary or a hospital",
        check: (s) => has(s, 'healers_hut', 'infirmary', 'hospital', 'trauma_center'),
        hours: 72,
        done: 'end_cured',
        late: 'unmasked',
      },
      unmasked: {
        kind: 'choice',
        picture: 'moon_3',
        text: "In the dark of the night Corvin's mask slips, and under it there is no face at all: only teeth, and a smell of the grave. He has been feeding on the plague dead of three villages, and {town} was to be the fourth.",
        options: [
          { label: 'Hunt him to his lair', next: 'crypt' },
          { label: 'Burn his camp and drive him out', effects: [{ sickShare: 0.25 }], next: 'end_alone' },
        ],
      },
      crypt: {
        kind: 'trip',
        place: 'The crypt of Corvin',
        text: 'Corvin has fled to an old crypt by the river, where his dead walk.',
        foes: { mummy: 1, zombie: 2, grave_ghost: 1 },
        scenery: 'cave',
        out: 70,
        days: 4,
        win: 'end_ghoul',
        lose: 'end_plague',
      },
      end_cured: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'temple_1',
        text: "The cure works. The sickness passes {town} by, and Corvin leaves at dawn without asking for payment. Only later does {hero} find his lancet left on the doorstep, and a note: \"For the next one.\"",
        effects: [{ heal: 1 }, teach('medicine', 2, 'all'), { title: 'the Healer\'s Hand' }, { unique: 'corvins_lancet' }],
      },
      end_ghoul: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'battle_graves',
        text: "Corvin the ghoul is dead in his crypt, and the plague dead of three villages lie quiet at last. {hero} brings back his lancet; nobody else will touch it.",
        effects: [{ title: 'Ghoulsbane' }, { unique: 'corvins_lancet' }, mood(4, 48, 'The ghoul is dead')],
      },
      end_alone: {
        kind: 'end',
        outcome: 'bittersweet',
        text: '{town} faces the sickness alone, with herbs and prayers and boiled water. Most of it passes.',
        effects: [mood(-2, 48, 'The river fever')],
      },
      end_plague: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'battle_graves',
        text: 'Corvin lives, and the sickness he carries fills the graveyard. In the river villages they say he is still walking, still writing in his book.',
        effects: [{ sickShare: 0.4 }, mood(-6, 96, 'The plague doctor beat us'), { kill: 'random', chance: 0.6, cause: 'of the river fever' }],
      },
    },
  },

  /* ------------------------------------------------------------ 6. the iron crown */
  {
    id: 'iron_crown',
    title: 'The Iron Crown',
    blurb: "A crown in the dirt, a lord who wants it, and a dead queen who wants it more.",
    when: (s) => dayOf(s) >= 5 && grown(s, 6) && eraAt(s, 'medieval'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'ruins_3',
        text: 'Diggers turn up an iron crown set with dull red stones, under the old hill. That same evening three riders come: Lord Aldous\'s men. "That crown was my lord\'s grandfather\'s. Hand it over, with thanks for finding it."',
        default: 1,
        options: [
          { label: 'Give it to Lord Aldous', effects: [coin(50)], next: 'end_vassal' },
          { label: 'Keep it: it was found on our land', set: ['kept'], next: 'aldous' },
          { label: 'Find out whose it really was', next: 'chronicle' },
        ],
      },
      chronicle: {
        kind: 'task',
        text: 'The old chronicles might say whose crown it was, if someone can read them.',
        need: 'Writing learned',
        check: (s) => s.research.done.includes('writing'),
        hours: 72,
        done: 'grey_lady',
        late: 'aldous',
      },
      grey_lady: {
        kind: 'choice',
        picture: 'abandoned_3',
        text: 'The chronicle is plain: the Iron Crown belonged to a queen buried in the barrow on the hill, three hundred years ago, and Aldous\'s grandfather robbed her grave. That night, {founder} dreams of a woman in grey, holding out her hand.',
        options: [
          { label: 'Return it to her barrow', set: ['return'], next: 'barrow' },
          { label: 'Crown {founder} with it', set: ['crowned'], next: 'curse' },
        ],
      },
      barrow: {
        kind: 'trip',
        place: "The Grey Queen's barrow",
        text: "The barrow's door stands open now, as if expecting someone. Her guards are waiting.",
        foes: { skeleton_warrior: 2, skeleton_archer: 1, barrow_wight: 1 },
        scenery: 'cave',
        out: 50,
        days: 5,
        win: 'end_blessed',
        lose: 'curse',
      },
      curse: {
        kind: 'wait',
        hours: 24,
        text: 'The Grey Queen is angry.',
        next: 'end_cursed',
      },
      aldous: {
        kind: 'raid',
        text: 'Lord Aldous comes for the crown himself, with knights and a banner.',
        raid: 'people',
        boss: 'knight_captain',
        budget: 1.25,
        after: 12,
        win: 'captive',
        lose: 'end_taken',
      },
      captive: {
        kind: 'choice',
        picture: 'battle_hall',
        text: 'Lord Aldous kneels in the mud of the square with his hands tied, and his knights are dead or fled. "Name your price," he says.',
        options: [
          { label: 'Ransom him (150 coins)', effects: [coin(150)], next: 'end_ransom' },
          { label: 'Make him swear peace', effects: [mod('travellers', 1.3, 24 * 10, "Aldous's peace")], next: 'end_peace' },
          { label: 'Return the crown to the barrow after all', set: ['return'], next: 'barrow' },
        ],
      },
      end_vassal: {
        kind: 'end',
        outcome: 'bittersweet',
        text: 'Lord Aldous wears the Iron Crown at his feasts, and remembers {town} kindly: no raider dares his roads for a while. But that winter his castle burns, and the crown is never found.',
        effects: [calm(24 * 4)],
      },
      end_blessed: {
        kind: 'end',
        outcome: 'triumph',
        picture: 'temple_3',
        text: "The Iron Crown rests on the Grey Queen's brow again, and her barrow closes by itself. On the threshold {hero} finds her iron sceptre, laid there like a gift.",
        effects: [{ unique: 'grey_queens_sceptre' }, { title: 'the Crown-Bearer' }, mood(5, 72, 'The Grey Queen is at peace')],
      },
      end_cursed: {
        kind: 'end',
        outcome: 'ruin',
        picture: 'moon_3',
        text: "The crown will not come off {founder}'s head until dawn, and by then three houses have burned with a cold grey fire. In the morning it lies on the floor, rusted through.",
        effects: [{ burn: 3 }, mood(-6, 96, "The Grey Queen's curse")],
      },
      end_taken: {
        kind: 'end',
        outcome: 'ruin',
        text: 'Lord Aldous rides away with the Iron Crown and half the stores, and calls {town} his own now.',
        effects: [{ take: 'stores', share: 0.3 }, mood(-5, 72, 'Lord Aldous took the crown')],
      },
      end_ransom: {
        kind: 'end',
        outcome: 'bittersweet',
        text: 'Aldous pays and goes home with nothing. The crown sits in a chest in {town}, and on cold nights the chest is cold to the touch.',
        effects: [{ title: 'Lordbreaker' }],
      },
      end_peace: {
        kind: 'end',
        outcome: 'triumph',
        text: "Aldous swears peace on his sword, and keeps it. His roads are safe, and his merchants come to {town}'s market. The crown hangs in the hall, and nobody wears it.",
        effects: [{ title: 'Lordbreaker' }, rep(2)],
      },
    },
  },
];

export const SAGA_BY_ID: Record<string, SagaDef> = Object.fromEntries(SAGAS.map((g) => [g.id, g]));

/** How many sagas a town follows at once, how often one may begin, and from which day. */
export const MAX_SAGAS = 2;
export const SAGA_GAP_DAYS = 3;
export const SAGA_DAILY = 0.5;
export const SAGA_HOUR = 10;
/** How long a saga's question waits for an answer (game hours) before its default stands. */
export const SAGA_ASK_HOURS = 12;
/** The pull of a saga's trip on a party choosing where to go (against a bounty's coins, a new place's 6). */
export const PULL_SAGA = 12;
