// Small DOM widgets that float over the town: the placement banner, the action bar above a selected
// building, the person mini card, and toasts. All but toasts capture the mouse ([data-hit]).

import { SKILL_NAMES, SKILLS } from '../shared/data/skills';
import { ITEM_BY_ID, SLOT_NAMES, SLOTS } from '../shared/data/items';
import type { ExpeditionView, PersonView, PromptView } from '../shared/sim/snapshot';
import { bleedLeft, tripProgress } from '../shared/format';
import { itemIcon } from './art/icons';
import { guildBadge } from './art/guildMarks';
import type { GuildRole } from '../shared/data/guilds';

export interface Banner {
  /** With `done`, a Done button beside Cancel calls it. */
  show(text: string, detail: string, done?: () => void): void;
  hide(): void;
}

export function createBanner(onCancel: () => void): Banner {
  const el = document.createElement('div');
  el.id = 'banner';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  const text = document.createElement('span');
  const detail = document.createElement('span');
  detail.className = 'banner-detail';
  const cancel = document.createElement('button');
  cancel.className = 'tab';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', onCancel);
  const finish = document.createElement('button');
  finish.className = 'tab';
  finish.textContent = 'Done';
  finish.hidden = true;
  let onDone: (() => void) | null = null;
  finish.addEventListener('click', () => onDone?.());
  el.append(text, detail, finish, cancel);
  document.body.append(el);
  return {
    show(t, d, done) {
      if (text.textContent !== t) text.textContent = t;
      if (detail.textContent !== d) detail.textContent = d;
      onDone = done ?? null;
      finish.hidden = !done;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
}

/** The great creature's small card (sim/creature.ts): its last notable deed, with Praise and Scold. It never holds the
 *  town; it goes when answered or when the sim lets the question lapse (unanswered counts as neither). */
export interface BeastAsk {
  show(id: number, text: string): void;
  hide(): void;
}

export function createBeastAsk(answer: (praise: boolean) => void): BeastAsk {
  const el = document.createElement('div');
  el.id = 'beast-ask';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  el.style.cssText =
    'position:fixed;left:56px;bottom:calc(env(safe-area-inset-bottom, 0px) + 74px);max-width:min(300px, calc(100vw - 64px));z-index:30;' +
    'background:rgba(28,22,14,0.92);color:#f4e6c8;border:1px solid #8a6a3a;border-radius:8px;padding:6px 8px;font:12px/1.35 sans-serif;box-shadow:0 2px 8px rgba(0,0,0,0.4)';
  const text = document.createElement('div');
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:6px;margin-top:5px';
  let shown = -1;
  let answered = false;
  const btn = (label: string, praise: boolean, bg: string) => {
    const b = document.createElement('button');
    b.textContent = label;
    b.style.cssText = `flex:1;padding:5px 0;border:0;border-radius:5px;font:bold 12px sans-serif;color:#fff;background:${bg}`;
    b.addEventListener('click', () => {
      answer(praise);
      answered = true;
      el.hidden = true;
    });
    return b;
  };
  row.append(btn('Praise', true, '#4f7a34'), btn('Scold', false, '#8a3a2a'));
  el.append(text, row);
  document.body.append(el);
  return {
    show(id, t) {
      // (once answered it stays gone, even before the next snapshot drops the question)
      if (id === shown && answered) return;
      if (id !== shown) answered = false;
      shown = id;
      text.textContent = t;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
    },
  };
}

/** Short-lived messages in the strip's sky ("Research complete: ..."). Never capture the mouse. */
export interface Toasts {
  push(text: string): void;
}

const TOAST_MS = 6000;

export function createToasts(): Toasts {
  const box = document.createElement('div');
  box.id = 'toasts';
  document.body.append(box);
  return {
    push(text) {
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = text;
      box.append(t);
      while (box.children.length > 3) box.firstElementChild!.remove();
      setTimeout(() => t.classList.add('fade'), TOAST_MS - 600);
      setTimeout(() => t.remove(), TOAST_MS);
    },
  };
}

/** The mini card for a clicked person: mood, job, needs, best skills. Sits beside them (the strip is short). */
export interface PersonCard {
  show(p: PersonView, isMain: boolean, personX: number, guilds?: { name: string; role: GuildRole; lead: boolean }[]): void;
  hide(): void;
  readonly visible: boolean;
}

export function createPersonCard(onDetails: () => void, onClose: () => void): PersonCard {
  const el = document.createElement('div');
  el.id = 'person-card';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  document.body.append(el);
  let key = '';
  return {
    show(p, isMain, personX, guilds = []) {
      const top = SKILLS.map((k) => [k, p.skills[k]] as const)
        .sort((a, b) => b[1].level - a[1].level)
        .slice(0, 3);
      const k = JSON.stringify([p.id, p.doing, Math.round(p.morale), Math.round(p.needs.food * 20), Math.round(p.needs.rest * 20), top.map(([s, v]) => s + v.level), p.bed, Math.round(p.hp), p.downed, p.bleedMinutes, p.gear, guilds.map((g) => [g.name, g.lead])]);
      if (k !== key) {
        key = k;
        const reasons = [...p.moodReasons].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, 2);
        const title = row('card-title', `${p.name}${isMain ? ' (you)' : ''}`, `${p.typeName}`);
        let gl: HTMLElement | null = null;
        if (guilds.length) {
          gl = document.createElement('div');
          gl.className = 'card-guilds';
          for (const g of guilds) {
            const chip = document.createElement('span');
            chip.className = 'guild-chip';
            chip.append(guildBadge(g.role, 14), `${g.lead ? '★ ' : ''}${g.name}`);
            gl.append(chip);
          }
        }
        const gear = SLOTS.filter((s) => p.gear[s]).map((s) => {
          const def = ITEM_BY_ID[p.gear[s]!];
          const icon = itemIcon(def, 1);
          icon.title = `${SLOT_NAMES[s]}: ${def.name}`;
          return icon;
        });
        if (gear.length) {
          const g = document.createElement('span');
          g.className = 'card-gear';
          g.append(...gear);
          title.insertBefore(g, title.lastChild);
        }
        el.replaceChildren(
          title,
          line('card-doing', p.doing),
          meter('Morale', p.morale / 100, `${Math.round(p.morale)}${reasons.length ? ' · ' + reasons.map((r) => `${r.text} ${r.value > 0 ? '+' : ''}${r.value}`).join(', ') : ''}`),
          meter('Health', p.hp / p.maxHp, p.downed === 'bleeding' ? `bleeding out: ${bleedLeft(p.bleedMinutes)} left!` : p.downed ? 'down, recovering in bed' : p.hp < p.maxHp ? `${Math.round(p.hp)}/${p.maxHp}` : ''),
          meter('Food', p.needs.food, ''),
          meter('Rest', p.needs.rest, ''),
          line('card-dim', top.map(([s, v]) => `${SKILL_NAMES[s]} ${v.level}${v.passion ? '★' : ''}`).join(' · ')),
          line('card-dim', `${p.traits.map((t) => t.name).join(', ') || 'No traits'} · ${p.bed ? `Sleeps in the ${p.bed.toLowerCase()}` : 'No bed'}`),
          buttons([
            ['Details', onDetails],
            ['✕', onClose],
          ]),
        );
        if (gl) title.after(gl);
      }
      el.hidden = false;
      const w = el.offsetWidth;
      const right = personX + 18 + w < window.innerWidth - 110; // stay clear of the tab dock
      el.style.left = `${Math.round(right ? personX + 18 : Math.max(4, personX - 18 - w))}px`;
    },
    hide() {
      el.hidden = true;
      key = '';
    },
    get visible() {
      return !el.hidden;
    },
  };
}

function line(cls: string, text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = cls;
  d.textContent = text;
  return d;
}

function row(cls: string, left: string, right: string): HTMLElement {
  const d = document.createElement('div');
  d.className = cls;
  const a = document.createElement('span');
  a.textContent = left;
  const b = document.createElement('span');
  b.className = 'card-dim';
  b.textContent = right;
  d.append(a, b);
  return d;
}

function meter(label: string, value: number, text: string): HTMLElement {
  const d = document.createElement('div');
  d.className = 'meter';
  const l = document.createElement('span');
  l.className = 'meter-label';
  l.textContent = label;
  const bar = document.createElement('span');
  bar.className = 'meter-bar';
  const fill = document.createElement('span');
  fill.className = value < 0.25 ? 'meter-fill low' : 'meter-fill';
  fill.style.width = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%`;
  bar.append(fill);
  const t = document.createElement('span');
  t.className = 'meter-text';
  t.textContent = text;
  d.append(l, bar, t);
  return d;
}

function buttons(list: [string, () => void][]): HTMLElement {
  const d = document.createElement('div');
  d.className = 'card-buttons';
  for (const [label, fn] of list) {
    const b = document.createElement('button');
    b.className = 'tab';
    b.textContent = label;
    b.addEventListener('click', fn);
    d.append(b);
  }
  return d;
}

/** A label over the expedition pane: where they're going, how it's going, and a way to the board. */
export interface ExpeditionHeader {
  show(v: ExpeditionView, extraCount: number, x: number, width: number): void;
  hide(): void;
}

export function createExpeditionHeader(onBoard: () => void): ExpeditionHeader {
  const el = document.createElement('div');
  el.id = 'exp-header';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  const title = document.createElement('span');
  title.className = 'exp-title';
  const info = document.createElement('span');
  info.className = 'exp-info';
  const b = document.createElement('button');
  b.className = 'tab';
  b.textContent = 'Board';
  b.addEventListener('click', onBoard);
  // a thin bar along the bottom: how far through the whole trip they are
  const track = document.createElement('span');
  track.className = 'exp-track';
  const fill = document.createElement('span');
  fill.className = 'exp-fill';
  track.append(fill);
  el.append(title, info, b, track);
  document.body.append(el);
  return {
    show(v, extra, x, width) {
      const phase = v.battle
        ? 'fighting!'
        : v.waiting
          ? 'waiting for your decision'
          : v.phase === 'out'
            ? 'heading out'
            : v.phase === 'work'
              ? v.scenery === 'woods' || v.scenery === 'cave'
                ? 'hunting'
                : 'gathering'
              : v.recalled
                ? 'recalled, heading home'
                : 'heading home';
      const t = `${v.destName}${extra ? ` (+${extra} more)` : ''}`;
      const i = `${phase} · ${formatTime(v.secondsLeft)} left · loot ${v.lootSize}/${v.carry}`;
      if (title.textContent !== t) title.textContent = t;
      if (info.textContent !== i) info.textContent = i;
      const w = `${Math.floor(tripProgress(v) * 100)}%`;
      if (fill.style.width !== w) fill.style.width = w;
      el.hidden = false;
      el.style.left = `${Math.round(x + 10)}px`;
      el.style.maxWidth = `${Math.round(width - 20)}px`;
    },
    hide() {
      el.hidden = true;
    },
  };
}

function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

/** A question for the player (from the road), with a countdown to its default answer. */
export interface PromptCard {
  show(p: PromptView): void;
  hide(): void;
  /** The questions closed unanswered, oldest first: a small button to open the oldest again (the desktop strip; on the
   *  phone the page has its own: mobile/waitingChoices.ts). */
  waiting(parked: PromptView[]): void;
}

export function createPromptCard(onAnswer: (prompt: number, option: number) => void, onPark: (prompt: number) => void = () => {}, onOpen: (prompt: number) => void = () => {}): PromptCard {
  const el = document.createElement('div');
  el.id = 'prompt';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  document.body.append(el);
  let shown = -1;
  const count = document.createElement('span');
  count.className = 'prompt-count';
  const wait = document.createElement('button');
  wait.id = 'prompt-waiting';
  wait.className = 'tab';
  wait.setAttribute('data-hit', '');
  wait.hidden = true;
  let oldest = -1;
  wait.addEventListener('click', () => oldest >= 0 && onOpen(oldest));
  document.body.append(wait);
  return {
    waiting(parked) {
      oldest = parked[0]?.id ?? -1;
      wait.hidden = !parked.length || window.parent !== window;
      wait.textContent = `❓ ${parked.length} ${parked.length === 1 ? 'choice' : 'choices'} waiting`;
    },
    show(p) {
      if (p.id !== shown) {
        shown = p.id;
        const title = document.createElement('div');
        title.className = 'prompt-title';
        title.textContent = p.title;
        const text = document.createElement('div');
        text.className = 'prompt-text';
        text.textContent = p.text;
        const row = document.createElement('div');
        row.className = 'prompt-row';
        p.options.forEach((label, i) => {
          const b = document.createElement('button');
          b.className = i === p.defaultOption ? 'tab default' : 'tab';
          b.textContent = i === p.recommended ? `★ ${label}` : label;
          if (i === p.recommended && p.why) b.title = `The town recommends this: ${p.why}`;
          b.addEventListener('click', () => onAnswer(p.id, i));
          row.append(b);
        });
        row.append(count);
        // (the corner ✕ closes it unanswered: it waits behind the choices button, sim/popups.ts)
        const x = document.createElement('button');
        x.className = 'prompt-x';
        x.textContent = '✕';
        x.title = p.waits ? 'Close (the town still waits for your answer)' : 'Close: answer later from the choices button';
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', () => onPark(p.id));
        el.replaceChildren(title, text, row);
        if (p.kind !== 'raid' && p.kind !== 'gate') el.append(x); // (the raid's own and the gate's can't wait)
      }
      count.textContent = p.secondsLeft === null ? '' : `${p.options[p.defaultOption]} in ${Math.ceil(p.secondsLeft)}s`;
      el.hidden = false;
    },
    hide() {
      el.hidden = true;
      shown = -1;
    },
  };
}

/** Shown when the game ends: the founder dies with no heir, the town is abandoned, or the ship lifts off (a win). The
 *  founder's fall names them, the days the town lasted and how they died; the button goes back to the main menu, where
 *  the town is kept as a legend (the phone: Bridge `endTown`). */
export function createGameOver(onDone: () => void): { show(text: string, won?: boolean, fall?: { founder?: string; days?: number; cause?: string }): void } {
  const el = document.createElement('div');
  el.id = 'gameover';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  const title = document.createElement('div');
  title.className = 'gameover-title';
  const text = document.createElement('div');
  text.className = 'gameover-text';
  const b = document.createElement('button');
  b.className = 'tab';
  b.textContent = 'Back to the main menu';
  b.addEventListener('click', () => {
    b.disabled = true;
    onDone();
  });
  el.append(title, text, b);
  document.body.append(el);
  return {
    show(t, won = false, fall) {
      title.textContent = won ? 'Victory' : fall?.founder ? `${fall.founder} has died` : 'Game over';
      el.classList.toggle('won', won);
      text.textContent = fall?.founder ? `${fall.founder} lasted ${fall.days ?? 0} day${fall.days === 1 ? '' : 's'}. They died ${fall.cause ?? ''}, with no heir to take up the town. Their story will be remembered as a legend.` : t;
      el.hidden = false;
    },
  };
}

export interface Action {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface ActionBar {
  show(actions: Action[], centreX: number, bottomY: number): void;
  hide(): void;
  readonly visible: boolean;
}

export function createActionBar(): ActionBar {
  const el = document.createElement('div');
  el.id = 'actions';
  el.setAttribute('data-hit', '');
  el.hidden = true;
  document.body.append(el);
  let key = '';
  return {
    show(actions, centreX, bottomY) {
      const k = actions.map((a) => a.label).join('|');
      if (k !== key) {
        key = k;
        el.replaceChildren(
          ...actions.map((a) => {
            const b = document.createElement('button');
            b.className = a.danger ? 'tab danger' : 'tab';
            b.textContent = a.label;
            b.addEventListener('click', a.onClick);
            return b;
          }),
        );
      }
      el.hidden = false;
      const w = el.offsetWidth;
      el.style.left = `${Math.round(Math.max(4, Math.min(window.innerWidth - w - 4, centreX - w / 2)))}px`;
      el.style.bottom = `${Math.round(Math.max(4, window.innerHeight - bottomY + 4))}px`;
    },
    hide() {
      el.hidden = true;
      key = '';
    },
    get visible() {
      return !el.hidden;
    },
  };
}
