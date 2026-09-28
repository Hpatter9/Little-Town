// Strip renderer: draws the town and HUD, turns clicks into sim commands, and decides when the strip
// should capture the mouse.

import { applySeasonPalette } from './art/palette';
import 'pixi.js/unsafe-eval'; // Pixi's shader code generation without eval(), required by our CSP
import { Application, Graphics, TextureStyle } from 'pixi.js';
import { STRIP_HEIGHT, WORLD_WIDTH } from '../shared/constants';
import { BUILDING_BY_ID, UPGRADES, type BuildingDef } from '../shared/data/buildings';
import { eraReached } from '../shared/data/eras';
import { TOPIC_BY_ID } from '../shared/data/research';
import { MATERIAL_NAMES, MATERIALS, type Material, type Stock } from '../shared/data/materials';
import { CROPS } from '../shared/data/crops';
import { OPERATORS } from '../shared/data/operators';
import { SKILL_NAMES, SKILLS } from '../shared/data/skills';
import { CLASS_DEFS } from '../shared/data/classes';
import { TERRAIN } from '../shared/data/terrain';
import type { Bridge, InspectInfo, StripState } from '../shared/ipc';
import { blueprintCount, canPlace, defOf, isUnlocked, type PlaceCheck } from '../shared/sim/buildings';
import type { PersonView, Snapshot, TravellerView } from '../shared/sim/snapshot';
import { venueOfDef } from '../shared/data/shop';
import { buildingTint } from './theme';

/** A traveller, drawn like a townsperson (they're only passing through: most of a person's details don't apply). */
function travellerPerson(t: TravellerView): PersonView {
  return {
    id: t.id, name: t.name, typeName: 'Traveller', look: t.look, x: t.x, dir: t.dir,
    activity: 'walk', cls: null, trainable: [], mounted: null, doing: travellerDoing(t), carrying: {},
    skills: {} as PersonView['skills'], traits: [], needs: { food: 1, rest: 1 }, morale: 60, moodTarget: 60, moodReasons: [],
    priorities: {} as PersonView['priorities'], autoPriorities: false, bed: null, floor: null,
    indoors: t.phase === 'shopping', // (inside the shop: see its window)
    away: null, hp: 1, maxHp: 1, downed: null, bleedMinutes: null, gear: {}, gearQ: {}, coins: null, detail: [], recent: [], bedroll: false, carryCapacity: 0,
    partner: null, married: false, friends: [], rivals: [], growsUpIn: null, breakdown: null, monster: null, order: null, sick: false,
  };
}
const travellerDoing = (t: TravellerView) => {
  const where = t.venue === 'tavern' ? 'tavern' : 'shop';
  return t.phase === 'arriving' ? `On the way to the ${where}` : t.phase === 'shopping' ? `In the ${where}` : 'Moving on';
};
import { bleedLeft } from '../shared/format';
import { poolSize } from '../shared/sim/state';
import { generateWorld } from '../shared/world';
import { loadCreatures } from './art/creatures';
import { loadEffects } from './art/effects';
import { loadStills } from './art/stills';
import { loadLpc } from './art/lpc/lpc';
import { Camera } from './camera';
import { createHud } from './hud';
import { hostBridge, localBridge } from './localBridge';
import { createMusic } from './music';
import { createActionBar, createAwayCard, createBanner, createExpeditionHeader, createGameOver, createPersonCard, createPromptCard, createToasts, type Action } from './overlayUi';
import { createTooltip } from './tooltip';
import { ExpeditionPane } from './town/expeditionPane';
import { PeopleView } from './town/peopleView';
import { AnimalsView, CARAVAN_TICKS } from './town/animalsView';
import { SnowView } from './town/snowView';
import { SkyView } from './town/skyView';
import { WeatherView } from './town/weatherView';
import { RaidersView } from './town/raidersView';
import { SpellsView } from './town/spellsView';
import { TownView } from './town/townView';

declare global {
  interface Window {
    /** Provided by the preload script; in a plain browser (for previewing) a local stand-in is installed. */
    bridge?: Bridge;
  }
}

/** Pixels above the art's top edge that still count as "over the town". */
const HIT_MARGIN = 3;
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
  | { kind: 'tile'; tile: number }
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
  applySeasonPalette(first.biome, first.calendar.season); // (the land is drawn in the colours of the season)
  const world = generateWorld(first.seed, first.biome);

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

  const town = new TownView(world, first.tiles, first.buildings);
  town.season = first.calendar.season;
  const people = new PeopleView(town.people);
  const raiders = new RaidersView(town.people);
  const animals = new AnimalsView(town.people);
  // (spells sit over the town, out of its day-and-night tint, so they glow in the dark; they follow the walkway)
  const spells = new SpellsView();
  const pane = new ExpeditionPane(world.seedHash);
  const snow = new SnowView();
  town.root.addChild(snow.root); // (over everything in the town, in screen space)
  // On the phone the strip has no desktop behind it, so it draws a whole sky, and weather in front of the town.
  const fullSky = !!hostBridge();
  const sky = new SkyView(fullSky);
  const weather = fullSky ? new WeatherView() : null;
  if (weather) town.root.addChild(weather.root);
  town.root.addChildAt(sky.root, 0); // (behind the hills, so the sun and moon rise and set behind the land)
  const townMask = new Graphics(); // used only as a mask (never added to the stage, or it would draw)
  app.stage.addChild(town.root, spells.root, pane.root);

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
      town.root.mask = null;
      return w;
    }
    paneX = x0;
    paneW = want;
    pane.layout(x0, want, app.screen.height);
    townMask.clear().rect(0, 0, x0, app.screen.height).fill(0xffffff);
    town.root.mask = townMask;
    return x0;
  };

  const camera = new Camera(WORLD_WIDTH);
  camera.centreOn(first.campX ?? town.campX, app.screen.width); // (a nomad tribe's camp may be away on its pasture)

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

  /* -------------------------------------------------------- state of the pointer */

  let interactive = false;
  let hover: Hover = null;
  let mouse: { x: number; y: number; target: EventTarget | null } | null = null;
  let press: { x: number; y: number; id: number } | null = null;
  /** A selected building, and which of its sub-menus is open. */
  let selected: { id: number; menu: 'main' | 'demolish' | 'empty' } | null = null;
  let selectedPerson: number | null = null;
  let placing: { def: BuildingDef; tile: number; check: PlaceCheck } | null = null;

  const banner = createBanner(() => stopPlacing());

  const setInteractive = (on: boolean) => {
    if (on === interactive) return;
    interactive = on;
    bridge.setInteractive(on);
  };

  /** What in the town (or the expedition pane) is under a screen point. */
  const hitTest = (x: number, y: number): Hover => {
    if (x >= paneX) return x < paneX + paneW && y >= app.screen.height - STRIP_HEIGHT + PANE_HIT_TOP ? { kind: 'pane' } : null;
    const local = town.toForeLocal(x, y);
    const raider = raiders.raiderAt(local.x, local.y);
    if (raider) return { kind: 'raider', id: raider.id };
    if (animals.caravanAt(local.x, local.y, snap)) return { kind: 'caravan' };
    const person = people.personAt(local.x, local.y);
    if (person) return { kind: 'person', person };
    const building = town.buildingAt(x, y);
    if (building !== null) return { kind: 'building', id: building };
    if (y < town.skylineAt(x) - HIT_MARGIN) return null;
    const tile = town.tileAt(x);
    if (tile === null || y < town.nearSkylineAt(x) - HIT_MARGIN) return { kind: 'scenery' };
    return { kind: 'tile', tile };
  };

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
    const clickable = hover?.kind === 'building' || hover?.kind === 'pane' || (hover?.kind === 'tile' && snap.tiles[hover.tile].terrain !== 'clear');
    canvas.style.cursor = clickable ? 'pointer' : hover ? 'grab' : 'default';
    if (phone) {
      // no tooltips on the phone: the top card says it all (and the selected patch of land stays lit)
      town.setHighlight(inspected?.kind === 'tile' ? inspected.tile : null);
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
        return { title: r.name, lines: [`${doing} · health ${r.hp}/${r.maxHp}`], y: town.foreScreenY(-54) };
      }
      case 'caravan': {
        const c = snap.caravan;
        if (!c) return null;
        const open = c.offers.filter((o) => !o.done).length;
        return { title: 'Trade caravan', lines: [`${open} deal${open === 1 ? '' : 's'} on offer · leaves in ${Math.ceil(c.hoursLeft)}h`], hint: 'Click to trade', y: town.foreScreenY(-60) };
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
          return { title: `${v.name}, ${v.typeName.toLowerCase()}`, lines: [when], hint: 'Click to decide', y: town.foreScreenY(-66) };
        }
        const traveller = snap.travellers.find((q) => q.id === id);
        if (traveller)
          return {
            title: `${traveller.name}, a ${traveller.kind}`,
            lines: [`${travellerDoing(traveller)} · after ${traveller.wants}${traveller.temper ? ` · ${traveller.temper}` : ''}`, `A stranger passing through, with ${traveller.purse} coins to spend`],
            hint: `Click to see the ${traveller.venue}`,
            y: town.foreScreenY(-50),
          };
        const p = snap.people.find((q) => q.id === id) ?? h.person; // latest data for the person
        const lines = [p.doing, ...p.detail.slice(0, 1)];
        if (poolSize(p.carrying) > 0) lines.push(`Carrying ${listStock(p.carrying)}`);
        lines.push(`Morale ${Math.round(p.morale)} · ${p.typeName}${p.coins !== null ? ` · ${p.coins} coins` : ''}`);
        return { title: `${p.name}${p.id === snap.mainId ? ' (you)' : ''}`, lines, hint: 'Click for details', y: town.foreScreenY(-50) };
      }
      case 'building': {
        const b = snap.buildings.find((q) => q.id === h.id);
        const r = town.buildingScreenRect(h.id);
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
          if (CROPS[b.def]) {
            const c = b.crop;
            const winter = snap.calendar.season === 'winter';
            lines.push(
              !c || c.stage === 'fallow'
                ? winter
                  ? 'Fallow: nothing grows in winter'
                  : 'Fallow: waiting for a farmer to sow it'
                : c.stage === 'ripe'
                  ? 'Ripe: waiting for a farmer to harvest it'
                  : `Growing: ${Math.floor(c.growth * 100)}%${winter ? ' (paused for winter)' : ''}`,
            );
          }
        }
        return { title: def.name + (b.status === 'blueprint' ? ' (blueprint)' : ''), lines, hint: 'Click for options', y: r.y };
      }
      case 'tile': {
        const t = snap.tiles[h.tile];
        const y = town.tileTopScreenY(h.tile);
        if (t.terrain === 'clear') return { title: 'Cleared land', lines: ['Open the Build panel to put something here'], y };
        const def = TERRAIN[t.terrain];
        return { title: def.name, lines: [listStock(t.pool) + ' left'], hint: t.designated ? 'Marked for gathering — click to cancel' : 'Click to gather and clear', y };
      }
      default:
        return null;
    }
  };

  const showHover = () => {
    town.setHighlight(hover?.kind === 'tile' ? hover.tile : null);
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
    const r = selected && town.buildingScreenRect(selected.id);
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
      case 'tile': {
        const t = snap.tiles[h.tile];
        // (the town decides what to build and where to gather now: the card says what it's up to here)
        if (t.terrain === 'clear') return { title: d.title, lines: ['Open ground: the town builds here when it needs to.'], actions: [act('plan', 'Town plan…', () => bridge.openPanel('build'))] };
        return {
          title: d.title,
          lines: [...d.lines, t.designated ? 'The town is gathering here, and will clear the land.' : 'The town will gather here when it needs what grows here, or the room.'],
          actions: [],
        };
      }
      case 'building': {
        const b = snap.buildings.find((q) => q.id === h.id);
        if (!b) return null;
        const list = buildingActions(b, inspectMenu, (m) => ((inspectMenu = m), publishInspect()), () => inspectTarget(null));
        const actions = list.map((a, i) => act(`b${i}`, a.label, a.onClick, { danger: a.danger }));
        const venue = venueOfDef(b.def);
        if (venue && inspectMenu === 'main') actions.unshift(act('venue', 'Look inside…', () => bridge.openPanel(venue), { primary: true }));
        return { title: d.title, lines: d.lines, actions };
      }
      case 'person': {
        const v = snap.visitor;
        if (v && v.id === h.person.id) {
          return {
            title: d.title,
            lines: [...d.lines, bestSkills(v), ...(v.cls ? [`A rare ${CLASS_DEFS[v.cls].name}!`] : [])],
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
        lines.push(`${p.typeName}${p.cls ? `, ${CLASS_DEFS[p.cls].name}` : ''} · ${bestSkills(p)}`);
        return { title: d.title, lines, actions: [act('more', 'Townsfolk…', () => bridge.openPanel('townsfolk'))] };
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
    const x = selectedPerson !== null ? people.xOf(selectedPerson) : null;
    if (!p || x === null || view.mode !== 'full') {
      if (selectedPerson !== null && !p) selectedPerson = null;
      return personCard.hide();
    }
    personCard.show(p, p.id === snap.mainId, town.toScreenX(x));
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

  const checkPlacement = (def: BuildingDef, tile: number): PlaceCheck => {
    if (!isUnlocked({ unlockAll: snap.unlockAll, done: snap.research.done }, def)) return { ok: false, reason: 'Not researched yet' };
    if (blueprintCount(snap) >= snap.buildSlots) return { ok: false, reason: 'Construction queue is full' };
    return canPlace(snap, world.back, def, tile);
  };

  const updateGhost = () => {
    if (!placing) return;
    if (!mouse || mouse.target instanceof Element && mouse.target.closest('[data-hit]')) {
      town.hideGhost();
      tip.hide();
      return;
    }
    const { def } = placing;
    placing.tile = town.placementTile(def.layer, mouse.x, def.width);
    placing.check = checkPlacement(def, placing.tile);
    town.showGhost(def.id, def.layer, placing.tile, def.width, placing.check.ok);
    canvas.style.cursor = placing.check.ok ? 'copy' : 'not-allowed';
    if (placing.check.ok) tip.hide();
    else tip.show("Can't build here", [placing.check.reason ?? ''], mouse.x, mouse.y - 16);
  };

  const startPlacing = (defId: string) => {
    const def = BUILDING_BY_ID[defId];
    if (!def) return;
    select(null);
    placing = { def, tile: 0, check: { ok: false } };
    banner.show(`Placing: ${def.name}`, coarse() ? 'Tap where it goes, then tap it again to build · long-press to cancel' : 'Click to place · right-click to cancel');
    refreshHover();
  };

  const stopPlacing = () => {
    placing = null;
    armedTile = null;
    banner.hide();
    town.hideGhost();
    tip.hide();
    refreshHover();
  };
  bridge.onPlacement(startPlacing);

  /* -------------------------------------------------------- clicks */

  /** On a touch screen the first tap only shows where the building would go; a second tap there builds it. */
  let armedTile: number | null = null;
  const click = (x: number, y: number, touch = false) => {
    if (placing) {
      updateGhost();
      const confirmed = !touch || armedTile === placing.tile;
      armedTile = placing.tile;
      if (placing.check.ok && confirmed) {
        bridge.command({ type: 'placeBuilding', def: placing.def.id, tile: placing.tile });
        stopPlacing();
      }
      return;
    }
    const h = hitTest(x, y);
    // the shop or tavern (or a stranger on their way to one) opens its bird's-eye window
    const tapped = h?.kind === 'person' ? snap.travellers.find((t) => t.id === h.person.id) : undefined;
    const venue = h?.kind === 'building' ? venueOfDef(snap.buildings.find((b) => b.id === h.id)?.def ?? '') : tapped?.venue;
    if (venue && snap[venue]) bridge.openPanel(venue);
    if (phone) return inspectTarget(h); // (the phone's top card shows it, and holds its buttons)
    if (tapped) return;
    if (h?.kind === 'pane') return bridge.openPanel('expeditions');
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
      if (!hover && !placing) return;
      const unit = e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? window.innerWidth : 1;
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      camera.scrollBy(d * unit * WHEEL_SPEED);
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
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (touches.size === 2 && bridge.pinch) {
        // a second finger: this is a pinch, not a drag or a tap
        if (camera.dragging) camera.endDrag(e.timeStamp);
        press = null;
        pinchFrom = Math.max(20, spread());
        bridge.pinch('start', pinchFrom);
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
    if ((!hover && !placing && e.pointerType === 'mouse') || e.button !== 0) return;
    press = { x: e.clientX, y: e.clientY, id: e.pointerId };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (touches.has(e.pointerId)) {
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinchFrom !== null && touches.size >= 2) return bridge.pinch?.('move', Math.max(20, spread()));
    }
    if (!press || e.pointerId !== press.id) return;
    if (!camera.dragging && Math.abs(e.clientX - press.x) >= DRAG_THRESHOLD) {
      camera.beginDrag(press.x, e.timeStamp);
      canvas.style.cursor = 'grabbing';
      tip.hide();
    }
    camera.dragTo(e.clientX, e.timeStamp);
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
    if (!caughtUp) for (const n of next.notices) if (n.id > lastNotice) toasts.push(n.text);
    lastNotice = Math.max(lastNotice, next.notices.at(-1)?.id ?? 0);
  };

  let lastShake: number | null = null;
  let shakeUntil = 0;
  let lastCamp: number | null = null;
  let buildStyle = 'town';
  const applySnapshot = (next: Snapshot) => {
    showNotices(next);
    const tilesChanged = next.tileRev !== snap.tileRev;
    snap = next;
    hud.update(next);
    music.update(view.music && !view.hidden, next.raid?.phase === 'active');
    const freeze = next.doom?.kind === 'deep_freeze' && next.doom.phase === 'active';
    // (on the phone, heavy cloud dims the land a little)
    const gloom = fullSky ? ({ clear: 0, cloudy: 0.04, rain: 0.12, storm: 0.22, snow: 0.05, fog: 0.08 } as const)[next.weather.kind] : 0;
    town.setDaylight(next.calendar.daylight * (1 - gloom), freeze);
    snow.on = freeze || (fullSky && next.weather.kind === 'snow');
    snow.heavy = freeze && !!next.doom?.cold;
    pane.setDaylight(next.calendar.daylight);
    const q = next.prompts[0];
    if (q && view.mode === 'full') promptCard.show(q);
    else promptCard.hide();
    // (a question that needs an answer goes first; the report waits behind it)
    if (next.away && !q && view.mode === 'full') awayCard.show(next.away);
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
    if (tilesChanged) town.updateTiles(next.tiles);
    town.setSeason(next.biome, next.calendar.season); // (redraws the land when the season turns)
    town.syncBuildings(next.buildings);
    // the buildings' style: the town's origin (and a nomad tribe's, once settled, its caravan city)
    const style = next.theme === 'nomads' && next.nomad?.settled ? 'nomads_city' : next.theme;
    if (style !== buildStyle) {
      buildStyle = style;
      town.setBuildingStyle(buildingTint(next.theme), style);
    }
    town.syncCastle(next.castle);
    // (a nomad tribe on the road: the view rides along with the caravan, and comes to rest at the new camp)
    const move = next.nomad?.move;
    if (move && move.since >= 0 && move.since <= CARAVAN_TICKS && lastCamp !== null) camera.centreOn(move.from + (move.to - move.from) * Math.min(1, move.since / CARAVAN_TICKS), app.screen.width);
    // (and if it moved while no one was watching, say in the background, the view just goes to the new camp)
    else if (lastCamp !== null && next.campX !== lastCamp) camera.centreOn(next.campX, app.screen.width);
    lastCamp = next.campX;
    people.moon = next.moonNight;
    people.theme = next.theme;
    people.weave = next.research.done.includes('weaving');
    people.founderId = next.mainId;
    publishInspect(); // (the phone's top card keeps up with what it shows)
    sky.update(next.calendar, next.moonPhase, next.weather);
    weather?.update(next.calendar, next.weather);
    people.revived = next.revived ? { ...next.revived, at: performance.now() } : null;
    people.fx = next.fx.map((f) => ({ ...f, at: performance.now() }));
    people.update(
      [...next.people.filter((p) => p.away === null), ...next.travellers.map(travellerPerson)],
      next.visitor,
      performance.now(),
    );
    raiders.update(next.raid?.phase === 'active' ? next.raid.raiders : [], performance.now());
    animals.update(next);
    spells.update(next, performance.now());
    if (hover || placing) refreshHover(); // tooltip contents change as work progresses
    if (selected) showActions();
    if (selectedPerson !== null) showPersonCard();
  };
  bridge.onSnapshot(applySnapshot);
  applySnapshot(first);

  /* -------------------------------------------------------- frame loop */

  let viewW = 0;
  app.ticker.add((ticker) => {
    const w = layoutSplit(); // the town's share of the width
    // zoomed (the strip got wider or narrower): keep the middle of the view where it was
    if (w !== viewW) {
      if (viewW) camera.shift((viewW - w) / 2);
      viewW = w;
    }
    const moving = camera.update(ticker.deltaMS / 1000, w);
    town.setCamera(camera.x, w, app.screen.height);
    // screen shake (a boss's roar or sweeping attack)
    const shaking = performance.now() < shakeUntil;
    app.stage.position.set(shaking ? Math.round((Math.random() - 0.5) * 6) : 0, shaking ? Math.round((Math.random() - 0.5) * 4) : 0);
    people.render(performance.now());
    raiders.render(performance.now());
    animals.render(performance.now());
    const walk = town.people.getGlobalPosition();
    spells.root.position.set(walk.x - app.stage.x, walk.y - app.stage.y);
    spells.render(performance.now());
    snow.render(performance.now(), ticker.deltaMS / 1000, w);
    sky.render(performance.now(), w);
    weather?.render(performance.now(), w);
    pane.render(performance.now(), ticker.deltaMS / 1000);
    // the art under a still mouse changes while the camera moves
    if (moving) {
      refreshHover();
      if (selected) showActions();
    }
    if (selectedPerson !== null) showPersonCard(); // follow them as they walk
    app.ticker.maxFPS = interactive || moving ? FPS_ACTIVE : FPS_IDLE;
  });
}

start().catch((err) => console.error('strip failed to start', err));
