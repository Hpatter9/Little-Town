## The isometric view made the default

The owner's ask: iso is the default view. `iso/isoSetting.ts`: `isoViewOn()` is on unless `littletown.iso` is `'0'`;
a one-time `littletown.isoDefault` flag moves every phone over once (one that had chosen the top-down view too), after
which the player's own choice in Settings stands. The ☰ menu's switch reads "Isometric view" (no longer "in
progress"). The top-down view stays in the code, behind the switch, until the owner says to remove it.
