import { describe, expect, it } from "vitest";
import { convert, formatAmount, scaleQuantity, sumAmounts } from "@/lib/domain/units";
import type { Ingredient } from "@/lib/domain/types";

const fakeEgg: Ingredient = {
  id: "x", name: "X", normalizedName: "x", category: "oeufs", defaultUnit: "piece", aliases: [], pieceGrams: 50,
};

describe("conversion des unités", () => {
  it("convertit kg <-> g et l <-> ml <-> cl", () => {
    expect(convert({ value: 1.5, unit: "kg" }, "g")).toBe(1500);
    expect(convert({ value: 250, unit: "ml" }, "l")).toBe(0.25);
    expect(convert({ value: 20, unit: "cl" }, "ml")).toBe(200);
    expect(convert({ value: 1, unit: "cs" }, "cc")).toBe(3);
  });

  it("refuse de convertir des pièces en grammes sans équivalence documentée", () => {
    expect(convert({ value: 2, unit: "piece" }, "g")).toBeNull();
    expect(convert({ value: 100, unit: "g" }, "ml")).toBeNull();
  });

  it("convertit pièces -> grammes uniquement avec une équivalence connue", () => {
    expect(convert({ value: 2, unit: "piece" }, "g", fakeEgg)).toBe(100);
    expect(convert({ value: 150, unit: "g" }, "piece", fakeEgg)).toBe(3);
  });

  it("additionne les quantités compatibles et garde les autres séparées", () => {
    const s = sumAmounts([
      { value: 500, unit: "g" },
      { value: 1, unit: "kg" },
      { value: 2, unit: "piece" },
    ]);
    expect(s).toEqual([
      { value: 1500, unit: "g" },
      { value: 2, unit: "piece" },
    ]);
  });

  it("affiche des quantités lisibles", () => {
    expect(formatAmount({ value: 1500, unit: "g" })).toBe("1,5 kg");
    expect(formatAmount({ value: 300, unit: "g" })).toBe("300 g");
    expect(formatAmount({ value: 2, unit: "piece" })).toBe("2 pièces");
    expect(formatAmount({ value: 6, unit: "cc" })).toBe("2 c. à soupe");
  });

  it("recalcule les quantités selon les portions", () => {
    expect(scaleQuantity(800, "g", 4, 2)).toBe(400);
    expect(scaleQuantity(3, "piece", 4, 2)).toBe(1.5);
    expect(scaleQuantity(3, "piece", 4, 6)).toBe(4.5);
    expect(scaleQuantity(200, "ml", 4, 6)).toBe(300);
  });
});
