"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Aisle, Equipment, InventoryItem, ItemHistory, Recipe, ShoppingItem, ShoppingTrip, Unit } from "./domain/types";
import {
  addManualItem, addRecipeToList, deleteItem, editItem, finishShopping, recordUsage, toggleChecked,
  type ItemEdit, type RecipeAddSummary, type ShoppingContext,
} from "./domain/shopping";
import { INGREDIENTS, getIngredient } from "./data/ingredients";
import * as db from "./storage/db";
import { prunePlan, servingsByRecipe, type Meal, type PlanEntry } from "./domain/plan";
import { RECIPES_BY_ID } from "./data/recipes";
import { stockFromPurchase } from "./domain/stock";

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
  trips: ShoppingTrip[];
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

function useAppState() {
  const [state, setState] = useState<State>({
    ready: false, shopping: [], history: [], inventory: [], settings: DEFAULT_SETTINGS, plan: [], trips: [],
  });
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
  const commitInventoryRef = useRef<(next: InventoryItem[]) => void>(() => {});

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
        const [data, settings, plan] = await Promise.all([db.loadAll(), db.getMeta<Settings>("settings"), db.getMeta<PlanEntry[]>("plan")]);
        if (cancelled) return;
        const loaded: State = {
          ready: true,
          shopping: data.shopping,
          history: data.history,
          inventory: data.inventory,
          settings: { ...DEFAULT_SETTINGS, ...settings },
          plan: prunePlan(plan ?? [], new Date()),
          trips: data.trips,
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
    },
    [persist],
  );

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
    },
    [persist],
  );

  const planRecipe = useCallback(
    (recipeId: string, date: string, meal: Meal, servings: number) =>
      void whenReady(() => {
        const others = stateRef.current.plan.filter((e) => !(e.date === date && e.meal === meal));
        commitPlan([...others, { id: uuid(), date, meal, recipeId, servings }]);
      }),
    [commitPlan, whenReady],
  );

  const updatePlanEntry = useCallback(
    (id: string, patch: Partial<Pick<PlanEntry, "servings">>) =>
      commitPlan(stateRef.current.plan.map((e) => (e.id === id ? { ...e, ...patch } : e))),
    [commitPlan],
  );

  const removePlanEntry = useCallback(
    (id: string) => commitPlan(stateRef.current.plan.filter((e) => e.id !== id)),
    [commitPlan],
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

  // ---------- Frigo ----------
  const commitInventory = useCallback(
    (next: InventoryItem[]) => {
      const prev = stateRef.current;
      const nextIds = new Set(next.map((i) => i.id));
      const removed = prev.inventory.filter((i) => !nextIds.has(i.id)).map((i) => i.id);
      const updated = { ...prev, inventory: next };
      stateRef.current = updated;
      setState(updated);
      persist(db.putInventory(changed(prev.inventory, next)));
      persist(db.deleteInventory(removed));
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
          i.ingredientId === ingredientId ? { ...i, ...patch, updatedAt: Date.now() } : i,
        ),
      ),
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

  const inventoryMap = useMemo(() => new Map(state.inventory.map((i) => [i.ingredientId, i])), [state.inventory]);

  return {
    ...state,
    inventoryMap,
    storageError,
    dismissStorageError: () => setStorageError(null),
    addItem, toggleItem, updateItem, removeItem, finish, addRecipe, addRecipes, addExpense, addReceipt, removeTrip,
    planRecipe, updatePlanEntry, removePlanEntry, addPlanToShopping,
    addToInventory, removeFromInventory, updateInventory,
    updateSettings,
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
