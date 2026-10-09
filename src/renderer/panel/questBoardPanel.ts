// The quest board (the owner's ask: a quest offered, accepted with a tap, then followed on an Accepted tab with its
// time limit, more about it, a party formed for it, how it's going and a way to watch). Two sections of the Trips menu,
// each its own sub-tab (subtabs.ts): **Quest board** (the offers: a tavern guest's quests and the guild's hunts, with
// Accept and Decline) and **Accepted quests** (each with the time left as a bar, what it is and pays, the party out
// for it (where they are, a bar of the trip, who went, Watch) or Form a party, and below, the quest log). The sim's
// side is sim/questBoard.ts.

import { DUNGEON_BY_ID } from '../../shared/data/dungeons';
import { MAX_EXPEDITIONS } from '../../shared/data/expeditions';
import { HUNT_DAYS, QUARRY_BY_ID } from '../../shared/data/hunts';
import { QUEST_DAYS } from '../../shared/sim/quests';
import { REGION_BY_ID } from '../../shared/data/regions';
import type { Bridge } from '../../shared/ipc';
import type { ExpeditionView, Snapshot } from '../../shared/sim/snapshot';
import { tripLabel, tripShare } from '../fight/progress';
import { button, duration, el } from './dom';
import { expandable, facts, foeLine, groupLine, list, type More } from './details';

type Sort = 'quest' | 'hunt';
/** The time limit, in days, once taken up. */
const QUEST_DAYS_OF: Record<Sort, number> = { quest: QUEST_DAYS, hunt: HUNT_DAYS };

/** One entry of the board, a quest or a hunt alike. */
interface Entry {
  sort: Sort;
  id: number;
  key: string;
  title: string;
  /** The board's corner: what it is. */
  tag: string;
  text: string;
  reward: string;
  /** Where the party goes (the destination id). */
  dest: string;
  where: string;
  hoursLeft: number;
  accepted: boolean;
  acceptedAgo: number | null;
  /** The whole time limit once accepted (hours), for the bar. */
  limit: number;
  details: () => More[];
}

const KIND_NAMES: Record<string, string> = { rescue: 'A rescue', bounty: 'A bounty', relic: 'A relic hunt', gear: "A fallen delver's gear" };

function entries(s: Snapshot): Entry[] {
  const out: Entry[] = [];
  for (const q of s.quests) {
    const dg = DUNGEON_BY_ID[q.dungeon];
    out.push({
      sort: 'quest',
      id: q.id,
      key: `quest:${q.id}`,
      title: q.title,
      tag: KIND_NAMES[q.kind] ?? 'A quest',
      text: q.text,
      reward: q.reward,
      dest: q.dungeon,
      where: q.dungeonName,
      hoursLeft: q.hoursLeft,
      accepted: q.accepted,
      acceptedAgo: q.acceptedAgo,
      limit: QUEST_DAYS_OF.quest * 24,
      details: () => [
        facts([
          ['Asked by', q.from],
          ['The place', dg?.name],
          ['Region', dg ? REGION_BY_ID[dg.region]?.name : null],
          ['Rooms', dg ? `${dg.rooms}, then the boss` : null],
        ]),
        dg ? list('Who may wait at the bottom', dg.bosses.map((g) => groupLine(g))) : null,
        dg ? list('Met on the way down', dg.foes.map((g) => groupLine(g))) : null,
        dg?.description ?? null,
      ],
    });
  }
  for (const h of s.hunts.hunts) {
    const q = QUARRY_BY_ID[h.quarry];
    out.push({
      sort: 'hunt',
      id: h.id,
      key: `hunt:${h.id}`,
      title: `Hunt: ${h.name}`,
      tag: `${'★'.repeat(h.stars)} hunt`,
      text: h.text,
      reward: `${h.purse} coins to the hunters, and ${h.parts} for the guild's forge.`,
      dest: h.dest,
      where: h.name,
      hoursLeft: h.hoursLeft,
      accepted: h.accepted,
      acceptedAgo: h.acceptedAgo,
      limit: QUEST_DAYS_OF.hunt * 24,
      details: () => [q ? list('The quarry', Object.entries(q.foes).map(([k, n]) => foeLine(k, n))) : null, "The Monster Hunters' Guild posted it."],
    });
  }
  return out;
}

const timeLeft = (h: number) => (h >= 48 ? `${Math.round(h / 24)} days` : h >= 1 ? `${h} hours` : 'under an hour');

/** The offers, with Accept and Decline. */
export function questBoard(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const offers = entries(s).filter((e) => !e.accepted);
  const taken = entries(s).filter((e) => e.accepted).length;
  const out: HTMLElement[] = [el('h2', '', 'Quest board')];
  out.push(el('div', 'hint', 'Quests offered at the tavern and hunts posted by the guild. Accept one and its clock starts; the town\'s adventurers take up what is accepted, or you can form a party yourself on the Accepted tab. Left unanswered, the town takes an offer up itself after a while if it has an adventurer to send.'));
  if (!offers.length) out.push(el('div', 'empty', taken ? `Nothing new offered. ${taken} accepted: see the Accepted tab.` : 'Nothing offered just now. Guests at the tavern ask of an evening; the guild posts hunts every day or two.'));
  const grid = el('div', 'cards wide');
  for (const e of offers) {
    const c = el('div', 'card quest offer');
    const top = el('div', 'card-top');
    top.append(el('span', 'card-name', e.title), el('span', 'card-size', e.tag));
    const row = el('div', 'row quest-answer');
    row.append(
      button('Accept', () => bridge?.command({ type: 'quest', op: 'accept', sort: e.sort, id: e.id }), { cls: 'go', title: 'Take it on: the time limit starts' }),
      button('Decline', () => bridge?.command({ type: 'quest', op: 'decline', sort: e.sort, id: e.id }), { title: 'Turn it down' }),
    );
    c.append(top, el('div', 'purpose', e.text), el('div', 'lock short', `Reward: ${e.reward}`), el('div', 'lock short', `Offer open ${timeLeft(e.hoursLeft)} more · then ${QUEST_DAYS_OF[e.sort]} days to do it`), row);
    grid.append(expandable(c, `offer:${e.key}`, e.details));
  }
  if (offers.length) out.push(grid);
  return out;
}

/** The accepted quests: the clock, the details, the party, the progress; then the log. */
export function acceptedQuests(s: Snapshot, bridge: Bridge | undefined): HTMLElement[] {
  const taken = entries(s).filter((e) => e.accepted);
  const out: HTMLElement[] = [el('h2', '', 'Accepted quests')];
  if (!taken.length) out.push(el('div', 'empty', 'No quests accepted. Take one up on the Board.'));
  for (const e of taken) out.push(acceptedCard(e, s, bridge));
  out.push(el('h2', '', 'Quest log'));
  if (!s.questLog.length) out.push(el('div', 'empty', 'Nothing ended yet.'));
  else {
    const ul = el('div', 'quest-log');
    const MARK = { done: '✔', failed: '✘', lapsed: '…', declined: '–' } as const;
    for (const l of s.questLog) {
      const r = el('div', `quest-log-row ${l.end}`);
      r.append(el('span', 'quest-log-mark', MARK[l.end]), el('span', 'quest-log-title', `${l.title}`), el('span', 'quest-log-day', `day ${l.day}`));
      r.title = l.text;
      ul.append(r, el('div', 'quest-log-text', l.text));
    }
    out.push(ul);
  }
  return out;
}

function acceptedCard(e: Entry, s: Snapshot, bridge: Bridge | undefined): HTMLElement {
  const urgent = e.hoursLeft < 24;
  const c = el('div', `card quest accepted${urgent ? ' urgent' : ''}`);
  const top = el('div', 'card-top');
  top.append(el('span', 'card-name', e.title), el('span', 'card-size', e.tag));
  c.append(top);
  // the clock
  const clock = el('div', 'quest-clock');
  const bar = el('div', 'bar');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.max(0, Math.min(100, (e.hoursLeft / Math.max(1, e.limit)) * 100))}%`;
  bar.append(fill);
  clock.append(el('span', 'quest-clock-text', `⏳ ${timeLeft(e.hoursLeft)} left`), bar);
  c.append(clock, el('div', 'purpose', e.text), el('div', 'lock short', `Reward: ${e.reward}`));
  // the trip: how long it takes against the time left
  const v = s.destinations.find((d) => d.id === e.dest);
  if (v) {
    const trip = v.tripSeconds / 3600;
    c.append(el('div', `lock short${trip > e.hoursLeft ? ' warn' : ''}`, `A round trip takes about ${duration(v.tripSeconds)}${trip > e.hoursLeft ? ': a party leaving now may not be back in time' : ''}.`));
  }
  // the party out for it, or a way to form one
  const going = s.expeditions.find((x) => x.dest === e.dest);
  if (going) c.append(partyLine(going, e, bridge));
  else {
    const row = el('div', 'row stakes');
    const blocked = !!s.muster || s.expeditions.length >= MAX_EXPEDITIONS || (v ? !v.unlocked : false);
    row.append(button('Form a party…', () => bridge?.command({ type: 'muster', op: 'raise', dest: e.dest }), { cls: 'place go', disabled: blocked, title: 'Choose who goes, how boldly, and what they take' }));
    c.append(el('div', 'lock short', v?.vetoed ? 'Forbidden on the Places tab: no party of the town\'s own will go.' : "No party out yet: the town's adventurers may take it up, or form one yourself."), row);
  }
  return expandable(c, `taken:${e.key}`, () => [
    facts([
      ['Where', e.where],
      ['Taken up', e.acceptedAgo === null ? null : e.acceptedAgo < 1 ? 'just now' : `${timeLeft(e.acceptedAgo)} ago`],
      ['Time left', timeLeft(e.hoursLeft)],
      ['Bounty posted', v?.bounty ? `${v.bounty} coins` : null],
    ]),
    ...e.details(),
  ]);
}

/** The party out for a quest: where they are, the trip's bar, who went, and Watch. */
function partyLine(x: ExpeditionView, e: Entry, bridge: Bridge | undefined): HTMLElement {
  const box = el('div', 'quest-party');
  const label = x.battle ? `Fighting at ${e.where}!` : tripLabel(x, e.where);
  box.append(el('div', 'quest-party-where', label));
  const bar = el('div', 'bar trip');
  const fill = el('div', 'bar-fill');
  fill.style.width = `${Math.round(tripShare(x) * 100)}%`;
  bar.append(fill);
  box.append(bar, el('div', 'quest-party-who', `${x.leader ? `Led by ${x.leader}: ` : ''}${x.members.map((m) => m.name).join(', ')}${x.recalled ? ' · called home' : ''}`));
  if (x.delve && x.phase === 'work') box.append(el('div', 'lock short', `Room ${x.delve.room} of ${x.delve.rooms} · torches ${x.delve.torches}${x.delve.log.length ? ` · ${x.delve.log[x.delve.log.length - 1]}` : ''}`));
  const row = el('div', 'row stakes');
  row.append(button(x.battle ? 'Watch the fight' : 'Watch them', () => bridge?.command({ type: 'watch', expedition: x.id }), { cls: 'go' }));
  box.append(row);
  return box;
}
