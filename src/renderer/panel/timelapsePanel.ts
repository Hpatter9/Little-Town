// The Chronicle's Timelapse tab: the town's daily pictures (renderer/timelapse.ts) played as a flipbook, with a
// slider to look at any day and the day, the age and the people under it.

import { ERA_NAMES } from '../../shared/data/eras';
import { readTimelapse } from '../timelapse';
import { el } from './dom';

/** (kept while the panel redraws: where the flipbook is, and whether it plays) */
let at = -1;
let playing = false;
let timer: number | undefined;
const FRAME_MS = 350;

export function renderTimelapse(): HTMLElement[] {
  const t = readTimelapse();
  const frames = t?.frames ?? [];
  if (frames.length < 2) {
    if (timer) clearInterval(timer);
    playing = false;
    return [el('h2', '', 'Timelapse'), el('p', 'empty', 'Each day at noon a picture of the town is kept here. Come back in a day or two to watch the camp grow.')];
  }
  if (at < 0 || at >= frames.length) at = frames.length - 1;
  const img = el('img', 'timelapse-img') as HTMLImageElement;
  img.alt = 'The town';
  const caption = el('div', 'timelapse-caption');
  const slider = el('input', 'timelapse-slider') as HTMLInputElement;
  slider.type = 'range';
  slider.min = '0';
  slider.max = String(frames.length - 1);
  const show = () => {
    const f = frames[at];
    img.src = f.url;
    slider.value = String(at);
    caption.textContent = `Day ${f.day} · ${ERA_NAMES[f.era as keyof typeof ERA_NAMES] ?? f.era} · ${f.people} ${f.people === 1 ? 'soul' : 'people'}`;
  };
  const play = el('button', 'primary', playing ? 'Pause' : '▶ Play');
  const stop = () => {
    playing = false;
    if (timer) clearInterval(timer);
    timer = undefined;
    play.textContent = '▶ Play';
  };
  const run = () => {
    if (timer) clearInterval(timer);
    timer = window.setInterval(() => {
      // (the tab closed: the picture is gone from the page)
      if (!img.isConnected) {
        clearInterval(timer);
        timer = undefined;
        return;
      }
      if (at >= frames.length - 1) return stop();
      at++;
      show();
    }, FRAME_MS);
  };
  play.addEventListener('click', () => {
    if (playing) return stop();
    playing = true;
    play.textContent = 'Pause';
    if (at >= frames.length - 1) at = 0;
    show();
    run();
  });
  // (the menu was drawn again while it played: go on playing)
  if (playing) run();
  slider.addEventListener('input', () => {
    stop();
    at = +slider.value;
    show();
  });
  show();
  const frame = el('div', 'timelapse');
  const controls = el('div', 'row timelapse-controls');
  controls.append(play, slider);
  frame.append(img, caption, controls);
  return [el('h2', '', 'Timelapse'), el('div', 'hint', `The town at noon, day by day (${frames.length} pictures${frames[0].day > 1 ? `, from day ${frames[0].day}` : ''}).`), frame];
}
