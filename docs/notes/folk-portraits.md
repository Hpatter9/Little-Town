## Townsfolk portraits in the menus show the iso looks

The menus, cards and feed now draw a person's face or figure from the same PixelLab iso look the map gives them (see
HISTORY.md "Isometric townsfolk" and "The peoples' own casts"), not the Himeko paper doll.

- `iso/folkWho.ts` (pure): `folkWho(st)` is the ONE rule for a person's look path and colour variant (`pickLook` with
  `dressOf` their body armour, `variantOf` their id). `iso/folkSprite.ts` (the map) and the menus both call it, so a card
  and the map always agree. A people without its own cast gets the settlers' looks, as before. Test: `test/folkPortrait.test.ts`.
- `art/folkPortrait.ts` (DOM, no Pixi): `folkFigure(path, variant)` loads the look's `index.json` and `rotations.png` by URL
  (async, cached per look and variant), takes the south-facing frame, recolours it (`folkTint`), and crops to the figure.
  `paintPortrait(canvas, who, {mode:'face'|'full', grey?, stand?})` paints it, or the `stand` (the old paper doll) while it
  loads, and paints over in place when it arrives; canvas sizes never change, so layouts don't jump. `face` is the top half
  of the figure; `full` is the whole figure, feet at the bottom, scaled in quarter steps with no smoothing.
  `folkPortrait`, `drawFigureAt`, `folkKnow`/`folkWhoById` (id-only views, like `hkKnow`).
- Switched: the People page (`panel/townsfolkPanel.ts` `face`/`figure`, so the person card, founder card, family, muster, guild
  and info-card portraits too), the map tap card and event/feed pictures (`main.ts` `personPicture`), the dead in the annals
  and memorials (`art/fallenFace.ts`, greyed), the shop and tavern scenes (`panel/shopPanel.ts`), the new-game founder
  tiles (`panel/newGamePanel.ts`), the raid recap chips (`battle/raidRecap.ts`).
- `Obituary.origin?` (sim/obituary.ts, optional, older saves read as settlers) keeps the dead's people so their portrait uses
  the right cast.
- Left on the paper doll (animated, in-scene, Pixi or composed scenes): the fight screens, the mine, the Deep, interiors,
  cutscenes, event-scene actors (`scenePlayer`, `eventScenePlay`), the expedition strip (`town/expeditionPane.ts`), the
  statues. Switching those needs animation frames from the iso sheets, not a still.
