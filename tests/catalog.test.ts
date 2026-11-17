/**
 * Validation du catalogue : toute nouvelle recette doit passer ces règles.
 * Lancer seul : npm run validate:recipes
 */
import { describe, expect, it } from "vitest";
import { INGREDIENTS, INGREDIENTS_BY_ID } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import { SEASONALITY } from "@/lib/data/seasonality";
import { UNITS } from "@/lib/domain/units";

describe("catalogue d'ingrédients", () => {
  it("identifiants uniques", () => {
    expect(new Set(INGREDIENTS.map((i) => i.id)).size).toBe(INGREDIENTS.length);
  });
  it("chaque ingrédient saisonnier a un calendrier", () => {
    const cal = SEASONALITY["FR-METRO"]!;
    const missing = INGREDIENTS.filter((i) => i.seasonal && !cal[i.id]).map((i) => i.id);
    expect(missing).toEqual([]);
  });
});

describe.each(RECIPES.map((r) => [r.id, r] as const))("recette %s", (_id, r) => {
  it("ingrédients connus du catalogue, sans doublon", () => {
    const unknown = r.ingredients.filter((l) => !INGREDIENTS_BY_ID.has(l.ingredientId)).map((l) => l.ingredientId);
    expect(unknown).toEqual([]);
    const ids = r.ingredients.map((l) => l.ingredientId);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("quantités cohérentes (positives, unité valide, quantité et unité ensemble)", () => {
    for (const l of r.ingredients) {
      expect((l.quantity === null) === (l.unit === null)).toBe(true);
      if (l.quantity !== null) {
        expect(l.quantity).toBeGreaterThan(0);
        expect(UNITS[l.unit!]).toBeDefined();
      }
    }
  });
  it("temps réalistes", () => {
    expect(r.prepMinutes).toBeGreaterThan(0);
    expect(r.cookMinutes).toBeGreaterThanOrEqual(0);
    expect(r.totalMinutes).toBeGreaterThanOrEqual(r.prepMinutes + r.cookMinutes);
    expect(r.totalMinutes).toBeLessThanOrEqual(6 * 60);
  });
  it("instructions complètes et équipement précisé", () => {
    expect(r.instructions.length).toBeGreaterThanOrEqual(3);
    expect(r.instructions.every((s) => s.trim().length > 15)).toBe(true);
    expect(r.equipment.some((e) => e.required)).toBe(true);
    expect(r.servings).toBeGreaterThan(0);
    expect(r.ingredients.filter((l) => !l.optional).length).toBeGreaterThanOrEqual(2);
  });
});

it("identifiants de recettes uniques", () => {
  expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
});
