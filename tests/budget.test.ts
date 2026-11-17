import { describe, expect, it } from "vitest";
import { budgetStatus, monthKey, monthLabel, parseEuros, shiftMonth, totalOfMonth, tripsOfMonth } from "@/lib/domain/budget";
import type { ShoppingTrip } from "@/lib/domain/types";

const t = (d: Date, amount?: number): ShoppingTrip => ({ id: String(+d), listId: "default", finishedAt: +d, items: [], ...(amount === undefined ? {} : { amount }) });

describe("budget courses", () => {
  it("lit les montants tapés à la française", () => {
    expect(parseEuros("87,45")).toBe(87.45);
    expect(parseEuros("87.4 €")).toBe(87.4);
    expect(parseEuros("1 204,10")).toBe(1204.1);
    expect(parseEuros("")).toBeNull();
    expect(parseEuros("abc")).toBeNull();
    expect(parseEuros("-3")).toBeNull();
  });
  it("totalise le mois, sans les courses sans montant", () => {
    const trips = [t(new Date(2026, 10, 3), 50.1), t(new Date(2026, 10, 17), 20.25), t(new Date(2026, 10, 18)), t(new Date(2026, 9, 31), 99)];
    expect(totalOfMonth(trips, "2026-11")).toBe(70.35);
    expect(tripsOfMonth(trips, "2026-11").map((x) => x.amount)).toEqual([20.25, 50.1]);
  });
  it("mois précédent / suivant et libellé", () => {
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(monthLabel("2026-11")).toBe("novembre 2026");
    expect(monthKey(new Date(2026, 10, 30, 23, 59))).toBe("2026-11");
  });
  it("prévient quand on dépense plus vite que prévu", () => {
    const mid = new Date(2026, 10, 15);
    expect(budgetStatus(300, 400, mid, "2026-11")).toMatchObject({ remaining: 100, over: false, ahead: true });
    expect(budgetStatus(150, 400, mid, "2026-11").ahead).toBe(false);
    expect(budgetStatus(450, 400, mid, "2026-11").over).toBe(true);
  });
});

import { spendByAisle } from "@/lib/domain/budget";
import { addManualItem, finishShopping, toggleChecked } from "@/lib/domain/shopping";
import { INGREDIENTS, getIngredient } from "@/lib/data/ingredients";

describe("répartition par rayon", () => {
  const now = +new Date(2026, 10, 17);
  let n = 0;
  const ctx = { now, newId: () => `id${n++}`, deviceId: "d", listId: "default", catalog: INGREDIENTS, getIngredient };

  it("prix par article → total du ticket et répartition ; le reste est « non détaillé »", () => {
    let { items, item: steak } = addManualItem([], { name: "Steaks hachés" }, ctx);
    let lessive; ({ items, item: lessive } = addManualItem(items, { name: "Lessive" }, ctx));
    let pain; ({ items, item: pain } = addManualItem(items, { name: "Pain" }, ctx));
    for (const it of [steak, lessive, pain]) items = toggleChecked(items, it.id, ctx);
    const withPrices = finishShopping(items, ctx, { prices: new Map([[steak.id, 8.5], [lessive.id, 12]]) }).trip!;
    expect(withPrices.amount).toBe(20.5);
    const typed = finishShopping(items, ctx, { amount: 30, prices: new Map([[steak.id, 8.5]]) }).trip!;
    expect(typed.amount).toBe(30);
    const r = spendByAisle([withPrices, typed], "2026-11");
    expect(r.byAisle).toEqual([{ aisle: "viandes-poissons", amount: 17 }, { aisle: "maison", amount: 12 }]);
    expect(r.undetailed).toBe(21.5);
  });
  it("sans montant, le ticket ne compte pas", () => {
    let { items, item } = addManualItem([], { name: "Pain" }, ctx);
    items = toggleChecked(items, item.id, ctx);
    expect(finishShopping(items, ctx).trip!.amount).toBeUndefined();
  });
});
