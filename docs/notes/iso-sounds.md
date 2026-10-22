## Sounds for the isometric view

Adds sound for things the iso view shows. Everything is made with the existing Web Audio synthesis (`ambience.ts`); no sound files, so nothing new in `CREDITS.md`. Heard through the existing paths, so the ♪ button, the sfx slider (`volume.ts`), the audio gate (`audioGate.ts`: nothing before a tap or while the page is hidden) and the music setting all apply. The iso camera's `map.view` (the `lightView()` box) is the "view", so what is near the middle of the screen is louder (`soundZones.ts` `nearness`, `zoomGain`).

- **Fire:** `isoSounds.ts` `burnLevel(burning, view)` (pure): each building with `fire` is heard at `BURN_FLOOR` (0.35) plus the rest as it burns, times its nearness; the loudest plus `MORE_SHARE` of the others, times the zoom, capped at 1. `main.ts` sets `ambMix.fire = max(camp, burnLevel)`, so the existing fire bed and crackle (`ambience.ts`) get louder.
- **Festivals:** a new zone kind `festival` in `soundZones.ts` (`ZONE_KINDS`, `ZONE_GAIN` 1.2): a festival (strength 1), feast or wedding (0.5) at the gathering's ring gives a crowd murmur bed, `flap` (bunting snapping) and `whoop` calls, and a `fiddle` source at 0.6 of that. `ZoneTown.gathering` gained optional `x`, `y`. A raid silences it, as the other zones.
- **Doors:** `IsoView.onDoor(x, y)` fires when a door (not a gate) starts to swing open. `doorSound` (pure): nothing if nearness < `DOOR_NEAR` (0.2) or within `DOOR_GAP` (1.4 s) of the last; else a pan. The new quiet cue `creak` (`ambience.ts`) plays.
- **Chores and work:** the workers' sounds (`workSounds`) read the snapshot and `map.view`, so smithing, sawing, felling (`map.onFelled`), harvest and tilling already sound in iso. Added: a person drawing water at a well (`activity 'draw'`) now splashes (`workCue`).
- **Fog:** nothing added.
- Test: `test/isoSounds.test.ts`.
- **Audiorective plugin:** the coordinator mentioned it, but its skills were not in this session's skill list, so it wasn't used; the sounds follow the game's existing Web Audio code.
