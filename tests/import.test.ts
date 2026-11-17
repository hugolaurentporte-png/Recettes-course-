/**
 * Import des 1000 recettes générées : brouillons non publiés, idempotence, sécurité alimentaire,
 * et comportement des filtres / de la liste de courses une fois ces recettes publiées.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { INGREDIENTS_BY_ID, getIngredient } from "@/lib/data/ingredients";
import { BASE_RECIPES, RECIPES } from "@/lib/data/recipes";
import { UNITS } from "@/lib/domain/units";
import { EMPTY_FILTERS, matchesFilters, rankRecipes, scoreRecipe, type Context } from "@/lib/domain/recommend";
import { searchRecipeTitles } from "@/lib/domain/search";
import { activeItems, addRecipeToList, displayAmounts } from "@/lib/domain/shopping";
import { importRecipes, publishedFromDrafts, type DraftRecipe, type SourceFile } from "@/lib/import/recipeImport";
import type { Recipe } from "@/lib/domain/types";
import { ctx, inv } from "./helpers";

const source = JSON.parse(readFileSync("data/import/recettes_1000_import.json", "utf8")) as SourceFile;
const drafts = JSON.parse(readFileSync("src/lib/data/drafts/recettes-import.json", "utf8")) as DraftRecipe[];
const report = JSON.parse(readFileSync("data/import/rapport-import.json", "utf8"));
const byId = new Map(drafts.map((d) => [d.id, d]));

/** Copie « publiée » d'un brouillon, pour vérifier les filtres comme après validation. */
const asPublished = (d: DraftRecipe): Recipe => ({ ...d, published: true });
const published = drafts.map(asPublished);

function draftWith(family: string, ...ingredientIds: string[]): DraftRecipe {
  const d = drafts.find((r) => r.review.family === family && ingredientIds.every((id) => r.ingredients.some((l) => l.ingredientId === id)));
  if (!d) throw new Error(`Aucun brouillon ${family} avec ${ingredientIds.join(", ")}`);
  return d;
}

function filesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? filesUnder(p) : [p];
  });
}

describe("import en brouillon", () => {
  it("les 98 recettes existantes sont intactes ; seules les recettes validées sont publiées", () => {
    expect(BASE_RECIPES).toHaveLength(98);
    expect(BASE_RECIPES.some((r) => r.id.startsWith("imp-"))).toBe(false);
    expect(drafts.every((d) => d.published === false)).toBe(true);
    const valid = drafts.filter((d) => d.review.status === "valide").map((d) => d.id);
    expect(RECIPES.filter((r) => r.id.startsWith("imp-")).map((r) => r.id)).toEqual(valid);
    expect(RECIPES).toHaveLength(98 + valid.length);
    expect(RECIPES.every((r) => r.published)).toBe(true);
    expect(publishedFromDrafts(drafts)).toEqual(RECIPES.slice(98));
  });

  it("décisions de relecture : une seule version par paire, pas de curry aux lardons", () => {
    const pub = new Set(RECIPES.map((r) => r.id));
    for (const d of drafts) {
      if (d.review.variantOf) expect(pub.has(d.id)).toBe(false);
      if (d.review.family === "curry" && d.ingredients.some((l) => l.ingredientId === "lardon")) expect(pub.has(d.id)).toBe(false);
    }
    const eggs = drafts.flatMap((d) => d.ingredients.filter((l) => l.ingredientId === "oeuf"));
    expect(eggs.every((l) => l.quantity === 8)).toBe(true);
    const lardons = drafts.flatMap((d) => d.ingredients.filter((l) => l.ingredientId === "lardon"));
    expect(lardons.every((l) => l.quantity === 250)).toBe(true);
  });

  it("le code de l'appli ne charge pas les brouillons", () => {
    const appFiles = [...filesUnder("src/app"), ...filesUnder("src/components"), ...filesUnder("src/lib")]
      .filter((f) => /\.(ts|tsx)$/.test(f) && !f.includes(join("src", "lib", "import")));
    const offenders = appFiles.filter((f) => /drafts\/|recettes-import\.json/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("chaque entrée est soit acceptée en brouillon, soit rejetée avec un motif", () => {
    expect(report.acceptees + report.rejetees).toBe(source.recettes.length);
    expect(drafts).toHaveLength(report.acceptees);
    expect(new Set(drafts.map((d) => d.id)).size).toBe(drafts.length);
    for (const r of report.rejets) expect(r.detail.length).toBeGreaterThan(10);
  });

  it("import idempotent : relancer donne exactement le même résultat", () => {
    const again = importRecipes(source, BASE_RECIPES, drafts);
    expect(again.drafts).toEqual(drafts);
    expect(again.rejected).toEqual(report.rejets);
  });

  it("une décision de relecture humaine est conservée au ré-import", () => {
    const first = drafts[0]!;
    const previous = [{ ...first, review: { ...first.review, status: "refuse" as const } }];
    const again = importRecipes(source, BASE_RECIPES, previous);
    expect(again.drafts[0]!.review.status).toBe("refuse");
    expect(again.drafts[1]!.review.status).toBe(drafts[1]!.review.status);
  });

  it("aucun brouillon ne double une recette existante par son titre", () => {
    const norm = (t: string) => t.toLowerCase();
    const titles = new Set(BASE_RECIPES.map((r) => norm(r.title)));
    expect(drafts.filter((d) => titles.has(norm(d.title)))).toEqual([]);
  });

  it("les variantes très proches pointent vers une recette importée de la même famille", () => {
    for (const d of drafts.filter((x) => x.review.variantOf)) {
      const twin = byId.get(d.review.variantOf!);
      expect(twin?.review.family).toBe(d.review.family);
    }
  });
});

describe.each(drafts.map((d) => [d.id, d] as const))("brouillon %s", (_id, r) => {
  it("respecte les règles du catalogue (ingrédients, quantités, temps, étapes, équipement)", () => {
    expect(r.ingredients.filter((l) => !INGREDIENTS_BY_ID.has(l.ingredientId))).toEqual([]);
    expect(new Set(r.ingredients.map((l) => l.ingredientId)).size).toBe(r.ingredients.length);
    for (const l of r.ingredients) {
      expect((l.quantity === null) === (l.unit === null)).toBe(true);
      if (l.quantity !== null) {
        expect(l.quantity).toBeGreaterThan(0);
        expect(UNITS[l.unit!]).toBeDefined();
      }
    }
    expect(r.prepMinutes).toBeGreaterThan(0);
    expect(r.totalMinutes).toBe(r.prepMinutes + r.cookMinutes);
    expect(r.totalMinutes).toBeLessThanOrEqual(6 * 60);
    expect(r.instructions.length).toBeGreaterThanOrEqual(3);
    expect(r.instructions.every((s) => s.trim().length > 15)).toBe(true);
    expect(r.equipment.some((e) => e.required)).toBe(true);
  });

  it("sécurité alimentaire : cuisson à cœur explicite", () => {
    const text = r.instructions.join(" ");
    const has = (id: string) => r.ingredients.some((l) => l.ingredientId === id);
    if (has("poulet") || has("dinde")) expect(text).toMatch(/sans aucune trace rosée \(74 °C à cœur\)/);
    if (has("saumon") || has("cabillaud")) expect(text).toMatch(/opaque à cœur.*63 °C/);
    if (has("oeuf")) expect(text).toMatch(/10 minutes : le jaune doit être entièrement pris/);
    expect(text).not.toMatch(/selon la méthode indiquée/);
  });

  it("l'équipement déclaré correspond aux étapes", () => {
    const text = r.instructions.join(" ").toLowerCase();
    const eq = new Set(r.equipment.map((e) => e.type));
    if (/\bpoêle\b/.test(text)) expect(eq.has("poele")).toBe(true);
    if (/\bcasserole\b/.test(text)) expect(eq.has("casserole")).toBe(true);
    if (/\bcocotte\b/.test(text)) expect(eq.has("cocotte")).toBe(true);
    if (/\bfour\b|enfourner/.test(text)) expect(eq.has("four")).toBe(true);
  });
});

describe("filtres de l'appli appliqués aux recettes importées (une fois publiées)", () => {
  const base: Context = { inventory: new Map(), getIngredient, month: 5 };

  it("brouillons invisibles : exclus des suggestions et de la recherche", () => {
    expect(drafts.some((d) => matchesFilters(d, EMPTY_FILTERS, getIngredient))).toBe(false);
    expect(searchRecipeTitles("plaque rôtie", 5, drafts)).toEqual([]);
    expect(searchRecipeTitles("plaque rôtie", 5, published).length).toBeGreaterThan(0);
  });

  it("saison : les asperges sont de saison en mai, pas en novembre", () => {
    const asperges = asPublished(draftWith("poelee", "asperge"));
    expect(scoreRecipe(asperges, { ...base, month: 5 }).season!).toBeGreaterThan(scoreRecipe(asperges, { ...base, month: 11 }).season!);
    expect(scoreRecipe(asperges, { ...base, month: 11 }).inSeason).toBe(false);
  });

  it("cuisson : le filtre « cocotte » ne garde que les cocottes, sans four on écarte gratins et plaques", () => {
    const cocotte = rankRecipes(published, { ...EMPTY_FILTERS, modes: ["cocotte"] }, base);
    expect(cocotte.length).toBeGreaterThan(0);
    expect(cocotte.every((s) => (s.recipe as DraftRecipe).review.family === "mijote")).toBe(true);
    const noOven = rankRecipes(published, { ...EMPTY_FILTERS, ownedEquipment: ["poele", "casserole", "cocotte"] }, base);
    expect(noOven.length).toBeGreaterThan(0);
    expect(noOven.some((s) => s.recipe.equipment.some((e) => e.type === "four"))).toBe(false);
  });

  it("durée : le filtre de temps maximum est respecté", () => {
    const max = 45 as const;
    const res = rankRecipes(published, { ...EMPTY_FILTERS, maxMinutes: max }, base);
    expect(res.every((s) => s.recipe.totalMinutes <= max)).toBe(true);
    expect(res.length).toBe(published.filter((r) => r.totalMinutes <= max).length);
  });

  it("ingrédients manquants : tout en stock = réalisable, un ingrédient en moins = 1 manquant", () => {
    const r = asPublished(draftWith("curry", "brocoli", "tofu"));
    const full = inv(r.ingredients.map((l) => [l.ingredientId, l.quantity === null ? null : l.quantity * 2, l.unit]));
    const ok = rankRecipes([r], EMPTY_FILTERS, { ...base, inventory: full });
    expect(ok[0]!.availability.allAvailable).toBe(true);
    full.delete("tofu");
    const one = rankRecipes([r], EMPTY_FILTERS, { ...base, inventory: full });
    expect(one[0]!.availability.missingCount).toBe(1);
  });

  it("liste de courses : les quantités sont reprises, le saumon en pavés et le stock déduit", () => {
    const r = asPublished(draftWith("gratin", "saumon", "brocoli"));
    const stock = inv([["creme", 50, "ml"], ["sel", null, null], ["poivre", null, null], ["huile-olive", null, null], ["moutarde", null, null]]);
    const { items } = addRecipeToList([], r, 4, stock, ctx());
    const got = Object.fromEntries(activeItems(items).map((i) => [i.ingredientId, displayAmounts(i)]));
    expect(got.saumon).toEqual([{ value: 4, unit: "piece" }]);
    expect(got.creme).toEqual([{ value: 150, unit: "ml" }]);
    expect(got.brocoli).toEqual([{ value: 600, unit: "g" }]);
    expect(got.sel).toBeUndefined();
    const aisles = Object.fromEntries(activeItems(items).map((i) => [i.ingredientId, i.aisle]));
    expect(aisles.saumon).toBe("viandes-poissons");
    expect(aisles.brocoli).toBe("fruits-legumes");
  });
});
