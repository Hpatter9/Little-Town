// Snapshots sent from the phone's sim worker to the page as what changed since the last one (the owner's ask: the
// phone smoother). A whole snapshot is about a megabyte, nearly all of it the land's pools, and copying it between
// threads ten times a second cost more than the sim itself; what changes in a tick is a few tens of kilobytes.
// The worker side (`SnapDiffer`) keeps what it last sent; the page side (`SnapAssembler`) keeps the snapshot it built
// and lays each delta over it, so a part that didn't change keeps the very same object (the renderer may compare
// them by reference). Pure: no DOM, no worker, so the tests run it.

import type { LandMap } from './sim/land';
import type { Snapshot } from './sim/snapshot';

/** How often the land's pools are looked over for changes, in deltas, when the land's version hasn't moved (a pool
 *  drawn down by gathering doesn't move it; only the tap card's "N left" reads the amounts). */
export const POOLS_EVERY = 10;

type Pools = LandMap['pools'];
type Pool = Pools[number];

export interface LandDelta {
  /** The land's fields that changed, but its pools. */
  fields?: Partial<Omit<LandMap, 'pools'>>;
  /** Every pool, at the first delta. */
  allPools?: Pools;
  /** The pools that changed: [cell, pool] (null: gone). */
  pools?: [number, Pool | null][];
}

/** A list of things with ids (the people, the buildings...) told thing by thing, and each thing by the fields that
 *  changed: someone walking changes their x and y, not their skills, kit and story (a person's view is 8 KB). */
export interface ListDelta {
  /** The ids in order, when the list's make-up or order changed. */
  order?: number[];
  /** Each changed thing's changed fields (a thing new to the list has them all). */
  put: Record<number, Record<string, unknown>>;
  /** Fields a thing no longer has. */
  drop?: Record<number, string[]>;
}

/** The snapshot's lists sent thing by thing. */
export const LISTS: readonly string[] = ['people', 'buildings', 'travellers', 'roamers', 'raiders', 'places', 'destinations', 'expeditions'];

export interface SnapDelta {
  /** The snapshot's parts that changed. */
  set: Partial<Snapshot>;
  /** Lists that changed, thing by thing (`LISTS`). */
  lists?: Record<string, ListDelta>;
  /** Parts that were there and aren't any more. */
  gone: string[];
  land?: LandDelta;
}

/** A pool's mark: the sum of its amounts, weighted by place (a pool drawn down changes it). */
function poolMark(p: Pool): number {
  let sum = 0;
  let k = 1;
  for (const key in p) sum += ((p as Record<string, number>)[key] ?? 0) * k++;
  return sum;
}

/** The worker's side: what's been sent, and the delta from it to a new snapshot. */
export class SnapDiffer {
  private sent = new Map<string, string>();
  private sentPrim = new Map<string, unknown>();
  /** For each list sent thing by thing: its ids in order, and each thing's fields as last sent (JSON). */
  private listSent = new Map<string, { order: string; things: Map<number, Map<string, string>> }>();
  private landSent = new Map<string, unknown>();
  private poolRefs = new Map<number, Pool>();
  private poolMarks = new Map<number, number>();
  private landVersion = -1;
  private count = 0;
  private landRef: LandMap | null = null;

  diff(snap: Snapshot): SnapDelta {
    this.count++;
    const set: Record<string, unknown> = {};
    const seen = new Set<string>();
    let lists: Record<string, ListDelta> | undefined;
    const s = snap as unknown as Record<string, unknown>;
    for (const key in s) {
      if (key === 'land') continue;
      seen.add(key);
      const v = s[key];
      if (v === undefined) continue;
      if (typeof v !== 'object' || v === null) {
        if (!this.sentPrim.has(key) || this.sentPrim.get(key) !== v) set[key] = v;
        this.sentPrim.set(key, v);
        this.sent.delete(key);
        continue;
      }
      if (Array.isArray(v) && LISTS.includes(key) && v.every((t) => t && typeof t === 'object' && typeof (t as { id?: unknown }).id === 'number')) {
        const ld = this.listDelta(key, v as Record<string, unknown>[]);
        if (ld) (lists ??= {})[key] = ld;
        this.sent.delete(key);
        this.sentPrim.delete(key);
        continue;
      }
      this.listSent.delete(key);
      // (the views are made afresh or are the state's own, changed in place: so each is compared by its contents)
      const j = JSON.stringify(v);
      if (this.sent.get(key) !== j) set[key] = v;
      this.sent.set(key, j);
      this.sentPrim.delete(key);
    }
    const gone: string[] = [];
    for (const key of [...this.sent.keys(), ...this.sentPrim.keys(), ...this.listSent.keys()])
      if (!seen.has(key) || s[key] === undefined) {
        gone.push(key);
        this.sent.delete(key);
        this.sentPrim.delete(key);
        this.listSent.delete(key);
      }
    const out: SnapDelta = { set: set as Partial<Snapshot>, gone };
    if (lists) out.lists = lists;
    const land = this.landDelta(snap.land);
    if (land) out.land = land;
    return out;
  }

  private listDelta(key: string, list: Record<string, unknown>[]): ListDelta | undefined {
    let last = this.listSent.get(key);
    const first = !last;
    if (!last) this.listSent.set(key, (last = { order: '', things: new Map() }));
    const ids = list.map((t) => t.id as number);
    const order = ids.join(',');
    const d: ListDelta = { put: {} };
    let any = first;
    if (order !== last.order) {
      d.order = ids;
      last.order = order;
      any = true;
    }
    const here = new Set(ids);
    for (const id of [...last.things.keys()]) if (!here.has(id)) last.things.delete(id);
    for (const t of list) {
      const id = t.id as number;
      let fields = last.things.get(id);
      if (!fields) last.things.set(id, (fields = new Map()));
      let put: Record<string, unknown> | null = null;
      for (const f in t) {
        const v = t[f];
        if (v === undefined) continue;
        const mark = typeof v === 'object' && v !== null ? JSON.stringify(v) : typeof v === 'string' ? `s${v}` : String(v);
        if (fields.get(f) !== mark) {
          (put ??= {})[f] = v;
          fields.set(f, mark);
        }
      }
      for (const f of [...fields.keys()])
        if (t[f] === undefined) {
          fields.delete(f);
          ((d.drop ??= {})[id] ??= []).push(f);
          any = true;
        }
      if (put) {
        d.put[id] = put;
        any = true;
      }
    }
    return any ? d : undefined;
  }

  private landDelta(m: LandMap): LandDelta | undefined {
    if (!m) return undefined;
    const fresh = this.landRef !== m;
    this.landRef = m;
    const d: LandDelta = {};
    const fields: Record<string, unknown> = {};
    let any = false;
    for (const key in m) {
      if (key === 'pools') continue;
      const v = (m as unknown as Record<string, unknown>)[key];
      const mark = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
      if (fresh || !this.landSent.has(key) || this.landSent.get(key) !== mark) {
        fields[key] = v;
        any = true;
      }
      this.landSent.set(key, mark);
    }
    for (const key of [...this.landSent.keys()])
      if (!(key in m)) {
        fields[key] = undefined;
        this.landSent.delete(key);
        any = true;
      }
    if (any) d.fields = fields as LandDelta['fields'];
    if (fresh) {
      d.allPools = m.pools;
      this.poolRefs.clear();
      this.poolMarks.clear();
      for (const k in m.pools) {
        const i = Number(k);
        this.poolRefs.set(i, m.pools[i]);
        this.poolMarks.set(i, poolMark(m.pools[i]));
      }
      this.landVersion = m.version ?? 0;
    } else if ((m.version ?? 0) !== this.landVersion || this.count % POOLS_EVERY === 0) {
      this.landVersion = m.version ?? 0;
      const changes: [number, Pool | null][] = [];
      const here = new Set<number>();
      for (const k in m.pools) {
        const i = Number(k);
        here.add(i);
        const p = m.pools[i];
        const mark = poolMark(p);
        if (this.poolRefs.get(i) !== p || this.poolMarks.get(i) !== mark) {
          changes.push([i, p]);
          this.poolRefs.set(i, p);
          this.poolMarks.set(i, mark);
        }
      }
      for (const i of this.poolRefs.keys())
        if (!here.has(i)) {
          changes.push([i, null]);
          this.poolRefs.delete(i);
          this.poolMarks.delete(i);
        }
      if (changes.length) d.pools = changes;
    }
    return d.fields || d.allPools || d.pools ? d : undefined;
  }
}

/** The page's side: the snapshot so far, and each delta laid over it. */
export class SnapAssembler {
  private snap: Snapshot | null = null;
  private land: LandMap | null = null;

  get current(): Snapshot | null {
    return this.snap;
  }

  apply(d: SnapDelta): Snapshot {
    const next = { ...(this.snap ?? {}), ...d.set } as Record<string, unknown>;
    for (const key of d.gone) delete next[key];
    if (d.lists)
      for (const [key, ld] of Object.entries(d.lists)) {
        const before = (this.snap as unknown as Record<string, Record<string, unknown>[] | undefined> | null)?.[key];
        const byId = new Map<number, Record<string, unknown>>();
        if (Array.isArray(before)) for (const t of before) byId.set(t.id as number, t);
        const ids = ld.order ?? (Array.isArray(before) ? before.map((t) => t.id as number) : []);
        next[key] = ids.map((id) => {
          const put = ld.put[id];
          const drop = ld.drop?.[id];
          const old = byId.get(id);
          if (!put && !drop && old) return old;
          const t = { ...(old ?? {}), ...(put ?? {}) };
          if (drop) for (const f of drop) delete t[f];
          return t;
        });
      }
    if (d.land) {
      if (d.land.allPools) this.land = { ...(d.land.fields as LandMap), pools: d.land.allPools };
      else if (this.land) {
        if (d.land.fields)
          for (const [k, v] of Object.entries(d.land.fields)) {
            if (v === undefined) delete (this.land as unknown as Record<string, unknown>)[k];
            else (this.land as unknown as Record<string, unknown>)[k] = v;
          }
        if (d.land.pools)
          for (const [i, p] of d.land.pools) {
            if (p) this.land.pools[i] = p;
            else delete this.land.pools[i];
          }
      }
    }
    if (this.land) next.land = this.land;
    this.snap = next as unknown as Snapshot;
    return this.snap;
  }
}
