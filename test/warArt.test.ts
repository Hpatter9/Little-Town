// The War tab's art tables (src/renderer/art/warSprites.ts, warTerrain.ts): every troop and every land has a look, every
// power's captain a figure, and every realm a colour of its own.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { CELL_CODES, REALMS_MAX } from '../src/shared/data/conquest';
import { FACTION_DEFS } from '../src/shared/data/factions';
import { ALL_TROOPS } from '../src/shared/data/troops';
import { CAPTAIN_LOOK, CAPTAIN_PACK, captainWho, propsOfKind, REALM_COLOURS, TROOP_LOOKS, troopWho } from '../src/renderer/art/warSprites';
import { LAND_LOOK } from '../src/renderer/art/warTerrain';

describe('the War tab art', () => {
  it('gives every troop a look, and a Himeko figure where it is one', () => {
    for (const id of Object.keys(ALL_TROOPS)) {
      const look = TROOP_LOOKS[id];
      assert.ok(look, `${id} has no look`);
      if (look.kind === 'hk') assert.ok(troopWho(id, 0), `${id} draws no figure`);
    }
  });

  it('gives every power a captain', () => {
    const origins = new Set<string>(FACTION_DEFS.map((f) => f.origin ?? f.id));
    for (const o of origins) assert.ok(CAPTAIN_PACK[o] || CAPTAIN_LOOK[o], `${o} has no captain`);
    for (const o of Object.keys(CAPTAIN_LOOK)) assert.ok(captainWho(o, 0), `${o}'s captain draws no figure`);
  });

  it('gives every land a look whose props the atlases hold', () => {
    for (const cell of CELL_CODES) {
      const look = LAND_LOOK[cell];
      assert.ok(look, `${cell} has no look`);
      assert.equal(look.tones.length, 2);
      for (const p of look.props) assert.ok(propsOfKind(p.set, p.kind, !!p.evergreen).length > 0, `${cell}: no ${p.kind} in the ${p.set} set`);
      const weight = look.props.reduce((n, p) => n + p.weight, 0);
      if (look.props.length) assert.ok(Math.abs(weight - 1) < 0.01, `${cell}: the props' weights add to ${weight}`);
    }
  });

  it('has a colour for every realm, each its own', () => {
    assert.ok(REALM_COLOURS.length >= REALMS_MAX);
    assert.equal(new Set(REALM_COLOURS).size, REALM_COLOURS.length);
  });
});
