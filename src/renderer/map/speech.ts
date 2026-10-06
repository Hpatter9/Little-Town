// Speech bubbles on the map (the owner's ask: villagers with personalities): now and then someone says a line in
// their nature's voice (data/natures.ts) about what's going on: the weather, the hour, their hunger, a raid, a friend
// or a rival beside them, the sea. The renderer picks the moment (by id and the clock, so it needs no sim state), the
// topic from the person's view, and the line from the nature's pool.
import { Container, Graphics, Text } from 'pixi.js';
import { lineFor, NATURE_BY_ID, type Topic } from '../../shared/data/natures';
import type { PersonView } from '../../shared/sim/snapshot';
import { fontStacks } from '../fonts';
import { currentTheme } from '../theme';

/** How often someone may speak (ms per slot), how long a bubble stays, and the share of slots spoken in. */
export const SPEECH_EVERY = 48000;
export const SPEECH_FOR = 3400;
export const SPEECH_SHARE = 0.4;
/** How near (px) two people stand to be talking (the second answers a little after). */
export const TALK_NEAR = 44;
export const REPLY_AFTER = 1400;

export interface SpeechContext {
  weather: string;
  season: string;
  hour: number;
  raid: boolean;
  nearFriend: boolean;
  nearRival: boolean;
  nearChild: boolean;
  nearAnyone: boolean;
}

/** A cheap hash of a few numbers to 0..1. */
export function hash01(...n: number[]): number {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000) & 0xffffffff;
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

/** What someone would talk about now. */
export function topicFor(v: PersonView, c: SpeechContext, roll: number): Topic {
  if (c.raid) return 'raid';
  // (at a gathering, it's all anyone talks of)
  if (v.activity === 'dance') return 'feast';
  if (v.activity === 'mourn') return 'mourn';
  if (v.sick) return 'sick';
  if (v.needs.food < 0.2) return 'hungry';
  if (v.needs.rest < 0.15) return 'tired';
  if (c.nearRival && roll < 0.6) return 'rival';
  if (c.nearFriend && roll < 0.6) return 'friend';
  if (c.nearChild && roll < 0.5) return 'child';
  if (v.swimming && roll < 0.7) return 'sea';
  if (v.elder && roll < 0.25) return 'old';
  if (c.weather === 'rain' || c.weather === 'storm') return 'rain';
  if (c.weather === 'snow' || (c.season === 'winter' && roll < 0.6)) return 'cold';
  if (c.season === 'summer' && c.hour >= 11 && c.hour <= 16 && roll < 0.5) return 'hot';
  if (c.hour >= 21 || c.hour < 5) return 'night';
  if (c.nearAnyone && roll < 0.5) return 'greet';
  if (v.activity === 'idle' || v.activity === 'eat') return 'idle';
  return 'work';
}

/** The line someone says in a slot. */
export function lineNow(v: PersonView, c: SpeechContext, slot: number): string {
  const n = NATURE_BY_ID[v.nature];
  const roll = hash01(v.id, slot, 3);
  return lineFor(n, topicFor(v, c, roll), hash01(v.id, slot, 7) * 1000);
}

/** A bubble: a rounded white box with a little tail, the text in the look's body face. */
export function makeBubble(text: string): Container {
  const c = new Container();
  const family = fontStacks(currentTheme())[1].replace(/'/g, '').split(', ');
  const t = new Text({ text, style: { fontFamily: family, fontSize: 9, fill: 0x241a12, wordWrap: true, wordWrapWidth: 96, align: 'center' }, resolution: 3 });
  const w = Math.ceil(t.width) + 10;
  const h = Math.ceil(t.height) + 6;
  const g = new Graphics().roundRect(0, 0, w, h, 4).fill({ color: 0xfff8ea, alpha: 0.94 }).stroke({ color: 0x2a1f17, width: 1 });
  g.poly([w / 2 - 3, h - 1, w / 2 + 3, h - 1, w / 2, h + 4]).fill(0xfff8ea).stroke({ color: 0x2a1f17, width: 1 });
  t.position.set(5, 3);
  c.addChild(g, t);
  c.pivot.set(w / 2, h + 4);
  return c;
}
