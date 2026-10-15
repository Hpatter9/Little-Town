// The wider world felt from home, and the land's weather (the owner's ask), put together for main.ts: the other
// settlements past the fog and a host's torches (map/mapHorizon.ts), eyes in the dark and wisps over the graves
// (mapEyes.ts), geese passing over (mapGeese.ts), couriers riding in with news (mapCourier.ts), tumbleweeds and dust
// devils (mapDust.ts), weathervanes and wind chimes (mapVanes.ts), sun shafts and the dawn haze (mapSunShafts.ts).
// main.ts feeds it each snapshot (`sync`) and each frame (`render`), draws its couriers with the people (`couriers`) and
// plays its sounds (`onHonk`, `onChime`). Renderer only. `window.__wide` for previews.

import { biomeById } from '../../shared/data/biomes';
import type { Snapshot } from '../../shared/sim/snapshot';
import { sunAt } from '../art/sun';
import { Couriers, type CourierView } from './mapCourier';
import { MapDust } from './mapDust';
import { MapEyes } from './mapEyes';
import { MapGeese } from './mapGeese';
import { MapHorizon } from './mapHorizon';
import { MapSunShafts } from './mapSunShafts';
import type { MapView } from './mapView';
import { MapVanes } from './mapVanes';

export class WideWorld {
  readonly horizon: MapHorizon;
  readonly eyes: MapEyes;
  readonly geese: MapGeese;
  readonly couriers = new Couriers();
  readonly dust: MapDust;
  readonly vanes: MapVanes;
  readonly shafts: MapSunShafts;
  private snap: Snapshot | null = null;
  private sunSkew = 0;

  constructor(private readonly map: MapView) {
    this.shafts = new MapSunShafts(map.over);
    this.horizon = new MapHorizon(map.over, map.lights);
    this.eyes = new MapEyes(map.lights);
    this.dust = new MapDust(map.things, map.over);
    this.vanes = new MapVanes(map.things, map);
    this.geese = new MapGeese(map.over);
  }

  /** Each snapshot: the sky, the land, the powers, the buildings, the news; `blighted` the liches' and vampires' land,
   *  `folk` everyone about (world px). */
  sync(next: Snapshot, blighted: boolean, folk: { x: number; y: number }[]): void {
    this.snap = next;
    const c = next.calendar;
    const biome = biomeById(next.biome);
    const sky = { season: c.season, weather: next.weather.kind, daylight: c.daylight, hour: c.hour + c.minute / 60 };
    this.sunSkew = sunAt(sky.hour, 1).skew;
    this.horizon.sync(next.land, next.realm.factions);
    Object.assign(this.eyes, { land: next.land, sky, blighted, undead: blighted, folk });
    this.eyes.syncGraves(next.buildings);
    Object.assign(this.geese.sky, sky);
    this.geese.cold = !!biome.cold;
    Object.assign(this.dust, { land: next.land, sky, dry: !!biome.dry, cold: !!biome.cold });
    Object.assign(this.shafts, { land: next.land, sky, wet: !!biome.wet || next.biome === 'coast' });
    this.vanes.style = next.nomad?.settled ? 'town' : next.theme;
    this.vanes.sync(next.buildings);
    this.couriers.sync(next, next.land, next.buildings, performance.now());
  }

  /** The couriers riding now (main.ts draws them as riders among the people). */
  riders(): CourierView[] {
    return this.couriers.views(performance.now());
  }

  /** For previews: a courier sent at once (from a bearing, radians, or any way), and a skein of geese sent over. */
  sendCourier(bearing?: number): boolean {
    return !!this.snap && this.couriers.dispatch(this.snap.land, this.snap.buildings, performance.now(), bearing);
  }
  sendGeese(season = 'autumn'): void {
    this.geese.send(this.map.view, season);
  }

  /** A frame: each part drawn over the map's view. */
  render(dt: number): void {
    const map = this.map;
    const view = map.view;
    const wind = map.wind();
    this.shafts.render(dt, view, map.calm);
    this.horizon.render(dt, view, map.lights.alpha, this.snap?.calendar.daylight ?? 1, wind, map.calm);
    this.eyes.render(dt, view, map.calm);
    this.dust.render(dt, view, wind, map.calm);
    this.vanes.render(dt, view, wind, map.calm);
    this.geese.render(dt, view, this.sunSkew, map.calm);
  }
}
