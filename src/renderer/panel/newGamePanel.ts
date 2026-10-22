// New town panel, one question at a time (the owner's ask: a step-by-step prompt, not one long page): who founds the
// town (the origin), the founder (one of the origin's three ready-made: data/founders.ts), how it begins (scenario),
// where, how dangerous the world is, and last the rules and the Found button. Tapping a choice picks it and shows its details; Accept confirms and moves on, and Back
// returns with the earlier choice still picked. The dots show how far along. Opened from the tray's "New game…", the game-over card, and on a first run.

import { CONQUEST } from '../../shared/data/conquest';
import { readLegends } from '../legends';
import { legendCard } from './legendsPanel';
import { paintPortrait } from '../art/folkPortrait';
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
import { BIOME_SCENE, DANGER_GLYPH, figureSymbol, glyphSymbol, ORIGIN_GLYPH, SCENARIO_GLYPH, sceneSymbol, tileGrid, type Tile } from './newTownTiles';
import { animScene } from './scenePlayer';
import { BIOME_SCRIPTS, DANGER_SCRIPTS, founderScript, ORIGIN_SCRIPTS, SCENARIO_SCRIPTS } from './sceneScripts';


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

/** The tiles of each step's grid, so the footer can show the picked one's details. */
const stepTiles: Tile[][] = [];

let lpcReady: Promise<void> | null = null;

/** The founder as the map draws them (map/mapPeople.ts: a founder wears their hero form always): the idle frame of
 *  the hero sheet their calling's base class gives (`founderSheet`, the same choice), feet at the foot of the picture,
 *  facing right. A founder with no calling, or until the sheet loads, is their LPC figure. */
function drawFounderArt(art: HTMLCanvasElement, id: string, look: (typeof FOUNDERS)[OriginId][number]['look']): void {
  const g = art.getContext('2d')!;
  // as the map will draw them: their isometric look (art/folkPortrait.ts), whole; the paper doll (art/hkFolk.ts) in their
  // calling's dress, then the plain old look, only until it loads, and never over it
  const keys = hkLayers(hkWhoOfLook(FOUNDER_ID, look, { cls: FOUNDER_CLASS[id]?.base ?? null, founder: true }), { fighting: true, activity: 'idle' });
  paintPortrait(art, { id: FOUNDER_ID, origin, look, gear: {} }, {
    mode: 'full',
    stand: () => {
      let drawn = false;
      const hk = () => {
        if (drawn || art.dataset.folk) return true;
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
        if (!drawn && !art.dataset.folk) g.drawImage(lpcCanvas(look, 'walk', 0), 8, 6, 48, 48, 0, 0, 64, 64);
      });
    },
  });
}

/** The paper doll's layers for a founder (what scenePlayer.ts draws; the same dress as the founder's tile). */
const dollKeys = (f: (typeof FOUNDERS)[OriginId][number]): string[] => hkLayers(hkWhoOfLook(FOUNDER_ID, f.look, { cls: FOUNDER_CLASS[f.id]?.base ?? null, founder: true }), { fighting: true, activity: 'idle' });
/** A founder's picture for a tile. */
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
    bridge.newGame(choices());
  }, { cls: 'place found next' });

  const drawOrigins = () =>
    origins.replaceChildren(
      tileGrid(
        (stepTiles[0] = ORIGINS.map((id): Tile => {
          const o = ORIGIN_DEFS[id];
          return {
            id,
            name: o.name,
            symbol: () => glyphSymbol(ORIGIN_GLYPH[id]),
            scene: () => animScene(ORIGIN_SCRIPTS[id], FOUNDERS[id].map(dollKeys)),
            lines: () => [o.description, ...o.features.map((f) => `• ${f}`)],
          };
        })),
        origin,
        (id) => ((origin = id as OriginId), drawOrigins(), drawPlaces(), drawFounders(), refreshChosen()),
      ),
    );
  const drawScenarios = () =>
    scenarios.replaceChildren(
      tileGrid(
        (stepTiles[2] = SCENARIOS.map((sc): Tile => ({
          id: sc.id,
          name: sc.name,
          symbol: () => glyphSymbol(SCENARIO_GLYPH[sc.id] ?? ['Food', 7, 2]),
          scene: () => animScene(SCENARIO_SCRIPTS[sc.id] ?? SCENARIO_SCRIPTS.lone, FOUNDERS[origin].map(dollKeys)),
          lines: () => [sc.description],
        }))),
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
              (stepTiles[3] = BIOMES.map((b): Tile => ({
                id: b,
                name: BIOME_DEFS[b].name,
                symbol: () => sceneSymbol(BIOME_SCENE[b]),
                scene: () => animScene(BIOME_SCRIPTS[b], FOUNDERS[origin].map(dollKeys)),
                lines: () => [BIOME_DEFS[b].description],
              }))),
              biome,
              (id) => ((biome = id as Biome), drawPlaces(), refreshChosen()),
            ),
          ]),
    );
    dangers.replaceChildren(
      tileGrid(
        (stepTiles[4] = DIFFICULTIES.map((d): Tile => ({
          id: d,
          name: DIFFICULTY_DEFS[d].name,
          symbol: () => glyphSymbol(DANGER_GLYPH[d]),
          scene: () => animScene(DANGER_SCRIPTS[d], FOUNDERS[origin].map(dollKeys)),
          lines: () => [DIFFICULTY_DEFS[d].description],
        }))),
        difficulty,
        (id) => ((difficulty = id as Difficulty), drawPlaces(), refreshChosen()),
      ),
    );
    found.textContent = origin === 'settlers' ? `Accept: found a ${BIOME_DEFS[biome].name.toLowerCase()} town` : `Accept: found ${ORIGIN_DEFS[origin].town} (${BIOME_DEFS[biome].name.toLowerCase()})`;
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
        (stepTiles[1] = list.map((f): Tile => ({
          id: f.id,
          name: f.name,
          symbol: () => figureSymbol(doll(f)),
          scene: () => {
            const levels = founderSkills(f.background);
            const loves = f.background.passions.slice().sort((x, y) => levels[y] - levels[x])[0];
            return animScene(founderScript(origin, loves), [f, ...list.filter((o) => o !== f)].map(dollKeys));
          },
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
        }))),
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
  const chosenId = (): string => [origin, pick, scenario, biome, difficulty][step] ?? '';
  /** The details box: what the picked option is and how it plays (the sticky footer, above Accept). */
  const details = el('div', 'nt-details');
  const refreshChosen = () => {
    const t = stepTiles[step]?.find((x) => x.id === chosenId());
    details.hidden = !t;
    if (!t) return details.replaceChildren();
    details.replaceChildren(el('div', 'nt-details-name', t.name), ...t.lines().map((l) => el('p', 'nt-details-text', l)));
  };
  const draw = () => {
    const page: HTMLElement[] = [];
    if (step === 0) page.push(el('div', 'hint', 'You play the founder: you steer them, and you order every building yourself. Your people live and work on their own. Tap a people to read about it, then Accept.'), origins);
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
      step < STEPS.length - 1 ? button('Accept', () => go(step + 1), { cls: 'place next accept' }) : found,
    );
    const foot = el('div', 'wizard-foot');
    foot.append(...(step <= 4 ? [details] : []), nav);
    wrap.replaceChildren(el('div', 'wizard-step', `Step ${step + 1} of ${STEPS.length}`), el('h3', 'newgame-head', STEPS[step]), ...page, dots, foot);
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
      ...(CONQUEST.on ? [`A world of ${realms} realms and ${PROVINCES_PER_REALM * realms} provinces`] : []),
    ];
    const box = el('div', 'card wizard-summary');
    // (the game's mark over it, the home-screen icon: loading/logo.ts; gone where the page has none, as on the desktop)
    const mark = document.createElement('img');
    mark.src = 'icon-192.png';
    mark.alt = '';
    mark.style.cssText = 'display:block;width:72px;height:72px;margin:0 auto 6px;image-rendering:pixelated';
    mark.onerror = () => mark.remove();
    box.append(mark);
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
