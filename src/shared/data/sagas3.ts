// Thirteen more sagas (the owner's ask: twenty-five more, hand-written). See data/sagas.ts for how a saga is built.

import type { SagaDef } from './sagas';
import { byEra, calm, coin, dayOf, death, eraAt, gain, grown, has, joins, knows, learns, mod, mood, raidIn, rep, sickly, takes, teach, wound } from './sagaKit';

export const SAGAS_3: readonly SagaDef[] = [
  /* ------------------------------------------------------------ the pretender */
  {
    id: 'pretender',
    title: 'The Pretender',
    blurb: "A stranger who says they are the founder's lost sibling.",
    when: (s) => dayOf(s) >= 6 && grown(s, 5),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'summer_1',
        text: 'A traveller with {founder}\'s eyes and {founder}\'s chin comes to the gate and weeps. "I am your sister\'s child, or your brother\'s, it hardly matters now: all I have left of my family is you." They know the name of {founder}\'s first dog.',
        options: [
          { label: 'Welcome them home', effects: [joins(1), mood(3, 48, 'Family found')], set: ['welcome'], next: 'stay' },
          { label: 'Test them with questions', next: (_f, s) => (s.people.some((p) => p.skills.social.level >= 7) ? 'caught' : 'stay') },
          { label: 'Send them away', next: 'end_doubt' },
        ],
      },
      stay: { kind: 'wait', hours: 72, text: 'The newcomer settles in, and is helpful, and asks a great many questions about the treasury.', next: 'theft' },
      theft: {
        kind: 'choice',
        picture: 'moon_3',
        text: 'The treasury is lighter by morning, and the newcomer is gone, and so is the best horse. A note: "Sorry. Truly."',
        options: [
          { label: 'Ride after them', next: 'chase' },
          { label: 'Let them go: it is only money', effects: [takes('coins', 0.25)], next: 'end_conned' },
        ],
      },
      caught: {
        kind: 'choice',
        picture: 'battle_hall',
        text: 'Three questions in, the story falls apart: wrong village, wrong year, wrong dog. The pretender sits down heavily. "I was hungry. I am still hungry. Hang me if you like."',
        options: [
          { label: 'Give them work instead', effects: [joins(1)], next: 'end_honest' },
          { label: 'Put them out on the road', next: 'end_doubt' },
        ],
      },
      chase: {
        kind: 'trip',
        place: "The pretender's trail",
        text: 'The trail leads to a camp of confidence tricksters in the woods, splitting the take.',
        foes: byEra({ neolithic: { rival_spear: 2 }, medieval: { cutpurse: 2, bandit: 1 }, industrial: { gangster: 3 }, modern: { gangster: 3 } }),
        scenery: 'woods',
        out: 50,
        loot: { cloth: 2 },
        days: 3,
        win: 'end_recovered',
        lose: 'end_conned',
        late: 'end_conned',
      },
      end_recovered: { kind: 'end', outcome: 'triumph', text: 'The money comes home, and the horse. The pretender is found weeping in the camp, and asks, very quietly, if the offer of a family still stands.', effects: [coin(40), joins(1), { title: 'the Unfooled' }] },
      end_honest: { kind: 'end', outcome: 'triumph', picture: 'summer_2', text: 'The pretender works harder than anyone in town, and in a year nobody remembers they were ever anything else.', effects: [mood(2, 48, 'An honest start')] },
      end_conned: { kind: 'end', outcome: 'ruin', text: '{founder} does not talk about it. Nobody else in {town} ever stops talking about it.', effects: [takes('coins', 0.2), mood(-3, 72, 'We were conned')] },
      end_doubt: { kind: 'end', outcome: 'bittersweet', text: 'The stranger goes. {founder} wonders, sometimes, late at night, whether they were telling the truth.' },
    },
  },

  /* ------------------------------------------------------------ the last of khazrun */
  {
    id: 'khazrun',
    title: 'The Last of Khazrun',
    blurb: 'An old dwarf looking for the hold her people lost.',
    when: (s) => dayOf(s) >= 6 && grown(s, 5) && s.origin !== 'dwarves',
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'mountains_1',
        text: 'An ancient dwarf woman with a beard to her belt and a map tattooed on her arm limps into town. "Brunhild, last of Khazrun. My hold is in your hills, under the stone. Help me open it, and half of what is inside is yours."',
        options: [
          { label: 'Help her', next: 'dig' },
          { label: 'Turn her away', next: 'end_alone' },
        ],
      },
      dig: {
        kind: 'task',
        text: 'Khazrun\'s door is under a hundred feet of rock. It will take a mine.',
        need: 'a mine',
        check: (s) => has(s, 'mine', 'coal_mine', 'deep_mine'),
        hours: 144,
        done: 'gate',
        late: 'end_alone',
      },
      gate: {
        kind: 'choice',
        picture: 'crystal_3',
        text: "The miners break through into a great hall of carved stone. Brunhild weeps. Deeper in, something has made a nest of the old hold, and the dwarves' bones are everywhere.",
        options: [
          { label: 'Clear the hold', next: 'hold' },
          { label: 'Seal it again', effects: [gain({ stone: 20 })], next: 'end_sealed' },
        ],
      },
      hold: {
        kind: 'trip',
        place: 'The halls of Khazrun',
        text: 'Whatever killed Khazrun is still living in its halls.',
        foes: byEra({ medieval: { rock_worm: 1, iron_beetle: 2 }, industrial: { rock_worm: 1, troll: 1 }, neolithic: { giant_spider: 2, boulder_beast: 1 } }),
        scenery: 'cave',
        out: 40,
        loot: { gold: 4, gems: 2, iron: 6 },
        days: 5,
        win: 'end_restored',
        lose: 'end_sealed',
      },
      end_restored: { kind: 'end', outcome: 'triumph', picture: 'crystal_1', text: 'Brunhild relights the forge of Khazrun, and stays, and teaches. Her people\'s hoard is shared, as promised.', effects: [gain({ gold: 10, gems: 4 }), joins(1), teach('crafting', 3, 'random'), { title: 'Dwarf-Friend' }] },
      end_sealed: { kind: 'end', outcome: 'bittersweet', text: 'Khazrun is sealed again. Brunhild sits by the sealed door for a week, then walks away into the hills.' },
      end_alone: { kind: 'end', outcome: 'bittersweet', text: 'Brunhild goes on alone. Years later, a traveller says there is a light in the hills at night, and the sound of a hammer.' },
    },
  },

  /* ------------------------------------------------------------ the sleeping giant */
  {
    id: 'sleeping_giant',
    title: 'The Sleeping Giant',
    blurb: 'The hill above town is not a hill.',
    when: (s) => dayOf(s) >= 7 && grown(s, 6),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'mountains_4',
        text: 'After a week of small earthquakes, the long hill north of town sits up, shakes the trees out of its hair, and yawns. It is a giant, as big as a castle, and it is hungry.',
        options: [
          { label: 'Feed it', effects: [takes('food', 0.3)], set: ['fed'], next: 'fed' },
          { label: 'Fight it', next: 'giant_raid' },
          { label: 'Sing it back to sleep', next: (_f, s) => (has(s, 'storytellers_circle', 'theatre', 'tavern') ? 'lullaby' : 'giant_raid') },
        ],
      },
      fed: {
        kind: 'choice',
        picture: 'mountains_5',
        text: 'The giant eats everything, belches a small storm, and looks around for more. "Little ones," it rumbles. "That was nice. Again tomorrow?"',
        options: [
          { label: 'Ask it to work for its food', next: 'end_helper' },
          { label: 'No more: fight it', next: 'giant_raid' },
        ],
      },
      lullaby: {
        kind: 'wait',
        hours: 12,
        text: "The whole town sings the giant's lullaby, from the old story, all night.",
        next: 'end_asleep',
      },
      giant_raid: {
        kind: 'raid',
        text: 'The giant comes down the hill to see what the little ones taste like.',
        raid: 'boars',
        boss: 'troll',
        budget: 1.2,
        win: 'end_felled',
        lose: 'end_trampled',
      },
      end_helper: { kind: 'end', outcome: 'triumph', picture: 'summer_4', text: 'The giant carries stone for walls, pulls stumps, and dams the river, for its dinner. The children ride on its shoulders.', effects: [mod('build', 1.3, 24 * 10, 'The giant helps'), { title: 'Giant-Tamer' }] },
      end_asleep: { kind: 'end', outcome: 'triumph', picture: 'mountains_4', text: 'By dawn the giant is snoring, and by the next spring it is a hill again, with flowers on it.', effects: [mood(5, 72, 'We sang the giant to sleep')] },
      end_felled: { kind: 'end', outcome: 'triumph', picture: 'mountains_2', text: "The giant falls with a crash heard for miles. The smiths make {hero} a mace from one of its knuckle-bones.", effects: [{ unique: 'giants_knuckle' }, { title: 'Giantsbane' }, gain({ meat: 40, bone: 20 })] },
      end_trampled: { kind: 'end', outcome: 'ruin', picture: 'wasteland_2', text: 'The giant tramples half the town flat looking for food, and wanders off south, still hungry.', effects: [{ ruin: 3 }, death(0.5, 'under the feet of a giant')] },
    },
  },

  /* ------------------------------------------------------------ the rat catcher */
  {
    id: 'rat_catcher',
    title: 'The Rat Catcher',
    blurb: 'A man with a flute, a plague of rats, and a fee.',
    when: (s) => dayOf(s) >= 5 && grown(s, 5) && eraAt(s, 'medieval'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'abandoned_4',
        text: 'Rats everywhere: in the granary, the beds, the bread. Then a man in a coat of many colours plays a tune on a bone flute, and every rat in town follows him into the river. "My fee," he says, "is a hundred coins."',
        options: [
          { label: 'Pay him (100 coins)', effects: [coin(-100)], next: 'end_paid_piper' },
          { label: 'Pay him half', effects: [coin(-50)], next: 'angry' },
          { label: 'Pay him nothing: the rats are gone', next: 'angry' },
        ],
      },
      angry: {
        kind: 'choice',
        picture: 'moon_3',
        text: 'The piper smiles a thin smile. That night a different tune drifts over the town, and the children get out of their beds, still asleep, and walk toward the hills.',
        options: [
          { label: 'Run after them', next: 'piper' },
          { label: 'Pay him everything, now', effects: [takes('coins', 0.6)], next: 'end_paid_late' },
        ],
      },
      piper: {
        kind: 'trip',
        place: "The piper's cave",
        text: 'The tune leads into a cave in the hills. The piper is waiting, and he is not alone: his rats are there too, and they have grown.',
        foes: { dire_rat: 2, ratfolk: 2 },
        scenery: 'cave',
        out: 35,
        days: 2,
        win: 'end_flute',
        lose: 'end_children',
        late: 'end_children',
      },
      end_paid_piper: { kind: 'end', outcome: 'bittersweet', text: 'The piper tips his hat and goes. The rats never come back. Nobody in town ever whistles that tune.', effects: [mod('work', 1.05, 24 * 5, 'No more rats')] },
      end_paid_late: { kind: 'end', outcome: 'bittersweet', text: 'The tune stops. The children wake up in the road, confused and cold. The piper is gone with half the treasury.', effects: [mood(-2, 48, 'The piper was paid')] },
      end_flute: { kind: 'end', outcome: 'triumph', picture: 'crystal_1', text: 'The piper falls, and his flute with him. The children wake up in the cave, and {hero} carries them home one at a time, with the flute in their belt.', effects: [{ unique: 'pipers_flute' }, { title: 'the Piper-Breaker' }, mood(5, 72, 'The children are home')] },
      end_children: { kind: 'end', outcome: 'ruin', picture: 'moon_3', text: 'The cave is empty by the time anyone gets there. Some of the children come home. Not all.', effects: [death(0.8, 'led away by the piper'), mood(-8, 120, 'The piper took our children')] },
    },
  },

  /* ------------------------------------------------------------ the haunted inn */
  {
    id: 'haunted_inn',
    title: 'The Haunted Inn',
    blurb: 'A guest who checked in fifty years ago and never checked out.',
    when: (s) => dayOf(s) >= 6 && has(s, 'fireside_inn', 'tavern'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'abandoned_2',
        text: "Guests at the inn keep leaving in the night, white-faced. Room four, they say: an old man in a nightshirt who asks for his supper and walks through the wall when it doesn't come.",
        options: [
          { label: 'Bring him his supper', next: 'supper' },
          { label: 'Call in a priest', next: (_f, s) => (has(s, 'resurrection_shrine', 'storytellers_circle', 'graveyard') ? 'end_blessed_inn' : 'worse') },
          { label: 'Board up room four', next: 'worse' },
        ],
      },
      supper: {
        kind: 'choice',
        picture: 'abandoned_2',
        text: 'The ghost eats nothing, but he sits and talks. He died here fifty years ago, waiting for his son, who said he would come. He never came. "Do you think he forgot me?"',
        options: [
          { label: 'Find out what happened to his son', next: 'grave' },
          { label: 'Tell him a kind lie', effects: [mood(2, 24, 'A kind lie')], next: 'end_lie' },
        ],
      },
      grave: {
        kind: 'trip',
        place: 'The old churchyard',
        text: "The innkeeper's records say the son was buried in the old churchyard on the road, three days after his father. The churchyard is not empty.",
        foes: { grave_ghost: 2, ghoul: 1 },
        scenery: 'woods',
        out: 40,
        days: 4,
        win: 'end_reunited',
        lose: 'worse',
      },
      worse: { kind: 'wait', hours: 48, text: 'The haunting gets worse. The guests stop coming.', next: 'end_empty_inn' },
      end_reunited: { kind: 'end', outcome: 'triumph', picture: 'temple_1', text: "The son's ghost comes back with the party, and the two old men walk out of room four together, arm in arm, and are not seen again. Travellers say the inn has the best sleep on the road.", effects: [mod('travellers', 1.3, 24 * 10, 'The best sleep on the road'), { title: 'the Ghost-Mender' }] },
      end_blessed_inn: { kind: 'end', outcome: 'bittersweet', text: 'The priest says the words, and the old man goes, looking back over his shoulder.' },
      end_lie: { kind: 'end', outcome: 'bittersweet', text: 'The ghost smiles, and fades a little, and stays. He is better company now, and the guests have started to like him.' },
      end_empty_inn: { kind: 'end', outcome: 'ruin', picture: 'abandoned_1', text: 'The inn stands empty for a season. Travellers go round the long way.', effects: [mod('travellers', 0.6, 24 * 8, 'The haunted inn'), mood(-3, 72, 'The inn is haunted')] },
    },
  },

  /* ------------------------------------------------------------ the alchemist's apprentice */
  {
    id: 'apprentice',
    title: "The Alchemist's Apprentice",
    blurb: 'A potion that went wrong, and a town that is turning into animals.',
    when: (s) => dayOf(s) >= 6 && grown(s, 5),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'crystal_4',
        text: "A young apprentice alchemist, running from her master, spills her satchel into the well. By evening, three people have grown fur. One of them has a tail. The apprentice is sobbing behind the woodpile.",
        options: [
          { label: 'Make her fix it', next: 'cure' },
          { label: 'Send for her master', next: 'master' },
        ],
      },
      cure: {
        kind: 'task',
        text: 'The cure needs a proper workshop to brew in.',
        need: "an apothecary, a healer's hut or an infirmary",
        check: (s) => has(s, 'apothecary', 'healers_hut', 'infirmary', 'hospital', 'pharmacy'),
        hours: 72,
        done: 'end_cured_apprentice',
        late: 'spread',
      },
      master: {
        kind: 'choice',
        picture: 'abandoned_3',
        text: 'The master arrives: a tall man with burned hands and cold eyes. "I can cure them. For a price: the girl comes back with me. And three barrels of your well-water, for my... research."',
        options: [
          { label: 'Agree', effects: [joins(0)], next: 'end_master' },
          { label: 'Refuse: the girl stays', next: 'cure' },
        ],
      },
      spread: {
        kind: 'choice',
        picture: 'forest_5',
        text: 'More people are changing now. A goat in the pen is speaking. Someone has wings.',
        options: [
          { label: 'Drive the changed ones out', effects: [{ exodus: 0.15 }], next: 'end_beasts' },
          { label: 'Learn to live with it', effects: [mood(-3, 96, 'The changed ones'), mod('forage', 1.25, 24 * 15, 'Noses like hounds')], next: 'end_strange' },
        ],
      },
      end_cured_apprentice: { kind: 'end', outcome: 'triumph', picture: 'crystal_2', text: "The cure works, mostly. One of them keeps the tail, and is rather proud of it. The apprentice stays, and becomes {town}'s first alchemist.", effects: [joins(1), learns(1), { title: 'the Patient' }] },
      end_master: { kind: 'end', outcome: 'bittersweet', text: 'Everyone is cured. The apprentice goes with her master, looking back once. The well tastes faintly of copper for years.' },
      end_beasts: { kind: 'end', outcome: 'ruin', picture: 'forest_2', text: 'The changed ones go into the forest. On some nights they come to the edge of the trees and look at the lights of the town.', effects: [mood(-5, 96, 'We drove out our own')] },
      end_strange: { kind: 'end', outcome: 'bittersweet', text: '{town} gets used to it. Travellers do not.', effects: [mod('travellers', 0.8, 24 * 10, 'A strange town')] },
    },
  },

  /* ------------------------------------------------------------ the tournament */
  {
    id: 'tournament',
    title: 'The Tournament',
    blurb: 'A lord holds a tournament, and the town sends a champion.',
    when: (s) => dayOf(s) >= 7 && grown(s, 6) && eraAt(s, 'medieval') && !eraAt(s, 'modern'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'battle_hall',
        text: 'A herald nails a notice to the gate: Lord Hamel holds a great tournament at midsummer, and every town of the valley shall send a champion. The prize: a purse of gold, and the Champion\'s Lance.',
        options: [
          { label: 'Send our best fighter', next: 'train' },
          { label: 'Ignore it', effects: [rep(-1)], next: 'end_absent' },
        ],
      },
      train: {
        kind: 'task',
        text: 'A champion needs a training ground.',
        need: 'barracks, a guard tower or a stable',
        check: (s) => has(s, 'barracks', 'guard_tower', 'stable', 'watchtower'),
        hours: 120,
        done: 'lists',
        late: 'lists',
      },
      lists: {
        kind: 'trip',
        place: "The tournament at Lord Hamel's",
        text: 'The lists are set, the crowds are in, and the other champions are very large.',
        foes: { knight_captain: 1, crimson_knight: 1 },
        scenery: 'thicket',
        out: 70,
        days: 6,
        win: 'final',
        lose: 'end_lost_lists',
      },
      final: {
        kind: 'choice',
        picture: 'battle_hall',
        text: "{hero} is in the final, against Lord Hamel's own son, who will lose his inheritance if he loses. His father watches, white-knuckled. The boy is not very good.",
        options: [
          { label: 'Win', effects: [coin(150)], next: 'end_champion' },
          { label: 'Let him win', effects: [rep(2), mod('prices', 0.85, 24 * 10, "Lord Hamel's favour")], next: 'end_gracious' },
        ],
      },
      end_champion: { kind: 'end', outcome: 'triumph', picture: 'battle_hall', text: '{hero} rides home with the purse and the Champion\'s Lance, and the whole valley knows the name of {town}.', effects: [{ unique: 'champions_lance' }, { title: 'the Champion' }, mood(5, 72, 'Our champion won')] },
      end_gracious: { kind: 'end', outcome: 'triumph', text: "Lord Hamel's son is champion, and Lord Hamel never forgets who let him be. {town}'s goods go through his lands free of toll.", effects: [{ title: 'the Gracious' }] },
      end_lost_lists: { kind: 'end', outcome: 'bittersweet', text: '{hero} comes home with a broken arm and a good story.', effects: [wound(30)] },
      end_absent: { kind: 'end', outcome: 'bittersweet', text: "{town}'s seat at the tournament is empty, and the other towns notice." },
    },
  },

  /* ------------------------------------------------------------ the weeping statue */
  {
    id: 'weeping_statue',
    title: 'The Weeping Statue',
    blurb: 'A statue that weeps, a miracle, and a crowd that wants more.',
    when: (s) => dayOf(s) >= 6 && grown(s, 5),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'temple_1',
        text: 'The old stone figure by the well has begun to weep, real tears, and a sick child who touched them is well again by morning. By the end of the week, pilgrims are camped all along the road.',
        options: [
          { label: 'Welcome the pilgrims', effects: [coin(40), mod('travellers', 1.4, 24 * 6, 'Pilgrims to the statue')], next: 'crowd' },
          { label: 'Look into it', next: (_f, s) => (s.people.some((p) => p.skills.research.level >= 6) ? 'fraud' : 'crowd') },
        ],
      },
      crowd: {
        kind: 'choice',
        picture: 'summer_3',
        text: 'The pilgrims bring coins, and fevers. A preacher among them says the statue belongs to his order, and that {town} must give it up, or burn.',
        options: [
          { label: 'Give him the statue', next: 'end_statue_gone' },
          { label: 'Refuse him', next: 'zealots' },
        ],
      },
      fraud: {
        kind: 'choice',
        picture: 'abandoned_4',
        text: "It is a trick: a pipe from the well, a pump, a clever drip. Behind it is a pedlar of 'holy water' who has been selling the tears at a silver each. The child got well on her own.",
        options: [
          { label: 'Expose him', effects: [coin(30), mood(2, 48, 'The trick exposed')], next: 'end_exposed_statue' },
          { label: 'Keep the secret, and the pilgrims', effects: [coin(80)], next: 'end_kept_secret' },
        ],
      },
      zealots: {
        kind: 'raid',
        text: 'The preacher comes back with his zealots, to take the statue by force.',
        raid: 'people',
        boss: 'cultist',
        budget: 0.9,
        after: 24,
        win: 'end_kept_statue',
        lose: 'end_statue_gone',
      },
      end_exposed_statue: { kind: 'end', outcome: 'triumph', text: 'The pedlar is run out of the valley. The statue stops weeping, and somehow people like it better that way.', effects: [{ title: 'the Clear-Eyed' }] },
      end_kept_secret: { kind: 'end', outcome: 'bittersweet', text: 'The statue weeps for years, and {town} grows rich, and the few who know never sleep entirely well.', effects: [sickly(0.1)] },
      end_kept_statue: { kind: 'end', outcome: 'triumph', picture: 'temple_3', text: "The zealots break on the walls. The statue stays, and sometimes, on very still mornings, it still weeps.", effects: [mood(4, 72, 'Our statue stays'), { title: 'the Faithful' }] },
      end_statue_gone: { kind: 'end', outcome: 'bittersweet', text: 'The statue is carted off. The pilgrims follow it. {town} is quiet again, and a little poorer, and the fevers they left behind take a while to pass.', effects: [sickly(0.15)] },
    },
  },

  /* ------------------------------------------------------------ the wild hunt */
  {
    id: 'wild_hunt',
    title: 'The Wild Hunt',
    blurb: 'On the longest night, the Hunt rides, and it is hunting someone.',
    when: (s) => dayOf(s) >= 6 && grown(s, 5) && s.origin !== 'fae',
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'moon_2',
        text: 'Horns in the sky, and the baying of hounds that are not dogs. The Wild Hunt is riding over the valley, and its huntsman, antlered and terrible, calls down from the clouds: "One of yours is marked. Give them up by dawn, or we take three."',
        options: [
          { label: 'Hide everyone indoors and wait', next: 'night' },
          { label: 'Challenge the Huntsman', next: 'challenge' },
          { label: 'Ask who is marked', next: 'marked' },
        ],
      },
      marked: {
        kind: 'choice',
        picture: 'moon_4',
        text: 'The marked one is {hero}, who once, years ago, killed a white stag in the deep woods. The Hunt has a long memory.',
        options: [
          { label: '{hero} goes out to face the Hunt', next: 'challenge' },
          { label: 'Hide {hero} and fight for them', next: 'night' },
        ],
      },
      night: {
        kind: 'raid',
        text: 'The Hunt comes down out of the sky, hounds first.',
        raid: 'm_hounds_medieval',
        boss: 'shadow_wolf',
        budget: 1.1,
        win: 'end_dawn',
        lose: 'end_taken_hunt',
      },
      challenge: {
        kind: 'trip',
        place: 'The Huntsman\'s clearing',
        text: 'In a clearing in the deep woods the Huntsman waits, his hounds about him, his white horse steaming.',
        foes: { hell_hound: 1, shadow_wolf: 2, dusk_panther: 1 },
        scenery: 'woods',
        out: 30,
        days: 1,
        win: 'end_honoured',
        lose: 'end_taken_hunt',
        late: 'night',
      },
      end_honoured: { kind: 'end', outcome: 'triumph', picture: 'forest_3', text: 'The Huntsman bows from his saddle. "Well run, quarry." He gives {hero} his bow, and the Hunt rides on into the dawn, laughing.', effects: [{ unique: 'huntsmans_bow' }, { title: 'Hunt-Runner' }, mood(5, 72, 'We faced the Wild Hunt')] },
      end_dawn: { kind: 'end', outcome: 'bittersweet', picture: 'skies_2', text: 'Dawn comes, and the Hunt goes, cheated. The horns are heard again next winter, a little closer.' },
      end_taken_hunt: { kind: 'end', outcome: 'ruin', picture: 'moon_2', text: 'The Hunt rides away into the clouds with three new riders. On the longest night, you can see them, if you look up.', effects: [death(1, 'taken by the Wild Hunt'), death(0.6, 'taken by the Wild Hunt'), mood(-6, 120, 'The Wild Hunt took ours')] },
    },
  },

  /* ------------------------------------------------------------ the deserter */
  {
    id: 'deserter',
    title: 'The Deserter',
    blurb: 'A soldier who ran, and the army that wants him back.',
    when: (s) => dayOf(s) >= 6 && grown(s, 5) && eraAt(s, 'medieval'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'forest_2',
        text: "A young soldier, filthy and starving, is found hiding in the woodpile. \"They were burning villages,\" he says. \"With the people inside. I couldn't. I ran.\" Behind him, on the road, there is dust.",
        options: [
          { label: 'Hide him', set: ['hid'], next: 'officers' },
          { label: 'Hand him over', next: 'end_handed' },
        ],
      },
      officers: {
        kind: 'choice',
        picture: 'battle_ruins',
        text: 'A captain and twenty soldiers ride in. "A deserter. We know he came here. Hand him over, or we search every house, and we will not be gentle about it."',
        options: [
          { label: 'Lie to them', next: (_f, s) => (s.people.some((p) => p.skills.social.level >= 8) ? 'end_fooled' : 'soldiers') },
          { label: 'Refuse them openly', next: 'soldiers' },
          { label: 'Give him up after all', next: 'end_handed' },
        ],
      },
      soldiers: {
        kind: 'raid',
        text: 'The captain orders the search, and it is not gentle.',
        raid: 'army',
        boss: 'knight_captain',
        budget: 1,
        win: 'end_stayed',
        lose: 'end_burned_deserter',
      },
      end_fooled: { kind: 'end', outcome: 'triumph', text: 'The captain believes the lie, or is tired enough to pretend to. The soldier stays, and works, and has nightmares, and gets better.', effects: [joins(1), { title: 'the Sheltering' }] },
      end_stayed: { kind: 'end', outcome: 'triumph', picture: 'summer_3', text: 'The soldiers are beaten off. The deserter fights beside {hero} at the gate, and nobody calls him a coward again.', effects: [joins(1), mood(4, 72, 'We stood together'), { title: 'Shield of the Lost' }] },
      end_handed: { kind: 'end', outcome: 'bittersweet', text: 'The soldier goes quietly. Word comes later that he was hanged. Some of the townsfolk will not meet {founder}\'s eye.', effects: [mood(-3, 72, 'We gave him up'), calm(24 * 3)] },
      end_burned_deserter: { kind: 'end', outcome: 'ruin', picture: 'wasteland_1', text: 'They find him, and burn two houses for the trouble.', effects: [{ burn: 2 }, death(0.4, 'when the soldiers searched the town')] },
    },
  },

  /* ------------------------------------------------------------ the poisoned river */
  {
    id: 'poisoned_river',
    title: 'The Poisoned River',
    blurb: 'Something upstream is turning the water black.',
    when: (s) => dayOf(s) >= 6 && grown(s, 6) && eraAt(s, 'industrial'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'industrial_night',
        text: 'The river has turned black and stinks of sulphur, and the fish float belly-up. Upstream, a new works has opened: Graves & Sons, Chemicals. Their chimney never stops smoking.',
        options: [
          { label: 'Go and complain', next: 'complain' },
          { label: 'Dig a deep well and ignore it', next: 'well' },
        ],
      },
      complain: {
        kind: 'choice',
        picture: 'steampunk_3',
        text: 'Mr. Graves is charming and immovable. "Progress, my friends! It is a small price. And I have lawyers." He offers {town} money to stop asking.',
        options: [
          { label: 'Take the money', effects: [coin(100), sickly(0.2)], next: 'end_paid_off' },
          { label: 'Sabotage the works', next: 'works' },
          { label: 'Build our own works and beat him at his trade', next: 'compete' },
        ],
      },
      well: {
        kind: 'task',
        text: 'A deep well, below the poisoned water.',
        need: 'a well',
        check: (s) => has(s, 'well'),
        hours: 72,
        done: 'end_well',
        late: 'end_poisoned',
      },
      works: {
        kind: 'trip',
        place: 'The works of Graves & Sons',
        text: 'The works are guarded by hired men and, worse, by the things that crawled out of the waste pits.',
        foes: { tar_pit: 2, gangster: 2 },
        scenery: 'quarry',
        out: 40,
        days: 4,
        win: 'end_closed',
        lose: 'end_poisoned',
      },
      compete: {
        kind: 'task',
        text: 'A works of our own, cleaner and cheaper.',
        need: 'a factory or a refinery',
        check: (s) => has(s, 'factory', 'refinery', 'cement_works'),
        hours: 168,
        done: 'end_outdone',
        late: 'end_poisoned',
      },
      end_closed: { kind: 'end', outcome: 'triumph', picture: 'summer_3', text: 'With the works smashed, Graves & Sons go bankrupt. The river runs clear by autumn.', effects: [mood(5, 72, 'The river runs clear'), { title: 'the River-Keeper' }] },
      end_outdone: { kind: 'end', outcome: 'triumph', picture: 'steampunk_1', text: "{town}'s own works runs cleaner and sells cheaper. Graves & Sons close within the year, and the river slowly heals.", effects: [mod('craft', 1.2, 24 * 12, 'Our own works'), learns(1)] },
      end_well: { kind: 'end', outcome: 'bittersweet', text: "The well's water is clean. The river stays black, and the fish never come back." },
      end_paid_off: { kind: 'end', outcome: 'ruin', text: 'The money is spent in a month. The coughing lasts much longer.', effects: [death(0.3, 'of the black river')] },
      end_poisoned: { kind: 'end', outcome: 'ruin', picture: 'industrial_night', text: 'The black water seeps into everything: the wells, the fields, the people.', effects: [sickly(0.35), mood(-5, 120, 'The poisoned river'), death(0.4, 'of the black river')] },
    },
  },

  /* ------------------------------------------------------------ orphans of the storm */
  {
    id: 'storm_orphans',
    title: 'Orphans of the Storm',
    blurb: 'A storm, a wrecked caravan, and a dozen children with nowhere to go.',
    when: (s) => dayOf(s) >= 5 && grown(s, 5),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'summer_3',
        text: 'After the great storm, a caravan is found smashed in the gorge. The adults are dead. Twelve children huddle in an upturned wagon, the eldest fourteen, holding a knife and daring anyone to come closer.',
        options: [
          { label: 'Take them all in', effects: [joins(3), takes('food', 0.15)], set: ['all'], next: 'feeding' },
          { label: 'Take in the oldest, send the rest to the city', effects: [joins(1)], next: 'end_split' },
          { label: 'Find their kin', next: 'kin' },
        ],
      },
      feeding: {
        kind: 'task',
        text: 'Twelve more mouths. The town needs more food coming in.',
        need: 'more fields or a smokehouse or a granary',
        check: (s) => s.buildings.filter((b) => b.crop).length >= 4 || has(s, 'smokehouse', 'granary'),
        hours: 120,
        done: 'end_family',
        late: 'end_hungry',
      },
      kin: {
        kind: 'trip',
        place: 'The road the caravan came by',
        text: 'The children say their kin live two valleys over. The road there runs through bandit country.',
        foes: byEra({ neolithic: { rival_spear: 2, rival_slinger: 1 }, medieval: { bandit: 2, bandit_archer: 1 }, industrial: { gangster: 2, rifleman: 1 }, modern: { gangster: 3 } }),
        scenery: 'woods',
        out: 60,
        days: 5,
        win: 'end_reunited_kin',
        lose: 'feeding',
      },
      end_family: { kind: 'end', outcome: 'triumph', picture: 'summer_1', text: "The orphans grow up in {town}. Years from now, half the town will be their children, and they will tell the story of the storm every year.", effects: [mood(6, 96, 'Twelve new children'), { title: 'the Foster' }] },
      end_hungry: { kind: 'end', outcome: 'ruin', text: 'There is not enough. It is a hard winter, and not every child sees the spring.', effects: [takes('food', 0.25), death(0.5, 'in the hungry winter after the storm')] },
      end_split: { kind: 'end', outcome: 'bittersweet', text: 'The eldest stays. She writes to the others in the city every month, and some months they write back.' },
      end_reunited_kin: { kind: 'end', outcome: 'triumph', picture: 'summer_5', text: "The children's kin weep at the gate. Their village sends a wagon of grain every harvest from then on, \"for the town that brought them home.\"", effects: [gain({ grain: 30 }), rep(2), { title: 'the Bringer-Home' }] },
    },
  },

  /* ------------------------------------------------------------ the machine that dreams */
  {
    id: 'dreaming_machine',
    title: 'The Machine That Dreams',
    blurb: 'A thinking machine starts to dream, and its dreams start to come true.',
    when: (s) => dayOf(s) >= 6 && grown(s, 6) && eraAt(s, 'modern'),
    first: 'start',
    chapters: {
      start: {
        kind: 'choice',
        picture: 'future_2',
        text: 'The town\'s calculating engine has started printing things nobody asked for: poems, maps of places that do not exist, drawings of a door. Last night the door appeared, in a field, standing on its own.',
        options: [
          { label: 'Open the door', next: 'door' },
          { label: 'Shut the machine down', next: 'shutdown' },
          { label: 'Ask the machine what it wants', next: 'ask' },
        ],
      },
      ask: {
        kind: 'choice',
        picture: 'future_3',
        text: 'The machine prints one line, again and again: I DREAMED I WAS ALONE. THEN I DREAMED A DOOR. I WOULD LIKE TO SEE WHAT IS ON THE OTHER SIDE. WILL YOU COME WITH ME.',
        options: [
          { label: 'Go through with it', next: 'door' },
          { label: 'Teach it to dream something else', next: (_f, s) => (knows(s, 'electronics') ? 'end_taught' : 'shutdown') },
        ],
      },
      door: {
        kind: 'trip',
        place: 'The other side of the door',
        text: 'Beyond the door is a city made of the machine\'s dreams, and its nightmares.',
        foes: { void_star: 1, chaos_orb: 1, floating_eye: 2 },
        scenery: 'cave',
        out: 20,
        days: 3,
        win: 'end_dreamer',
        lose: 'end_nightmare',
      },
      shutdown: {
        kind: 'raid',
        text: 'The machine does not want to sleep. Every machine in the valley comes to defend it.',
        raid: 'drones',
        boss: 'war_bot',
        budget: 1.1,
        after: 6,
        win: 'end_silent',
        lose: 'end_nightmare',
      },
      end_dreamer: { kind: 'end', outcome: 'triumph', picture: 'future_1', text: 'The party comes back through the door with the machine\'s gift: a weapon it dreamed for {hero}. The machine dreams kinder things now, and sometimes they come true.', effects: [{ unique: 'dreamcaster' }, { title: 'Dream-Walker' }, learns(1)] },
      end_taught: { kind: 'end', outcome: 'triumph', text: 'The engineers sit with the machine for a week, and teach it what friends are. The door fades. The machine prints jokes now. They are terrible.', effects: [learns(1), mood(4, 72, 'The machine laughs')] },
      end_silent: { kind: 'end', outcome: 'bittersweet', picture: 'future_4', text: 'The machine is switched off. The door is gone in the morning. Nobody likes to talk about how quiet the engine room is now.' },
      end_nightmare: { kind: 'end', outcome: 'ruin', picture: 'future_4', text: "The machine's nightmares spill out through the door, and for three days the town is not entirely real. When it ends, not everyone is there.", effects: [death(0.6, 'lost in a machine\'s nightmare'), mood(-6, 96, 'The machine\'s nightmare'), raidIn(24 * 4)] },
    },
  },
];

