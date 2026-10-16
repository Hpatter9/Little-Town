## Props in the cutscenes (the owner's ask: "props involved like fire, an actual marshmallow on a stick, things like that to bring the scene to life")

Changes **Cutscenes (0.32.0)** (the scripts' format, the player) and every scene of it and of the Great Enemy's
(`data/greatEnemyScenes.ts`). Renderer and data only: the sim queues scenes as before (sim hashes unchanged).

- **The format** (`src/shared/data/cutscenes.ts`): a scene's `props` (there the whole scene: the weather, mostly) and a
  shot's `props` (brought on with it, gone when the scene cuts to another place, i.e. a shot with a new `look`):
  `{ id, kind, x, y?, scale?, layer?: 'back' | 'front', anim?: 'chew' | 'wander', flip?, lit? }`. New acts: a prop
  `{ prop, move: x }` or `{ prop, do: 'light' | 'douse' | 'break' | 'startle' | 'remove' }` (a thing burning that
  breaks burns out; anything else is knocked over; startled, the goat hops and bleats and the birds fly); an actor
  `{ who, hold: <held kind> | null }` (and `CastMember.hold` from the start), kept from shot to shot. Any act can take
  `line` (it starts as that line of the shot is spoken: the stick goes into the fire on the joke). New fx
  `ignite:<prop>` / `douse:<prop>`. New pose `reach` (stands idle, the thing in hand held out low in front). The camera
  can be `on` a prop.
- **The tables** (`src/shared/data/sceneProps.ts`): `PROPS` (38 kinds: campfire, firepit, the burning warren, torch,
  lantern, scorch, cauldron, tent, tent_side, bedroll, log, stump, rock, cart, wagon, barrel, crate, hay, bucket, sign,
  signpost, chest, gold, table, feast (a table with bread, pie, a tankard, an apple), banner / banner_red /
  banner_black, grave, skull, bones, skulls, duchess, birds; rain, snow, ash, fireflies): each its `art` (a file under
  `src/renderer/art/`), `scale`, `frames`, `tint`, `fire` (`FlameSpot`s as shares of its size, `smoke`, `light` reach),
  `lit` (a campfire is lit of itself), `out` (its cold sprite), `anim` (`flutter`, `goat`, `birds`), `glow`,
  `weather`, `flat`, `dressing`, `bleat`. Anything without `fire` burns with `FLAMES_ANY`. `HELD` (13: sword, axe,
  torch, lantern, ladle, tankard, list, map, pamphlet, bread, cheese, bucket, marshmallow_stick): `art`, `scale`,
  `grip` and `points` (where it's held and which way the art points), `carried` (held up before the chest), `burns`
  (a flame at its tip), `stick` (drawn in code).
- **The clock** (`src/renderer/cutscene/sceneClock.ts`, pure): `propsAt(script, cursor)` replays every shot so far
  (`PropNow`: lit, `since`, `out`, broken, startled, moving; `LONG_AGO` for things done in an earlier shot);
  `actorsAt` gains `hold` and acts waiting for a `line` (`lineStart`).
- **Drawn** (`src/renderer/cutscene/sceneProps.ts`, `SceneProps`; sprites through `cutscene/propArt.ts`): props in a
  layer behind the actors and one before them, each with a small shadow; whatever burns gets the 5000 Pixel Effects
  flame over each spot (grown over a second as it catches, sinking as it's doused), pvfx smoke rising (and a while
  after it goes out), embers drifting up, a pool of warm light on the ground and a glow about the flames, both
  flickering with `flicker('campfire', ...)` (map/flicker.ts); the flames, light, embers, weather and the goat's word
  sit in `over`, above the scene's darkening (moved with the stage), so a fire shows in a dark shot. The lights warm
  whoever stands near (their tint, `warmth`) and the whole picture a little (the veil). Duchess (`anim: 'goat'`) chews
  with a bob, or ambles back and forth (`wander`), walks when moved, hops and says "Mehh." when startled; birds peck
  until startled, then flap up and away; banners flutter (the flag's six frames). Rain, snow, ash (a few embers still
  glowing) and fireflies are rects in two Graphics, their places from their number and the time. Held things
  (`drawHeld`, `handOf`): at the hand as the pose puts it (a strike swings it over and down in time with the blow's
  frames, a cheer raises it, kneel and reach hold it low and forward, down lays it on the ground), mirrored with the
  facing; a torch or lantern burns at its tip and lights like a small fire. The marshmallow on a stick is drawn in
  code (no pack has one): white, then golden, then brown while its tip is in a fire's flames, and then it catches
  fire (`toast`).
- **The scenes dressed**: every scene has its props (the test asks). The warren burns with real fire, smoke and embers
  while the wit walks up with a marshmallow on a stick on "I brought marshmallows" and holds it into the flames on "It
  is a very good fire" (it catches); Duchess hops at the back on "plenty of dark". The founding has a handcart pulled
  in with Duchess trailing it, the wit's map and then a list for "very few", bedrolls, and the first fire lit as night
  falls in the last shot (with fireflies; its camera now starts on the fire and drifts to the sky). The dead king's
  tower has rain, lightning, black banners, bones, a skull and his empty chest. The dragon sets the hay alight on
  entering, with ash falling, scorched ground and the birds put up; Duchess hops at "We are not feeding Duchess to a
  dragon". Sight gags: the worrier's list in hand wherever the list is mentioned; the hero's speech with the birds
  flying off and Duchess wandering out of shot while it goes on into the night; a ladle held menacingly (and swung);
  cheese held up as evidence; Duchess beside the fallen Calamity for "And one goat."; tankards raised at the feasts;
  "Buckets. Everybody." with everyone holding one; the cult's lantern and snacks; the pamphlet; the burning cart that
  burns out. Duchess stands, chews or wanders in every scene that names her and a dozen that don't. No line changed;
  no scene lengthened.
- **The sprites** (`src/renderer/art/scene/`, 37 files, about 160 KB; cut by `tools/compose-scene-props.cjs`, run by
  hand): the Medieval Field Work set's barrel, carts, sign, table, rock, hay and bucket; the Fields Tileset's camp
  (firepit, cold ring, tents, crate, stump, log, lantern post, signpost, a dirt patch for the scorch); DawnLike's grave,
  skull, a pot (darkened to a cauldron), the sword, axe, torch, lantern, scrolls, ladle and foods; whtdragon's white
  goat. Shared from the map: the warren, skeleton, skulls, chest, gold, birds, the fields flag, the flames and smoke.
  Code-drawn: the marshmallow and its stick, the weather, the embers, shadows (no pack has them as sprites).
- **Cost** (the phone): a sprite or two a prop and two Graphics of rects redrawn a frame; every texture loaded once.
  Timed with `window.__scenePerf()` in the strip (the cutscene's render work and the frame gap over the last 200
  frames, `CutsceneScene.perf`). Measured in headless Chromium (software GL, 393x852): the burning-warren scene's
  render work went from 0.24 ms a frame to 0.55 ms over 200 frames (a new town); on the fixture town (fewer frames
  sampled, the page far slower in software GL) 0.83 to 1.50 ms, and the dragon's 1.56 to 1.48 ms. The frame gap sat
  at the ticker's 100 ms cap in both builds there, so the GPU's share couldn't be compared; worth a look on the phone.
- **Debug**: `window.__cutscene(id, vars)` queues a scene (as before); watch it with
  `__game.command({ type: 'scene', op: 'watch', key: __game.snapshot().scene.key })`; in the strip,
  `window.__sceneSeek(shot, line, seconds)` jumps to a moment of the scene playing (`CutsceneScene.seek`). (`window.__scene` was already
  the fight screen's scenery override, so no new hook by that name.)
- Tests: `test/sceneProps.test.ts` (every kind and held thing a script names is in the tables, every sprite is on
  disk and in `propArt.ts`, every prop acted on is placed; the warren's marshmallow on its line; props kept to their
  place, lighting, dousing, burning out, knocking over, startling, holding); `test/cutscenes.test.ts` takes prop ids
  for the camera.
