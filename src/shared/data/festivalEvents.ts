// The festivals' own choice events (data/festivals.ts, sim/festivals.ts): they come only in the days of making ready
// and on the day itself, one for each people and a few for any town. Merged into EVENTS; their passages are in
// festivalMore.ts.

import { coin, dflt, gain, item, mod, mood, opt, rep, study, take, teach, bond, calm, type EventDef } from './eventKit';
import { FESTIVAL_EVENT_WEIGHT, festivalFor, wareId } from './festivals';
import type { OriginId } from './origins';
import type { GameState } from '../sim/state';
import { calendar } from '../sim/time';

/** A festival is being made ready, or is today (sim/festivals.ts `festivalSoon`, kept here so the data needn't load
 *  the sim). */
const near = (s: GameState) => {
  const f = s.festival;
  if (!f || (f.phase !== 'prep' && f.phase !== 'day')) return false;
  const c = calendar(s.tick);
  return f.key === `${c.year}:${c.season}`;
};
const ours = (...o: OriginId[]) => (s: GameState) => near(s) && o.includes(s.origin ?? 'settlers');
const W = FESTIVAL_EVENT_WEIGHT;

export const FESTIVAL_EVENTS: readonly EventDef[] = [
  // ---- any town
  {
    id: 'fest_rival_stall', title: 'A stall at the festival', who: true, weight: W,
    text: 'A pedlar from down the road has set up a stall right where the festival is to be held, and won\'t shift. {who} wants to know what to do.',
    when: near,
    options: [
      dflt('Let them stay, and take a cut', coin(20), rep(1)),
      opt('Send them packing', mod('prices', 1.1, 48, 'No rival stalls at the festival'), rep(-2)),
      opt('Ask them to sell our wares too', mod('travellers', 1.3, 48, 'The pedlar cries our festival up the road')),
    ],
  },
  {
    id: 'fest_lost_child', title: 'A child lost in the crowd', weight: W,
    text: 'In the bustle of making ready a visitor\'s little one has wandered off, and their mother is beside herself.',
    when: (s) => near(s) && (s.travellers ?? []).length > 0,
    options: [
      dflt('Everyone stops to search', mod('work', 0.85, 12, 'Searching for the lost child'), rep(3)),
      opt('Send the guards', mod('guard', 0.9, 12, 'The guards are out searching'), rep(2)),
      opt('Ring the bell and wait', mood(-6, 24, 'The lost child was found cold and frightened')),
    ],
  },
  {
    id: 'fest_storm_threat', title: 'Clouds over the festival', weight: W,
    text: 'The sky to the west has gone the colour of a bruise. If it breaks on the festival day, the decorations will be ruined.',
    when: near,
    options: [
      dflt('Put up awnings', take('stores', 0.02), mood(5, 48, 'Dry under the awnings')),
      opt('Hold it anyway, rain or shine', mood(-5, 48, 'A soggy festival'), teach('social', 1, 'all')),
      opt('Pray for clear skies', calm(24), mood(3, 24, 'The sky held')),
    ],
  },
  {
    id: 'fest_old_song', title: 'The old song', who: true, weight: W,
    text: '{who} has found the words to a festival song nobody has sung since the founding. Half the verses are missing.',
    when: near,
    options: [
      dflt('Have them teach it to everyone', teach('social', 1, 'all'), mood(6, 72, 'Singing the old song')),
      opt('Fill in the missing verses', study(300), teach('social', 2)),
      opt('Some songs are best forgotten', coin(10), mood(-4, 24, 'The old song left unsung')),
    ],
  },
  // ---- each people's own
  {
    id: 'fest_settlers_bean', title: 'The bean in the cake', who: true, weight: W,
    text: 'Whoever finds the bean is lucky till next year, and this year {who} has quietly found three. Folk are starting to talk.',
    when: ours('settlers'),
    options: [
      dflt('Laugh it off: luck is luck', mood(6, 48, 'Three beans! What luck'), bond(5)),
      opt('Make them give two back', mood(4, 24, 'Fair shares of luck'), rep(1)),
      opt('Make them the festival\'s lord for the day', teach('social', 2), mod('work', 1.1, 24, 'The Bean Lord\'s orders')),
    ],
  },
  {
    id: 'fest_lich_mourner', title: 'A living mourner', weight: W,
    text: 'A living woman from the next valley has come to the festival of the dead, asking to walk beside her late husband\'s bones one last time.',
    when: ours('lich'),
    options: [
      dflt('Let her walk with him', rep(4), mood(5, 48, 'Even the dead were moved')),
      opt('Charge her for the honour', coin(30), rep(-2)),
      opt('Raise him to walk with her', study(240), rep(-3), mod('research', 1.1, 72, 'A raising before witnesses')),
    ],
  },
  {
    id: 'fest_druid_hawthorn', title: 'The hawthorn will not bloom', weight: W,
    text: 'The old hawthorn at the grove\'s heart has not put out a single flower, and the festival is days away.',
    when: ours('druid'),
    options: [
      dflt('Sing to it all night', mod('work', 0.85, 24, 'Up all night singing to the hawthorn'), mod('crops', 1.1, 120, 'The hawthorn bloomed at last')),
      opt('Hang the garlands from another tree', mood(-4, 48, 'The hawthorn bare at the festival'), mod('forage', 1.05, 48, 'Garlands gathered from the whole wood')),
      opt('Feed it from the stores', take('stores', 0.04), gain({ herbs: 8 })),
    ],
  },
  {
    id: 'fest_vampire_guest', title: 'An uninvited guest', weight: W,
    text: 'A masked stranger has arrived for the festival bearing a gift wrapped in black silk, and will give no name. The Court is intrigued.',
    when: ours('vampire'),
    options: [
      dflt('Welcome them in', item(wareIdOf('vampire', 'summer')), rep(3), mod('prices', 1.1, 72, 'The masked guest\'s friends come to trade')),
      opt('Unmask them', chanceCoin(), rep(-2)),
      opt('Turn them away at the door', mod('guard', 1.1, 72, 'The Court is on its guard')),
    ],
  },
  {
    id: 'fest_wolf_challenge', title: 'A challenge at the fire', who: true, weight: W,
    text: 'Young {who} has challenged the pack\'s best to wrestle at the festival fire. Everyone wants to see it. Nobody thinks they can win.',
    when: ours('werewolf'),
    options: [
      dflt('Let them fight', teach('melee', 2), mood(5, 48, 'What a bout at the fire')),
      opt('Make it a race instead', teach('construction', 1), mood(3, 24, 'A race round the fire')),
      opt('Forbid it: not at a festival', mood(-5, 24, 'The challenge refused'), bond(-5)),
    ],
  },
  {
    id: 'fest_robot_glitch', title: 'A unit out of step', who: true, weight: W,
    text: 'In the festival rehearsal {who} keeps doing the dance a beat behind. The others are struggling not to correct them.',
    when: ours('robot'),
    options: [
      dflt('Recalibrate them', mod('work', 1.08, 72, 'Every unit in step'), study(120)),
      opt('Let everyone dance a beat behind', mood(6, 48, 'The new dance caught on'), teach('social', 1, 'all')),
      opt('Strip them for parts', gain({ stone: 6 }), mood(-6, 72, 'A unit stripped at festival time')),
    ],
  },
  {
    id: 'fest_dwarf_rune', title: 'The festival rune', who: true, weight: W,
    text: '{who} swears a rune has appeared overnight on the hall\'s great stone: the old rune for "deeper". The elders argue about whether it is a blessing.',
    when: ours('dwarves'),
    options: [
      dflt('Dig where it points', gain({ stone: 10, iron_ore: 4 }), mod('work', 0.9, 24, 'Digging where the rune pointed')),
      opt('Carve it on every door', teach('crafting', 1, 'all'), take('stores', 0.02)),
      opt('Chisel it off', mood(-5, 48, 'The rune chiselled off'), coin(15)),
    ],
  },
  {
    id: 'fest_mer_whale', title: 'A whale at the festival', weight: W,
    text: 'A great old whale has come into the bay as if it had heard the singing, and is lying there, listening.',
    when: ours('merfolk'),
    options: [
      dflt('Sing to it', mood(8, 72, 'The whale sang back'), rep(2)),
      opt('Ride out on its back', teach('gathering', 2, 'random'), mod('forage', 1.15, 72, 'The whale drove the shoals in')),
      opt('Hunt it', gain({ meat: 30, bone: 10 }), mood(-8, 120, 'We killed the whale that came to listen')),
    ],
  },
  {
    id: 'fest_nomad_horse', title: 'The wild stallion', weight: W,
    text: 'A wild stallion has been running alongside the camp all week, as if it wants to join the festival race.',
    when: ours('nomads'),
    options: [
      dflt('Break it for the race', { horse: 1 }, teach('melee', 1, 'random')),
      opt('Leave it to the wild', mood(5, 48, 'The stallion ran free beside us'), mod('travellers', 1.15, 48, 'Talk of the free stallion')),
      opt('Let it run in the race riderless', rep(3), mood(4, 24, 'The riderless horse won')),
    ],
  },
  {
    id: 'fest_fae_mortal', title: 'A mortal in the ring', weight: W,
    text: 'A mortal shepherd has stumbled into the Court\'s ring while it was being laid, and is dancing, and cannot stop.',
    when: ours('fae'),
    options: [
      dflt('Let them dance till the festival', { join: 1 }, mood(4, 48, 'The shepherd dances still')),
      opt('Release them with a gift', item(wareIdOf('fae', 'summer')), rep(4)),
      opt('Keep them dancing a hundred years', mod('travellers', 0.8, 72, 'Mortals fear the glade'), study(200)),
    ],
  },
  {
    id: 'fest_alchemist_vat', title: 'The festival vat bubbles over', who: true, weight: W,
    text: '{who} has brewed the festival\'s great tincture in a vat that is now bubbling, glowing and, very faintly, humming a tune.',
    when: ours('alchemists'),
    options: [
      dflt('Bottle it and sell it', coin(40), rep(-1)),
      opt('Study it', study(360), teach('research', 1)),
      opt('Pour it in the river', mood(-3, 24, 'The river glowed for a week'), mod('crops', 1.1, 120, 'The river water made the fields grow')),
    ],
  },
  {
    id: 'fest_knight_herald', title: 'The visiting herald', weight: W,
    text: 'A herald of a distant order has ridden in for the festival, demanding that their champion be allowed to joust against ours.',
    when: ours('knights'),
    options: [
      dflt('Accept the challenge', teach('melee', 1, 'all'), mood(6, 48, 'A grand joust')),
      opt('Ask them to bring gold, not lances', coin(30), rep(1)),
      opt('Refuse: our festival, our champions', mod('fight', 1.08, 72, 'Our champions\' pride'), rep(-2)),
    ],
  },
  {
    id: 'fest_orc_brawl', title: 'Too much too early', who: true, weight: W,
    text: '{who} has started on the festival grog two days early and is now challenging the war totem to a fight.',
    when: ours('orcs'),
    options: [
      dflt('Let the totem win', mood(6, 48, 'The totem won, again'), teach('melee', 1)),
      opt('Throw them in the river', mod('work', 1.05, 24, 'Everyone sobered up'), bond(-5)),
      opt('Join in', take('stores', 0.03), mood(8, 24, 'A brawl to remember'), mod('work', 0.85, 24, 'Sore heads')),
    ],
  },
];

/** A people's ware for a season (an item an event may give). */
function wareIdOf(o: OriginId, season: 'spring' | 'summer' | 'autumn' | 'winter'): string {
  return wareId(festivalFor(o, season));
}
/** Unmasked: a purse, sometimes. */
function chanceCoin() {
  return { chance: 0.5, then: [coin(40)], else: [mood(-5, 48, 'The unmasked guest was nobody, and furious')] };
}
