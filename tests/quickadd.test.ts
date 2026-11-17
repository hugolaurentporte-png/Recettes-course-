import { describe, expect, it } from "vitest";
import { QUICK_ADD_GROUPS, getIngredient } from "../src/lib/data/ingredients";
import { quickAddGroups } from "../src/lib/data/quickadd";
import { seasonLevel } from "../src/lib/data/seasonality";

describe("ajout rapide du frigo", () => {
  it("ne référence que des ingrédients du catalogue, sans doublon", () => {
    const ids = QUICK_ADD_GROUPS.flatMap((g) => g.ids);
    for (const id of ids) expect(getIngredient(id), id).toBeTruthy();
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBeGreaterThanOrEqual(60);
  });

  it("garde les produits courants en tête et ajoute ceux de saison au bout, sans doublon", () => {
    const groups = quickAddGroups(11);
    const legumes = groups[0]!.items.map((i) => i.id);
    expect(legumes[0]).toBe("pomme-de-terre");
    expect(legumes.slice(-6).every((id) => seasonLevel(id, 11) === 2)).toBe(true);
    expect(groups.find((g) => g.label.includes("Viandes"))!.items[0]!.id).toBe("oeuf");
    for (const g of groups) expect(new Set(g.items.map((i) => i.id)).size).toBe(g.items.length);
  });
});
