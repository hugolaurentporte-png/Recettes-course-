import { describe, expect, it } from "vitest";
import { addManualItem } from "@/lib/domain/shopping";
import { stockFromPurchase, isCustomStock } from "@/lib/domain/stock";
import { INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import type { InventoryItem } from "@/lib/domain/types";

let n = 0;
const ctx = () => ({ now: 1000, newId: () => `id${n++}`, deviceId: "d", listId: "default", catalog: INGREDIENTS, getIngredient });

describe("courses terminées → frigo et maison", () => {
  it("un ingrédient acheté entre au frigo avec sa quantité, un produit libre entre à la maison", () => {
    const c = ctx();
    let { items } = addManualItem([], { name: "Lait", quantity: 2, unit: "l" }, c);
    ({ items } = addManualItem(items, { name: "Lessive" }, c));
    const r = stockFromPurchase([], items, 5, c.newId);
    expect(r.added).toBe(2);
    const lait = r.inventory.find((i) => i.ingredientId === "lait")!;
    expect(lait.quantity).not.toBeNull();
    const lessive = r.inventory.find(isCustomStock)!;
    expect(lessive.customName).toBe("Lessive");
    expect(lessive.aisle).toBe("maison");
  });
  it("additionne avec ce qu'il reste déjà, sans doublon", () => {
    const c = ctx();
    const stock: InventoryItem[] = [{ id: "x", ingredientId: "pomme-de-terre", quantity: 500, unit: "g", priority: true, updatedAt: 0 }];
    const { items } = addManualItem([], { name: "pommes de terre", quantity: 1, unit: "kg" }, c);
    const r = stockFromPurchase(stock, items, 5, c.newId);
    expect(r.added).toBe(0);
    expect(r.inventory).toHaveLength(1);
    expect(r.inventory[0]).toMatchObject({ quantity: 1500, unit: "g", priority: true });
  });
  it("ne touche pas au stock sans quantité connue", () => {
    const c = ctx();
    const stock: InventoryItem[] = [{ id: "x", ingredientId: "oeuf", quantity: null, unit: null, priority: false, updatedAt: 0 }];
    const { items } = addManualItem([], { name: "oeufs", quantity: 6, unit: "piece" }, c);
    const r = stockFromPurchase(stock, items, 5, c.newId);
    expect(r.inventory).toEqual(stock);
  });
  it("un produit libre déjà à la maison n'est pas ajouté deux fois", () => {
    const c = ctx();
    const { items } = addManualItem([], { name: "Papier toilette" }, c);
    const once = stockFromPurchase([], items, 5, c.newId).inventory;
    const twice = stockFromPurchase(once, items, 6, c.newId);
    expect(twice.added).toBe(0);
    expect(twice.inventory).toHaveLength(1);
  });
});
