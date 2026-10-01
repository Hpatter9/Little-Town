// The sky's colours for a time of day and weather (no Pixi here: the phone page behind the strip uses it too, so
// the whole screen is one sky).

import type { Weather, WeatherNow } from '../../shared/sim/weather';

/** How much of the sky each weather covers with cloud (0..1). */
export const COVER: Record<Weather, number> = { clear: 0.12, cloudy: 0.5, rain: 0.8, storm: 0.95, snow: 0.7, fog: 0.6 };

/** How overcast it is now, 0..1 (eased in over the start of a new spell of weather). */
export function weatherCover(w: WeatherNow): number {
  const t = Math.min(1, w.through / 0.15);
  return COVER[w.before] + (COVER[w.kind] - COVER[w.before]) * t;
}

export function mix(a: number, b: number, t: number): number {
  const ch = (s: number) => Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
}

/** The sky's colour at the top and down at the horizon. */
export function skyColors(hours: number, daylight: number, cover: number): { top: number; horizon: number } {
  let top = mix(0x16204a, 0x3f7fd0, daylight);
  let horizon = mix(0x2e3c6e, 0xa8d2f2, daylight);
  // dawn and dusk: a warm glow low down while the light comes and goes
  const twilight = daylight > 0 && daylight < 1 ? 1 - Math.abs(daylight * 2 - 1) : 0;
  const glow = hours < 12 ? 0xf2a070 : 0xf08050;
  horizon = mix(horizon, glow, twilight * 0.85 * (1 - cover * 0.6));
  top = mix(top, 0x3a3f80, twilight * 0.4);
  // cloud greys it all over
  const grey = mix(0x1c1e26, 0x8a909c, daylight);
  return { top: mix(top, grey, cover * 0.7), horizon: mix(horizon, mix(grey, 0xb8bcc4, daylight * 0.5), cover * 0.6) };
}

export const css = (c: number) => `#${c.toString(16).padStart(6, '0')}`;
