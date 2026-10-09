// A tale told in the event box (a `debrief` prompt: read, not answered), with a painted backdrop that fits its words.
// Shared by the systems that tell what happened to the town (the peoples' own ways: sim/grove.ts and the rest).

import { eventPicture } from '../data/eventScenes';
import { seaTown } from './sea';
import { notify, type GameState, type Prompt } from './state';
import { calendar, TICKS_PER_HOUR } from './time';
import { weatherAt } from './weather';

export function tellStory(s: GameState, title: string, story: string, words: string, opts: { who?: number; ok?: string; quiet?: boolean } = {}): Prompt {
  const cal = calendar(s.tick);
  const prompt: Prompt = {
    id: s.nextId++,
    kind: 'debrief',
    expedition: null,
    title,
    text: story.split('. ')[0] + '.',
    story,
    picture: eventPicture(`tale:${title}`, words, { hour: cal.hour, season: cal.season, weather: weatherAt(s.seed, s.tick, null).kind, biome: s.biome ?? 'forest', era: s.era, sea: seaTown(s) }),
    who: opts.who ?? s.mainId,
    options: [opts.ok ?? 'So be it'],
    defaultOption: 0,
    expiresTick: s.tick + 8 * TICKS_PER_HOUR,
  };
  s.prompts.push(prompt);
  if (!opts.quiet) notify(s, `${title}.`, true);
  return prompt;
}
