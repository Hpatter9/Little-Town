// The trade empire's lines in the year's chronicle (sim/annals.ts): posts founded and lost, the takings, caravans lost,
// tribute paid. Reads `s.empire` only (nothing imported but types), so annals.ts can ask without pulling the empire in.

import type { GameState } from './state';

/** What the empire did since the last chronicle, told in a line or two; the marks are moved on. */
export function empireYearLines(s: GameState): string[] {
  const e = s.empire;
  if (!e) return [];
  const was = e.yearMark ?? { made: 0, sent: 0, lostCaravans: 0, lostWorth: 0, founded: 0, lostPosts: 0, tributePaid: 0 };
  const now = { made: e.made, sent: e.sent, lostCaravans: e.lostCaravans, lostWorth: e.lostWorth, founded: e.founded, lostPosts: e.lostPosts, tributePaid: e.tributePaid };
  e.yearMark = now;
  const founded = now.founded - was.founded;
  const lostPosts = now.lostPosts - was.lostPosts;
  const sent = now.sent - was.sent;
  const lostCaravans = now.lostCaravans - was.lostCaravans;
  const made = now.made - was.made;
  const tribute = now.tributePaid - was.tributePaid;
  const lines: string[] = [];
  if (founded || lostPosts) lines.push(`${founded ? `${founded === 1 ? 'A trading post was' : `${founded} trading posts were`} founded` : ''}${founded && lostPosts ? ', and ' : ''}${lostPosts ? `${lostPosts === 1 ? 'one was' : `${lostPosts} were`} lost` : ''}.`.replace(/^./, (c) => c.toUpperCase()));
  if (sent) lines.push(`Our caravans made ${sent} run${sent === 1 ? '' : 's'}${made > 0 ? ` and ${made} coins` : ''}${lostCaravans ? `; ${lostCaravans === 1 ? 'one' : lostCaravans} never came home (${now.lostWorth - was.lostWorth} coins of goods)` : ''}.`);
  if (tribute > 0) lines.push(`We paid ${tribute} coins to keep raiders from the gate.`);
  return lines;
}
