## The clock bar on the phone: People, Beds and coins taken out

The strip's clock bar (the gold bar at the top of the town on the phone) ran off the right edge on an upright
phone, so the People, Beds and coins figures at its end sat off-screen and the bar scrolled sideways. The owner's
ask: take that information out of the bar. The bar now holds the clock, Pause, speed, music, the raid and
bleeding and hunger badges, and Food. Nothing else changed.

- **The file:** `src/renderer/hud.ts`. The `stock` span (the figures' text was `People n · Beds n · ● n coins`) is
  gone from the clock bar and from its `append`, and so is the text code that filled it.
- **The CSS:** `src/renderer/index.html`, the `#clock .stock` rule, removed.
- **The tip:** `src/renderer/mobile/tips.ts`, the `beds` tip ("People and beds") pointed at the figures at the top.
  It now points to the Town menu's Overview tab (`panel: 'build'`, `tab: 'Overview'`), where the People tile shows
  people against beds.
- **Unchanged:** the Food figure stays in the bar. The `food` tip still says "The Food figure at the top", which is
  still true. The `snap.housing`, `snap.coins` and `snap.shop` fields are still read by the menus, so the snapshot
  keeps them.
