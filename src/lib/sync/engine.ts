import type { ShoppingItem } from "../domain/types";

/** Code de foyer : 24 caractères aléatoires (impossible à deviner). */
export function newHouseholdCode(random: (n: number) => Uint8Array): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return [...random(24)].map((b) => alphabet[b % alphabet.length]).join("");
}

export function isHouseholdCode(code: string | null | undefined): code is string {
  return !!code && /^[a-z0-9]{20,64}$/.test(code);
}

/** Articles modifiés sur ce téléphone depuis le dernier envoi. */
export function itemsToPush(items: readonly ShoppingItem[], pushedUpTo: number): ShoppingItem[] {
  return items.filter((i) => i.updatedAt > pushedUpTo);
}

/**
 * Fusionne ce qui vient du serveur : article par article, le plus récent gagne.
 * Renvoie la nouvelle liste et les articles à enregistrer localement (null si rien ne change).
 */
export function mergeRemote(
  local: readonly ShoppingItem[],
  remote: readonly ShoppingItem[],
): { items: ShoppingItem[]; changed: ShoppingItem[] } | null {
  const byId = new Map(local.map((i) => [i.id, i]));
  const changed: ShoppingItem[] = [];
  for (const r of remote) {
    if (!r || typeof r.id !== "string" || typeof r.updatedAt !== "number") continue;
    const l = byId.get(r.id);
    if (!l || r.updatedAt > l.updatedAt) {
      // Les deux téléphones partagent la même liste.
      const item = { ...r, listId: l?.listId ?? r.listId };
      byId.set(r.id, item);
      changed.push(item);
    }
  }
  if (changed.length === 0) return null;
  const known = new Set(local.map((i) => i.id));
  return {
    items: [...local.map((i) => byId.get(i.id)!), ...changed.filter((c) => !known.has(c.id))],
    changed,
  };
}
