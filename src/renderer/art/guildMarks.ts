// Guild badges (data/guildEmblems.ts): a small round token with the guild's glyph, shown beside a name like the people's
// mark. `guildsOf` finds a person's guilds from the snapshot's guild list (no new data from the sim).

import { GUILD_EMBLEMS } from '../../shared/data/guildEmblems';
import type { GuildRole } from '../../shared/data/guilds';
import type { Snapshot } from '../../shared/sim/snapshot';
import { iconSheet } from './icons';
import { loadImage } from './loadImage';

type GuildOf = { id: number; name: string; role: GuildRole; lead: boolean };

/** The guilds a person belongs to, the oldest first (the first is the one shown by their name). */
export function guildsOf(s: Pick<Snapshot, 'guilds'>, personId: number): GuildOf[] {
  const out: GuildOf[] = [];
  for (const g of s.guilds) {
    const m = g.members.find((x) => x.id === personId);
    if (m) out.push({ id: g.id, name: g.name, role: g.role, lead: m.lead });
  }
  return out;
}

/** A badge for a guild role, `size` CSS px; the glyph is painted when its sheet has loaded. */
export function guildBadge(role: GuildRole, size = 16, title?: string, painted?: () => void): HTMLCanvasElement {
  const e = GUILD_EMBLEMS[role];
  const c = document.createElement('canvas');
  c.className = 'guild-badge';
  const k = Math.max(2, Math.round((window.devicePixelRatio || 1) * 2));
  c.width = c.height = size * k;
  c.style.width = c.style.height = `${size}px`;
  if (title) {
    c.title = title;
    c.setAttribute('aria-label', title);
  }
  const g = c.getContext('2d')!;
  g.setTransform(k, 0, 0, k, 0, 0);
  g.imageSmoothingEnabled = false;
  g.beginPath();
  g.arc(size / 2, size / 2, size / 2 - 0.6, 0, Math.PI * 2);
  g.fillStyle = e.fill;
  g.fill();
  g.lineWidth = Math.max(1, size * 0.08);
  g.strokeStyle = e.rim;
  g.stroke();
  const info = iconSheet(e.glyph[0]);
  void loadImage(info.url).then((im) => {
    const sx = (e.glyph[1] % info.cols) * info.cell;
    const sy = Math.floor(e.glyph[1] / info.cols) * info.cell;
    const d = size * 0.78;
    g.drawImage(im, sx, sy, info.cell, info.cell, (size - d) / 2, (size - d) / 2, d, d);
    painted?.();
  });
  return c;
}

/** The mark by a name: the first guild's badge (a title naming them all), or null for someone in none. */
export function guildMark(s: Pick<Snapshot, 'guilds'>, personId: number): HTMLCanvasElement | null {
  const gs = guildsOf(s, personId);
  if (!gs.length) return null;
  return guildBadge(gs[0].role, 16, gs.map((g) => `${g.name}${g.lead ? ' (leader)' : ''}`).join(', '));
}

/** The badge a fallen person's guild gave them (kept on their record when they fell: sim/annals.ts). */
export function fallenGuildMark(f: { guild?: { role: GuildRole; name: string; lead: boolean } }): HTMLCanvasElement | null {
  return f.guild ? guildBadge(f.guild.role, 16, `${f.guild.name}${f.guild.lead ? ' (leader)' : ''}`) : null;
}

/** The mark by a name, for the living or the dead: the guild they are in, else the one they fell in. */
export function guildMarkOrFallen(s: Pick<Snapshot, 'guilds' | 'annals'>, personId: number): HTMLCanvasElement | null {
  const live = guildMark(s, personId);
  if (live) return live;
  const f = s.annals.fallen.find((q) => q.id === personId);
  return f ? fallenGuildMark(f) : null;
}
