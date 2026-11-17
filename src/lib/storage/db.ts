import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { InventoryItem, ItemHistory, ShoppingItem, ShoppingTrip } from "../domain/types";

/**
 * Stockage local (IndexedDB) : les données restent dans le navigateur, même hors connexion
 * et après fermeture de l'application. Le format des articles est celui des futures tables Supabase.
 */
interface Schema extends DBSchema {
  shopping: { key: string; value: ShoppingItem; indexes: { byList: string; byUpdated: number } };
  trips: { key: string; value: ShoppingTrip };
  history: { key: string; value: ItemHistory };
  inventory: { key: string; value: InventoryItem; indexes: { byIngredient: string } };
  meta: { key: string; value: unknown };
}

export const DB_NAME = "recettes-courses";
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<Schema>> | null = null;

export function getDb(): Promise<IDBPDatabase<Schema>> {
  if (!dbPromise) {
    dbPromise = openDB<Schema>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        const shopping = db.createObjectStore("shopping", { keyPath: "id" });
        shopping.createIndex("byList", "listId");
        shopping.createIndex("byUpdated", "updatedAt");
        db.createObjectStore("trips", { keyPath: "id" });
        db.createObjectStore("history", { keyPath: "key" });
        const inventory = db.createObjectStore("inventory", { keyPath: "id" });
        inventory.createIndex("byIngredient", "ingredientId", { unique: true });
        db.createObjectStore("meta");
      },
    });
  }
  return dbPromise;
}

/** Pour les tests uniquement. */
export function resetDbConnection() {
  dbPromise = null;
}

export async function loadAll() {
  const db = await getDb();
  const [shopping, history, inventory, trips] = await Promise.all([
    db.getAll("shopping"),
    db.getAll("history"),
    db.getAll("inventory"),
    db.getAll("trips"),
  ]);
  return { shopping, history, inventory, trips };
}

export async function putShopping(items: ShoppingItem[]) {
  if (items.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("shopping", "readwrite", { durability: "relaxed" });
  const done = Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
  tx.commit?.();
  await done;
}

export async function putHistory(entries: ItemHistory[]) {
  if (entries.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("history", "readwrite", { durability: "relaxed" });
  const done = Promise.all([...entries.map((h) => tx.store.put(h)), tx.done]);
  tx.commit?.();
  await done;
}

export async function putTrip(trip: ShoppingTrip) {
  const db = await getDb();
  await db.put("trips", trip);
}

export async function putInventory(items: InventoryItem[]) {
  if (items.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("inventory", "readwrite", { durability: "relaxed" });
  const done = Promise.all([...items.map((i) => tx.store.put(i)), tx.done]);
  tx.commit?.();
  await done;
}

export async function deleteInventory(ids: string[]) {
  if (ids.length === 0) return;
  const db = await getDb();
  const tx = db.transaction("inventory", "readwrite", { durability: "relaxed" });
  const done = Promise.all([...ids.map((id) => tx.store.delete(id)), tx.done]);
  tx.commit?.();
  await done;
}

/**
 * Purge des articles supprimés depuis plus de 30 jours (les « pierres tombales » servent
 * à propager les suppressions lors d'une future synchronisation ; inutile de les garder à vie).
 */
export async function purgeTombstones(now: number, maxAgeMs = 30 * 24 * 3600 * 1000) {
  const db = await getDb();
  const tx = db.transaction("shopping", "readwrite");
  let cursor = await tx.store.openCursor();
  while (cursor) {
    const d = cursor.value.deletedAt;
    if (d !== null && now - d > maxAgeMs) await cursor.delete();
    cursor = await cursor.continue();
  }
  await tx.done;
}

export async function getMeta<T>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return (await db.get("meta", key)) as T | undefined;
}

export async function setMeta(key: string, value: unknown) {
  const db = await getDb();
  await db.put("meta", value, key);
}

/** Demande au navigateur de ne pas effacer les données en cas de manque d'espace. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (typeof navigator !== "undefined" && navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch {
    /* navigateur sans support : les données restent stockées normalement */
  }
  return false;
}
