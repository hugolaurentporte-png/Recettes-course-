import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import {
  DB_NAME, getDb, getMeta, loadAll, purgeTombstones, putInventory, putShopping, resetDbConnection, setMeta,
} from "@/lib/storage/db";
import { addManualItem, deleteItem } from "@/lib/domain/shopping";
import { ctx } from "./helpers";

async function reopen() {
  // Simule une fermeture puis réouverture de l'application.
  (await getDb()).close();
  resetDbConnection();
}

describe("persistance locale", () => {
  it("la liste de courses et l'inventaire survivent à une réouverture", async () => {
    const c = ctx();
    let { items } = addManualItem([], { name: "Lait", quantity: 1, unit: "l" }, c);
    ({ items } = addManualItem(items, { name: "Papier toilette" }, c));
    await putShopping(items);
    await putInventory([{ id: "i1", ingredientId: "oeuf", quantity: 6, unit: "piece", priority: true, updatedAt: 1 }]);
    await setMeta("onboarded", true);

    await reopen();

    const data = await loadAll();
    expect(data.shopping.map((i) => i.customName).sort()).toEqual(["Lait", "Papier toilette"]);
    expect(data.inventory[0]).toMatchObject({ ingredientId: "oeuf", quantity: 6, priority: true });
    expect(await getMeta<boolean>("onboarded")).toBe(true);
  });

  it("purge les suppressions anciennes mais garde les récentes", async () => {
    await reopen();
    indexedDB.deleteDatabase(DB_NAME);
    const old = ctx(1000);
    let { items } = addManualItem([], { name: "Ancien" }, old);
    items = deleteItem(items, items[0]!.id, old);
    const recent = ctx(10_000_000_000);
    const r = addManualItem([], { name: "Récent" }, { ...recent, newId: () => "recent" });
    const recentItems = deleteItem(r.items, "recent", recent);
    await putShopping([...items, ...recentItems]);
    await purgeTombstones(10_000_000_000 + 1000);
    const left = (await loadAll()).shopping.map((i) => i.customName);
    expect(left).toContain("Récent");
    expect(left).not.toContain("Ancien");
  });
});
