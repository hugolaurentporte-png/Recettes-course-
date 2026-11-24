import { describe, expect, it } from "vitest";
import { addRecipeToList } from "@/lib/domain/shopping";
import { recipeAvailability } from "@/lib/domain/availability";
import { markHave, undoMarkHave } from "@/lib/domain/stock";
import { INGREDIENTS, getIngredient } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import type { InventoryItem } from "@/lib/domain/types";

let n = 0;
const newId = () => `id${n++}`;
const ctx = () => ({ now: 1000, newId, deviceId: "d", listId: "default", catalog: INGREDIENTS, getIngredient });
const map = (inv: InventoryItem[]) => new Map(inv.map((i) => [i.ingredientId, i]));
const recipe = RECIPES.find((r) => r.ingredients.some((l) => !l.optional && l.quantity !== null))!;
const line = recipe.ingredients.find((l) => !l.optional && l.quantity !== null)!;
const need = () => recipeAvailability(recipe, map([]), getIngredient).lines.find((l) => l.line === line)!.need;

describe("« J'ai » sur un ingrédient de recette", () => {
  it("un ingrédient absent entre au frigo et ne part plus dans les courses", () => {
    const before = addRecipeToList([], recipe, recipe.servings, map([]), ctx()).items;
    expect(before.some((i) => i.ingredientId === line.ingredientId)).toBe(true);

    const r = markHave([], line.ingredientId, need(), 5, newId);
    expect(r.previous).toBeNull();
    const av = recipeAvailability(recipe, map(r.inventory), getIngredient);
    expect(av.lines.find((l) => l.line === line)!.status).toBe("ok");
    const after = addRecipeToList([], recipe, recipe.servings, map(r.inventory), ctx()).items;
    expect(after.some((i) => i.ingredientId === line.ingredientId)).toBe(false);
  });

  it("pas assez ou quantité inconnue : la quantité devient celle de la recette", () => {
    const stock: InventoryItem[] = [{ id: "x", ingredientId: line.ingredientId, quantity: null, unit: null, priority: true, updatedAt: 0,
      quantityCheck: [{ quantity: 1, unit: null }] }];
    const r = markHave(stock, line.ingredientId, need(), 5, newId);
    expect(r.inventory).toHaveLength(1);
    expect(r.inventory[0]).toMatchObject({ id: "x", quantity: need()!.value, unit: need()!.unit, priority: true });
    expect(r.inventory[0]!.quantityCheck).toBeUndefined();
    expect(recipeAvailability(recipe, map(r.inventory), getIngredient).lines.find((l) => l.line === line)!.status).toBe("ok");
    expect(undoMarkHave(r.inventory, line.ingredientId, r.previous)).toEqual(stock);
  });

  it("« selon le goût » : ajouté sans quantité ; Annuler le retire", () => {
    const r = markHave([], "sel", null, 5, newId);
    expect(r.inventory[0]).toMatchObject({ ingredientId: "sel", quantity: null, unit: null });
    expect(undoMarkHave(r.inventory, "sel", r.previous)).toEqual([]);
  });
});
