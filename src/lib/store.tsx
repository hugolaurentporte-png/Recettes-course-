"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Aisle, Amount, Equipment, InventoryItem, ItemHistory, Recipe, ShoppingItem, ShoppingTrip, Unit } from "./domain/types";
import {
  addManualItem, addRecipeToList, deleteItem, editItem, finishShopping, recordUsage, toggleChecked,
  type ItemEdit, type RecipeAddSummary, type ShoppingContext,
} from "./domain/shopping";
import { INGREDIENTS, getIngredient } from "./data/ingredients";
import * as db from "./storage/db";
import { activePlan, normalizePlan, patchSlot, prunePlan, servingsByRecipe, setSlot, type Meal, type PlanEntry } from "./domain/plan";
import { RECIPES_BY_ID } from "./data/recipes";
import { consumeRecipe, markHave, restoreStock, stockFromPurchase, undoMarkHave } from "./domain/stock";
import { collapseRecipeDuplicates, docsToPush, isHouseholdCode, itemsToPush, mergeDocs, mergeRemote, newHouseholdCode } from "./sync/engine";
import { pullItems, pushItems } from "./sync/client";
import {
  enterHousehold, isMemberKey, leaveHousehold, listMembers, newMemberKey, pullDocs, pushDocs, type HouseholdMember,
} from "./sync/docs";
import { activeCarnet, dislikedIds, normalizeCarnet, patchEntry, type CarnetEntry, type CarnetPatch } from "./domain/carnet";
import { FRIDGE_KIND, applyRemote, firstMerge, localChanges, type StockDoc } from "./sync/fridge";

/** Planning des repas du foyer (table foyer_docs). */
const PLAN_KIND = "planning";
/** Carnet de recettes du foyer (favorites, « pas pour nous », à refaire, notes). */
const CARNET_KIND = "carnet";

export const ALL_EQUIPMENT: Equipment[] = ["four", "poele", "casserole", "cocotte", "airfryer", "thermomix", "sans-cuisson"];

export interface Settings {
  onboarded: boolean;
  ownedEquipment: Equipment[];
  /** Budget courses mensuel en euros (null = pas de budget). */
  monthlyBudget?: number | null;
}

const DEFAULT_SETTINGS: Settings = { onboarded: false, ownedEquipment: ALL_EQUIPMENT.filter((e) => e !== "thermomix") };

interface State {
  ready: boolean;
  shopping: ShoppingItem[];
  history: ItemHistory[];
  inventory: InventoryItem[];
  settings: Settings;
  plan: PlanEntry[];
  carnet: CarnetEntry[];
  trips: ShoppingTrip[];
  /** Code du foyer si la liste de courses est partagée. */
  household: string | null;
  /** Le frigo est partagé avec le foyer. */
  fridgeShared: boolean;
}

export interface SyncStatus {
  /** Dernière synchronisation réussie (ms). */
  lastSync: number | null;
  /** Dernière tentative en échec (pas de réseau, serveur indisponible). */
  failing: boolean;
  /** Le planning n'a pas pu être partagé (supabase/foyer.sql pas encore installé, ou pas de réseau). */
  planFailing?: boolean;
}

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Enregistre uniquement les articles réellement modifiés (comparaison par référence). */
function changed<T>(prev: readonly T[], next: readonly T[]): T[] {
  const before = new Set(prev);
  return next.filter((x) => !before.has(x));
}

/** Corriger la quantité règle la « Quantité à vérifier ». */
function withoutCheck(item: InventoryItem, patch: object): InventoryItem {
  if (!("quantity" in patch) || !item.quantityCheck) return item;
  const { quantityCheck: _done, ...rest } = item;
  return rest;
}

function useAppState() {
  const [state, setState] = useState<State>({
    ready: false, shopping: [], history: [], inventory: [], settings: DEFAULT_SETTINGS, plan: [], carnet: [], trips: [], household: null, fridgeShared: false,
  });
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ lastSync: null, failing: false });
  const stateRef = useRef(state);
  stateRef.current = state;
  const deviceId = useRef("local");
  /** Actions faites avant la fin du chargement : rejouées ensuite pour ne rien perdre. */
  const pending = useRef<(() => void)[]>([]);
  const whenReady = useCallback(<T,>(fn: () => T): T | undefined => {
    if (stateRef.current.ready) return fn();
    pending.current.push(fn);
    return undefined;
  }, []);
  const [storageError, setStorageError] = useState<string | null>(null);
  const commitInventoryRef = useRef<(next: InventoryItem[], opts?: { remote?: boolean }) => void>(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let id = await db.getMeta<string>("deviceId");
        if (!id) {
          id = uuid();
          await db.setMeta("deviceId", id);
        }
        deviceId.current = id;
        await db.purgeTombstones(Date.now());
        const [data, settings, plan, household, fridgeShared, outbox, carnet] = await Promise.all([
          db.loadAll(), db.getMeta<Settings>("settings"), db.getMeta<PlanEntry[]>("plan"), db.getMeta<string>("household"),
          db.getMeta<boolean>("fridgeShared"), db.getMeta<StockDoc[]>("fridgeOutbox"), db.getMeta<CarnetEntry[]>("carnet"),
        ]);
        fridgeOutbox.current = new Map((outbox ?? []).map((d) => [d.id, d]));
        if (cancelled) return;
        const loaded: State = {
          ready: true,
          shopping: data.shopping,
          history: data.history,
          inventory: data.inventory,
          settings: { ...DEFAULT_SETTINGS, ...settings },
          plan: prunePlan(normalizePlan(plan ?? []), new Date()),
          carnet: normalizeCarnet(carnet),
          trips: data.trips,
          household: isHouseholdCode(household) ? household : null,
          fridgeShared: isHouseholdCode(household) && fridgeShared === true,
        };
        stateRef.current = loaded;
        setState(loaded);
        const queued = pending.current;
        pending.current = [];
        queued.forEach((fn) => fn());
        void db.requestPersistentStorage();
      } catch (e) {
        console.error(e);
        if (!cancelled) {
          setStorageError("Le stockage local est indisponible (navigation privée ?). Vos données ne seront pas conservées.");
          stateRef.current = { ...stateRef.current, ready: true };
          setState(stateRef.current);
          const queued = pending.current;
          pending.current = [];
          queued.forEach((fn) => fn());
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = useCallback((p: Promise<unknown>) => {
    p.catch((e) => {
      console.error(e);
      setStorageError("Impossible d'enregistrer la dernière modification.");
    });
  }, []);

  const ctx = useCallback(
    (): ShoppingContext => ({
      now: Date.now(),
      newId: uuid,
      deviceId: deviceId.current,
      listId: "default",
      catalog: INGREDIENTS,
      getIngredient,
    }),
    [],
  );

  const commitShopping = useCallback(
    (next: ShoppingItem[], history?: ItemHistory[]) => {
      const prev = stateRef.current;
      const toSave = changed(prev.shopping, next);
      const histToSave = history ? changed(prev.history, history) : [];
      const updated = { ...prev, shopping: next, history: history ?? prev.history };
      stateRef.current = updated;
      setState(updated);
      persist(db.putShopping(toSave));
      persist(db.putHistory(histToSave));
      if (toSave.length) scheduleSyncRef.current();
    },
    [persist],
  );

  // ---------- Liste partagée ----------
  const scheduleSyncRef = useRef<() => void>(() => {});
  const syncing = useRef<Promise<void> | null>(null);
  const syncAgain = useRef(false);

  /** Produits du frigo modifiés ici et pas encore envoyés au foyer (un par produit, le dernier état). */
  const fridgeOutbox = useRef<Map<string, StockDoc>>(new Map());
  const saveOutbox = useCallback(() => db.setMeta("fridgeOutbox", [...fridgeOutbox.current.values()]), []);

  /** Clé secrète de ce téléphone (membre du foyer), créée une fois. */
  const memberKey = useCallback(async () => {
    let key = await db.getMeta<string>("memberKey");
    if (!isMemberKey(key)) {
      key = newMemberKey((n) => crypto.getRandomValues(new Uint8Array(n)));
      await db.setMeta("memberKey", key);
    }
    return key;
  }, []);

  /** Inscription au foyer (une fois par foyer, rejouée si elle n'a pas pu se faire hors ligne). Renvoie la clé membre. */
  const ensureMember = useCallback(async (code: string) => {
    const key = await memberKey();
    if ((await db.getMeta<string>("memberOf")) !== code) {
      await enterHousehold(code, key, (await db.getMeta<string>("memberName")) ?? "");
      await db.setMeta("memberOf", code);
    }
    return key;
  }, [memberKey]);

  const runFridgeSync = useCallback(async (code: string) => {
    if (!stateRef.current.fridgeShared) return;
    // 1. Inscription au foyer.
    const key = await ensureMember(code);
    if (stateRef.current.household !== code || !stateRef.current.fridgeShared) return;
    // 2. Premier partage : fusion de ce frigo avec celui du foyer.
    if ((await db.getMeta<string>("fridgeMergedWith")) !== code) {
      const all = await pullDocs<StockDoc>(key, FRIDGE_KIND, 0);
      if (stateRef.current.household !== code) return;
      const m = firstMerge(stateRef.current.inventory, all.docs, Date.now(), uuid);
      fridgeOutbox.current = new Map(m.toPush.map((d) => [d.id, d]));
      await saveOutbox();
      commitInventoryRef.current(m.inventory, { remote: true });
      await Promise.all([db.setMeta("fridgeSeq", all.seq), db.setMeta("fridgeMergedWith", code)]);
      if (m.conflicts) setFridgeConflicts(m.conflicts);
    }
    // 3. Envoi des produits modifiés ici, un document par produit.
    const sending = [...fridgeOutbox.current.values()];
    if (sending.length) {
      await pushDocs(key, FRIDGE_KIND, sending);
      for (const d of sending) {
        if (fridgeOutbox.current.get(d.id) === d) fridgeOutbox.current.delete(d.id);
      }
      await saveOutbox();
    }
    // 4. Réception de ce que l'autre téléphone a changé.
    const since = (await db.getMeta<number>("fridgeSeq")) ?? 0;
    const pulled = await pullDocs<StockDoc>(key, FRIDGE_KIND, since);
    if (stateRef.current.household !== code) return;
    const next = applyRemote(stateRef.current.inventory, pulled.docs, fridgeOutbox.current, uuid);
    if (next) commitInventoryRef.current(next, { remote: true });
    if (pulled.seq !== since) await db.setMeta("fridgeSeq", pulled.seq);
  }, [ensureMember, saveOutbox]);

  const runSync = useCallback(async () => {
    const code = stateRef.current.household;
    if (!code) return;
    try {
      const pushedUpTo = (await db.getMeta<number>("syncPushedUpTo")) ?? 0;
      const toPush = itemsToPush(stateRef.current.shopping, pushedUpTo);
      if (toPush.length) {
        await pushItems(code, toPush);
        await db.setMeta("syncPushedUpTo", Math.max(pushedUpTo, ...toPush.map((i) => i.updatedAt)));
      }
      const since = (await db.getMeta<number>("syncSeq")) ?? 0;
      const pulled = await pullItems(code, since);
      if (stateRef.current.household !== code) return;
      const merged = mergeRemote(stateRef.current.shopping, pulled.items);
      if (merged) {
        const updated = { ...stateRef.current, shopping: merged.items };
        stateRef.current = updated;
        setState(updated);
        await db.putShopping(merged.changed);
      }
      if (pulled.seq !== since) await db.setMeta("syncSeq", pulled.seq);
      // Les deux ont ajouté la même recette en même temps : une seule ligne par ingrédient.
      const dups = collapseRecipeDuplicates(stateRef.current.shopping, Date.now(), deviceId.current);
      if (dups.length) {
        const ids = new Map(dups.map((d) => [d.id, d]));
        const updated = { ...stateRef.current, shopping: stateRef.current.shopping.map((i) => ids.get(i.id) ?? i) };
        stateRef.current = updated;
        setState(updated);
        await db.putShopping(dups);
        await pushItems(code, dups);
      }
      await runFridgeSync(code);
      setSyncStatus((s) => ({ ...s, lastSync: Date.now(), failing: false }));
    } catch (e) {
      console.warn("Synchronisation impossible", e);
      setSyncStatus((s) => ({ ...s, failing: true }));
    }
    // Planning du foyer (table séparée : s'il n'est pas encore installé, la liste marche quand même).
    try {
      const key = await ensureMember(code);
      if (stateRef.current.household !== code) return;
      const pushedUpTo = (await db.getMeta<number>("planPushedUpTo")) ?? 0;
      const toPush = docsToPush(stateRef.current.plan, pushedUpTo);
      if (toPush.length) {
        await pushDocs(key, PLAN_KIND, toPush.map((e) => ({ ...e, updatedAt: e.updatedAt ?? 0 })));
        await db.setMeta("planPushedUpTo", Math.max(pushedUpTo, ...toPush.map((e) => e.updatedAt ?? 0)));
      }
      const since = (await db.getMeta<number>("planSeq")) ?? 0;
      const pulled = await pullDocs<PlanEntry & { updatedAt: number }>(key, PLAN_KIND, since);
      if (stateRef.current.household !== code) return;
      const merged = mergeDocs(stateRef.current.plan, pulled.docs);
      if (merged) {
        const updated = { ...stateRef.current, plan: merged };
        stateRef.current = updated;
        setState(updated);
        await db.setMeta("plan", merged);
      }
      if (pulled.seq !== since) await db.setMeta("planSeq", pulled.seq);
      setSyncStatus((s) => (s.planFailing ? { ...s, planFailing: false } : s));
    } catch (e) {
      console.warn("Planning partagé indisponible", e);
      setSyncStatus((s) => ({ ...s, planFailing: true }));
    }
    // Carnet de recettes du foyer (même table que le planning).
    try {
      const key = await ensureMember(code);
      if (stateRef.current.household !== code) return;
      const pushedUpTo = (await db.getMeta<number>("carnetPushedUpTo")) ?? 0;
      const toPush = docsToPush(stateRef.current.carnet, pushedUpTo);
      if (toPush.length) {
        await pushDocs(key, CARNET_KIND, toPush);
        await db.setMeta("carnetPushedUpTo", Math.max(pushedUpTo, ...toPush.map((e) => e.updatedAt)));
      }
      const since = (await db.getMeta<number>("carnetSeq")) ?? 0;
      const pulled = await pullDocs<CarnetEntry>(key, CARNET_KIND, since);
      if (stateRef.current.household !== code) return;
      const merged = mergeDocs(stateRef.current.carnet, normalizeCarnet(pulled.docs));
      if (merged) {
        const updated = { ...stateRef.current, carnet: merged };
        stateRef.current = updated;
        setState(updated);
        await db.setMeta("carnet", merged);
      }
      if (pulled.seq !== since) await db.setMeta("carnetSeq", pulled.seq);
    } catch (e) {
      console.warn("Carnet partagé indisponible", e);
    }
  }, [runFridgeSync, ensureMember]);

  /** Lance une synchronisation (une seule à la fois ; une demande pendant l'envoi relance juste après). */
  const syncNow = useCallback((): Promise<void> => {
    if (syncing.current) {
      syncAgain.current = true;
      return syncing.current;
    }
    syncing.current = (async () => {
      do {
        syncAgain.current = false;
        await runSync();
      } while (syncAgain.current);
      syncing.current = null;
    })();
    return syncing.current;
  }, [runSync]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    scheduleSyncRef.current = () => {
      if (!stateRef.current.household) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), 600);
    };
    return () => { if (timer) clearTimeout(timer); };
  }, [syncNow]);

  // Synchronise à l'ouverture, au retour sur l'appli, au retour du réseau, et toutes les 5 s (appli ouverte).
  useEffect(() => {
    if (!state.ready || !state.household) return;
    void syncNow();
    const tick = () => { if (document.visibilityState === "visible") void syncNow(); };
    const id = setInterval(tick, 5000);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("online", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("online", tick);
    };
  }, [state.ready, state.household, syncNow]);

  /** Nombre de produits « Quantité à vérifier » après la première fusion du frigo (pour un message). */
  const [fridgeConflicts, setFridgeConflicts] = useState(0);

  /**
   * Rejoint (code donné) ou crée (sans code) un foyer : liste de courses partagée et,
   * sauf `fridge: false`, frigo partagé. Ce qui est déjà saisi ici est conservé et ajouté au foyer.
   */
  const startSharing = useCallback(async (joinCode?: string, opts: { fridge?: boolean; name?: string } = {}) => {
    const code = joinCode ?? stateRef.current.household ?? newHouseholdCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    if (!isHouseholdCode(code)) throw new Error("Code de partage invalide");
    const fridge = opts.fridge ?? true;
    const sameHousehold = code === stateRef.current.household;
    if (opts.name !== undefined) await db.setMeta("memberName", opts.name.trim().slice(0, 40));
    if (!sameHousehold) {
      await Promise.all([
        db.setMeta("household", code), db.setMeta("syncSeq", 0), db.setMeta("syncPushedUpTo", 0),
        db.setMeta("fridgeSeq", 0), db.setMeta("fridgeMergedWith", null), db.setMeta("fridgeOutbox", []),
        db.setMeta("planSeq", 0), db.setMeta("planPushedUpTo", 0),
        db.setMeta("carnetSeq", 0), db.setMeta("carnetPushedUpTo", 0),
      ]);
      fridgeOutbox.current = new Map();
    }
    const fridgeShared = fridge || (sameHousehold && stateRef.current.fridgeShared);
    await db.setMeta("fridgeShared", fridgeShared);
    const updated = { ...stateRef.current, household: code, fridgeShared };
    stateRef.current = updated;
    setState(updated);
    await syncNow();
    return code;
  }, [syncNow]);

  /** Partage le frigo avec le foyer de la liste de courses (même foyer, même code). */
  const shareFridge = useCallback(async () => {
    if (!stateRef.current.household) return startSharing(undefined, { fridge: true });
    return startSharing(stateRef.current.household, { fridge: true });
  }, [startSharing]);

  /** Arrête le partage sur ce téléphone (la liste et le frigo restent tels quels ici). */
  const stopSharing = useCallback(async () => {
    const key = await db.getMeta<string>("memberKey");
    if (isMemberKey(key) && (await db.getMeta<string>("memberOf"))) {
      await leaveHousehold(key).catch(() => {}); // hors ligne : l'accès sera refusé au prochain foyer rejoint
    }
    await Promise.all([
      db.setMeta("household", null), db.setMeta("fridgeShared", false), db.setMeta("memberOf", null),
      db.setMeta("fridgeMergedWith", null), db.setMeta("fridgeOutbox", []), db.setMeta("fridgeSeq", 0),
    ]);
    fridgeOutbox.current = new Map();
    const updated = { ...stateRef.current, household: null, fridgeShared: false };
    stateRef.current = updated;
    setState(updated);
    setSyncStatus({ lastSync: null, failing: false });
  }, []);

  const householdMembers = useCallback(async (): Promise<HouseholdMember[]> => {
    const key = await db.getMeta<string>("memberKey");
    if (!isMemberKey(key) || !(await db.getMeta<string>("memberOf"))) return [];
    return listMembers(key);
  }, []);

  // ---------- Courses ----------
  const addItem = useCallback(
    (name: string, quantity?: number | null, unit?: Unit | null) =>
      whenReady(() => {
        const c = ctx();
        const s = stateRef.current;
        const r = addManualItem(s.shopping, { name, quantity, unit }, c);
        commitShopping(r.items, recordUsage(s.history, r.item, c.now));
        return r;
      }),
    [ctx, commitShopping, whenReady],
  );

  const toggleItem = useCallback(
    (id: string) => commitShopping(toggleChecked(stateRef.current.shopping, id, ctx())),
    [ctx, commitShopping],
  );

  const updateItem = useCallback(
    (id: string, edit: ItemEdit) => commitShopping(editItem(stateRef.current.shopping, id, edit, ctx())),
    [ctx, commitShopping],
  );

  const removeItem = useCallback(
    (id: string) => {
      const before = stateRef.current.shopping;
      commitShopping(deleteItem(before, id, ctx()));
      const original = before.find((i) => i.id === id);
      // Renvoie une fonction d'annulation.
      return () => {
        if (!original) return;
        const restored = { ...original, updatedAt: Date.now() };
        commitShopping(stateRef.current.shopping.map((i) => (i.id === id ? restored : i)));
      };
    },
    [ctx, commitShopping],
  );

  const saveTrip = useCallback((trip: ShoppingTrip) => {
    const updated = { ...stateRef.current, trips: [...stateRef.current.trips.filter((t) => t.id !== trip.id), trip] };
    stateRef.current = updated;
    setState(updated);
    persist(db.putTrip(trip));
  }, [persist]);

  const removeTrip = useCallback((id: string) => {
    const updated = { ...stateRef.current, trips: stateRef.current.trips.filter((t) => t.id !== id) };
    stateRef.current = updated;
    setState(updated);
    persist(db.deleteTrip(id));
  }, [persist]);

  /** Dépense sans liste (marché, boulangerie…) : un montant, éventuellement un rayon. */
  const addExpense = useCallback((amount: number, aisle: Aisle | null, when = Date.now()) => {
    saveTrip({
      id: uuid(), listId: "default", finishedAt: when, amount,
      items: aisle ? [{ customName: "Dépense", ingredientId: null, aisle, manual: null, recipeMissing: [], price: amount }] : [],
    });
  }, [saveTrip]);

  /** Ticket importé (texte ou PDF) : un article par ligne, avec son prix et son rayon. */
  const addReceipt = useCallback((lines: { label: string; price: number; aisle: Aisle }[], amount: number, when = Date.now()) => {
    saveTrip({
      id: uuid(), listId: "default", finishedAt: when, amount,
      items: lines.map((l) => ({ customName: l.label, ingredientId: null, aisle: l.aisle, manual: null, recipeMissing: [], price: l.price })),
    });
  }, [saveTrip]);

  const finish = useCallback((money: { amount?: number | null; prices?: ReadonlyMap<string, number> } = {}) => {
    const before = stateRef.current.shopping;
    const inventoryBefore = stateRef.current.inventory;
    const bought = before.filter((i) => i.checked && i.deletedAt === null);
    const r = finishShopping(before, ctx(), money);
    if (!r.trip) return null;
    const trip = r.trip;
    commitShopping(r.items);
    saveTrip(trip);
    // Ce qui a été acheté rejoint le frigo / la maison.
    const stock = stockFromPurchase(inventoryBefore, bought, Date.now(), uuid);
    commitInventoryRef.current(stock.inventory);
    const archivedIds = new Set(bought.map((i) => i.id));
    return {
      count: r.trip.items.length,
      stocked: stock.added,
      undo: () => {
        const now = Date.now();
        commitShopping(
          stateRef.current.shopping.map((i) => (archivedIds.has(i.id) ? { ...i, deletedAt: null, updatedAt: now } : i)),
        );
        commitInventoryRef.current(inventoryBefore);
        removeTrip(trip.id);
      },
    };
  }, [ctx, commitShopping, saveTrip, removeTrip]);

  const addRecipe = useCallback(
    (recipe: Recipe, servings: number): RecipeAddSummary => {
      const s = stateRef.current;
      const inv = new Map(s.inventory.map((i) => [i.ingredientId, i]));
      const r = addRecipeToList(s.shopping, recipe, servings, inv, ctx());
      commitShopping(r.items);
      return r.summary;
    },
    [ctx, commitShopping],
  );

  /** Ajoute en une fois ce qui manque pour plusieurs recettes (portions cumulées par recette). */
  const addRecipes = useCallback(
    (list: { recipe: Recipe; servings: number }[]): RecipeAddSummary => {
      const s = stateRef.current;
      const inv = new Map(s.inventory.map((i) => [i.ingredientId, i]));
      const total: RecipeAddSummary = { added: 0, updated: 0, toVerify: 0, alreadyAvailable: 0 };
      let items = s.shopping;
      for (const { recipe, servings } of list) {
        const r = addRecipeToList(items, recipe, servings, inv, ctx());
        items = r.items;
        total.added += r.summary.added;
        total.updated += r.summary.updated;
        total.toVerify += r.summary.toVerify;
        total.alreadyAvailable += r.summary.alreadyAvailable;
      }
      commitShopping(items);
      return total;
    },
    [ctx, commitShopping],
  );

  // ---------- Planning ----------
  const commitPlan = useCallback(
    (plan: PlanEntry[]) => {
      const updated = { ...stateRef.current, plan };
      stateRef.current = updated;
      setState(updated);
      persist(db.setMeta("plan", plan));
      scheduleSyncRef.current();
    },
    [persist],
  );

  /** Prévoit un plat (remplace celui du créneau s'il y en a un : la confirmation se fait avant). */
  const planRecipe = useCallback(
    (recipeId: string, date: string, meal: Meal, servings: number) =>
      void whenReady(() => {
        commitPlan(setSlot(stateRef.current.plan, { date, meal, recipeId, servings }, Date.now(), deviceId.current));
      }),
    [commitPlan, whenReady],
  );

  const updatePlanEntry = useCallback(
    (id: string, patch: Partial<Pick<PlanEntry, "servings">>) =>
      commitPlan(patchSlot(stateRef.current.plan, id, patch, Date.now(), deviceId.current)),
    [commitPlan],
  );

  /** Retire le plat du planning (sur les deux téléphones si le foyer est partagé). */
  const removePlanEntry = useCallback(
    (id: string) => commitPlan(patchSlot(stateRef.current.plan, id, { deletedAt: Date.now() }, Date.now(), deviceId.current)),
    [commitPlan],
  );

  /**
   * « Ajouter ce qui manque » depuis un plat prévu : on récupère d'abord ce que l'autre a peut-être
   * déjà ajouté, pour compléter sa ligne au lieu d'en créer une seconde.
   */
  const addPlannedToShopping = useCallback(
    async (entry: PlanEntry): Promise<RecipeAddSummary | null> => {
      const recipe = RECIPES_BY_ID.get(entry.recipeId);
      if (!recipe) return null;
      if (stateRef.current.household) await Promise.race([syncNow(), new Promise((r) => setTimeout(r, 2500))]);
      return addRecipe(recipe, entry.servings);
    },
    [addRecipe, syncNow],
  );

  /** Met dans les courses ce qui manque pour les repas prévus sur ces jours. */
  const addPlanToShopping = useCallback(
    (days: string[]) => {
      const list = [...servingsByRecipe(stateRef.current.plan, days)]
        .map(([id, servings]) => ({ recipe: RECIPES_BY_ID.get(id), servings }))
        .filter((x): x is { recipe: Recipe; servings: number } => x.recipe !== undefined);
      return addRecipes(list);
    },
    [addRecipes],
  );

  // ---------- Carnet de recettes ----------
  /** Favorite, « pas pour nous », à refaire, note perso (partagé avec le foyer). */
  const updateCarnet = useCallback(
    (recipeId: string, patch: CarnetPatch) =>
      void whenReady(() => {
        const carnet = patchEntry(stateRef.current.carnet, recipeId, patch, Date.now(), deviceId.current);
        const updated = { ...stateRef.current, carnet };
        stateRef.current = updated;
        setState(updated);
        persist(db.setMeta("carnet", carnet));
        scheduleSyncRef.current();
      }),
    [persist, whenReady],
  );

  // ---------- Frigo ----------
  /**
   * Toute modification du frigo passe ici (ajout, quantité, « Terminer mes courses », « J'ai cuisiné »…).
   * Si le frigo est partagé, chaque produit modifié ou retiré part dans la file d'envoi.
   * `remote` : changement reçu du foyer, à ne pas renvoyer.
   */
  const commitInventory = useCallback(
    (proposed: InventoryItem[], opts: { remote?: boolean } = {}) => {
      const prev = stateRef.current;
      let next = proposed;
      let outbox: StockDoc[] | undefined;
      if (prev.fridgeShared && !opts.remote) {
        const c = localChanges(prev.inventory, proposed, Date.now(), deviceId.current);
        next = c.inventory;
        if (c.docs.length) {
          for (const d of c.docs) fridgeOutbox.current.set(d.id, d);
          outbox = [...fridgeOutbox.current.values()];
          scheduleSyncRef.current();
        }
      }
      const nextIds = new Set(next.map((i) => i.id));
      const removed = prev.inventory.filter((i) => !nextIds.has(i.id)).map((i) => i.id);
      const updated = { ...prev, inventory: next };
      stateRef.current = updated;
      setState(updated);
      persist(db.saveInventory(changed(prev.inventory, next), removed, outbox));
    },
    [persist],
  );
  commitInventoryRef.current = commitInventory;

  const addToInventory = useCallback(
    (ingredientId: string) =>
      void whenReady(() => {
        const inv = stateRef.current.inventory;
        if (inv.some((i) => i.ingredientId === ingredientId)) return;
        commitInventory([
          ...inv,
          { id: uuid(), ingredientId, quantity: null, unit: null, priority: false, updatedAt: Date.now() },
        ]);
      }),
    [commitInventory, whenReady],
  );

  const removeFromInventory = useCallback(
    (ingredientId: string) => commitInventory(stateRef.current.inventory.filter((i) => i.ingredientId !== ingredientId)),
    [commitInventory],
  );

  const updateInventory = useCallback(
    (ingredientId: string, patch: Partial<Pick<InventoryItem, "quantity" | "unit" | "priority">>) =>
      commitInventory(
        stateRef.current.inventory.map((i) =>
          i.ingredientId === ingredientId ? withoutCheck({ ...i, ...patch, updatedAt: Date.now() }, patch) : i,
        ),
      ),
    [commitInventory],
  );

  /**
   * « J'ai » sur un ingrédient d'une recette : il entre dans Mon frigo avec la quantité demandée,
   * il ne partira donc plus dans les courses. Renvoie une annulation (sans effet si appelée deux fois).
   */
  const haveIngredient = useCallback(
    (ingredientId: string, need: Amount | null) => {
      const r = markHave(stateRef.current.inventory, ingredientId, need, Date.now(), uuid);
      commitInventory(r.inventory);
      let undone = false;
      return {
        wasAbsent: r.previous === null,
        undo: () => {
          if (undone) return;
          undone = true;
          commitInventory(undoMarkHave(stateRef.current.inventory, ingredientId, r.previous));
        },
      };
    },
    [commitInventory],
  );

  /**
   * « J'ai cuisiné » : retire les produits terminés et déduit (estimation) le reste.
   * Renvoie le bilan et une fonction d'annulation (sans effet si elle est appelée deux fois).
   */
  const cookRecipe = useCallback(
    (recipe: Recipe, servings: number, finished: ReadonlySet<string>) => {
      const r = consumeRecipe(stateRef.current.inventory, recipe, servings, finished, getIngredient, Date.now());
      commitInventory(r.inventory);
      let undone = false;
      return {
        removed: r.removed,
        updated: r.updated,
        undo: () => {
          if (undone) return;
          undone = true;
          commitInventory(restoreStock(stateRef.current.inventory, r.previous));
        },
      };
    },
    [commitInventory],
  );

  // ---------- Réglages ----------
  const updateSettings = useCallback(
    (patch: Partial<Settings>) => {
      const prev = stateRef.current;
      const settings = { ...prev.settings, ...patch };
      const updated = { ...prev, settings };
      stateRef.current = updated;
      setState(updated);
      persist(db.setMeta("settings", settings));
    },
    [persist],
  );

  const plan = useMemo(() => activePlan(state.plan), [state.plan]);
  const carnet = useMemo(() => activeCarnet(state.carnet), [state.carnet]);
  const carnetMap = useMemo(() => new Map(carnet.map((e) => [e.id, e])), [carnet]);
  const disliked = useMemo(() => dislikedIds(carnet), [carnet]);
  const inventoryMap = useMemo(() => new Map(state.inventory.map((i) => [i.ingredientId, i])), [state.inventory]);

  return {
    ...state,
    plan,
    carnet, carnetMap, disliked, updateCarnet,
    inventoryMap,
    storageError,
    dismissStorageError: () => setStorageError(null),
    addItem, toggleItem, updateItem, removeItem, finish, addRecipe, addRecipes, addExpense, addReceipt, removeTrip,
    planRecipe, updatePlanEntry, removePlanEntry, addPlanToShopping, addPlannedToShopping,
    addToInventory, removeFromInventory, updateInventory, cookRecipe, haveIngredient,
    updateSettings,
    syncStatus, syncNow, startSharing, stopSharing, shareFridge, householdMembers,
    fridgeConflicts, dismissFridgeConflicts: () => setFridgeConflicts(0),
  };
}

export type AppStore = ReturnType<typeof useAppState>;

const StoreContext = createContext<AppStore | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const store = useAppState();
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

export function useStore(): AppStore {
  const s = useContext(StoreContext);
  if (!s) throw new Error("useStore doit être utilisé dans <StoreProvider>");
  return s;
}
