// What the townsfolk say about what really happened (the owner's ask: townsfolk with more inner life, talking of the
// town's own news by name). The journal's milestones are read into kinds of news (sim/gossip.ts `readNews`), and two
// people standing together talk it over on the map: one tells it in their nature's voice (`OPENERS`, then one of the
// news's `SAYINGS`), the other answers to fit (`REPLIES` for that news, else their nature's way with good or bad news,
// `TAKES`). {who} and {what} are filled from the news; a saying needing a {who} the news hasn't got isn't used.

import type { NatureId } from './natures';

export type GossipKind =
  | 'death' | 'maimed' | 'joined' | 'back' | 'lost' | 'setout' | 'dragon' | 'built' | 'learned' | 'slain' | 'raid'
  | 'fire' | 'flood' | 'wedding' | 'couple' | 'birth' | 'grown' | 'brawl' | 'crime' | 'age' | 'guard' | 'beasts'
  | 'funeral' | 'blessing' | 'trial' | 'omen';

/** The news that's bad to hear (the rest is good, or at least something to talk about). */
export const BAD_NEWS: ReadonlySet<GossipKind> = new Set(['death', 'maimed', 'lost', 'dragon', 'raid', 'fire', 'flood', 'brawl', 'crime', 'funeral', 'omen']);

/** How someone of each nature starts on a piece of news. */
export const OPENERS: Record<NatureId, string[]> = {
  cheerful: ['Oh, did you hear?', 'Have you heard?', 'Guess what!'],
  grumpy: ['Hmph. Heard?', 'You\'ll have heard, I suppose.', 'Well. Here\'s a thing.'],
  shy: ['...did you hear?', 'Um. I heard...', 'Someone said...'],
  bold: ['Listen!', 'Here\'s news!', 'You heard?'],
  dreamy: ['I keep thinking...', 'Strange days.', 'Did I dream it, or...'],
  pious: ['Heaven help us.', 'The gods see all.', 'Did you hear?'],
  greedy: ['Word is...', 'Psst. Heard?', 'Free news, this once:'],
  kind: ['Oh, did you hear?', 'Have you heard?', 'Did anyone tell you?'],
  proud: ['I heard it first:', 'You won\'t have heard yet.', 'Well, I know already.'],
  curious: ['Have you heard?', 'Did you hear the latest?', 'Tell me if you heard...'],
  gloomy: ['Bad news, as ever.', 'Heard? Of course not.', 'Here\'s another thing.'],
  jolly: ['Ha! Get this!', 'You\'ll never guess!', 'Oho, did you hear?'],
  stern: ['Mark this.', 'You should know:', 'Word from the square:'],
  restless: ['Quick, did you hear?', 'Oh! Heard?', 'Have you heard?'],
};

/** Ways to tell each kind of news. */
export const SAYINGS: Record<GossipKind, string[]> = {
  death: ['Poor {who}. Gone, just like that.', 'They say {who} {what}.', '{who} is dead. I can\'t believe it.', 'We lost {who}.'],
  maimed: ['{who} lost {what}.', 'Poor {who}, losing {what} like that.', '{who} will never be the same.'],
  joined: ['There\'s a new face: {who}.', '{who}\'s come to live with us.', 'Have you met {who} yet?'],
  back: ['{who}\'s back from {what}!', 'They\'re back from {what}.', '{who} made it home from {what}.'],
  lost: ['Nobody came back from {what}.', 'Not one of them came home from {what}.'],
  setout: ['{who}\'s gone off to {what}.', '{who} took a party to {what}.', 'They\'ve set out for {what}.'],
  dragon: ['They say the dragon\'s been seen again.', '{what} was over the roofs again.', 'The dragon. Again.'],
  built: ['Have you seen the new {what}?', 'The {what}\'s finished at last.', 'We\'ve a {what} now!'],
  learned: ['We\'ve worked out {what} now.', 'The scholars cracked {what}.', 'They\'ve learned {what}, they say.'],
  slain: ['{what} is dead! Slain!', 'They killed {what}!', 'No more {what}, they say.'],
  raid: ['We saw off {what}.', 'Did you see {what} at the gate?', '{what} came at us. We held.'],
  fire: ['The {what} went up in flames!', 'Fire at the {what}!', 'The {what} was burning!'],
  flood: ['The river burst its banks!', 'The water came right up!', 'The flood, did you see it?'],
  wedding: ['{who} are wed!', '{who} got married!', 'A wedding: {who}!'],
  couple: ['{who} are walking out together.', '{who}, a couple! Who knew?', 'I saw {who} holding hands.'],
  birth: ['{who} had a little one!', 'A baby, for {who}!', 'There\'s a new baby: {what}.'],
  grown: ['{who}\'s all grown up now.', 'Little {who}, grown! Where did the years go?'],
  brawl: ['{who} came to blows!', '{who} had a proper fight.', 'Did you see {who} scrapping?'],
  crime: ['{who} was caught stealing.', '{who}, a thief! Who\'d have thought.', 'Lock your doors. {who} stole.'],
  age: ['A new age, they say. The {what} era!', 'Times are changing: the {what} era.'],
  guard: ['{who}\'s a guard now.', '{who} took the guard\'s coin.'],
  beasts: ['{who} saw off some beasts out on the land.', '{who} fought off {what} out there!'],
  funeral: ['They buried {what} today.', 'Such a sad burying: {what}.'],
  blessing: ['The gods blessed the {what}!', 'A blessing on the {what}, they say.'],
  trial: ['{who} was tried today.', 'Did you hear about {who}\'s trial?'],
  omen: ['There was an omen. A bad one.', 'Did you see the sign in the sky?'],
};

/** Answers that fit each kind of news. */
export const REPLIES: Record<GossipKind, string[]> = {
  death: ['{who}? No...', 'I\'ll miss {who}.', 'May {who} rest easy.', 'Not {who}. Not like that.'],
  maimed: ['Poor soul.', 'We\'ll look after {who}.', 'That\'s a cruel thing.'],
  joined: ['I\'ll say hello.', 'More hands, good.', 'Hope they can work.'],
  back: ['Thank goodness!', 'And what did they bring?', 'Back in one piece?'],
  lost: ['All of them?', 'Gods, no.', 'We should never have sent them.'],
  setout: ['Brave fools.', 'May they come home.', 'I\'d have gone too.'],
  dragon: ['Bar the doors.', 'I can\'t sleep for it.', 'Someone should slay the thing.'],
  built: ['About time.', 'I helped with that!', 'It\'s a fine one.'],
  learned: ['Clever folk.', 'What\'s it for, then?', 'Progress!'],
  slain: ['Good riddance!', 'Who struck the blow?', 'Drinks all round!'],
  raid: ['They\'ll be back.', 'We did well.', 'My knees are still shaking.'],
  fire: ['Was anyone hurt?', 'Fetch water next time!', 'Smoke everywhere.'],
  flood: ['My boots are still wet.', 'The fields!', 'Never seen it so high.'],
  wedding: ['Lovely!', 'I\'ll dance at that!', 'About time, those two.'],
  couple: ['Ha! I knew it.', 'Sweet.', 'It won\'t last.'],
  birth: ['A little one!', 'Bless them.', 'More mouths to feed...'],
  grown: ['They grow so fast.', 'Seems like yesterday.'],
  brawl: ['Those two...', 'Somebody had to.', 'Keep them apart.'],
  crime: ['Shameful.', 'I always wondered.', 'Lock up the coin.'],
  age: ['Things change.', 'New ways, new troubles.', 'Exciting!'],
  guard: ['Good. We need them.', 'Earns their coin.'],
  beasts: ['Brave!', 'Rather them than me.'],
  funeral: ['A sad day.', 'They\'re at peace now.'],
  blessing: ['Give thanks!', 'About time the gods noticed.'],
  trial: ['Justice, I hope.', 'Poor fool.'],
  omen: ['Don\'t say that.', 'I saw it too.'],
};

/** How someone of each nature takes good news and bad, when the news's own answers aren't used. */
export const TAKES: Record<NatureId, { good: string[]; bad: string[] }> = {
  cheerful: { good: ['Wonderful!', 'What a day!'], bad: ['Oh no... we\'ll manage.', 'Chin up, eh?'] },
  grumpy: { good: ['Hmph. Fine.', 'Won\'t last.'], bad: ['Told you so.', 'Typical.'] },
  shy: { good: ['...oh, nice.', 'Oh!'], bad: ['...oh no.', '...'] },
  bold: { good: ['Ha! Good!', 'That\'s the spirit!'], bad: ['Then we fight back.', 'Not on my watch.'] },
  dreamy: { good: ['Like a story.', 'How lovely...'], bad: ['Like a bad dream.', 'Is it real?'] },
  pious: { good: ['Give thanks.', 'A blessing.'], bad: ['I\'ll pray for us.', 'The gods test us.'] },
  greedy: { good: ['Is there coin in it?', 'Good for trade.'], bad: ['Bad for trade.', 'Who pays for that?'] },
  kind: { good: ['Oh, I\'m so glad.', 'Lovely news.'], bad: ['Oh, the poor things.', 'Who needs help?'] },
  proud: { good: ['As I expected.', 'Naturally.'], bad: ['Wouldn\'t have happened to me.', 'Sloppy.'] },
  curious: { good: ['Tell me more!', 'How did it happen?'], bad: ['How did it happen?', 'Why, though?'] },
  gloomy: { good: ['It won\'t last.', 'Hm. For now.'], bad: ['We\'re all doomed.', 'As I said.'] },
  jolly: { good: ['Ha ha! Grand!', 'Let\'s drink to it!'], bad: ['Well, that\'s a pickle.', 'Bah! Cheer up.'] },
  stern: { good: ['Good. Back to work.', 'As it should be.'], bad: ['Then we do better.', 'Lessons to learn.'] },
  restless: { good: ['Let\'s go see!', 'Finally, something!'], bad: ['We should do something!', 'I can\'t sit still.'] },
};
