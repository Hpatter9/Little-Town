// What the panels may show: content behind undiscovered hidden research stays out of sight.

import { TOPIC_BY_ID } from '../../shared/data/research';
import type { Snapshot } from '../../shared/sim/snapshot';

/** A topic is known unless it's hidden and not yet discovered (the debug unlock shows everything). */
export const topicKnown = (s: Snapshot, id: string) => s.unlockAll || !TOPIC_BY_ID[id]?.hidden || s.research.revealed.includes(id);
