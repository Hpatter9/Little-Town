// Cutscenes (the owner's ask: the big moments played out like a well-made video game's, with camera angles and cuts,
// fully scripted, with humour running through them as the game's own voice). Each scene is a script: its cast (roles
// filled from the town when it's queued: the founder, the town's best fighter, its joker and its worrier; the Calamity's
// avatar, the dragon; or a foe by id), and its shots, played in order. A shot sets the backdrop (one of the painted
// backdrops, or `town`, the town's own for its age), the camera (on an actor or between two, how close, a dutch tilt,
// and where it drifts to over the shot), what the actors do (walk, enter, leave, turn, strike, kneel, cheer...), the
// effects (a shake, a flash, lightning, a fade, a burst of a spell's sheet over someone) and the lines spoken, each by
// an actor or the narrator. A shot with no lines holds for `hold` seconds. Played by renderer/cutscene/ (the strip),
// queued by sim/cutscenes.ts, offered to watch or skip.
//
// The voice: wry and warm. The town takes the end of the world about as seriously as it takes the price of turnips.
// Running gags across the scenes: Duchess, the town's goat, beloved and useless; the worrier's lists; the hero's
// speeches, which go on; the villains, who are grand and petty and have staff problems.

import type { BackdropId } from './backdrops';

/** The stage, in art px: the backdrop is drawn this size (16:9), the actors' feet on `FEET`. */
export const STAGE_W = 320;
export const STAGE_H = 180;
export const FEET = 152;

/** Who stands in a scene: a role the town fills, or a foe by its enemy id (`foe:<id>`). */
export type Role = 'founder' | 'hero' | 'wit' | 'worrier' | 'elder' | 'avatar' | 'dragon' | `foe:${string}`;
export type Facing = 'left' | 'right';
export type Pose = 'idle' | 'walk' | 'strike' | 'cast' | 'kneel' | 'cheer' | 'down' | 'talk';

export interface CastMember {
  role: Role;
  x: number;
  facing: Facing;
  /** Off the stage until a shot brings them on. */
  hidden?: boolean;
  /** Drawn bigger (a dragon, an avatar looming). */
  scale?: number;
}

/** Where the camera looks: at a stage point, or on an actor (their head) or between two; how close (1: the screen holds
 *  the stage's height); a dutch tilt (radians). */
export interface Cam {
  on?: string | string[];
  x?: number;
  y?: number;
  zoom?: number;
  tilt?: number;
}

/** What an actor does in a shot: walk to x, come on from a side to x, go off a side, turn, take a pose. */
export type Act =
  | { who: string; walk: number }
  | { who: string; enter: number; from: Facing }
  | { who: string; exit: Facing }
  | { who: string; face: Facing }
  | { who: string; pose: Pose };

export type Fx = 'shake' | 'flash' | 'lightning' | 'fadeIn' | 'fadeOut' | 'darken' | 'red' | 'rumble' | 'glow';

export interface Line {
  /** An actor's id in the cast, or `narrator`. */
  who: string;
  text: string;
  /** Shouted (bigger, the box shakes) or whispered (smaller, faint). */
  tone?: 'shout' | 'whisper';
}

export interface Shot {
  /** The backdrop: one of the painted ones, or `town` (the town's own for its age); kept from the shot before if left
   *  out. */
  look?: BackdropId | 'town';
  cam: Cam;
  /** Where the camera drifts to over the shot (a pan, a push in, a pull out). */
  to?: Cam;
  acts?: Act[];
  fx?: Fx[];
  /** A spell's or skill's effect sheet played over an actor (a `px:` id or an old sheet's: renderer's `sheetOf`). */
  burst?: { on: string; fx: string };
  /** A chapter card over the shot. */
  caption?: string;
  lines?: Line[];
  /** Seconds for a shot without lines (or a pause after them). */
  hold?: number;
}

export interface Cutscene {
  id: string;
  title: string;
  cast: Record<string, CastMember>;
  shots: Shot[];
}

/** How long a line stays up: a beat to read it (seconds), so a scene plays through on its own; a tap moves on sooner. */
export const lineSeconds = (text: string) => Math.min(9, 1.6 + text.length * 0.05);
/** A whole scene's length (seconds), as played untouched. */
export const sceneSeconds = (c: Cutscene) => c.shots.reduce((n, s) => n + (s.lines?.reduce((m, l) => m + lineSeconds(l.text), 0) ?? 0) + (s.hold ?? (s.lines?.length ? 0 : 2.5)), 0);

/* ------------------------------------------------------------ shorthands */

const say = (who: string, text: string, tone?: Line['tone']): Line => ({ who, text, ...(tone ? { tone } : {}) });
const tell = (text: string): Line => ({ who: 'narrator', text });
/** A wide shot of the stage round x; a close-up of someone; a two-shot. */
const wide = (x = 160, zoom = 1): Cam => ({ x, y: 104, zoom });
const close = (on: string, zoom = 2.6, tilt = 0): Cam => ({ on, zoom, tilt });
const two = (a: string, b: string, zoom = 1.7): Cam => ({ on: [a, b], zoom });
const sky = (x = 160): Cam => ({ x, y: 50, zoom: 1.4 });

/** The town's four in their usual places, on the left facing right. */
const TOWNSFOLK = {
  founder: { role: 'founder', x: 110, facing: 'right' },
  hero: { role: 'hero', x: 132, facing: 'right' },
  wit: { role: 'wit', x: 86, facing: 'right' },
  worrier: { role: 'worrier', x: 64, facing: 'right' },
} as const satisfies Record<string, CastMember>;

/* ------------------------------------------------------------ the scenes */

const SCENES: Cutscene[] = [
  // ---------------------------------------------------------------- the founding
  {
    id: 'founding',
    title: 'The Founding',
    cast: { founder: { role: 'founder', x: -20, facing: 'right' }, wit: { role: 'wit', x: -40, facing: 'right' } },
    shots: [
      { look: 'meadows_1', cam: sky(120), to: wide(150, 1), fx: ['fadeIn'], caption: 'Year One', hold: 3.5, lines: [tell('Every town begins the same way: with somebody tired of walking.')] },
      { cam: wide(110, 1.3), acts: [{ who: 'founder', walk: 140 }, { who: 'wit', walk: 112 }], lines: [say('founder', 'Here. This is the place.'), say('wit', 'You said that about the last place.')] },
      { cam: close('founder', 2.8), lines: [say('founder', 'The last place was a swamp.'), say('wit', 'It had character.', 'whisper')] },
      { cam: two('founder', 'wit', 2), acts: [{ who: 'founder', face: 'left' }], lines: [say('founder', 'Water by the river. Wood in the forest. Good soil. A fine view.'), say('wit', 'And no wolves?'), say('founder', 'Very few wolves.')] },
      { cam: close('wit', 3, -0.06), lines: [say('wit', '"Very few" is a number I would like to see written down.')] },
      { cam: wide(140, 1.1), to: sky(150), acts: [{ who: 'founder', face: 'right' }, { who: 'founder', pose: 'cheer' }], lines: [say('founder', 'We build here. A fire tonight, a roof by winter, and one day... a town!'), say('wit', 'One day a town. Tonight, a fire. Got it. Where are you going?'), say('founder', 'To find out what "very few" means.')] },
      { cam: sky(150), fx: ['fadeOut'], hold: 2.5, lines: [tell('And so it began. Nobody wrote it down at the time. They were busy.')] },
    ],
  },

  // ---------------------------------------------------------------- the Calamity wakes (one for each)
  {
    id: 'calamity_wake_tyrant',
    title: 'The Ashen Tyrant Wakes',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 240, facing: 'left', hidden: true, scale: 1.2 } },
    shots: [
      { look: 'battle_ruins', cam: sky(230), to: wide(230, 1.2), fx: ['fadeIn', 'darken'], caption: 'Far beyond the known land', hold: 3, lines: [tell('Far away, in a tower that was not there last week, a dead king opened his eyes.')] },
      { cam: wide(230, 1.6), acts: [{ who: 'avatar', enter: 240, from: 'right' }], fx: ['rumble'], lines: [say('avatar', 'At last. I live. Again. Mostly.', 'shout')] },
      { cam: close('avatar', 3, 0.08), lines: [say('avatar', 'Bring me my crown. My armies. My... where is everyone?'), tell('Nobody answered. His staff had left some centuries ago.')] },
      { cam: close('avatar', 2.4, -0.05), acts: [{ who: 'avatar', pose: 'strike' }], fx: ['red', 'shake'], lines: [say('avatar', 'Then I shall raise new ones! And the first thing they will burn is that little town to the west with the smoke and the... goat.', 'shout')] },
      { look: 'town', cam: wide(100, 1.4), fx: ['fadeIn'], lines: [say('worrier', 'Did anyone else feel the ground do a sort of... shiver?'), say('wit', 'Duchess did. She ate her rope.')] },
      { cam: two('founder', 'hero'), lines: [say('hero', 'Smoke on the eastern sky. Red light, like a forge.'), say('founder', 'Probably nothing.')] },
      { cam: close('worrier', 2.8, 0.05), lines: [say('worrier', 'I am adding it to the list.'), say('wit', 'Which list?'), say('worrier', 'The list.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2, lines: [tell('It was not probably nothing.')] },
    ],
  },
  {
    id: 'calamity_wake_rot',
    title: 'The Grey Rot Wakes',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 240, facing: 'left', hidden: true, scale: 1.1 } },
    shots: [
      { look: 'wasteland_3', cam: wide(220, 1.1), to: wide(240, 1.5), fx: ['fadeIn', 'darken'], caption: 'A far valley', hold: 3, lines: [tell('In a far valley the trees went grey, then soft, then quiet.')] },
      { cam: wide(240, 1.8), acts: [{ who: 'avatar', enter: 240, from: 'right' }], fx: ['rumble'], lines: [say('avatar', 'Hhhhungry.', 'whisper')] },
      { cam: close('avatar', 3.2, 0.06), lines: [tell('Something at the heart of the grey had woken, and it had opinions about everything that was not yet grey.')] },
      { look: 'town', cam: wide(100, 1.4), fx: ['fadeIn'], lines: [say('wit', 'Has anyone smelled the bread this morning?'), say('worrier', 'Green. Fuzzy. Is that... normal fuzzy?')] },
      { cam: close('worrier', 2.8), lines: [say('worrier', 'Bread should not have a texture you could brush.')] },
      { cam: two('founder', 'hero'), lines: [say('hero', 'The wind is coming from the east. It smells like a cellar.'), say('founder', 'Then we keep the stores dry and our eyes open.')] },
      { cam: close('wit', 3, -0.06), lines: [say('wit', 'Duchess ate the fuzzy bread.'), say('worrier', 'Is she alright?'), say('wit', 'She seems smug.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2, lines: [tell('Duchess was fine. Duchess was always fine. The rest of the land would not be so lucky.')] },
    ],
  },
  {
    id: 'calamity_wake_sleeper',
    title: 'The Sleeper Stirs',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 240, facing: 'left', hidden: true, scale: 1.1 } },
    shots: [
      { look: 'crystal_3', cam: wide(230, 1.2), to: wide(240, 1.6), fx: ['fadeIn', 'darken', 'rumble'], caption: 'Under the mountains', hold: 3.5, lines: [tell('Under the mountains, something the size of a mountain turned over in its sleep.')] },
      { cam: close('avatar', 2.4), acts: [{ who: 'avatar', enter: 240, from: 'right' }], fx: ['glow'], lines: [say('avatar', '...five more centuries...', 'whisper')] },
      { look: 'town', cam: wide(100, 1.3), fx: ['fadeIn'], lines: [tell('That night everyone in the town had the same dream. At breakfast, nobody wanted to say so first.')] },
      { cam: two('wit', 'worrier', 2), lines: [say('wit', 'So. Sleep well?'), say('worrier', 'Wonderfully. No pits. No eyes. Definitely no voice saying my name.')] },
      { cam: close('worrier', 3, 0.07), lines: [say('worrier', 'Why, did you have a pit?'), say('wit', 'A big one. With an eye in it. It winked at me.')] },
      { cam: two('founder', 'hero'), lines: [say('founder', 'We all had it.'), say('hero', 'Then it is not a dream. It is a warning.'), say('wit', 'Or the cheese.')] },
      { cam: close('founder', 2.6), lines: [say('founder', 'Nobody is blaming the cheese.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 2, lines: [tell('It was not the cheese.')] },
    ],
  },

  // ---------------------------------------------------------------- the stages (shared: the names come from the town)
  {
    id: 'calamity_spreading',
    title: 'The Spreading',
    cast: { ...TOWNSFOLK },
    shots: [
      { look: 'wasteland_1', cam: wide(200, 1.1), to: wide(120, 1.1), fx: ['fadeIn', 'darken'], caption: 'The Spreading', hold: 3, lines: [tell('{Calamity} reached out across the land, and where it touched, nothing grew.')] },
      { look: 'town', cam: two('founder', 'hero'), fx: ['fadeIn'], lines: [say('hero', 'The scouts found its heart. {heart}. The land dies round it in rings.'), say('founder', 'Then we go there and break it.')] },
      { cam: close('worrier', 2.8), lines: [say('worrier', 'Or, and hear me out, we stay here and build very tall walls and never ever go outside.')] },
      { cam: two('wit', 'worrier', 2), lines: [say('wit', 'We could carve a stone with angry runes on it.'), say('worrier', 'That is the stupidest... wait, does that work?'), say('wit', 'Wise woman down the road swears by it.')] },
      { cam: close('founder', 2.4, -0.05), acts: [{ who: 'founder', pose: 'talk' }], lines: [say('founder', 'Ward stones, then. And anyone who wants to be a hero, the nests on the land need burning out.')] },
      { cam: close('hero', 2.8), acts: [{ who: 'hero', pose: 'cheer' }], lines: [say('hero', 'I will go! For the town! For our children! For the soil itself, which—'), say('wit', 'He is doing the speech.', 'whisper')] },
      { cam: wide(100, 1.2), fx: ['fadeOut'], hold: 1.5, lines: [say('hero', '—and for every blade of grass that ever—'), tell('The speech went on for some time.')] },
    ],
  },
  {
    id: 'calamity_cults',
    title: 'The Cults',
    cast: { ...TOWNSFOLK, preacher: { role: 'foe:bandit', x: 220, facing: 'left' } },
    shots: [
      { look: 'abandoned_3', cam: wide(220, 1.6), fx: ['fadeIn', 'darken'], caption: 'The Cults', hold: 2.5, lines: [tell('In the dark at the edge of the woods, a lantern swung, and a voice spoke softly.')] },
      { cam: close('preacher', 3, 0.08), lines: [say('preacher', 'Brothers. Sisters. Why fight {calamity}? It is coming anyway. Join {cult}. We have hoods.')] },
      { cam: close('preacher', 2.6, -0.05), lines: [say('preacher', 'Very comfortable hoods. And the meetings have snacks.', 'whisper')] },
      { look: 'town', cam: two('founder', 'wit'), fx: ['fadeIn'], lines: [say('wit', 'Someone left a pamphlet in the well. "Doom: Is It Right For You?"'), say('founder', 'Burn it.')] },
      { cam: close('worrier', 2.6), lines: [say('worrier', 'If someone in town has joined, they could be anyone. They could be YOU.'), say('wit', 'They could be Duchess.')] },
      { cam: close('wit', 3, 0.06), lines: [say('worrier', 'Duchess has not been seen since Tuesday.'), say('wit', '...Duchess.', 'whisper')] },
      { cam: two('founder', 'hero'), lines: [say('hero', 'The guards will keep watch. Whoever it is, they will slip.'), say('founder', 'And when they do, they leave. Nobody gets burned. But they leave.')] },
      { cam: wide(110, 1), fx: ['fadeOut'], hold: 2, lines: [tell('Duchess came back on Wednesday, wearing a small hood. Nobody asked.')] },
    ],
  },
  {
    id: 'calamity_armies',
    title: 'The Armies',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 250, facing: 'left', scale: 1.2 } },
    shots: [
      { look: 'heights_3', cam: wide(250, 1.2), to: close('avatar', 2.2), fx: ['fadeIn', 'darken', 'rumble'], caption: 'The Armies', hold: 2.5, lines: [say('avatar', 'Enough waiting. Send the host. All of it.', 'shout')] },
      { cam: close('avatar', 2.8, 0.1), lines: [say('avatar', 'And someone find out who keeps signing my orders "Lord Grumpy".')] },
      { look: 'town', cam: wide(110, 1.2), fx: ['fadeIn', 'shake'], lines: [tell('Out on the road, more of them than anyone wanted to count.')] },
      { cam: close('worrier', 2.8, -0.08), fx: ['rumble'], lines: [say('worrier', 'I counted them.'), say('wit', 'And?'), say('worrier', 'I am not going to tell you. You will panic.')] },
      { cam: two('founder', 'hero', 1.8), acts: [{ who: 'hero', pose: 'strike' }], lines: [say('hero', 'Every hand that can hold a spear, to the wall!'), say('founder', 'And the ones who can hold a ladle, to the soup. A fed wall holds longer.')] },
      { cam: close('wit', 3), lines: [say('wit', 'I can hold both. I can hold a ladle menacingly.')] },
      { cam: wide(110, 1.1), to: sky(120), fx: ['fadeOut'], hold: 2, lines: [tell('They held the wall. Mostly they held it with spears. Sometimes with ladles.')] },
    ],
  },
  {
    id: 'calamity_siege',
    title: 'The Last Siege',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 340, facing: 'left', scale: 1.3 } },
    shots: [
      { look: 'battle_ruins', cam: sky(200), to: wide(200, 1), fx: ['fadeIn', 'red', 'rumble'], caption: 'The Last Siege', hold: 3, lines: [tell('It came at dawn, with everything it had.')] },
      { cam: wide(250, 1.3), acts: [{ who: 'avatar', walk: 240 }], fx: ['shake'], lines: [say('avatar', 'Little town! I have burned kingdoms! I have outlived gods! Open your gate!', 'shout')] },
      { cam: close('wit', 3, 0.05), lines: [say('wit', 'Our gate is open. It is the wall you are having trouble with.')] },
      { cam: close('avatar', 2.8, -0.1), fx: ['red'], lines: [say('avatar', '...Then I will take the wall.', 'shout')] },
      { cam: close('founder', 2.4), to: close('founder', 3), lines: [say('founder', 'Everyone. Look at me. Not at it. At me.'), say('founder', 'We built this from a campfire and a bad idea. We are not giving it to a thing that cannot even keep its staff.')] },
      { cam: close('hero', 2.8), acts: [{ who: 'hero', pose: 'cheer' }], lines: [say('hero', 'I have a speech!'), say('everyone', 'NO SPEECH.', 'shout')] },
      { cam: two('hero', 'avatar', 1.3), acts: [{ who: 'hero', walk: 170 }, { who: 'hero', pose: 'strike' }], fx: ['flash', 'shake'], burst: { on: 'avatar', fx: 'px:fire-explosion' }, lines: [say('hero', 'FOR {TOWN}!', 'shout')] },
      { cam: wide(200, 1), fx: ['fadeOut'], hold: 2, lines: [tell('Whatever happened next, the songs would be about it.')] },
    ],
  },

  // ---------------------------------------------------------------- endings
  {
    id: 'calamity_victory',
    title: 'Victory',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 220, facing: 'left', scale: 1.3 } },
    shots: [
      { look: 'battle_ruins', cam: close('avatar', 2.2), acts: [{ who: 'avatar', pose: 'down' }], fx: ['flash', 'shake'], hold: 2, lines: [say('avatar', 'Impossible... beaten by... farmers...', 'whisper')] },
      { cam: close('avatar', 3, 0.12), lines: [say('wit', 'And one goat.'), say('avatar', '...I hate this town.', 'whisper')] },
      { cam: wide(180, 1.1), to: sky(160), fx: ['glow'], hold: 3, lines: [tell('{Calamity} fell, and the grey went out of the sky like ink out of water.')] },
      { look: 'town', cam: wide(110, 1.3), acts: [{ who: 'founder', pose: 'cheer' }, { who: 'hero', pose: 'cheer' }, { who: 'wit', pose: 'cheer' }], fx: ['fadeIn'], lines: [say('hero', 'We did it! We actually did it!'), say('worrier', 'I would like everyone to know I was very brave the entire time.')] },
      { cam: two('wit', 'worrier', 2), lines: [say('wit', 'You hid in the root cellar.'), say('worrier', 'Bravely. I hid bravely.')] },
      { cam: close('founder', 2.6), to: close('founder', 3.2), lines: [say('founder', 'Tonight, we feast. Tomorrow, we fix the wall. And the day after that...'), say('founder', '...we live. That is the whole plan. We just get to live.')] },
      { cam: sky(110), fx: ['fadeOut'], hold: 3, caption: '{Town} endures', lines: [tell('And they did.')] },
    ],
  },
  {
    id: 'calamity_defeat',
    title: 'The Town Burns',
    cast: { ...TOWNSFOLK, avatar: { role: 'avatar', x: 250, facing: 'left', scale: 1.3 } },
    shots: [
      { look: 'wasteland_1', cam: wide(160, 1), fx: ['fadeIn', 'red'], caption: 'After the siege', hold: 3, lines: [tell('The town held. Barely. The smoke would take days to clear.')] },
      { cam: close('avatar', 2.4, 0.1), acts: [{ who: 'avatar', exit: 'right' }], lines: [say('avatar', 'I will return, little town. I always return. It is my whole thing.', 'shout')] },
      { look: 'town', cam: two('founder', 'hero', 1.8), fx: ['fadeIn', 'darken'], acts: [{ who: 'hero', pose: 'kneel' }], lines: [say('hero', 'I should have been faster.'), say('founder', 'You were there. That is what counts.')] },
      { cam: close('worrier', 2.8), lines: [say('worrier', 'I have started a new list. It is called "Things To Do Better Next Time". It is long.')] },
      { cam: close('wit', 3, 0.05), lines: [say('wit', 'Item one: do not lose.'), say('worrier', 'That is item one, yes.')] },
      { cam: wide(100, 1.2), to: sky(110), fx: ['fadeOut'], hold: 2.5, lines: [say('founder', 'We rebuild. We get stronger. And next time, it does not walk away.')] },
    ],
  },
  {
    id: 'calamity_heart',
    title: 'The Heart Breaks',
    cast: { hero: { role: 'hero', x: 150, facing: 'right' }, wit: { role: 'wit', x: 124, facing: 'right' } },
    shots: [
      { look: 'crystal_1', cam: wide(190, 1.3), fx: ['fadeIn', 'darken', 'glow'], caption: '{heart}', hold: 2.5, lines: [tell('At the heart of the blight, something pulsed like a sick drum.')] },
      { cam: two('hero', 'wit', 2), lines: [say('wit', 'It is smaller than I expected.'), say('hero', 'Everything is, up close.')] },
      { cam: close('hero', 3, -0.08), acts: [{ who: 'hero', pose: 'strike' }], fx: ['flash', 'shake'], lines: [say('hero', 'This one is for the bread.', 'shout')] },
      { cam: wide(180, 1.2), fx: ['rumble', 'glow'], hold: 2, lines: [tell('The heart cracked. Across the land, the grey shrank back, as if it had stubbed its toe.')] },
      { cam: close('wit', 3), fx: ['fadeOut'], lines: [say('wit', 'Do you think it will grow back?'), say('hero', 'Probably. Bring a bigger sword next time.')] },
    ],
  },

  // ---------------------------------------------------------------- nests
  {
    id: 'nest_found',
    title: 'Something Nests',
    cast: { hero: { role: 'hero', x: 120, facing: 'right' }, worrier: { role: 'worrier', x: 96, facing: 'right' }, beast: { role: 'foe:{nestfoe}', x: 250, facing: 'left' } },
    shots: [
      { look: 'abandoned_3', cam: wide(160, 1.2), fx: ['fadeIn', 'darken'], caption: 'Out on the land', hold: 2.5, lines: [tell('Out past the fields, where the scouts do not like to go, something has moved in.')] },
      { cam: two('hero', 'worrier', 2.2), lines: [say('worrier', 'What is that smell?'), say('hero', 'A {nest}. {Folk}. Lots of them.')] },
      { cam: close('beast', 2.6, 0.08), fx: ['rumble'], hold: 1.5 },
      { cam: close('worrier', 3, -0.05), lines: [say('worrier', 'It looked at me. Why did it look at me?'), say('hero', 'It looks at everyone.'), say('worrier', 'It looked at me MORE.')] },
      { cam: wide(150, 1.1), acts: [{ who: 'worrier', exit: 'left' }], lines: [say('hero', 'Left alone, these things grow. Somebody needs to burn it out.'), say('worrier', 'Somebody! Good! Not me!', 'shout')] },
    ],
  },
  {
    id: 'nest_cleared',
    title: 'Burned Out',
    cast: { hero: { role: 'hero', x: 140, facing: 'right' }, wit: { role: 'wit', x: 114, facing: 'right' } },
    shots: [
      { look: 'wasteland_2', cam: wide(160, 1.2), fx: ['fadeIn', 'red'], caption: 'The {nest}, burning', hold: 2.5, lines: [tell('The {nest} burned for a day and a night.')] },
      { cam: two('hero', 'wit', 2), lines: [say('wit', 'I brought marshmallows.'), say('hero', 'That is a monster nest.'), say('wit', 'It is a very good fire.')] },
      { cam: close('hero', 2.8), lines: [say('hero', 'One less thing in the dark.'), say('wit', 'One less thing in the dark that wants to eat us. There is still plenty of dark.')] },
      { cam: sky(150), fx: ['fadeOut'], hold: 2, lines: [tell('The land round it would heal. Slowly. Land is patient like that.')] },
    ],
  },

  // ---------------------------------------------------------------- the dragon
  {
    id: 'dragon_arrives',
    title: 'The Dragon',
    cast: { ...TOWNSFOLK, dragon: { role: 'dragon', x: 250, facing: 'left', hidden: true, scale: 1.4 } },
    shots: [
      { look: 'town', cam: sky(160), to: sky(220), fx: ['fadeIn', 'darken'], hold: 2, lines: [tell('A shadow crossed the sun. Then it came back, because it had forgotten something.')] },
      { cam: wide(240, 1.2), acts: [{ who: 'dragon', enter: 250, from: 'right' }], fx: ['shake', 'rumble'], lines: [say('dragon', 'TINY ONES. I AM {DRAGON}. I HAVE COME FOR TRIBUTE.', 'shout')] },
      { cam: close('worrier', 3, 0.08), lines: [say('worrier', 'It talks. Why does it talk. Nobody said they talked.')] },
      { cam: close('dragon', 2.4, -0.06), fx: ['red'], lines: [say('dragon', 'GOLD. OR FIRE. I AM VERY FLEXIBLE ON WHICH.', 'shout')] },
      { cam: two('founder', 'wit', 2), lines: [say('wit', 'Could we offer it Duchess?'), say('founder', 'We are not feeding Duchess to a dragon.'), say('wit', 'I meant as a negotiator.')] },
      { cam: close('founder', 2.6), to: close('founder', 3.2), lines: [say('founder', 'Give us a little time to talk it over.'), say('dragon', 'TAKE ALL THE TIME YOU NEED. I WILL BE ON THE HILL. LOOMING.', 'shout')] },
      { cam: wide(200, 1), fx: ['fadeOut'], hold: 1.5, lines: [tell('It went and loomed. It was very good at it.')] },
    ],
  },
  {
    id: 'dragon_slain',
    title: 'Dragonslayers',
    cast: { hero: { role: 'hero', x: 120, facing: 'right' }, wit: { role: 'wit', x: 96, facing: 'right' }, dragon: { role: 'dragon', x: 230, facing: 'left', scale: 1.4 } },
    shots: [
      { look: 'crystal_2', cam: wide(200, 1.1), fx: ['fadeIn', 'darken'], caption: 'The lair', hold: 2 },
      { cam: two('hero', 'dragon', 1.4), acts: [{ who: 'hero', walk: 180 }, { who: 'hero', pose: 'strike' }], fx: ['flash', 'shake'], burst: { on: 'dragon', fx: 'px:fire-explosion' }, lines: [say('hero', 'For every barn you ever burned!', 'shout')] },
      { cam: close('dragon', 2.4, 0.12), acts: [{ who: 'dragon', pose: 'down' }], fx: ['rumble'], lines: [say('dragon', 'I... only burned... the one barn... on purpose...', 'whisper')] },
      { cam: two('hero', 'wit', 2.2), acts: [{ who: 'wit', walk: 150 }], lines: [say('wit', 'Is it dead?'), say('hero', 'It is dead.'), say('wit', 'Then I would like to look at the gold now, in a respectful way.')] },
      { cam: sky(200), fx: ['glow', 'fadeOut'], hold: 2.5, caption: 'Dragonslayers', lines: [tell('They came home with gold, gems, a dragon\'s heart, and a story that got bigger every time it was told.')] },
    ],
  },

  // ---------------------------------------------------------------- the Deep (sim/deep.ts)
  {
    id: 'deep_breakthrough',
    title: 'Into the Deep',
    cast: { hero: { role: 'hero', x: 150, facing: 'right' }, worrier: { role: 'worrier', x: 122, facing: 'right' }, wit: { role: 'wit', x: -30, facing: 'right' } },
    shots: [
      { look: 'crystal_1', cam: wide(160, 1.3), fx: ['fadeIn', 'darken', 'rumble'], caption: 'Under the town', hold: 2.5, lines: [tell('The shaft went down forty feet into honest rock. Then the rock stopped being honest.')] },
      { cam: close('hero', 2.8), acts: [{ who: 'hero', pose: 'strike' }], fx: ['shake'], lines: [say('hero', 'One more swing and we are through!', 'shout')] },
      { cam: wide(170, 1.5), fx: ['flash', 'shake'], lines: [tell('They were through.')] },
      { cam: two('hero', 'worrier', 2.2), lines: [say('worrier', 'There is a whole cave down here. Under the town. Under my bed.'), say('hero', 'It has been here for thousands of years.'), say('worrier', 'Under. My. Bed.')] },
      { cam: wide(110, 1.4), acts: [{ who: 'wit', enter: 96, from: 'left' }], lines: [say('wit', 'I brought a torch, a rope, and a list of things that live in caves.'), say('worrier', 'Do not read the list.')] },
      { cam: close('wit', 3, -0.05), lines: [say('wit', 'Bats. Worms. Big worms. A thing marked only "no".')] },
      { cam: close('worrier', 3, 0.06), lines: [say('worrier', 'I asked you not to read the list.')] },
      { cam: wide(160, 1), fx: ['fadeOut'], hold: 2, lines: [say('hero', 'Picks up. There is ore in these walls, and the dark goes a long way down.'), tell('Somewhere far below, something heard the picks, and turned over in its sleep.')] },
    ],
  },
  {
    id: 'deep_abyss',
    title: 'The Abyss',
    cast: { hero: { role: 'hero', x: 140, facing: 'right' }, worrier: { role: 'worrier', x: 112, facing: 'right' }, founder: { role: 'founder', x: 88, facing: 'right' } },
    shots: [
      { look: 'temple_3', cam: sky(170), to: wide(170, 1.2), fx: ['fadeIn', 'red', 'rumble'], caption: '{deepest}', hold: 3, lines: [tell('Five levels down the floor ends, and a warm wind comes up out of the dark, smelling of old pennies and older things.')] },
      { cam: close('hero', 2.8), lines: [say('hero', 'There are carvings on the walls. Things with a great many arms, bowing to something with more.')] },
      { cam: close('worrier', 3, -0.08), fx: ['shake'], lines: [say('worrier', 'I have a question. Why are we still digging?'), say('hero', 'Gold.'), say('worrier', 'That is not a reason. That is a hobby.')] },
      { cam: two('founder', 'hero', 2), lines: [say('founder', 'We have come this far. We dig carefully, we post a guard on the shaft, and the first sign of anything with more arms than me, we bring the rope up.'), say('hero', 'How many arms is that?'), say('founder', 'Two. I am being very cautious.')] },
      { cam: wide(200, 1.1), fx: ['red', 'rumble'], hold: 2, lines: [tell('Far below, a red light blinked. Then, very slowly, it blinked back.')] },
      { cam: close('worrier', 3.2), fx: ['fadeOut'], lines: [say('worrier', 'I want it written down that I said so.', 'whisper')] },
    ],
  },

  {
    id: 'village_founded',
    title: 'A Village of Their Own',
    cast: { founder: { role: 'founder', x: 70, facing: 'right' }, hero: { role: 'hero', x: 128, facing: 'left' }, worrier: { role: 'worrier', x: 150, facing: 'left' }, wit: { role: 'wit', x: 96, facing: 'right' } },
    shots: [
      { look: 'town', cam: wide(110, 1.2), fx: ['fadeIn'], caption: '{village}', hold: 2.5, lines: [tell('At first light a cart stood packed by the fire, and a small crowd stood round it pretending not to cry.')] },
      { cam: close('hero', 2.8), lines: [say('hero', 'Good ground out there. Water, wood, and nobody snoring through the wall.')] },
      { cam: two('founder', 'hero', 2.2), lines: [say('founder', 'You will send word. And grain. Mostly word. Some grain.'), say('hero', 'We will send what we can spare.'), say('founder', 'That is what I said when I left home. I sent nothing for a year.')] },
      { cam: close('worrier', 3, 0.05), lines: [say('worrier', 'What if wolves come? What if the roof leaks? What if we have no roof?'), say('hero', 'Then we build a roof.'), say('worrier', 'What if the wolves come while we build the roof?')] },
      { cam: close('wit', 3, -0.05), lines: [say('wit', 'I have named the village. I have also named the wolves. It helps.')] },
      { cam: wide(150, 1.1), acts: [{ who: 'hero', walk: 260 }, { who: 'worrier', walk: 270 }], fx: ['fadeOut'], hold: 2.5, lines: [tell('They went down the road with the cart, looking back twice. The town looked back more than that.')] },
    ],
  },

  // ---------------------------------------------------------------- a tale well ended
  {
    id: 'saga_triumph',
    title: 'A Tale Ends Well',
    cast: { ...TOWNSFOLK },
    shots: [
      { look: 'town', cam: wide(100, 1.2), fx: ['fadeIn'], caption: '{saga}', hold: 2.5, lines: [tell('Some stories end badly. This one did not.')] },
      { cam: close('hero', 2.6), acts: [{ who: 'hero', pose: 'cheer' }], lines: [say('hero', 'It is done! {saga}, finished, and every one of us came home!')] },
      { cam: two('wit', 'worrier', 2), lines: [say('worrier', 'Not every one. You left your boots.'), say('hero', 'My boots were a sacrifice.')] },
      { cam: close('founder', 2.6), lines: [say('founder', 'They will tell this one by the fire for years.'), say('wit', 'Badly. With a dragon in it. There was no dragon.')] },
      { cam: sky(100), fx: ['fadeOut'], hold: 2, lines: [say('wit', 'There will be a dragon by next spring.', 'whisper')] },
    ],
  },
];

export const CUTSCENES: Readonly<Record<string, Cutscene>> = Object.fromEntries(SCENES.map((c) => [c.id, c]));
/** The scene the town's Calamity wakes with. */
export const wakeSceneOf = (kind: string) => `calamity_wake_${kind}`;
/** The scene for each stage the Calamity passes into (2 to 5). */
export const STAGE_SCENES: Record<number, string> = { 2: 'calamity_spreading', 3: 'calamity_cults', 4: 'calamity_armies', 5: 'calamity_siege' };

/** Fill a line's {names}: lower case as given, and `{Name}` (capitalised first letter) and `{NAME}` (all capitals). */
export function fillLine(text: string, vars: Record<string, string>): string {
  return text.replace(/\{([A-Za-z]+)\}/g, (all, key: string) => {
    const v = vars[key.toLowerCase()];
    if (v === undefined) return all;
    if (key === key.toUpperCase() && key.length > 1) return v.toUpperCase();
    if (key[0] === key[0].toUpperCase()) return v.charAt(0).toUpperCase() + v.slice(1);
    return v;
  });
}
