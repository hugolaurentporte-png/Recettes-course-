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

/** Éléments partagés autres que les articles (planning, frigo…) : un identifiant et une date de modification. */
export interface SyncedDoc {
  id: string;
  updatedAt?: number;
}

/** Éléments modifiés sur ce téléphone depuis le dernier envoi. */
export function docsToPush<T extends SyncedDoc>(docs: readonly T[], pushedUpTo: number): T[] {
  return docs.filter((d) => (d.updatedAt ?? 0) > pushedUpTo);
}

/** Fusionne des éléments venus du serveur : élément par élément, le plus récent gagne. Null si rien ne change. */
export function mergeDocs<T extends SyncedDoc>(local: readonly T[], remote: readonly T[]): T[] | null {
  const byId = new Map(local.map((d) => [d.id, d]));
  let changed = false;
  for (const r of remote) {
    if (!r || typeof r.id !== "string" || typeof r.updatedAt !== "number") continue;
    const l = byId.get(r.id);
    if (!l || r.updatedAt > (l.updatedAt ?? 0)) {
      byId.set(r.id, r);
      changed = true;
    }
  }
  return changed ? [...byId.values()] : null;
}

/**
 * Les deux personnes ont touché « Ajouter ce qui manque » avant que leurs téléphones se parlent :
 * chacun a créé sa ligne « Crème ». On ne garde que la première (plus petit identifiant, le même choix
 * sur les deux téléphones) quand l'autre ne fait que répéter les mêmes recettes, sans ajout à la main.
 * Renvoie les articles retirés (à enregistrer et à envoyer).
 */
export function collapseRecipeDuplicates(items: readonly ShoppingItem[], now: number, deviceId: string): ShoppingItem[] {
  const open = items.filter((i) => i.deletedAt === null && !i.checked && i.recipeNeeds.length > 0);
  const byKey = new Map<string, ShoppingItem[]>();
  for (const i of open) byKey.set(i.key, [...(byKey.get(i.key) ?? []), i]);
  const removed: ShoppingItem[] = [];
  for (const group of byKey.values()) {
    if (group.length < 2) continue;
    const [keep, ...others] = [...group].sort((a, b) => (a.id < b.id ? -1 : 1));
    const kept = new Set(keep!.recipeNeeds.map((n) => n.recipeId));
    for (const o of others) {
      if (o.manual !== null || !o.recipeNeeds.every((n) => kept.has(n.recipeId))) continue;
      removed.push({ ...o, deletedAt: now, updatedAt: Math.max(now, o.updatedAt + 1), updatedBy: deviceId });
    }
  }
  return removed;
}
