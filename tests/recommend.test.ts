import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, rankRecipes, scoreRecipe, seasonScore } from "@/lib/domain/recommend";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES, RECIPES_BY_ID } from "@/lib/data/recipes";
import { inv } from "./helpers";

const base = { getIngredient, month: 7 };

describe("filtres stricts", () => {
  it("filtre par temps maximum", () => {
    const res = rankRecipes(RECIPES, { ...EMPTY_FILTERS, maxMinutes: 15 }, { ...base, inventory: new Map() });
    expect(res.length).toBeGreaterThan(0);
    expect(res.every((r) => r.recipe.totalMinutes <= 15)).toBe(true);
  });

  it("filtre par mode de cuisson", () => {
    const res = rankRecipes(RECIPES, { ...EMPTY_FILTERS, modes: ["airfryer"] }, { ...base, inventory: new Map() });
    expect(res.map((r) => r.recipe.id).sort()).toEqual(["airfryer-pdt", "airfryer-poulet"]);
  });

  it("exclut les recettes qui demandent un équipement que je n'ai pas (multi-équipements)", () => {
    const res = rankRecipes(RECIPES, { ...EMPTY_FILTERS, ownedEquipment: ["poele"] }, { ...base, inventory: new Map() });
    const ids = res.map((r) => r.recipe.id);
    expect(ids).toContain("omelette-champignons");
    expect(ids).not.toContain("hachis-parmentier"); // casserole + poêle + four
    expect(ids).not.toContain("pates-carbonara"); // casserole + poêle
    expect(ids).toContain("taboule"); // sans cuisson toujours possible
  });

  it("aucune recette ne correspond : liste vide, pas d'erreur", () => {
    const res = rankRecipes(
      RECIPES,
      { ...EMPTY_FILTERS, maxMinutes: 15, modes: ["cocotte"] },
      { ...base, inventory: new Map() },
    );
    expect(res).toEqual([]);
  });

  it("recherche par nom ou par ingrédient", () => {
    const ctx = { ...base, inventory: new Map() };
    expect(rankRecipes(RECIPES, { ...EMPTY_FILTERS, query: "tartiflette" }, ctx).map((r) => r.recipe.id)).toEqual(["tartiflette"]);
    const reblochon = rankRecipes(RECIPES, { ...EMPTY_FILTERS, query: "reblochon" }, ctx);
    expect(reblochon.map((r) => r.recipe.id)).toContain("tartiflette");
    const patates = rankRecipes(RECIPES, { ...EMPTY_FILTERS, query: "patate" }, ctx);
    expect(patates.length).toBeGreaterThan(3);
  });
});

describe("classement", () => {
  const omeletteStock = inv([
    ["oeuf", 6, "piece"], ["champignon", 300, "g"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null],
  ]);

  it("les recettes réalisables avec le stock passent en premier", () => {
    const res = rankRecipes(RECIPES, EMPTY_FILTERS, { ...base, inventory: omeletteStock });
    expect(res[0]!.recipe.id).toBe("omelette-champignons");
    expect(res[0]!.availability.allAvailable).toBe(true);
    // Les niveaux (0, 1, 2, 3+ manquants) sont croissants.
    const buckets = res.map((r) => r.availability.bucket);
    expect([...buckets].sort((a, b) => a - b)).toEqual(buckets);
  });

  it("les ingrédients prioritaires font remonter les recettes", () => {
    const withoutPriority = inv([["champignon", 300, "g"]]);
    const withPriority = inv([["champignon", 300, "g", true]]);
    const r1 = scoreRecipe(RECIPES_BY_ID.get("risotto-champignons")!, { ...base, inventory: withoutPriority });
    const r2 = scoreRecipe(RECIPES_BY_ID.get("risotto-champignons")!, { ...base, inventory: withPriority });
    expect(r2.score).toBeGreaterThan(r1.score);
    expect(r2.priorityUsed).toEqual(["champignon"]);
  });

  it("la saisonnalité influence le score sans exclure les recettes", () => {
    const ratatouille = RECIPES_BY_ID.get("ratatouille")!;
    expect(seasonScore(ratatouille, 8)).toBeGreaterThan(seasonScore(ratatouille, 1)!);
    const summer = scoreRecipe(ratatouille, { ...base, month: 8, inventory: new Map() });
    const winter = scoreRecipe(ratatouille, { ...base, month: 1, inventory: new Map() });
    expect(summer.score).toBeGreaterThan(winter.score);
    expect(summer.inSeason).toBe(true);
    // Hors saison, la recette reste accessible.
    const janvier = rankRecipes(RECIPES, EMPTY_FILTERS, { ...base, month: 1, inventory: new Map() });
    expect(janvier.map((r) => r.recipe.id)).toContain("ratatouille");
  });

  it("stock vide : toutes les recettes publiées restent proposées", () => {
    const res = rankRecipes(RECIPES, EMPTY_FILTERS, { ...base, inventory: new Map() });
    expect(res).toHaveLength(RECIPES.filter((r) => r.published).length);
  });

  it("filtre « réalisable maintenant »", () => {
    const res = rankRecipes(RECIPES, { ...EMPTY_FILTERS, onlyReady: true }, { ...base, inventory: omeletteStock });
    expect(res.map((r) => r.recipe.id)).toEqual(["omelette-champignons"]);
  });
});
