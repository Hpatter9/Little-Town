## Isometric townsfolk (new, not yet wired in)

The townsfolk side of the isometric view, as self-contained files in `src/renderer/iso/` (nothing existing is
changed). Tests: `test/isoFolk.test.ts`.

- `folkRules.ts` (pure): `facingFromVector(dx, dy)` / `facingToward(...)` give one of the 8 screen facings
  (`FOLK_DIRS`, the art's order) from a map step: map east is screen south-east, map south is screen south-west.
  `wantedAnim(state, speed, weaponFamily)` picks the animation from the snapshot (death if downed, hurt for
  `HURT_TICKS` after a blow, attack/cast by weapon family while fighting, chop/hammer for work, run from
  `RUN_SPEED` or while rallied, walk, idle); `play(wanted, has)` walks a fallback chain for a look that lacks it (no
  `run`: walk at `rate` 1.5; no `chop`: hammer; nothing: `stand`, the rotation frame). `armedSuffix` names the armed
  look (`axe`, `hammer`, `sword`, `bow`, `greatsword`, `staff`). `pickLook` picks people, sex and outfit, then a stable
  pick by `idHash(id)` from the `FOLK_LOOKS` table (add each look there as its art arrives; a people with none uses
  settlers). `lookPath` builds `settlers/woman_leather+axe`. `frameAt(count, fps, seconds, loop)` gives the frame.
- `folkLoader.ts`: `loadFolkSet(path, variant)` fetches `<FOLK_ROOT.url>/<path>/index.json` and the frames by URL
  through `art/loadImage.ts`, on first ask only, cached per (look, variant); null if the look isn't drawn.
  `FOLK_ROOT.url` is `iso/folk`, relative to the page: **the web build must copy `src/renderer/art/iso/folk` there**
  (as it does `himeko`), and the service worker should skip or lazily cache it.
- `folkSprite.ts`: `class FolkSprite extends Container`, feet-anchored.
- `folkTint.ts`: colour variety by baking: `VARIANTS` (8) recolours per look, made once on a canvas (no filter at run
  time, so dozens of people cost plain sprites). `variantOf(id)` is the person's stable variant; `recolour(rgba, v)`
  turns the hue of non-skin pixels, lightens or darkens skin a little, and leaves outlines, near-greys and clear
  pixels alone. It can't separate hair from clothes (hue ranges only, no masks) and doesn't match the sim's exact skin
  or hair colour; it gives variety, not fidelity.

### How the iso map calls it

```ts
const folk = new FolkSprite();            // one per PersonView.id, added to the people layer
layer.addChild(folk);
// every frame, for each visible person v (a PersonView), screen spot from the iso projection of (v.x, v.y):
folk.position.set(screenX, screenY);      // the feet
folk.zIndex = screenY;                    // depth order
folk.update(v, v.x, v.y, nowSeconds, dtSeconds /*, targetMapSpot? */);
```

Pass the **map** position (not the screen one) to `update`: facing is worked out from map movement. Pass an optional
`{x, y}` target to face it while standing (felling, fighting). Hide `v.indoors` people as the top-down map does.
`FolkSprite` needs only `id, activity, sinceHit, sinceBlow, defending, downed, hp, look, gear` (and `work`, `origin`,
`rally` if sent) from the view. Weapon families come from `ITEM_BY_ID[gear.weapon].family`. Until the armed looks
exist, the bare look stands in.
