// The desktop app's side of its game thread (main/simThread.ts, shared/simHost.ts): it sends the commands, asks the
// questions (a save, the journal, a new town) and puts the snapshots back together from what changed
// (shared/snapDelta.ts), keeping the whole one for the windows that open later. No Electron here: the thread is made by
// `spawn`, so the tests can run the host in the same thread.

import { SnapAssembler, type SnapDelta } from '../shared/snapDelta';
import type { FromHost, NewTown, ToHost } from '../shared/simHost';
import type { Snapshot } from '../shared/sim/snapshot';
import type { JournalEntryView } from '../shared/sim/snapshot';
import type { Legend } from '../shared/sim/legacy';

export interface SimPort {
  post(m: ToHost): void;
  onMessage(cb: (m: FromHost) => void): void;
  terminate(): void;
}

export interface SimEvents {
  /** A snapshot changed: the delta, and the whole (main's own copy). */
  snapshot(d: SnapDelta, whole: Snapshot): void;
  /** The game's save text, to write (an autosave, or on hiding). */
  save(text: string): void;
  started(fresh: boolean, unreadable: boolean): void;
  booked(ids: string[]): void;
}

export class SimClient {
  private port: SimPort;
  private assembler = new SnapAssembler();
  private nextAsk = 1;
  private asked = new Map<number, (v: unknown) => void>();
  private bookedWait: ((ids: string[]) => void)[] = [];
  private saveWait: ((text: string) => void)[] = [];

  constructor(
    spawn: () => SimPort,
    private readonly on: SimEvents,
  ) {
    this.port = this.connect(spawn);
  }

  private connect(spawn: () => SimPort): SimPort {
    const port = spawn();
    port.onMessage((m) => {
      if (port !== this.port) return; // (an old thread's last words, after a new town)
      switch (m.t) {
        case 'snap': {
          const whole = this.assembler.apply(m.d);
          for (const f of this.firstWait.splice(0)) f(whole);
          this.on.snapshot(m.d, whole);
          return;
        }
        case 'save':
          this.on.save(m.text);
          for (const f of this.saveWait.splice(0)) f(m.text);
          return;
        case 'started':
          return this.on.started(m.fresh, m.unreadable);
        case 'booked':
          this.on.booked(m.ids);
          for (const f of this.bookedWait.splice(0)) f(m.ids);
          return;
        case 'reply':
          this.asked.get(m.id)?.(m.value);
          this.asked.delete(m.id);
          return;
      }
    });
    return port;
  }

  private firstWait: ((s: Snapshot) => void)[] = [];
  /** The whole latest snapshot, or the first once it comes. */
  whole(): Promise<Snapshot> {
    return this.assembler.current ? Promise.resolve(this.assembler.current) : new Promise((res) => this.firstWait.push(res));
  }

  /** The whole latest snapshot (null until the first). */
  get current(): Snapshot | null {
    return this.assembler.current;
  }

  get catchingUp(): boolean {
    return !!this.assembler.current?.catchingUp;
  }

  send(m: ToHost): void {
    this.port.post(m);
  }

  private ask<T>(m: Record<string, unknown> & { t: 'save' | 'journal' | 'newGame' }, timeoutMs = 15_000): Promise<T | null> {
    return new Promise<T | null>((res) => {
      const id = this.nextAsk++;
      const timer = setTimeout(() => {
        this.asked.delete(id);
        res(null);
      }, timeoutMs);
      this.asked.set(id, (v) => {
        clearTimeout(timer);
        res(v as T);
      });
      this.port.post({ ...m, id } as ToHost);
    });
  }

  /** The save text now (null while catching up, or if the thread doesn't answer). */
  saveText = (): Promise<string | null> => this.ask<string | null>({ t: 'save' }, 5_000).then((v) => v ?? null);
  journal = (): Promise<JournalEntryView[]> => this.ask<JournalEntryView[]>({ t: 'journal' }).then((v) => v ?? []);
  /** A new town: the old one's legend and the new save, to write before the thread is started again on it. */
  newTown = (opts: unknown, heir: Legend | undefined): Promise<NewTown | null> => this.ask<NewTown | null>({ t: 'newGame', opts, heir, now: Date.now() });

  /** Out of sight: the game saves (`book`: and books the phone alerts for the time away), and both are waited on. */
  hide(book: boolean, timeoutMs = 10_000): Promise<{ text: string | null; ids: string[] }> {
    const saved = new Promise<string | null>((res) => {
      this.saveWait.push(res);
      setTimeout(() => res(null), Math.min(timeoutMs, 3_000));
    });
    const booked = book
      ? new Promise<string[]>((res) => {
          this.bookedWait.push(res);
          setTimeout(() => res([]), timeoutMs);
        })
      : Promise.resolve([] as string[]);
    this.port.post({ t: 'hidden', on: true, book });
    return Promise.all([saved, booked]).then(([text, ids]) => ({ text, ids }));
  }

  /** Start the game again in a new thread (a new town: the old thread is ended). */
  restart(spawn: () => SimPort): void {
    const old = this.port;
    this.assembler = new SnapAssembler();
    for (const f of this.asked.values()) f(null);
    this.asked.clear();
    this.port = this.connect(spawn);
    old.terminate();
  }

  stop(): void {
    this.port.terminate();
  }
}
