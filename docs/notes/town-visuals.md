## Seeing through, lit windows and flames that flicker (isometric view)

The owner's asks: "Trees or objects should go opaque when someone is behind them" (meaning see-through: what stands in
front of a person fades so they show), and "Make sure torches and lights flicker properly. And windows at night glow like
there are lights inside." Builds on "Night, doors, land clearing and weather in the isometric view", "Lights on their
torches (isometric view)", "Real light" and "The town lights itself" (HISTORY.md). Pictures are in
`docs/notes/town-visuals/`.

**See-through** (`src/renderer/iso/seeThrough.ts`, pure; drawn by `IsoView.seeThrough(dt)` in `iso/isoView.ts`, called in
`main.ts` each frame after `placeLoose`)

- What counts as a person: the body sprites their drawers mark with `markWalker` (a `WeakSet`): townsfolk and the founder
  (`map/mapPeople.ts`), raiders and roaming bands and penned beasts (`mapRaiders.ts`), the great creature (`mapCreature.ts`,
  its whole root), wildlife (`mapWildlife.ts`), pets (`mapPets.ts`) and herds (`mapHerds.ts`).
- What can hide them: every building's picture, its props, the land's trees, bushes and rocks (`scenery`), and the castle's
  or hold's pieces (`IsoCastleView.pieces()`). Their boxes (`boxOf`, from texture, scale and anchor) are trimmed to
  `coverBox` (the empty corners and the ground at the foot cut off) and put in a `BoxGrid` (`GRID` 96 px squares), worked
  out again only when something changes (`coversDirty`: buildings synced, the land's scenery repainted).
- Each frame, for each marked person in `things`: the grid gives the pictures near them; one is faded when the person is
  drawn before it (`zIndex` smaller) and their `bodyBox` overlaps its cover box (`behind`). A fade eases in and out over
  `FADE_SECONDS` (0.2 s, `fadeStep`, smoothstep in `fadeAlpha`) to `SEE_ALPHA` (0.4); the building picked (its tap card
  open, `setPicked`, from `inspected`/`selected` in `main.ts`) only to `PICKED_ALPHA` (0.7). A picture's own alpha (a
  blueprint's 0.45) is kept in `baseAlpha` and the fade multiplies it.
- Cost: `IsoView.seeCost` (ms a frame, smoothed). On the late-town fixture (37 people, 281 buildings, a forest in view) it
  measured about 0.3 to 2 ms in the cloud's headless Chromium with software rendering (no GPU); the grid keeps it to the
  pictures near someone.

**Flicker** (`src/renderer/map/flicker.ts`)

- `flicker(kind, t, phase, gentle)` is now smooth value noise (`noise1`, eased between random values) on three beats
  (about 1.4, 3.9 and 8.5 a second) instead of fixed sine waves: irregular, never jumping between frames (no strobing), each
  light on its own `phaseOf`. New kinds: `brazier`, `forge`, `candle`.
- `flickerSize`: a flame's light grows a little as it flares and shrinks as it sinks (at most a fifth of its waver).
- `gentle` ("Reduce motion", `ui/motion.ts` `reducedMotion`): a third of the waver (`GENTLE_AMOUNT`), half the pace
  (`GENTLE_PACE`). A slow phone (`calm`) still holds every flame steady.
- Used by the light map's flame pools (`map/lightMap.ts`: brightness and now their reach, scaled round the flame's own
  texel `cx, cy`), the carried torches and lanterns, the iso street lamps' glows (they did not flicker at all before:
  `IsoView.lampGlows`, the age's kind from `LIGHT_KIND`), the flames of a burning building, and the lights below.

**Lit windows** (`src/renderer/iso/windowLights.ts`, pure)

- `RAW`: hand-placed lights on each kit piece with windows, for the five peoples one can play and the shared pieces
  (`buildings/`): settlers, dwarves, knights, liches and Blood Court cottages, halls, taverns, chapels, workshops, granaries,
  towers, gatehouses, the barracks, mausoleum, crypt and mine; `mission_control`, `drone_hub`, `harbour`. Each is
  `[x, y, w, h, kind]` in the piece's own px (its middle and size). Kinds (`LightKind`): `window` (lit while someone is
  inside), `flame` (a brazier, a lantern on the wall: all night), `forge` (a forge's mouth: all night, orange for anyone),
  `electric` (lit while someone is inside, steady). Placed by eye on enlarged, gridded pieces and checked on darkened
  renders (`docs/notes/town-visuals/windows-*.png`).
- `lightTint`: the necropolis glows ghost-green, the Blood Court red, the rest warm; `flickerKind`: a window wavers as a
  candle, a flame as a brazier. `isLit(kind, inside, venue, hour)`: a tavern or a shop (`venue`) keeps its windows lit of an
  evening until `VENUE_OPEN_UNTIL` (23). `lightAt` turns a piece's px into the screen's (anchor, scale, mirroring).
- `IsoView.setLights` puts on each finished building a lit pane (`paneTexture`, square or round for a rose window) and a soft
  glow over it in the `glow` layer (over the night's dark); a hearth (`storytellers_circle`) gets its fire's flame; a lamp
  or brazier prop beside a building (`LIGHT_PROP`) a flame at its head. A kit not placed by hand keeps the old guess
  (`windowSpots`), now lit only while someone is in. Lights come on and go out over about two thirds of a second
  (`LIGHT_RATE`) and flicker in `animate`. A window behind a building, a prop or a tree drawn in front of it is hidden
  (`PicLight.hidden`, worked out with the covers).
- Who is inside: `litInside(s)` (`sim/interiors.ts`): the buildings someone is in after dark by `insideOf` (at a
  station, a desk, the table, at home of an evening), or asleep in before `BEDTIME_LIGHT_UNTIL` (23); none by day
  (daylight 0.6 and over). It is the snapshot's new optional `litInside?: number[]`; `IsoView.setInside(ids, hour)` each
  snapshot. Looking only: nothing in the town changes, and no randomness is drawn.

**Tests:** `test/townVisuals.test.ts` (smooth flicker with no frame-to-frame jump, out of phase, gentler with Reduce
motion, size with brightness; `behind`, the fade's timing and floors, `BoxGrid`; every placed light lies on its piece and
every placed piece is in its kit; `lightAt` mirrored; `isLit`; `litInside` by day, of an evening, at bedtime, out of
doors). `test/flicker.test.ts` passes unchanged.

**Left:** a person walking in front of a lit window doesn't hide its glow (the glow is drawn over everything, as the
lamps' are); only buildings, props and trees drawn in front hide a window. The other kits (druids, fae, machines, Moon
Pack, orcs, merfolk, nomads) keep the old guessed window spots until their pieces are placed by hand.
