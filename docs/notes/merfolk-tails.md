## Merfolk tails, the right way round (renderer only; changes "The merfolk's shore" and "Watching a party's fights")

- **Map bug:** `art/merTail.ts` draws the tail pointing right. `map/mapPeople.ts` flipped it when the swimmer faced
  *left*, so the tail pointed the way they were going, ahead of the body. It now points right when they face left and
  is flipped when they face right: it trails behind in both directions.
- **Side-view fight:** `FightScene.update(..., sea, mers)` (fight/fightView.ts) sets `wet` when the trip's look is an
  underwater or ocean backdrop and the party is not aboard a boat or aloft; `mers` is the set of person ids that are
  merfolk (`PersonView.mer`, built in main.ts from the snapshot, so no snapshot or sim change). In `pose()`, a merfolk
  party member in a wet fight is cut at the waist (`HK_WAIST` .67 for the Himeko doll, `WAIST` for the old LPC figure)
  and given a tail (`finTail`): the tail is a child of the figure's sprite, so the lunge, recoil, squash, hurt and
  fall in `moveSprite` carry it along. The tail trails away from the foes (right for the party). A downed merfolk
  uses the standing frame and the motion's topple, as a lying frame can't be cut at the waist. Dry fights keep legs.
- Not changed: the march between fights, and raid battles (tactics board), still draw legs. Preview: `window.__look`
  = `underwater_1` forces a wet fight.
