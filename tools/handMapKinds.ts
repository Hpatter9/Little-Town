// Every hand-made map kind tools/ldtk-maps.ts converts (besides the raid boards, which keep their own converter).
import type { MapKindSpec } from '../src/shared/sim/handMaps';
import { FLOOR_SPEC } from '../src/shared/sim/delveFloors';
import { STORY_SPEC } from '../src/shared/sim/storyPlaces';
import { VALLEY_SPEC } from '../src/shared/sim/startValleys';
import { ROOM_SPEC } from '../src/renderer/interior/handRooms';

export const HAND_MAP_KINDS: readonly MapKindSpec[] = [FLOOR_SPEC, STORY_SPEC, VALLEY_SPEC, ROOM_SPEC];
