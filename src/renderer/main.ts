// Strip renderer: draws the town and HUD, turns clicks into sim commands, and decides when the strip
// should capture the mouse.

import { applyGivenNames } from './art/givenNames';
import { guildsOf } from './art/guildMarks';
import { withDeltas } from './deltaBridge';
import { biomeById } from '../shared/data/biomes';
import { folkKnow, paintPortrait } from './art/folkPortrait';
import { setFolkFounder } from './iso/folkWho';
import { findFounderArt } from './iso/founderArt';
import { hkCell, hkDraw, hkKnow, hkLayers, hkWhoOf, onHkLoad } from './art/hkFolk';
import { fallenFace } from './art/fallenFace';
import { SEAT_STAGE } from '../shared/data/seats';
import { CHATTER } from './chatter';
import { MapBattle } from './map/mapBattle';
import { MapSpells } from './map/mapSpells';
import { MapHerds } from './map/mapHerds';
import { MapBoats } from './map/mapBoats';
import { MapAirships } from './map/mapAirships';
import { MapWagons } from './map/mapWagons';
import { MapBirds } from './map/mapBirds';
import { MapScenes } from './map/mapScenes';
import { MapWildlife } from './map/mapWildlife';
import { MapTracks } from './map/mapTracks';
import { Minimap } from './map/minimap';
import { inRegion, regionTitle } from '../shared/sim/landRegions';
import { footprint as footprintOf } from '../shared/sim/buildings';
import { regionOfCell } from '../shared/sim/land';
import { MapDragon } from './map/mapDragon';
import { MapCreature } from './map/mapCreature';
import { SHEETS, type CreatureSheet, type SheetDef } from './art/creatureSheets';
import { creatureCard } from './map/creatureCard';
import { MapSky, skyFor } from './map/mapSky';
import { MapPets, type PetHome } from './map/mapPets';
import { freezes, iceAt } from './map/ice';
import { MapWater } from './map/mapWater';
import { MapButterflies } from './map/mapButterflies';
import { MapCritters } from './map/mapCritters';
import { GroundFrost } from './map/groundFrost';
import { WideWorld } from './map/wideWorld';
import type { CourierView } from './map/mapCourier';
import { BattleDebris } from './map/battleDebris';
import { MapGraves } from './map/mapGraves';
import { sunAt } from './art/sun';
import { MapMarket } from './map/mapMarket';
import { SeasonDecor } from './map/seasonDecor';
import { MapFelling } from './map/mapFelling';
import { MapGains } from './map/mapGains';
import { MapChores } from './map/mapChores';
import { IsoView } from './iso/isoView';
import { kitNameFor } from './iso/isoKits';
import { finishedBetween, gainsBetween } from './map/workSeen';
import { HomeDecor } from './map/homeDecor';
import { Signposts } from './map/signposts';
import { MapRuins } from './map/mapRuins';
import { HomeSigns } from './map/homeSigns';
import { setStatueFolk } from './map/statueArt';
import { RUIN_HOURS, STATUE } from '../shared/data/memorials';
import type { Signpost } from './map/signRules';
import { plagueOn } from '../shared/sim/pastimes';
import { StreetLamps } from './map/streetLamps';
import { LightMap } from './map/lightMap';
import { FogLayer } from './map/fogLayer';
import { MapSkiffs } from './map/mapSkiffs';
import { RoadTraffic } from './map/roadTraffic';
import { BloodPools } from './map/bloodPools';
import { MapDisaster } from './map/mapDisaster';
import { createBattleHud } from './battle/battleHud';
import { createRaidRecap } from './battle/raidRecap';
import { BattleJuice } from './battle/juice';
import { startCinema } from './cinema/cinema';
import { momentOf } from './cinema/moments';
import { CutsceneScene } from './cutscene/cutsceneView';
import { FightScene } from './fight/fightView';
import { TacticsScene } from './tactics/tacticsView';
import { MineScene } from './fight/mineView';
import { DeepScene } from './deep/deepView';
import { UnderScene } from './underdark/underdarkView';
import { PortalScene } from './portal/portalView';
import { InteriorScene } from './interior/interiorView';
import { hasInside } from '../shared/sim/interiors';
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
import { blueprintCount, buildingCentre, buildingDoor, builtOnIndex, canPlace, defOf, hasPath, isUnlocked, type PlaceCheck } from '../shared/sim/buildings';
import type { PersonView, RaiderView, RoamerView, Snapshot, TravellerView } from '../shared/sim/snapshot';
import { lineOfDef, venueOfDef } from '../shared/data/shop';
import { DRAW_PATH, storePanel, type PanelId } from '../shared/ipc';
/** The window a venue's building opens (the shop, the tavern, or a specialty shop's). */
/** The hours the gates stand shut (map/mapView.ts `gatesShut`). */
const GATES_SHUT_FROM = 21;
const GATES_OPEN_AT = 6;
const venuePanel = (def: string): PanelId | undefined => (lineOfDef(def) ? storePanel(lineOfDef(def)!) : venueOfDef(def));
import { buildingTint } from './theme';

/** A traveller, drawn like a townsperson (they're only passing through: most of a person's details don't apply). */
function travellerPerson(t: TravellerView): PersonView {
  return {
    id: t.id, name: t.name, typeName: 'Traveller', look: t.look, x: t.x, y: t.y, dir: t.dir,
    activity: 'walk', taskDone: null, story: '', titles: [], titleWhy: {}, deeds: [], secret: null, sinceHit: 999, hitFrom: 1, sinceBlow: 999, sinceBlock: 999, defending: false, beast: null, cls: null, clsName: null, clsPast: [], income: null, owns: [], debt: 0, ambition: null, trips: 0, clsText: '', founderCalling: false, shaken: false, stage: 0, ascended: false, level: 1, levelProgress: 0, mounted: null, doing: travellerDoing(t), carrying: {},
    skills: {} as PersonView['skills'], traits: [], needs: { food: 1, rest: 1 }, morale: 60, moodTarget: 60, moodReasons: [], grieving: false,
    priorities: {} as PersonView['priorities'], autoPriorities: false, bed: null, bedId: null, floor: null,
    indoors: t.phase === 'shopping', // (inside the shop: see its window)
    bucket: false,
    rally: null,
    away: null, hp: 1, maxHp: 1, downed: null, bleedMinutes: null, gear: {}, gearQ: {}, pouch: [], pouchCap: 0, coins: null, detail: [], recent: [], bedroll: false, carryCapacity: 0,
    partner: null, married: false, friends: [], rivals: [], enemies: [], devoted: [], body: { wounds: [], lasting: [], fitted: [], sight: 1, handling: 1, moving: 1, pain: 0, marks: [] }, growsUpIn: null, breakdown: null, ageDays: 0,
  ageYears: 0, lifeStage: 'prime', ageText: '', elder: false, swimming: false, mer: false, nature: 'cheerful', natureName: 'Cheerful', natureLine: '', creed: null, job: null,
  monster: null, tireless: false, order: null, sick: false, rounds: false,
    battle: { damage: [0, 0], accuracy: 0, dodge: 0, armor: 0, block: 0, crit: 0, ranged: false, attrs: { str: 8, dex: 8, vit: 8, int: 8, wis: 8, cha: 8 }, mp: 0, sp: 0, interval: 12, range: 1, power: 0 }, kit: [], passives: [], road: null, roadId: null, freePts: 0, autoStats: false,
  favours: [],
  diary: [],
  pastime: null,
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
/** A courier riding in with news (map/mapCourier.ts), drawn as a traveller on horseback like an envoy. */
function courierPerson(c: CourierView): PersonView {
  const v = travellerPerson({ id: c.id, name: c.name, kind: 'courier', venue: 'shop', line: null, wants: '', temper: '', purse: 0, look: c.look, x: c.x, y: c.y, dir: c.dir, phase: 'arriving', tier: 0 });
  return { ...v, typeName: 'Courier', mounted: c.coat, activity: c.riding ? 'walk' : 'idle', doing: c.line };
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
import { bleedLeft, amount } from '../shared/format';
import { poolSize } from '../shared/sim/state';
import { hashSeed } from '../shared/rng';
import { MARK_CLEAR_CAP } from '../shared/sim/commands';
import type { DevOrder } from '../shared/sim/devOrders';
import { CELL, cellAt, groundAt, idx, isMarked, isPlannedRoad, isRoad, wet, WILD } from '../shared/sim/land';
import { CLUTTER_WORK, clutterAt, landmarksOf } from '../shared/sim/landClutter';
import spadeIcon from './ui/art/shovel.png';
import { PATH_CAP, pathRoute, refusalOn, type PathGround } from '../shared/sim/pathPlans';
import { BRIDGE_WOOD } from '../shared/sim/streets';
import { thinRock } from '../shared/sim/tunnels';
import { loadCreatures } from './art/creatures';
import { loadEffects } from './art/effects';
import { loadStills } from './art/stills';
import { loadLpc, loadLpcFaces, lpcFrame } from './art/lpc/lpc';
import { topDownArt } from './art/topDown';
import { buildingPicture } from './art/buildingPicture';
import { isoPicture } from './art/isoPicture';
import { pickCovered } from './map/packBuildings';
import { airFor } from './town/ambientView';
import { textureCanvas } from './art/pixelArt';
import { MapCamera } from './map/mapCamera';
import { MapView } from './map/mapView';
import { MapPeople } from './map/mapPeople';
import { setTownSayings } from './map/speech';
import { setCultureColour } from './map/mapFestival';
import { setCultureMotif } from './musicScore';
import { MapTownLife } from './map/mapTownLife';
import { darkHomes, LOOKOUT_TOWERS, snowballPairs, snowmanHomes, snowmanLeft } from './map/townLife';
import { MapRaiders } from './map/mapRaiders';
import { createHud } from './hud';
import { hostBridge, localBridge } from './localBridge';
import { createMusic } from './music';
import { moodOf } from './musicMood';
import { TICKS_PER_HOUR } from '../shared/sim/time';
import { fightSounds, globalSounds, soundsBetween, tacticsSounds, workSounds } from './sfx';
import { createAmbience } from './ambience';
import { readLevel } from './volume';
import { ambientMix, type AmbientMix } from './ambienceMix';
import { HEARTH, burnLevel, doorSound, hearthLevel } from './isoSounds';
import { quietZones, zoneMix, zoneSources, type ZoneMix } from './soundZones';
import { BUZZ, buzzesBetween, collapsesBetween, type Buzz } from './vibration';
import { createActionBar, createBanner, createBeastAsk, createExpeditionHeader, createGameOver, createPersonCard, createPromptCard, createToasts, type Action } from './overlayUi';
import { createTooltip } from './tooltip';
import { startStripLoad } from './loading/stripLoad';
import { ExpeditionPane } from './town/expeditionPane';
import { SnowView } from './town/snowView';
import { LeavesView } from './town/leavesView';
import { WeatherView } from './town/weatherView';
import { EVENT_BOX_KINDS } from '../shared/sim/popups';

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
/** How long the victory's flourish has the screen before the raid's recap (battle/juice.ts). */
const VICTORY_MS = 3200;

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
  | { kind: 'creature' }
  | { kind: 'grave'; id: number }
  | { kind: 'ruin'; id: number }
  | { kind: 'sign'; sign: Signpost }
  | { kind: 'caravan' }
  | { kind: 'village'; id: number }
  | null;

/** The bands roaming the land drawn as raiders (one figure a foe, in a little knot), their ids so many a band. */
const ROAMER_IDS = 16;
const ROAMER_TITLE: Record<RoamerView['kind'], string> = { beasts: 'Wild beasts', dead: 'The restless dead', bandits: 'Bandits', nest: 'From a nest', sky: 'Hunting from the sky' };
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
      // (a hunter from the sky flies over its spot, its bar the town's shooting: sim/skies.ts)
      ...(r.flying ? { aloft: r.height ?? 46, hp: 1 - (r.hurt ?? 0), x: r.x + ((i % 3) - 1) * 20, y: r.y + Math.floor(i / 3) * 10 } : {}),
    })),
  );
}

/** The ranch's beasts in their pens (sim/ranch.ts `beastHome`): each ambles between spots in its pen, a few seconds a
 *  spot, by its id and the clock (drawing only: the sim keeps no place for them). */
const PEN_STEP_MS = 4200;
function ranchFigures(pens: Snapshot['ranchPens'], now: number): RaiderView[] {
  const spot = (id: number, n: number) => {
    const h = Math.imul(id * 2654435761 + n * 40503, 2246822519) >>> 0;
    return { u: (h & 0xffff) / 0xffff, v: (h >>> 16) / 0xffff };
  };
  return pens.map((b) => {
    const t = now / PEN_STEP_MS + b.id * 0.37;
    const n = Math.floor(t);
    const f = Math.min(1, (t - n) * 2); // (walks the first half of the step, then stands)
    const a = spot(b.id, n);
    const z = spot(b.id, n + 1);
    const u = a.u + (z.u - a.u) * f;
    const v = a.v + (z.v - a.v) * f;
    return {
      id: 9_000_000 + b.id, swimming: false, ally: false, sinceArea: 999, sinceConjured: 999, sinceCast: 999, hitFx: null, kind: b.kind, name: '', floor: null,
      x: b.x + u * b.w, y: b.y + v * b.h, dir: z.u >= a.u ? 1 : -1, hp: 1, maxHp: 1, down: false, fleeing: false, gone: false, carrying: 0, captive: null, lame: 0, sinceAction: 999, sinceHit: 999,
    };
  });
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
    .map((m) => `${MATERIAL_NAMES[m]} ${amount(s[m] ?? 0)}`)
    .join(' · ');

/** Names for the open kinds of ground (the wild kinds are named by TERRAIN). */
const GROUND_NAMES: Record<string, string> = { grass: 'Open ground', fertile: 'Rich soil', sand: 'Sand', water: 'Water' };

async function start(): Promise<void> {
  TextureStyle.defaultOptions.scaleMode = 'nearest';
  // (the desktop's snapshots come as what changed, put back together here: renderer/deltaBridge.ts)
  const bridge = withDeltas(window.bridge) ?? (window.bridge = hostBridge() ?? localBridge());
  // (on the phone the page around the strip has its own, bigger tab buttons)
  if (hostBridge()) document.body.classList.add('embedded');
  /** In the phone (web) version's page: tapping selects, and a card at the top of the screen shows it. */
  const phone = !!hostBridge();
  /** A finger rather than a mouse (a phone): hints say "tap" and "long-press". */
  const coarse = () => matchMedia('(pointer: coarse)').matches;

  // (the loading screen's pictures are warmed from the first snapshot while the rest is set up: loading/stripLoad.ts)
  const firstSnap = bridge.getSnapshot();
  const stripLoad = firstSnap.then(startStripLoad);
  // (the founder's own looks are looked for meanwhile, so the founder wears theirs from the first frame: iso/founderArt.ts)
  const [first] = await Promise.all([firstSnap, loadLpc(), loadCreatures(), loadEffects(), loadStills(), findFounderArt()]);
  setFolkFounder(first.mainId);
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
  // (two fingers on the town: the page is pinching it, and the strip holds still: __pinching below)
  let pinching = false;
  let heldSnap: Snapshot | null = null;
  let resumedAt = 0;
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
      // (a pinch stops the drawing for a moment: that time isn't the phone falling behind)
      if (resumedAt) {
        resumedAt = 0;
        since = now + 3000;
      }
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
  // the isometric view, being built (iso/isoView.ts): Settings turns it on, and it then stands in for the top-down
  // map's world (hidden, though it still keeps its state: the hit tests and the layers not yet drawn in iso use it)
  const iso = new IsoView();
  {
    iso.syncLand(first.land);
    map.world.visible = false;
    map.lights.visible = false;
    map.root.addChildAt(iso.root, map.root.getChildIndex(map.world) + 1);
    map.worldOf = (sx, sy) => iso.worldOf(sx, sy);
    map.screenOf = (wx, wy) => iso.screenOf(wx, wy);
    // (the ground's own layer, blood and puddles, lies on the diamonds)
    iso.flat.addChild(map.under);
    iso.overFlat.addChild(map.over); // (effects over everything: ash, spells, confetti)
  }
  /** Where the creatures and townlife are drawn into: the iso view's sorted `things` (moved by `placeLoose`) or the map's. */
  const lay = iso.things;
  /** The cell under the finger in Clear mode, or the one inspected: the outline is drawn by both views. */
  const setHighlight = (cell: number | null) => {
    map.setHighlight(cell);
    iso.setHighlight(cell);
  };
  (window as unknown as { __iso?: IsoView }).__iso = iso; // (for previews)
  // (real light: the dark of night, and every torch's pool and shadows: map/lightMap.ts)
  const lightMap = new LightMap(app.renderer);
  let lightDaylight = 1;
  (window as unknown as { __lightMap: LightMap }).__lightMap = lightMap;
  iso.lightLayer.addChild(lightMap.sprite);
  // (the fog of war, over the land and the lights: black until explored, grey once left, clear in sight: map/fogLayer.ts)
  const fog = new FogLayer();
  iso.lightLayer.addChild(fog.sprite);
  (window as unknown as { __fog?: FogLayer }).__fog = fog; // (for previews)
  /** What is out of sight in the fog is hidden: creatures, raiders, roaming bands, strangers. */
  const inSightOnly = <T extends { x: number; y: number }>(list: readonly T[]): readonly T[] => (fog.on ? list.filter((t) => fog.seen(t.x, t.y)) : list);
  (window as unknown as { __map?: MapView }).__map = map; // (for previews and profiling)
  (window as unknown as { __topDownArt?: typeof topDownArt }).__topDownArt = topDownArt; // (for previews: a gallery of the painted buildings)
  const pools = new BloodPools(map.under); // (blood on the ground where someone fell)
  const debris = new BattleDebris(map.under); // (and what the fallen dropped)
  const disaster = new MapDisaster(map.under, map.over); // (floods, wildfires and their ash: sim/disasters.ts)
  (window as unknown as { __pools?: BloodPools }).__pools = pools; // (for previews)
  const people = new MapPeople(iso.things);
  people.isoFolk = true;
  (window as unknown as { __people?: MapPeople }).__people = people; // (for previews and probes)
  people.lights = map.lights;
  (window as unknown as { __people?: MapPeople }).__people = people; // (for previews)
  (window as unknown as { __hkCell?: typeof hkCell }).__hkCell = hkCell; // (for previews: a townsperson's cell)
  const raiders = new MapRaiders(lay);
  raiders.rings = 'fight';
  const roamers = new MapRaiders(lay); // (the bands roaming the land: sim/roamers.ts)
  const penned = new MapRaiders(lay); // (the ranch's beasts in their pens: sim/ranch.ts)
  const beast = new MapCreature(lay); // (the town's great creature: sim/creature.ts)
  (window as unknown as { __beast?: MapCreature }).__beast = beast; // (for previews)
  // (the creature sheets, for the page's lineup of the great creature's pick: mobile/beastLineup.ts; the page borrows
  // the strip's pictures rather than carrying its own copies)
  (window as unknown as { __sheetOf?: (id: string) => SheetDef | undefined }).__sheetOf = (id) => SHEETS[id as CreatureSheet];
  // (on the phone the page around the strip shows it, at its own size: mobile/mobile.ts)
  const beastAsk = phone ? { show: () => undefined, hide: () => undefined } : createBeastAsk((praise) => bridge.command({ type: 'creature', op: praise ? 'praise' : 'scold' }));
  (window as unknown as { __penned?: unknown }).__penned = penned; // (for previews)
  const herds = new MapHerds(lay);
  const boats = new MapBoats(map.things);
  const airships = new MapAirships(map.things, map.over, map.under); // (the skies: sim/skies.ts)
  const wagons = new MapWagons(map.things); // (the caravans' wagons: sim/bands.ts)
  const birds = new MapBirds(lay, map);
  (window as unknown as { __birds?: MapBirds }).__birds = birds; // (for previews)
  // (the small scenes about town: the elders' benches and crumbs, puddle splashes, the busker's notes: map/mapScenes.ts)
  const scenes = new MapScenes(map.things, (id) => people.posOf(id));
  let buskDue = 0;
  const butterflies = new MapButterflies(lay, map);
  const wildlife = new MapWildlife(lay, map);
  wildlife.seen = (x, y) => fog.seen(x, y);
  (window as unknown as { __wildlife?: MapWildlife }).__wildlife = wildlife; // (for previews)
  const water = new MapWater(map.things, map.under, map.over, map.root, map);
  // footprints in the snow, the sand and the rain's mud, and breath in the cold (map/mapTracks.ts)
  const tracks = new MapTracks(map.under, map.over, map);
  (window as unknown as { __tracks?: MapTracks }).__tracks = tracks; // (for previews)
  // the town's dogs, cats and hens (map/mapPets.ts)
  const pets = new MapPets(lay, map.over, map);
  // bees and hives, dragonflies, bats, moths, crows and scarecrows, rats (map/mapCritters.ts); frost, dew, hail and
  // drifts on the ground (map/groundFrost.ts)
  const critters = new MapCritters(lay, map.over, map);
  pets.onCatch = (id) => critters.caught(id);
  const frost = new GroundFrost(map.under);
  (window as unknown as { __critters?: unknown }).__critters = { critters, frost }; // (for previews)
  // the wider world felt from home and the land's weather: far settlements past the fog, a host's torches, eyes in the
  // dark, wisps, geese, couriers, tumbleweeds and dust devils, weathervanes and chimes, sun shafts (map/wideWorld.ts)
  const wide = new WideWorld(map);
  wide.geese.onHonk = (pan) => ambience.cue('honk', pan);
  wide.vanes.onChime = (pan) => ambience.cue('windchime', pan);
  (window as unknown as { __wide?: WideWorld }).__wide = wide; // (for previews)
  const graves = new MapGraves(map.things); // (a headstone for each of the fallen)
  // the town being itself: snowmen, snowballs, the coffin carried, the lookouts on the towers (map/mapTownLife.ts)
  const townLife = new MapTownLife(lay, map.over, map.lights, (id) => people.posOf(id));
  (window as unknown as { __townLife?: MapTownLife }).__townLife = townLife; // (previews)
  (window as unknown as { __graves?: MapGraves }).__graves = graves; // (previews)
  const market = new MapMarket(lay); // (market day's stalls)
  const decor = new SeasonDecor(map.things, map.lights); // (the doors dressed for the season)
  const homes = new HomeDecor(map.things); // (homes showing their folk's means, and the plague's marked doors)
  (window as unknown as { __homes?: HomeDecor }).__homes = homes; // (previews)
  const signs = new Signposts(map.things); // (signposts at the crossroads)
  (window as unknown as { __signs?: Signposts }).__signs = signs; // (previews)
  // memory written into the town: ruins where buildings fell, and the homes' names by their doors (map/mapRuins.ts,
  // map/homeSigns.ts; the statues are buildings, map/statueArt.ts)
  const ruins = new MapRuins(map.under, map.things, (def, id) => map.artFor(def, id));
  const homeSigns = new HomeSigns(map.things);
  (window as unknown as { __memory?: unknown }).__memory = { ruins, homeSigns }; // (previews)
  const lamps = new StreetLamps(map.things, map.lights); // (lamps along the streets, lit at dusk)
  const skiffs = new MapSkiffs(map.things); // (boats along the rivers)
  // work you can see: trees falling and their stumps, gains floating up, the harvest left in the field, the well and
  // the washing (map/workSeen.ts; the stockpile's heaps are the iso view's own: iso/isoTown.ts `stockHeaps`)
  const felling = new MapFelling(lay);
  /** The least time between two falls heard (ms). */
  const FELL_HEARD_MS = 1500;
  let lastFelled = 0;
  map.onFelled = (tex, x, y, kind, cell) => {
    felling.fall(tex, x, y, kind, cell, map.calm);
    // (a tree comes down with a creak and a crash, a rock breaks with a rattle: heard when the sound is on, one at a
    //  time)
    const mv = map.view;
    const now = performance.now();
    if (now - lastFelled < FELL_HEARD_MS) return;
    lastFelled = now;
    if (view.music && !view.hidden && x >= mv.x && x <= mv.x + mv.w && y >= mv.y && y <= mv.y + mv.h) ambience.cue(kind === 'tree' ? 'timber' : 'crumble', ((x - mv.x) / Math.max(1, mv.w)) * 1.6 - 0.8);
  };
  const gainsView = new MapGains(map.over);
  const chores = new MapChores(lay);
  {
    // (the work and festival layers drawn in world px on top-down building sprites: here on the diamonds instead;
    //  what rises upright goes through `isoOf`, into `screenFx`)
    const at = (x: number, y: number) => iso.isoOf(x, y);
    map.festival.useIso(iso.things);
    felling.useIso(iso.things);
    chores.useIso(iso.things);
    gainsView.useIso(iso.screenFx, { at, top: (id) => iso.topOf(id) });
    map.smokeColumns.useIso(iso.screenFx, at);
    map.workFx.useIso(iso.screenFx, iso.glow, at);
    // (a door swinging open near the middle of the view creaks, softly and not often: isoSounds.ts)
    let lastDoor = -9;
    iso.onDoor = (x, y) => {
      if (!view.music || view.hidden || !map.root.visible) return;
      const now = performance.now() / 1000;
      const d = doorSound(map.view, x, y, now - lastDoor);
      if (!d) return;
      lastDoor = now;
      ambience.cue('creak', d.pan);
    };
  }
  (window as unknown as { __workSeen?: unknown }).__workSeen = { felling, gains: gainsView, chores, people }; // (previews)
  const traffic = new RoadTraffic(map.things); // (carts along the roads)
  (window as unknown as { __traffic?: unknown }).__traffic = { skiffs, traffic, ground: map.groundWeather }; // (previews)
  // the dragon in the sky (map/mapDragon.ts)
  const dragon = new MapDragon(map.over, map.under, map);
  dragon.onFlight = (low, pan) => {
    ambience.cue('roar', pan, low ? 0.2 : 0.8);
    buzz('roar');
  };
  (window as unknown as { __pets?: MapPets }).__pets = pets; // (for previews)
  // (thunder rolls in a moment after the flash, from the side it struck)
  pets.onSound = (kind, x) => ambience.cue(kind, ((x - map.view.x) / Math.max(1, map.view.w)) * 1.6 - 0.8);
  water.onStrike = (x) => {
    ambience.cue('thunder', ((x - map.view.x) / Math.max(1, map.view.w)) * 1.4 - 0.7, 0.3 + Math.random() * 1.2);
    buzz('thunder');
  };
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
  iso.air.addChild(sky.fogLayer); // (fog banks drift over the screen in iso: moved with the view each frame)
  app.stage.addChild(sky.root);
  (window as unknown as { __sky?: MapSky }).__sky = sky; // (for previews)
  if (weather) app.stage.addChild(weather.root);
  app.stage.addChild(snow.root, leaves.root, pane.root);
  // a raid's battle is fought on the town's own map (map/mapBattle.ts draws the trail, the spots and the shots over it)
  const battle = new MapBattle(map);
  // the flash of a raid fought on the trail (battle/juice.ts): impacts and numbers on the map, the shake, callouts,
  // wave banners and the victory over it
  const mapJuice = new BattleJuice();
  map.over.addChild(mapJuice.world);
  app.stage.addChild(mapJuice.screen);
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
  // inside a building (interior/interiorView.ts): a cutaway of the room, whoever is in it
  const interior = new InteriorScene((c) => bridge.command(c));
  app.stage.addChild(deep.root);
  // the Underdark under the land (underdark/underdarkView.ts): the caves seen from above, lit by what glows
  const under = new UnderScene((c) => bridge.command(c), (id) => bridge.openPanel(id));
  app.stage.addChild(under.root);
  // a cutscene (cutscene/cutsceneView.ts): over everything, offered first, then played full screen
  const cutscene = new CutsceneScene((c) => bridge.command(c), document.body);
  app.stage.addChild(cutscene.root);
  Object.assign(window, { __scenePerf: () => cutscene.perf(), __sceneSeek: (shot: number, beat?: number, sec?: number) => cutscene.seek(shot, beat, sec) });
  const fightHud = createFightHud({
    back: () => {
      bridge.command({ type: 'watch', expedition: null });
      bridge.command({ type: 'watchMine', place: null });
    },
    speed: (n) => bridge.command({ type: 'battleSpeed', speed: n }),
  });
  const raidRecap = createRaidRecap(() => bridge.command({ type: 'giveChase' }));
  const cinema = startCinema(document.body); // (a big moment as a title card, the screen letterboxed)
  let lastNewsId = -2; // (-2: no snapshot yet; the news already there when the page opens is not shown again)
  const battleHud = createBattleHud({
    go: () => bridge.command({ type: 'battleGo' }),
    auto: (on) => bridge.command({ type: 'battleAuto', on }),
    speed: (n) => bridge.command({ type: 'battleSpeed', speed: n }),
    skip: () => bridge.command({ type: 'raidSkip' }),
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

  const camera = new MapCamera(iso.width, iso.height);
  camera.project = (p) => iso.isoOf(p.x, p.y);
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
  // (a button back to the town's camp, wherever the view has wandered: the owner's ask)
  const homeButton = document.createElement('button');
  homeButton.id = 'centre-town';
  homeButton.setAttribute('data-hit', '');
  homeButton.title = 'Back to the town';
  homeButton.setAttribute('aria-label', 'Back to the town');
  homeButton.textContent = '⌂';
  homeButton.addEventListener('click', (e) => {
    e.stopPropagation();
    camera.centreOn(snap?.camp ?? first.camp, app.screen.width, app.screen.height);
  });
  document.body.append(homeButton);
  // (the Clear button: while it's on, a tap or a drag over trees, scrub and rock marks them for the townsfolk to clear,
  //  and a tap on a marked cell lifts the mark. The sweep is sent as one `markClear` when the finger lifts.)
  let clearing = false;
  let sweep: { id: number; on: boolean; cells: Set<number>; last: { x: number; y: number } } | null = null;
  const CLEAR_TIP_KEY = 'littletown.clearTip';
  const clearButton = document.createElement('button');
  clearButton.id = 'clear-land';
  clearButton.setAttribute('data-hit', '');
  clearButton.title = 'Clear land';
  clearButton.setAttribute('aria-label', 'Clear land');
  // (a spade from the mining icons, so it isn't the Underground button's pickaxe: mobile/undergroundSwitch.ts)
  const spade = document.createElement('img');
  spade.src = spadeIcon;
  spade.alt = '';
  clearButton.append(spade);
  clearButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (drawing) endDraw(true);
    clearing = !clearing;
    sweep = null;
    clearButton.classList.toggle('on', clearing);
    if (!clearing) return banner.hide();
    banner.show('Clearing land', 'Drag over trees, rock, stumps and ruins · tap a mark to lift it');
    try {
      if (!localStorage.getItem(CLEAR_TIP_KEY)) {
        localStorage.setItem(CLEAR_TIP_KEY, '1');
        toasts.push('The townsfolk clear marked land first.');
      }
    } catch {
      /* (no storage: no tip) */
    }
  });
  document.body.append(clearButton);
  // (Draw a path (the owner's asks): while it's on, a finger down on a cell starts a path and a drag shows its blueprint
  //  live, the cells it will cover from there to under the finger, a straight run or two at a corner (sim/pathPlans.ts
  //  `pathRoute`), the cells it can't take marked blocked, and what it will cost; lifting the finger lays it as one order.
  //  A tap lays the one cell. A press on a cell of blueprint lifts instead: the drag shows what it will take up. A second
  //  finger (a pinch) drops the drag. Cancel takes back what this go laid and lifted, Done keeps it.)
  let drawing = false;
  let stroke: { id: number; on: boolean; from: number; to: number; x: number; y: number; moved: boolean; ground: PathGround } | null = null;
  /** What this go laid and lifted, for Cancel. */
  const laid = new Set<number>();
  const lifted = new Set<number>();
  const DRAW_HINT = 'Drag from one spot to another and lift to lay it · drag from a path to lift it';
  const pathButton = document.createElement('button');
  pathButton.id = 'draw-path';
  pathButton.setAttribute('data-hit', '');
  pathButton.title = 'Draw a path';
  pathButton.setAttribute('aria-label', 'Draw a path');
  pathButton.textContent = '⛙';
  const startDraw = () => {
    if (drawing) return;
    if (clearing) clearButton.click();
    if (placing) stopPlacing();
    drawing = true;
    stroke = null;
    laid.clear();
    lifted.clear();
    pathButton.classList.add('on');
    banner.show('Drawing a path', DRAW_HINT, () => endDraw(true));
  };
  /** A drag let go of with nothing laid (a pinch, or the page taking the touch). */
  const dropStroke = () => {
    if (!stroke) return;
    stroke = null;
    iso.setPathPreview(null);
    setHighlight(null);
    if (drawing) banner.show('Drawing a path', DRAW_HINT, () => endDraw(true));
  };
  /** Out of the mode: kept (Done), or what this go changed taken back (Cancel). */
  const endDraw = (keep: boolean) => {
    if (!drawing) return;
    drawing = false;
    dropStroke();
    pathButton.classList.remove('on');
    setHighlight(null);
    banner.hide();
    if (!keep) {
      sendCells([...laid].filter((i) => !lifted.has(i)), false);
      sendCells([...lifted].filter((i) => !laid.has(i)), true);
    }
    laid.clear();
    lifted.clear();
  };
  pathButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (drawing) endDraw(true);
    else startDraw();
  });
  document.body.append(pathButton);
  /** The cell under a screen point (null off the land). */
  const cellUnder = (sx: number, sy: number) => {
    const w = map.worldOf(sx, sy);
    return map.cellAt(w.x, w.y);
  };
  const plannedAt = (i: number) => isPlannedRoad(snap.land, i % snap.land.w, Math.floor(i / snap.land.w));
  const roadAt = (i: number) => isRoad(snap.land, i % snap.land.w, Math.floor(i / snap.land.w));
  /** The path's rule read from the snapshot (sim/pathPlans.ts `refusalOn`), so the preview blocks what the sim skips.
   *  (A gap in the ring wall isn't known here: the sim skips it all the same.) */
  const groundNow = (): PathGround => ({ land: snap.land, explored: snap.explored, origin: snap.origin.id, on: builtOnIndex(snap), wall: null, castle: snap.castle ? new Set(snap.castle.cells) : null, thin: thinRock({ land: snap.land, origin: snap.origin.id }) });
  /** The orders, a `PATH_CAP` at a time. */
  const sendCells = (cells: number[], on: boolean) => {
    for (let k = 0; k < cells.length; k += PATH_CAP) bridge.command({ type: 'drawPath', cells: cells.slice(k, k + PATH_CAP), on });
  };
  /** The cells the drag covers now: each one laid (ok) or blocked; lifting, only the cells of blueprint it crosses. */
  const strokeCells = (st: NonNullable<typeof stroke>): { i: number; ok: boolean }[] => {
    const w = snap.land.w;
    const ok = (x: number, y: number) => {
      const i = y * w + x;
      return st.on ? roadAt(i) || plannedAt(i) || refusalOn(st.ground, x, y) === null : plannedAt(i);
    };
    const route = pathRoute({ x: st.from % w, y: Math.floor(st.from / w) }, { x: st.to % w, y: Math.floor(st.to / w) }, ok);
    const cells = route.map((p) => ({ i: p.y * w + p.x, ok: ok(p.x, p.y) }));
    return st.on ? cells : cells.filter((c) => c.ok);
  };
  /** The preview under the finger, and what it will cost on the banner. */
  const showStroke = () => {
    if (!stroke) return;
    const cells = strokeCells(stroke);
    iso.setPathPreview(cells, !stroke.on);
    if (!stroke.on) return banner.show('Lifting a path', `${cells.length} ${cells.length === 1 ? 'cell' : 'cells'} · lift to take ${cells.length === 1 ? 'it' : 'them'} up`, () => endDraw(true));
    const fresh = cells.filter((c) => c.ok && !roadAt(c.i) && !plannedAt(c.i));
    const blocked = cells.length - cells.filter((c) => c.ok).length;
    const g = (i: number) => groundAt(snap.land, i % snap.land.w, Math.floor(i / snap.land.w));
    const bridges = fresh.filter((c) => wet(g(c.i))).length;
    const tunnels = fresh.filter((c) => g(c.i) === 'mountain').length;
    const parts = [`${fresh.length} ${fresh.length === 1 ? 'cell' : 'cells'}`];
    if (bridges) parts.push(`${bridges} of bridge, ${bridges * BRIDGE_WOOD} wood`);
    if (tunnels) parts.push(`${tunnels} of tunnel, slow to cut`);
    if (blocked) parts.push(`${blocked} blocked, skipped`);
    banner.show('Drawing a path', `${parts.join(' · ')} · lift to lay it`, () => endDraw(true));
  };
  /** A finger moving in Draw a path: the path runs from where it went down to the cell under it. */
  const strokeOver = (sx: number, sy: number) => {
    if (!stroke) return;
    if (!stroke.moved && Math.hypot(sx - stroke.x, sy - stroke.y) < DRAG_THRESHOLD) return;
    stroke.moved = true;
    const cell = cellUnder(sx, sy);
    if (cell === null || cell === stroke.to) return;
    stroke.to = cell;
    setHighlight(cell);
    showStroke();
  };
  /** The finger lifted: what the drag covers is laid (or lifted) as one order. */
  const strokeDone = () => {
    if (!stroke) return;
    const st = stroke;
    const cells = strokeCells(st).filter((c) => c.ok && (st.on ? !roadAt(c.i) && !plannedAt(c.i) : true)).map((c) => c.i);
    dropStroke();
    if (!cells.length) {
      if (st.on && !roadAt(st.from) && !plannedAt(st.from)) toasts.push(refusalOn(st.ground, st.from % snap.land.w, Math.floor(st.from / snap.land.w)) ?? 'No path there');
      return;
    }
    for (const i of cells) (st.on ? laid : lifted).add(i);
    sendCells(cells, st.on);
  };
  camera.centreOn(first.camp, app.screen.width, app.screen.height); // (a nomad tribe's camp may be away on its pasture)

  /** The expedition shown in the split view: the most recently sent one. */
  const shownExpedition = () => snap.expeditions.at(-1) ?? null;
  const expHeader = createExpeditionHeader(() => bridge.openPanel('expeditions'));
  const promptCard = createPromptCard((prompt, option) => bridge.command({ type: 'answerPrompt', prompt, option }), (prompt) => bridge.command({ type: 'parkPrompt', prompt }), (prompt) => bridge.command({ type: 'openPrompt', prompt }));
  const gameOver = createGameOver(() => (bridge.endTown ? void bridge.endTown() : bridge.openPanel('newgame')));

  // (an origin's look reaches its buildings too)
  const hud = createHud(bridge); // (the buildings' style follows the snapshot: see applySnapshot)
  const music = createMusic();
  /** A festival's own song while the town gathers for it (renderer/musicScore.ts `festivalPiece`). */
  const festivalSong = (n: Snapshot) => (n.gathering?.kind === 'festival' && n.gathering.festival ? `fest:${n.gathering.festival}` : null);
  const musicMood = (n: Snapshot) =>
    moodOf({
      raid: n.raid?.phase === 'active' && n.tactics?.phase !== 'done',
      boss: !!n.bossBar,
      fight: (!!n.tactics && n.tactics.phase !== 'done') || !!n.watch?.battle,
      // (a fight won: a raid beaten off, on the trail or the board, a party's fight; music/musicScore.ts's victory)
      victory:
        n.tactics?.banner?.kind === 'win' ||
        (!!n.raidRecap && n.raidRecap.outcome !== 'pillaged' && n.raidRecap.hoursAgo * TICKS_PER_HOUR < 80) ||
        n.expeditions.some((e) => e.result?.outcome === 'won' && e.result.age < 80),
      daylight: n.calendar.daylight,
      season: n.calendar.season,
      theme: n.theme,
      gathering: n.gathering?.kind ?? null,
      biome: n.biome,
      align: n.align?.score,
    });
  (window as unknown as { __music: typeof music }).__music = music;
  // the land's soundscape, on with the music (ambience.ts)
  const ambience = createAmbience();
  (window as unknown as { __ambience?: typeof ambience }).__ambience = ambience; // (for previews)
  // (a button tapped in any of the pages clicks softly: a page turned, ui/frame.ts)
  (window as unknown as { __uiClick?: () => void }).__uiClick = () => ambience.cue('page', 0);
  // (how loud the music and the sound effects are: the ☰ menu's sliders set them here, and the phone remembers them)
  const levels = { music: readLevel('music'), sfx: readLevel('sfx') };
  music.setLevel(levels.music);
  ambience.setLevel(levels.sfx);
  (window as unknown as { __volume?: unknown }).__volume = {
    get music() {
      return levels.music;
    },
    set music(v: number) {
      levels.music = v;
      music.setLevel(v);
    },
    get sfx() {
      return levels.sfx;
    },
    set sfx(v: number) {
      levels.sfx = v;
      ambience.setLevel(v);
    },
  };
  let ambMix: AmbientMix | null = null;
  /** The sounds by place where the view is (soundZones.ts): quiet while the map isn't on the screen. */
  let ambZones: ZoneMix = quietZones();
  Object.assign(window, { __zones: () => ambZones }); // (previews)
  /** The phone buzzes softly at the big moments (vibration.ts): the page does it, by its own setting. */
  const buzz = (k: Buzz) => {
    bridge.vibrate?.(BUZZ[k]);
  };
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
  /** A stump or a ruin on a cell (sim/landClutter.ts): the Clear tool takes it away too. */
  const clutterCell = (i: number) => clutterAt(snap.land, landmarksOf(snap.valley, snap.land), i);
  /** Whether the Clear tool can mark a cell: wild land, a stump or a ruin. */
  const clearableCell = (i: number) => wildCell(i) || clutterCell(i) !== null;
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

  const banner = createBanner(() => {
    if (drawing) endDraw(false);
    else if (clearing) clearButton.click();
    else stopPlacing();
  });

  const setInteractive = (on: boolean) => {
    if (on === interactive) return;
    interactive = on;
    bridge.setInteractive(on);
  };

  /** Who stands under a screen point in the isometric view: the ground under a figure is below the point tapped
   *  (on their body), so the ground a little lower down is tried too. */
  const isoPersonAt = (x: number, y: number) => {
    for (let dy = 0; dy <= 36; dy += 6) {
      const g = map.worldOf(x, y + dy);
      const p = people.personAt(g.x, g.y);
      if (p) return p;
    }
    return null;
  };

  /** A building's card, or a daughter village's for its houses and fields (drawn as buildings with ids below zero:
   *  sim/villages.ts). */
  const buildingHit = (id: number): Hover => (id < 0 ? { kind: 'village', id: Math.floor((-id - 1) / 100) } : { kind: 'building', id });

  /** What in the town (or the expedition pane) is under a screen point. */
  const hitTest = (x: number, y: number): Hover => {
    if (x >= paneX) return x < paneX + paneW && y >= app.screen.height - STRIP_HEIGHT + PANE_HIT_TOP ? { kind: 'pane' } : null;
    const w = map.worldOf(x, y);
    const raider = raiders.raiderAt(w.x, w.y);
    if (raider) return { kind: 'raider', id: raider.id };
    const roamer = roamers.raiderAt(w.x, w.y);
    if (roamer) return { kind: 'roamer', id: Math.floor(roamer.id / ROAMER_IDS) };
    // (the great creature: tapped on its body, so the ground a little lower is tried too, as for the townsfolk)
    for (let dy = 0; dy <= 60; dy += 10) {
      const g = map.worldOf(x, y + dy);
      if (beast.at(g.x, g.y)) return { kind: 'creature' };
    }
    const person = isoPersonAt(x, y);
    // (one of a daughter village's folk: the village's card)
    const vil = person && snap.villages.find((v) => v.folk.some((f) => f.id === person.id));
    if (vil) return { kind: 'village', id: vil.id };
    if (person) return { kind: 'person', person };
    // (a building's art right under the finger, in front of the ground there, hides what stands on that ground)
    const over = iso.buildingOver(x, y, w.x, w.y);
    if (over !== null) return buildingHit(over);
    const pet = pets.petAt(w.x, w.y);
    if (pet) return { kind: 'pet', key: pet };
    const grave = graves.graveAt(w.x, w.y);
    if (grave) return { kind: 'grave', id: grave.id };
    const sign = signs.signAt(w.x, w.y);
    if (sign) return { kind: 'sign', sign };
    const building = iso.buildingAt(x, y);
    if (building !== null) return buildingHit(building);
    const ruin = ruins.ruinAt(w.x, w.y);
    if (ruin) return { kind: 'ruin', id: ruin.id };
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
      setHighlight(inspected?.kind === 'cell' ? inspected.cell : null);
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
        return { title: r.name, lines: [`${doing} · health ${r.hp}/${r.maxHp}${r.power ? ` · power ${r.power}` : ''}`], y: overheadY(raiders.posOf(r.id), 54) };
      }
      case 'roamer': {
        const r = snap.roamers.find((q) => q.id === h.id);
        if (!r) return null;
        const doing = r.fighting ? 'Fighting townsfolk out on the land!' : r.chasing ? `After ${r.chasing}!` : 'Roaming the land: anyone out alone is in danger';
        const foes = Object.entries(r.foes.reduce<Record<string, number>>((n, f) => ((n[f.name] = (n[f.name] ?? 0) + 1), n), {})).map(([name, n]) => (n > 1 ? `${n} × ${name}` : name));
        return { title: r.name ? `${r.name[0].toUpperCase()}${r.name.slice(1)} from a nest` : ROAMER_TITLE[r.kind], lines: [doing, `${foes.join(', ')}${r.power ? ` · power ${r.power}` : ''}`], y: overheadY(roamers.posOf(r.id * ROAMER_IDS), 54) };
      }
      case 'sign':
        return { title: 'Signpost', lines: Signposts.lines(h.sign), y: map.screenOf((h.sign.postX + 0.5) * CELL, (h.sign.postY + 0.5) * CELL).y - 40 };
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
        // (a statue tells the story of the one it stands for: sim/statues.ts)
        const hero = b.def === STATUE && b.statue !== undefined ? snap.honoured.find((q) => q.id === b.statue) : undefined;
        if (hero) {
          const story = [...(b.status === 'blueprint' ? [b.progress > 0 ? `Being carved: ${Math.floor(b.progress * 100)}%` : 'Waiting for its stone'] : []), ...(hero.calling ? [`${hero.calling}, level ${hero.level}`] : []), ...hero.deeds, `Died on day ${hero.day}, ${hero.cause}.`];
          return { title: `Statue of ${hero.name}`, lines: story, hint: 'Click for options', y: r.y };
        }
        if (b.homeName && b.status === 'done') lines.push(def.name); // (a home by its name: sim/memorials.ts)
        // (a piece of the ring wall under way is one job with the whole wall: sim/ringWall.ts)
        const wall = b.ring !== undefined && snap.wall && b.ring === snap.wall.gen ? snap.wall : null;
        if (wall && b.status === 'blueprint') {
          lines.push(`The town's wall, ${wall.shape}, built as one: ${wall.done} of ${wall.of} sections standing (${Math.floor(wall.share * 100)}%)`);
          if (b.overgrown) lines.push('Clearing the ground here first: the trees and rocks on the line are being cut and dug out');
          else if (b.planned) lines.push('Laid out, waiting to be worked');
          return { title: `${def.name} (the wall going up)`, lines, hint: 'Click for options', y: r.y };
        }
        // (the seat holds back each new age's studies until it is raised to that age: sim/research.ts)
        const seatAt = SEAT_STAGE[b.def] ? snap.research.seat : null;
        if (seatAt) {
          if (seatAt.building) lines.push(`Being raised to the ${seatAt.next}: the new age's studies open when it stands`);
          else if (seatAt.next) lines.push(`Stage ${seatAt.stage} of 5. The ${seatAt.nextEra} age's studies wait until it is raised to the ${seatAt.next}`);
          else lines.push('Stage 5 of 5: every age\'s studies are open');
        }
        if (b.status === 'blueprint') {
          const parts = (Object.entries(def.cost) as [Material, number][]).map(([m, n]) => `${MATERIAL_NAMES[m]} ${Math.floor(b.delivered[m] ?? 0)}/${n}`);
          lines.push(b.progress > 0 ? `Under construction: ${Math.floor(b.progress * 100)}%` : `Materials delivered: ${parts.join(' · ')}`);
          if (b.overgrown) lines.push('Clearing the ground first: the trees and rocks on it are being cut and dug out');
          if (!hasPath(snap, b)) lines.push('No path to its door yet: draw one with ⛙');
        } else {
          if (!hasPath(snap, b)) lines.push('No path to its door: draw one with ⛙');
          if (b.fire !== undefined) lines.push(`ON FIRE! ${Math.floor(b.fire * 100)}% burned — everyone is fighting it`);
          lines.push(def.purpose);
          // whose it is, and who lives in it (homes are bought by the townsfolk and let out: sim/property.ts)
          const name = (id: number) => snap.people.find((q) => q.id === id)?.name;
          const owner = b.owner !== undefined ? name(b.owner) : undefined;
          if (!def.hp && !CROPS[b.def]) lines.push(owner ? `Owned by ${owner}` : "The town's own (the treasury's)");
          // (the airship mast: who's moored there, who's away: sim/skies.ts)
          if (b.def === 'airship_mast') lines.push(snap.airships.length ? snap.airships.map((a) => `The ${a.name}: ${a.away === null ? `moored, hull ${a.hull}/${a.max}` : `flying for ${a.away}`}`).join(' · ') : 'No airship yet: the town will build one when it has the makings');
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
        return { title: (b.homeName && b.status === 'done' ? b.homeName : def.name) + (b.status === 'blueprint' ? ' (blueprint)' : ''), lines, hint: 'Click for options', y: r.y };
      }
      case 'ruin': {
        const r = snap.ruins.find((q) => q.id === h.id);
        if (!r) return null;
        const left = Math.max(1, Math.ceil(RUIN_HOURS[r.kind] - r.hours));
        return { title: 'Ruins', lines: [`${r.line}.`, `Cleared away in about ${left} hour${left === 1 ? '' : 's'}, or when something is built here.`], y: map.screenOf((r.x + r.w / 2) * CELL, r.y * CELL).y - 20 };
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
      case 'creature': {
        if (!snap.creature) return null;
        const c = creatureCard(snap.creature);
        return { title: c.title, lines: c.lines, hint: 'Tap for its card', y: overheadY(beast.posOf(), 70) };
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
        const clutter = clutterCell(h.cell);
        if (!def && clutter) return { title: CLUTTER_WORK[clutter].name + (where ? ` ${where.trim()}` : ''), lines: [isMarked(snap.land, h.cell) ? `${listStock(snap.land.pools[h.cell] ?? {})} left` : clutter === 'stump' ? 'A felled tree\'s stump: the wood grows back here unless it is grubbed out.' : 'What is left of a town that stood here before.'], hint: isMarked(snap.land, h.cell) ? 'The town is clearing it' : 'Clear land (⛏) takes it away', y };
        if (!def) return { title: GROUND_NAMES[g] ?? 'Open land', lines: [(g === 'water' ? 'The water' : 'The town builds here when it needs to') + (where ? ` (${where.trim()})` : '')], y };
        return { title: def.name + (where ? ` ${where.trim()}` : ''), lines: [listStock(snap.land.pools[h.cell] ?? {}) + ' left'], hint: isMarked(snap.land, h.cell) ? 'The town is clearing it' : 'The town will gather here when it needs to', y };
      }
      default:
        return null;
    }
  };

  const showHover = () => {
    setHighlight(hover?.kind === 'cell' ? hover.cell : null);
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
        label: `Throw out ${MATERIAL_NAMES[m]} (${amount(b.store[m] ?? 0)})`,
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
    // (a way down into the Underdark: the shaft, a mine, a hold's hallway, sim/underdark.ts)
    if (snap.underdark && ['deep_shaft', 'mine', 'coal_mine', 'deep_mine', 'hold_hallway'].includes(b.def))
      list.push({
        label: 'Into the Underdark',
        onClick: () => {
          bridge.command({ type: 'watchUnder', on: true });
          done();
        },
      });
    // (inside: a cutaway of the room and whoever is in it, sim/interiors.ts)
    // (not a castle's or a hold's own room: those are seen into already, on the map)
    const castleRoom = !!snap.castle && snap.castle.cells.includes(idx(snap.land, b.tile, b.row));
    if (b.status === 'done' && b.id > 0 && !castleRoom && hasInside(BUILDING_BY_ID[b.def]))
      list.push({
        label: 'Look inside',
        onClick: () => {
          bridge.command({ type: 'lookInside', building: b.id });
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
  // (a challenge being put: whose card shows the power levels and the two terms; sim/duel.ts)
  let duelAsk: number | null = null;
  let inspectKey = '';
  const inspectRuns = new Map<string, () => void>();
  // (developer mode: the card shows its Dev… list in place of its own: sim/dev.ts)
  let devCard = false;
  const inspectTarget = (h: Hover) => {
    inspected = h && h.kind !== 'scenery' ? h : null;
    inspectMenu = 'main';
    duelAsk = null;
    devCard = false;
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
  /** A card's own actions, with a Dev… button in developer mode; and the dev list once it's tapped. */
  const inspectInfo = (h: NonNullable<Hover>): InspectInfo | null => {
    const info = cardInfo(h);
    if (!info || !snap.dev || (h.kind !== 'person' && h.kind !== 'building' && h.kind !== 'raider' && h.kind !== 'roamer')) return info;
    const act = (id: string, label: string, run: () => void, extra: { danger?: boolean; primary?: boolean } = {}) => {
      inspectRuns.set(id, run);
      return { id, label, ...extra };
    };
    if (!devCard) return { ...info, actions: [...info.actions, act('dev', 'Dev…', () => ((devCard = true), publishInspect()))] };
    const dev = (order: DevOrder, close = false) => () => {
      bridge.command({ type: 'dev', order });
      if (close) inspectTarget(null);
    };
    const list: InspectInfo['actions'] = [];
    if (h.kind === 'person' && snap.people.some((p) => p.id === h.person.id)) {
      const id = h.person.id;
      list.push(
        act('devKill', 'Kill', dev({ op: 'kill', target: 'person', id }, true), { danger: true }),
        act('devDown', 'Knock down', dev({ op: 'down', id })),
        act('devHeal', 'Heal', dev({ op: 'heal', id })),
        act('devLevel', '+1 level', dev({ op: 'levelUp', id, levels: 1 })),
        act('devLevel10', '+10 levels', dev({ op: 'levelUp', id, levels: 10 })),
      );
    } else if (h.kind === 'building') {
      const b = snap.buildings.find((q) => q.id === h.id);
      if (b?.status === 'blueprint') list.push(act('devFinish', 'Finish it now', dev({ op: 'finishBuilding', id: h.id }), { primary: true }));
      list.push(act('devAll', 'Finish all building', dev({ op: 'finishBuilds' })), act('devHarvest', 'Harvest every field', dev({ op: 'harvest' })), act('devFill', 'Fill the stores (+1000, what fits)', dev({ op: 'fill', amount: 1000 })));
    } else if (h.kind === 'raider') {
      list.push(
        act('devKill', 'Kill', dev({ op: 'kill', target: 'raider', id: h.id }, true), { danger: true }),
        act('devKillAll', 'Kill every raider', dev({ op: 'killRaiders' }, true), { danger: true }),
        act('devWin', 'Win the fight', dev({ op: 'winFight' }, true)),
      );
    } else if (h.kind === 'roamer') list.push(act('devKill', 'Kill the band', dev({ op: 'kill', target: 'roamer', id: h.id }, true), { danger: true }));
    return { title: info.title, lines: ['Developer: these act at once.', ...info.lines.slice(0, 2)], actions: [...list, act('devBack', 'Back', () => ((devCard = false), publishInspect()))] };
  };
  const cardInfo = (h: NonNullable<Hover>): InspectInfo | null => {
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
        if (clutterCell(h.cell)) return { title: d.title, lines: d.lines, actions: [act('clear', isMarked(snap.land, h.cell) ? 'Leave it' : 'Clear it', () => bridge.command({ type: 'markClear', cells: [h.cell], on: !isMarked(snap.land, h.cell) }))] };
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
        // (the founder's walk: tap a building, then send them: sim/founder.ts)
        if (snap.founder && b.status === 'done' && inspectMenu === 'main') actions.push(act('founderGo', 'Send the founder here', () => (bridge.command({ type: 'founderGo', building: b.id }), inspectTarget(null))));
        return { title: d.title, lines: d.lines, actions, building: b.id };
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
        // challenge a rival or a troublemaker: the power levels first, then the terms
        const foe = snap.founder?.duels.find((q) => q.id === p.id);
        if (foe && snap.founder && p.id !== snap.mainId) {
          if (duelAsk === p.id) {
            const why = snap.founder.duelBlock;
            return {
              title: d.title,
              lines: [`A duel with ${p.name}: ${foe.why === 'rival' ? 'a rival' : 'a troublemaker'}.`, foe.line, ...(why ? [why] : ['Win and the town respects you. Lose and you are hurt, or dead.'])],
              actions: why
                ? [act('duelBack', 'Back', () => ((duelAsk = null), publishInspect()))]
                : [
                    act('duelYield', 'Fight to yield', () => (bridge.command({ type: 'duel', foe: p.id, to: 'yield' }), inspectTarget(null)), { primary: true }),
                    act('duelDeath', 'Fight to the death', () => (bridge.command({ type: 'duel', foe: p.id, to: 'death' }), inspectTarget(null)), { danger: true }),
                    act('duelBack', 'Back', () => ((duelAsk = null), publishInspect())),
                  ],
            };
          }
          lines.push(foe.line);
        }
        const duelAct = foe && p.id !== snap.mainId ? [act('duel', 'Challenge to a duel…', () => ((duelAsk = p.id), publishInspect()))] : [];
        const founderAct = p.id === snap.mainId ? [act('founder', 'The founder…', () => bridge.openPanel('founder'), { primary: true })] : [];
        // (the founder isn't on the People list: their card leads to their own tab only)
        const more = p.id === snap.mainId ? [] : [act('more', 'Townsfolk…', () => bridge.openPanel('townsfolk'))];
        return { title: d.title, lines, actions: [...founderAct, ...duelAct, ...watchAct, ...rallyAct, followAct, ...more] };
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
      case 'creature':
        return {
          title: d.title,
          lines: d.lines,
          actions: [
            ...(snap.creature?.ask ? [act('praise', 'Praise', () => bridge.command({ type: 'creature', op: 'praise' }), { primary: true }), act('scold', 'Scold', () => bridge.command({ type: 'creature', op: 'scold' }), { danger: true })] : []),
            act('feed', 'Feed', () => bridge.command({ type: 'creature', op: 'feed' })),
            act('rest', 'Rest', () => bridge.command({ type: 'creature', op: 'rest' })),
            act('more', `${snap.creature?.name ?? 'Its'} menu…`, openCreature),
          ],
        };
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
    () => bridge.openPanel(selectedPerson !== null && selectedPerson === snap.mainId ? 'founder' : 'townsfolk'), // (the founder: their own tab)
    () => selectPerson(null),
  );

  const showPersonCard = () => {
    const p = selectedPerson !== null ? snap.people.find((q) => q.id === selectedPerson) : undefined;
    const at = selectedPerson !== null ? people.posOf(selectedPerson) : null;
    if (!p || at === null || view.mode !== 'full') {
      if (selectedPerson !== null && !p) selectedPerson = null;
      return personCard.hide();
    }
    personCard.show(p, p.id === snap.mainId, map.screenOf(at.x, at.y).x, guildsOf(snap, p.id));
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
  (window as unknown as { __showOnMap?: (a: { person?: number; building?: number; traveller?: number; village?: number; funeral?: number }) => boolean }).__showOnMap = (a) => {
    // (someone's funeral under way, else their grave, else the graveyard: the obituary's "Watch", mobile/obituaryReveal.ts)
    if (a.funeral != null) {
      const g = snap.gathering && (snap.gathering.kind === 'funeral' || snap.gathering.kind === 'great_funeral') ? snap.gathering : null;
      const yard = snap.buildings.find((b) => b.def === 'graveyard' && b.status === 'done');
      const at = g ? (g.head ?? { x: g.x, y: g.y }) : (graves.posOf(a.funeral) ?? (yard ? { x: (yard.tile + 1) * CELL, y: (yard.row + 1) * CELL } : null));
      if (!at) return false;
      camera.centreOn(at, app.screen.width, app.screen.height);
      return true;
    }
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

  /** The Town menu's More tab, where the villages are (panel/villagesPanel.ts), asked for through the storage the frames share. */
  const openVillages = () => {
    try {
      localStorage.setItem('littletown.subtab.build', 'More');
    } catch {}
    bridge.openPanel('build');
  };

  /** The People menu's Creature tab (the God creature's overview: panel/townsfolkPanel.ts), asked for the same way. */
  const openCreature = () => {
    try {
      localStorage.setItem('littletown.subtab.townsfolk', 'Creature');
    } catch {}
    bridge.openPanel('townsfolk');
  };

  /* -------------------------------------------------------- placing buildings */

  const checkPlacement = (def: BuildingDef, x: number, y: number): PlaceCheck => {
    if (!isUnlocked({ unlockAll: snap.unlockAll, done: snap.research.done }, def)) return { ok: false, reason: 'Not researched yet' };
    if (blueprintCount(snap) >= snap.buildSlots) return { ok: false, reason: 'Construction queue is full' };
    return canPlace({ land: snap.land, buildings: snap.buildings, origin: snap.origin.id, era: snap.era, explored: snap.explored }, def, x, y);
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
    if (defId === DRAW_PATH) return startDraw(); // (the build menu's Draw a path)
    if (drawing) endDraw(true);
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
    if (h?.kind === 'creature') return bridge.openPanel('townsfolk');
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
      if (under.shown) return under.zoom(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); // (the Underdark: the wheel zooms)
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
  // (the Underdark's view pinches on its own: its fingers, and how far apart they were last)
  const underTouches = new Map<number, { x: number; y: number }>();
  let underPinch: number | null = null;
  const underSpread = () => {
    const [a, b] = [...underTouches.values()];
    return a && b ? Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)) : 20;
  };
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
  /** The cell a finger means in Clear mode: the one under it if `want` takes it, else one a little lower down the screen
   *  (a tree's canopy stands above its own cell, so a tap on the leaves lands north of the trunk). */
  const clearCellAt = (sx: number, sy: number, want: (cell: number) => boolean): number | null => {
    for (const dy of [0, 12, 24]) {
      const w = map.worldOf(sx, sy + dy);
      const cell = map.cellAt(w.x, w.y);
      if (cell !== null && want(cell)) return cell;
    }
    return null;
  };
  /** A finger sweeping in Clear mode: the cells along its path that can take the sweep's mark (or lift it). */
  const sweepOver = (sx: number, sy: number) => {
    if (!sweep) return;
    const on = sweep.on;
    const want = (c: number) => (on ? clearableCell(c) && !isMarked(snap.land, c) : isMarked(snap.land, c));
    const steps = Math.max(1, Math.ceil(Math.hypot(sx - sweep.last.x, sy - sweep.last.y) / (CELL / 2)));
    for (let k = 1; k <= steps; k++) {
      if (sweep.cells.size >= MARK_CLEAR_CAP) break;
      const cell = clearCellAt(sweep.last.x + ((sx - sweep.last.x) * k) / steps, sweep.last.y + ((sy - sweep.last.y) * k) / steps, want);
      if (cell !== null) sweep.cells.add(cell);
    }
    sweep.last = { x: sx, y: sy };
    const w = map.worldOf(sx, sy);
    setHighlight(clearCellAt(sx, sy, (c) => clearableCell(c) || isMarked(snap.land, c)) ?? map.cellAt(w.x, w.y));
  };
  // (a tactics battle has the screen: a tap is its, a drag looks about the board)
  let boardPress: { x: number; y: number; lx: number; ly: number; moved: boolean; id: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    if (under.shown && e.pointerType === 'touch') {
      // (the Underdark: two fingers pinch it closer or farther)
      underTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (underTouches.size === 2) {
        boardPress = null;
        underPinch = underSpread();
        return;
      }
    }
    if (tactics.shown || deep.shown || under.shown) {
      boardPress = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false, id: e.pointerId };
      return;
    }
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && bridge.pinch) {
        // a second finger: this is a pinch, not a drag or a tap
        if (camera.dragging) camera.endDrag(e.timeStamp);
        press = null;
        sweep = null;
        dropStroke();
        pinchFrom = Math.max(20, spread());
        bridge.pinch('start', pinchFrom, ...between());
        return;
      }
      if (pinchFrom !== null || afterPinch) return;
    }
    if (drawing && e.button === 0 && !stroke) {
      // (a press on a cell of blueprint lifts; anywhere else lays; off the land, nothing)
      const cell = cellUnder(e.clientX, e.clientY);
      if (cell === null) return;
      stroke = { id: e.pointerId, on: !plannedAt(cell), from: cell, to: cell, x: e.clientX, y: e.clientY, moved: false, ground: groundNow() };
      setHighlight(cell);
      showStroke();
      canvas.setPointerCapture(e.pointerId);
      return;
    }
    if (clearing && !placing && e.button === 0 && !sweep) {
      const cell = clearCellAt(e.clientX, e.clientY, (c) => clearableCell(c) || isMarked(snap.land, c));
      sweep = { id: e.pointerId, on: cell === null || !isMarked(snap.land, cell), cells: new Set(), last: { x: e.clientX, y: e.clientY } };
      sweepOver(e.clientX, e.clientY);
      canvas.setPointerCapture(e.pointerId);
      return;
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
    if (under.shown && underTouches.has(e.pointerId)) {
      underTouches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (underPinch !== null && underTouches.size >= 2) {
        const now = underSpread();
        const [a, b] = [...underTouches.values()];
        under.zoom(now / underPinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        underPinch = now;
        return;
      }
    }
    if ((tactics.shown || deep.shown || under.shown) && boardPress && e.pointerId === boardPress.id) {
      if (Math.hypot(e.clientX - boardPress.x, e.clientY - boardPress.y) >= DRAG_THRESHOLD) boardPress.moved = true;
      if (boardPress.moved) (under.shown ? under : deep.shown ? deep : tactics).pan(e.clientX - boardPress.lx, e.clientY - boardPress.ly);
      boardPress.lx = e.clientX;
      boardPress.ly = e.clientY;
      return;
    }
    if (stroke && e.pointerId === stroke.id) return strokeOver(e.clientX, e.clientY);
    if (sweep && e.pointerId === sweep.id) return sweepOver(e.clientX, e.clientY);
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
    underTouches.delete(e.pointerId);
    if (underTouches.size < 2) underPinch = null;
    if (boardPress && e.pointerId === boardPress.id) {
      const was = boardPress;
      boardPress = null;
      if (!was.moved && e.type === 'pointerup' && tactics.shown) tactics.tap(e.clientX, e.clientY);
      else if (!was.moved && e.type === 'pointerup' && under.shown) under.tap(e.clientX, e.clientY);
      return;
    }
    touches.delete(e.pointerId);
    if (pinchFrom !== null && touches.size < 2) {
      bridge.pinch?.('end', 0);
      pinchFrom = null;
      afterPinch = true;
    }
    if (touches.size === 0) afterPinch = false;
    if (stroke && e.pointerId === stroke.id) {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      // (a touch the page takes back, as its own pinch might, lays nothing)
      if (e.type === 'pointerup') strokeDone();
      else dropStroke();
      return;
    }
    if (sweep && e.pointerId === sweep.id) {
      const done = sweep;
      sweep = null;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      setHighlight(null);
      // (a touch the page cancels, as its own scroll or pinch might, still sends what it swept)
      if (done.cells.size) bridge.command({ type: 'markClear', cells: [...done.cells].slice(0, MARK_CLEAR_CAP), on: done.on });
      else if (e.type === 'pointerup') toasts.push('Nothing to clear here');
      return;
    }
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
    music.update(s.music && !s.hidden, musicMood(snap), festivalSong(snap));
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

  // Each notice is shown once; ones from before this page loaded are skipped.
  let lastNotice = first.notices.at(-1)?.id ?? 0;
  let homecomingSeen = first.homecoming?.tick ?? -1;
  const heldToasts: string[] = [];
  const HELD_TOASTS = 3;
  const showNotices = (next: Snapshot) => {
    // (upright on the phone the feed above the town shows the news: the strip pops up only what the feed leaves out)
    const feedShown = document.body.classList.contains('feed-shown');
    // (a raid's battle or a watched fight is never interrupted: what comes meanwhile waits, the last few of it shown
    // once it's over; the rest is in the news bubble)
    const fresh = next.notices.filter((n) => n.id > lastNotice && (!feedShown || CHATTER.test(n.text) || next.fightOn || !!next.tactics)).map((n) => n.text);
    if (next.fightOn || next.tactics) heldToasts.push(...fresh);
    else {
      for (const t of heldToasts.slice(-HELD_TOASTS)) toasts.push(t);
      heldToasts.length = 0;
      for (const t of fresh) toasts.push(t);
    }
    lastNotice = Math.max(lastNotice, next.notices.at(-1)?.id ?? 0);
  };

  let lastShake: number | null = null;
  let shakeUntil = 0;
  let lastCamp: { x: number; y: number } | null = null;
  let buildStyle = 'town';
  // the trail battle's juice, from what changed since the last snapshot: blows on raiders and townsfolk, raiders
  // felled, a new wave, the end
  let recapHold = 0;
  let juiceEnd = 0;
  const juiceTrail = (next: Snapshot) => {
    const b = next.battle;
    const was = snap.battle;
    if (b && !was) {
      mapJuice.reset();
      juiceEnd = 0;
      mapJuice.showBanner('Defend the town!', next.raid?.name ?? 'Raiders', 0xffe070, 2.6);
    }
    if (b && was) {
      if (b.wave > was.wave) mapJuice.showBanner(`Wave ${b.wave} of ${b.waves}`, `${b.coming} raiders coming`, 0xff9a40);
      else if (b.phase === 'fighting' && was.phase !== 'fighting' && b.wave <= 1) mapJuice.showBanner('Here they come!', null, 0xff6050, 1.8);
      if (b.killed > was.killed) mapJuice.killed(b.killed - was.killed);
      const before = new Map((snap.raid?.raiders ?? []).map((r) => [r.id, r]));
      for (const r of next.raid?.raiders ?? []) {
        const o = before.get(r.id);
        if (!o || r.ally || r.hp >= o.hp) continue;
        mapJuice.hit(r.x, r.y - 24, { label: String(Math.round(o.hp - r.hp)), share: (o.hp - r.hp) / Math.max(1, r.maxHp), onFoe: true });
      }
      const folk = new Map(snap.people.map((p) => [p.id, p]));
      for (const p of next.people) {
        const o = folk.get(p.id);
        if (!o || p.away !== null || p.hp >= o.hp || o.hp - p.hp < 1) continue;
        mapJuice.hit(p.x, p.y - 30, { label: String(Math.round(o.hp - p.hp)), share: (o.hp - p.hp) / Math.max(1, p.maxHp), onFoe: false });
      }
    }
    if (!b && was) {
      const r = next.raidRecap;
      const won = !!r && r.outcome !== 'pillaged';
      mapJuice.win(won, r ? `${r.killed} felled${r.outcome === 'victory' ? ' · not one got away' : ''}` : '');
      recapHold = performance.now() + VICTORY_MS;
      juiceEnd = performance.now() + VICTORY_MS;
    }
    if (juiceEnd && performance.now() > juiceEnd) {
      mapJuice.reset();
      juiceEnd = 0;
    }
  };

  const applySnapshot = (next: Snapshot) => {
    // a raid's battle, while there is one: drawn over the town's map; the camera looks to the gate as it begins
    const begun = !!next.battle && !snap.battle;
    battle.update(next);
    battleHud.update(next.battle, next.raid?.name ?? 'Raiders');
    juiceTrail(next);
    document.body.classList.toggle('board-on', !!(next.tactics || next.watch));
    // (the recap waits while the victory has its moment)
    if (performance.now() >= recapHold) raidRecap.update(next);
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
    fight.update(watched, next.biome, next.calendar.season, next.origin.id === 'merfolk' || (!!watched?.boat && watched.phase !== 'work'), new Set(next.people.filter((p) => p.mer).map((p) => p.id)));
    fightHud.update(watched, next.fightSpeed, next.guilds);
    // (a mine gone into: the same screen, unless a fight or battle has it)
    const inMine = watched || next.battle ? null : next.mine;
    mine.update(inMine);
    fightHud.mine(inMine);
    // (the Deep looked into: the same, unless a fight, battle or mine has the screen)
    const below = watched || next.battle || inMine || next.tactics ? null : next.deepView;
    deep.update(below);
    // (the Underdark looked into: the same, unless the Deep has it)
    const caves = watched || next.battle || inMine || below || next.tactics ? null : next.underView;
    under.update(caves, next);
    // (a portal looked through: the same again)
    const beyond = watched || next.battle || inMine || below || caves || next.tactics ? null : next.portalView;
    portal.update(beyond);
    // (inside a building: the same again)
    const within = watched || next.battle || inMine || below || caves || beyond || next.tactics ? null : next.interior;
    interior.update(within, next.people);
    tactics.update(next);
    // (a scene is offered only while nothing else has the screen: a battle, a watched fight, a question)
    cutscene.update(next.scene, next.era, !!(next.battle || next.raid || watched || inMine || below || caves || beyond || within || next.tactics || next.prompts.length));
    map.root.visible = !watched && !inMine && !below && !caves && !beyond && !within && !next.tactics && !cutscene.shown;
    showNotices(next);
    // (the town's sounds: blows, spells, coins, bells... when the sound is on and the town is on screen)
    if (view.music && !view.hidden) {
      const heard = map.root.visible
        ? soundsBetween(snap, next, map.view)
        : [
            ...globalSounds(snap, next),
            ...(watched && snap?.watch ? fightSounds(snap.watch, watched, next.tick - snap.tick) : []),
            ...(next.tactics ? tacticsSounds(snap, next) : []),
          ];
      for (const c of heard) ambience.cue(c.cue, c.pan, c.delay);
    }
    // (the big moments buzz the phone: the horn, a quake, a building coming down, which is heard too where it's seen)
    for (const k of buzzesBetween(snap, next)) buzz(k);
    const mv = map.view;
    const fell = view.music && !view.hidden && map.root.visible ? collapsesBetween(snap, next).map((b) => buildingCentre(b)).find((c) => c.x >= mv.x && c.x <= mv.x + mv.w && c.y >= mv.y && c.y <= mv.y + mv.h) : undefined;
    if (fell) ambience.cue('collapse', ((fell.x - mv.x) / Math.max(1, mv.w)) * 1.6 - 0.8);
    // (what rose and what was finished since the last snapshot: map/workSeen.ts)
    const gained = map.root.visible && !view.hidden ? gainsBetween(snap, next) : [];
    const finished = map.root.visible && !view.hidden ? finishedBetween(snap, next) : [];
    // (a party the player sent, or watched, has come home through the gate: the camera goes to meet them, once)
    if (next.homecoming && next.homecoming.tick !== homecomingSeen && !next.watch) {
      homecomingSeen = next.homecoming.tick;
      camera.centreOn({ x: next.homecoming.x, y: next.homecoming.y }, app.screen.width, app.screen.height);
    }
    snap = next;
    hud.update(next);
    music.update(view.music && !view.hidden, musicMood(next), festivalSong(next));
    const freeze = next.doom?.kind === 'deep_freeze' && next.doom.phase === 'active';
    // (on the phone, heavy cloud dims the land a little)
    const gloom = fullSky ? ({ clear: 0, cloudy: 0.04, rain: 0.12, storm: 0.22, snow: 0.05, fog: 0.08 } as const)[next.weather.kind] : 0;
    lightMap.calm = map.calm;
    lightMap.sync(next);
    map.realLight = lightMap.active;
    map.setDaylight(next.calendar.daylight * (1 - gloom), freeze);
    map.setCast(next.align.cast);
    lightDaylight = next.calendar.daylight * (1 - gloom);
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
      setStatueFolk(next.honoured);
      ruins.sync(next.ruins);
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
    beast.sync(next.creature);
    if (next.creature?.ask) beastAsk.show(next.creature.ask.id, next.creature.ask.text);
    else beastAsk.hide();
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
      // (a burning building crackles and roars: louder the nearer the middle of the view and the more it has burned)
      ambMix.fire = Math.max(ambMix.fire, burnLevel(next.buildings.filter((b) => b.fire !== undefined).map((b) => ({ ...buildingCentre(b), fire: b.fire! })), v));
      // (and the town's hearths crackle where they stand, louder after dark: isoSounds.ts `hearthLevel`)
      const hearths = next.buildings.filter((b) => b.status === 'done' && HEARTH.test(b.def)).map((b) => ({ def: b.def, status: b.status, ...buildingCentre(b) }));
      if (hearths.length) ambMix.fire = Math.max(ambMix.fire, hearthLevel(hearths, v) * (0.4 + 0.4 * (1 - next.calendar.daylight)));
      const raidNow = next.raid?.phase === 'active';
      if (raidNow && !wasRaid) ambience.cue('horn', 0, 0.2);
      wasRaid = raidNow;
      // (each worker in view heard about every second, by their work: the axe, the pick, the hammer, a station's own
      //  trade, the sickle and the hoe; a few at most: sfx.ts)
      //  (only while the map is on the screen: not over a watched fight, the raid's board or a room looked into)
      const mapShown = map.root.visible;
      // (the town heard where it is: the tavern, the market, the hymns, the forge, the herds, by the view: soundZones.ts)
      ambZones = mapShown ? zoneMix(zoneSources(next), v) : quietZones();
      if (mapShown) for (const c of workSounds(next, v)) ambience.cue(c.cue, c.pan, c.delay);
      if (mapShown && water.count > 0 && Math.random() < 0.012) ambience.cue('quack', Math.random() * 1.2 - 0.6);
      // (boots crunching in the snow, feet sucking in the mud: a few of the steps laid, panned by where they fell)
      let heard = 0;
      for (const st of tracks.takeSteps()) {
        if (!mapShown || heard >= 3 || st.ground === 'sand' || Math.random() > 0.5) continue;
        heard++;
        ambience.cue(st.ground === 'snow' ? 'crunch' : 'squelch', st.x * 1.6 - 0.8, Math.random() * 0.1);
      }
    }
    wildlife.land = next.land;
    wildlife.wild = next.wild;
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
    // map draws it: art/buildingPicture.ts)
    folkKnow(next.people);
    setFolkFounder(next.mainId); // (the founder wears their own look everywhere: iso/folkWho.ts)
    hkKnow(next.people); // (who's who, for the views that know someone only by id: the fight screen, the mine)
    (window as unknown as { __picture?: (p: { person?: number; building?: string; fallen?: number }) => HTMLCanvasElement | null }).__picture = (h) => {
      // (the dead, from the look their obituary keeps: art/fallenFace.ts)
      const gone = h.fallen != null ? next.annals.fallen.find((f) => f.id === h.fallen) : undefined;
      if (gone) return fallenFace(gone, 64);
      const who = h.person != null ? next.people.find((p) => p.id === h.person) : undefined;
      if (who) return personPicture(who);
      if (h.building && BUILDING_BY_ID[h.building]) {
        const old = buildingPicture(h.building, buildStyle || 'town', 96, 64);
        // (the isometric view: the kit piece the map draws; until its image is in, a copy of the old picture that the
        // menu asks for again, not keeps)
        const iso = isoPicture(h.building, next.origin.id, next.theme, 96, 64);
        if (iso) return iso;
        if (!old) return null;
        const copy = document.createElement('canvas');
        copy.width = old.width;
        copy.height = old.height;
        copy.getContext('2d')!.drawImage(old, 0, 0);
        return copy;
      }
      return null;
    };
    const q = next.prompts.find((p) => !p.parked);
    promptCard.waiting(next.prompts.filter((p) => p.parked).sort((a, b) => a.id - b.id));
    // (on the phone, a choice event has the whole screen: mobile/eventSheet.ts)
    if (q && view.mode === 'full' && !next.fightOn && !next.tactics && !(EVENT_BOX_KINDS.has(q.kind) && (window as unknown as { __eventSheet?: boolean }).__eventSheet)) promptCard.show(q);
    else promptCard.hide();
    if (next.gameOver) gameOver.show(next.gameOver.text, next.gameOver.won, next.gameOver);
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
    {
      iso.syncLand(next.land);
      iso.setKit(kitNameFor(next.origin.id, next.theme));
      iso.setBiome(next.biome);
      iso.setValley(next.valley);
      iso.setCastle(next.castle ?? null);
      iso.syncBuildings(next.buildings);
    }
    minimap.setLand(next.land, next.calendar.season);
    fog.sync(next.land.w, next.land.h, next.explored, next.sight);
    minimap.fog = fog.on ? fog.canvas : null;
    map.tick = next.tick;
    {
      iso.setWalkers([...next.people.filter((p) => p.away === null && !p.indoors), ...inSightOnly(next.raid?.phase === 'active' ? next.raid.raiders : [])]);
      iso.setLamps(next.lights ? next.lights.lights.filter((l) => l.room === null) : [], next.era);
      iso.setInside(next.litInside, next.calendar.hour); // (whose windows glow after dark)
    }
    // (the gates shut at night and when raiders come: the palisade's are drawn closed)
    map.gatesShut = next.calendar.hour >= GATES_SHUT_FROM || next.calendar.hour < GATES_OPEN_AT || !!next.raid;
    map.syncBuildings(next.villageBuildings.length ? [...next.buildings, ...next.villageBuildings] : next.buildings);
    felling.season = next.calendar.season;
    felling.sync(next.land, next.buildings);
    chores.sync({ buildings: next.buildings, people: next.people, tick: next.tick, era: next.era, weather: next.weather.kind, season: next.calendar.season, daylight: next.calendar.daylight, landW: next.land.w });
    gainsView.add(gained, finished, map.calm);
    for (const f of finished) people.cheer(f.builders, performance.now());
    if (view.music && finished.length) {
      const f = finished[0];
      const mv = map.view;
      if (f.x >= mv.x && f.x <= mv.x + mv.w && f.y >= mv.y && f.y <= mv.y + mv.h) ambience.cue('built', ((f.x - mv.x) / Math.max(1, mv.w)) * 1.6 - 0.8);
    }
    map.workFx.sync(next.buildings, next.workingAt);
    map.workFx.syncBuilders(next.people.filter((p) => p.activity === 'build' && !p.indoors).map((p) => ({ id: p.id, x: p.x, y: p.y, dir: p.dir })));
    herds.update(next.buildings);
    battleHud.guilds = next.guilds; // (the badges on the raid bar's chips)
    boats.update(next.tradeShips?.length ? [...next.fleet, ...next.tradeShips] : next.fleet, next.mooring, next.land); // (the empire's ships sail the fleet's lane in the fleet's sprites: sim/boats.ts)
    airships.update(next.airships, next.mast, next.skyPirates);
    wagons.update(next.wagons);
    pools.sync(next.blood);
    debris.sync(next.debris);
    market.sync(next.market);
    decor.sync(next.buildings, next.calendar.season);
    // (a raid on its way: the shutters close, the alarm goes up and the children run home; smoke over any fire)
    map.setShutters(!!next.raid);
    map.smokeColumns.sync(next.buildings);
    people.alarm = !!next.raid;
    const plague = plagueOn(next.doom, next.people.filter((p) => p.sick).length);
    people.plague = plague;
    homes.sync(next.buildings, next.people, map.fronts(), plague, (def) => pickCovered(def, buildStyle || 'town'));
    homeSigns.sync(next.buildings, stripScale);
    signs.sync(next.land, next.realm, (x, y) => !wet(groundAt(next.land, x, y)) && !next.buildings.some((b) => {
      const f = footprintOf(b);
      return x >= f.x - 1 && x < f.x + f.w + 1 && y >= f.y && y < f.y + f.h + 1;
    }), `${next.buildings.length}`);
    lamps.sync(next.land, next.era, next.lights ? next.lights.lights.filter((l) => l.room === null) : null);
    lamps.setDaylight(next.calendar.daylight);
    lamps.setCast(next.align.cast);
    lamps.calm = map.calm;
    critters.sync(next, lamps.litGlows());
    critters.folk = birds.folk;
    wide.sync(next, buildStyle === 'lich' || buildStyle === 'vampire', birds.folk);
    Object.assign(frost, { season: next.calendar.season, dayOfSeason: next.calendar.dayOfSeason, day: next.calendar.day, hour: next.calendar.hour, daylight: next.calendar.daylight, weather: next.weather.kind, cold: !!biomeById(next.biome).cold, buildings: next.buildings });
    skiffs.on = next.calendar.daylight > 0.35 && next.weather.kind !== 'storm' && next.raid?.phase !== 'active';
    skiffs.era = next.era;
    skiffs.season = next.calendar.season;
    skiffs.land = next.land;
    traffic.on = skiffs.on && next.weather.kind !== 'snow';
    traffic.land = next.land;
    disaster.sync(next.disaster, next.land.w);
    // (a raid skipped to its recap: a word over the fast-forwarding battle, sim/raidSkip.ts)
    let skipNote = document.getElementById('raid-skipping');
    if (next.raidSkipping && !skipNote) {
      skipNote = document.createElement('div');
      skipNote.id = 'raid-skipping';
      skipNote.textContent = 'The town fights it out… ⏭';
      document.body.append(skipNote);
    }
    if (skipNote) skipNote.style.display = next.raidSkipping ? '' : 'none';
    setTownSayings(next.culture?.sayings);
    setCultureColour(next.culture?.colour ?? null);
    setCultureMotif(next.culture?.song ?? null);
    map.festival.syncProp(next.culture?.kit ?? null, next.culture?.at ?? null);
    map.festival.sync(next.gathering, next.festivals?.on && next.festivals.on.phase !== 'held' ? next.festivals.on : null);
    map.syncCastle(next.castle ?? null, next.buildings);
    map.syncPlaces(next.places);
    map.syncBlight(next.blight ?? [], next.calamity?.heartAt ?? null);
    map.syncLeylines(next.magic ?? null); // (the leylines glowing after dark: map/mapLeylines.ts)
    // (a nomad tribe that moved camp: the view goes to the new camp)
    if (lastCamp !== null && (next.camp.x !== lastCamp.x || next.camp.y !== lastCamp.y)) camera.centreOn(next.camp, app.screen.width, app.screen.height);
    lastCamp = next.camp;
    people.moon = next.moonNight;
    people.theme = next.theme;
    people.weather = next.weather.kind;
    people.news = next.news;
    people.gossip = next.gossip;
    scenes.sync(next.people);
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
    // the town being itself (map/townLife.ts): the watch changing, the curious at the windows, the children's winter,
    // the procession, the windows going dark house by house, a lookout on every tower
    people.minute = next.calendar.minute;
    people.calm = townLife.calm = map.calm;
    people.nearBuilding = (x, y) => map.nearBuilding(x, y - 6, 6);
    const proc = next.gathering?.head ? next.gathering : null;
    people.procession = proc ? { kind: proc.kind, bearers: proc.bearers ?? [] } : null;
    townLife.syncProcession(proc && proc.kind !== 'wedding' && proc.kind !== 'feast' && proc.kind !== 'rite' && proc.kind !== 'festival' ? proc.head! : null, proc?.bearers ?? []);
    const home = next.people.filter((p) => p.away === null);
    const winter = next.calendar.season === 'winter';
    const pairs = winter ? snowballPairs(home.filter((p) => p.growsUpIn !== null && p.activity === 'play' && !p.indoors)) : [];
    people.snowballs = new Map(pairs.flatMap(([a, b]): [number, { other: number; first: boolean; seed: number }][] => [[a, { other: b, first: true, seed: a * 31 + b }], [b, { other: a, first: false, seed: a * 31 + b }]]));
    townLife.syncSnowballs(pairs);
    map.darkWindows(darkHomes(next.people));
    const doors = new Map(next.buildings.filter((b) => b.status === 'done').map((b) => [b.id, b]));
    const melt = snowmanLeft(next.calendar.season, next.calendar.dayOfSeason, next.calendar.hour);
    townLife.syncSnowmen(
      snowmanHomes(next.people.map((p) => ({ bedId: p.bedId, child: p.growsUpIn !== null })))
        .filter((id) => doors.has(id) && !next.castle?.cells.length)
        .map((id) => ({ id, door: buildingDoor(doors.get(id)!) })),
      melt,
    );
    const watchers = home.filter((p) => p.growsUpIn === null && !p.tireless);
    const lookouts = watchers.filter((p) => p.guard).concat(watchers.filter((p) => !p.guard));
    townLife.syncLookouts(
      lookouts.length
        ? next.buildings
            .filter((b) => b.status === 'done' && LOOKOUT_TOWERS.has(b.def) && next.raid?.phase !== 'active')
            .flatMap((b) => {
              const pic = map.pictureOf(b.id);
              return pic ? [{ id: b.id, x: pic.x + pic.w / 2, y: pic.top + Math.round(pic.h * 0.3), look: lookouts[b.id % lookouts.length].look, who: lookouts[b.id % lookouts.length] }] : [];
            })
        : [],
    );
    publishInspect(); // (the phone's top card keeps up with what it shows)
    weather?.update(next.calendar, next.weather);
    people.revived = next.revived ? { ...next.revived, at: performance.now() } : null;
    people.fx = next.fx.map((f) => ({ ...f, at: performance.now() }));
    people.update(
      [...next.people.filter((p) => p.away === null), ...inSightOnly([...next.travellers.map(travellerPerson), ...(next.envoyRider ? [envoyPerson(next.envoyRider)] : []), ...villagerFigures(next, performance.now()), ...wide.riders().map(courierPerson)])],
      next.visitor,
      performance.now(),
    );
    raiders.creature = next.creature; // (the God creature fighting among them: its tint and growth)
    raiders.update(inSightOnly(next.raid?.phase === 'active' ? next.raid.raiders : []) as RaiderView[], performance.now());
    roamers.update(inSightOnly(roamerFigures(next.roamers)) as RaiderView[], performance.now());
    penned.update(ranchFigures(next.ranchPens ?? [], performance.now()), performance.now());
    spells.update(next.spells, next.camp, performance.now());
    if (hover || placing) refreshHover(); // tooltip contents change as work progresses
    if (selected) showActions();
    if (selectedPerson !== null) showPersonCard();
  };
  bridge.onSnapshot((next) => {
    applyGivenNames(next); // (a unique's own name over its default: sim/naming.ts)
    if (pinching) heldSnap = next;
    else applySnapshot(next);
  });
  applySnapshot(first);
  requestAnimationFrame(() => requestAnimationFrame(() => void stripLoad.then((l) => l.drawn()))); // (the map has drawn)

  /* -------------------------------------------------------- frame loop */

  let viewW = 0;
  let viewH = 0;
  // The page zooms the strip about the point between the fingers (mobile.ts): once the strip is laid out again at
  // the new scale, the view is moved so what was under the fingers stays there (mx, my: the point in the strip's old
  // pixels; from, to: the scales the strip was and is shown at). The resize below keeps the middle still; this is the
  // rest, for a point off the middle.
  Object.assign(window, {
    // (nx, ny: where the fingers were when they lifted, if they moved together: the point under them at the start goes
    // there, so a pinch pans as well)
    __zoomAbout: (mx: number, my: number, from: number, to: number, nx = mx, ny = my) =>
      camera.shift(mx - viewW / 2 - ((nx - viewW / 2) * from) / to, my - viewH / 2 - ((ny - viewH / 2) * from) / to),
    // While two fingers are down the page only moves and scales the canvas (mobile.ts), so the strip stops drawing and
    // holds the snapshots that come meanwhile; when they lift it draws again from the latest.
    __pinching: (on: boolean) => {
      pinching = on;
      if (on) {
        app.ticker.stop();
        return;
      }
      resumedAt = performance.now();
      app.ticker.start();
      const held = heldSnap;
      heldSnap = null;
      if (held) applySnapshot(held);
    },
  });
  /** How long the camera leaves the view alone after the player pans it, before easing back to the founder. */
  const FOLLOW_WAIT_MS = 4000;
  app.ticker.add((ticker) => {
    const w = layoutSplit(); // the town's share of the width
    // zoomed (the strip got wider or narrower): keep the middle of the view where it was
    const h = app.screen.height;
    if (w !== viewW || h !== viewH) {
      if (viewW) camera.shift((viewW - w) / 2, (viewH - h) / 2);
      viewW = w;
      viewH = h;
    }
    // (the camera follows only the person you chose to follow, never the founder by default (the owner's ask), and
    // waits while you pan about: it eases to them, and a battle's own move to the gate is left alone)
    const lead = snap.hero != null ? snap.people.find((q) => q.id === snap.hero) : undefined;
    if (lead && !snap.raid && !snap.gameOver) {
      const at = people.posOf(lead.id) ?? { x: lead.x, y: lead.y };
      camera.follow(at, w, h, performance.now(), FOLLOW_WAIT_MS);
    }
    const moving = camera.update(ticker.deltaMS / 1000, w, h);
    {
      iso.setCamera(camera.x, camera.y, w, h);
      const lv = iso.lightView(); // (a square of world px that covers the whole screen, whatever the slant)
      map.setCamera(lv.x, lv.y, lv.w, lv.h);
      iso.air.position.set(w / 2 - (lv.x + lv.w / 2), h / 2 - (lv.y + lv.h / 2)); // (the fog banks fill the screen)
      iso.setNight(map.lights.alpha);
      iso.animate(ticker.deltaMS / 1000);
    }
    // screen shake (a boss's roar or sweeping attack)
    const shaking = performance.now() < shakeUntil;
    // (and the trail battle's: heavy blows and kills, battle/juice.ts)
    mapJuice.render(performance.now(), app.screen.width, app.screen.height);
    const [jx, jy] = mapJuice.shake();
    app.stage.position.set((shaking ? Math.round((Math.random() - 0.5) * 6) : 0) + jx, (shaking ? Math.round((Math.random() - 0.5) * 4) : 0) + jy);
    people.render(performance.now());
    townLife.render(performance.now());
    raiders.render(performance.now());
    roamers.render(performance.now()); // (the bands on the land: drawn only once this was added)
    penned.render(performance.now()); // (the ranch's beasts)
    beast.render(ticker.deltaMS / 1000);
    herds.render(performance.now(), ticker.deltaMS / 1000);
    market.render(ticker.deltaMS / 1000);
    lamps.render(ticker.deltaMS / 1000);
    skiffs.render(ticker.deltaMS / 1000, map.view, map.calm);
    traffic.render(ticker.deltaMS / 1000, map.view, map.calm);
    boats.render(performance.now());
    airships.render(performance.now(), map.wind());
    birds.render(ticker.deltaMS / 1000, performance.now());
    wildlife.render(ticker.deltaMS / 1000, performance.now());
    water.render(ticker.deltaMS / 1000);
    tracks.render(ticker.deltaMS / 1000);
    felling.render(ticker.deltaMS / 1000, map.calm, map.wind());
    gainsView.render(ticker.deltaMS / 1000, map.calm);
    chores.render(ticker.deltaMS / 1000, performance.now(), map.calm, map.wind());
    iso.placeLoose(); // (everyone drawn into the things in world px, moved onto the diamonds)
    iso.setPicked(inspected?.kind === 'building' ? inspected.id : (selected?.id ?? null));
    iso.seeThrough(ticker.deltaMS / 1000); // (what stands in front of someone fades, so they show)
    if (snap && minimap.shown)
      minimap.render({
        people: snap.people.filter((p) => p.away === null).map((p) => ({ x: p.x, y: p.y })),
        raiders: snap.raid?.phase === 'active' ? inSightOnly(snap.raid.raiders).map((r) => ({ x: r.x, y: r.y })) : [],
        places: snap.places.filter((p) => p.found).map((p) => ({ x: p.x, y: p.y, waiting: !!p.dest, nest: !!p.nest })),
        heart: snap.calamity?.heartAt ? { x: (snap.calamity.heartAt.x + 0.5) * 32, y: (snap.calamity.heartAt.y + 0.5) * 32 } : null,
        buildings: [...snap.buildings, ...snap.villageBuildings].map((b) => {
          const r = footprintOf(b);
          return { x: r.x * CELL, y: r.y * CELL, w: r.w * CELL, h: r.h * CELL };
        }),
        view: iso.worldView(),
        quad: iso.viewQuad(),
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
    lightMap.render(map.view, lightDaylight);
    fog.render(performance.now());
    pets.render(ticker.deltaMS / 1000);
    critters.cats = pets.cats();
    pets.prey = critters.prey();
    critters.render(ticker.deltaMS / 1000, performance.now());
    wide.render(ticker.deltaMS / 1000);
    scenes.calm = map.calm;
    scenes.render(performance.now());
    birds.feeders = scenes.feeders();
    // (the busker's tune, soft, heard only with the view near them)
    buskDue -= ticker.deltaMS / 1000;
    const busker = buskDue <= 0 && view.music && !view.hidden && map.root.visible ? scenes.busker() : null;
    if (busker) {
      const mv = map.view;
      const dx = (busker.x - (mv.x + mv.w / 2)) / Math.max(1, mv.w / 2);
      const dy = (busker.y - (mv.y + mv.h / 2)) / Math.max(1, mv.h / 2);
      if (Math.hypot(dx, dy) < 0.8) {
        ambience.cue('busk', Math.max(-0.8, Math.min(0.8, dx * 0.8)));
        buskDue = 2.4 + Math.random() * 0.8;
      }
    }
    frost.render(ticker.deltaMS / 1000, map.view, snap?.land ?? null, map.calm);
    dragon.render(ticker.deltaMS / 1000);
    sky.render(ticker.deltaMS / 1000, app.screen.width, app.screen.height);
    if (ambMix) ambience.update(view.music && !view.hidden, ambMix, ticker.deltaMS / 1000, ambZones);
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
    if (under.shown) {
      const sideways = app.screen.width > app.screen.height;
      under.resize(app.screen.width, app.screen.height, DEEP_TOP, sideways ? 0 : DEEP_BOTTOM, sideways ? DEEP_SIDE : 0);
      under.render(performance.now(), ticker.deltaMS / 1000);
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
    app.ticker.maxFPS = interactive || moving || battle.shown || fight.shown || mine.shown || deep.shown || under.shown || tactics.shown ? FPS_ACTIVE : FPS_IDLE;
  });
}


start().catch((err) => console.error('strip failed to start', err));

/** A townsperson's picture for the feed and event box: as the map draws them, in their isometric look
 *  (art/folkPortrait.ts: the same look and colours as the map), standing facing us. Until it loads it holds their
 *  paper-doll picture (art/hkFolk.ts, then the old look), and is painted over in place when it comes (the cards keep the
 *  canvas they were given). */
function personPicture(who: PersonView): HTMLCanvasElement {
  const hc = document.createElement('canvas');
  hc.width = hc.height = 64;
  paintPortrait(hc, who, {
    mode: 'full',
    stand: (g) => {
      const keys = hkLayers(hkWhoOf(who), { fighting: false, activity: 'idle' });
      const paint = () => {
        const c = document.createElement('canvas');
        c.width = c.height = 64;
        if (!hkDraw(c.getContext('2d')!, keys, 0, 0, 32, 61, 50)) return false;
        if (hc.dataset.folk) return true; // (the iso look is in already)
        const h = hc.getContext('2d')!;
        h.clearRect(0, 0, 64, 64);
        h.drawImage(c, 0, 0);
        return true;
      };
      if (paint()) return;
      g.drawImage(textureCanvas(lpcFrame(who.look, 'walk', 0), 64, 64), 0, 0);
      onHkLoad(paint);
    },
  });
  return hc;
}
