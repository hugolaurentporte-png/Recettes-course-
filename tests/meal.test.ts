import { describe, expect, it } from "vitest";
import { COURSES, matchesMeal, mealClass } from "@/lib/domain/meal";
import { EMPTY_FILTERS, rankRecipes } from "@/lib/domain/recommend";
import { recipeAvailability } from "@/lib/domain/availability";
import { summarizeAvailability, withArticle, withDe, joinFr } from "@/lib/domain/phrasing";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES, RECIPES_BY_ID } from "@/lib/data/recipes";
import { inv } from "./helpers";

const ing = (id: string) => getIngredient(id)!;

describe("classement entrée / plat / dessert", () => {
  it("chaque recette publiée a au moins un moment de repas, avec des types connus", () => {
    for (const r of RECIPES.filter((x) => x.published)) {
      const c = mealClass(r);
      expect(Object.keys(c).length, r.id).toBeGreaterThan(0);
      for (const def of COURSES) {
        for (const t of c[def.id] ?? []) expect(def.types.map((x) => x.id), `${r.id} → ${t}`).toContain(t);
      }
    }
  });

  it("chaque type proposé contient au moins une recette", () => {
    for (const def of COURSES) {
      for (const t of def.types) {
        expect(RECIPES.some((r) => matchesMeal(r, def.id, t.id)), `${def.id}/${t.id}`).toBe(true);
      }
    }
  });

  it("une recette peut être dans plusieurs catégories", () => {
    const soupe = RECIPES_BY_ID.get("soupe-legumes")!;
    expect(matchesMeal(soupe, "entree", "soupe")).toBe(true);
    expect(matchesMeal(soupe, "plat", "soupe-repas")).toBe(true);
    const quiche = RECIPES_BY_ID.get("quiche-lorraine")!;
    expect(matchesMeal(quiche, "plat", "quiche")).toBe(true);
    expect(matchesMeal(quiche, "entree", null)).toBe(true);
  });

  it("les desserts courts sont aussi des desserts rapides", () => {
    expect(matchesMeal(RECIPES_BY_ID.get("salade-fruits")!, "dessert", "rapide")).toBe(true);
    expect(matchesMeal(RECIPES_BY_ID.get("gateau-chocolat")!, "dessert", "rapide")).toBe(false);
  });

  it("Plat → Gratin : les recettes réalisables passent devant", () => {
    const inventory = inv([
      ["pomme-de-terre", 2, "kg"], ["creme", 50, "cl"], ["lait", 1, "l"], ["fromage-rape", 200, "g"],
      ["ail", 3, "piece"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null],
    ]);
    const res = rankRecipes(RECIPES, EMPTY_FILTERS, { inventory, getIngredient, month: 11 })
      .filter((s) => matchesMeal(s.recipe, "plat", "gratin"));
    expect(res.length).toBeGreaterThan(3);
    expect(res[0]?.recipe.id).toBe("gratin-dauphinois");
    expect(res[0]?.availability.allAvailable).toBe(true);
    const buckets = res.map((s) => s.availability.bucket);
    expect([...buckets].sort()).toEqual(buckets);
  });
});

describe("phrases des cartes", () => {
  it("articles et élisions", () => {
    expect(withArticle(ing("creme"))).toBe("la crème fraîche");
    expect(withArticle(ing("lait"))).toBe("le lait");
    expect(withArticle(ing("ail"))).toBe("l'ail");
    expect(withArticle(ing("pomme-de-terre"))).toBe("les pommes de terre");
    expect(withArticle(ing("mais"))).toBe("le maïs");
    expect(withDe(ing("pomme-de-terre"))).toBe("de pommes de terre");
    expect(withDe(ing("huile-olive"))).toBe("d'huile d'olive");
    expect(withDe(ing("haricot-vert"))).toBe("de haricots verts");
    expect(joinFr(["a", "b", "c", "d", "e"])).toBe("a, b et 3 autres");
  });

  const gratin = RECIPES_BY_ID.get("gratin-dauphinois")!;
  const full: [string, number | null, null | "g" | "ml" | "kg" | "l" | "piece"][] = [
    ["pomme-de-terre", 2, "kg"], ["creme", 1, "l"], ["lait", 1, "l"], ["fromage-rape", 500, "g"],
    ["ail", 5, "piece"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null], ["muscade", null, null],
  ];
  const summary = (entries: typeof full) =>
    summarizeAvailability(recipeAvailability(gratin, inv(entries), getIngredient));

  it("« Tu as tout » quand rien ne manque", () => {
    const s = summary(full.filter(([id]) => gratin.ingredients.some((l) => l.ingredientId === id)));
    expect(s.tone).toBe("ok");
    expect(s.lines.map((l) => l.text)).toEqual(["Tu as tout"]);
  });

  it("« Il manque la crème fraîche »", () => {
    const s = summary(full.filter(([id]) => id !== "creme"));
    expect(s.tone).toBe("missing");
    expect(s.lines[0]?.text).toBe("Il manque la crème fraîche");
  });

  it("« Quantité de pommes de terre à vérifier » si la quantité est inconnue", () => {
    const s = summary(full.map((e) => (e[0] === "pomme-de-terre" ? ["pomme-de-terre", null, null] : e)));
    expect(s.tone).toBe("verify");
    expect(s.lines).toEqual([{ kind: "verify", text: "Quantité de pommes de terre à vérifier" }]);
  });
});

describe("recettes importées", () => {
  it("chaque plat a au moins un type (sinon il n'apparaît que dans « Toutes les idées »)", () => {
    const sansType = RECIPES.filter((r) => r.published && mealClass(r).plat?.length === 0).map((r) => r.id);
    expect(sansType).toEqual([]);
  });
});
