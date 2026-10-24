## Only trees and rocks fade (branch claude/town-roads)

The owner: "Don't turn building opaque when townsfolk walk behind em. Only trees and rocks." Changes "Seeing through, lit windows and flames that flicker"
in docs/notes/town-visuals.md (iso/seeThrough.ts, iso/isoView.ts `seeThrough`).

- `IsoView.rebuildCovers` (iso/isoView.ts) marks each cover with `fades`: the land's scenery (`scenery`: trees, rocks,
  bushes, the starting valley's landmarks) fades for someone behind it as before (`SEE_ALPHA` 0.4, `FADE_SECONDS`);
  buildings, their props and the castle's pieces no longer do. They stay covers for the lights behind them (a lit
  window behind a building is still hidden).
- `seeThrough` only fades covers with `fades`. The pure rules in iso/seeThrough.ts are unchanged
  (test/townVisuals.test.ts).
