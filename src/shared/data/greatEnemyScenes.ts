// The Great Enemy's scenes (merged into CUTSCENES: data/cutscenes.ts): each turn of its arc played out, its
// lieutenants falling, and the end either way. Shared by all six Enemies: the names come from the town (`{enemy}`,
// `{short}`, `{seat}`, a slain lieutenant's `{foe}`), the Enemy is `foe:{enemy}` and a lieutenant `foe:{lt}`
// (sim/greatEnemy.ts fills them). Same voice as the rest: the town takes its doom about as seriously as turnips.

import type { CastMember, Cam, Cutscene, Line } from './cutscenes';

const say = (who: string, text: string, tone?: Line['tone']): Line => ({ who, text, ...(tone ? { tone } : {}) });
const tell = (text: string): Line => ({ who: 'narrator', text });
const wide = (x = 160, zoom = 1): Cam => ({ x, y: 104, zoom });
const close = (on: string, zoom = 2.6, tilt = 0): Cam => ({ on, zoom, tilt });
const two = (a: string, b: string, zoom = 1.7): Cam => ({ on: [a, b], zoom });
const sky = (x = 160): Cam => ({ x, y: 50, zoom: 1.4 });

const TOWNSFOLK = {
  founder: { role: 'founder', x: 110, facing: 'right' },
  hero: { role: 'hero', x: 132, facing: 'right' },
  wit: { role: 'wit', x: 86, facing: 'right' },
  worrier: { role: 'worrier', x: 64, facing: 'right' },
} as const satisfies Record<string, CastMember>;
const ENEMY: CastMember = { role: 'foe:{enemy}', x: 240, facing: 'left', hidden: true };

export const ENEMY_SCENES: Cutscene[] = [
  {
    id: 'enemy_omens',
    title: 'A Name in the Dark',
    cast: { ...TOWNSFOLK, enemy: ENEMY },
    shots: [
      { look: 'battle_ruins', cam: sky(230), to: wide(230, 1.3), fx: ['fadeIn', 'darken'], caption: '{Seat}', hold: 3, lines: [tell('Far away, in {seat}, someone with a great deal of time and no hobbies made a plan.')] },
      { cam: close('enemy', 1.5, 0.06), acts: [{ who: 'enemy', enter: 240, from: 'right' }], fx: ['rumble'], lines: [say('enemy', 'A town. Over there. Growing, without my permission.', 'whisper')] },
      { cam: close('enemy', 1.5, -0.05), lines: [say('enemy', 'Write it down. Every name. Every roof. I am a patient thing.'), tell('Somebody wrote it down. It was a long list. The goat was on it.')] },
      { look: 'town', cam: wide(100, 1.3), fx: ['fadeIn'], lines: [say('worrier', 'I had a dream last night. Someone was writing my name in a book.'), say('wit', 'Was it a nice book?')] },
      { cam: close('worrier', 2.8, 0.05), lines: [say('worrier', 'It was bound in something. I did not ask what.')] },
      { cam: two('founder', 'hero'), lines: [say('hero', 'The travellers say the same. A name. {Short}.'), say('founder', 'Then we keep our eyes on the horizon, and our scouts on the roads.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2, lines: [tell('It would be a long time coming. That was the worst of it.')] },
    ],
  },
  {
    id: 'enemy_stirring',
    title: 'The Shadow Stirs',
    cast: { ...TOWNSFOLK, enemy: ENEMY, lt: { role: 'foe:{lt}', x: 210, facing: 'left', hidden: true } },
    shots: [
      { look: 'wasteland_1', cam: wide(220, 1.1), to: wide(180, 1.1), fx: ['fadeIn', 'darken'], caption: 'The Stirring', hold: 3, lines: [tell('{Enemy} stirred, and the land between {seat} and the town began, quietly, to die.')] },
      { cam: two('enemy', 'lt', 1.2), acts: [{ who: 'enemy', enter: 250, from: 'right' }, { who: 'lt', enter: 210, from: 'right' }], lines: [say('enemy', 'Take the outposts. Watch the roads. Send my agents in among their visitors.'), say('lt', 'And the goat, master?')] },
      { cam: close('enemy', 1.5, 0.08), fx: ['red'], lines: [say('enemy', 'Why does everyone ask about the goat?', 'shout')] },
      { look: 'town', cam: two('founder', 'hero'), fx: ['fadeIn'], lines: [say('hero', 'Three of its captains have dug in, a few days\' march out. Every one we cut down sets it back.'), say('founder', 'And every one we leave there brings it sooner.')] },
      { cam: close('worrier', 2.8), lines: [say('worrier', 'Also, a man came to lodge here last night who did not blink once. I counted. I have a list.')] },
      { cam: close('wit', 3, -0.06), lines: [say('wit', 'Put him on the other list.'), say('worrier', 'There is only one list.')] },
      { cam: wide(110, 1.2), fx: ['fadeOut'], hold: 1.5, lines: [tell('The hunters began to sharpen things.')] },
    ],
  },
  {
    id: 'enemy_march',
    title: 'The March',
    cast: { ...TOWNSFOLK, enemy: { ...ENEMY, hidden: false, x: 250 } },
    shots: [
      { look: 'battle_ruins', cam: sky(200), to: wide(220, 1.1), fx: ['fadeIn', 'red', 'rumble'], caption: 'The March', hold: 3, lines: [tell('{Enemy} stopped hiding. Its hosts came down the roads in daylight.')] },
      { cam: close('enemy', 1.5, -0.06), lines: [say('enemy', 'Little town. You have had your omens. You have had your warnings. Now you have my terms.', 'shout')] },
      { cam: close('enemy', 1.5), lines: [say('enemy', 'Tribute, or my captains will come for it themselves.')] },
      { look: 'town', cam: two('founder', 'wit', 2), fx: ['fadeIn'], lines: [say('founder', 'We could pay.'), say('wit', 'We could. And next time it would want twice as much.')] },
      { cam: close('worrier', 2.8, 0.05), lines: [say('worrier', 'I would like to formally register that I hate all of this.'), say('founder', 'Noted.')] },
      { cam: close('hero', 2.8), acts: [{ who: 'hero', pose: 'cheer' }], lines: [say('hero', 'Let them come! Every captain that marches on us is one we do not have to march out to!')] },
      { cam: wide(100, 1.2), fx: ['fadeOut'], hold: 1.5, lines: [say('wit', 'That is either very brave or very bad at arithmetic.', 'whisper')] },
    ],
  },
  {
    id: 'enemy_siege',
    title: 'The Great Siege',
    cast: { ...TOWNSFOLK, enemy: { role: 'foe:{enemy}', x: 340, facing: 'left' } },
    shots: [
      { look: 'battle_ruins', cam: sky(200), to: wide(200, 1), fx: ['fadeIn', 'red', 'rumble'], caption: 'The Last Siege', hold: 3, lines: [tell('Everything {enemy} had ever plotted came over the hill at once.')] },
      { cam: wide(250, 1.3), acts: [{ who: 'enemy', walk: 240 }], fx: ['shake'], lines: [say('enemy', 'I have waited a long time for this. I made a plan. The plan had stages.', 'shout')] },
      { cam: close('wit', 3, 0.05), lines: [say('wit', 'We noticed. Very thorough. The omens were a nice touch.')] },
      { cam: close('enemy', 1.5, -0.1), fx: ['red'], lines: [say('enemy', 'THANK you. Now die.', 'shout')] },
      { cam: close('founder', 2.4), to: close('founder', 3), lines: [say('founder', 'Every one of you. We have buried our dead for this. We have rebuilt every roof it burned.'), say('founder', 'It has had its whole plan. We only need one good day.')] },
      { cam: two('hero', 'enemy', 1.1), acts: [{ who: 'hero', walk: 170 }, { who: 'hero', pose: 'strike' }], fx: ['flash', 'shake'], burst: { on: 'enemy', fx: 'px:fire-explosion' }, lines: [say('hero', 'FOR {TOWN}!', 'shout')] },
      { cam: wide(200, 1), fx: ['fadeOut'], hold: 2, lines: [tell('What happened next would be told for generations, one way or the other.')] },
    ],
  },
  {
    id: 'enemy_lieutenant',
    title: 'A Captain Falls',
    cast: { ...TOWNSFOLK, lt: { role: 'foe:{lt}', x: 220, facing: 'left' } },
    shots: [
      { look: 'battle_ruins', cam: two('hero', 'lt', 1.5), fx: ['fadeIn'], caption: '{Foe}', lines: [say('lt', 'My master will hear of this!'), say('hero', 'That is rather the idea.')] },
      { cam: close('lt', 2.8, 0.1), acts: [{ who: 'lt', pose: 'down' }], fx: ['flash', 'shake'], lines: [tell('{Foe} fell, and somewhere far off, {enemy} felt it.')] },
      { look: 'town', cam: two('wit', 'worrier', 2), fx: ['fadeIn'], lines: [say('worrier', 'One fewer. How many are left?'), say('wit', 'Fewer than yesterday. That is the only kind of counting I like.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 1.5 },
    ],
  },
  {
    id: 'enemy_victory',
    title: 'The Long Peace',
    cast: { ...TOWNSFOLK, enemy: { role: 'foe:{enemy}', x: 230, facing: 'left' } },
    shots: [
      { look: 'battle_ruins', cam: close('enemy', 1.5, 0.1), fx: ['fadeIn', 'shake'], lines: [say('enemy', 'This... was not... in the plan.', 'whisper')] },
      { cam: wide(220, 1.2), acts: [{ who: 'enemy', pose: 'down' }], fx: ['flash', 'rumble'], hold: 2, lines: [tell('{Enemy} fell, and did not get up, and the host behind it broke and ran.')] },
      { look: 'town', cam: wide(100, 1.2), to: sky(110), fx: ['fadeIn'], acts: [{ who: 'hero', pose: 'cheer' }, { who: 'founder', pose: 'cheer' }], lines: [say('founder', 'It is over. It is actually over.'), say('hero', 'I have prepared a speech for exactly this.')] },
      { cam: close('wit', 3), lines: [say('wit', 'Let him. Just this once.'), say('worrier', 'I am crossing everything off the list. All of it. Even the goat.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2.5, lines: [tell('They raised a stone where everyone could see it, and the peace that came after was long enough for the children to forget to be afraid.')] },
    ],
  },
  {
    id: 'enemy_repelled',
    title: 'The Siege Broken',
    cast: { ...TOWNSFOLK, enemy: { role: 'foe:{enemy}', x: 250, facing: 'left' } },
    shots: [
      { look: 'battle_ruins', cam: close('enemy', 1.5), fx: ['fadeIn', 'red'], lines: [say('enemy', 'Fall back. FALL BACK. This is a strategic... regrouping.', 'shout')] },
      { cam: wide(240, 1.1), acts: [{ who: 'enemy', exit: 'right' }], fx: ['rumble'], hold: 1.5 },
      { look: 'town', cam: two('founder', 'hero'), fx: ['fadeIn'], lines: [say('hero', 'We held!'), say('founder', 'We held. Half the town is on fire, and it lives. It will be back.')] },
      { cam: close('worrier', 2.8), lines: [say('worrier', 'Buckets. Everybody. Buckets now, feelings later.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2 },
    ],
  },
  {
    id: 'enemy_fallen',
    title: 'The Town Falls',
    cast: { ...TOWNSFOLK, enemy: { role: 'foe:{enemy}', x: 230, facing: 'left' } },
    shots: [
      { look: 'battle_ruins', cam: sky(200), fx: ['fadeIn', 'red', 'rumble'], hold: 3, lines: [tell('The second siege was the last.')] },
      { cam: close('enemy', 1.5, -0.08), lines: [say('enemy', 'Write it down. Every name. Then cross them out.', 'whisper')] },
      { look: 'town', cam: two('founder', 'wit', 2), fx: ['fadeIn', 'darken'], lines: [say('founder', 'Take the children. Take the stories. Go.'), say('wit', 'And you?'), say('founder', 'Someone has to remember where we put the goat.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 3, lines: [tell('The town fell. But somebody always gets away, and somebody always remembers {short}.')] },
    ],
  },
];
