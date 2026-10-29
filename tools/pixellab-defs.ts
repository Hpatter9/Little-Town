// Writes out/pixellab-defs.json for tools/pixellab/batch_nov.py: every settlers building the grid draws with a borrowed
// picture (made smaller, `AWAITING_ART`; with a yard round it; or another building's that fits), with its name, footprint, purpose and the piece it
// borrows. A dev tool: `node tools/pixellab-defs.mjs`.
import { mkdirSync, writeFileSync } from 'node:fs';
import { BUILDING_BY_ID } from '../src/shared/data/buildings';
import { isUnlocked } from '../src/shared/sim/buildings';
import { AWAITING_ART, settlerGridPlans } from '../src/renderer/iso/gridRules';
import { roleOf } from '../src/renderer/iso/isoKits';

const settlers = (id: string) => isUnlocked({ unlockAll: true, done: [], origin: 'settlers', relief: true }, BUILDING_BY_ID[id]);
const out: Record<string, unknown>[] = [];
for (const p of settlerGridPlans(settlers)) {
  if (!p.plan || (p.own && p.plan.shrink >= 1)) continue;
  const d = BUILDING_BY_ID[p.defId];
  const role = roleOf(p.defId);
  const yard = p.plan.shrink >= 1 && (p.plan.sub.w < p.foot.w || p.plan.sub.h < p.foot.h);
  out.push({
    id: p.defId, name: d.name, foot: [p.foot.w, p.foot.h], role: 'role' in role ? role.role : 'field', borrows: p.plan.piece,
    kind: AWAITING_ART.includes(p.defId) ? 'awaiting' : yard ? 'yard' : 'borrowed', order: AWAITING_ART.indexOf(p.defId), research: d.research ?? null, purpose: d.purpose,
  });
}
mkdirSync('out', { recursive: true });
writeFileSync('out/pixellab-defs.json', JSON.stringify(out, null, 1));
const n = (k: string) => out.filter((o) => o.kind === k).length;
console.log(`${n('awaiting')} awaiting art, ${n('yard')} with a yard, ${n('borrowed')} borrowing one that fits: out/pixellab-defs.json`);
