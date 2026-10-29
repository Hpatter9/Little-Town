import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EVENT_SCENES, debriefScene, sceneFor } from '../src/renderer/panel/eventScenes';
import { fitScene, skyOfWords } from '../src/renderer/panel/sceneWords';
import { sceneLine } from '../src/shared/data/eventScenes';

const kinds = (fx: { kind: string }[]) => fx.map((f) => f.kind);

test('the words give the time of day and the weather', () => {
  assert.deepEqual(skyOfWords('Black cloud comes down off the hills, and the wind gets up.'), { weather: 'storm' });
  assert.deepEqual(skyOfWords('A clear spring morning; the dew is still on the grass. Last night the wolves came.'), { time: 'day', weather: 'clear' });
  assert.deepEqual(skyOfWords('A still autumn night, every star out.'), { time: 'night' });
  assert.deepEqual(skyOfWords('A winter evening, the sky going red behind the hills.'), { time: 'dusk' });
  assert.deepEqual(skyOfWords('Snow fell in the night, and the winter morning is white and hushed.').weather, 'snow');
  assert.deepEqual(skyOfWords('The council meets about the grain.'), {});
});

test('every line the events set their scene with is read as its time and weather', () => {
  const hours: [number, string][] = [[7, 'day'], [11, 'day'], [15, 'day'], [19, 'dusk'], [23, 'night']];
  for (const weather of ['clear', 'rain', 'storm', 'snow', 'fog'])
    for (const [hour, time] of hours)
      for (let salt = 0; salt < 2; salt++) {
        const line = sceneLine({ hour, season: 'spring', weather, biome: 'forest', era: 'medieval', sea: false } as never, salt);
        const sky = skyOfWords(line);
        assert.equal(sky.time, time, `${line} (${time})`);
        if (weather !== 'clear') assert.equal(sky.weather, weather, line);
      }
});

test("a card's picture follows its words: morning over a dusk wood is day, a storm brings rain and no birds", () => {
  const beast = EVENT_SCENES.beast;
  assert.equal(beast.back, 'forest_2', 'the wolves scene is at dusk');
  const morning = fitScene(beast, 'Wolves at the livestock. A clear spring morning; the dew is still on the grass.');
  assert.equal(morning.back, 'forest_3', 'the same wood by day');
  const road = EVENT_SCENES.road;
  assert.ok(kinds(road.fx).includes('birds'));
  const storm = fitScene(road, 'Black cloud comes down… the wind gets up.');
  assert.equal(storm.back, road.back);
  assert.ok(kinds(storm.fx).includes('rain') && kinds(storm.fx).includes('flash'), kinds(storm.fx).join());
  assert.ok(!kinds(storm.fx).includes('birds') && !kinds(storm.fx).includes('dust'));
  assert.ok(storm.tint && storm.tint[1] >= 0.4, 'darkened');
  const night = fitScene(road, 'They make camp. A still summer night, every star out.');
  assert.ok(night.tint && night.tint[1] >= 0.5 && !kinds(night.fx).includes('birds'), 'a night wash, no birds');
  // (words that say nothing of the sky, and a scene indoors, are left alone)
  assert.equal(fitScene(road, 'The party walks on.'), road);
  assert.equal(fitScene(EVENT_SCENES.council, 'A wild night, the wind howling round the walls.'), EVENT_SCENES.council);
});

test("the founder's story cards are pictured by what they tell; a raid lived through at the gate", () => {
  assert.equal(debriefScene("Maren's story: A raid survived"), 'aftermath');
  assert.equal(sceneFor({ kind: 'debrief', title: "Maren's story: A raid survived", text: 'The bandits came for the town, and Maren was there.' }), 'aftermath');
  assert.equal(debriefScene("Wedmore's story: A quest won"), 'road', "not the founder's own name");
  assert.equal(debriefScene("Maren's story: A marriage"), 'wedding');
  assert.equal(debriefScene("Maren's story: A child"), 'birth');
  assert.equal(debriefScene("Maren's story: A new leader"), 'funeral');
  assert.equal(debriefScene('The year 3 chronicle'), 'study');
  assert.ok(EVENT_SCENES.aftermath);
});
