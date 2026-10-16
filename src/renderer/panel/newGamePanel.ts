// New town panel, one question at a time (the owner's ask: a step-by-step prompt, not one long page): who founds the
// town (the origin), the founder (one of the origin's three ready-made: data/founders.ts), how it begins (scenario),
// where, how dangerous the world is, and last the rules and the Found button. Back and Next move between the steps,
// and the dots show how far along. Opened from the tray's "New game…", the game-over card, and on a first run.

import { CONQUEST } from '../../shared/data/conquest';
import { readLegends } from '../legends';
import { legendCard } from './legendsPanel';
import { hkDraw, hkLayers, hkWhoOfLook, onHkLoad } from '../art/hkFolk';
import { FOUNDER_CLASS } from '../../shared/data/founderClasses';
import type { Bridge } from '../../shared/ipc';
import { BIOME_DEFS, BIOMES, DIFFICULTIES, DIFFICULTY_DEFS, type Biome, type Difficulty } from '../../shared/data/biomes';
import { PROVINCES_PER_REALM, REALMS_DEFAULT, REALMS_MAX, REALMS_MIN } from '../../shared/data/conquest';
import { founderSkills, MAX_NAME_LENGTH, SCENARIOS, type FounderSpec } from '../../shared/data/founding';
import { FOUNDER_BY_ID, FOUNDERS } from '../../shared/data/founders';
import { TRAITS } from '../../shared/data/people';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import { ORIGIN_DEFS, ORIGINS, type OriginId } from '../../shared/data/origins';
import type { Snapshot } from '../../shared/sim/snapshot';
import { TICKS_PER_HOUR } from '../../shared/sim/time';
import { loadLpc, lpcCanvas } from '../art/lpc/lpcCompose';
import { FOUNDER_ID } from '../art/heroForms';
import { button, el } from './dom';
import { BIOME_SCENE, closeSheet, DANGER_GLYPH, DANGER_SCENE, figureSymbol, glyphSymbol, ORIGIN_GLYPH, ORIGIN_SCENE, SCENARIO_GLYPH, SCENARIO_SCENE, sceneSymbol, sceneWith, tileGrid, type Tile } from './newTownTiles';


/* (kept while the panel re-renders, and between openings) */
let scenario = 'lone';
let origin: OriginId = 'settlers';
let name = '';
let pick = FOUNDERS.settlers[0].id;
let biome: Biome = 'forest';
let difficulty: Difficulty = 'normal';
let realms = REALMS_DEFAULT;
let ironman = false;
/** The legend the founder descends from (sim/legacy.ts), or null for a new line. */
let heir: string | null = null;
/** The step showing (kept while the panel re-renders; back to the first once a town is founded). */
let step = 0;
/** Back to the first question (the panel opened afresh: panel.ts). */
export const restartNewGame = (): void => {
  step = 0;
};
// (the realms page only while the conquest is on: data/conquest.ts)
const STEPS: readonly string[] = ['Who founds the town?', 'Your founder', 'How does it begin?', 'Where will you found your town?', 'How dangerous is the world?', ...(CONQUEST.on ? ['How many realms share the world?'] : []), 'Ready to found it?'];

let lpcReady: Promise<void> | null = null;

/** The founder as the map draws them (map/mapPeople.ts: a founder wears their hero form always): the idle frame of
 *  the hero sheet their calling's base class gives (`founderSheet`, the same choice), feet at the foot of the picture,
 *  facing right. A founder with no calling, or until the sheet loads, is their LPC figure. */
function drawFounderArt(art: HTMLCanvasElement, id: string, look: (typeof FOUNDERS)[OriginId][number]['look']): void {
  const g = art.getContext('2d')!;
  // as the map will draw them: their Himeko look (art/hkFolk.ts) in their calling's dress; the plain old look only
  // until the layers load, and never over them
  const keys = hkLayers(hkWhoOfLook(FOUNDER_ID, look, { cls: FOUNDER_CLASS[id]?.base ?? null, founder: true }), { fighting: true, activity: 'idle' });
  let drawn = false;
  const hk = () => {
    if (drawn) return true;
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    if (!hkDraw(c.getContext('2d')!, keys, 0, 0, 32, 61, 52)) return false;
    drawn = true;
    g.clearRect(0, 0, 64, 64);
    g.drawImage(c, 0, 0);
    return true;
  };
  hk();
  if (drawn) return;
  onHkLoad(hk);
  void lpcReady!.then(() => {
    if (!drawn) g.drawImage(lpcCanvas(look, 'walk', 0), 8, 6, 48, 48, 0, 0, 64, 64);
  });
}

/** A founder's picture for a tile or a scene. */
function doll(f: (typeof FOUNDERS)[OriginId][number]): HTMLCanvasElement {
  lpcReady ??= loadLpc();
  const c = el('canvas', 'founder-art nt-doll');
  c.width = c.height = 64;
  drawFounderArt(c, f.id, f.look);
  return c;
}

export function renderNewGame(snap: Snapshot, bridge: Bridge): HTMLElement[] {
  const origins = el('div', 'nt-group');
  const scenarios = el('div', 'nt-group');
  const founder = el('div', 'founder');
  const biomes = el('div', 'nt-group');
  const dangers = el('div', 'nt-group');
  const found = button('', () => {
    step = 0;
    closeSheet();
    bridge.newGame(choices());
  }, { cls: 'place found next' });

  const drawOrigins = () =>
    origins.replaceChildren(
      tileGrid(
        ORIGINS.map((id): Tile => {
          const o = ORIGIN_DEFS[id];
          return {
            id,
            name: o.name,
            symbol: () => glyphSymbol(ORIGIN_GLYPH[id]),
            scene: () => sceneWith(ORIGIN_SCENE[id], FOUNDERS[id].slice(0, 2).map(doll)),
            lines: () => [o.description, ...o.features.map((f) => `• ${f}`)],
          };
        }),
        origin,
        (id) => ((origin = id as OriginId), drawOrigins(), drawPlaces(), drawFounders(), refreshChosen()),
      ),
    );
  const drawScenarios = () =>
    scenarios.replaceChildren(
      tileGrid(
        SCENARIOS.map((sc): Tile => ({
          id: sc.id,
          name: sc.name,
          symbol: () => glyphSymbol(SCENARIO_GLYPH[sc.id] ?? ['Food', 7, 2]),
          scene: () => sceneWith(SCENARIO_SCENE, Array.from({ length: Math.min(3, 1 + sc.companions.length) }, (_, i) => doll(FOUNDERS[origin][i % FOUNDERS[origin].length]))),
          lines: () => [sc.description],
        })),
        scenario,
        (id) => ((scenario = id), drawScenarios(), refreshChosen()),
      ),
    );
  const drawPlaces = () => {
    // (a shore people settles the coast and nowhere else: sim/sea.ts)
    const shore = ORIGIN_DEFS[origin].rules.shape === 'sea';
    if (shore) biome = 'coast';
    biomes.replaceChildren(
      ...(shore
        ? [el('div', 'hint', `${ORIGIN_DEFS[origin].name} settle the coast: half their land is the sea.`)]
        : [
            tileGrid(
              BIOMES.map((b): Tile => ({
                id: b,
                name: BIOME_DEFS[b].name,
                symbol: () => sceneSymbol(BIOME_SCENE[b]),
                scene: () => sceneWith(BIOME_SCENE[b], [doll(FOUNDERS[origin][0])]),
                lines: () => [BIOME_DEFS[b].description],
              })),
              biome,
              (id) => ((biome = id as Biome), drawPlaces(), refreshChosen()),
            ),
          ]),
    );
    dangers.replaceChildren(
      tileGrid(
        DIFFICULTIES.map((d): Tile => ({
          id: d,
          name: DIFFICULTY_DEFS[d].name,
          symbol: () => glyphSymbol(DANGER_GLYPH[d]),
          scene: () => sceneWith(DANGER_SCENE[d], [doll(FOUNDERS[origin][0])]),
          lines: () => [DIFFICULTY_DEFS[d].description],
        })),
        difficulty,
        (id) => ((difficulty = id as Difficulty), drawPlaces(), refreshChosen()),
      ),
    );
    found.textContent = origin === 'settlers' ? `Found a ${BIOME_DEFS[biome].name.toLowerCase()} town` : `Found ${ORIGIN_DEFS[origin].town} (${BIOME_DEFS[biome].name.toLowerCase()})`;
  };

  /* ---------------------------------------------------- the founder: one of the origin's three, and perhaps a new name */

  const nameInput = el('input', 'founder-name');
  nameInput.type = 'text';
  nameInput.maxLength = MAX_NAME_LENGTH;
  nameInput.value = name;
  nameInput.addEventListener('input', () => (name = nameInput.value));
  const cards = el('div', 'nt-group');
  const drawFounders = () => {
    const list = FOUNDERS[origin];
    if (!list.some((f) => f.id === pick)) pick = list[0].id;
    nameInput.placeholder = `Rename (or keep ${FOUNDER_BY_ID[pick].name})`;
    cards.replaceChildren(
      tileGrid(
        list.map((f): Tile => ({
          id: f.id,
          name: f.name,
          symbol: () => figureSymbol(doll(f)),
          scene: () => sceneWith(ORIGIN_SCENE[origin], [doll(f)]),
          lines: () => {
            const levels = founderSkills(f.background);
            const best = SKILLS.filter((k) => levels[k] > 2).sort((x, y) => levels[y] - levels[x]);
            const skills = best.map((k) => `${SKILL_NAMES[k]} ${levels[k]}${f.background.passions.includes(k) ? ' ★' : ''}`).join(' · ');
            const traitNames = f.traits.map((id) => TRAITS.find((x) => x.id === id)?.name ?? id).join(', ');
            return [
              f.title,
              f.story,
              `${f.background.name}: ${skills}`,
              ...(FOUNDER_CLASS[f.id] ? [`Calling: ${FOUNDER_CLASS[f.id].stages[0]} (theirs alone)`] : []),
              ...(traitNames ? [traitNames] : []),
              ...(f.brings?.length ? [`Comes with ${f.brings.map((b) => `${/^[aeiou]/.test(b) ? 'an' : 'a'} ${b}`).join(' and ')}`] : []),
            ];
          },
        })),
        pick,
        (id) => ((pick = id), drawFounders(), refreshChosen()),
      ),
    );
  };
  founder.append(cards, nameInput);

  drawScenarios();
  drawPlaces();
  drawFounders();

  const iron = el('label', 'check');
  const box = el('input');
  box.type = 'checkbox';
  box.checked = ironman;
  box.addEventListener('change', () => (ironman = box.checked));
  iron.append(box, el('span', '', 'Ironman: one save, no backups, no cheats'));

  // (a town only just begun, as on a first run, isn't worth a warning)
  const warning =
    snap.gameOver || snap.tick < TICKS_PER_HOUR
      ? []
      : [el('div', 'hint', 'Your current town is kept as a backup in the saves folder, but the game carries on with the new one.')];
  drawOrigins();

  // one step at a time: the question, its choices, and Back / Next
  const wrap = el('div', 'wizard');
  /** The step's current pick, named under its question. */
  const chosenName = (): string =>
    [ORIGIN_DEFS[origin].name, FOUNDER_BY_ID[pick].name, SCENARIOS.find((x) => x.id === scenario)?.name ?? '', BIOME_DEFS[biome].name, DIFFICULTY_DEFS[difficulty].name][step] ?? '';
  const chosen = el('div', 'nt-chosen');
  const refreshChosen = () => {
    chosen.textContent = chosenName() ? `Chosen: ${chosenName()}` : '';
  };
  const draw = () => {
    closeSheet();
    const page: HTMLElement[] = [];
    if (step === 0) page.push(origins, el('div', 'hint', 'Each changes how the whole game plays and looks. Settlers are the classic game.'));
    else if (step === 1) page.push(founder);
    else if (step === 2) page.push(scenarios);
    else if (step === 3) page.push(biomes);
    else if (step === 4) page.push(dangers);
    else if (step === 5 && CONQUEST.on) page.push(realmsPage());
    else page.push(summary(), ...lineage(draw), el('h3', 'newgame-head', 'Rules'), iron, ...warning);
    const dots = el('div', 'wizard-dots');
    STEPS.forEach((_, i) => {
      const d = el('button', `wizard-dot${i === step ? ' on' : i < step ? ' done' : ''}`);
      d.title = STEPS[i];
      d.addEventListener('click', () => go(i));
      dots.append(d);
    });
    const nav = el('div', 'row wizard-nav');
    nav.append(
      button('‹ Back', () => go(step - 1), { cls: 'place quiet', disabled: step === 0 }),
      step < STEPS.length - 1 ? button('Next ›', () => go(step + 1), { cls: 'place next' }) : found,
    );
    wrap.replaceChildren(el('div', 'wizard-step', `Step ${step + 1} of ${STEPS.length}`), el('h3', 'newgame-head', STEPS[step]), ...(step <= 4 ? [chosen] : []), ...page, nav, dots);
    refreshChosen();
  };
  const go = (i: number) => {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    draw();
    wrap.scrollIntoView({ block: 'start' });
  };
  /** The War tab's world (data/conquest.ts): the realms that share it, the town counted; more realms, a bigger map. */
  const realmsPage = () => {
    const box = el('div', 'realms-page');
    const row = el('div', 'row realms-row');
    for (let n = REALMS_MIN; n <= REALMS_MAX; n++) {
      const b = button(String(n), () => ((realms = n), draw()), { cls: `place realm-count${n === realms ? ' on' : ''}` });
      row.append(b);
    }
    const rivals = realms - 1;
    box.append(
      row,
      el('div', 'purpose', `${realms} realms: your town and ${rivals} rival ${rivals === 1 ? 'power' : 'powers'}, over ${PROVINCES_PER_REALM * realms} provinces.`),
      el('div', 'hint', 'The realm\'s powers make war on each other by the season, and draw the town in. More realms make a bigger world, with more wars in it; if every province ever answers to the town or its friends, the world is won.'),
    );
    return box;
  };
  /** The last step's reminder of what was chosen. */
  const summary = () => {
    const f = FOUNDER_BY_ID[pick];
    const sc = SCENARIOS.find((x) => x.id === scenario);
    const lines = [
      `${ORIGIN_DEFS[origin].name}, led by ${name.trim() || f.name}, ${f.title}`,
      `${sc?.name ?? scenario} · ${BIOME_DEFS[biome].name} · ${DIFFICULTY_DEFS[difficulty].name}`,
      `A world of ${realms} realms and ${PROVINCES_PER_REALM * realms} provinces`,
    ];
    const box = el('div', 'card wizard-summary');
    for (const l of lines) box.append(el('div', 'purpose', l));
    return box;
  };
  step = Math.max(0, Math.min(STEPS.length - 1, step));
  draw();
  return [wrap];
}

function choices() {
  const f: FounderSpec = { pick, background: FOUNDER_BY_ID[pick].background.id, traits: [], ...(name.trim() ? { name: name.trim() } : {}) };
  return { biome, difficulty, ironman, scenario, origin, founder: f, realms, ...(heir ? { heir } : {}) };
}

/** The founder's line: a new one, or a descendant of a town gone by (the Hall of Legends: legendsPanel.ts). */
function lineage(redraw: () => void): HTMLElement[] {
  const all = readLegends().reverse().slice(0, 8);
  if (!all.length) return [];
  if (heir && !all.some((l) => l.id === heir)) heir = null;
  const cards = el('div', 'cards');
  cards.append(pickCard(!heir, 'A new line', 'The founder owes nothing to anyone.', () => ((heir = null), redraw())));
  for (const l of all) cards.append(legendCard(l, heir === l.id, () => ((heir = l.id), redraw())));
  return [el('h3', 'newgame-head', "The founder's line"), el('div', 'hint', 'A descendant inherits the heirloom (stronger each generation, and perhaps cursed), some coin and renown. Their forebears may return as spirits, and the old town comes back: as ruins on the land if it fell, else as the Old House, a power of the realm.'), cards];
}

function pickCard(on: boolean, name: string, text: string, onClick: () => void): HTMLElement {
  const c = el('button', `card pick${on ? ' on' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', name), el('span', 'card-size', on ? 'Chosen' : ''));
  c.append(top, el('span', 'purpose', text));
  c.addEventListener('click', onClick);
  return c;
}
