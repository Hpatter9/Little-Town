import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { hashSeed, Rng } from '../src/shared/rng';
import { parseCommand } from '../src/shared/sim/commands';
import { Sim } from '../src/shared/sim/sim';
import { plainGame } from './helpers';

const SRC = readFileSync('src/shared/sim/commands.ts', 'utf8');
// Every command parseCommand knows, read from its own switch, so a new one is covered without touching this test.
const TYPES = [...SRC.matchAll(/^    case '([A-Za-z]+)':/gm)].map((m) => m[1]);
// Each command's fields, from the Command union, and the string literals each field's type names (its stakes, ops...),
// so the fuzz can build a command that passes every check but one.
const SHAPES = new Map<string, Map<string, string[]>>();
for (const m of SRC.matchAll(/^\s+\| \{ type: '([A-Za-z]+)';? ?(.*?)\s*\}?;?$/gm)) {
  const fields = new Map<string, string[]>();
  for (const part of m[2].split(/;\s*/)) {
    const f = /^(\w+)\??:\s*(.*)$/.exec(part.trim());
    if (f) fields.set(f[1], [...f[2].matchAll(/'([^']*)'/g)].map((l) => l[1]));
  }
  SHAPES.set(m[1], fields);
}
const FIELDS = [...new Set([...SHAPES.values()].flatMap((f) => [...f.keys()]))];
const JUNK: unknown[] = [undefined, null, '', 'nonsense', -1, 0, 1, 99999, 1.5, NaN, true, [], {}, [1], [99999], { x: 1 }];

test('the fuzz reads the commands', () => {
  assert.ok(TYPES.length > 80, `${TYPES.length} command types`);
  assert.ok(FIELDS.includes('dest') && FIELDS.includes('person'));
});

test('a malformed sendDelve is refused (it once froze the town: undefined.startsWith every tick)', () => {
  assert.equal(parseCommand({ type: 'sendDelve', members: [1], stakes: 'risky' }), null);
  assert.equal(parseCommand({ type: 'sendDelve', dest: 5, members: [1], stakes: 'risky' }), null);
  const sim = new Sim(plainGame('fuzz-delve'));
  const c = parseCommand({ type: 'sendDelve', dest: 'nowhere', members: [1], stakes: 'risky' });
  assert.ok(c);
  sim.command(c);
  for (let i = 0; i < 5; i++) sim.step();
});

test('no command, however malformed, crashes the sim: refused, or applied and the town keeps stepping', () => {
  const failed: string[] = [];
  for (const type of TYPES) {
    const tries: Record<string, unknown>[] = [{ type }];
    for (const v of JUNK) tries.push({ type, ...Object.fromEntries(FIELDS.map((f) => [f, v])) });
    for (const f of FIELDS) tries.push({ type, [f]: 'nonsense' }, { type, [f]: 99999 });
    // (the command's own fields, each from its literals or the junk, drawn on a fixed stream: near-valid commands)
    const own = [...(SHAPES.get(type) ?? new Map<string, string[]>()).entries()];
    const rng = new Rng(hashSeed(`fuzz:${type}`));
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rng.next() * xs.length)];
    for (let n = 0; n < 200 && own.length; n++) tries.push({ type, ...Object.fromEntries(own.map(([f, lits]) => [f, lits.length && rng.next() < 0.8 ? pick(lits) : pick(JUNK)])) });
    // (then, from a few that pass, each field in turn made junk or left out, the others kept: one bad field at a time)
    const bases = tries.filter((raw) => parseCommand(raw)).slice(0, 3);
    for (const base of bases) for (const [f] of own) {
      const { [f]: _, ...without } = base;
      tries.push(without);
      for (const v of JUNK) tries.push({ ...base, [f]: v });
    }
    // (one town a command type, every accepted variant applied in turn: a town per variant took minutes)
    const accepted = tries.map((raw) => [raw, parseCommand(raw)] as const).filter(([, c]) => c);
    if (!accepted.length) continue;
    const sim = new Sim(plainGame(`fuzz-${type}`));
    sim.state.autopilot = true;
    for (const [raw, c] of accepted) {
      try {
        sim.command(c!);
        sim.step();
      } catch (e) {
        failed.push(`${JSON.stringify(raw)}: ${(e as Error).message}`);
        break;
      }
    }
  }
  assert.deepEqual(failed, []);
});
