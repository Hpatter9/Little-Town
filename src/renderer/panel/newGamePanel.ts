// New town panel: how the town starts (scenario), the founder (one of the origin's three ready-made: data/founders.ts), where to
// found it, how dangerous the world is, and ironman. Opened from the tray's "New game…", the game-over card,
// and on a first run. (It replaced a chain of Windows message boxes.)

import type { Bridge } from '../../shared/ipc';
import { BIOME_DEFS, BIOMES, DIFFICULTIES, DIFFICULTY_DEFS, type Biome, type Difficulty } from '../../shared/data/biomes';
import { founderSkills, MAX_NAME_LENGTH, SCENARIOS, type FounderSpec } from '../../shared/data/founding';
import { FOUNDER_BY_ID, FOUNDERS } from '../../shared/data/founders';
import { TRAITS } from '../../shared/data/people';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import { ORIGIN_DEFS, ORIGINS, type OriginId } from '../../shared/data/origins';
import type { Snapshot } from '../../shared/sim/snapshot';
import { TICKS_PER_HOUR } from '../../shared/sim/time';
import { loadLpc, lpcCanvas } from '../art/lpc/lpcCompose';
import { button, el } from './dom';


/* (kept while the panel re-renders, and between openings) */
let scenario = 'lone';
let origin: OriginId = 'settlers';
let name = '';
let pick = FOUNDERS.settlers[0].id;
let biome: Biome = 'forest';
let difficulty: Difficulty = 'normal';
let ironman = false;

let lpcReady: Promise<void> | null = null;

export function renderNewGame(snap: Snapshot, bridge: Bridge): HTMLElement[] {
  const origins = el('div', 'cards');
  const scenarios = el('div', 'cards');
  const founder = el('div', 'founder');
  const biomes = el('div', 'cards');
  const dangers = el('div', 'cards');
  const found = button('', () => bridge.newGame(choices()), { cls: 'place found' });

  const drawOrigins = () =>
    origins.replaceChildren(
      ...ORIGINS.map((id) => {
        const o = ORIGIN_DEFS[id];
        return pickCard(id === origin, o.name, `${o.description}\n${o.features.map((f) => `• ${f}`).join('\n')}`, () => ((origin = id), drawOrigins(), drawPlaces(), drawFounders()));
      }),
    );
  const drawScenarios = () =>
    scenarios.replaceChildren(...SCENARIOS.map((sc) => pickCard(sc.id === scenario, sc.name, sc.description, () => ((scenario = sc.id), drawScenarios()))));
  const drawPlaces = () => {
    biomes.replaceChildren(...BIOMES.map((b) => pickCard(b === biome, BIOME_DEFS[b].name, BIOME_DEFS[b].description, () => ((biome = b), drawPlaces()))));
    dangers.replaceChildren(...DIFFICULTIES.map((d) => pickCard(d === difficulty, DIFFICULTY_DEFS[d].name, DIFFICULTY_DEFS[d].description, () => ((difficulty = d), drawPlaces()))));
    found.textContent = origin === 'settlers' ? `Found a ${BIOME_DEFS[biome].name.toLowerCase()} town` : `Found ${ORIGIN_DEFS[origin].town} (${BIOME_DEFS[biome].name.toLowerCase()})`;
  };

  /* ---------------------------------------------------- the founder: one of the origin's three, and perhaps a new name */

  const nameInput = el('input', 'founder-name');
  nameInput.type = 'text';
  nameInput.maxLength = MAX_NAME_LENGTH;
  nameInput.value = name;
  nameInput.addEventListener('input', () => (name = nameInput.value));
  const cards = el('div', 'cards founders');
  const drawFounders = () => {
    const list = FOUNDERS[origin];
    if (!list.some((f) => f.id === pick)) pick = list[0].id;
    nameInput.placeholder = `Rename (or keep ${FOUNDER_BY_ID[pick].name})`;
    lpcReady ??= loadLpc();
    cards.replaceChildren(
      ...list.map((f) => {
        const on = f.id === pick;
        const c = el('button', `card pick founder-card${on ? ' on' : ''}`);
        const art = el('canvas', 'founder-art');
        art.width = art.height = 64;
        // (the figure, cropped from its 64px frame to fill the picture)
        void lpcReady!.then(() => art.getContext('2d')!.drawImage(lpcCanvas(f.look, 'walk', 0), 8, 6, 48, 48, 0, 0, 64, 64));
        const body = el('div', 'founder-body');
        const top = el('div', 'card-top');
        top.append(el('span', 'card-name', f.name), el('span', 'card-size', on ? 'Chosen' : ''));
        const levels = founderSkills(f.background);
        const best = SKILLS.filter((k) => levels[k] > 2).sort((x, y) => levels[y] - levels[x]);
        const skills = best.map((k) => `${SKILL_NAMES[k]} ${levels[k]}${f.background.passions.includes(k) ? ' ★' : ''}`).join(' · ');
        const traitNames = f.traits.map((id) => TRAITS.find((x) => x.id === id)?.name ?? id).join(', ');
        body.append(
          top,
          el('span', 'founder-title', f.title),
          el('span', 'purpose', f.story),
          el('span', 'founder-skills', `${f.background.name}: ${skills}`),
          ...(traitNames ? [el('span', 'founder-skills', traitNames)] : []),
          ...(f.brings?.length ? [el('span', 'founder-skills', `Comes with ${f.brings.map((b) => `${/^[aeiou]/.test(b) ? 'an' : 'a'} ${b}`).join(' and ')}`)] : []),
        );
        c.append(art, body);
        c.addEventListener('click', () => ((pick = f.id), drawFounders()));
        return c;
      }),
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
  return [
    el('h3', 'newgame-head', 'Who founds the town?'),
    origins,
    el('div', 'hint', 'Each changes how the whole game plays and looks. Settlers are the classic game.'),
    el('h3', 'newgame-head', 'How does it begin?'),
    scenarios,
    el('h3', 'newgame-head', 'Your founder'),
    founder,
    el('h3', 'newgame-head', 'Where will you found your town?'),
    biomes,
    el('h3', 'newgame-head', 'How dangerous is the world?'),
    dangers,
    el('h3', 'newgame-head', 'Rules'),
    iron,
    ...warning,
    found,
  ];
}

function choices() {
  const f: FounderSpec = { pick, background: FOUNDER_BY_ID[pick].background.id, traits: [], ...(name.trim() ? { name: name.trim() } : {}) };
  return { biome, difficulty, ironman, scenario, origin, founder: f };
}

function pickCard(on: boolean, name: string, text: string, onClick: () => void): HTMLElement {
  const c = el('button', `card pick${on ? ' on' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', name), el('span', 'card-size', on ? 'Chosen' : ''));
  c.append(top, el('span', 'purpose', text));
  c.addEventListener('click', onClick);
  return c;
}
