import { INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import type { InventoryItem, Unit } from "@/lib/domain/types";
import type { ShoppingContext } from "@/lib/domain/shopping";

export function ctx(now = 1000): ShoppingContext {
  let n = 0;
  return {
    now,
    newId: () => `id-${++n}`,
    deviceId: "test-device",
    listId: "default",
    catalog: INGREDIENTS,
    getIngredient,
  };
}

export function inv(
  entries: [string, number | null, Unit | null, boolean?][],
): Map<string, InventoryItem> {
  return new Map(
    entries.map(([ingredientId, quantity, unit, priority]) => [
      ingredientId,
      { id: `inv-${ingredientId}`, ingredientId, quantity, unit, priority: priority ?? false, updatedAt: 0 },
    ]),
  );
}
