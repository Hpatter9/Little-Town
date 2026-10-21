## Land clearing by hand

The player can mark wild land for clearing from the phone's map. The townsfolk still gather on their own; marked cells are taken first (`bestGatherTile`, unchanged).

- **Command:** `markClear { cells, on }` (`sim/commands.ts`, applied in `sim/sim.ts`): marks (`on`) or unmarks a list of cells in one go, capped at `MARK_CLEAR_CAP` (150; `parseCommand` refuses a longer list). Only cells with a gather pool can be marked. `toggleGather` is kept for old callers.
- **Clear button** (`renderer/main.ts`, `#clear-land`, above the home button): while on, a banner says so, a drag sweeps cells along the finger's path (`map.worldOf` then `map.cellAt`), and one `markClear` is sent when the finger lifts. A sweep that starts on a marked cell lifts marks; one that starts elsewhere adds them. A second finger (pinch) cancels the sweep. Off again, taps work as before. First use shows a one-line toast (`littletown.clearTip`).
- **Marks on the map** (`map/mapView.ts` `drawMarks`): the pale outline plus a faint X.
- **Regrowth** (`sim/regrow.ts`): a marked cell is not regrown on its due day (it tries again tomorrow). A mark goes by itself when the cell is bare (`setGround` and `clearCell` already did this).
- **Not done:** the isometric town view is not on main yet (only the battle board), so only the top-down map has the button. When it lands, it should send the same `markClear` and draw the same marks.
- Tests: `test/markClear.test.ts`.
