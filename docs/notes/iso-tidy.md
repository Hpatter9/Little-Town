## Iso tidy: a play-through of the isometric view

A pass over the isometric view (now the default) at phone sizes, day and night, with towns of several peoples and the
late-town fixture (`test/fixtures/late-town.json.gz`, 37 people; its save text loads as `littletown.save` as it is). Screenshots
are in `docs/notes/iso-tidy/` (before / after pairs). Changes are visual only; the simulation is untouched. Builds on
"Lights on their torches (isometric view)" (`lights-on-torches.md`) and "Iso pictures in the menus and cards"
(`iso-menu-pictures.md`).

### Fixed

- **Street lights had no post (the owner's "glow on its post").** `IsoView.setLamps` put each lamp's post in `things`, but
  `placeLoose` treats every child of `things` that is not in `own` as a townsperson in world px and maps it again, so every
  post was thrown far off screen and only the glow was left. Posts are now added to `own` (and removed when redrawn).
  `lamps-before.png` / `lamps-after.png` (night, late town: stakes now stand under the glows).
- **Build menu chips did nothing (until something else changed).** The Build list's own chips (Homes and food / Work /
  Defence / Town) were not in `buildKey`, so a tap re-ran `render` with an unchanged key and the list stayed put. The chip
  is now in the key (`chipTab` in `panel/buildPanel.ts`).
- **Buildings drawn as cottages that have a better piece** (`iso/isoKits.ts` `roleOf`, 76 non-housing buildings fell through
  to the cottage):
  - traps and snares (`spike_trap`, `pit_trap`, `wolf_trap`, `caltrops`, ...): new role `trap`, the kit's rough ground (a
    thorn bush or rocks, else a scrap heap);
  - turrets and engines (`ballista`, `catapult`, `cannon`, `gun_turret`, `tesla_coil`, `militia_post`, ...): `watchtower`;
  - the halls of learning, healing and show (`school`, `library`, `university`, `hospital`, `theatre`, `gaol`, `prison`,
    `monster_guild`, ...): `longhouse`;
  - `storytellers_circle`: new role `hearth`, the kit's campfire, bonfire, brazier or stone circle (it was a house);
  - `kennels`, `beast_ranch` (and the knights' own `stable`): new role `pen`, the kit's pen, corral or stable.
  `build-defence-before.png` / `build-defence-after.png`, `storyteller-before.png` / `storyteller-after.png`. Tests in
  `test/isoView.test.ts`.

### Checked and fine

Settlers, knights, dwarves, orcs, lich (necropolis) and merfolk towns (a ~160-building town each, built by hand into a
save) and the late town, upright (393x852) and sideways (852x393), zoomed 0.3 to 2.2, day and night (windows lit, lamps
and fires lit): building order against people, props, streets, walls, the minimap's slanted frame, taps on a building and a
person, and the build menu's pictures for knights, dwarves and merfolk.

### Left for the coordinator (too big or not mine)

- Buildings still drawn as a small cottage: open grounds (`village_green`, `quoits_pitch`, `sparring_yard`, `drill_yard`,
  `archery_range`, `pleasure_garden`, `bandstand`), the sea works (`boatyard`, `harbour`, `fishing_jetty`), `statue`,
  `victory_monument`, `ward_stone`, `portal_arch`, the late sci-fi buildings (`ai_core`, `clone_vat`, `cryo_pod`,
  `drone_hub`, `shield_generator`, `launch_site`, `mission_control`). They need new kit art (a statue piece, a green, a jetty).
- A ring wall round a diagonal reads as a tall stack of wall pieces (cells joined corner to corner stand one above the next
  on the screen). It is how the wall's staircase draws; a shape or art change (lower pieces for lone diagonals) is a bigger job.
- The minimap's hide button is 20 px (a small tap target); the ☰ menu's switch is the other way to hide it.
- Previews: the sim waits for the player at a raid, so fast-forwarding with `__game.sim.step(n)` stops at the first raid;
  to look at night, set the save's `state.tick` to the hour wanted (hour = (tick / 600 + 7) mod 24) instead.
