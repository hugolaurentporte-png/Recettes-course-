import { describe, expect, it } from "vitest";
import { drawRecipe } from "@/lib/domain/random";
import { EMPTY_FILTERS, rankRecipes } from "@/lib/domain/recommend";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import { inv } from "./helpers";

const ranked = (inventory = inv([])) => rankRecipes(RECIPES, EMPTY_FILTERS, { inventory, getIngredient, month: 11 });

describe("tirage au sort", () => {
  it("liste vide : rien à tirer", () => {
    expect(drawRecipe([], null)).toBeNull();
  });

  it("ne retombe pas sur la recette précédente", () => {
    const pool = ranked().slice(0, 2);
    for (let i = 0; i < 20; i++) expect(drawRecipe(pool, pool[0]!.recipe.id)?.recipe.id).toBe(pool[1]!.recipe.id);
  });

  it("une seule recette : on peut la retirer", () => {
    const pool = ranked().slice(0, 1);
    expect(drawRecipe(pool, pool[0]!.recipe.id)).toBe(pool[0]);
  });

  it("préfère les recettes faisables ou presque quand il y en a assez", () => {
    const inventory = inv([["oeuf", 12, "piece"], ["pates", 1, "kg"], ["lait", 1, "l"], ["beurre", null, null], ["sel", null, null],
      ["poivre", null, null], ["farine", 1, "kg"], ["sucre", 1, "kg"], ["fromage-rape", 200, "g"], ["creme", 50, "cl"]]);
    const pool = ranked(inventory);
    expect(pool.filter((s) => s.availability.missingCount <= 2).length).toBeGreaterThanOrEqual(5);
    for (let i = 0; i < 50; i++) {
      expect(drawRecipe(pool, null, () => i / 50)!.availability.missingCount).toBeLessThanOrEqual(2);
    }
  });

  it("Thermomix choisi alors qu'il n'est pas coché : les recettes Thermomix apparaissent", () => {
    const filters = { ...EMPTY_FILTERS, modes: ["thermomix" as const] };
    const ctx = { inventory: inv([]), getIngredient, month: 11 };
    const owned = ["four", "poele", "casserole", "cocotte"] as const;
    expect(rankRecipes(RECIPES, { ...filters, ownedEquipment: [...owned] }, ctx)).toEqual([]);
    expect(rankRecipes(RECIPES, { ...filters, ownedEquipment: [...owned, "thermomix"] }, ctx).length).toBeGreaterThan(3);
  });
});
