import type { InventoryItem } from "../domain/types";
import { convert } from "../domain/units";
import type { SyncDoc } from "./docs";

/**
 * Frigo partagé : un document par produit (id = ingrédient, ou « custom:<clé> »).
 * Synchronisation produit par produit : le plus récent gagne, une suppression est un document
 * avec `deletedAt` (pour qu'elle ne soit pas « ressuscitée » par l'autre téléphone).
 */
export const FRIDGE_KIND = "frigo";

export interface StockDoc extends SyncDoc {
  /** null quand le produit a été retiré. */
  item: InventoryItem | null;
  deletedAt: number | null;
  updatedBy?: string;
}

const keyOf = (i: Pick<InventoryItem, "ingredientId">) => i.ingredientId;

export function stockDoc(item: InventoryItem, by?: string): StockDoc {
  return { id: keyOf(item), updatedAt: item.updatedAt, deletedAt: null, item, ...(by ? { updatedBy: by } : {}) };
}

export function removedDoc(ingredientId: string, at: number, by?: string): StockDoc {
  return { id: ingredientId, updatedAt: at, deletedAt: at, item: null, ...(by ? { updatedBy: by } : {}) };
}

function isValidDoc(d: unknown): d is StockDoc {
  if (!d || typeof d !== "object") return false;
  const x = d as StockDoc;
  if (typeof x.id !== "string" || typeof x.updatedAt !== "number") return false;
  if (x.deletedAt) return true;
  return !!x.item && typeof x.item.ingredientId === "string" && x.item.ingredientId === x.id;
}

/**
 * Date de modification qui passe toujours après la version précédente du produit,
 * même si l'horloge du téléphone retarde un peu.
 */
export function nextStamp(now: number, previous?: number): number {
  return previous !== undefined && now <= previous ? previous + 1 : now;
}

/**
 * Changements locaux à envoyer : produits ajoutés / modifiés (comparaison par référence)
 * et produits retirés. Les dates sont corrigées pour passer après la version précédente.
 */
export function localChanges(
  prev: readonly InventoryItem[],
  next: readonly InventoryItem[],
  now: number,
  by?: string,
): { inventory: InventoryItem[]; docs: StockDoc[] } {
  const before = new Map(prev.map((i) => [keyOf(i), i]));
  const docs: StockDoc[] = [];
  const inventory = next.map((i) => {
    const old = before.get(keyOf(i));
    if (old === i) return i;
    // Produit (re)mis dans le frigo (ex. « Annuler » après « J'ai cuisiné ») : il doit passer après
    // sa suppression éventuelle, datée au plus max(maintenant, ancienne date + 1) (voir nextStamp).
    // Sinon, si l'horloge de l'autre téléphone avance ou si tout se passe dans la même milliseconde,
    // la suppression gagne à la synchronisation et le produit disparaît de nouveau.
    const floor = old ? old.updatedAt + 1 : Math.max(now, i.updatedAt + 1) + 1;
    const fixed = i.updatedAt < floor ? { ...i, updatedAt: floor } : i;
    docs.push(stockDoc(fixed, by));
    return fixed;
  });
  const nextKeys = new Set(next.map(keyOf));
  for (const old of prev) {
    if (!nextKeys.has(keyOf(old))) docs.push(removedDoc(keyOf(old), nextStamp(now, old.updatedAt), by));
  }
  return { inventory, docs };
}

function sameQuantity(a: InventoryItem, b: InventoryItem): boolean | null {
  if (a.quantity === null || b.quantity === null) return null; // l'un des deux ne sait pas
  if (!a.unit || !b.unit) return a.unit === b.unit && a.quantity === b.quantity;
  const v = convert({ value: b.quantity, unit: b.unit }, a.unit);
  return v !== null && Math.abs(v - a.quantity) < 1e-6;
}

/**
 * Premier partage du frigo : on garde tout.
 * - produit seulement sur ce téléphone : envoyé au foyer ;
 * - produit seulement dans le foyer : ajouté ici ;
 * - produit des deux côtés : une seule ligne ; si les quantités se contredisent, « Quantité à vérifier ».
 */
export function firstMerge(
  local: readonly InventoryItem[],
  remoteDocs: readonly StockDoc[],
  now: number,
  newId: () => string,
): { inventory: InventoryItem[]; toPush: StockDoc[]; conflicts: number } {
  const remote = new Map<string, StockDoc>();
  for (const d of remoteDocs) if (isValidDoc(d)) remote.set(d.id, d);
  const inventory: InventoryItem[] = [];
  const toPush: StockDoc[] = [];
  let conflicts = 0;
  const seen = new Set<string>();

  for (const l of local) {
    const k = keyOf(l);
    seen.add(k);
    const r = remote.get(k);
    if (!r || !r.item) {
      // Absent du foyer (ou retiré là-bas avant le partage) : on conserve ce qui est saisi ici.
      const kept = { ...l, updatedAt: nextStamp(now, r?.updatedAt) };
      inventory.push(kept);
      toPush.push(stockDoc(kept));
      continue;
    }
    const ri = r.item;
    const same = sameQuantity(ri, l);
    const merged: InventoryItem = {
      ...ri,
      id: l.id,
      priority: l.priority || ri.priority,
      quantity: same === null ? (ri.quantity ?? l.quantity) : ri.quantity,
      unit: same === null ? (ri.quantity !== null ? ri.unit : l.unit) : ri.unit,
      updatedAt: nextStamp(now, Math.max(r.updatedAt, l.updatedAt)),
    };
    if (same === false) {
      conflicts++;
      merged.quantityCheck = [
        { quantity: ri.quantity!, unit: ri.unit },
        { quantity: l.quantity!, unit: l.unit },
      ];
    }
    const unchanged = same === true && merged.priority === ri.priority && !ri.quantityCheck === !merged.quantityCheck;
    if (unchanged) {
      inventory.push({ ...ri, id: l.id });
    } else {
      inventory.push(merged);
      toPush.push(stockDoc(merged));
    }
  }
  for (const r of remote.values()) {
    if (seen.has(r.id) || !r.item || r.deletedAt) continue;
    inventory.push({ ...r.item, id: newId() });
  }
  return { inventory, toPush, conflicts };
}

/**
 * Applique ce qui vient du foyer. Un produit modifié ici et pas encore envoyé (outbox)
 * garde la version locale si elle est plus récente. Renvoie null si rien ne change.
 */
export function applyRemote(
  local: readonly InventoryItem[],
  remoteDocs: readonly StockDoc[],
  outbox: ReadonlyMap<string, StockDoc>,
  newId: () => string,
): InventoryItem[] | null {
  const byKey = new Map(local.map((i) => [keyOf(i), i]));
  let changed = false;
  for (const r of remoteDocs) {
    if (!isValidDoc(r)) continue;
    const pending = outbox.get(r.id);
    if (pending && pending.updatedAt >= r.updatedAt) continue;
    const l = byKey.get(r.id);
    if (l && l.updatedAt >= r.updatedAt) continue;
    if (r.deletedAt || !r.item) {
      if (l) {
        byKey.delete(r.id);
        changed = true;
      }
      continue;
    }
    byKey.set(r.id, { ...r.item, id: l?.id ?? newId(), updatedAt: r.updatedAt });
    changed = true;
  }
  if (!changed) return null;
  // Ordre conservé : produits existants d'abord, nouveaux ensuite.
  const out: InventoryItem[] = [];
  const done = new Set<string>();
  for (const l of local) {
    const v = byKey.get(keyOf(l));
    if (v) out.push(v);
    done.add(keyOf(l));
  }
  for (const [k, v] of byKey) if (!done.has(k)) out.push(v);
  return out;
}
