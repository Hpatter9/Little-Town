## A simpler build menu

Changes the build menu in `docs/notes/build-menu.md` (HISTORY.md "The build menu"). The owner: "too convoluted". No sim rule changed, nothing that can be built changed.

- **Before** (settlers, 393x852): the Buildings tab opened on a "Being built" section ("nothing yet", "0 of 3 building slots in use",
  "Nothing ordered or under way"), then "Build: your orders" with a hint and two Hide toggles ("Built", "Can't build yet"), a
  "The town recommends" card (name, picture, why, what it does, Build), a "Build: Walls and streets" section of two long text cards,
  then seven "Build: <kind>" sections of cards (cost chips, purpose, why, "in the stores now / the town gathers it", count in town,
  Build, and a "More" tap), and finally the "In town" list. Before building one house a player had to read about seven headings, decide
  on two toggles, and pick between a recommendation, a wall card and about forty cards.
- **After:** one `Build` heading. At the top a small strip per order or site under way (picture, name, status, progress bar, Cancel; nothing
  at all when nothing is). Then one "Recommended" card (building, one line why, cost or "needs 24 wood", big Build button). Then four tabs,
  Homes and food / Work / Defence / Town (`BUILD_TABS`, `tabOf` in `panel/buildKinds.ts`; `kindOf` still sorts first), each a plain list of
  compact rows: icon, name, cost line, Build. A row whose materials aren't all in the stores shows "needs 12 wood, 5 stone" in place of the
  cost and dims its name (Build still works: the town gathers it, as before). Buildings still waiting on research are no longer listed.
  The wall and the streets are rows in Defence and Town. Tapping a row opens its details: what it does, why, then the old facts (size, beds,
  job, grows into...). Nothing of that is in the list.
- **Gone from the menu:** the slot count, the Hide toggles (`hide.ts` is no longer used here), the long explanations, the duplicate
  headings, the "in the stores" lines. "In town" moved to the Overview tab (`GROUPS` in `panel/subtabs.ts`: the Buildings tab is `/^Build/`).
  Upgrades and demolition were not in this menu; they stay on a building's own card.
- Redraw key: `buildKey` holds the open category (`tab`) instead of the hide toggles; the stock still keys the Buildings tab through
  `costChipsKey`. CSS: `.brow*`, `.queue-row.strip`, `.card.recommend` in `panel/panel.html`.
