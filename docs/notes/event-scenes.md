## Event cards that show the event

The owner: "The event cards also need more. The scene depicted is usually just someone walking with a background. The
images need to relate to what's on the card. A council voting should be a town hall looking setup with the council
talking to the townsfolk. And actually have the townsfolk involved. Do this for all of 'em." This changes **"Events
told in full"** and the story card of **"UI 3"** (the scene per event family, `EVENT_SCRIPTS` and `eventFamily()` in
`panel/sceneScripts.ts`), and adds to the scene format of **"The New Town screen"** (its origin scenes are untouched).

**Each event names its scene.** `data/eventSceneIds.ts` lists 47 scenes (`EVENT_SCENE_IDS`: council, trial, revolt,
quarrel, home, leaving, children, workshop, study, machine, market, gate, refugees, envoy, caravan, shady, road,
raid_warning, battle, beast, dragon, fire, storm, quake, winter, drought, famine, plague, calamity, harvest, farm, well,
mine, sea, wilds, wedding, birth, deathbed, funeral, feast, tavern, festival, miracle, cult, ghost, omen, magic), and
every one of the 562 choice events carries `scene` on its definition (`EventDef.scene`, optional, in events.ts,
moreEvents1..4, fatefulEvents, calamityEvents, festivalEvents, alignEvents), chosen by hand per event. It's data for the
renderer only: the simulation never reads it. The questions that aren't choice events pick theirs by kind in
`sceneFor` (`panel/eventScenes.ts`): a council's vote the hall, a trial the judge's seat, a revolt the square, an envoy
the herald, refugees the gate, a village parting the road out (beset: the palisade), a dragon, an enemy's warning, a
watched fight, a party's road (the year's chronicle: the chronicler's desk). `eventFamily()` stays only as the
fallback for whatever names none (a saga's or a people's own question); it logs nothing. The snapshot's `PromptView`
gains `eventId` (the choice event's id, from `s.event`) and `about` (a politics question's vote/trial/revolt, a
village's parting/beset) for this. `s.event` names only the newest event, so a question put without its id is known by
its words (`eventByWords`: the event's title and telling as patterns, names filled with anything, the fateful mark
allowed): two events open at once both get their own scene.

**The scenes** (`EVENT_SCENES` in `panel/eventScenes.ts`) are staged, not walked past: the council stands behind its
long table in the hall with one of them on their feet putting it to the townsfolk crowded before them, backs to us; a
trial has the founder at the seat, the accused held before them by a guard, a witness speaking and the town crowding in;
the gate has the gate, a guard and a stranger come up the road; a plague, sickbeds and a healer between them; a fire, a
house with flames on its roof and a bucket line from the trough; a wedding, the pair before the priest and the guests
behind; a caravan, a laden wagon, casks and the merchant; a raid warning, the palisade, a lookout on the gate pointing
and smoke on the horizon; a harvest, the crop in rows, a haystack and the cart; a funeral, a coffin, mourners kneeling,
rain; a feast, the hall's long table laid and two dancing; an envoy, a herald under banners before the founder and the
elders; a birth, the bed, a cot and the midwife; a famine, empty bowls and thin folk at a bare table. And so on for all
47.

**The cast** (`panel/eventCast.ts`, pure): fixed places, `SLOT`: the one the event is about (`lead`; the founder if
nobody), the founder, three more grown-ups (`elder`, `elder2`, `elder3`: the council, the judge's men, the kin), the
outsiders it brings (`stranger` x3, `knight`, `priest`, `merchant`) and then the crowd, up to `CROWD_MAX` (10) real
townsfolk, grown-ups first, nobody twice. `eventCast(seed, people, lead, founder)` picks them by a seeded shuffle on the
prompt's id (`Rng(hashSeed('scene:<id>'))`), so the same card always shows the same faces. `panel/eventScenePlay.ts`
dresses them: townsfolk as their own paper dolls (`hkWhoOf`), outsiders from a look drawn on the event's id
(`randomLook`, `hkWhoOfLook`: travellers in road clothes, the knight in a knight's kit, the priest in a white mage's
robes). `mobile/eventSheet.ts` calls `playEventScene` in one small block.

**The format** (`panel/sceneScripts.ts`, played by `panel/scenePlayer.ts`; the New Town scenes can use all of it):
- `back: 'set:hall' | 'set:cottage'`: a set laid from the pack's tiles in place of a painted backdrop.
- `props`: `{ id, x, y, k, flip, back, z }`, things stood with their foot at (x, y), drawn back to front with the actors
  (`back` hangs one on the wall; `z` sorts bread on a table with the table). Strips play their frames (the fire).
- `crowd`: `{ n, x, y, h, face, from, anim }`, townsfolk in up to two staggered rows facing one way (`face` can now be
  `f` or `b`: towards us or away). They murmur: now and then one shifts a pixel or turns to a neighbour.
- `speaker`: the actor who talks while the card is read (a hand out now and then, a small bob).
- New poses: `talk`, `kneel` (the pack's kneel), `cheer` (the arm raised). `shake`: the ground jolting (a quake).
- `sceneCue(canvas, 'vote')`: when an answer is taken in a council, trial or revolt the crowd raises its hands, one
  after another (staying raised with reduced motion). `sceneStats()`: the last scene's draw times.

**The props** (`panel/eventProps.ts`, `EVENT_PROPS`, from `art/eventprops/sizes.json`; the pictures in
`src/renderer/art/eventprops/`, copied beside the page by `build.mjs` and `tools/build-web.mjs`), cut by
`tools/compose-event-props.cjs` (run by hand) already at their size on the 320x180 stage: the Medieval Field Work
pack's banners, casks, tub, bucket, handcart, wagon, bench, fence, hay, crops, plough, notice board, sign, trestle tables,
crate, tree, rock, market stall, handmill, door, well, window and tools; a house front and a gate put together from its
wall, roof, door, window and column pieces; DawnLike's bed, sickbed, cot, coffin, candles, tombstone, cross, tables,
chair, throne, shelf, bowl, bread, apple, lantern and five beasts (cow, goat, sheep, horse, boar); and the game's own
flame as the fire. The sets: the hall (plaster between brick columns, tall stone windows, two banners, an earthen floor)
and the cottage (a plastered room with a wainscot, wooden windows, a door).

**On its side** (`panel/cardsStyles.ts`, the scene area only): the picture's column is near square, so the scene is
fitted whole (`object-fit: contain`) instead of cropped to its middle, where the speaker at the edge was lost.

**Cost**: drawn at 24 frames a second on the 320x180 canvas. Measured with performance.now() over 200 drawn frames in
headless Chromium (393x852, DPR 2): the old family scenes 0.17 to 0.20 ms a frame (council 0.18, p95 0.4); the new
0.22 to 0.26 ms (council 0.23, p95 0.5; the busiest, the festival, 0.26). The dolls' cells are cached by hkFolk.ts, so a
crowd of ten costs little more than one.

Tests: `test/eventScenes.test.ts` (every event names a scene that exists and resolves to it; every kind of question
finds one; every scene's props are in the table and every prop's and set's picture is present; the backdrops exist; the
scenes the owner named have their parts; the crowd picker is the same every time, never repeats anyone and puts no
child at the table). The sim hashes (`tools/sim-hash.mjs`) are unchanged.
