import { describe, expect, it } from "vitest";
import { dayLabel, prunePlan, servingsByRecipe, toDateKey, weekDays, type PlanEntry } from "@/lib/domain/plan";

const e = (date: string, recipeId: string, servings = 4, meal: "midi" | "soir" = "soir"): PlanEntry =>
  ({ id: `${date}-${meal}-${recipeId}`, date, meal, recipeId, servings });

describe("planning des repas", () => {
  it("semaine du lundi au dimanche, même un dimanche", () => {
    expect(weekDays(new Date(2026, 10, 17))).toEqual(
      ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(weekDays(new Date(2026, 10, 22))[0]).toBe("2026-11-16");
    expect(weekDays(new Date(2026, 10, 17), 1)[0]).toBe("2026-11-23");
    expect(weekDays(new Date(2026, 11, 30), 0)[6]).toBe("2027-01-03");
  });
  it("date locale au format AAAA-MM-JJ", () => {
    expect(toDateKey(new Date(2026, 0, 5, 23, 59))).toBe("2026-01-05");
  });
  it("libellé du jour", () => {
    expect(dayLabel("2026-11-17", "2026-11-17")).toBe("Aujourd'hui · Mardi 17 nov.");
    expect(dayLabel("2026-11-18", "2026-11-17")).toBe("Mercredi 18 nov.");
  });
  it("cumule les portions d'une recette prévue deux fois, sur les jours demandés seulement", () => {
    const plan = [e("2026-11-17", "a", 4), e("2026-11-19", "a", 2, "midi"), e("2026-11-18", "b", 3), e("2026-11-30", "c")];
    const m = servingsByRecipe(plan, weekDays(new Date(2026, 10, 17)));
    expect(Object.fromEntries(m)).toEqual({ a: 6, b: 3 });
  });
  it("oublie les entrées anciennes", () => {
    const plan = [e("2026-10-01", "a"), e("2026-11-10", "b")];
    expect(prunePlan(plan, new Date(2026, 10, 17)).map((x) => x.recipeId)).toEqual(["b"]);
  });
});
