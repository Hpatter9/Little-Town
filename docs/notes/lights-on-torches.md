## Lights on their torches (isometric view)

The owner saw lights floating in town. Cause: in the isometric view (`littletown.iso`) `IsoView.setLamps` drew a flame
glow at each lit street light, but the lamp itself (`StreetLamps`, `map/streetLamps.ts`) is a top-down prop put in the
hidden top-down `things` layer, so in iso only the glow was seen, with no torch or lantern post under it. The sim's
light sources are unchanged: every one of them really is a lamp (a torch on a stake, the lantern post, a gas lamp...).

- `IsoView.setLamps(lights, era)` (`iso/isoView.ts`) now takes every street light (lit or not, `room === null`) and the
  age, stands a post for each among the things (the top-down look: `LAMP_LOOK` in `map/lampRules.ts`, a torch on a stake
  for the Stone Age and the Village pack's `v_lamp.png` post after, tinted by age), depth-sorted with the buildings, and
  adds the glow only for a lit one, 26 px up at the post's head. A post that has no picture yet falls back to the stake;
  it is redrawn when the picture arrives. An unlit lamp stands dark; when a light goes (its id leaves the list) its post
  and glow go with it.
- `main.ts` passes `next.lights.lights.filter((l) => l.room === null)` and `next.era`.
- Windows' glows (`windowSpots`) are on the building's own faces and the fires' glows are on drawn buildings; unchanged.
