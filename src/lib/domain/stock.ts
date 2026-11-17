import type { Aisle, InventoryItem, ShoppingItem } from "./types";
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
