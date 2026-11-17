import { describe, expect, it } from "vitest";
import { isHouseholdCode, itemsToPush, mergeRemote, newHouseholdCode } from "../src/lib/sync/engine";
import type { ShoppingItem } from "../src/lib/domain/types";

const item = (id: string, updatedAt: number, extra: Partial<ShoppingItem> = {}): ShoppingItem => ({
  id, listId: "default", ingredientId: null, customName: id, key: id, aisle: "autres", aisleLocked: false, manual: null,
  recipeNeeds: [], recipeMissing: [], toVerify: false, note: "", checked: false, checkedAt: null,
  createdAt: 0, updatedAt, deletedAt: null, updatedBy: "a", ...extra,
});

describe("liste partagée", () => {
  it("crée des codes de foyer longs et valides", () => {
    const code = newHouseholdCode((n) => crypto.getRandomValues(new Uint8Array(n)));
    expect(code).toHaveLength(24);
    expect(isHouseholdCode(code)).toBe(true);
    expect(isHouseholdCode("abc")).toBe(false);
    expect(isHouseholdCode(null)).toBe(false);
  });

  it("n'envoie que ce qui a changé depuis le dernier envoi", () => {
    expect(itemsToPush([item("a", 10), item("b", 20)], 15).map((i) => i.id)).toEqual(["b"]);
  });

  it("ajoute les articles du partenaire et garde la version la plus récente", () => {
    const local = [item("a", 10), item("b", 50, { checked: true })];
    const remote = [item("a", 30, { checked: true }), item("b", 40), item("c", 5)];
    const r = mergeRemote(local, remote)!;
    expect(r.items.map((i) => [i.id, i.checked])).toEqual([["a", true], ["b", true], ["c", false]]);
    expect(r.changed.map((i) => i.id)).toEqual(["a", "c"]);
  });

  it("propage une suppression", () => {
    const r = mergeRemote([item("a", 10)], [item("a", 20, { deletedAt: 20 })])!;
    expect(r.items[0]!.deletedAt).toBe(20);
  });

  it("ne change rien si le serveur n'a rien de plus récent", () => {
    expect(mergeRemote([item("a", 10)], [item("a", 10)])).toBeNull();
  });
});
