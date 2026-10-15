## The carts face the way they go

Renderer fix only; the sim is unchanged. The owner saw a horse-drawn cart with the cart out in front of the horse.

The Village pack's `cart.png` (48x26) has its shafts on its left and its wheel on the right, so it is drawn facing
left. The horse sheet's left row faces left and its right row faces right (`creatureFrame`), so the horse needed no
change. The two places that flip the cart had the sign backwards: it was flipped the wrong way for the direction of
travel, so the shafts pointed away from the horse or the lead.

- `src/renderer/map/roadTraffic.ts` (`RoadTraffic.render`): the carter's horse sits ahead of the cart (`x + dir * 14`)
  and the cart trails (`x - dir * 12`). The cart is now flipped with `scale.set(-dir, 1)` so its shafts point at the
  horse.
- `src/renderer/map/mapWagons.ts` (`MapWagons.update`): a caravan's wagon trails the lead merchant (`bands.ts`
  `rollWagon`). It is now flipped with `w.dir > 0 ? -SCALE : SCALE`, so its shafts point at the lead.

The couriers (`mapCourier.ts`) and the people's horses (`mapPeople.ts`) draw no cart, so they were not changed.
