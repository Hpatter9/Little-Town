// A card's picture follows its words (the playthrough: "Black cloud comes down… the wind gets up" over a sunny meadow;
// "A clear spring morning" over a red dusk). The scene is picked by what the card is about (eventScenes.ts `sceneFor`);
// this reads the words for the time of day and the weather and sets them on it: a dusk or night backdrop traded for a
// day one of the same land when the words say morning, a wash of dusk or night over a day one, and the rain, snow,
// mist, wind or storm the words speak of (and no birds in a storm). Indoors, and in the caves and the deep, nothing
// changes. Pure: no DOM, so the tests read it.

import type { Fx, FxKind, SceneScript } from './sceneScripts';

export type SceneTime = 'day' | 'dusk' | 'night';
export type SceneWeather = 'storm' | 'rain' | 'snow' | 'fog' | 'wind' | 'clear';

/** The words for each time of day (data/eventScenes.ts `SKY` sets an event's scene in these; the events have their own). */
const TIMES: [RegExp, SceneTime][] = [
  [/\b(?:night|midnight|moon(?:lit|light)?|starlight|every star|after dark|small hours)\b/i, 'night'],
  [/\b(?:evening|dusk|sunset|sundown|twilight|nightfall|going red behind)\b/i, 'dusk'],
  [/\b(?:morning|dawn|daybreak|sunrise|sun is (?:barely )?up|noon|midday|afternoon|broad daylight|sun stands high|light slants|all (?:\w+ )?day|pale \w+ sun|in the sun)\b/i, 'day'],
];
/** The words for the weather, the strongest first. */
const WEATHERS: [RegExp, SceneWeather][] = [
  [/\b(?:storms?|stormy|thunder\w*|lightning|black clouds?|tempest|gale|wild \w+ night)\b/i, 'storm'],
  [/\b(?:snow\w*|blizzard|sleet|flakes)\b/i, 'snow'],
  [/\b(?:rain\w*|downpour|drizzle|showers?|wet \w+ (?:morning|day|afternoon|evening|night))\b/i, 'rain'],
  [/\b(?:fog|foggy|mist|misty)\b/i, 'fog'],
  [/\b(?:wind (?:gets up|rises|howls|tears|picks up)|the wind|gusts?|windy)\b/i, 'wind'],
  [/\b(?:clear (?:sky|skies|morning|day|night|\w+ morning)|sunny|sunshine|blue sky|bright \w+ noon)\b/i, 'clear'],
];

/** The time of day and the weather the words speak of (the time named first counts: "A clear morning… last night"). */
export function skyOfWords(words: string): { time?: SceneTime; weather?: SceneWeather } {
  let time: SceneTime | undefined;
  let at = Infinity;
  // (a night gone by is not now: "snow fell in the night, and the morning is white")
  const now = words.replace(/\b(?:in the night|during the night|last night|the night before|overnight)\b/gi, '');
  for (const [re, t] of TIMES) {
    const m = re.exec(now);
    if (m && m.index < at) {
      at = m.index;
      time = t;
    }
  }
  const weather = WEATHERS.find(([re]) => re.test(words))?.[1];
  return { ...(time ? { time } : {}), ...(weather ? { weather } : {}) };
}

/** The painted backdrops that are not by day (looked over one by one), and those under a roof or the ground. */
const BACK_TIME: Record<string, SceneTime> = {
  forest_2: 'dusk', meadows_1: 'dusk', ocean_2: 'dusk', ocean_5: 'dusk', skies_2: 'dusk', heights_1: 'dusk', mountains_2: 'dusk', city_2: 'dusk', city_4: 'dusk',
  moon_1: 'night', moon_2: 'night', moon_3: 'night', moon_4: 'night', forest_4: 'night', forest_5: 'night', cloudscape_1: 'night', clouds_3: 'night', heights_2: 'night', heights_3: 'night', city_1: 'night', city_5: 'night', industrial_night: 'night', wasteland_3: 'night', abandoned_3: 'night', steampunk_3: 'night',
};
const UNDER = /^(?:set:|crystal_|underwater_|battle_hall)/;
/** The same land by day, for a backdrop that is dusk or night. */
const BY_DAY: Record<string, string> = {
  forest_2: 'forest_3', forest_4: 'forest_3', forest_5: 'forest_3', meadows_1: 'summer_2', ocean_2: 'ocean_3', ocean_5: 'ocean_3', skies_2: 'skies_1', heights_1: 'heights_4', heights_2: 'heights_4', heights_3: 'heights_4',
  mountains_2: 'mountains_1', moon_1: 'summer_2', moon_2: 'summer_2', moon_3: 'summer_2', moon_4: 'summer_2', cloudscape_1: 'clouds_1', clouds_3: 'clouds_1', city_1: 'city_3', city_5: 'city_3', city_2: 'city_3', city_4: 'city_3', industrial_night: 'industrial_day',
};
/** The washes laid over a day backdrop for dusk and night, and over any for the weather. */
const WASH: Record<SceneTime | 'storm' | 'rain' | 'snow' | 'fog', [string, number]> = {
  day: ['#000000', 0],
  dusk: ['#6a2a10', 0.28],
  night: ['#060c26', 0.55],
  storm: ['#0a1020', 0.4],
  rain: ['#1a2430', 0.25],
  snow: ['#dce6f0', 0.12],
  fog: ['#b8c0c8', 0.18],
};
/** What can't be seen in each weather, and at night. */
const GONE: Partial<Record<SceneWeather | 'night', FxKind[]>> = {
  storm: ['birds', 'dust', 'fireflies', 'petals'],
  rain: ['birds', 'dust', 'fireflies'],
  snow: ['dust', 'fireflies', 'petals', 'rain'],
  fog: ['dust'],
  clear: ['rain', 'snow', 'flash'],
  night: ['birds'],
};
/** What each weather brings. */
const BRINGS: Partial<Record<SceneWeather, Fx[]>> = {
  storm: [{ kind: 'rain', n: 60 }, { kind: 'leaves', n: 8 }, { kind: 'flash', n: 1, colour: '#e0f0ff' }],
  rain: [{ kind: 'rain', n: 40 }],
  snow: [{ kind: 'snow', n: 30 }],
  fog: [{ kind: 'mist', n: 3, colour: '#dfe6ea' }],
  wind: [{ kind: 'leaves', n: 14 }, { kind: 'dust', n: 8 }],
};

/** The darker of two washes (the stronger wins: a storm at night is as dark as the night). */
const darker = (a: [string, number] | undefined, b: [string, number]): [string, number] => (a && a[1] >= b[1] ? a : b);

/** `script` with the time of day and the weather of `words` set on it (as it is where they say nothing, or indoors). */
export function fitScene(script: SceneScript, words: string): SceneScript {
  if (UNDER.test(script.back)) return script;
  const { time, weather } = skyOfWords(words);
  if (!time && !weather) return script;
  let back = script.back;
  let tint = script.tint;
  const was = BACK_TIME[back] ?? 'day';
  if (time === 'day' && was !== 'day' && BY_DAY[back]) {
    back = BY_DAY[back];
    // (the scene's own dusky wash goes with its dusk)
    if (tint && tint[1] >= 0.25) tint = undefined;
  } else if (time && time !== 'day' && was === 'day') tint = darker(tint, WASH[time]);
  if (weather && weather !== 'wind' && weather !== 'clear') tint = darker(tint, WASH[weather]);
  const gone = new Set<FxKind>([...(weather ? (GONE[weather] ?? []) : []), ...(time === 'night' || (!time && was === 'night') ? (GONE.night ?? []) : [])]);
  const fx = script.fx.filter((f) => !gone.has(f.kind));
  for (const f of (weather && BRINGS[weather]) || []) if (!fx.some((g) => g.kind === f.kind)) fx.push(f);
  if (time === 'night' && !fx.some((f) => f.kind === 'fireflies') && !gone.has('fireflies') && !weather) fx.push({ kind: 'fireflies', n: 5 });
  const out: SceneScript = { ...script, back, fx };
  if (tint && tint[1] > 0) out.tint = tint;
  else delete out.tint;
  return out;
}
