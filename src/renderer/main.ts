// Strip renderer: draws the town and HUD, turns clicks into sim commands, and decides when the strip
// should capture the mouse.

import { biomeById } from '../shared/data/biomes';
import { hkCell, hkDraw, hkKnow, hkLayers, hkWhoOf, onHkLoad } from './art/hkFolk';
import { seatArt } from './art/seatArt';
import { SEAT_STAGE } from '../shared/data/seats';
import { CHATTER } from './chatter';
import { MapBattle } from './map/mapBattle';
import { MapSpells } from './map/mapSpells';
import { MapHerds } from './map/mapHerds';
import { MapBoats } from './map/mapBoats';
import { MapWagons } from './map/mapWagons';
import { MapBirds } from './map/mapBirds';
import { MapWildlife } from './map/mapWildlife';
import { MapTracks } from './map/mapTracks';
import { Minimap } from './map/minimap';
import { inRegion, regionTitle } from '../shared/sim/landRegions';
import { footprint as footprintOf } from '../shared/sim/buildings';
import { regionOfCell } from '../shared/sim/land';
import { MapDragon } from './map/mapDragon';
import { MapSky, skyFor } from './map/mapSky';
import { MapPets, type PetHome } from './map/mapPets';
import { freezes, iceAt } from './map/ice';
import { MapWater } from './map/mapWater';
import { MapButterflies } from './map/mapButterflies';
import { BattleDebris } from './map/battleDebris';
import { MapGraves } from './map/mapGraves';
import { sunAt } from './art/sun';
import { MapMarket } from './map/mapMarket';
import { SeasonDecor } from './map/seasonDecor';
import { StreetLamps } from './map/streetLamps';
import { MapSkiffs } from './map/mapSkiffs';
import { RoadTraffic } from './map/roadTraffic';
import { BloodPools } from './map/bloodPools';
import { MapDisaster } from './map/mapDisaster';
import { createBattleHud } from './battle/battleHud';
import { createRaidRecap } from './battle/raidRecap';
import { startCinema } from './cinema/cinema';
import { momentOf } from './cinema/moments';
import { CutsceneScene } from './cutscene/cutsceneView';
import { FightScene } from './fight/fightView';
import { TacticsScene } from './tactics/tacticsView';
import { MineScene } from './fight/mineView';
import { DeepScene } from './deep/deepView';
import { PortalScene } from './portal/portalView';
import { createFightHud } from './fight/fightHud';
import { applySeasonPalette } from './art/palette';
import 'pixi.js/unsafe-eval'; // Pixi's shader code generation without eval(), required by our CSP
import { Application, Graphics, TextureStyle } from 'pixi.js';
import { STRIP_HEIGHT } from '../shared/constants';
import { BUILDING_BY_ID, UPGRADES, type BuildingDef } from '../shared/data/buildings';
import { eraReached } from '../shared/data/eras';
import { TOPIC_BY_ID } from '../shared/data/research';
import { HERDS, PEN_ROOM_PER_COL } from '../shared/data/livestock';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../shared/data/materials';
import { CROPS, sectionsDone, sectionsOf } from '../shared/data/crops';
import { OPERATORS } from '../shared/data/operators';
import { SKILL_NAMES, SKILLS } from '../shared/data/skills';
import { TERRAIN } from '../shared/data/terrain';
import type { Bridge, InspectInfo, StripState } from '../shared/ipc';
import { blueprintCount, buildingDoor, canPlace, defOf, depthOf, isUnlocked, type PlaceCheck } from '../shared/sim/buildings';
import type { PersonView, RaiderView, RoamerView, Snapshot, TravellerView } from '../shared/sim/snapshot';
import { lineOfDef, venueOfDef } from '../shared/data/shop';
import { storePanel, type PanelId } from '../shared/ipc';
/** The window a venue's building opens (the shop, the tavern, or a specialty shop's). */
const venuePanel = (def: string): PanelId | undefined => (lineOfDef(def) ? storePanel(lineOfDef(def)!) : venueOfDef(def));
import { buildingTint } from './theme';

/** A traveller, drawn like a townsperson (they're only passing through: most of a person's details don't apply). */
function travellerPerson(t: TravellerView): PersonView {
  return {
    id: t.id, name: t.name, typeName: 'Traveller', look: t.look, x: t.x, y: t.y, dir: t.dir,
    activity: 'walk', taskDone: null, story: '', titles: [], secret: null, sinceHit: 999, hitFrom: 1, sinceBlow: 999, sinceBlock: 999, defending: false, beast: null, cls: null, clsName: null, clsPast: [], income: null, owns: [], debt: 0, ambition: null, trips: 0, clsText: '', founderCalling: false, stage: 0, ascended: false, level: 1, levelProgress: 0, mounted: null, doing: travellerDoing(t), carrying: {},
    skills: {} as PersonView['skills'], traits: [], needs: { food: 1, rest: 1 }, morale: 60, moodTarget: 60, moodReasons: [], grieving: false,
    priorities: {} as PersonView['priorities'], autoPriorities: false, bed: null, bedId: null, floor: null,
    indoors: t.phase === 'shopping', // (inside the shop: see its window)
    rally: null,
    away: null, hp: 1, maxHp: 1, downed: null, bleedMinutes: null, gear: {}, gearQ: {}, coins: null, detail: [], recent: [], bedroll: false, carryCapacity: 0,
    partner: null, married: false, friends: [], rivals: [], enemies: [], devoted: [], body: { wounds: [], lasting: [], fitted: [], sight: 1, handling: 1, moving: 1, pain: 0, marks: [] }, growsUpIn: null, breakdown: null, ageDays: 0,
  ageYears: 0, lifeStage: 'prime', ageText: '', elder: false, swimming: false, mer: false, nature: 'cheerful', natureName: 'Cheerful', natureLine: '', job: null,
  monster: null, tireless: false, order: null, sick: false,
    battle: { damage: [0, 0], accuracy: 0, dodge: 0, armor: 0, block: 0, crit: 0, ranged: false, attrs: { str: 8, dex: 8, vit: 8, int: 8, wis: 8, cha: 8 }, mp: 0, sp: 0, interval: 12, range: 1 }, kit: [], passives: [], road: null, roadId: null, freePts: 0, autoStats: false,
  favours: [],
  };
}
/** A daughter village's folk (sim/villages.ts), drawn as travellers about their own houses by day: each walks from one
 *  spot to the next round the village's fire and stands a while, on its own clock. Indoors by night. */
const VILLAGER_WALK = 9;
const VILLAGER_STAND = 6;
function villagerFigures(s: Snapshot, now: number): PersonView[] {
  if (!s.villages.length) return [];
  const hour = s.calendar.hour;
  if (hour >= 21 || hour < 6) return [];
  const out: PersonView[] = [];
  for (const v of s.villages) {
    const plots = s.villageBuildings.filter((b) => Math.floor((-b.id - 1) / 100) === v.id);
    if (!plots.length) continue;
    // (the spots: before each house's door and about the fire)
    const spots = plots.map((b) => ({ x: (b.tile + 1) * CELL, y: (b.row + 2.4) * CELL }));
    v.folk.forEach((f, i) => {
      const t = now / 1000 + i * 7.3 + v.id;
      const leg = Math.floor(t / (VILLAGER_WALK + VILLAGER_STAND));
      const into = t - leg * (VILLAGER_WALK + VILLAGER_STAND);
      const at = (k: number) => spots[Math.floor(hashSeed(`${v.id}:${f.id}:${k}`) % spots.length)];
      const a = at(leg);
      const b = at(leg + 1);
      const k = Math.min(1, into / VILLAGER_WALK);
      const x = a.x + (b.x - a.x) * k + ((i % 3) - 1) * 10;
      const y = a.y + (b.y - a.y) * k + (i % 2) * 8;
      const tv: TravellerView = { id: f.id, name: f.name, kind: 'villager', venue: 'shop', line: null, wants: '', temper: '', purse: 0, look: f.look, x, y, dir: b.x < a.x ? -1 : 1, phase: 'arriving', tier: 0 };
      out.push({ ...travellerPerson(tv), typeName: `Of ${v.name}`, activity: k < 1 && (a.x !== b.x || a.y !== b.y) ? 'walk' : 'idle', doing: `Living in ${v.name}${f.id === undefined ? '' : ''}` });
    });
  }
  return out;
}
/** A power's envoy (sim/factions.ts), drawn as a traveller on horseback. */
function envoyPerson(r: NonNullable<Snapshot['envoyRider']>): PersonView {
  const v = travellerPerson({ id: r.id, name: r.name, kind: 'envoy', venue: 'shop', line: null, wants: '', temper: '', purse: 0, look: r.look, x: r.x, y: r.y, dir: r.dir, phase: 'arriving', tier: 0 });
  return { ...v, typeName: 'Envoy', mounted: 0x6a4a2a, doing: r.leaving ? 'Riding home with the answer' : 'Waiting at the fire for an answer' };
}
const travellerDoing = (t: TravellerView) => {
  // (one of a visiting band: sim/bands.ts)
  if (t.band) {
    const ph = t.bandPhase ?? 'coming';
    if (t.band === 'caravan') return ph === 'coming' ? 'Bringing the caravan in to the market' : ph === 'staying' ? 'Trading at the market' : 'Moving on with the caravan';
    if (t.band === 'refugees') return ph === 'coming' ? 'Fleeing to the gate' : ph === 'staying' ? 'Camped at the gate, hoping for aid' : 'Trudging away';
    return ph === 'coming' ? 'Passing through' : ph === 'staying' ? 'Resting a while' : 'Moving on';
  }
  const where = t.venue === 'tavern' ? 'tavern' : 'shop';
  return t.phase === 'arriving' ? `On the way to the ${where}` : t.phase === 'shopping' ? `In the ${where}` : 'Moving on';
};
import { bleedLeft } from '../shared/format';
import { poolSize } from '../shared/sim/state';
import { hashSeed } from '../shared/rng';
import { CELL, cellAt, groundAt, isMarked, isRoad, WILD } from '../shared/sim/land';
import { loadCreatures } from './art/creatures';
import { loadEffects } from './art/effects';
import { loadStills } from './art/stills';
import { loadLpc, loadLpcFaces, lpcFrame } from './art/lpc/lpc';
import { topDownArt } from './art/topDown';
import { packArt } from './map/packBuildings';
import { airFor } from './town/ambientView';
import { noTone, textureCanvas } from './art/pixelArt';
import { MapCamera } from './map/mapCamera';
import { MapView } from './map/mapView';
import { MapPeople } from './map/mapPeople';
import { MapRaiders } from './map/mapRaiders';
import { createHud } from './hud';
import { hostBridge, localBridge } from './localBridge';
import { createMusic } from './music';
import { createAmbience } from './ambience';
import { ambientMix, type AmbientMix } from './ambienceMix';
import { createActionBar, createAwayCard, createBanner, createExpeditionHeader, createGameOver, createPersonCard, createPromptCard, createToasts, type Action } from './overlayUi';
import { createTooltip } from './tooltip';
import { ExpeditionPane } from './town/expeditionPane';
import { SnowView } from './town/snowView';
import { LeavesView } from './town/leavesView';
import { WeatherView } from './town/weatherView';

declare global {
  interface Window {
    /** Provided by the preload script; in a plain browser (for previewing) a local stand-in is installed. */
    bridge?: Bridge;
  }
}

/** Pointer travel before a press becomes a drag; shorter presses are clicks. */
const DRAG_THRESHOLD = 4;
const WHEEL_SPEED = 1.5;
const FPS_ACTIVE = 60;
/** The Deep's view leaves this much room (px) above and below the level for its windows (deep/deepView.ts). */
const DEEP_TOP = 50;
const DEEP_BOTTOM = 120;
/** Held sideways, the windows are a column down the right instead. */
const DEEP_SIDE = 250;
const FPS_IDLE = 30;
/** How long the strip shakes for a boss moment. */
const SHAKE_MS = 450;

/** 'scenery' is background art: hovering it lets you scroll, but there is nothing to act on. */
type Hover =
  | { kind: 'person'; person: PersonView }
  | { kind: 'building'; id: number }
  | { kind: 'cell'; cell: number }
  | { kind: 'place'; id: number }
  | { kind: 'scenery' }
  | { kind: 'pane' }
  | { kind: 'raider'; id: number }
  | { kind: 'roamer'; id: number }
  | { kind: 'pet'; key: string }
  | { kind: 'grave'; id: number }
  | { kind: 'caravan' }
  | { kind: 'village'; id: number }
  | null;

/** The bands roaming the land drawn as raiders (one figure a foe, in a little knot), their ids so many a band. */
const ROAMER_IDS = 16;
const ROAMER_TITLE: Record<RoamerView['kind'], string> = { beasts: 'Wild beasts', dead: 'The restless dead', bandits: 'Bandits', nest: 'From a nest' };
function roamerFigures(rs: readonly RoamerView[]): RaiderView[] {
  return rs.flatMap((r) =>
    r.foes.slice(0, ROAMER_IDS).map((f, i) => ({
      id: r.id * ROAMER_IDS + i,
      swimming: false,
      ally: false,
      sinceArea: 999,
      sinceConjured: 999,
      sinceCast: 999,
      hitFx: null,
      kind: f.kind,
      name: f.name,
      floor: null,
      x: r.x + ((i % 3) - 1) * 16 + (i >= 3 ? 8 : 0),
      y: r.y + Math.floor(i / 3) * 12,
      dir: r.dir,
      hp: 1,
      maxHp: 1,
      down: false,
      fleeing: false,
      gone: false,
      carrying: 0,
      captive: null,
      lame: 0,
      sinceAction: 999,
      sinceHit: 999,
    })),
  );
}

/** Width of the tab dock at the right end of the strip (see #dock in index.html). */
const DOCK_WIDTH = 108;
/** The expedition pane's width range, and how far down it starts counting as "over" it. */
const PANE_MIN = 320;
const PANE_MAX = 520;
const PANE_HIT_TOP = 90;
/** Whether a party away is drawn walking in a pane beside the map (off: the owner found it more clutter than help). */
const SHOW_PANE = false;

const listStock = (s: Stock) =>
  MATERIALS.filter((m) => (s[m] ?? 0) > 0)
    .map((m) => `${MATERIAL_NAMES[m]} ${s[m]}`)
    .join(' · ');

/** Names for the open kinds of ground (the wild kinds are named by TERRAIN). */
const GROUND_NAMES: Record<string, string> = { grass: 'Open ground', fertile: 'Rich soil', sand: 'Sand', water: 'Water' };

async function start(): Promise<void> {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  const bridge = window.bridge ?? (window.bridge = hostBridge() ?? localBridge());
  // (on the phone the page around the strip has its own, bigger tab buttons)
  if (hostBridge()) document.body.classList.add('embedded');
  /** In the phone (web) version's page: tapping selects, and a card at the top of the screen shows it. */
  const phone = !!hostBridge();
  /** A finger rather than a mouse (a phone): hints say "tap" and "long-press". */
  const coarse = () => matchMedia('(pointer: coarse)').matches;

  const [first] = await Promise.all([bridge.getSnapshot(), loadLpc(), loadCreatures(), loadEffects(), loadStills()]);
  void loadLpcFaces(); // (the townsfolk's up- and down-facing walk rows come in after; side-on until then)
  applySeasonPalette(first.biome, first.calendar.season); // (the land is drawn in the colours of the season)
  const seedHash = hashSeed(first.seed);

  const app = new Application();
  await app.init({
    backgroundAlpha: 0,
    resizeTo: window,
    antialias: false,
    resolution: window.devicePixelRatio || 1,
    autoDensity: true,
    roundPixels: true,
    sharedTicker: true,
  });
  document.body.appendChild(app.canvas);
  const canvas = app.canvas;
  // On the phone the page shows the strip scaled up (a CSS transform on its frame), which would stretch the drawn
  // picture and blur it: the page tells the strip its scale, and it draws at that resolution instead, so every pixel of
  // the art lands on whole pixels of the screen (mobile.ts snaps the scale to make it so).
  // (quality 2: everything; 1: no smoke or mist; 0: and drawn at the screen's plain resolution, as before)
  let quality = 2;
  let stripScale = 1;
  const sharpen = (scale: number) => {
    stripScale = scale;
    app.renderer.resize(app.screen.width, app.screen.height, (window.devicePixelRatio || 1) * (quality > 0 ? scale : 1));
  };
  Object.assign(window, { __setStripScale: sharpen });
  // A phone that can't keep up steps the quality down (watched in ten-second spells while the town is on screen,
  // from fifteen seconds after it starts): first the smoke and mist go, then the extra resolution.
  {
    let frames = 0;
    let since = performance.now() + 15_000;
    app.ticker.add(() => {
      const now = performance.now();
      if ((window as unknown as { __keepQuality?: boolean }).__keepQuality) return; // (previews in a slow headless browser)
      if (document.hidden || now < since) {
        frames = 0;
        if (document.hidden) since = now + 3000;
        return;
      }
      frames++;
      if (now - since < 10_000) return;
      const fps = (frames * 1000) / (now - since);
      frames = 0;
      since = now;
      if (fps >= 28 || quality === 0) return;
      quality--;
      map.calm = quality < 2;
      sharpen(stripScale);
      console.info(`[quality] ${fps.toFixed(0)} fps: down to ${quality}`);
    });
  }
  const asked = (window as unknown as { __stripScale?: number }).__stripScale;
  if (asked) sharpen(asked);

  // the town, top-down (map/mapView.ts): the land, the buildings on their footprints, and everyone on it
  const map = new MapView();
  (window as unknown as { __map?: MapView }).__map = map; // (for previews and profiling)
  (window as unknown as { __topDownArt?: typeof topDownArt }).__topDownArt = topDownArt; // (for previews: a gallery of the painted buildings)
  const pools = new BloodPools(map.under); // (blood on the ground where someone fell)
  const debris = new BattleDebris(map.under); // (and what the fallen dropped)
  const disaster = new MapDisaster(map.under, map.over); // (floods, wildfires and their ash: sim/disasters.ts)
  (window as unknown as { __pools?: BloodPools }).__pools = pools; // (for previews)
  const people = new MapPeople(map.things);
  (window as unknown as { __people?: MapPeople }).__people = people; // (for previews and probes)
  people.lights = map.lights;
  (window as unknown as { __people?: MapPeople }).__people = people; // (for previews)
  (window as unknown as { __hkCell?: typeof hkCell }).__hkCell = hkCell; // (for previews: a townsperson's cell)
  const raiders = new MapRaiders(map.things);
  const roamers = new MapRaiders(map.things); // (the bands roaming the land: sim/roamers.ts)
  const herds = new MapHerds(map.things);
  const boats = new MapBoats(map.things);
  const wagons = new MapWagons(map.things); // (the caravans' wagons: sim/bands.ts)
  const birds = new MapBirds(map.things, map);
  (window as unknown as { __birds?: MapBirds }).__birds = birds; // (for previews)
  const butterflies = new MapButterflies(map.things, map);
  const wildlife = new MapWildlife(map.things, map);
  (window as unknown as { __wildlife?: MapWildlife }).__wildlife = wildlife; // (for previews)
  const water = new MapWater(map.things, map.under, map.over, map.root, map);
  // footprints in the snow, the sand and the rain's mud, and breath in the cold (map/mapTracks.ts)
  const tracks = new MapTracks(map.under, map.over, map);
  (window as unknown as { __tracks?: MapTracks }).__tracks = tracks; // (for previews)
  // the town's dogs, cats and hens (map/mapPets.ts)
  const pets = new MapPets(map.things, map.over, map);
  const graves = new MapGraves(map.things); // (a headstone for each of the fallen)
  (window as unknown as { __graves?: MapGraves }).__graves = graves; // (previews)
  const market = new MapMarket(map.things); // (market day's stalls)
  const decor = new SeasonDecor(map.things, map.lights); // (the doors dressed for the season)
  const lamps = new StreetLamps(map.things, map.lights); // (lamps along the streets, lit at dusk)
  const skiffs = new MapSkiffs(map.things); // (boats along the rivers)
  const traffic = new RoadTraffic(map.things); // (carts along the roads)
  (window as unknown as { __traffic?: unknown }).__traffic = { skiffs, traffic, ground: map.groundWeather }; // (previews)
  // the dragon in the sky (map/mapDragon.ts)
  const dragon = new MapDragon(map.over, map.under, map);
  dragon.onFlight = (low, pan) => ambience.cue('roar', pan, low ? 0.2 : 0.8);
  (window as unknown as { __pets?: MapPets }).__pets = pets; // (for previews)
  // (thunder rolls in a moment after the flash, from the side it struck)
  pets.onSound = (kind, x) => ambience.cue(kind, ((x - map.view.x) / Math.max(1, map.view.w)) * 1.6 - 0.8);
  water.onStrike = (x) => ambience.cue('thunder', ((x - map.view.x) / Math.max(1, map.view.w)) * 1.4 - 0.7, 0.3 + Math.random() * 1.2);
  (window as unknown as { __water?: MapWater }).__water = water; // (for previews)
  const pane = new ExpeditionPane(seedHash);
  const snow = new SnowView();
  const leaves = new LeavesView();
  // On the phone the strip has no desktop behind it: weather falls over the town.
  const fullSky = !!hostBridge();
  const weather = fullSky ? new WeatherView() : null;
  const townMask = new Graphics(); // used only as a mask (never added to the stage, or it would draw)
  app.stage.addChild(map.root);
  // fog banks, sandstorms, blizzards and heat haze (map/mapSky.ts)
  const sky = new MapSky(map);
  app.stage.addChild(sky.root);
  (window as unknown as { __sky?: MapSky }).__sky = sky; // (for previews)
  if (weather) app.stage.addChild(weather.root);
  app.stage.addChild(snow.root, leaves.root, pane.root);
  // a raid's battle is fought on the town's own map (map/mapBattle.ts draws the trail, the spots and the shots over it)
  const battle = new MapBattle(map);
  // (spells on the map: the packs' effect sheets over whoever they touch, following people and raiders)
  const spells = new MapSpells(map.over, (t) => (t.id === undefined ? null : t.raider ? raiders.posOf(t.id) : people.posOf(t.id)));
  (window as unknown as { __battle?: MapBattle }).__battle = battle; // (for previews: where a spot is on screen)
  // watching a party away, as in the old games (fight/fightView.ts): it takes over the strip too
  const fight = new FightScene();
  app.stage.addChild(fight.root);
  // a raid fought as a tactics battle (tactics/tacticsView.ts): the board of the town's land, seen at an angle
  const tactics = new TacticsScene(map, (c) => bridge.command(c));
  app.stage.addChild(tactics.root);
  (window as unknown as { __tactics?: TacticsScene }).__tactics = tactics; // (for previews: taps on the board)
  // inside a mine on the land (fight/mineView.ts): the diggers at the seams
  const mine = new MineScene();
  app.stage.addChild(mine.root);
  // the Deep under the town (deep/deepView.ts): a level seen from above, the miners carving it out
  const deep = new DeepScene((c) => bridge.command(c));
  // another world looked into through a portal (portal/portalView.ts): its own full-screen page
  const portal = new PortalScene((c) => bridge.command(c));
  app.stage.addChild(deep.root);
  // a cutscene (cutscene/cutsceneView.ts): over everything, offered first, then played full screen
  const cutscene = new CutsceneScene((c) => bridge.command(c), document.body);
  app.stage.addChild(cutscene.root);
  const fightHud = createFightHud({
    back: () => {
      bridge.command({ type: 'watch', expedition: null });
      bridge.command({ type: 'watchMine', place: null });
    },
  });
  const raidRecap = createRaidRecap();
  const cinema = startCinema(document.body); // (a big moment as a title card, the screen letterboxed)
  let lastNewsId = -2; // (-2: no snapshot yet; the news already there when the page opens is not shown again)
  const battleHud = createBattleHud({
    go: () => bridge.command({ type: 'battleGo' }),
    auto: (on) => bridge.command({ type: 'battleAuto', on }),
    speed: (n) => bridge.command({ type: 'battleSpeed', speed: n }),
    pick: (person) => {
      battle.selectedPerson = person;
    },
    spell: (id) => {
      battle.aiming = id;
      battle.lastAim = null;
    },
  });

  /** Where the town ends and the expedition pane (if showing) begins, in screen x. */
  let paneX = Infinity;
  let paneW = 0;
  const layoutSplit = () => {
    const w = app.screen.width;
    const want = pane.visible ? Math.min(PANE_MAX, Math.max(PANE_MIN, Math.round(w * 0.32))) : 0;
    const x0 = w - DOCK_WIDTH - want;
    if (!pane.visible || x0 < PANE_MIN) {
      paneX = Infinity;
      paneW = 0;
      map.root.mask = null;
      return w;
    }
    paneX = x0;
    paneW = want;
    pane.layout(x0, want, app.screen.height);
    townMask.clear().rect(0, 0, x0, app.screen.height).fill(0xffffff);
    map.root.mask = townMask;
    return x0;
  };

  const camera = new MapCamera(first.land.w * CELL, first.land.h * CELL);
  // the minimap of the wide land (map/minimap.ts), and the caption naming the region the view is over
  const minimap = new Minimap();
  minimap.mount(document.body);
  minimap.onLook = (wx, wy) => camera.centreOn({ x: wx, y: wy }, app.screen.width, app.screen.height);
  // (the phone page's ☰ menu turns it on and off)
  (window as unknown as { __minimap?: { shown: boolean } }).__minimap = minimap;
  const regionCaption = document.createElement('div');
  regionCaption.id = 'region-name';
  regionCaption.hidden = true;
  document.body.append(regionCaption);
  let regionShown = '';
  let regionHideAt = 0;
  (window as unknown as { __camera?: MapCamera }).__camera = camera; // (for previews)
  camera.centreOn(first.camp, app.screen.width, app.screen.height); // (a nomad tribe's camp may be away on its pasture)

  /** The expedition shown in the split view: the most recently sent one. */
  const shownExpedition = () => snap.expeditions.at(-1) ?? null;
  const expHeader = createExpeditionHeader(() => bridge.openPanel('expeditions'));
  const promptCard = createPromptCard((prompt, option) => bridge.command({ type: 'answerPrompt', prompt, option }));
  const gameOver = createGameOver(() => bridge.openPanel('newgame'));
  const dismissAway = () => bridge.command({ type: 'dismissAway' });
  const awayCard = createAwayCard(
    () => {
      dismissAway();
      bridge.openPanel('journal');
    },
    dismissAway,
  );

  // (an origin's look reaches its buildings too)
  const hud = createHud(bridge); // (the buildings' style follows the snapshot: see applySnapshot)
  const music = createMusic();
  // the land's soundscape, on with the music (ambience.ts)
  const ambience = createAmbience();
  (window as unknown as { __ambience?: typeof ambience }).__ambience = ambience; // (for previews)
  let ambMix: AmbientMix | null = null;
  let wasRaid = false;
  const tip = createTooltip();
  const actions = createActionBar();
  const toasts = createToasts();
  let view: StripState = { mode: 'full', hidden: false, panel: null, music: false };
  let snap: Snapshot = first;
  /** Whether a cell is wild land (something to gather on it). */
  const wildCell = (i: number) => {
    const c = cellAt(snap.land, i);
    return WILD.includes(groundAt(snap.land, c.x, c.y));
  };
  /** The screen y a tooltip hangs at, over someone's head (or over the pointer, if they can't be found). */
  const overheadY = (at: { x: number; y: number } | null, up: number) => (at ? map.screenOf(at.x, at.y).y - up : (mouse?.y ?? 0) - up);

  /* -------------------------------------------------------- state of the pointer */

  let interactive = false;
  let hover: Hover = null;
  let mouse: { x: number; y: number; target: EventTarget | null } | null = null;
  let press: { x: number; y: number; id: number } | null = null;
  /** A selected building, and which of its sub-menus is open. */
  let selected: { id: number; menu: 'main' | 'demolish' | 'empty' } | null = null;
  let selectedPerson: number | null = null;
  let placing: { def: BuildingDef; x: number; y: number; check: PlaceCheck } | null = null;

  const banner = createBanner(() => stopPlacing());

  const setInteractive = (on: boolean) => {
    if (on === interactive) return;
    interactive = on;
    bridge.setInteractive(on);
  };

  /** What in the town (or the expedition pane) is under a screen point. */
  const hitTest = (x: number, y: number): Hover => {
    if (x >= paneX) return x < paneX + paneW && y >= app.screen.height - STRIP_HEIGHT + PANE_HIT_TOP ? { kind: 'pane' } : null;
    const w = map.worldOf(x, y);
    const raider = raiders.raiderAt(w.x, w.y);
    if (raider) return { kind: 'raider', id: raider.id };
    const roamer = roamers.raiderAt(w.x, w.y);
    if (roamer) return { kind: 'roamer', id: Math.floor(roamer.id / ROAMER_IDS) };
    const person = people.personAt(w.x, w.y);
    // (one of a daughter village's folk: the village's card)
    const vil = person && snap.villages.find((v) => v.folk.some((f) => f.id === person.id));
    if (vil) return { kind: 'village', id: vil.id };
    if (person) return { kind: 'person', person };
    const pet = pets.petAt(w.x, w.y);
    if (pet) return { kind: 'pet', key: pet };
    const grave = graves.graveAt(w.x, w.y);
    if (grave) return { kind: 'grave', id: grave.id };
    const building = map.buildingAt(w.x, w.y);
    // (a daughter village's houses and fields are drawn as buildings with ids below zero: sim/villages.ts)
    if (building !== null) return building < 0 ? { kind: 'village', id: Math.floor((-building - 1) / 100) } : { kind: 'building', id: building };
    const place = map.placeAt(w.x, w.y);
    if (place) return { kind: 'place', id: place.id };
    const cell = map.cellAt(w.x, w.y);
    if (cell === null) return { kind: 'scenery' };
    return { kind: 'cell', cell };
  };

  (window as unknown as { __hitTest?: typeof hitTest }).__hitTest = hitTest; // (for previews)
  const refreshHover = () => {
    if (camera.dragging || press) return;
    const overUi = mouse?.target instanceof Element && !!mouse.target.closest('[data-hit]');
    const active = view.mode === 'full' && !view.hidden;
    if (placing) {
      hover = null;
      setInteractive(!!mouse && active); // the whole strip is live while placing
      updateGhost();
      return;
    }
    hover = mouse && !overUi && active ? hitTest(mouse.x, mouse.y) : null;
    setInteractive(overUi || hover !== null);
    const clickable = hover?.kind === 'building' || hover?.kind === 'pane' || hover?.kind === 'place' || (hover?.kind === 'cell' && wildCell(hover.cell));
    canvas.style.cursor = clickable ? 'pointer' : hover ? 'grab' : 'default';
    if (phone) {
      // no tooltips on the phone: the top card says it all (and the selected patch of land stays lit)
      map.setHighlight(inspected?.kind === 'cell' ? inspected.cell : null);
      return tip.hide();
    }
    showHover();
  };

  /* -------------------------------------------------------- tooltips */

  /** What there is to say about something under the pointer (or selected on the phone): a title, some lines, a
   *  hint about clicking it (for the tooltip only), and the screen y for a tooltip. */
  const describe = (h: NonNullable<Hover>): { title: string; lines: string[]; hint?: string; y: number } | null => {
    switch (h.kind) {
      case 'raider': {
        const r = snap.raid?.raiders.find((q) => q.id === h.id);
        if (!r) return null;
        const doing = r.captive ? `Carrying off ${r.captive}! Stop them!` : r.fleeing ? (r.carrying ? 'Running off with your goods!' : 'Fleeing') : 'Raiding';
        return { title: r.name, lines: [`${doing} · health ${r.hp}/${r.maxHp}`], y: overheadY(raiders.posOf(r.id), 54) };
      }
      case 'roamer': {
        const r = snap.roamers.find((q) => q.id === h.id);
        if (!r) return null;
        const doing = r.fighting ? 'Fighting townsfolk out on the land!' : r.chasing ? `After ${r.chasing}!` : 'Roaming the land: anyone out alone is in danger';
        const foes = Object.entries(r.foes.reduce<Record<string, number>>((n, f) => ((n[f.name] = (n[f.name] ?? 0) + 1), n), {})).map(([name, n]) => (n > 1 ? `${n} × ${name}` : name));
        return { title: r.name ? `${r.name[0].toUpperCase()}${r.name.slice(1)} from a nest` : ROAMER_TITLE[r.kind], lines: [doing, foes.join(', ')], y: overheadY(roamers.posOf(r.id * ROAMER_IDS), 54) };
      }
      case 'caravan': {
        const c = snap.caravan;
        if (!c) return null;
        const open = c.offers.filter((o) => !o.done).length;
        return { title: c.faction ? `A caravan of ${c.faction}` : 'Trade caravan', lines: [`${open} deal${open === 1 ? '' : 's'} on offer · leaves in ${Math.ceil(c.hoursLeft)}h`], hint: 'Click to trade', y: (mouse?.y ?? 0) - 60 };
      }
      case 'pane': {
        const e = shownExpedition();
        if (!e) return null;
        return { title: `To the ${e.destName}`, lines: [e.members.map((m) => m.name).join(', ')], hint: 'Click for the Expedition Board', y: app.screen.height - STRIP_HEIGHT + 120 };
      }
      case 'person': {
        const id = h.person.id;
        if (snap.visitor?.id === id) {
          const v = snap.visitor;
          const when = v.leaving ? 'Leaving' : `Waiting to be let in (leaves in ${Math.ceil(v.hoursLeft)}h)`;
          return { title: `${v.name}, ${v.typeName.toLowerCase()}`, lines: [when], hint: 'Click to decide', y: overheadY(people.posOf(id), 66) };
        }
        const traveller = snap.travellers.find((q) => q.id === id);
        if (traveller)
          return {
            title: `${traveller.name}, a ${traveller.kind}`,
            lines: [`${travellerDoing(traveller)} · after ${traveller.wants}${traveller.temper ? ` · ${traveller.temper}` : ''}`, `A stranger passing through, with ${traveller.purse} coins to spend`],
            hint: `Click to see the ${traveller.venue}`,
            y: overheadY(people.posOf(id), 50),
          };
        const p = snap.people.find((q) => q.id === id) ?? h.person; // latest data for the person
        const lines = [p.doing, ...p.detail.slice(0, 1)];
        if (poolSize(p.carrying) > 0) lines.push(`Carrying ${listStock(p.carrying)}`);
        lines.push(`Morale ${Math.round(p.morale)} · ${p.typeName}${p.coins !== null ? ` · ${p.coins} coins` : ''}`);
        return { title: `${p.name}${p.id === snap.mainId ? ' (you)' : ''}`, lines, hint: 'Click for details', y: overheadY(people.posOf(id), 50) };
      }
      case 'building': {
        const b = snap.buildings.find((q) => q.id === h.id);
        const r = map.buildingScreenRect(h.id);
        if (!b || !r) return null;
        const def = defOf(b);
        const lines: string[] = [];
        if (b.status === 'blueprint') {
          const parts = (Object.entries(def.cost) as [Material, number][]).map(([m, n]) => `${MATERIAL_NAMES[m]} ${b.delivered[m] ?? 0}/${n}`);
          lines.push(b.progress > 0 ? `Under construction: ${Math.floor(b.progress * 100)}%` : `Materials delivered: ${parts.join(' · ')}`);
          if (b.overgrown) lines.push('Clearing the ground first: the trees and rocks on it are being cut and dug out');
        } else {
          if (b.fire !== undefined) lines.push(`ON FIRE! ${Math.floor(b.fire * 100)}% burned — everyone is fighting it`);
          lines.push(def.purpose);
          // whose it is, and who lives in it (homes are bought by the townsfolk and let out: sim/property.ts)
          const name = (id: number) => snap.people.find((q) => q.id === id)?.name;
          const owner = b.owner !== undefined ? name(b.owner) : undefined;
          if (!def.hp && !CROPS[b.def]) lines.push(owner ? `Owned by ${owner}` : "The town's own (the treasury's)");
          if (def.housing) {
            const living = snap.people.filter((q) => q.bedId === b.id);
            lines.push(living.length ? `Home of ${living.map((q) => q.name + (owner && q.id !== b.owner ? ' (renting)' : '')).join(', ')} · ${living.length}/${def.housing} beds` : `Empty · ${def.housing} ${def.housing === 1 ? 'bed' : 'beds'}`);
          }
          const role = OPERATORS[b.def];
          if (role) {
            const who = snap.people.find((p) => p.id === b.operator);
            lines.push(who ? `${role.title}: ${who.name} (${SKILL_NAMES[role.skill]} ${who.skills[role.skill].level}). ${role.effect}.` : `No ${role.title.toLowerCase()} yet`);
          }
          if (def.storage) lines.push(`Stored ${poolSize(b.store)}/${def.storage}${poolSize(b.store) ? ': ' + listStock(b.store) : ''}`);
          if (def.hp) lines.push(`Health ${Math.round(b.hp ?? def.hp)}/${def.hp}${(b.hp ?? def.hp) < def.hp ? ' (builders will repair it)' : ''}`);
          // a prison's cells and who's held; a healing building's sickbeds and who lies in them
          if (def.cells && b.status === 'done') lines.push(`${def.cells} cells. The town holds ${snap.prisoners.length} of ${snap.cells}${snap.prisoners.length ? `: ${snap.prisoners.map((q) => q.name).join(', ')}` : ''}.`);
          const ward = snap.nursing.find((n) => n.building === b.id);
          if (ward) lines.push(`Sickbeds ${ward.people.length}/${ward.beds}${ward.people.length ? `: ${ward.people.map((id) => snap.people.find((q) => q.id === id)?.name).filter(Boolean).join(', ')}` : ''}. The hurt heal here at its pace.`);
          if (b.def === 'graveyard') lines.push(snap.graves.length ? `Here lie: ${snap.graves.map((g) => g.name).join(', ')}` : 'Nobody lies here yet.');
          if (HERDS[b.def] && b.status === 'done') {
            const herd = HERDS[b.def];
            const head = b.herd?.head ?? 0;
            const room = herd.room + (b.wide ?? 0) * PEN_ROOM_PER_COL;
            lines.push(head ? `${head} ${head === 1 ? herd.animal : herd.plural} of room for ${room}${b.wide ? ` (fenced wider ${b.wide} times)` : ''}` : `Empty: the town will buy ${herd.start} ${herd.plural} from a drover (${herd.price} coins each).`);
          }
          if (CROPS[b.def]) {
            const c = b.crop;
            const crop = CROPS[b.def];
            const winter = snap.calendar.season === 'winter';
            const soil = c?.soil ?? 1;
            const tired = !crop.indoor && !crop.establishHours && soil < 0.5;
            lines.push(
              !c || c.stage === 'fallow'
                ? winter
                  ? 'Fallow: nothing grows in winter'
                  : crop.establishHours
                    ? 'Waiting for a farmer to plant the trees'
                    : c && c.work > 0
                      ? `Being sown: ${sectionsDone(c.work, def.width)} of ${sectionsOf(def.width)} sections`
                      : tired
                      ? 'Fallow: resting the tired soil'
                      : 'Fallow: waiting for a farmer to sow it'
                : c.stage === 'ripe'
                  ? c.work > 0
                    ? `Being reaped: ${sectionsDone(c.work, def.width)} of ${sectionsOf(def.width)} sections in`
                    : 'Ripe: waiting for a farmer to harvest it'
                  : crop.establishHours && !c.bearing
                    ? `Young trees, coming into bearing: ${Math.floor(c.growth * 100)}%${winter ? ' (paused for winter)' : ''}`
                    : `Growing: ${Math.floor(c.growth * 100)}%${winter ? ' (paused for winter)' : ''}`,
            );
            if (!crop.indoor && !crop.establishHours) lines.push(`Soil: ${soil >= 1 ? 'rich' : soil >= 0.75 ? 'good' : soil >= 0.5 ? 'tiring' : 'worn out'} (the harvest ×${soil.toFixed(1)})`);
          }
        }
        return { title: def.name + (b.status === 'blueprint' ? ' (blueprint)' : ''), lines, hint: 'Click for options', y: r.y };
      }
      case 'grave': {
        const who = snap.annals.fallen.find((f) => f.id === h.id);
        const at = graves.posOf(h.id);
        if (!who || !at) return null;
        const what = [who.calling ? `${who.calling}, level ${who.level}` : null, who.titles.length ? who.titles.join(', ') : null].filter((x): x is string => !!x);
        return { title: `Here lies ${who.name}`, lines: [`Died on day ${who.day}, ${who.cause}.`, ...what, ...(who.felled ? [`Felled ${who.felled} raider${who.felled === 1 ? '' : 's'}.`] : [])], y: map.screenOf(at.x, at.y).y - 30 };
      }
      case 'village': {
        const v = snap.villages.find((q) => q.id === h.id);
        if (!v) return null;
        const lines = [`A ${v.tier} of ${v.pop}, led by ${v.leader}. ${v.rebel ? 'It has broken away from the town!' : `Loyalty ${v.loyalty} of 100: ${v.tithe ? 'it sends its carts as tithe' : 'it sells the town its carts'}.`}`];
        if (v.makes.length) lines.push(`Makes ${v.makes.join(', ')}.`);
        if (v.beset) lines.push(`Beset by ${v.beset}!`);
        if (v.news[0]) lines.push(`Lately: ${v.news[0]}`);
        return { title: v.name, lines, hint: 'Click for the villages', y: map.screenOf((v.x + 1) * CELL, v.y * CELL).y - 60 };
      }
      case 'pet': {
        const d = pets.describe(h.key);
        if (!d) return null;
        return { title: d.title, lines: [d.line], hint: 'Tap to give it a scratch', y: map.screenOf(d.x, d.y).y - 30 };
      }
      case 'place': {
        const p = snap.places.find((q) => q.id === h.id);
        if (!p) return null;
        const y = map.screenOf(p.x, p.y).y - 40;
        if (p.dest) return { title: p.name, lines: [p.text, `${p.foes} there.`], hint: 'Click to post a bounty or forbid it', y };
        if (p.mine) {
          const left = (Object.entries(p.mine.left) as [Material, number][]).filter(([m, n]) => m !== 'stone' && n > 0).map(([m, n]) => `${n} ${MATERIAL_NAMES[m].toLowerCase()}`);
          return { title: 'Mine', lines: [`Level ${p.mine.depth}${p.mine.last ? ' (the last)' : ''}: ${left.length ? `${left.join(', ')} in the walls` : 'dug out to the rock'}.`, p.mine.diggers ? `${p.mine.diggers} digging.` : 'Nobody digging now.'], hint: 'Click to go in', y };
        }
        return { title: p.name, lines: [p.state === 'done' ? `${p.text} The town has been over it.` : p.state === 'gone' ? 'Whatever lived here has gone.' : `${p.text} The town will look it over soon.`], y };
      }
      case 'cell': {
        const c = cellAt(snap.land, h.cell);
        const y = map.screenOf(c.x * CELL, c.y * CELL).y;
        const g = groundAt(snap.land, c.x, c.y);
        const def = TERRAIN[g as keyof typeof TERRAIN];
        const where = inRegion(regionOfCell(snap.land, c.x, c.y));
        if (!def) return { title: GROUND_NAMES[g] ?? 'Open land', lines: [(g === 'water' ? 'The water' : 'The town builds here when it needs to') + (where ? ` (${where.trim()})` : '')], y };
        return { title: def.name + (where ? ` ${where.trim()}` : ''), lines: [listStock(snap.land.pools[h.cell] ?? {}) + ' left'], hint: isMarked(snap.land, h.cell) ? 'The town is clearing it' : 'The town will gather here when it needs to', y };
      }
      default:
        return null;
    }
  };

  const showHover = () => {
    map.setHighlight(hover?.kind === 'cell' ? hover.cell : null);
    if (!hover || hover.kind === 'scenery' || !mouse) return tip.hide();
    // (a selected building shows its action bar instead, and a selected person their card)
    if ((hover.kind === 'building' && selected?.id === hover.id) || (hover.kind === 'person' && selectedPerson === hover.person.id && snap.visitor?.id !== hover.person.id)) return tip.hide();
    const d = describe(hover);
    if (!d) return tip.hide();
    tip.show(d.title, d.hint ? [...d.lines, d.hint] : d.lines, mouse.x, d.y);
  };

  /* -------------------------------------------------------- selecting buildings */

  const showActions = () => {
    const b = selected && snap.buildings.find((q) => q.id === selected!.id);
    const r = selected && map.buildingScreenRect(selected.id);
    if (!selected || !b || !r || view.mode !== 'full') {
      if (selected && !b) selected = null;
      return actions.hide();
    }
    const list = buildingActions(b, selected.menu, (menu) => ((selected!.menu = menu), showActions()), () => select(null));
    if (selected.menu === 'main') list.push({ label: '✕', onClick: () => select(null) });
    actions.show(list, r.x + r.w / 2, r.y - 10);
  };

  type BuildingMenu = 'main' | 'demolish' | 'empty';
  /** What can be done with a building (for the action bar over it, or the phone's top card): its operator,
   *  emptying it, upgrading it, demolishing it (each through a little sub-menu). */
  const buildingActions = (b: Snapshot['buildings'][number], menu: BuildingMenu, setMenu: (m: BuildingMenu) => void, done: () => void): Action[] => {
    const doIt = () => {
      bridge.command({ type: 'demolish', building: b.id });
      done();
    };
    const held = MATERIALS.filter((m) => (b.store[m] ?? 0) > 0 && m !== 'totem'); // (the totem can't be thrown out)
    if (b.status === 'blueprint') return [{ label: 'Cancel blueprint', onClick: doIt, danger: true }];
    if (menu === 'demolish') return [{ label: 'Demolish (refund half)', onClick: doIt, danger: true }, { label: 'Keep', onClick: () => setMenu('main') }];
    if (menu === 'empty' && held.length) {
      const list: Action[] = held.map((m) => ({
        label: `Throw out ${MATERIAL_NAMES[m]} (${b.store[m]})`,
        onClick: () => bridge.command({ type: 'discardStock', building: b.id, material: m }),
        danger: true,
      }));
      list.push({ label: 'Back', onClick: () => setMenu('main') });
      return list;
    }
    const list: Action[] = [];
    // (the shaft: down into the Deep, sim/deep.ts)
    if (b.def === 'deep_shaft' && snap.deep)
      list.push({
        label: 'Go down into the Deep',
        onClick: () => {
          bridge.command({ type: 'watchDeep', depth: snap!.deep!.levels.length });
          done();
        },
      });
    // (a portal: look through it into the realm beyond, sim/portals.ts)
    const realm = snap.portals.find((p) => p.building === b.id);
    if (realm)
      list.push({
        label: `Look through into ${realm.name}`,
        onClick: () => {
          bridge.command({ type: 'watchPortal', realm: realm.realm });
          done();
        },
      });
    const role = OPERATORS[b.def];
    if (role) {
      const who = snap.people.find((p) => p.id === b.operator);
      list.push({ label: `${role.title}: ${who ? who.name : 'nobody'} ↻`, onClick: () => bridge.command({ type: 'cycleOperator', building: b.id }) });
    }
    if (held.length) list.push({ label: 'Empty…', onClick: () => setMenu('empty') });
    // upgrade in place, once the next step is researched (the sim says why if there's no room)
    const next = UPGRADES[b.def] && BUILDING_BY_ID[UPGRADES[b.def]];
    if (next && (snap.unlockAll || !next.research || snap.research.done.includes(next.research)) && eraReached(snap.era, TOPIC_BY_ID[next.research ?? '']?.era)) {
      list.push({
        label: `Upgrade to ${next.name}`,
        onClick: () => {
          bridge.command({ type: 'upgrade', building: b.id });
          done();
        },
      });
    }
    list.push({ label: 'Demolish…', onClick: () => setMenu('demolish') });
    return list;
  };

  /* -------------------------------------------------------- the phone's top card */

  // On the phone a tap selects rather than acts: what's selected is shown, with its buttons, in the card at the top
  // of the screen. Marking land for gathering waits for the card's "Gather here" (so a stray tap never sets
  // anyone clearing a forest), and buildings' options live there instead of in a bar over the building.
  let inspected: Hover = null;
  let inspectMenu: BuildingMenu = 'main';
  let inspectKey = '';
  const inspectRuns = new Map<string, () => void>();
  const inspectTarget = (h: Hover) => {
    inspected = h && h.kind !== 'scenery' ? h : null;
    inspectMenu = 'main';
    publishInspect();
    refreshHover();
  };
  const publishInspect = () => {
    if (!phone) return;
    const info = inspected ? inspectInfo(inspected) : null;
    if (inspected && !info) inspected = null; // (it's gone: walked off, demolished, left town)
    const key = JSON.stringify(info);
    if (key === inspectKey) return;
    inspectKey = key;
    bridge.inspect?.(info);
  };
  const inspectInfo = (h: NonNullable<Hover>): InspectInfo | null => {
    inspectRuns.clear();
    const act = (id: string, label: string, run: () => void, extra: { danger?: boolean; primary?: boolean } = {}) => {
      inspectRuns.set(id, run);
      return { id, label, ...extra };
    };
    const d = describe(h);
    if (!d) return null;
    switch (h.kind) {
      case 'cell': {
        // (the town decides what to build and where to gather now: the card says what it's up to here)
        if (!wildCell(h.cell)) return { title: d.title, lines: ['Open ground: the town builds here when it needs to.'], actions: [act('plan', 'Town plan…', () => bridge.openPanel('build'))] };
        return {
          title: d.title,
          lines: [...d.lines, isMarked(snap.land, h.cell) ? 'The town is gathering here, and will clear the land.' : 'The town will gather here when it needs what grows here, or the room.'],
          actions: [],
        };
      }
      case 'building': {
        const b = snap.buildings.find((q) => q.id === h.id);
        if (!b) return null;
        const list = buildingActions(b, inspectMenu, (m) => ((inspectMenu = m), publishInspect()), () => inspectTarget(null));
        const actions = list.map((a, i) => act(`b${i}`, a.label, a.onClick, { danger: a.danger }));
        const venue = venuePanel(b.def);
        if (venue && inspectMenu === 'main') actions.unshift(act('venue', 'Look inside…', () => bridge.openPanel(venue), { primary: true }));
        return { title: d.title, lines: d.lines, actions };
      }
      case 'person': {
        const v = snap.visitor;
        if (v && v.id === h.person.id) {
          return {
            title: d.title,
            lines: [...d.lines, bestSkills(v), ...(v.cls ? [`${v.clsName}, level ${v.level}`] : [])],
            // (the town lets newcomers in itself, when there's a bed for them)
            actions: [act('more', 'More…', () => bridge.openPanel('townsfolk'))],
          };
        }
        const traveller = snap.travellers.find((q) => q.id === h.person.id);
        if (traveller) return { title: d.title, lines: d.lines, actions: [act('venue', traveller.venue === 'tavern' ? 'The tavern…' : 'The shop…', () => bridge.openPanel(traveller.venue), { primary: true })] };
        const p = snap.people.find((q) => q.id === h.person.id);
        if (!p) return null;
        const lines = [p.doing, ...p.detail];
        if (poolSize(p.carrying) > 0) lines.push(`Carrying ${listStock(p.carrying)}`);
        if (p.bleedMinutes !== null) lines.push(`Bleeding out: ${bleedLeft(p.bleedMinutes)} left!`);
        if (p.coins !== null) lines.push(`${p.coins} coins`);
        if (p.recent.length) lines.push(`Lately: ${p.recent.slice(0, 2).join('; ')}`);
        lines.push(`Health ${Math.round(p.hp)}/${p.maxHp} · Morale ${Math.round(p.morale)} · Food ${Math.round(p.needs.food * 100)}% · Rest ${Math.round(p.needs.rest * 100)}%`);
        lines.push(`${p.natureName} · ${p.clsName ? `${p.clsName} · Lv ${p.level}` : p.typeName} · ${p.ageYears} years${p.elder ? ', an elder' : ''} · ${bestSkills(p)}`);
        // in a fight: rally them (a burst of courage), when the town's rally is ready
        if (p.rally === 'on') lines.unshift('Rallied: fighting like ten!');
        else if (p.rally === 'wait') lines.unshift(`Rally again in ${snap.rallyIn}s`);
        const rallyAct = p.rally === 'ready' ? [act('rally', 'Rally!', () => bridge.command({ type: 'rally', person: p.id }), { primary: true })] : [];
        // follow them: the camera keeps them in view, and their big moments come as phone alerts
        const following = snap.hero === p.id;
        const followAct = act('follow', following ? 'Stop following' : 'Follow', () => bridge.command({ type: 'follow', person: following ? null : p.id }));
        if (following) lines.unshift('You follow their story: their big moments come as phone alerts.');
        // out on the land, fighting a band: watch it on the fight screen
        const fight = snap.skirmishes.find((k) => !k.over && k.who.includes(p.name));
        const watchAct = fight ? [act('watch', 'Watch the fight', () => bridge.command({ type: 'watch', expedition: fight.id }), { primary: true })] : [];
        if (fight) lines.unshift(`Fighting ${fight.foe} out on the land!`);
        return { title: d.title, lines, actions: [...watchAct, ...rallyAct, followAct, act('more', 'Townsfolk…', () => bridge.openPanel('townsfolk'))] };
      }
      case 'place': {
        const p = snap.places.find((q) => q.id === h.id);
        const actions = p?.dest ? [act('party', 'Bounty or forbid…', () => bridge.openPanel('expeditions'), { primary: true })] : p?.mine ? [act('enter', 'Enter the mine', () => bridge.command({ type: 'watchMine', place: p.id }), { primary: true })] : [];
        return { title: d.title, lines: d.lines, actions };
      }
      case 'roamer': {
        const r = snap.roamers.find((q) => q.id === h.id);
        const watch = r?.skirmish != null ? [act('watch', 'Watch the fight', () => bridge.command({ type: 'watch', expedition: r.skirmish }), { primary: true })] : [];
        return { title: d.title, lines: d.lines, actions: watch };
      }
      case 'grave':
        return { title: d.title, lines: d.lines, actions: [act('annals', 'The fallen…', () => bridge.openPanel('journal'))] };
      case 'village': {
        const v = snap.villages.find((q) => q.id === h.id);
        return {
          title: d.title,
          lines: d.lines,
          actions: [act('villages', 'The villages…', openVillages, { primary: true }), ...(v ? [act('gift', 'Send a gift', () => bridge.command({ type: 'giftVillage', id: v.id }))] : [])],
        };
      }
      case 'pet':
        return { title: d.title, lines: d.lines, actions: [act('scratch', 'Scratch behind the ears', () => (pets.scratch(h.key), publishInspect()), { primary: true })] };
      case 'caravan':
        return { title: d.title, lines: d.lines, actions: [act('trade', 'Trade…', () => bridge.openPanel('trade'), { primary: true })] };
      case 'pane':
        return { title: d.title, lines: d.lines, actions: [act('board', 'Expedition Board…', () => bridge.openPanel('expeditions'))] };
      default:
        return { title: d.title, lines: d.lines, actions: [] };
    }
  };
  /** Someone's two or three best skills, for their card. */
  const bestSkills = (p: { skills: Snapshot['people'][number]['skills'] }) =>
    'Best at ' +
    SKILLS.map((k) => [k, p.skills[k].level] as const)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, n]) => `${SKILL_NAMES[k]} ${n}`)
      .join(', ');
  bridge.onInspectAction?.((id) => {
    if (id === 'close') return inspectTarget(null);
    inspectRuns.get(id)?.();
    publishInspect();
  });

  const select = (id: number | null) => {
    selected = id === null ? null : { id, menu: 'main' };
    if (id !== null) selectPerson(null);
    showActions();
    refreshHover();
  };

  /* -------------------------------------------------------- selecting people */

  const personCard = createPersonCard(
    () => bridge.openPanel('townsfolk'),
    () => selectPerson(null),
  );

  const showPersonCard = () => {
    const p = selectedPerson !== null ? snap.people.find((q) => q.id === selectedPerson) : undefined;
    const at = selectedPerson !== null ? people.posOf(selectedPerson) : null;
    if (!p || at === null || view.mode !== 'full') {
      if (selectedPerson !== null && !p) selectedPerson = null;
      return personCard.hide();
    }
    personCard.show(p, p.id === snap.mainId, map.screenOf(at.x, at.y).x);
  };

  const selectPerson = (id: number | null) => {
    selectedPerson = id;
    if (id !== null && selected) {
      selected = null;
      actions.hide();
    }
    showPersonCard();
    refreshHover();
  };

  // (the feed's "Show on the map": look at someone or something and open its card: mobile/feed.ts)
  (window as unknown as { __showRecap?: () => boolean }).__showRecap = () => raidRecap.open();
  (window as unknown as { __centre?: (x: number, y: number) => void }).__centre = (x, y) => camera.centreOn({ x, y }, app.screen.width, app.screen.height); // (previews)
  (window as unknown as { __showOnMap?: (a: { person?: number; building?: number; traveller?: number; village?: number }) => boolean }).__showOnMap = (a) => {
    // (a daughter village: its fire)
    const vil = a.village != null ? snap.villages.find((q) => q.id === a.village) : undefined;
    if (vil) {
      camera.centreOn({ x: (vil.x + 1) * CELL, y: (vil.y + 1) * CELL }, app.screen.width, app.screen.height);
      if (phone) inspectTarget({ kind: 'village', id: vil.id });
      return true;
    }
    // (a stranger passing through: the traveller as the map draws them)
    const tr = a.traveller != null ? snap.travellers.find((q) => q.id === a.traveller) : undefined;
    if (tr) {
      camera.centreOn({ x: tr.x, y: tr.y ?? 0 }, app.screen.width, app.screen.height);
      if (phone) inspectTarget({ kind: 'person', person: travellerPerson(tr) });
      return true;
    }
    const p = a.person != null ? snap.people.find((q) => q.id === a.person) : undefined;
    const b = a.building != null ? snap.buildings.find((q) => q.id === a.building) : undefined;
    const at = p ? people.posOf(p.id) ?? { x: p.x, y: p.y } : b ? { x: (b.tile + 1) * CELL, y: (b.row + 1) * CELL } : null;
    if (!at) return false;
    camera.centreOn(at, app.screen.width, app.screen.height);
    if (phone) inspectTarget(p ? { kind: 'person', person: p } : { kind: 'building', id: b!.id });
    return true;
  };

  /** The Town menu's Villages tab (panel/villagesPanel.ts), asked for through the storage the frames share. */
  const openVillages = () => {
    try {
      localStorage.setItem('littletown.subtab.build', 'Villages');
    } catch {}
    bridge.openPanel('build');
  };

  /* -------------------------------------------------------- placing buildings */

  const checkPlacement = (def: BuildingDef, x: number, y: number): PlaceCheck => {
    if (!isUnlocked({ unlockAll: snap.unlockAll, done: snap.research.done }, def)) return { ok: false, reason: 'Not researched yet' };
    if (blueprintCount(snap) >= snap.buildSlots) return { ok: false, reason: 'Construction queue is full' };
    return canPlace({ land: snap.land, buildings: snap.buildings, origin: snap.origin.id, era: snap.era }, def, x, y);
  };

  const updateGhost = () => {
    if (!placing) return;
    if (!mouse || mouse.target instanceof Element && mouse.target.closest('[data-hit]')) {
      map.hideGhost();
      tip.hide();
      return;
    }
    const { def } = placing;
    const w = map.worldOf(mouse.x, mouse.y);
    const at = map.placementCell(w.x, w.y, def.id);
    placing.x = at.x;
    placing.y = at.y;
    placing.check = checkPlacement(def, at.x, at.y);
    map.showGhost(def.id, at.x, at.y, placing.check.ok);
    canvas.style.cursor = placing.check.ok ? 'copy' : 'not-allowed';
    if (placing.check.ok) tip.hide();
    else tip.show("Can't build here", [placing.check.reason ?? ''], mouse.x, mouse.y - 16);
  };

  const startPlacing = (defId: string) => {
    const def = BUILDING_BY_ID[defId];
    if (!def) return;
    select(null);
    placing = { def, x: 0, y: 0, check: { ok: false } };
    banner.show(`Placing: ${def.name}`, coarse() ? 'Tap where it goes, then tap it again to build · long-press to cancel' : 'Click to place · right-click to cancel');
    refreshHover();
  };

  const stopPlacing = () => {
    placing = null;
    armedCell = null;
    banner.hide();
    map.hideGhost();
    tip.hide();
    refreshHover();
  };
  bridge.onPlacement(startPlacing);

  /* -------------------------------------------------------- clicks */

  /** On a touch screen the first tap only shows where the building would go; a second tap there builds it. */
  let armedCell: string | null = null;
  const click = (x: number, y: number, touch = false) => {
    if (placing) {
      updateGhost();
      const key = `${placing.x},${placing.y}`;
      const confirmed = !touch || armedCell === key;
      armedCell = key;
      if (placing.check.ok && confirmed) {
        bridge.command({ type: 'placeBuilding', def: placing.def.id, x: placing.x, y: placing.y });
        stopPlacing();
      }
      return;
    }
    if (battleTap(x, y)) return;
    const h = hitTest(x, y);
    // the shop or tavern (or a stranger on their way to one) opens its bird's-eye window
    const tapped = h?.kind === 'person' ? snap.travellers.find((t) => t.id === h.person.id) : undefined;
    const venue = h?.kind === 'building' ? venuePanel(snap.buildings.find((b) => b.id === h.id)?.def ?? '') : tapped ? (tapped.line ? storePanel(tapped.line) : tapped.venue) : undefined;
    if (venue) bridge.openPanel(venue);
    if (phone) return inspectTarget(h); // (the phone's top card shows it, and holds its buttons)
    if (tapped) return;
    if (h?.kind === 'pane') return bridge.openPanel('expeditions');
    if (h?.kind === 'place') {
      const p = snap.places.find((q) => q.id === h.id);
      if (p?.dest) return bridge.openPanel('expeditions');
      if (p?.mine) return bridge.command({ type: 'watchMine', place: p.id });
      return;
    }
    if (h?.kind === 'caravan') return bridge.openPanel('trade');
    if (h?.kind === 'village') return openVillages();
    if (h?.kind === 'pet') return pets.scratch(h.key);
    if (h?.kind === 'person') {
      if (snap.visitor?.id === h.person.id) return bridge.openPanel('townsfolk');
      return selectPerson(selectedPerson === h.person.id ? null : h.person.id);
    }
    if (h?.kind === 'building') return select(selected?.id === h.id ? null : h.id);
    // (a click on land just closes any card: the town decides where to gather now)
    select(null);
    selectPerson(null);
  };

  window.addEventListener('mousemove', (e) => {
    mouse = { x: e.clientX, y: e.clientY, target: e.target };
    refreshHover();
  });
  document.documentElement.addEventListener('mouseleave', () => {
    mouse = null;
    refreshHover();
  });
  window.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (placing) stopPlacing();
    else if (selected) select(null);
    else if (selectedPerson !== null) selectPerson(null);
  });

  /* -------------------------------------------------------- scrolling */

  window.addEventListener(
    'wheel',
    (e) => {
      if (!hover && !placing && !snap.battle) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerWidth : 1;
      // (a plain wheel scrolls the map up and down; with shift, or a sideways wheel, across)
      if (e.shiftKey && !e.deltaX) camera.scrollBy(e.deltaY * unit * WHEEL_SPEED, 0);
      else camera.scrollBy(e.deltaX * unit * WHEEL_SPEED, e.deltaY * unit * WHEEL_SPEED);
    },
    { passive: true },
  );

  canvas.style.touchAction = 'none'; // (on a phone, drags scroll the town, not the page)
  // Two fingers pinching the town zoom it in and out (on the phone: the page around the strip does the zooming).
  const touches = new Map<number, { x: number; y: number }>();
  let pinchFrom: number | null = null; // how far apart the fingers were when the pinch began
  let afterPinch = false; // a finger still down after a pinch: nothing else starts until it lifts
  const spread = () => {
    const [a, b] = [...touches.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };
  const between = (): [number, number] => {
    const [a, b] = [...touches.values()];
    return [(a.x + b.x) / 2, (a.y + b.y) / 2];
  };
  // (in a battle, taps place fighters and aim spells; drags scroll the map as ever)
  const battleTap = (x: number, y: number): boolean => {
    const b = snap.battle;
    if (!b) return false;
    if (battle.aiming) {
      const at = battle.toMap(x, y);
      if (!at) return true;
      bridge.command({ type: 'battleCast', power: battle.aiming, x: at[0], y: at[1] });
      battleHud.aiming = battle.aiming = null;
      battle.lastAim = null;
      battleHud.update(b, snap.raid?.name ?? 'Raiders');
      return true;
    }
    const spot = battle.spotAt(x, y);
    const picked = battleHud.picked;
    if (spot === null) {
      if (picked === null) return false;
      battleHud.picked = battle.selectedPerson = null; // (a tap elsewhere puts them down again)
      battleHud.update(b, snap.raid?.name ?? 'Raiders');
      return true;
    }
    const on = b.units.find((u) => u.spot === spot);
    if (picked !== null) {
      // (their own spot again: off it)
      const mine = b.roster.find((r) => r.id === picked)?.spot === spot;
      bridge.command({ type: 'battlePlace', person: picked, spot: mine ? null : spot });
      battleHud.picked = battle.selectedPerson = null;
    } else if (on?.person !== null && on?.person !== undefined) {
      battleHud.picked = battle.selectedPerson = on.person; // (pick up who's there, to move them)
    } else return false;
    battleHud.update(b, snap.raid?.name ?? 'Raiders');
    return true;
  };
  // (a tactics battle has the screen: a tap is its, a drag looks about the board)
  let boardPress: { x: number; y: number; lx: number; ly: number; moved: boolean; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (tactics.shown || deep.shown) {
      boardPress = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId };
      return;
    }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && bridge.pinch) {
        // a second finger: this is a pinch, not a drag or a tap
        if (camera.dragging) camera.endDrag(e.timeStamp);
        press = null;
        pinchFrom = Math.max(20, spread());
        bridge.pinch('start', pinchFrom, ...between());
        return;
      }
      if (pinchFrom !== null || afterPinch) return;
    }
    if (e.pointerType !== 'mouse') {
      // a touch has no hover beforehand: hit-test where the finger lands
      mouse = { x: e.clientX, y: e.clientY, target: e.target };
      refreshHover();
    }
    // (a finger can drag the town from anywhere, sky included; on the desktop the sky is click-through)
    if ((!hover && !placing && !snap.battle && e.pointerType === 'mouse') || e.button !== 0) return; // (in a battle, any spot of ground may be tapped)
    press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if ((tactics.shown || deep.shown) && boardPress && e.pointerId === boardPress.id) {
      if (Math.hypot(e.clientX - boardPress.x, e.clientY - boardPress.y) >= DRAG_THRESHOLD) boardPress.moved = true;
      if (boardPress.moved) (deep.shown ? deep : tactics).pan(e.clientX - boardPress.lx, e.clientY - boardPress.ly);
      boardPress.lx = e.clientX;
      boardPress.ly = e.clientY;
      return;
    }
    if (battle.aiming) battle.lastAim = battle.toMap(e.clientX, e.clientY);
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchFrom !== null && touches.size >= 2) return bridge.pinch?.('move', Math.max(20, spread()), ...between());
    }
    if (!press || e.pointerId !== press.id) return;
    if (!camera.dragging && Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_THRESHOLD) {
      camera.beginDrag(press.x, press.y, e.timeStamp);
      canvas.style.cursor = 'grabbing';
      tip.hide();
    }
    camera.dragTo(e.clientX, e.clientY, e.timeStamp);
  });
  const release = (e: PointerEvent) => {
    if (boardPress && e.pointerId === boardPress.id) {
      const was = boardPress;
      boardPress = null;
      if (!was.moved && e.type === 'pointerup' && tactics.shown) tactics.tap(e.clientX, e.clientY);
      return;
    }
    touches.delete(e.pointerId);
    if (pinchFrom !== null && touches.size < 2) {
      bridge.pinch?.('end', 0);
      pinchFrom = null;
      afterPinch = true;
    }
    if (touches.size === 0) afterPinch = false;
    if (!press || e.pointerId !== press.id) return;
    const wasDrag = camera.dragging;
    camera.endDrag(e.timeStamp);
    press = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    mouse = { x: e.clientX, y: e.clientY, target: e.target };
    if (!wasDrag && e.type === 'pointerup') click(e.clientX, e.clientY, e.pointerType !== 'mouse');
    refreshHover();
  };
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  /* -------------------------------------------------------- mode and visibility */

  const applyState = (s: StripState) => {
    const modeChanged = s.mode !== view.mode;
    view = s;
    hud.apply(s);
    music.update(s.music && !s.hidden, snap.raid?.phase === 'active');
    canvas.hidden = s.mode !== 'full';
    // Nothing to draw in the slim ticker or while hidden, so stop the render loop entirely.
    if (s.mode === 'full' && !s.hidden) app.ticker.start();
    else app.ticker.stop();
    if (modeChanged) {
      // what was under the mouse just disappeared; wait for the next move to hit-test again
      mouse = null;
      press = null;
      if (s.mode !== 'full' && placing) stopPlacing();
      select(null);
      selectPerson(null);
      setInteractive(false);
      refreshHover();
    }
  };
  bridge.onState(applyState);
  applyState(await bridge.getState());

  /* -------------------------------------------------------- sim snapshots */

  // Each notice is shown once; ones from before this page loaded are skipped, and so are ones from a
  // catch-up after the PC slept (the "while you were away" report covers those).
  let lastNotice = first.notices.at(-1)?.id ?? 0;
  let lastAway = first.away?.id ?? 0;
  const showNotices = (next: Snapshot) => {
    const caughtUp = !!next.away && next.away.id > lastAway;
    if (next.away) lastAway = Math.max(lastAway, next.away.id);
    // (upright on the phone the feed above the town shows the news: the strip pops up only what the feed leaves out)
    const feedShown = document.body.classList.contains('feed-shown');
    if (!caughtUp) for (const n of next.notices) if (n.id > lastNotice && (!feedShown || CHATTER.test(n.text))) toasts.push(n.text);
    lastNotice = Math.max(lastNotice, next.notices.at(-1)?.id ?? 0);
  };

  let lastShake: number | null = null;
  let shakeUntil = 0;
  let lastCamp: { x: number; y: number } | null = null;
  let buildStyle = 'town';
  const applySnapshot = (next: Snapshot) => {
    // a raid's battle, while there is one: drawn over the town's map; the camera looks to the gate as it begins
    const begun = !!next.battle && !snap.battle;
    battle.update(next);
    battleHud.update(next.battle, next.raid?.name ?? 'Raiders');
    raidRecap.update(next);
    battle.selectedPerson = battleHud.picked;
    battle.aiming = battleHud.aiming;
    if (begun) {
      const g = battle.gate();
      if (g) camera.centreOn(g, app.screen.width, app.screen.height);
      select(null);
      selectPerson(null);
    }
    // (a raid's battle comes first: watching waits behind it)
    const watched = next.battle ? null : next.watch;
    // (the sea's looks for a shore town's trips, and for any party out in a boat)
    fight.update(watched, next.biome, next.calendar.season, next.origin.id === 'merfolk' || (!!watched?.boat && watched.phase !== 'work'));
    fightHud.update(watched);
    // (a mine gone into: the same screen, unless a fight or battle has it)
    const inMine = watched || next.battle ? null : next.mine;
    mine.update(inMine);
    fightHud.mine(inMine);
    // (the Deep looked into: the same, unless a fight, battle or mine has the screen)
    const below = watched || next.battle || inMine || next.tactics ? null : next.deepView;
    deep.update(below);
    // (a portal looked through: the same again)
    const beyond = watched || next.battle || inMine || below || next.tactics ? null : next.portalView;
    portal.update(beyond);
    tactics.update(next);
    // (a scene is offered only while nothing else has the screen: a battle, a watched fight, a question)
    cutscene.update(next.scene, next.era, !!(next.battle || next.raid || watched || inMine || below || beyond || next.tactics || next.prompts.length));
    map.root.visible = !watched && !inMine && !below && !beyond && !next.tactics && !cutscene.shown;
    showNotices(next);
    snap = next;
    hud.update(next);
    music.update(view.music && !view.hidden, next.raid?.phase === 'active');
    const freeze = next.doom?.kind === 'deep_freeze' && next.doom.phase === 'active';
    // (on the phone, heavy cloud dims the land a little)
    const gloom = fullSky ? ({ clear: 0, cloudy: 0.04, rain: 0.12, storm: 0.22, snow: 0.05, fog: 0.08 } as const)[next.weather.kind] : 0;
    map.setDaylight(next.calendar.daylight * (1 - gloom), freeze);
    map.setSun(next.calendar.hour + next.calendar.minute / 60, next.calendar.daylight * (1 - gloom));
    people.sunLean = Math.round(sunAt(next.calendar.hour + next.calendar.minute / 60, 1).skew * 5);
    map.smokeAmount = airFor(next.calendar.hour, next.calendar.season, next.weather.kind).smoke;
    map.weather = next.weather.kind;
    map.nightSky.cold = !!biomeById(next.biome).cold;
    map.nightSky.clear = next.weather.kind === 'clear';
    map.groundWeather.weather(next.tick, next.weather.kind);
    map.groundWeather.season = next.calendar.season;
    map.groundWeather.seasonDay = next.calendar.dayOfSeason;
    map.groundWeather.hour = next.calendar.hour;
    // the birds come down by day in fair enough weather; everyone about scares them off
    birds.on = next.calendar.daylight > 0.35 && next.weather.kind !== 'storm' && next.weather.kind !== 'snow' && !freeze;
    birds.winter = next.calendar.season === 'winter';
    birds.crowsOnly = buildStyle === 'lich' || buildStyle === 'vampire';
    butterflies.on = birds.on && (next.calendar.season === 'spring' || next.calendar.season === 'summer') && (next.weather.kind === 'clear' || next.weather.kind === 'cloudy') && !biomeById(next.biome).cold && !(biomeById(next.biome).dry && biomeById(next.biome).hot);
    butterflies.land = next.land;
    birds.land = next.land;
    birds.folk = [...next.people.filter((p) => p.away === null && !p.indoors), ...next.travellers, ...(next.raid?.phase === 'active' ? next.raid.raiders : [])].map((p) => ({ x: p.x, y: p.y }));
    // the wild beasts beyond the town: wolves by night, nothing while a raid is on or the land is frozen
    wildlife.folk = birds.folk;
    // the water's life and the sky's: ducks, fish, rain rings, lightning in a storm, a rainbow after the rain
    water.folk = birds.folk;
    water.land = next.land;
    water.weather = freeze ? 'snow' : next.weather.kind;
    water.daylight = next.calendar.daylight;
    water.winter = next.calendar.season === 'winter' || next.biome === 'tundra';
    // the pets: each home's, by who lives there
    {
      const residents = new Map<number, typeof next.people>();
      for (const p of next.people) if (p.bedId !== null) residents.set(p.bedId, [...(residents.get(p.bedId) ?? []), p]);
      const homes: PetHome[] = [];
      for (const b of next.buildings) {
        const folk = residents.get(b.id);
        if (!folk || b.status !== 'done' || b.room) continue;
        homes.push({ id: b.id, door: buildingDoor(b), name: folk[0].name.split(' ')[0], residents: folk.map((p) => p.id) });
      }
      graves.sync(next.annals.fallen, next.buildings, { x: (next.land.camp.x + 0.5) * CELL, y: (next.land.camp.y + 0.5) * CELL }, next.calendar.day, (x, y) => map.nearBuilding(x, y, 6) || !['grass', 'fertile', 'sand'].includes(groundAt(next.land, Math.floor(x / CELL), Math.floor(y / CELL))) || isRoad(next.land, Math.floor(x / CELL), Math.floor(y / CELL)));
      pets.land = next.land;
      pets.people = buildStyle;
      pets.night = next.calendar.daylight < 0.25;
      pets.raid = next.raid?.phase === 'active';
      pets.sync(
        homes,
        next.people.filter((p) => p.away === null && !p.indoors).map((p) => ({ id: p.id, x: p.x, y: p.y })),
        next.raid?.phase === 'active' ? next.raid.raiders.filter((r) => !r.ally).map((r) => ({ x: r.x, y: r.y })) : [],
      );
    }
    sky.mix = skyFor({ weather: freeze ? 'storm' : next.weather.kind, season: freeze ? 'winter' : next.calendar.season, biome: next.biome, hour: next.calendar.hour, daylight: next.calendar.daylight, spell: next.calendar.day * 4 + Math.floor(next.calendar.hour / 6) });
    sky.night = next.calendar.daylight < 0.3;
    dragon.sync(next.dragon);
    tracks.land = next.land;
    tracks.season = freeze ? 'winter' : next.calendar.season;
    tracks.biome = next.biome;
    tracks.weather = freeze ? 'snow' : next.weather.kind;
    tracks.daylight = next.calendar.daylight;
    tracks.sync([
      // (the dead and the machines leave prints but have no breath)
      ...next.people.filter((p) => p.away === null && !p.indoors && !p.swimming).map((p) => ({ id: 'p' + p.id, x: p.x, y: p.y, cold: !!p.tireless })),
      ...next.travellers.map((t, i) => ({ id: 't' + (t.id ?? i), x: t.x, y: t.y })),
      ...(next.raid?.phase === 'active' ? next.raid.raiders.filter((r) => !r.swimming).map((r) => ({ id: 'r' + r.id, x: r.x, y: r.y })) : []),
      ...wildlife.walkers(),
    ]);
    // what the land sounds like now: the beds and the calls from the view, the work in it panned by where it is
    {
      const v = map.view;
      const land = next.land;
      let cells = 0;
      let wet = 0;
      let wood = 0;
      let sea = false;
      const icy = freezes(freeze ? 'winter' : next.calendar.season, next.biome);
      for (let cy = Math.max(0, Math.floor(v.y / CELL)); cy <= Math.min(land.h - 1, Math.floor((v.y + v.h) / CELL)); cy += 2)
        for (let cx = Math.max(0, Math.floor(v.x / CELL)); cx <= Math.min(land.w - 1, Math.floor((v.x + v.w) / CELL)); cx += 2) {
          const g = groundAt(land, cx, cy);
          cells++;
          // (iced water is silent)
          if (g === 'shallows' || (g === 'water' && !(icy && iceAt((x, y) => x >= 0 && y >= 0 && x < land.w && y < land.h && groundAt(land, x, y) === 'water', cx, cy)))) wet++;
          if (g === 'forest') wood++;
        }
      sea = next.biome === 'coast' || next.theme === 'merfolk';
      const campIn = next.camp.x * CELL > v.x && next.camp.x * CELL < v.x + v.w && next.camp.y * CELL > v.y && next.camp.y * CELL < v.y + v.h;
      ambMix = ambientMix({
        daylight: next.calendar.daylight,
        season: next.calendar.season,
        weather: freeze ? 'snow' : next.weather.kind,
        biome: next.biome,
        water: cells ? wet / cells : 0,
        forest: cells ? wood / cells : 0,
        sea,
        blighted: buildStyle === 'lich' || buildStyle === 'vampire',
        raid: next.raid?.phase === 'active',
        fire: campIn,
      });
      // (a sandstorm or a blizzard howls)
      ambMix.wind = Math.max(ambMix.wind, sky.mix.sand, sky.mix.blizzard);
      const raidNow = next.raid?.phase === 'active';
      if (raidNow && !wasRaid) ambience.cue('horn', 0, 0.2);
      wasRaid = raidNow;
      // (each worker in view swings about every second; a few at most, the nearest the middle first)
      let n = 0;
      for (const p of next.people) {
        if (n >= 3 || p.away !== null || p.indoors) continue;
        const kind = p.activity === 'chop' ? 'chop' : p.activity === 'mine' ? 'mine' : p.activity === 'build' ? 'build' : null;
        if (!kind || p.x < v.x || p.x > v.x + v.w || p.y < v.y || p.y > v.y + v.h) continue;
        n++;
        if (Math.random() < 0.09) ambience.cue(kind, ((p.x - v.x) / Math.max(1, v.w)) * 1.6 - 0.8);
      }
      if (water.count > 0 && Math.random() < 0.012) ambience.cue('quack', Math.random() * 1.2 - 0.6);
      // (boots crunching in the snow, feet sucking in the mud: a few of the steps laid, panned by where they fell)
      let heard = 0;
      for (const st of tracks.takeSteps()) {
        if (heard >= 3 || st.ground === 'sand' || Math.random() > 0.5) continue;
        heard++;
        ambience.cue(st.ground === 'snow' ? 'crunch' : 'squelch', st.x * 1.6 - 0.8, Math.random() * 0.1);
      }
    }
    wildlife.land = next.land;
    wildlife.on = !freeze && next.weather.kind !== 'storm' && !(next.raid?.phase === 'active');
    wildlife.night = next.calendar.daylight < 0.3;
    wildlife.season = next.calendar.season;
    wildlife.biome = next.biome;
    wildlife.blighted = buildStyle === 'lich' || buildStyle === 'vampire';
    snow.on = freeze || (fullSky && next.weather.kind === 'snow');
    // autumn leaves on the wind, in fair weather
    leaves.on = next.calendar.season === 'autumn' && (next.weather.kind === 'clear' || next.weather.kind === 'cloudy') && !freeze;
    snow.heavy = freeze && !!next.doom?.cold;
    pane.setDaylight(next.calendar.daylight);
    // (the phone page's feed borrows the town's pictures: a townsperson, or a building in the town's own style, as the
    // map draws it: the pack's picture where there is one, else the top-down painter's)
    hkKnow(next.people); // (who's who, for the views that know someone only by id: the fight screen, the mine)
    const cardArt = (id: string) => {
      const def = BUILDING_BY_ID[id];
      const seat = SEAT_STAGE[id];
      if (seat) return seatArt(seat.origin, seat.stage, def.width, depthOf(def), noTone, 'card');
      return packArt(id, def.width, buildStyle || 'town') ?? topDownArt(id, def.width, depthOf(def), noTone, 'card', buildStyle || 'town');
    };
    (window as unknown as { __picture?: (p: { person?: number; building?: string }) => HTMLCanvasElement | null }).__picture = (h) => {
      const who = h.person != null ? next.people.find((p) => p.id === h.person) : undefined;
      if (who) return personPicture(who);
      if (h.building && BUILDING_BY_ID[h.building]) return textureCanvas(cardArt(h.building).texture, 96, 64);
      return null;
    };
    const q = next.prompts[0];
    // (on the phone, a choice event has the whole screen: mobile/eventSheet.ts)
    if (q && view.mode === 'full' && !((q.kind === 'event' || q.kind === 'secret' || q.kind === 'saga' || q.kind === 'road' || q.kind === 'debrief' || q.kind === 'envoy' || q.kind === 'watch' || q.kind === 'dragon' || q.kind === 'evolve' || q.kind === 'refugees' || q.kind === 'village' || q.kind === 'council' || q.kind === 'trial' || q.kind === 'revolt') && (window as unknown as { __eventSheet?: boolean }).__eventSheet)) promptCard.show(q);
    else promptCard.hide();
    // (a question that needs an answer goes first; the report waits behind it)
    if (next.away && !q && view.mode === 'full')
      awayCard.show(next.away, (h) => {
        // the report card's pictures: the townsperson, or the building, in the town's own style
        const who = h.person != null ? next.people.find((p) => p.id === h.person) : undefined;
        if (who) return personPicture(who);
        if (h.building && BUILDING_BY_ID[h.building]) return textureCanvas(cardArt(h.building).texture, 96, 64);
        return null;
      });
    else awayCard.hide();
    if (next.gameOver) gameOver.show(next.gameOver.text, next.gameOver.won);
    // a boss roars or sweeps: the strip shakes (only for fresh moments, not ones from before a reload)
    if (next.bossShake !== lastShake) {
      if (lastShake !== null && next.tick - next.bossShake < 20) shakeUntil = performance.now() + SHAKE_MS;
      lastShake = next.bossShake;
    }
    // (the expedition pane beside the map is no longer shown, the owner's call: parties are watched full screen, and
    // listed on the feed and the Expeditions tab)
    const e = SHOW_PANE && !next.gameOver ? shownExpedition() : null;
    pane.show(view.mode === 'full' ? e : null);
    if (e && pane.visible && paneX < Infinity) expHeader.show(e, next.expeditions.length - 1, paneX, paneW);
    else expHeader.hide();
    // the buildings' style: the town's origin (and a nomad tribe's, once settled, its caravan city)
    const style = next.theme === 'nomads' && next.nomad?.settled ? 'nomads_city' : next.theme;
    if (style !== buildStyle) {
      buildStyle = style;
      map.setBuildingStyle(buildingTint(next.theme), style);
    }
    map.syncLand(next.land, next.calendar.season, next.biome, next.era); // (paints again only what changed)
    minimap.setLand(next.land, next.calendar.season);
    map.tick = next.tick;
    map.syncBuildings(next.villageBuildings.length ? [...next.buildings, ...next.villageBuildings] : next.buildings);
    map.workFx.sync(next.buildings, next.workingAt);
    map.workFx.syncBuilders(next.people.filter((p) => p.activity === 'build' && !p.indoors).map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir })));
    herds.update(next.buildings);
    boats.update(next.fleet, next.mooring);
    wagons.update(next.wagons);
    pools.sync(next.blood);
    debris.sync(next.debris);
    market.sync(next.market);
    decor.sync(next.buildings, next.calendar.season);
    lamps.sync(next.land, next.era);
    lamps.setDaylight(next.calendar.daylight);
    lamps.calm = map.calm;
    skiffs.on = next.calendar.daylight > 0.35 && next.weather.kind !== 'storm' && next.raid?.phase !== 'active';
    skiffs.era = next.era;
    skiffs.season = next.calendar.season;
    skiffs.land = next.land;
    traffic.on = skiffs.on && next.weather.kind !== 'snow';
    traffic.land = next.land;
    disaster.sync(next.disaster, next.land.w);
    map.festival.sync(next.gathering);
    map.syncCastle(next.castle ?? null, next.buildings);
    map.syncPlaces(next.places);
    map.syncBlight(next.blight ?? [], next.calamity?.heartAt ?? null);
    // (a tree with someone behind it, or a building's front, is drawn see-through)
    map.seeThrough([
      ...next.people.filter((p) => !p.indoors).map((p) => people.posOf(p.id) ?? p),
      ...(next.raid?.phase === 'active' ? next.raid.raiders : []).map((r) => raiders.posOf(r.id) ?? r),
      ...next.travellers,
    ]);
    // (a nomad tribe that moved camp: the view goes to the new camp)
    if (lastCamp !== null && (next.camp.x !== lastCamp.x || next.camp.y !== lastCamp.y)) camera.centreOn(next.camp, app.screen.width, app.screen.height);
    lastCamp = next.camp;
    people.moon = next.moonNight;
    people.theme = next.theme;
    people.weather = next.weather.kind;
    people.news = next.news;
    // a big moment (a new age, a wedding, a birth, the founder's death, the dragon): letterboxed, a title card
    if ((next.news?.id ?? -1) !== lastNewsId) {
      const first = lastNewsId === -2;
      lastNewsId = next.news?.id ?? -1;
      const m = !first && next.news ? momentOf(next.news.text) : null;
      if (m && next.raid?.phase !== 'active' && !next.watch && !cinema.busy() && document.getElementById('raid-recap')?.hidden !== false) {
        const who = m.who ? next.people.find((p) => p.name === m.who && p.away === null) : undefined;
        const show = (window as unknown as { __showOnMap?: (a: { person?: number }) => boolean }).__showOnMap;
        cinema.show(m, who && show ? () => void show({ person: who.id }) : null);
      }
    }
    people.land = next.land;
    herds.grazing = next.calendar.hour >= 8 && next.calendar.hour < 18 && next.calendar.season !== 'winter' && next.weather.kind !== 'storm' && next.weather.kind !== 'rain' && !next.raid;
    people.season = next.calendar.season;
    people.hour = next.calendar.hour;
    people.raid = !!next.raid && next.raid.phase === 'active';
    people.zoom = stripScale; // (the phone page's scale: bubbles stay readable)
    people.weave = next.research.done.includes('weaving');
    people.founderId = next.mainId;
    publishInspect(); // (the phone's top card keeps up with what it shows)
    weather?.update(next.calendar, next.weather);
    people.revived = next.revived ? { ...next.revived, at: performance.now() } : null;
    people.fx = next.fx.map((f) => ({ ...f, at: performance.now() }));
    people.update(
      [...next.people.filter((p) => p.away === null), ...next.travellers.map(travellerPerson), ...(next.envoyRider ? [envoyPerson(next.envoyRider)] : []), ...villagerFigures(next, performance.now())],
      next.visitor,
      performance.now(),
    );
    raiders.update(next.raid?.phase === 'active' ? next.raid.raiders : [], performance.now());
    roamers.update(roamerFigures(next.roamers), performance.now());
    spells.update(next.spells, next.camp, performance.now());
    if (hover || placing) refreshHover(); // tooltip contents change as work progresses
    if (selected) showActions();
    if (selectedPerson !== null) showPersonCard();
  };
  bridge.onSnapshot(applySnapshot);
  applySnapshot(first);

  /* -------------------------------------------------------- frame loop */

  let viewW = 0;
  let viewH = 0;
  // The page zooms the strip about the point between the fingers (mobile.ts): once the strip is laid out again at
  // the new scale, the view is moved so what was under the fingers stays there (mx, my: the point in the strip's old
  // pixels; from, to: the scales the strip was and is shown at). The resize below keeps the middle still; this is the
  // rest, for a point off the middle.
  Object.assign(window, {
    __zoomAbout: (mx: number, my: number, from: number, to: number) => camera.shift((mx - viewW / 2) * (1 - from / to), (my - viewH / 2) * (1 - from / to)),
  });
  app.ticker.add((ticker) => {
    const w = layoutSplit(); // the town's share of the width
    // zoomed (the strip got wider or narrower): keep the middle of the view where it was
    const h = app.screen.height;
    if (w !== viewW || h !== viewH) {
      if (viewW) camera.shift((viewW - w) / 2, (viewH - h) / 2);
      viewW = w;
      viewH = h;
    }
    // (the camera follows nobody, the hero and the raid's lead raider included: the owner found it jumping about;
    // it moves only when the player moves it, or once to the gate as a battle begins)
    const moving = camera.update(ticker.deltaMS / 1000, w, h);
    map.setCamera(camera.x, camera.y, w, h);
    // screen shake (a boss's roar or sweeping attack)
    const shaking = performance.now() < shakeUntil;
    app.stage.position.set(shaking ? Math.round((Math.random() - 0.5) * 6) : 0, shaking ? Math.round((Math.random() - 0.5) * 4) : 0);
    people.render(performance.now());
    raiders.render(performance.now());
    herds.render(performance.now(), ticker.deltaMS / 1000);
    market.render(ticker.deltaMS / 1000);
    lamps.render(ticker.deltaMS / 1000);
    skiffs.render(ticker.deltaMS / 1000, map.view, map.calm);
    traffic.render(ticker.deltaMS / 1000, map.view, map.calm);
    boats.render(performance.now());
    birds.render(ticker.deltaMS / 1000, performance.now());
    wildlife.render(ticker.deltaMS / 1000, performance.now());
    water.render(ticker.deltaMS / 1000);
    tracks.render(ticker.deltaMS / 1000);
    if (snap && minimap.shown)
      minimap.render({
        people: snap.people.filter((p) => p.away === null).map((p) => ({ x: p.x, y: p.y })),
        raiders: snap.raid?.phase === 'active' ? snap.raid.raiders.map((r) => ({ x: r.x, y: r.y })) : [],
        places: snap.places.filter((p) => p.found).map((p) => ({ x: p.x, y: p.y, waiting: !!p.dest, nest: !!p.nest })),
        heart: snap.calamity?.heartAt ? { x: (snap.calamity.heartAt.x + 0.5) * 32, y: (snap.calamity.heartAt.y + 0.5) * 32 } : null,
        buildings: [...snap.buildings, ...snap.villageBuildings].map((b) => {
          const r = footprintOf(b);
          return { x: r.x * CELL, y: r.y * CELL, w: r.w * CELL, h: r.h * CELL };
        }),
        view: map.view,
      });
    // the region under the middle of the view: its name shown a few seconds when it changes
    if (snap) {
      const v = map.view;
      const r = regionOfCell(snap.land, Math.floor((v.x + v.w / 2) / CELL), Math.floor((v.y + v.h / 2) / CELL));
      const name = r ? regionTitle(r) : '';
      const now = performance.now();
      if (name !== regionShown) {
        regionShown = name;
        regionCaption.textContent = name;
        regionCaption.hidden = !name;
        regionCaption.classList.remove('fade');
        regionHideAt = now + 3200;
      } else if (regionHideAt && now > regionHideAt) {
        regionCaption.classList.add('fade');
        regionHideAt = 0;
      }
    }
    pets.render(ticker.deltaMS / 1000);
    dragon.render(ticker.deltaMS / 1000);
    sky.render(ticker.deltaMS / 1000, app.screen.width, app.screen.height);
    if (ambMix) ambience.update(view.music && !view.hidden, ambMix, ticker.deltaMS / 1000);
    butterflies.render(ticker.deltaMS / 1000, performance.now());
    map.renderPlaces(performance.now());
    map.renderAir(ticker.deltaMS / 1000);
    disaster.render(ticker.deltaMS / 1000);
    spells.render(performance.now());
    snow.render(performance.now(), ticker.deltaMS / 1000, w);
    leaves.render(performance.now(), ticker.deltaMS / 1000, w);
    weather?.render(performance.now(), w, app.screen.height);
    pane.render(performance.now(), ticker.deltaMS / 1000);
    if (battle.shown) battle.render(performance.now());
    if (fight.shown) {
      fight.resize(app.screen.width, app.screen.height, ...fightHud.insets());
      fight.render(performance.now(), ticker.deltaMS / 1000);
    }
    if (tactics.shown) {
      tactics.resize(app.screen.width, app.screen.height);
      tactics.render(performance.now());
    }
    if (mine.shown) {
      mine.resize(app.screen.width, app.screen.height, ...fightHud.insets());
      mine.render(performance.now(), ticker.deltaMS / 1000);
    }
    if (deep.shown) {
      const sideways = app.screen.width > app.screen.height;
      deep.resize(app.screen.width, app.screen.height, DEEP_TOP, sideways ? 0 : DEEP_BOTTOM, sideways ? DEEP_SIDE : 0);
      deep.render(performance.now(), ticker.deltaMS / 1000);
    }
    if (cutscene.shown) {
      cutscene.resize(app.screen.width, app.screen.height);
      cutscene.render(performance.now(), ticker.deltaMS / 1000);
    }
    // the art under a still mouse changes while the camera moves
    if (moving) {
      refreshHover();
      if (selected) showActions();
    }
    if (selectedPerson !== null) showPersonCard(); // follow them as they walk
    app.ticker.maxFPS = interactive || moving || battle.shown || fight.shown || mine.shown || deep.shown || tactics.shown ? FPS_ACTIVE : FPS_IDLE;
  });
}


start().catch((err) => console.error('strip failed to start', err));

/** A townsperson's picture for the feed, the event box and the report card: as the map draws them, in their Himeko
 *  look (art/hkFolk.ts), standing facing us. Until the layers load it holds their old look, and is painted over in
 *  place when they come (the cards keep the canvas they were given). */
function personPicture(who: PersonView): HTMLCanvasElement {
  const hc = document.createElement('canvas');
  hc.width = hc.height = 64;
  const g = hc.getContext('2d')!;
  const keys = hkLayers(hkWhoOf(who), { fighting: false, activity: 'idle' });
  const paint = () => {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    if (!hkDraw(c.getContext('2d')!, keys, 0, 0, 32, 61, 50)) return false;
    g.clearRect(0, 0, 64, 64);
    g.drawImage(c, 0, 0);
    return true;
  };
  if (paint()) return hc;
  g.drawImage(textureCanvas(lpcFrame(who.look, 'walk', 0), 64, 64), 0, 0);
  onHkLoad(paint);
  return hc;
}
