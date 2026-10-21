## The Surface / Underground switch

One button in the phone's top bar (beside the ☰, so it is always in the same place) flips between the town and the
underground it has. It shows ⛏ on the surface and ☀ below. Tapping ⛏ goes down: straight in when there is one way
(the Deep if there's a shaft, the Underdark once reached, each dug-out mine), or a small chooser when there are
several, with the last level picked first and marked "(last)". With none, the button is greyed and a tap says "Dig a
mine shaft to reach the Deep". Tapping ☀ closes whatever is open (`watchMine`/`watchDeep`/`watchUnder` off).

Files: `src/shared/sim/underground.ts` (pure: `undergroundWays`, `undergroundNow`, `surfaceCommands`, `NO_WAY_DOWN`),
`src/renderer/mobile/undergroundSwitch.ts` (the button and chooser; the last pick is kept in
`localStorage` `littletown.undergroundLast`), styles `#ug-btn`/`#ug-chooser` in `mobile/index.html`. Test:
`test/underground.test.ts`. No new commands and no sim change; the views, taps, pinch and tap card are untouched.
The surface camera isn't moved while a view covers it, so going up returns to where it was. The dwarves' hold is
on the map itself (its hallways lead into the Underdark), so it needs no entry of its own. There is no iso switch on
this branch to check against.
