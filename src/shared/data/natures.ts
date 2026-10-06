// Townsfolk have natures (the owner's ask: villagers with personalities of their own). A nature is decided by who
// someone is (their id), so no save changes and nobody's nature shifts. It shows in what they say on the map
// (speech bubbles: renderer/map/speech.ts picks from `say` by what's going on), in their spirits (`mood` nudges the
// morale they settle at), their pace (`work`), who they warm to (`likes`) and who they rub up against (`clashes`,
// `friction`: sim/social.ts), and on the Townsfolk tab.
export type NatureId = 'cheerful' | 'grumpy' | 'shy' | 'bold' | 'dreamy' | 'pious' | 'greedy' | 'kind' | 'proud' | 'curious' | 'gloomy' | 'jolly' | 'stern' | 'restless';

/** What a line is about. */
export type Topic = 'greet' | 'work' | 'cold' | 'hot' | 'rain' | 'night' | 'hungry' | 'tired' | 'raid' | 'friend' | 'rival' | 'idle' | 'sea' | 'sick' | 'old' | 'child' | 'feast' | 'mourn';
export const TOPICS: readonly Topic[] = ['greet', 'work', 'cold', 'hot', 'rain', 'night', 'hungry', 'tired', 'raid', 'friend', 'rival', 'idle', 'sea', 'sick', 'old', 'child', 'feast', 'mourn'];

export interface Nature {
  id: NatureId;
  name: string;
  /** A line for the inspect page. */
  line: string;
  /** Nudges the morale they settle at. */
  mood: number;
  /** Their pace at work. */
  work: number;
  /** Extra chance of rubbing someone up the wrong way (sim/social.ts `friction`). */
  friction: number;
  likes: NatureId[];
  clashes: NatureId[];
  say: Partial<Record<Topic, string[]>>;
}

const N = (id: NatureId, name: string, line: string, mood: number, work: number, friction: number, likes: NatureId[], clashes: NatureId[], say: Partial<Record<Topic, string[]>>): Nature => ({ id, name, line, mood, work, friction, likes, clashes, say });

export const NATURES: readonly Nature[] = [
  N('cheerful', 'Cheerful', 'Sees the bright side of everything, even the rain.', 6, 1, 0, ['jolly', 'kind', 'curious'], ['gloomy', 'grumpy'], {
    greet: ['Lovely day for it!', 'Morning! Isn\'t it grand?', 'There you are!'], work: ['Many hands, light work.', 'Nearly done, I can feel it.'], cold: ['Brisk! Good for the blood.'], hot: ['A fine day to be alive.'], rain: ['The fields will love this.'],
    night: ['Look at those stars.'], hungry: ['A bite would be nice. Soon!'], tired: ['A good tired, this.'], raid: ['We\'ve beaten worse!'], friend: ['My favourite face!'], rival: ['Let\'s not fall out today.'], idle: ['La la la...', 'What a place this is.'], sea: ['The water\'s lovely!'], sick: ['I\'ll be right as rain.'], old: ['Every day a gift.'], child: ['Who\'s this big strong helper?'],
  }),
  N('grumpy', 'Grumpy', 'Quick to complain, slow to forgive, and usually right.', -5, 1, 0.5, ['stern', 'gloomy'], ['cheerful', 'jolly'], {
    greet: ['Hmph.', 'What now?', 'Oh. It\'s you.'], work: ['Nobody else was going to do it.', 'This axe is blunt again.'], cold: ['My knees know it\'s cold.'], hot: ['Too hot to think.'], rain: ['Of course it\'s raining.'],
    night: ['Some of us are trying to sleep.'], hungry: ['Is nobody cooking?'], tired: ['Bones like gravel.'], raid: ['Typical.'], friend: ['You\'ll do.'], rival: ['Don\'t start.'], idle: ['In my day...', 'Hmph.'], sea: ['Wet. Everything\'s wet.'], sick: ['Leave me be.'], old: ['Don\'t get old.'], child: ['Mind that fire!'],
  }),
  N('shy', 'Shy', 'Says little, notices everything.', 0, 1, 0, ['kind', 'dreamy'], ['bold', 'proud'], {
    greet: ['...hello.', 'Oh! Hi.'], work: ['I like it quiet out here.'], cold: ['Brr.'], hot: ['...warm.'], rain: ['I like the rain.'],
    night: ['The dark is peaceful.'], hungry: ['I\'m a little hungry... it\'s fine.'], tired: ['...'], raid: ['Please let it be over.'], friend: ['I\'m glad it\'s you.'], rival: ['...'], idle: ['Hm.', '(hums quietly)'], sea: ['The sea doesn\'t ask questions.'], sick: ['I\'ll manage.'], old: ['The years went quietly.'], child: ['Hello, little one.'],
  }),
  N('bold', 'Bold', 'First through the gate, last to admit a mistake.', 3, 1.05, 0.3, ['proud', 'jolly', 'restless'], ['shy', 'gloomy'], {
    greet: ['Ha! Good to see you!', 'What\'s the plan?'], work: ['Stand back, I\'ve got this.', 'Faster! Come on!'], cold: ['Cold? This isn\'t cold.'], hot: ['Sweat is just weakness leaving.'], rain: ['A little rain never hurt.'],
    night: ['I\'ll take the watch.'], hungry: ['I could eat a boar. Whole.'], tired: ['Not tired. Resting my eyes.'], raid: ['Let them come!', 'To the gate!'], friend: ['Shoulder to shoulder, eh?'], rival: ['Say that again.'], idle: ['Too quiet.', 'Anyone fancy a wrestle?'], sea: ['Race you to the reef!'], sick: ['A scratch.'], old: ['Still got it.'], child: ['Show me your muscles!'],
  }),
  N('dreamy', 'Dreamy', 'Half here, half somewhere better.', 2, 0.93, 0, ['curious', 'shy', 'kind'], ['stern', 'greedy'], {
    greet: ['Oh... hello.', 'Did you see that cloud?'], work: ['What was I doing?', 'The wood smells of summer.'], cold: ['The frost makes patterns.'], hot: ['The air shimmers...'], rain: ['Each drop a tiny world.'],
    night: ['I wonder what the moon thinks.'], hungry: ['Hungry... was I?'], tired: ['I could sleep in the grass.'], raid: ['Is this real?'], friend: ['I dreamt of you.'], rival: ['Hm? Oh.'], idle: ['Somewhere a bird is singing.', 'Imagine...'], sea: ['The sea remembers.'], sick: ['Floaty.'], old: ['Was that a lifetime already?'], child: ['Shall I tell you a story?'],
  }),
  N('pious', 'Pious', 'Thanks the sky for the rain and the earth for the bread.', 3, 1, 0.2, ['kind', 'stern'], ['greedy', 'curious'], {
    greet: ['Blessings on you.', 'Peace be with you.'], work: ['Work is prayer.', 'Thanks for strong hands.'], cold: ['The cold tests us.'], hot: ['The sun is a blessing. A heavy one.'], rain: ['Rain! Give thanks.'],
    night: ['The stars keep watch.'], hungry: ['We shall be provided for.'], tired: ['Rest is holy too.'], raid: ['Guard us this day.'], friend: ['You are a gift.'], rival: ['I will pray for you. Really.'], idle: ['(murmurs a prayer)', 'All is as it should be.'], sea: ['Deep waters, deep mercy.'], sick: ['A trial, no more.'], old: ['My time is near, and that is well.'], child: ['Bless this little one.'],
  }),
  N('greedy', 'Greedy', 'Counts the coins twice and the favours once.', -2, 1.05, 0.5, ['proud', 'restless'], ['pious', 'kind'], {
    greet: ['What\'s in it for me?', 'Got anything to trade?'], work: ['Is there pay in this?', 'Mine. All mine.'], cold: ['Firewood costs, you know.'], hot: ['Someone should sell shade.'], rain: ['Free water. Finally.'],
    night: ['Who\'s watching the store?'], hungry: ['I\'d pay for a pie.'], tired: ['Overtime, surely?'], raid: ['Not my stuff!'], friend: ['You owe me, remember?'], rival: ['Thief.'], idle: ['Let me count that again.', 'Shiny...'], sea: ['Pearls down there.'], sick: ['How much is the healer?'], old: ['Not leaving a coin behind.'], child: ['Go fetch me something.'],
  }),
  N('kind', 'Kind', 'Gives the last of the bread and smiles doing it.', 4, 0.97, 0, ['cheerful', 'shy', 'pious', 'dreamy'], ['greedy', 'grumpy'], {
    greet: ['How are you, truly?', 'Here, sit a while.'], work: ['Let me take that end.'], cold: ['Take my cloak.'], hot: ['Drink something, go on.'], rain: ['Come under here.'],
    night: ['Sleep well, all of you.'], hungry: ['You eat first.'], tired: ['Rest. I\'ll finish.'], raid: ['Stay behind me!'], friend: ['I\'m so glad of you.'], rival: ['We\'ll find a way to get on.'], idle: ['Who needs a hand?', 'Lovely people, here.'], sea: ['Mind the children in the water.'], sick: ['Don\'t fuss over me.'], old: ['Such a good life.'], child: ['There now.'],
  }),
  N('proud', 'Proud', 'Does fine work and makes sure you know it.', 1, 1.03, 0.4, ['bold', 'greedy', 'stern'], ['shy', 'kind'], {
    greet: ['Yes?', 'Ah. You\'ve heard of me, no doubt.'], work: ['Watch a master.', 'Nobody does it like this.'], cold: ['The cold wouldn\'t dare.'], hot: ['I don\'t sweat.'], rain: ['My hair!'],
    night: ['A night fit for my sleep.'], hungry: ['I expect the best cut.'], tired: ['Even I must rest.'], raid: ['They will remember my name.'], friend: ['You have good taste in friends.'], rival: ['Beneath me.'], idle: ['Admire, if you must.', 'Naturally.'], sea: ['The sea parts for me.'], sick: ['A passing thing.'], old: ['Age becomes me.'], child: ['Watch and learn, child.'],
  }),
  N('curious', 'Curious', 'Asks why, then why again.', 3, 1, 0.1, ['dreamy', 'cheerful', 'restless'], ['stern', 'pious'], {
    greet: ['What are you up to?', 'Seen anything odd today?'], work: ['I wonder if there\'s a better way.', 'Why does it do that?'], cold: ['How do the fish not freeze?'], hot: ['How hot is the sun, really?'], rain: ['Where does rain come from?'],
    night: ['How far away is that star?'], hungry: ['What are berries, really?'], tired: ['Why do we sleep?'], raid: ['What do they want?'], friend: ['Tell me everything.'], rival: ['Why don\'t you like me?'], idle: ['What\'s over that hill?', 'Hm, interesting.'], sea: ['What\'s down there?'], sick: ['Fascinating symptoms.'], old: ['So many questions left.'], child: ['Good question!'],
  }),
  N('gloomy', 'Gloomy', 'Expects the worst and is seldom surprised.', -6, 0.97, 0.3, ['grumpy', 'shy'], ['cheerful', 'jolly', 'bold'], {
    greet: ['Oh. Hello.', 'It\'ll end badly.'], work: ['It\'ll only fall down.', 'Why bother.'], cold: ['We\'ll all freeze.'], hot: ['We\'ll all burn.'], rain: ['Flood, probably.'],
    night: ['Something\'s out there.'], hungry: ['Starving. Figures.'], tired: ['Everything aches.'], raid: ['This is it, then.'], friend: ['You\'ll leave too.'], rival: ['As expected.'], idle: ['Sigh.', 'What\'s the use.'], sea: ['Things drown in there.'], sick: ['This is the end.'], old: ['Nearly over.'], child: ['Poor thing. The world...'],
  }),
  N('jolly', 'Jolly', 'Laughs first and loudest, and means it.', 5, 1, 0.2, ['cheerful', 'bold', 'kind'], ['grumpy', 'gloomy', 'stern'], {
    greet: ['Ha ha! There they are!', 'Heard the one about the goat?'], work: ['Sing while we work!', 'Last one done buys the ale!'], cold: ['Cold hands, warm heart!'], hot: ['Phew! Who ordered summer?'], rain: ['Free bath!'],
    night: ['One more song!'], hungry: ['My belly\'s singing too!'], tired: ['Even the bear sleeps!'], raid: ['Come and get it, you lot!'], friend: ['My old mate!'], rival: ['Cheer up, misery!'], idle: ['Ho ho!', 'Did I ever tell you about...'], sea: ['Cannonball!'], sick: ['Just a sniffle!'], old: ['Still laughing!'], child: ['Boo! Ha ha!'],
  }),
  N('stern', 'Stern', 'Rules are rules, and the work comes first.', -1, 1.08, 0.4, ['grumpy', 'pious', 'proud'], ['jolly', 'dreamy', 'curious'], {
    greet: ['Report.', 'You\'re late.'], work: ['Properly, this time.', 'No shortcuts.'], cold: ['Dress for it.'], hot: ['Drink water. Keep working.'], rain: ['Rain is no excuse.'],
    night: ['Lights out.'], hungry: ['Rations are rations.'], tired: ['Rest when it\'s done.'], raid: ['Hold the line.'], friend: ['You do good work.'], rival: ['Sloppy.'], idle: ['Idle hands.', 'Back to it.'], sea: ['Mind the tide.'], sick: ['I am fine.'], old: ['Still useful.'], child: ['Stand up straight.'],
  }),
  N('restless', 'Restless', 'Never still, never done, never bored for long.', 1, 1.04, 0.3, ['bold', 'curious', 'greedy'], ['shy', 'dreamy'], {
    greet: ['Can\'t stop, hello!', 'What\'s next?'], work: ['Done. Next!', 'Come on, come on.'], cold: ['Keep moving, keeps you warm.'], hot: ['Let\'s go to the river!'], rain: ['Race the rain!'],
    night: ['Not sleepy.'], hungry: ['Quick bite, then off.'], tired: ['Fine! Fine. One minute.'], raid: ['Finally, something happening!'], friend: ['Come with me!'], rival: ['Out of my way.'], idle: ['Bored. Bored. Bored.', 'Somewhere else, surely.'], sea: ['Further out!'], sick: ['Can I get up yet?'], old: ['Where did it all go?'], child: ['Catch me!'],
  }),
];
export const NATURE_BY_ID: Readonly<Record<NatureId, Nature>> = Object.fromEntries(NATURES.map((n) => [n.id, n])) as Record<NatureId, Nature>;

/** Lines anyone might say, when their nature has none for the topic. */
/** What each nature says at a feast and at a funeral (`feast`, `mourn`), laid into their `say` below. */
const GATHERED: Record<NatureId, { feast: string[]; mourn: string[] }> = {
  cheerful: { feast: ['Best night of the year!', 'Come on, dance!', 'Everyone\'s smiling!'], mourn: ['They\'d want us to smile.', 'I\'ll miss that laugh.'] },
  grumpy: { feast: ['Too loud.', 'Fine. One dance.', 'Who spilled ale on me?'], mourn: ['Should\'ve been me.', 'Hmph. Rest, then.'] },
  shy: { feast: ['I don\'t dance... much.', '(taps a foot)', 'It is nice.'], mourn: ['...', 'Goodbye.'] },
  bold: { feast: ['Faster! Play faster!', 'Who\'ll match my cup?', 'Watch this!'], mourn: ['They died brave.', 'I\'ll avenge them.'] },
  dreamy: { feast: ['The lanterns are like stars.', 'I could dance till dawn.', 'Listen to that tune...'], mourn: ['Gone to the stars.', 'I dreamed of them.'] },
  pious: { feast: ['Blessed be this table.', 'Give thanks, friends!', 'A gift from above.'], mourn: ['Into the light.', 'May they find peace.'] },
  greedy: { feast: ['Free food!', 'Who\'s paying for this?', 'I\'ll take seconds.'], mourn: ['Who gets their things?', 'A loss. A real loss.'] },
  kind: { feast: ['Have you eaten?', 'Come, join us!', 'Everyone together!'], mourn: ['Hold my hand.', 'They were so good.'] },
  proud: { feast: ['I dance best.', 'A fine feast. Mine was finer.', 'Admire the steps!'], mourn: ['A worthy life.', 'They\'ll be remembered.'] },
  curious: { feast: ['What\'s in this pie?', 'Who wrote this song?', 'How do you do that step?'], mourn: ['Where do we go after?', 'Why them?'] },
  gloomy: { feast: ['It\'ll end soon.', 'Enjoy it while it lasts.', 'Even I\'ll dance.'], mourn: ['I knew it.', 'Who\'s next?'] },
  jolly: { feast: ['Ha! Again!', 'Drink up, friends!', 'Hey-ho, round we go!'], mourn: ['A toast to them.', 'They told the best jokes.'] },
  stern: { feast: ['Back to work at dawn.', 'Within reason.', 'Well earned.'], mourn: ['We go on.', 'Duty done.'] },
  restless: { feast: ['Faster!', 'Can\'t stop dancing!', 'Spin, spin!'], mourn: ['I can\'t stand still.', 'Let\'s walk.'] },
};

export const ANYONE: Record<Topic, string[]> = {
  greet: ['Hello there.', 'Good day.'], work: ['Back to work.'], cold: ['Cold today.'], hot: ['Hot today.'], rain: ['Rain again.'], night: ['Getting dark.'], hungry: ['I\'m hungry.'], tired: ['So tired.'], raid: ['Raiders!'],
  friend: ['Good to see you.'], rival: ['Hm.'], idle: ['...'], sea: ['The tide\'s coming in.'], sick: ['I don\'t feel well.'], old: ['These old bones.'], child: ['Hello, little one.'],
  feast: ['What a night!', 'Another round!', 'Dance with me!', 'Play it again!'], mourn: ['Rest well.', 'Gone too soon.', '...'],
};

/** Someone's nature: their own if set, else decided by who they are. */
export const natureOf = (p: { id: number; nature?: NatureId | null }): Nature => NATURE_BY_ID[p.nature ?? NATURES[((p.id * 2654435761) >>> 0) % NATURES.length].id];

/** How two natures fit: +0.3 for each who likes the other's, -0.4 for each clash, +0.1 for two of a kind. */
export function natureFit(a: Nature, b: Nature): number {
  let fit = a.id === b.id ? 0.1 : 0;
  if (a.likes.includes(b.id)) fit += 0.3;
  if (b.likes.includes(a.id)) fit += 0.3;
  if (a.clashes.includes(b.id)) fit -= 0.4;
  if (b.clashes.includes(a.id)) fit -= 0.4;
  return fit;
}

/** A line of a nature on a topic (the nature's own, else anyone's), picked by a number. */
export function lineFor(n: Nature, topic: Topic, pick: number): string {
  const pool = n.say[topic]?.length ? n.say[topic]! : ANYONE[topic];
  return pool[Math.abs(Math.floor(pick)) % pool.length];
}

// (the feast and funeral lines, into each nature's voice)
for (const n of NATURES) Object.assign(n.say, GATHERED[n.id]);
