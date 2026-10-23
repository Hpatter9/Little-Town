// A look's colour labels (its roles.json, written by tools/folk-roles.py): fetched once a look, by the map's loader
// (folkLoader.ts) and the menus' portraits (art/folkPortrait.ts) alike, and shared by every tint of it. No Pixi: the
// menus' frame loads it too.

import type { FolkRoles } from './folkTint';

const rolesOf = new Map<string, Promise<FolkRoles | null>>();

/** The labels for a look's folder URL (`iso/folk/settlers/man_base`). Null if it has none (drawn as it is). */
export function loadRoles(base: string): Promise<FolkRoles | null> {
  let p = rolesOf.get(base);
  if (!p) {
    p = fetch(`${base}/roles.json`).then((r) => (r.ok ? (r.json() as Promise<FolkRoles>) : null)).catch(() => null);
    rolesOf.set(base, p);
  }
  return p;
}
