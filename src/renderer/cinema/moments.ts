// The town's big moments (the owner's ask: cinematic moments): which of the journal's milestones are shown as a title
// card with the screen letterboxed (cinema/cinema.ts). The camera is never moved for one (the owner's call: it jumping
// about was disliked); the card has "Show me" to go and look. Pure, so it is tested.

export interface Moment {
  /** The card's big line and its small one. */
  title: string;
  sub: string;
  /** What "Show me" goes to: a townsperson by name, or nothing. */
  who?: string;
  /** How it feels: the card's colour. */
  mood: 'grand' | 'joy' | 'grief' | 'dread';
}

export function momentOf(text: string): Moment | null {
  let m: RegExpExecArray | null;
  if ((m = /^A new age begins: the (.+?) era/.exec(text))) return { title: 'A New Age', sub: `The ${m[1]} era dawns`, mood: 'grand' };
  if ((m = /^(.+?), who founded the town, has died (.+?)\. (.+?) takes up the leadership/.exec(text))) return { title: 'The Founder Is Dead', sub: `${m[1]} has died ${m[2]}. ${m[3]} leads now.`, who: m[3], mood: 'grief' };
  if ((m = /^(.+?) and (.+?) were married/.exec(text))) return { title: 'A Wedding', sub: `${m[1]} and ${m[2]}`, who: m[1], mood: 'joy' };
  if ((m = /^(.+?) and (.+?) welcomed a child, (.+?)\./.exec(text))) return { title: 'A Child Is Born', sub: `${m[3]}, child of ${m[1]} and ${m[2]}`, who: m[1], mood: 'joy' };
  if ((m = /^A shadow passes over the land, vast and high: (.+?) has come/.exec(text))) return { title: 'The Dragon Comes', sub: `${m[1]} has come`, mood: 'dread' };
  if (/has risen from the ashes|rises from the ashes/.test(text)) return { title: 'Reborn', sub: text.split(':').pop()!.trim(), mood: 'grand' };
  return null;
}
