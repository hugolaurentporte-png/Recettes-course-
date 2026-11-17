import { describe, expect, it } from "vitest";
import { activePlan, normalizePlan, patchSlot, plannedAt, servingsByRecipe, setSlot, nextDay, type PlanEntry } from "@/lib/domain/plan";
import { collapseRecipeDuplicates, docsToPush, mergeDocs } from "@/lib/sync/engine";
import { addRecipeToList } from "@/lib/domain/shopping";
import { RECIPES_BY_ID } from "@/lib/data/recipes";
import { ctx, inv } from "./helpers";

const gratin = RECIPES_BY_ID.get("gratin-pdt-carottes")!;

describe("plat prévu à deux", () => {
  it("un créneau = un plat : prévoir à nouveau remplace", () => {
    let plan = setSlot([], { date: "2026-11-17", meal: "soir", recipeId: "a", servings: 4 }, 100, "A");
    plan = setSlot(plan, { date: "2026-11-17", meal: "soir", recipeId: "b", servings: 2 }, 50, "B");
    expect(plan).toHaveLength(1);
    expect(plan[0]).toMatchObject({ id: "2026-11-17|soir", recipeId: "b", servings: 2, updatedBy: "B" });
    expect(plan[0]!.updatedAt).toBe(101); // plus récent même si l'horloge de B retarde
  });

  it("retirer laisse une trace pour l'autre téléphone, mais disparaît du planning", () => {
    const plan = patchSlot(setSlot([], { date: "2026-11-17", meal: "soir", recipeId: "a", servings: 4 }, 100, "A"),
      "2026-11-17|soir", { deletedAt: 200 }, 200, "B");
    expect(activePlan(plan)).toHaveLength(0);
    expect(plannedAt(plan, "2026-11-17", "soir")).toBeUndefined();
    expect(servingsByRecipe(plan, ["2026-11-17"]).size).toBe(0);
    expect(docsToPush(plan, 150)).toHaveLength(1);
  });

  it("le plat prévu par l'un arrive chez l'autre ; le plus récent gagne", () => {
    const a = setSlot([], { date: "2026-11-17", meal: "soir", recipeId: "gratin", servings: 4 }, 100, "A");
    const b = setSlot([], { date: "2026-11-17", meal: "soir", recipeId: "pates", servings: 2 }, 90, "B");
    expect(mergeDocs(b, a)![0]!.recipeId).toBe("gratin");
    expect(mergeDocs(a, b)).toBeNull();
  });

  it("anciens plannings : un identifiant par créneau", () => {
    const old: PlanEntry[] = [
      { id: "x", date: "2026-11-17", meal: "soir", recipeId: "a", servings: 4 },
      { id: "y", date: "2026-11-18", meal: "midi", recipeId: "b", servings: 2 },
    ];
    expect(normalizePlan(old).map((e) => [e.id, e.updatedAt])).toEqual([["2026-11-17|soir", 1], ["2026-11-18|midi", 1]]);
  });

  it("lendemain, y compris en fin de mois", () => {
    expect(nextDay("2026-11-30")).toBe("2026-12-01");
  });

  it("les deux appuient en même temps : une seule ligne « crème » au final", () => {
    const stock = inv([["pomme-de-terre", 1000, "g"], ["carotte", 500, "g"], ["lait", 1, "l"], ["fromage-rape", 200, "g"], ["ail", 3, "piece"], ["beurre", 100, "g"], ["sel", null, null], ["poivre", null, null]]);
    const mine = addRecipeToList([], gratin, 4, stock, { ...ctx(1000), newId: () => "id-b" }).items;
    const theirs = addRecipeToList([], gratin, 4, stock, { ...ctx(1001), newId: () => "id-a" }).items;
    expect(mine.map((i) => i.customName)).toEqual(["Crème fraîche"]);
    const both = [...mine, ...theirs];
    const removed = collapseRecipeDuplicates(both, 2000, "dev");
    expect(removed.map((r) => r.id)).toEqual(["id-b"]);
    // Le même choix sur l'autre téléphone (ordre différent) : les deux convergent.
    expect(collapseRecipeDuplicates([...theirs, ...mine], 2000, "dev2").map((r) => r.id)).toEqual(["id-b"]);
  });

  it("ne fusionne pas une ligne ajoutée à la main", () => {
    const stock = inv([]);
    const a = addRecipeToList([], gratin, 4, stock, { ...ctx(1), newId: () => "a" }).items.find((i) => i.key === "ing:creme")!;
    const b = { ...a, id: "b", manual: { quantity: 1, unit: "piece" as const } };
    expect(collapseRecipeDuplicates([a, b], 10, "d")).toHaveLength(0);
  });
});
