# The great creature's own art (to come)

The PixelLab sheets for the town's great creature (sim/creature.ts) go here, one folder a kind: `ape/`, `wolf/`,
`bear/`, `bull/`, `golem/`, laid out like `../folk/` (a sheet per pose, the eight facings). Until they come, each kind
is drawn with a stand-in from the creature sheets (`CREATURE_DEFS[kind].look` in `src/shared/data/creature.ts`), scaled
by its size and tinted by its nature in `map/mapCreature.ts`. Draw the new sheets in a pale, even colour: the tint by
its nature multiplies them (warm gold when good, red-black when cruel).
