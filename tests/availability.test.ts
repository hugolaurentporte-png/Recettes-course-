import { describe, expect, it } from "vitest";
import { computeMissing, recipeAvailability } from "@/lib/domain/availability";
import { getIngredient } from "@/lib/data/ingredients";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { inv } from "./helpers";

const gratin = RECIPES_BY_ID.get("gratin-pdt-carottes")!;
const omelette = RECIPES_BY_ID.get("omelette-champignons")!;

describe("calcul du manque pour un ingrédient", () => {
  it("ingrédient absent : tout manque", () => {
    const r = computeMissing([{ value: 200, unit: "ml" }], undefined);
    expect(r.absent).toBe(true);
    expect(r.missing).toEqual([{ value: 200, unit: "ml" }]);
  });

  it("quantité insuffisante : seule la différence manque", () => {
    const stock = inv([["pomme-de-terre", 500, "g"]]).get("pomme-de-terre");
    const r = computeMissing([{ value: 800, unit: "g" }], stock);
    expect(r.missing).toEqual([{ value: 300, unit: "g" }]);
  });

  it("stock en kg et besoin en g", () => {
    const stock = inv([["pomme-de-terre", 1, "kg"]]).get("pomme-de-terre");
    expect(computeMissing([{ value: 800, unit: "g" }], stock).missing).toEqual([]);
  });

  it("quantité en stock inconnue : à vérifier, sans inventer de manque", () => {
    const stock = inv([["creme", null, null]]).get("creme");
    const r = computeMissing([{ value: 200, unit: "ml" }], stock);
    expect(r.toVerify).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("unités incompatibles (pièces vs grammes) : à vérifier", () => {
    const stock = inv([["oignon", 300, "g"]]).get("oignon");
    const r = computeMissing([{ value: 2, unit: "piece" }], stock, getIngredient("oignon"));
    expect(r.toVerify).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("plusieurs recettes : le stock n'est compté qu'une fois", () => {
    const stock = inv([["pomme-de-terre", 500, "g"]]).get("pomme-de-terre");
    // 800 g + 1000 g demandés, 500 g en stock -> 1300 g, et non 300 + 500 = 800 g.
    const r = computeMissing([{ value: 800, unit: "g" }, { value: 1, unit: "kg" }], stock);
    expect(r.missing).toEqual([{ value: 1300, unit: "g" }]);
  });
});

describe("disponibilité d'une recette", () => {
  it("stock vide : tout manque, rien n'est « disponible »", () => {
    const a = recipeAvailability(omelette, new Map(), getIngredient);
    expect(a.allAvailable).toBe(false);
    expect(a.bucket).toBe(3);
  });

  it("ne dit jamais « tout disponible » si une quantité connue est insuffisante", () => {
    const stock = inv([
      ["oeuf", 2, "piece"], // 4 nécessaires
      ["champignon", 200, "g"],
      ["beurre", null, null],
      ["sel", null, null],
      ["poivre", null, null],
    ]);
    const a = recipeAvailability(omelette, stock, getIngredient);
    expect(a.allAvailable).toBe(false);
    expect(a.missingCount).toBe(1);
    expect(a.lines.find((l) => l.line.ingredientId === "oeuf")?.status).toBe("insufficient");
  });

  it("les ingrédients facultatifs ne comptent pas comme manquants", () => {
    const stock = inv([
      ["oeuf", 6, "piece"], ["champignon", 200, "g"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null],
    ]);
    const a = recipeAvailability(omelette, stock, getIngredient); // ciboulette facultative absente
    expect(a.allAvailable).toBe(true);
    expect(a.bucket).toBe(0);
  });

  it("ajuster les portions change le besoin", () => {
    const stock = inv([
      ["oeuf", 3, "piece"], ["champignon", 200, "g"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null],
    ]);
    expect(recipeAvailability(omelette, stock, getIngredient, 2).allAvailable).toBe(false); // 4 œufs
    expect(recipeAvailability(omelette, stock, getIngredient, 1).allAvailable).toBe(true); // 2 œufs
  });

  it("compte le nombre d'ingrédients manquants (exemple du cahier des charges)", () => {
    const stock = inv([
      ["pomme-de-terre", 1, "kg"], ["carotte", 500, "g"], ["lait", 1, "l"], ["ail", 3, "piece"],
      ["sel", null, null], ["poivre", null, null], ["beurre", null, null],
    ]);
    const a = recipeAvailability(gratin, stock, getIngredient);
    const missing = a.lines.filter((l) => l.status === "missing" && !l.line.optional).map((l) => l.line.ingredientId);
    expect(missing.sort()).toEqual(["creme", "fromage-rape"]);
    expect(a.bucket).toBe(2);
  });
});

describe("indispensables", () => {
  it("un indispensable possédé sans quantité est considéré disponible, pas « à vérifier »", () => {
    const stock = inv([["oeuf", 6, "piece"], ["champignon", 300, "g"], ["beurre", null, null], ["sel", null, null], ["poivre", null, null]]);
    const a = recipeAvailability(omelette, stock, getIngredient);
    expect(a.lines.find((l) => l.line.ingredientId === "beurre")?.status).toBe("ok");
    expect(a.verifyCount).toBe(0);
  });
});
