import { describe, expect, it } from "vitest";
import { searchIngredients, searchRecipeTitles } from "@/lib/domain/search";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import { EMPTY_FILTERS, matchesFilters } from "@/lib/domain/recommend";

describe("recherche avec suggestions", () => {
  it("propose des ingrédients dès la première lettre", () => {
    const r = searchIngredients("t");
    expect(r.length).toBeGreaterThan(0);
    expect(r.every((i) => i.normalizedName.length > 0)).toBe(true);
  });
  it("ignore les accents et les majuscules", () => {
    expect(searchIngredients("Pomme de te").map((i) => i.id)).toEqual(searchIngredients("pomme de te").map((i) => i.id));
    expect(searchIngredients("oeuf").length).toBeGreaterThan(0);
    expect(searchIngredients("épin").map((i) => i.id)).toEqual(searchIngredients("epin").map((i) => i.id));
  });
  it("ne propose rien pour une saisie vide", () => {
    expect(searchIngredients("  ")).toEqual([]);
    expect(searchRecipeTitles("")).toEqual([]);
  });
  it("trouve une recette par le début de son nom", () => {
    const r = searchRecipeTitles("ome");
    expect(r.some((x) => x.title.toLowerCase().startsWith("omelette"))).toBe(true);
  });
});

describe("fruits et légumes du catalogue", () => {
  it("trouve le potimarron et les légumes d'hiver", () => {
    expect(searchIngredients("potim")[0]?.id).toBe("potimarron");
    expect(searchIngredients("panais")[0]?.category).toBe("legumes");
    expect(searchIngredients("courge").map((i) => i.id)).toEqual(expect.arrayContaining(["potimarron", "butternut"]));
  });
  it("range les fruits dans la catégorie fruits", () => {
    expect(searchIngredients("myrtil")[0]?.category).toBe("fruits");
  });
});

describe("recherche de quenelles et des classiques (lot 3)", () => {
  const ctxMatch = (q: string) =>
    RECIPES.filter((r) => matchesFilters(r, { ...EMPTY_FILTERS, query: q }, getIngredient)).map((r) => r.id);

  it("« quenelle », « quenelles », « Quenelles » et « quenèlle » trouvent les mêmes recettes", () => {
    const ref = ctxMatch("quenelle");
    expect(ref).toEqual(expect.arrayContaining(["quenelles-nantua", "gratin-quenelles", "quenelles-sauce-tomate", "tm-gratin-quenelles"]));
    for (const q of ["quenelles", "Quenelles", "QUENELLE", "quenèlle", " quenelles "]) expect(ctxMatch(q)).toEqual(ref);
  });
  it("les suggestions de l'accueil marchent au singulier comme au pluriel", () => {
    for (const q of ["quenelle", "quenelles", "quen"]) {
      expect(searchRecipeTitles(q, 10).map((r) => r.id)).toEqual(expect.arrayContaining(["quenelles-nantua", "gratin-quenelles"]));
    }
    expect(searchRecipeTitles("tomates farcie", 3)[0]?.id).toBe("tomates-farcies");
    expect(searchRecipeTitles("pot au feu", 3)[0]?.id).toBe("pot-au-feu");
    expect(searchRecipeTitles("ile flottante", 3).map((r) => r.id)).toContain("ile-flottante");
  });
  it("l'ingrédient quenelle est proposé dans le frigo", () => {
    expect(searchIngredients("quenel")[0]?.id).toBe("quenelle");
  });
});
