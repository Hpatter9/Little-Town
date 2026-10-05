// New town panel, one question at a time (the owner's ask: a step-by-step prompt, not one long page): who founds the
// town (the origin), the founder (one of the origin's three ready-made: data/founders.ts), how it begins (scenario),
// where, how dangerous the world is, and last the rules and the Found button. Back and Next move between the steps,
// and the dots show how far along. Opened from the tray's "New game…", the game-over card, and on a first run.

import { FOUNDER_CLASS } from '../../shared/data/founderClasses';
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
import { FOUNDER_ID, founderSheet } from '../art/heroForms';
import { PACK_LAYOUT, packUrl } from '../art/creatures/packs';
import { loadImage } from '../art/loadImage';
import { button, el } from './dom';


/* (kept while the panel re-renders, and between openings) */
let scenario = 'lone';
let origin: OriginId = 'settlers';
let name = '';
let pick = FOUNDERS.settlers[0].id;
let biome: Biome = 'forest';
let difficulty: Difficulty = 'normal';
let ironman = false;
/** The step showing (kept while the panel re-renders; back to the first once a town is founded). */
let step = 0;
const STEPS = ['Who founds the town?', 'Your founder', 'How does it begin?', 'Where will you found your town?', 'How dangerous is the world?', 'Ready to found it?'] as const;

let lpcReady: Promise<void> | null = null;

/** The founder as the map draws them (map/mapPeople.ts: a founder wears their hero form always): the idle frame of
 *  the hero sheet their calling's base class gives (`founderSheet`, the same choice), feet at the foot of the picture,
 *  facing right. A founder with no calling, or until the sheet loads, is their LPC figure. */
function drawFounderArt(art: HTMLCanvasElement, id: string, look: (typeof FOUNDERS)[OriginId][number]['look']): void {
  const g = art.getContext('2d')!;
  const lpc = () => void lpcReady!.then(() => g.drawImage(lpcCanvas(look, 'walk', 0), 8, 6, 48, 48, 0, 0, 64, 64));
  const calling = FOUNDER_CLASS[id];
  if (!calling) return lpc();
  const sheet = founderSheet(calling.base, FOUNDER_ID, false, false);
  const lay = PACK_LAYOUT[sheet];
  if (!lay) return lpc();
  void loadImage(packUrl(sheet))
    .then((img) => {
      const row = Math.max(0, lay.rows.indexOf('idle'));
      const k = 60 / lay.figure;
      const w = lay.w * k;
      const h = lay.h * k;
      g.clearRect(0, 0, 64, 64);
      g.imageSmoothingEnabled = false;
      g.save();
      if (!lay.facesRight) {
        g.translate(64, 0);
        g.scale(-1, 1);
      }
      g.drawImage(img, 0, row * lay.h, lay.w, lay.h, 32 - w / 2, 62 - h, w, h);
      g.restore();
    })
    .catch(lpc);
}

export function renderNewGame(snap: Snapshot, bridge: Bridge): HTMLElement[] {
  const origins = el('div', 'cards');
  const scenarios = el('div', 'cards');
  const founder = el('div', 'founder');
  const biomes = el('div', 'cards');
  const dangers = el('div', 'cards');
  const found = button('', () => {
    step = 0;
    bridge.newGame(choices());
  }, { cls: 'place found next' });

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
    // (a shore people settles the coast and nowhere else: sim/sea.ts)
    const shore = ORIGIN_DEFS[origin].rules.shape === 'sea';
    if (shore) biome = 'coast';
    biomes.replaceChildren(...(shore ? [el('div', 'hint', `${ORIGIN_DEFS[origin].name} settle the coast: half their land is the sea.`)] : BIOMES.map((b) => pickCard(b === biome, BIOME_DEFS[b].name, BIOME_DEFS[b].description, () => ((biome = b), drawPlaces())))));
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
        drawFounderArt(art, f.id, f.look);
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
          ...(FOUNDER_CLASS[f.id] ? [el('span', 'founder-skills founder-calling', `Calling: ${FOUNDER_CLASS[f.id].stages[0]} (theirs alone)`)] : []),
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

  // one step at a time: the question, its choices, and Back / Next
  const wrap = el('div', 'wizard');
  const draw = () => {
    const page: HTMLElement[] = [];
    if (step === 0) page.push(origins, el('div', 'hint', 'Each changes how the whole game plays and looks. Settlers are the classic game.'));
    else if (step === 1) page.push(founder);
    else if (step === 2) page.push(scenarios);
    else if (step === 3) page.push(biomes);
    else if (step === 4) page.push(dangers);
    else page.push(summary(), el('h3', 'newgame-head', 'Rules'), iron, ...warning);
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
    wrap.replaceChildren(el('div', 'wizard-step', `Step ${step + 1} of ${STEPS.length}`), el('h3', 'newgame-head', STEPS[step]), ...page, nav, dots);
  };
  const go = (i: number) => {
    step = Math.max(0, Math.min(STEPS.length - 1, i));
    draw();
    wrap.scrollIntoView({ block: 'start' });
  };
  /** The last step's reminder of what was chosen. */
  const summary = () => {
    const f = FOUNDER_BY_ID[pick];
    const sc = SCENARIOS.find((x) => x.id === scenario);
    const lines = [
      `${ORIGIN_DEFS[origin].name}, led by ${name.trim() || f.name}, ${f.title}`,
      `${sc?.name ?? scenario} · ${BIOME_DEFS[biome].name} · ${DIFFICULTY_DEFS[difficulty].name}`,
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
