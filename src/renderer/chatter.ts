// The small change of the day (crafted, bought, sold, no room in storage...): the phone's feed leaves it to the
// Journal (mobile/feed.ts), so while the feed is showing, the strip still pops these up itself (main.ts) and only these.

export const CHATTER = /no room in storage|^crafted:|^bought |^sold |^made |set out a|put out a|^the town paid|dropped /i;
