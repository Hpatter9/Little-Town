// The scenes an event's story card can show (the owner's ask: "the images need to relate to what's on the card"). Each
// choice event names its own (`scene` on its EventDef, in the event files) so the match is explicit; the renderer plays
// it (renderer/panel/eventScenes.ts). Data only: the simulation never reads it.

export const EVENT_SCENE_IDS = [
  // the town's own business
  'council', 'trial', 'revolt', 'quarrel', 'home', 'leaving', 'children', 'workshop', 'study', 'machine', 'market',
  // at the gate and on the road
  'gate', 'refugees', 'envoy', 'caravan', 'shady', 'road',
  // danger
  'raid_warning', 'battle', 'beast', 'dragon', 'fire', 'storm', 'quake', 'winter', 'drought', 'famine', 'plague', 'calamity',
  // the land and its work
  'harvest', 'farm', 'well', 'mine', 'sea', 'wilds',
  // life and death
  'wedding', 'birth', 'deathbed', 'funeral', 'feast', 'tavern', 'festival',
  // faith and the strange
  'miracle', 'cult', 'ghost', 'omen', 'magic',
] as const;
export type EventSceneId = (typeof EVENT_SCENE_IDS)[number];
