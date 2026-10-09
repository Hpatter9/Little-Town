// "Today's diary" (the owner's ask: townsfolk with more inner life): a page in each townsperson's own words, written
// by sim/diary.ts from what they did today (the hours at each thing, who was beside them), what they did of note
// (`remember`), how they feel and why, their hurts, their grief, a raid, a feast, the town's talk. The words here: how
// each nature opens and closes a page and takes the day, and what each of the day's doings is in a sentence.

import type { NatureId } from './natures';

export interface Voice {
  /** How a page starts ({day} filled). */
  open: string[];
  /** How a page ends. */
  close: string[];
  /** After the day's work: said of good hours, and of hard ones. */
  workGood: string[];
  workHard: string[];
  /** How they are: in good spirits, middling, low. */
  happy: string[];
  fine: string[];
  low: string[];
}

export const VOICES: Record<NatureId, Voice> = {
  cheerful: {
    open: ['Dear diary, what a day!', 'Day {day}, and the sun came up for me again.', 'Another lovely day, diary.'],
    close: ['Tomorrow will be even better!', 'Night night, diary!', 'Can\'t wait for the morning.'],
    workGood: ['and I loved every minute.', 'and the time flew by.'], workHard: ['and even that was fun, mostly.', 'and I sang to keep going.'],
    happy: ['My heart is full.', 'I\'m so happy here.'], fine: ['All in all, a good one.', 'Not bad at all!'], low: ['Not my best day, but tomorrow will be.', 'I\'m trying to smile.'],
  },
  grumpy: {
    open: ['Day {day}. Nobody asked, but here it is.', 'Another day. Hmph.', 'Diary. Day {day}. Don\'t ask.'],
    close: ['Bed. Finally.', 'Tomorrow will be the same, no doubt.', 'Enough.'],
    workGood: ['and nobody thanked me.', 'which I did properly, unlike some.'], workHard: ['and my back knows it.', 'and I\'ve the blisters to prove it.'],
    happy: ['Could have been worse. Don\'t tell anyone.', 'I suppose it was all right.'], fine: ['Same as ever.', 'Nothing to write home about.'], low: ['Everything ached and everyone annoyed me.', 'A rotten day all round.'],
  },
  shy: {
    open: ['Day {day}.', '...dear diary.', 'It\'s quiet now. Day {day}.'],
    close: ['Goodnight.', 'Quiet now.', '...that\'s all.'],
    workGood: ['and nobody bothered me.', 'quietly.'], workHard: ['and I didn\'t complain.', 'though I was tired.'],
    happy: ['I felt... happy. I think.', 'A good, quiet day.'], fine: ['It was all right.', 'Nothing much.'], low: ['I kept to myself.', 'I didn\'t feel like talking.'],
  },
  bold: {
    open: ['Day {day}, and I faced it head on!', 'Day {day}. Ha!', 'Another day conquered.'],
    close: ['Tomorrow I\'ll do more.', 'Bring on the morning!', 'Sleep, then glory.'],
    workGood: ['and did the work of two.', 'faster than anyone.'], workHard: ['and I didn\'t stop once.', 'and it didn\'t beat me.'],
    happy: ['I feel strong.', 'Nothing can touch me.'], fine: ['Fair enough day.', 'I\'ve had better, I\'ve had worse.'], low: ['Even I have bad days. Tomorrow, though!', 'I\'m angry, and I\'ll use it.'],
  },
  dreamy: {
    open: ['Day {day}... or was it?', 'Dear diary, the clouds were lovely today.', 'Another day drifted by.'],
    close: ['I wonder what I\'ll dream.', 'The stars are out. Goodnight.', 'Somewhere, a bird is singing.'],
    workGood: ['and my mind wandered somewhere nice.', 'and I hummed the whole time.'], workHard: ['and I forgot what I was doing twice.', 'and dreamed of being elsewhere.'],
    happy: ['Everything felt soft and golden.', 'I floated through it.'], fine: ['The day was a quiet song.', 'Neither here nor there.'], low: ['A grey sort of day inside me.', 'I felt far away from everyone.'],
  },
  pious: {
    open: ['Day {day}. Thanks be for it.', 'Blessed be this day, diary.', 'The gods kept me another day.'],
    close: ['I give thanks, and sleep.', 'May the gods watch over us tonight.', 'Amen to that.'],
    workGood: ['and the work was a prayer.', 'with thanks for strong hands.'], workHard: ['and I offered up the ache.', 'a test of my patience.'],
    happy: ['My spirit is light.', 'I felt blessed.'], fine: ['A day like any the gods give.', 'All is as it should be.'], low: ['My faith is tested.', 'I prayed for strength.'],
  },
  greedy: {
    open: ['Day {day}. Accounts.', 'Diary: day {day}. Let me tally up.', 'Another day, another coin. I hope.'],
    close: ['Coins counted. Twice.', 'Must earn more tomorrow.', 'Locking this diary now.'],
    workGood: ['and it paid, which is the point.', 'for a fair wage, nearly.'], workHard: ['and the pay doesn\'t cover it.', 'for barely a coin.'],
    happy: ['A profitable sort of day.', 'I feel rich in spirit. And hopefully in coin.'], fine: ['Broke even, more or less.', 'Neither gain nor loss.'], low: ['A losing day.', 'Everyone wants something from me.'],
  },
  kind: {
    open: ['Dear diary, day {day}.', 'Day {day}. I hope everyone is well.', 'Another day with these good people.'],
    close: ['I hope everyone sleeps well.', 'Goodnight, all of you.', 'Tomorrow I\'ll help more.'],
    workGood: ['and helped where I could.', 'and it did the town good.'], workHard: ['and I\'m tired, but glad to.', 'and gladly.'],
    happy: ['My heart is warm.', 'I\'m thankful for everyone.'], fine: ['A gentle sort of day.', 'All well enough.'], low: ['I worry for us all.', 'Heavy-hearted tonight.'],
  },
  proud: {
    open: ['Day {day}. Another triumph, naturally.', 'Day {day}, recorded for posterity.', 'Diary, you are lucky to hear this.'],
    close: ['They\'ll remember my name.', 'Rest, for greatness.', 'As expected of me.'],
    workGood: ['and did it better than anyone could.', 'with my usual flair.'], workHard: ['and made it look easy.', 'and never let them see me tire.'],
    happy: ['I outdid myself.', 'Splendid, as ever.'], fine: ['Adequate. For me.', 'A modest day, by my standards.'], low: ['Beneath me, all of it.', 'Nobody appreciates me.'],
  },
  curious: {
    open: ['Day {day}! Things I learned:', 'Dear diary, today I wondered about everything.', 'Day {day}, and so many questions.'],
    close: ['So many questions for tomorrow.', 'I wonder what tomorrow brings!', 'Must find out more.'],
    workGood: ['and I worked out a better way.', 'and found out how it really works.'], workHard: ['and wondered why it\'s done that way.', 'and asked too many questions.'],
    happy: ['Fascinating day!', 'I learned something new.'], fine: ['Interesting enough.', 'A day of small puzzles.'], low: ['Even puzzles didn\'t cheer me.', 'I couldn\'t think straight.'],
  },
  gloomy: {
    open: ['Day {day}. Survived it, barely.', 'Another day closer to the end.', 'Day {day}. Grey.'],
    close: ['Tomorrow will be worse, no doubt.', 'Sleep. If it comes.', 'Nothing more to say.'],
    workGood: ['and it\'ll only fall apart.', 'for whatever good it does.'], workHard: ['and it was as bad as I expected.', 'and every hour dragged.'],
    happy: ['It was... not terrible. Suspicious.', 'Oddly, I didn\'t mind it.'], fine: ['As grey as ever.', 'Meh.'], low: ['Everything is hopeless.', 'Darker than usual, even for me.'],
  },
  jolly: {
    open: ['Ha! Day {day}, diary!', 'What a day, what a day!', 'Day {day}, and I laughed plenty.'],
    close: ['One more song, then bed!', 'Ha! Goodnight!', 'Tomorrow, more laughs.'],
    workGood: ['and we sang all the while.', 'and told jokes the whole time.'], workHard: ['and laughed through the aches.', 'with a song to keep us going.'],
    happy: ['Laughed till my sides hurt.', 'A grand old day.'], fine: ['A fine day for a jest.', 'Can\'t complain! Well, I could.'], low: ['Not much to laugh about today.', 'Even my jokes fell flat.'],
  },
  stern: {
    open: ['Day {day}. Report.', 'Record of day {day}.', 'Day {day}. Duties done.'],
    close: ['Up at dawn.', 'Rest. Then work.', 'End of report.'],
    workGood: ['done properly.', 'no shortcuts taken.'], workHard: ['which is as it should be.', 'and no complaints.'],
    happy: ['Satisfactory.', 'Order kept.'], fine: ['Adequate.', 'Nothing to report.'], low: ['Discipline slipped. Mine included.', 'Unsatisfactory.'],
  },
  restless: {
    open: ['Day {day}! So much happened!', 'Couldn\'t sit still today. Day {day}.', 'Day {day}, diary, quickly:'],
    close: ['Can\'t wait for tomorrow!', 'Too wound up to sleep.', 'Off to bed, I suppose.'],
    workGood: ['and kept moving.', 'and never stopped.'], workHard: ['and itched to do something else.', 'and couldn\'t wait to be done.'],
    happy: ['I\'m buzzing!', 'What a rush.'], fine: ['Bit dull, really.', 'Ordinary. Too ordinary.'], low: ['Stuck. Bored. Low.', 'I need to get out of here.'],
  },
};

/** The day's doings in a sentence (after "I spent ..."), by what the diary counted (sim/diary.ts `doingOf`). */
export const DOINGS: Record<string, string> = {
  chop: 'felling trees', mine: 'breaking rock', forage: 'foraging', fish: 'fishing', gather: 'gathering', build: 'on the building site',
  repair: 'mending walls', research: 'at my studies', reap: 'bringing in the harvest', till: 'out in the fields', farm: 'in the fields',
  haul: 'hauling loads about', tend: 'tending the hurt', guard: 'on watch', fight: 'fighting for my life', relax: 'taking it easy',
  drink: 'at the tavern', eat: 'eating', idle: 'idling about', play: 'playing', tag: 'playing tag', splash: 'jumping in puddles',
  eaves: 'sheltering from the rain', pigeons: 'feeding the pigeons', riverside: 'sitting by the water', busk: 'playing music in the square',
  sit: 'sitting by the fire', stroll: 'out walking', market: 'at the market', well: 'fetching water', carry: 'fetching water',
  rounds: 'going the rounds of the sick', lesson: 'at my lessons', apprentice: 'learning a trade', protest: 'on strike',
  pave: 'laying the street', light: 'tending the lamps', fire: 'fighting a fire', toil: 'at the town\'s work', away: 'away from town',
  feast: 'at the feast', wedding: 'at the wedding', funeral: 'at the funeral', great_funeral: 'at the burying', rite: 'at the rite',
  shelter: 'hiding from raiders', pray: 'at prayer', mineshaft: 'down the mine', patrol: 'patrolling', craft: 'at my craft',
};

/** The work that wears you out (said with the nature's `workHard`); the rest with `workGood`. */
export const HARD_WORK = new Set(['chop', 'mine', 'mineshaft', 'build', 'haul', 'reap', 'till', 'farm', 'fight', 'fire', 'toil', 'pave', 'repair']);
/** Doings that aren't the day's work (left out of "I spent most of the day..."). */
export const NOT_WORK = new Set(['sleep', 'eat', 'walk']);
