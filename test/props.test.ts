import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { test } from 'node:test';

test('every scenery set for the raid map has its atlas and objects that fit in it', () => {
  const frames = JSON.parse(readFileSync('src/renderer/art/props.json', 'utf8')) as Record<string, [number, number, number, number][]>;
  for (const set of ['wild', 'winter', 'desert', 'coast', 'cave', 'sea', 'grove']) {
    assert.ok(frames[set]?.length > 10, `${set} has objects`);
    assert.ok(existsSync(`src/renderer/art/props/${set}.png`), `${set} has its atlas`);
    for (const [x, , w, h] of frames[set]) assert.ok(x >= 0 && x + w <= 1024 && w > 0 && h > 0, `${set}: a frame inside the atlas`);
  }
});
