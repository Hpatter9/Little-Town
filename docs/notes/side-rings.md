## Side rings under the fighters

The owner's ask: a flat ring under every fighter in a raid, so good and bad are easy to tell apart. Blue is the town's own
people, red the raiders and anyone attacking the town, green a third party who isn't an enemy (allied hosts, hired,
summoned, raised or tamed help, a visiting stranger fighting beside the town). Renderer only: the sim and its hashes are
untouched; the side is read from what the snapshot already has.

- `renderer/art/sideRing.ts`: `SIDE_RING` (`town` 0x4c8dff, `foe` 0xff4a4a, `friend` 0x4cd964), `SIDE_RING_ALPHA` 0.55,
  `SIDE_RING_SQUASH` 0.46, and `SideRing`, one `Graphics` ellipse with a soft dark edge and a faint fill, redrawn only when
  its side, width, downed or active state changes. A downed fighter's ring fades to a third; the unit whose turn it is gets
  a brighter ring with a thin white outline.
- `map/mapPeople.ts`: `rings` ('off' | 'fight' | 'board', default 'fight') and `activeId`. On the map a townsperson gets a
  blue ring only while fighting (`defending`, activity 'fight', or just struck/striking), a visitor green. Drawn at `z - 0.4`
  under the sprite, above the shadow.
- `map/mapRaiders.ts`: `rings` (default 'off') and `activeId`. `ally` raiders are green, the rest red; not drawn while
  lifted (flyers aloft) or swimming. `main.ts` turns it on for the raid's raiders only, not the roaming bands or penned beasts.
- `tactics/tacticsView.ts`: both sub-renderers use 'board' (a ring 44 px wide, the tile's 2:1) and the active key
  (`act.key`, else `orders.key`) picks the brighter ring.
- `fight/fightView.ts`: each figure has a ring on its ground line in `drawFight` (party blue, foes red, `conjured` or
  look-less party members green); hidden while the party marches.

Changes the HISTORY.md sections "Tactics battles", "Tower-defence raids" and "Watching a party's fights".
