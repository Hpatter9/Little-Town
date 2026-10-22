## The inns' and shops' windows, drawn from the hand-made rooms

The owner said yes to "shops use the hand made interiors". The picture in a venue's own window (the Fireside Inn and
the Tavern, the Trading Post and the General Store, the specialty shops: `panel/shopPanel.ts`) is now the hand-made
room: **the Common Room** for the inns (`venue: 'tavern'`), **the Shop** for every shop (`venue: 'shop'`), both from
`maps/rooms.ldtk` (see docs/notes/hand-made-maps.md, "The buildings' rooms, furnished by hand"). This changes HISTORY
"Five shops" / "A shop like a real shop" / "Inside the venues" (the picture only); no rule changes, nothing saved.

**What changed**
- `interior/interiorView.ts`: the room painter was lifted out of `InteriorScene.draw` into `paintRoom(g, RoomPaint)`
  (floor cell by cell, the back wall, furnace or brazier, the furniture, the people among it in order of their feet,
  the firelight, the night). `InteriorScene` calls it as before (`side: 4`); the venue windows call it too (`side: WALL`,
  scale 1, the canvas scaled by CSS as it always was). Also exported: `handLayout`, `T`, `WALL_H`, `Layout`, `Draw`.
- `interior/handRooms.ts`: `venueRoom(venue)` (the room for an inn or a shop) and `venueSpots(room)` (pure, in cells):
  the keeper at the room's first `station` spot, two `counter` places in front of the counter (customers at the
  counter), `browse` places (the room's seats and hearth, then the open floor in front of the counter, none on
  furniture), and the `door` below the room's middle.
- `panel/shopPanel.ts` `draw`: with a room, the old painted walls, floor, counter, pieces and rugs are skipped; the keeper
  stands at the keeper spot, customers and the evening's townsfolk walk in at the door, to the counter (a shop's
  customer asking, the keeper answering in the same speech bubbles), about the floor and out again, and `paintRoom`
  draws everything in depth order. The guest wing (rooms for rent: the hallway, each room with its bed and its sleeper)
  and the shop's stock on show (`display()`) are kept; the wing's walls take the room's stone and planks. The canvas is
  sized from the room (`hand.w` by `hand.h`) plus the wing, so it doesn't change between ticks. `BACK` is `WALL_H` (44) in
  a room (`BACK_` 40 stays for the old picture, which is still drawn when the map is missing).
- `panel/panel.html`: sideways, `.shop-floor` `max-height` is `max(120px, 100vh - 180px)` (was `72vh`): the rooms are
  taller than the old picture and the last row was cut off under the menu bar.
- `tools/make-save.ts`: `VENUES=1` builds a Fireside Inn and a Trading Post at the start (with Barter and Hospitality
  learned, or the town pulls the inn down). Use a short run, `VENUES=1 ORIGIN=settlers RELIEF=0 node tools/make-save.mjs save.txt 3`.

**What the window no longer shows in the picture** (all still in the text below it): the keeper's décor (wall paint,
tapestry, rugs, lamps: `DECOR_STYLES`, `decorWall`, `decorFloor`) and the bought pieces (shelves, tables, hearths, the
tavern's tables, `v.pieces`): the room's own furniture stands in for them. The piece list, the appeal they add, their
levels and the buy buttons are in the window as before. A shop's counter is the room's long table. If the owner wants
the bought pieces drawn into the room, that's the next step (a piece to a cell).

**"Look inside" is unchanged.** `hasInside` still says no for the trading post (`test/interiors.test.ts` keeps it): the
window itself shows the room now, so a second way in isn't needed, and loosening the test isn't.

**Tests** (`test/venueRooms.test.ts`): the inns get the Common Room and the shops the Shop; the keeper's place is the
room's first station, the counter places are on the floor past the counter, every browse place is on the floor and off
the furniture (but for seats), the door is below the room's middle.

**Screenshots** (`docs/notes/venue-hand-rooms/`): `tavern-tall.png` and `shop-tall.png` at 393x852, `tavern-wide.png`
and `shop-wide.png` at 852x393 (the inn shut for want of a keeper in the save, the shop with its keeper and a customer).
