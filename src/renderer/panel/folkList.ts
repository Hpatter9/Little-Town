// Who the People tab lists: everyone but the founder, who has their own tab (founderPanel.ts). The town's counts (the
// head's "People", the overview, housing) still count the founder: they come from the sim, not from this list. Pure, so
// the tests can call it.

import type { PersonView, Snapshot } from '../../shared/sim/snapshot';

export const listedFolk = (s: Pick<Snapshot, 'people' | 'mainId'>): PersonView[] => s.people.filter((p) => p.id !== s.mainId);
