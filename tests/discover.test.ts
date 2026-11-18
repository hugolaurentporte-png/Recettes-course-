import { describe, expect, it } from "vitest";
import { discover, listFr } from "@/lib/domain/discover";
import { EMPTY_FILTERS, rankRecipes } from "@/lib/domain/recommend";
import { withoutDisliked } from "@/lib/domain/carnet";
import { mealClass } from "@/lib/domain/meal";
import { getIngredient } from "@/lib/data/ingredients";
import { inSeasonIds } from "@/lib/data/seasonality";
import { RECIPES } from "@/lib/data/recipes";
import { inv } from "./helpers";

const month = 11;
const run = (inventory = inv([]), extra: { plannedIds?: Set<string>; disliked?: Set<string> } = {}) => {
  const ranked = rankRecipes(RECIPES, EMPTY_FILTERS, { inventory, getIngredient, month });
  const list = withoutDisliked(ranked, extra.disliked ?? new Set(), (s) => s.recipe.id);
  return discover(list, { month, inventory, getIngredient, inSeason: inSeasonIds(month), plannedIds: extra.plannedIds });
};

const fridge = inv([["poireau", 3, "piece", true], ["pomme-de-terre", 1, "kg"], ["oignon", 3, "piece"], ["beurre", null, null],
  ["creme", 20, "cl"], ["oeuf", 6, "piece"], ["lardons", 200, "g"], ["fromage-rape", 200, "g"], ["sel", null, null], ["poivre", null, null]]);

describe("À découvrir", () => {
  it("frigo : des plats faisables ou presque, qui utilisent ce qu'on a (poireaux à finir d'abord)", () => {
    const d = run(fridge);
    expect(d.fridge.length).toBeGreaterThan(0);
    for (const i of d.fridge) {
      expect(i.s.availability.missingCount).toBeLessThanOrEqual(2);
      expect(mealClass(i.s.recipe).plat?.some((t) => t !== "accompagnement")).toBe(true);
      expect(i.fromFridge.length).toBeGreaterThan(0);
    }
    expect(d.fridge[0]!.fromFridge[0]).toMatch(/poireau/i);
  });

  it("saison : novembre propose des recettes aux légumes de saison, différentes de celles du frigo", () => {
    const d = run(fridge);
    expect(d.season.length).toBeGreaterThan(0);
    const fridgeIds = new Set(d.fridge.map((i) => i.s.recipe.id));
    for (const i of d.season) {
      expect(i.s.inSeason).toBe(true);
      expect(i.seasonal.length).toBeGreaterThan(0);
      expect(fridgeIds.has(i.s.recipe.id)).toBe(false);
    }
  });

  it("légumes de saison : ceux du frigo d'abord ; pas de tomate en novembre", () => {
    const d = run(fridge);
    expect(d.seasonalNow[0]!.inFridge).toBe(true);
    expect(d.seasonalNow.some((x) => x.id === "potimarron")).toBe(true);
    expect(d.seasonalNow.some((x) => x.id === "tomate")).toBe(false);
  });

  it("frigo vide : aucune idée « frigo », mais des idées de saison et le tirage au sort", () => {
    const d = run();
    expect(d.fridge).toEqual([]);
    expect(d.season.length).toBeGreaterThan(0);
    expect(d.pool.length).toBeGreaterThan(10);
  });

  it("ne repropose ni les plats déjà prévus, ni les recettes « pas pour nous »", () => {
    const first = run(fridge).fridge[0]!.s.recipe.id;
    for (const extra of [{ plannedIds: new Set([first]) }, { disliked: new Set([first]) }]) {
      const d = run(fridge, extra);
      expect([...d.fridge, ...d.season].some((i) => i.s.recipe.id === first)).toBe(false);
      expect(d.pool.some((s) => s.recipe.id === first)).toBe(false);
    }
  });

  it("listFr", () => {
    expect(listFr(["Poireau"])).toBe("poireau");
    expect(listFr(["Poireau", "Carotte", "Navet"])).toBe("poireau, carotte et navet");
    expect(listFr(["a", "b", "c", "d"])).toBe("a, b, c…");
  });
});
