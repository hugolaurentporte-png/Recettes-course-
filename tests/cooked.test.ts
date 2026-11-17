import { describe, expect, it } from "vitest";
import { consumeRecipe, cookedIngredientsInStock, restoreStock } from "@/lib/domain/stock";
import { recipeAvailability } from "@/lib/domain/availability";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import type { InventoryItem, Recipe, Unit } from "@/lib/domain/types";

const item = (ingredientId: string, quantity: number | null, unit: Unit | null): InventoryItem =>
  ({ id: `inv-${ingredientId}`, ingredientId, quantity, unit, priority: false, updatedAt: 0 });

// Soupe poireaux pommes de terre au Thermomix : 400 g de pommes de terre pour 4.
const soupe = RECIPES_BY_ID.get("tm-soupe-poireaux") as Recipe;
const none = new Set<string>();

describe("« J'ai cuisiné » met le frigo à jour", () => {
  it("500 g de pommes de terre, recette à 400 g, « Rien de terminé » → il reste environ 100 g", () => {
    const r = consumeRecipe([item("pomme-de-terre", 500, "g")], soupe, 4, none, getIngredient, 9);
    expect(r.inventory).toEqual([{ ...item("pomme-de-terre", 100, "g"), updatedAt: 9 }]);
    expect(r).toMatchObject({ removed: 0, updated: 1 });
  });

  it("la déduction suit les portions choisies (2 pers. → 200 g) et convertit les unités (kg)", () => {
    const r = consumeRecipe([item("pomme-de-terre", 1, "kg")], soupe, 2, none, getIngredient, 9);
    expect(r.inventory[0]).toMatchObject({ quantity: 0.8, unit: "kg" });
  });

  it("pommes de terre sans quantité, il en reste → elles restent, sans quantité à saisir", () => {
    const stock = [item("pomme-de-terre", null, null)];
    const r = consumeRecipe(stock, soupe, 4, none, getIngredient, 9);
    expect(r.inventory).toEqual(stock);
    // La prochaine recette qui en a besoin affiche « Quantité à vérifier ».
    const gratin = RECIPES_BY_ID.get("gratin-pdt-carottes")!;
    const a = recipeAvailability(gratin, new Map(r.inventory.map((i) => [i.ingredientId, i])), getIngredient);
    expect(a.lines.find((l) => l.line.ingredientId === "pomme-de-terre")!.status).toBe("verify");
  });

  it("dernières pommes de terre sélectionnées → elles disparaissent du frigo", () => {
    const r = consumeRecipe([item("pomme-de-terre", 500, "g"), item("lait", 1, "l")], soupe, 4,
      new Set(["pomme-de-terre"]), getIngredient, 9);
    expect(r.inventory.map((i) => i.ingredientId)).toEqual(["lait"]);
    expect(r.removed).toBe(1);
  });

  it("calcul à zéro ou moins sans avoir dit « terminé » → gardé avec une quantité inconnue", () => {
    const r = consumeRecipe([item("pomme-de-terre", 300, "g")], soupe, 4, none, getIngredient, 9);
    expect(r.inventory[0]).toMatchObject({ ingredientId: "pomme-de-terre", quantity: null, unit: null });
  });

  it("unités incompatibles → gardé, quantité inconnue ; « selon le goût » → inchangé", () => {
    const stock = [item("poireau", 300, "g"), item("sel", 1, "piece")];
    // poireau : recette en pièces, stock en grammes sans équivalence documentée.
    expect(getIngredient("poireau")?.pieceGrams).toBeUndefined();
    const r = consumeRecipe(stock, soupe, 4, none, getIngredient, 9);
    expect(r.inventory[0]).toMatchObject({ quantity: null, unit: null });
    expect(r.inventory[1]).toBe(stock[1]);
  });

  it("ne touche pas aux produits qui ne sont pas dans la recette", () => {
    const lait = item("lait", 1, "l");
    const r = consumeRecipe([lait], soupe, 4, none, getIngredient, 9);
    expect(r.inventory[0]).toBe(lait);
    expect(r.updated).toBe(0);
  });

  it("« Annuler » restaure l'état précédent sans toucher au reste", () => {
    const before = [item("pomme-de-terre", 500, "g"), item("beurre", 250, "g"), item("lait", 1, "l")];
    const r = consumeRecipe(before, soupe, 4, new Set(["beurre"]), getIngredient, 9);
    const added = item("riz", 500, "g");
    const restored = restoreStock([...r.inventory, added], r.previous);
    expect(new Set(restored)).toEqual(new Set([...before, added]));
  });

  it("le panneau liste uniquement les ingrédients de la recette présents dans le frigo", () => {
    const map = new Map([item("pomme-de-terre", 500, "g"), item("lait", 1, "l"), item("beurre", null, null)]
      .map((i) => [i.ingredientId, i]));
    expect(cookedIngredientsInStock(soupe, map).map((i) => i.ingredientId)).toEqual(["pomme-de-terre", "beurre"]);
  });
});
