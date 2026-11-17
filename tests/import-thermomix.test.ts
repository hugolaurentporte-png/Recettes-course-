/** Import Thermomix : brouillons non publiés, idempotence, doublons, règles du catalogue et filtre thermomix. */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { INGREDIENTS_BY_ID, getIngredient } from "@/lib/data/ingredients";
import { RECIPES } from "@/lib/data/recipes";
import { UNITS } from "@/lib/domain/units";
import { EMPTY_FILTERS, matchesFilters, rankRecipes } from "@/lib/domain/recommend";
import { dedupKey, fixTitle, importThermomix, minutesInSteps, type ThermomixDraft } from "@/lib/import/thermomixImport";

const source = JSON.parse(readFileSync("data/import/recettes_thermomix_300_complet.json", "utf8"));
const drafts = JSON.parse(readFileSync("src/lib/data/drafts/thermomix-import.json", "utf8")) as ThermomixDraft[];
const report = JSON.parse(readFileSync("data/import/rapport-thermomix.json", "utf8"));

describe("import Thermomix en brouillon", () => {
  it("catalogue complet importé (les 80 premières n'étaient pas présentes), un seul fichier", () => {
    expect(report.source).toBe("data/import/recettes_thermomix_300_complet.json");
    expect(report.acceptees + report.rejetees).toBe(300);
    expect(drafts).toHaveLength(report.acceptees);
  });

  it("rien n'est publié et l'appli ne change pas", () => {
    expect(drafts.every((d) => d.published === false && d.review.status === "brouillon")).toBe(true);
    expect(RECIPES.some((r) => r.id.startsWith("imp-tmx-"))).toBe(false);
    expect(drafts.some((d) => matchesFilters(d, EMPTY_FILTERS, getIngredient))).toBe(false);
  });

  it("idempotent", () => {
    expect(importThermomix(source, RECIPES, drafts).drafts).toEqual(drafts);
  });

  it("aucun doublon de nom avec les recettes Thermomix existantes ni entre elles", () => {
    const tm = RECIPES.filter((r) => r.id.startsWith("tm-")).map((r) => dedupKey(r.title));
    const keys = drafts.map((d) => dedupKey(d.title));
    expect(keys.filter((k) => tm.includes(k))).toEqual([]);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(drafts.length);
  });

  it("titres corrigés", () => {
    expect(fixTitle("Flan salé de épinards au ail")).toBe("Flan salé d'épinards à l'ail");
    expect(fixTitle("Crème dessert au pomme et cannelle")).toBe("Crème dessert à la pomme et cannelle");
    expect(fixTitle("Risotto de boulgour au champignons et persil")).toBe("Risotto de boulgour aux champignons et persil");
    expect(fixTitle("Dahl doux de pois chiches cuits et brocoli")).toBe("Dahl doux de pois chiches et brocoli");
  });

  it("filtre thermomix conservé : une fois publiées, elles sortent avec le mode thermomix", () => {
    const pub = drafts.map((d) => ({ ...d, published: true }));
    const res = rankRecipes(pub, { ...EMPTY_FILTERS, modes: ["thermomix"] }, { inventory: new Map(), getIngredient, month: 11 });
    expect(res).toHaveLength(pub.length);
    const noTm = rankRecipes(pub, { ...EMPTY_FILTERS, ownedEquipment: ["four", "poele", "casserole"] }, { inventory: new Map(), getIngredient, month: 11 });
    expect(noTm).toHaveLength(0);
  });
});

describe.each(drafts.map((d) => [d.id, d] as const))("brouillon %s", (_id, r) => {
  it("règles du catalogue et vérifications Thermomix", () => {
    expect(r.ingredients.filter((l) => !INGREDIENTS_BY_ID.has(l.ingredientId))).toEqual([]);
    expect(new Set(r.ingredients.map((l) => l.ingredientId)).size).toBe(r.ingredients.length);
    for (const l of r.ingredients) {
      expect((l.quantity === null) === (l.unit === null)).toBe(true);
      if (l.quantity !== null) expect(l.quantity > 0 && !!UNITS[l.unit!]).toBe(true);
    }
    expect(r.equipment).toEqual([{ type: "thermomix", required: true }]);
    expect(r.instructions.length).toBeGreaterThanOrEqual(3);
    expect(r.cookMinutes).toBeGreaterThanOrEqual(minutesInSteps(r.instructions));
    expect(r.totalMinutes).toBe(r.prepMinutes + r.cookMinutes);
    const text = r.instructions.join(" ");
    // TM5 : 120 °C maximum.
    for (const m of text.matchAll(/(\d+)\s*°C/g)) expect(Number(m[1])).toBeLessThanOrEqual(120);
    expect(r.review.bowlLoad).toBeLessThanOrEqual(2000);
    // L'eau n'est pas un achat : sa quantité est dans les étapes.
    if (/\beau\b/.test(text)) expect(text).toMatch(/\d+\s*ml d'eau|un peu d'eau/);
    if (r.ingredients.some((l) => l.ingredientId === "oeuf") && r.review.family === "Plat végétarien") {
      expect(text).toMatch(/lame d'un couteau doit ressortir propre/);
    }
  });
});
