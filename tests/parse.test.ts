import { describe, expect, it } from "vitest";
import { parseItemInput } from "@/lib/domain/parse";

describe("saisie rapide", () => {
  it.each([
    ["2 kg pommes de terre", "pommes de terre", 2, "kg"],
    ["500g de farine", "farine", 500, "g"],
    ["lait 1l", "lait", 1, "l"],
    ["6 œufs", "œufs", 6, "piece"],
    ["3x yaourts", "yaourts", 3, "piece"],
    ["farine 1,5 kg", "farine", 1.5, "kg"],
    ["Papier toilette", "Papier toilette", null, null],
    ["Lessive", "Lessive", null, null],
  ])("%s", (input, name, quantity, unit) => {
    expect(parseItemInput(input)).toEqual({ name, quantity, unit });
  });
});
