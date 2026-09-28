// New town panel: how the town starts (scenario), the founder (name, looks, background, traits), where to
// found it, how dangerous the world is, and ironman. Opened from the tray's "New game…", the game-over card,
// and on a first run. (It replaced a chain of Windows message boxes.)

import type { Bridge } from '../../shared/ipc';
import { BIOME_DEFS, BIOMES, DIFFICULTIES, DIFFICULTY_DEFS, type Biome, type Difficulty } from '../../shared/data/biomes';
import { BACKGROUNDS, founderSkills, MAX_FOUNDER_TRAITS, MAX_NAME_LENGTH, SCENARIOS, type FounderSpec } from '../../shared/data/founding';
import { HAIR_CHOICES, HAIR_STYLES, NAMES, OUTFIT_CHOICES, randomLook, SKINS, TRAITS, type Look } from '../../shared/data/people';
import { SKILL_NAMES, SKILLS } from '../../shared/data/skills';
import { Rng } from '../../shared/rng';
import type { Snapshot } from '../../shared/sim/snapshot';
import { TICKS_PER_HOUR } from '../../shared/sim/time';
import { loadLpc, lpcCanvas } from '../art/lpc/lpcCompose';
import { button, el } from './dom';

const dice = () => new Rng(Math.floor(Math.random() * 0x7fffffff));

/* (kept while the panel re-renders, and between openings) */
let scenario = 'lone';
let name = '';
let look: Look = randomLook(dice());
let background = 'forager';
let traits: string[] = [];
let biome: Biome = 'forest';
let difficulty: Difficulty = 'normal';
let ironman = false;

let lpcReady: Promise<void> | null = null;

export function renderNewGame(snap: Snapshot, bridge: Bridge): HTMLElement[] {
  const scenarios = el('div', 'cards');
  const founder = el('div', 'founder');
  const backgrounds = el('div', 'cards');
  const traitBox = el('div', 'trait-chips');
  const biomes = el('div', 'cards');
  const dangers = el('div', 'cards');
  const found = button('', () => bridge.newGame(choices()), { cls: 'place found' });

  const drawScenarios = () =>
    scenarios.replaceChildren(...SCENARIOS.map((sc) => pickCard(sc.id === scenario, sc.name, sc.description, () => ((scenario = sc.id), drawScenarios()))));
  const drawBackgrounds = () =>
    backgrounds.replaceChildren(
      ...BACKGROUNDS.map((b) => {
        const levels = founderSkills(b);
        const best = SKILLS.filter((k) => levels[k] > 2).sort((x, y) => levels[y] - levels[x]);
        const skills = best.map((k) => `${SKILL_NAMES[k]} ${levels[k]}${b.passions.includes(k) ? ' ★' : ''}`).join(' · ');
        return pickCard(b.id === background, b.name, `${b.description}\n${skills}`, () => ((background = b.id), drawBackgrounds()));
      }),
    );
  const drawTraits = () =>
    traitBox.replaceChildren(
      ...TRAITS.map((t) => {
        const on = traits.includes(t.id);
        const blocked = !on && (traits.length >= MAX_FOUNDER_TRAITS || traits.some((u) => t.excludes?.includes(u)));
        const b = button(t.name, () => ((traits = on ? traits.filter((u) => u !== t.id) : [...traits, t.id]), drawTraits()), {
          cls: `place small${on ? ' on' : ''}`,
          disabled: blocked,
          title: t.description,
        });
        return b;
      }),
      el('div', 'hint', traits.length ? traits.map((id) => TRAITS.find((t) => t.id === id)!.description).join(' ') : `Pick up to ${MAX_FOUNDER_TRAITS}, or none.`),
    );
  const drawPlaces = () => {
    biomes.replaceChildren(...BIOMES.map((b) => pickCard(b === biome, BIOME_DEFS[b].name, BIOME_DEFS[b].description, () => ((biome = b), drawPlaces()))));
    dangers.replaceChildren(...DIFFICULTIES.map((d) => pickCard(d === difficulty, DIFFICULTY_DEFS[d].name, DIFFICULTY_DEFS[d].description, () => ((difficulty = d), drawPlaces()))));
    found.textContent = `Found a ${BIOME_DEFS[biome].name.toLowerCase()} town`;
  };

  /* ---------------------------------------------------- the founder: preview, name and looks */

  const preview = el('canvas', 'founder-preview');
  preview.width = preview.height = 64;
  const drawPreview = () => {
    lpcReady ??= loadLpc();
    void lpcReady.then(() => {
      const g = preview.getContext('2d')!;
      g.clearRect(0, 0, 64, 64);
      g.drawImage(lpcCanvas(look, 'walk', 0), 0, 0);
    });
  };
  const nameInput = el('input', 'founder-name');
  nameInput.type = 'text';
  nameInput.maxLength = MAX_NAME_LENGTH;
  nameInput.placeholder = 'Name (random if blank)';
  nameInput.value = name;
  nameInput.addEventListener('input', () => (name = nameInput.value));
  const looks = el('div', 'looks');
  const drawLooks = () => {
    const swatches = (label: string, list: readonly string[], cur: string, set: (v: string) => void) => {
      const row = el('div', 'look-row');
      const colours = el('div', 'swatches'); // (wraps in its own column, clear of the label)
      for (const c of list) {
        const s = el('button', `swatch${c === cur ? ' on' : ''}`);
        s.style.background = c;
        s.title = label;
        s.addEventListener('click', () => (set(c), drawLooks(), drawPreview()));
        colours.append(s);
      }
      row.append(el('span', 'look-label', label), colours);
      return row;
    };
    const style = el('div', 'look-row');
    const i = HAIR_STYLES.indexOf(look.hair);
    const step = (d: number) => () => ((look = { ...look, hair: HAIR_STYLES[(i + d + HAIR_STYLES.length) % HAIR_STYLES.length] }), drawLooks(), drawPreview());
    style.append(el('span', 'look-label', 'Hair'), button('‹', step(-1), { cls: 'place small' }), el('span', 'look-value', `Style ${i + 1} of ${HAIR_STYLES.length}`), button('›', step(1), { cls: 'place small' }));
    const body = el('div', 'look-row');
    body.append(
      el('span', 'look-label', 'Body'),
      button('Man', () => ((look = { ...look, gender: 'm' }), drawLooks(), drawPreview()), { cls: `place small${look.gender === 'm' ? ' on' : ''}` }),
      button('Woman', () => ((look = { ...look, gender: 'f', beard: false }), drawLooks(), drawPreview()), { cls: `place small${look.gender === 'f' ? ' on' : ''}` }),
      ...(look.gender === 'm' ? [button('Beard', () => ((look = { ...look, beard: !look.beard }), drawLooks(), drawPreview()), { cls: `place small${look.beard ? ' on' : ''}` })] : []),
    );
    looks.replaceChildren(
      body,
      swatches('Skin', SKINS, look.skin, (c) => (look = { ...look, skin: c })),
      style,
      swatches('Hair colour', HAIR_CHOICES, look.hairColor, (c) => (look = { ...look, hairColor: c })),
      swatches('Clothes', OUTFIT_CHOICES, look.outfit, (c) => (look = { ...look, outfit: c })),
    );
  };
  const side = el('div', 'founder-side');
  side.append(
    preview,
    button('Random look', () => ((look = randomLook(dice())), drawLooks(), drawPreview()), { cls: 'place small' }),
    button('Random name', () => ((name = nameInput.value = dice().pick(NAMES)), undefined), { cls: 'place small' }),
  );
  const main = el('div', 'founder-main');
  main.append(nameInput, looks);
  founder.append(side, main);

  drawScenarios();
  drawBackgrounds();
  drawTraits();
  drawPlaces();
  drawLooks();
  drawPreview();

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
  return [
    el('h3', 'newgame-head', 'How does it begin?'),
    scenarios,
    el('h3', 'newgame-head', 'Your founder'),
    founder,
    el('h3', 'newgame-head', 'Background'),
    backgrounds,
    el('h3', 'newgame-head', 'Traits'),
    traitBox,
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
  const f: FounderSpec = { background, traits: [...traits], look: { ...look }, ...(name.trim() ? { name: name.trim() } : {}) };
  return { biome, difficulty, ironman, scenario, founder: f };
}

function pickCard(on: boolean, name: string, text: string, onClick: () => void): HTMLElement {
  const c = el('button', `card pick${on ? ' on' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', name), el('span', 'card-size', on ? 'Chosen' : ''));
  c.append(top, el('span', 'purpose', text));
  c.addEventListener('click', onClick);
  return c;
}
