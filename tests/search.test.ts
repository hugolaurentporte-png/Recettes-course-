import { describe, expect, it } from "vitest";
import { searchIngredients, searchRecipeTitles } from "@/lib/domain/search";

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
