import type { Aisle, Ingredient, InventoryItem, Recipe, ShoppingItem } from "./types";
import { scaledNeed } from "./availability";
import { displayAmounts } from "./shopping";
import { convert } from "./units";
import { itemKey } from "./normalize";

export const CUSTOM_PREFIX = "custom:";

export function isCustomStock(item: Pick<InventoryItem, "ingredientId">): boolean {
  return item.ingredientId.startsWith(CUSTOM_PREFIX);
}

/** Rayons rangés « à la maison » plutôt que dans le frigo. */
export const HOME_AISLES: ReadonlySet<Aisle> = new Set(["hygiene", "maison", "autres"]);

/**
 * Ce qui a été coché pendant les courses entre dans le stock :
 * - ingrédient du catalogue : ajouté au frigo, ou quantité additionnée si l'unité le permet ;
 * - produit libre (lessive, papier toilette…) : ajouté sous son nom, sans doublon.
 */
export function stockFromPurchase(
  inventory: readonly InventoryItem[],
  bought: readonly ShoppingItem[],
  now: number,
  newId: () => string,
): { inventory: InventoryItem[]; added: number } {
  const next = [...inventory];
  let added = 0;
  for (const b of bought) {
    const amount = displayAmounts(b).length === 1 ? displayAmounts(b)[0]! : null;
    const id = b.ingredientId ?? `${CUSTOM_PREFIX}${itemKey(b.customName)}`;
    const idx = next.findIndex((i) => i.ingredientId === id);
    if (idx >= 0) {
      const cur = next[idx]!;
      if (amount && cur.quantity !== null && cur.unit) {
        const v = convert(amount, cur.unit);
        if (v !== null) next[idx] = { ...cur, quantity: Math.round((cur.quantity + v) * 100) / 100, updatedAt: now };
      }
      continue;
    }
    next.push({
      id: newId(),
      ingredientId: id,
      quantity: amount?.value ?? null,
      unit: amount?.unit ?? null,
      priority: false,
      updatedAt: now,
      ...(b.ingredientId ? {} : { customName: b.customName, aisle: b.aisle }),
    });
    added++;
  }
  return { inventory: next, added };
}

/** Ingrédients de la recette déjà présents dans le frigo (une ligne par produit, dans l'ordre de la recette). */
export function cookedIngredientsInStock(
  recipe: Recipe,
  inventory: ReadonlyMap<string, InventoryItem>,
): InventoryItem[] {
  const seen = new Set<string>();
  const out: InventoryItem[] = [];
  for (const line of recipe.ingredients) {
    const stock = inventory.get(line.ingredientId);
    if (!stock || seen.has(line.ingredientId)) continue;
    seen.add(line.ingredientId);
    out.push(stock);
  }
  return out;
}

export interface CookResult {
  inventory: InventoryItem[];
  /** Produits retirés car terminés. */
  removed: number;
  /** Produits dont la quantité a été estimée (déduite ou devenue inconnue). */
  updated: number;
  /** Version d'avant de chaque produit touché, pour « Annuler ». */
  previous: InventoryItem[];
}

/**
 * « J'ai cuisiné » : met le frigo à jour sans rien peser.
 * - produits cochés comme terminés : retirés ;
 * - stock chiffré et unités compatibles : la quantité de la recette (selon les portions) est déduite ;
 *   si le calcul tombe à zéro ou moins alors que le produit n'est pas terminé, la quantité devient inconnue ;
 * - stock non chiffré, unités incompatibles : le produit reste présent, quantité inconnue (« à vérifier ») ;
 * - besoin « selon le goût » (sel, poivre) : rien ne change.
 * C'est une estimation : l'utilisateur peut toujours corriger dans Mon frigo.
 */
export function consumeRecipe(
  inventory: readonly InventoryItem[],
  recipe: Recipe,
  servings: number,
  finished: ReadonlySet<string>,
  getIngredient: (id: string) => Ingredient | undefined,
  now: number,
): CookResult {
  const needs = new Map<string, ReturnType<typeof scaledNeed>[]>();
  for (const line of recipe.ingredients) {
    const list = needs.get(line.ingredientId) ?? [];
    list.push(scaledNeed(line, recipe.servings, servings));
    needs.set(line.ingredientId, list);
  }

  const next: InventoryItem[] = [];
  const previous: InventoryItem[] = [];
  let removed = 0;
  let updated = 0;

  for (const item of inventory) {
    const lineNeeds = needs.get(item.ingredientId);
    if (!lineNeeds) {
      next.push(item);
      continue;
    }
    if (finished.has(item.ingredientId)) {
      previous.push(item);
      removed++;
      continue;
    }
    const quantified = lineNeeds.filter((n) => n !== null);
    if (quantified.length === 0 || item.quantity === null || item.unit === null) {
      // Rien de chiffré à déduire, ou stock déjà inconnu : le produit reste tel quel.
      next.push(item);
      continue;
    }
    let used = 0;
    let comparable = true;
    for (const need of quantified) {
      const v = convert(need, item.unit, getIngredient(item.ingredientId));
      if (v === null) comparable = false;
      else used += v;
    }
    const left = Math.round((item.quantity - used) * 100) / 100;
    previous.push(item);
    updated++;
    next.push(
      comparable && left > 0
        ? { ...item, quantity: left, updatedAt: now }
        : { ...item, quantity: null, unit: null, updatedAt: now },
    );
  }

  return { inventory: next, removed, updated, previous };
}

/**
 * Annule « J'ai cuisiné » : remet les produits touchés dans leur état d'avant
 * (les autres produits du frigo, ajoutés ou modifiés entre-temps, ne bougent pas).
 */
export function restoreStock(
  inventory: readonly InventoryItem[],
  previous: readonly InventoryItem[],
): InventoryItem[] {
  const byId = new Map(previous.map((p) => [p.ingredientId, p]));
  const next = inventory.map((i) => byId.get(i.ingredientId) ?? i);
  const present = new Set(inventory.map((i) => i.ingredientId));
  for (const p of previous) if (!present.has(p.ingredientId)) next.push(p);
  return next;
}
