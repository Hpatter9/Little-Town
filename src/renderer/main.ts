// Strip renderer: draws the town and HUD, turns clicks into sim commands, and decides when the strip
// should capture the mouse.

import { seatArt } from './art/seatArt';
import { SEAT_STAGE } from '../shared/data/seats';
import { CHATTER } from './chatter';
import { MapBattle } from './map/mapBattle';
import { MapSpells } from './map/mapSpells';
import { MapHerds } from './map/mapHerds';
import { MapBoats } from './map/mapBoats';
import { MapBirds } from './map/mapBirds';
import { MapButterflies } from './map/mapButterflies';
import { BloodPools } from './map/bloodPools';
import { createBattleHud } from './battle/battleHud';
import { FightScene } from './fight/fightView';
import { MineScene } from './fight/mineView';
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
import { CROPS } from '../shared/data/crops';
import { OPERATORS } from '../shared/data/operators';
import { SKILL_NAMES, SKILLS } from '../shared/data/skills';
import { TERRAIN } from '../shared/data/terrain';
import type { Bridge, InspectInfo, StripState } from '../shared/ipc';
import { blueprintCount, canPlace, defOf, depthOf, isUnlocked, type PlaceCheck } from '../shared/sim/buildings';
import type { PersonView, Snapshot, TravellerView } from '../shared/sim/snapshot';
import { lineOfDef, venueOfDef } from '../shared/data/shop';
import { storePanel, type PanelId } from '../shared/ipc';
/** The window a venue's building opens (the shop, the tavern, or a specialty shop's). */
const venuePanel = (def: string): PanelId | undefined => (lineOfDef(def) ? storePanel(lineOfDef(def)!) : venueOfDef(def));
import { buildingTint } from './theme';

/** A traveller, drawn like a townsperson (they're only passing through: most of a person's details don't apply). */
function travellerPerson(t: TravellerView): PersonView {
  return {
    id: t.id, name: t.name, typeName: 'Traveller', look: t.look, x: t.x, y: t.y, dir: t.dir,
    activity: 'walk', taskDone: null, story: '', secret: null, sinceHit: 999, hitFrom: 1, sinceBlow: 999, sinceBlock: 999, defending: false, cls: null, clsName: null, clsPast: [], income: null, owns: [], debt: 0, ambition: null, trips: 0, clsText: '', founderCalling: false, stage: 0, ascended: false, level: 1, levelProgress: 0, mounted: null, doing: travellerDoing(t), carrying: {},
    skills: {} as PersonView['skills'], traits: [], needs: { food: 1, rest: 1 }, morale: 60, moodTarget: 60, moodReasons: [],
    priorities: {} as PersonView['priorities'], autoPriorities: false, bed: null, floor: null,
    indoors: t.phase === 'shopping', // (inside the shop: see its window)
    rally: null,
    away: null, hp: 1, maxHp: 1, downed: null, bleedMinutes: null, gear: {}, gearQ: {}, coins: null, detail: [], recent: [], bedroll: false, carryCapacity: 0,
    partner: null, married: false, friends: [], rivals: [], enemies: [], devoted: [], body: { wounds: [], lasting: [], fitted: [], sight: 1, handling: 1, moving: 1, pain: 0, marks: [] }, growsUpIn: null, breakdown: null, ageDays: 0,
  ageYears: 0, lifeStage: 'prime', ageText: '', elder: false, swimming: false, mer: false, nature: 'cheerful', natureName: 'Cheerful', natureLine: '', job: null,
  monster: null, order: null, sick: false,
    battle: { damage: [0, 0], accuracy: 0, dodge: 0, armor: 0, block: 0, crit: 0, ranged: false, attrs: { str: 8, dex: 8, vit: 8, int: 8, wis: 8 }, mp: 0, sp: 0, interval: 12 }, kit: [], passives: [],
  };
}
const travellerDoing = (t: TravellerView) => {
  const where = t.venue === 'tavern' ? 'tavern' : 'shop';
  return t.phase === 'arriving' ? `On the way to the ${where}` : t.phase === 'shopping' ? `In the ${where}` : 'Moving on';
};
import { bleedLeft } from '../shared/format';
import { poolSize } from '../shared/sim/state';
import { hashSeed } from '../shared/rng';
import { CELL, cellAt, groundAt, isMarked, WILD } from '../shared/sim/land';
import { creatureFrame, loadCreatures } from './art/creatures';
import { founderSheet } from './art/heroForms';
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
  | { kind: 'caravan' }
  | null;

/** Width of the tab dock at the right end of the strip (see #dock in index.html). */
const DOCK_WIDTH = 108;
/** The expedition pane's width range, and how far down it starts counting as "over" it. */
const PANE_MIN = 320;
const PANE_MAX = 520;
const PANE_HIT_TOP = 90;

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
  (window as unknown as { __pools?: BloodPools }).__pools = pools; // (for previews)
  const people = new MapPeople(map.things);
  people.lights = map.lights;
  (window as unknown as { __people?: MapPeople }).__people = people; // (for previews)
  const raiders = new MapRaiders(map.things);
  const herds = new MapHerds(map.things);
  const boats = new MapBoats(map.things);
  const birds = new MapBirds(map.things, map);
  (window as unknown as { __birds?: MapBirds }).__birds = birds; // (for previews)
  const butterflies = new MapButterflies(map.things, map);
  const pane = new ExpeditionPane(seedHash);
  const snow = new SnowView();
  const leaves = new LeavesView();
  // On the phone the strip has no desktop behind it: weather falls over the town.
  const fullSky = !!hostBridge();
  const weather = fullSky ? new WeatherView() : null;
  const townMask = new Graphics(); // used only as a mask (never added to the stage, or it would draw)
  app.stage.addChild(map.root);
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
  // inside a mine on the land (fight/mineView.ts): the diggers at the seams
  const mine = new MineScene();
  app.stage.addChild(mine.root);
  const fightHud = createFightHud({
    back: () => {
      bridge.command({ type: 'watch', expedition: null });
      bridge.command({ type: 'watchMine', place: null });
    },
  });
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
    const person = people.personAt(w.x, w.y);
    if (person) return { kind: 'person', person };
    const building = map.buildingAt(w.x, w.y);
    if (building !== null) return { kind: 'building', id: building };
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
        } else {
          if (b.fire !== undefined) lines.push(`ON FIRE! ${Math.floor(b.fire * 100)}% burned — everyone is fighting it`);
          lines.push(def.purpose);
          const role = OPERATORS[b.def];
          if (role) {
            const who = snap.people.find((p) => p.id === b.operator);
            lines.push(who ? `${role.title}: ${who.name} (${SKILL_NAMES[role.skill]} ${who.skills[role.skill].level}). ${role.effect}.` : `No ${role.title.toLowerCase()} yet`);
          }
          if (def.storage) lines.push(`Stored ${poolSize(b.store)}/${def.storage}${poolSize(b.store) ? ': ' + listStock(b.store) : ''}`);
          if (def.hp) lines.push(`Health ${Math.round(b.hp ?? def.hp)}/${def.hp}${(b.hp ?? def.hp) < def.hp ? ' (builders will repair it)' : ''}`);
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
                    : tired
                      ? 'Fallow: resting the tired soil'
                      : 'Fallow: waiting for a farmer to sow it'
                : c.stage === 'ripe'
                  ? 'Ripe: waiting for a farmer to harvest it'
                  : crop.establishHours && !c.bearing
                    ? `Young trees, coming into bearing: ${Math.floor(c.growth * 100)}%${winter ? ' (paused for winter)' : ''}`
                    : `Growing: ${Math.floor(c.growth * 100)}%${winter ? ' (paused for winter)' : ''}`,
            );
            if (!crop.indoor && !crop.establishHours) lines.push(`Soil: ${soil >= 1 ? 'rich' : soil >= 0.75 ? 'good' : soil >= 0.5 ? 'tiring' : 'worn out'} (the harvest ×${soil.toFixed(1)})`);
          }
        }
        return { title: def.name + (b.status === 'blueprint' ? ' (blueprint)' : ''), lines, hint: 'Click for options', y: r.y };
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
        if (!def) return { title: GROUND_NAMES[g] ?? 'Open land', lines: [g === 'water' ? 'The river' : 'The town builds here when it needs to'], y };
        return { title: def.name, lines: [listStock(snap.land.pools[h.cell] ?? {}) + ' left'], hint: isMarked(snap.land, h.cell) ? 'The town is clearing it' : 'The town will gather here when it needs to', y };
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
        if (following) lines.unshift('You follow them: their big moments come as phone alerts.');
        return { title: d.title, lines, actions: [...rallyAct, followAct, act('more', 'Townsfolk…', () => bridge.openPanel('townsfolk'))] };
      }
      case 'place': {
        const p = snap.places.find((q) => q.id === h.id);
        const actions = p?.dest ? [act('party', 'Bounty or forbid…', () => bridge.openPanel('expeditions'), { primary: true })] : p?.mine ? [act('enter', 'Enter the mine', () => bridge.command({ type: 'watchMine', place: p.id }), { primary: true })] : [];
        return { title: d.title, lines: d.lines, actions };
      }
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
  canvas.addEventListener('pointerdown', (e) => {
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
    map.root.visible = !watched && !inMine;
    showNotices(next);
    snap = next;
    hud.update(next);
    music.update(view.music && !view.hidden, next.raid?.phase === 'active');
    const freeze = next.doom?.kind === 'deep_freeze' && next.doom.phase === 'active';
    // (on the phone, heavy cloud dims the land a little)
    const gloom = fullSky ? ({ clear: 0, cloudy: 0.04, rain: 0.12, storm: 0.22, snow: 0.05, fog: 0.08 } as const)[next.weather.kind] : 0;
    map.setDaylight(next.calendar.daylight * (1 - gloom), freeze);
    map.smokeAmount = airFor(next.calendar.hour, next.calendar.season, next.weather.kind).smoke;
    map.weather = next.weather.kind;
    // the birds come down by day in fair enough weather; everyone about scares them off
    birds.on = next.calendar.daylight > 0.35 && next.weather.kind !== 'storm' && next.weather.kind !== 'snow' && !freeze;
    birds.winter = next.calendar.season === 'winter';
    birds.crowsOnly = buildStyle === 'lich' || buildStyle === 'vampire';
    butterflies.on = birds.on && (next.calendar.season === 'spring' || next.calendar.season === 'summer') && (next.weather.kind === 'clear' || next.weather.kind === 'cloudy') && next.biome !== 'tundra' && next.biome !== 'desert';
    butterflies.land = next.land;
    birds.land = next.land;
    birds.folk = [...next.people.filter((p) => p.away === null && !p.indoors), ...next.travellers, ...(next.raid?.phase === 'active' ? next.raid.raiders : [])].map((p) => ({ x: p.x, y: p.y }));
    snow.on = freeze || (fullSky && next.weather.kind === 'snow');
    // autumn leaves on the wind, in fair weather
    leaves.on = next.calendar.season === 'autumn' && (next.weather.kind === 'clear' || next.weather.kind === 'cloudy') && !freeze;
    snow.heavy = freeze && !!next.doom?.cold;
    pane.setDaylight(next.calendar.daylight);
    // (the phone page's feed borrows the town's pictures: a townsperson, or a building in the town's own style, as the
    // map draws it: the pack's picture where there is one, else the top-down painter's)
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
    if (q && view.mode === 'full' && !((q.kind === 'event' || q.kind === 'secret') && (window as unknown as { __eventSheet?: boolean }).__eventSheet)) promptCard.show(q);
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
    const e = next.gameOver ? null : shownExpedition();
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
    map.syncBuildings(next.buildings);
    herds.update(next.buildings);
    boats.update(next.fleet, next.mooring);
    pools.sync(next.blood);
    map.syncCastle(next.castle ?? null, next.buildings);
    map.syncPlaces(next.places);
    // (a nomad tribe that moved camp: the view goes to the new camp)
    if (lastCamp !== null && (next.camp.x !== lastCamp.x || next.camp.y !== lastCamp.y)) camera.centreOn(next.camp, app.screen.width, app.screen.height);
    lastCamp = next.camp;
    people.moon = next.moonNight;
    people.theme = next.theme;
    people.weather = next.weather.kind;
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
      [...next.people.filter((p) => p.away === null), ...next.travellers.map(travellerPerson)],
      next.visitor,
      performance.now(),
    );
    raiders.update(next.raid?.phase === 'active' ? next.raid.raiders : [], performance.now());
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
    // following someone: keep them in view (after the player has looked around a few seconds on their own)
    // (in a battle, the raiders furthest along the trail)
    const lead = battle.shown ? battle.lead() : null;
    const hero = lead ?? (snap.hero !== null ? people.posOf(snap.hero) : null);
    if (hero) camera.follow(hero, w, h, performance.now(), FOLLOW_WAIT_MS);
    const moving = camera.update(ticker.deltaMS / 1000, w, h);
    map.setCamera(camera.x, camera.y, w, h);
    // screen shake (a boss's roar or sweeping attack)
    const shaking = performance.now() < shakeUntil;
    app.stage.position.set(shaking ? Math.round((Math.random() - 0.5) * 6) : 0, shaking ? Math.round((Math.random() - 0.5) * 4) : 0);
    people.render(performance.now());
    raiders.render(performance.now());
    herds.render(performance.now(), ticker.deltaMS / 1000);
    boats.render(performance.now());
    birds.render(ticker.deltaMS / 1000, performance.now());
    butterflies.render(ticker.deltaMS / 1000, performance.now());
    map.renderPlaces(performance.now());
    map.renderAir(ticker.deltaMS / 1000);
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
    if (mine.shown) {
      mine.resize(app.screen.width, app.screen.height, ...fightHud.insets());
      mine.render(performance.now(), ticker.deltaMS / 1000);
    }
    // the art under a still mouse changes while the camera moves
    if (moving) {
      refreshHover();
      if (selected) showActions();
    }
    if (selectedPerson !== null) showPersonCard(); // follow them as they walk
    app.ticker.maxFPS = interactive || moving || battle.shown || fight.shown || mine.shown ? FPS_ACTIVE : FPS_IDLE;
  });
}

/** After the player drags or scrolls the view, following someone waits this long before it takes the camera back. */
const FOLLOW_WAIT_MS = 4000;

start().catch((err) => console.error('strip failed to start', err));

/** A townsperson's picture for the feed and the report card: as the map draws them, so a founder (in their hero form
 *  always, map/mapPeople.ts) is their hero sheet's idle frame, cut to a square about the figure; anyone else their LPC
 *  figure. */
function personPicture(who: PersonView): HTMLCanvasElement {
  if (!who.founderCalling || who.monster === 'undead') return textureCanvas(lpcFrame(who.look, 'walk', 0), 64, 64);
  const sheet = founderSheet(who.cls, who.id, who.battle.ranged, (who.battle.attrs?.int ?? 0) > (who.battle.attrs?.str ?? 0));
  const tex = creatureFrame(sheet, 0, 'right', 0, false, 'idle');
  const f = tex.frame;
  const r = tex.source.resolution;
  const side = Math.min(f.width, f.height);
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  g.drawImage(tex.source.resource as CanvasImageSource, (f.x + (f.width - side) / 2) * r, (f.y + f.height - side) * r, side * r, side * r, 0, 0, 64, 64);
  return c;
}
